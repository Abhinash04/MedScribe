/**
 * Stage 6 — reject implausible values.
 *
 * A candidate that fails validation is discarded rather than downgraded. In a
 * patient record a wrong value is worse than a blank one, so this stage
 * favours precision over recall throughout.
 */

const validators = {
  // Unicode-aware: an ASCII-only class rejected real patient names such as
  // José and Björn. \p{L} covers accented Latin without broadening the
  // validator beyond letters.
  personName: value =>
    typeof value === 'string' &&
    value.length >= 2 &&
    value.length <= 60 &&
    /^\p{L}[\p{L}\s.'-]*$/u.test(value),

  age: value => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 && parsed < 130;
  },

  gender: value => /^(Male|Female|Transgender|Other)$/i.test(value || ''),

  pinCode: value => /^\d{6}$/.test(value || ''),

  phone: value => {
    const digits = (value || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  },

  nonEmptyText: value =>
    typeof value === 'string' && value.trim().length > 1,

  nonEmptyList: value => Array.isArray(value) && value.length > 0,
};

export function isValid(name, value) {
  const validator = validators[name];
  return validator ? validator(value) : true;
}
