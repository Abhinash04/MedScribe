import {
  FEMALE_NOUNS,
  FEMALE_PRONOUNS,
  MALE_NOUNS,
  MALE_PRONOUNS,
  RELATIVE_NOUNS,
} from '../../constants/clinicalCues.js';
import { CONFIDENCE } from '../../constants/fieldMarkers.js';

const RELATIVE_WINDOW = 24;
const SENTENCE_END = /[.;?!]/;

const untilBoundary = (slice, fromEnd) => {
  const index = fromEnd ? slice.search(SENTENCE_END) : slice.split('').reverse().join('').search(SENTENCE_END);
  if (index === -1) {
    return slice;
  }
  return fromEnd ? slice.slice(0, index) : slice.slice(slice.length - index);
};

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
    return evidence('Female', female[0], CONFIDENCE.STRONG, 'pronoun');
  }
  if (male.length && !female.length) {
    return evidence('Male', male[0], CONFIDENCE.STRONG, 'pronoun');
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
