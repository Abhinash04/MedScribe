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

/** "and" splits drugs only when a drug-like token follows it. */
const DRUG_AFTER_AND =
  /\s+and\s+(?=[a-z][\w-]*\s+\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|gm|iu|units?)\b)/i;

const LIST_SEPARATOR = /\s*[,;]\s*/;

export function splitMedications(text) {
  const source = (text || '').trim();
  if (!source) {
    return [];
  }

  return source
    .split(LIST_SEPARATOR)
    .flatMap(part => part.split(DRUG_AFTER_AND))
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
 * drug, so a route alone is not enough — a strength, a dosage form or an
 * explicit frequency has to be present.
 */
export function looksLikeMedication(entry) {
  const parsed = parseMedication(entry);
  return !!(parsed.strength || parsed.form || parsed.frequency);
}

function match(text, pattern) {
  const found = text.match(pattern);
  return found ? found[0] : null;
}
