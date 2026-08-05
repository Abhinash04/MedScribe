import {
  FEMALE_NOUNS,
  FEMALE_PRONOUNS,
  MALE_NOUNS,
  MALE_PRONOUNS,
  RELATIVE_NOUNS,
} from '../../constants/clinicalCues.js';
import { CONFIDENCE } from '../../constants/fieldMarkers.js';

/**
 * Evidence that does not open a segment.
 *
 * Precedence: an explicit "gender female" marker (handled upstream as a normal
 * segment) beats a patient noun, which beats a pronoun. Conflicting evidence at
 * the same level yields nothing — a wrong gender in a patient record is worse
 * than a blank one.
 */

const RELATIVE_WINDOW = 24;
const SENTENCE_END = /[.;?!]/;

/** Trims a window at the first sentence boundary, scanning outward from the match. */
const untilBoundary = (slice, fromEnd) => {
  const index = fromEnd ? slice.search(SENTENCE_END) : slice.split('').reverse().join('').search(SENTENCE_END);
  if (index === -1) {
    return slice;
  }
  return fromEnd ? slice.slice(0, index) : slice.slice(slice.length - index);
};

/**
 * True when a companion noun sits beside the match — "her mother" puts it
 * after, "the husband says she" puts it before.
 *
 * The window stops at a sentence boundary. Without that, "This lady presented
 * with fever. His attendant waited outside." let the attendant in the NEXT
 * sentence veto the patient noun in this one.
 */
function refersToCompanion(text, index, length) {
  const before = untilBoundary(
    text.slice(Math.max(0, index - RELATIVE_WINDOW), index),
    false,
  );
  const after = untilBoundary(
    text.slice(index + length, index + length + RELATIVE_WINDOW),
    true,
  );
  return RELATIVE_NOUNS.test(before) || RELATIVE_NOUNS.test(after);
}

function countMatches(text, pattern, { skipCompanions = true } = {}) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  const hits = [];
  let match = regex.exec(text);
  while (match) {
    if (!skipCompanions || !refersToCompanion(text, match.index, match[0].length)) {
      hits.push({ index: match.index, text: match[0] });
    }
    match = regex.exec(text);
  }
  return hits;
}

/**
 * Drops hits that another field genuinely kept.
 *
 * A segment SPANS from its marker to the next one, which is far wider than the
 * text it ends up keeping: "age 38 years male patient address…" gives the age
 * segment the whole of "38 years male patient" while its value is "38 Years".
 * Excluding on the span alone therefore threw away the only gender evidence in
 * the dictation.
 *
 * The test is whether the field's own value contains the word. An address of
 * "Male Street" keeps it and is still excluded; an age that discarded it is
 * not, so the word is free-standing evidence again.
 */
function claimedByValue(hits, segments) {
  const keeps = (segment, word) => {
    const value = Array.isArray(segment.value)
      ? segment.value.join(' ')
      : String(segment.value ?? '');
    return value.toLowerCase().includes(word.toLowerCase());
  };

  return hits.filter(
    hit =>
      !segments.some(
        segment =>
          hit.index >= segment.start &&
          hit.index < segment.end &&
          keeps(segment, hit.text),
      ),
  );
}

export function inferGender(text, claimed = []) {
  const segments = claimed;
  const femaleNouns = claimedByValue(countMatches(text, FEMALE_NOUNS), segments);
  const maleNouns = claimedByValue(countMatches(text, MALE_NOUNS), segments);

  if (femaleNouns.length && !maleNouns.length) {
    return evidence('Female', femaleNouns[0], CONFIDENCE.FALLBACK, 'patient noun');
  }
  if (maleNouns.length && !femaleNouns.length) {
    return evidence('Male', maleNouns[0], CONFIDENCE.FALLBACK, 'patient noun');
  }
  if (femaleNouns.length && maleNouns.length) {
    return null;
  }

  const female = countMatches(text, FEMALE_PRONOUNS, { skipCompanions: true });
  const male = countMatches(text, MALE_PRONOUNS, { skipCompanions: true });

  if (female.length && !male.length) {
    return evidence('Female', female[0], CONFIDENCE.PRONOUN, 'pronoun');
  }
  if (male.length && !female.length) {
    return evidence('Male', male[0], CONFIDENCE.PRONOUN, 'pronoun');
  }

  return null;
}

function evidence(value, hit, confidence, source) {
  return {
    field: 'gender',
    value,
    confidence,
    source,
    method: source === 'pronoun' ? 'pronoun_inference' : 'contextual',
    start: hit.index,
    end: hit.index + hit.text.length,
  };
}
