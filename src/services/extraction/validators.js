/**
 * Stage 6 — reject implausible values.
 *
 * A candidate that fails validation is discarded rather than downgraded. In a
 * patient record a wrong value is worse than a blank one, so this stage
 * favours precision over recall throughout.
 */

/**
 * Clinical vocabulary disqualifies a value from being a person's name.
 *
 * "Clinically this is viral fever" matched the `this is` name marker, and a
 * shape-only check accepted "Viral Fever" — putting a diagnosis in the patient
 * name on a medical report. Shape alone cannot tell the two apart, because a
 * diagnosis is also just letters and spaces.
 */
const NOT_A_NAME =
  /\b(?:fever|cough|cold|pain|ache|infection|infections|viral|bacterial|fungal|syndrome|disease|disorder|diabetes|diabetic|hypertension|hypertensive|asthma|asthmatic|thyroid|cardiac|cancer|tuberculosis|epilepsy|arthritis|anaemia|anemia|migraine|stroke|strain|sprain|allergy|allergic|acute|chronic|diagnosis|symptoms?|history|prescription|milligrams?|tablets?)\b/i;

const validators = {
  // Unicode-aware: an ASCII-only class rejected real patient names such as
  // José and Björn. \p{L} covers accented Latin without broadening the
  // validator beyond letters.
  personName: value =>
    typeof value === 'string' &&
    value.length >= 2 &&
    value.length <= 60 &&
    /^\p{L}[\p{L}\s.'-]*$/u.test(value) &&
    !NOT_A_NAME.test(value),

  age: value => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 && parsed < 130;
  },

  gender: value => /^(Male|Female|Transgender|Other)$/i.test(value || ''),

  caseType: value => /^(Initial|Follow-up)$/i.test(value || ''),

  pinCode: value => /^\d{6}$/.test(value || ''),

  phone: value => {
    const digits = (value || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  },

  nonEmptyText: value =>
    typeof value === 'string' && value.trim().length > 1,

  nonEmptyList: value => Array.isArray(value) && value.length > 0,

  dateString: value =>
    typeof value === 'string' && value.trim().length >= 8,

  weightNumber: value => {
    const val = parseFloat(value);
    return Number.isFinite(val) && val > 0 && val < 500;
  },
};

export function isValid(name, value) {
  const validator = validators[name];
  return validator ? validator(value) : true;
}
