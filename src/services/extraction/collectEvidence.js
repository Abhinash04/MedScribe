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

/** Ranges already claimed by a marker segment are not free-standing evidence. */
function outsideSegments(hits, segments) {
  return hits.filter(
    hit =>
      !segments.some(
        segment => hit.index >= segment.start && hit.index < segment.end,
      ),
  );
}

export function inferGender(text, claimed = []) {
  const segments = claimed;
  const femaleNouns = outsideSegments(countMatches(text, FEMALE_NOUNS), segments);
  const maleNouns = outsideSegments(countMatches(text, MALE_NOUNS), segments);

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
