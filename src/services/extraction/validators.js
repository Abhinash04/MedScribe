const NOT_A_NAME =
  /\b(?:fever|cough|cold|pain|ache|infection|infections|viral|bacterial|fungal|syndrome|disease|disorder|diabetes|diabetic|hypertension|hypertensive|asthma|asthmatic|thyroid|cardiac|cancer|tuberculosis|epilepsy|arthritis|anaemia|anemia|migraine|stroke|strain|sprain|allergy|allergic|acute|chronic|diagnosis|symptoms?|history|prescription|milligrams?|tablets?|case|report|prima|facie|initial|primary|reaction|response|adverse|patient|follow[- ]?up)\b/i;

const validators = {
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

  reactionDate: value => /^\d{2}\/\d{2}\/\d{4}$/.test(String(value ?? '').trim()),

  weightNumber: value => {
    const val = parseFloat(value);
    return Number.isFinite(val) && val > 0 && val < 500;
  },
};

export function isValid(name, value) {
  const validator = validators[name];
  return validator ? validator(value) : true;
}
