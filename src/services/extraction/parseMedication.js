import {
  MEDICATION_DURATION,
  MEDICATION_FORMS,
  MEDICATION_FREQUENCY,
  MEDICATION_ROUTE,
  MEDICATION_STRENGTH,
  MEDICATION_TIMING,
} from '../../constants/clinicalCues.js';

/**
 * One entry per drug, with the dictated wording preserved verbatim.
 *
 * Attributes are parsed for validation and traceability only — nothing is
 * normalised, reordered or invented. A prescription that says "twice daily"
 * still reads "twice daily".
 */

const AND_JOIN = /\s+and\s+/i;

const LIST_SEPARATOR = /\s*[,;]\s*/;

/**
 * "and" splits drugs only when what follows is itself medication-like, judged
 * by the same test that keeps advice out of the prescription list. A numeric
 * strength is not required — "cough syrup twice daily and vitamin tablets once
 * daily" is two prescriptions — while an advice clause ("and drink plenty of
 * water") stays attached to the entry it was dictated with rather than becoming
 * an entry of its own.
 */
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

/**
 * True when the phrase looks like medication rather than advice.
 *
 * "plenty of oral fluids and complete bed rest" carries a route word but no
 * drug, so a route alone is not enough. Neither is a frequency: "drink water
 * twice daily" and "a daily walk" are cadences of advice, not prescriptions.
 * A strength or a dosage form is the anchor that makes an entry a medication.
 */
export function looksLikeMedication(entry) {
  const parsed = parseMedication(entry);
  return !!(parsed.strength || parsed.form);
}

function match(text, pattern) {
  const found = text.match(pattern);
  return found ? found[0] : null;
}
