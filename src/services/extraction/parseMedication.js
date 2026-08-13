import {
  MEDICATION_DURATION,
  MEDICATION_FORMS,
  MEDICATION_FREQUENCY,
  MEDICATION_ROUTE,
  MEDICATION_STRENGTH,
  MEDICATION_TIMING,
} from '../../constants/clinicalCues.js';

const AND_JOIN = /\s+and\s+/i;
const LIST_SEPARATOR = /\s*[,;]\s*/;

function splitOnAnd(part) {
  const pieces = part.split(AND_JOIN);
  if (pieces.length === 1) {
    return pieces;
  }

  const entries = [pieces[0]];
  for (const piece of pieces.slice(1)) {
    if (looksLikeMedication(piece)) {
      entries.push(piece);
    } else {
      entries[entries.length - 1] += ` and ${piece}`;
    }
  }
  return entries;
}

export function splitMedications(text) {
  const source = (text || '').trim();
  if (!source) {
    return [];
  }

  return source
    .split(LIST_SEPARATOR)
    .flatMap(splitOnAnd)
    .map(part => part.trim())
    .filter(Boolean);
}

export function parseMedication(entry) {
  const text = (entry || '').trim();
  return {
    text,
    strength: match(text, MEDICATION_STRENGTH),
    frequency: match(text, MEDICATION_FREQUENCY),
    duration: match(text, MEDICATION_DURATION),
    route: match(text, MEDICATION_ROUTE),
    form: match(text, MEDICATION_FORMS),
    timing: match(text, MEDICATION_TIMING),
  };
}

export function looksLikeMedication(entry) {
  const parsed = parseMedication(entry);
  return !!(parsed.strength || parsed.form);
}

function match(text, pattern) {
  const found = text.match(pattern);
  return found ? found[0] : null;
}
