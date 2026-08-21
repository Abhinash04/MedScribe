export const NEGATION_ALTERNATION =
  'no|non|not|without|denies|denied|denying|negative\\s+for|ruled\\s+out|nil';

export const NEGATION_CUES = new RegExp(`\\b(?:${NEGATION_ALTERNATION})\\b`, 'gi');
export const CLAUSE_BREAK = '[.;?!]';
export const CONTRAST_WORDS = 'but|however|though|although';

export const NEGATION_TERMINATORS = new RegExp(
  `${CLAUSE_BREAK}|\\b(?:${CONTRAST_WORDS})\\b`,
  'i',
);

// "previously" and "formerly" mark a finding as historical. Without them, "the patient
// previously had nausea" was filed as the CURRENT adverse reaction — which on an ADR
// form attributes an old complaint to the suspect drug. PRESENTATION_CUES still wins,
// so "previously had nausea, now has nausea again today" stays current.
export const CHRONICITY_CUES =
  /\b(?:for\s+(?:the\s+)?(?:last\s+|past\s+)?\w+\s+(?:years?|months?|decades?)|since\s+(?:childhood|birth|years)|known|chronic|long[\s-]standing|past\s+(?:medical\s+)?history|old\s+case|k\/c\/o|previously|formerly|in\s+the\s+past)\b/i;

export const ADVERB_GAP =
  '(?:\\s+(?:today|now|currently|yesterday|recently|lately|again|still|this\\s+morning|last\\s+night|since\\s+morning))?';

export const NON_FINDINGS = new Set([
  'etc',
  'etc.',
  'etcetera',
  'et cetera',
  'so on',
  'so forth',
  'others',
  'other',
]);

export const PRESENTATION_CUES =
  /\b(?:today|now|currently|since\s+(?:yesterday|this\s+morning|last\s+night)|for\s+(?:the\s+)?(?:last|past)\s+\w+\s+(?:days?|weeks?)|acute|sudden)\b/i;

export const RELATIVE_NOUNS =
  /\b(?:mother|father|mom|dad|wife|husband|son|daughter|brother|sister|attendant|guardian|parent|spouse|relative)\b/i;

export const FEMALE_PRONOUNS = /\b(?:she|her|hers)\b/gi;
export const MALE_PRONOUNS = /\b(?:he|him|his)\b/gi;
export const FEMALE_NOUNS = /\b(?:female|woman|lady|girl)\b/gi;
export const MALE_NOUNS = /\b(?:male|man|gentleman|boy)\b/gi;

export const MEDICATION_FORMS =
  /\b(?:tablets?|tabs?|capsules?|caps?|syrups?|suspensions?|injections?|inj|drops?|ointments?|creams?|inhalers?|sprays?|sachets?)\b/i;

export const MEDICATION_FREQUENCY =
  /\b(?:once|twice|thrice|three\s+times|four\s+times|every\s+\w+\s+hours?|od|bd|tds|qid|hs|sos|stat|daily|nightly)\b/i;

export const MEDICATION_ROUTE =
  /\b(?:oral(?:ly)?|intravenous(?:ly)?|iv|intramuscular(?:ly)?|im|subcutaneous(?:ly)?|topical(?:ly)?|sublingual)\b/i;

export const MEDICATION_UNITS =
  'milligrams?|millilitres?|milliliters?|micrograms?|mg|ml|mcg|g|gm|iu|units?';

export const MEDICATION_STRENGTH = new RegExp(
  `\\b\\d+(?:\\.\\d+)?\\s*(?:${MEDICATION_UNITS})\\b`,
  'i',
);

export const MEDICATION_DURATION =
  /\bfor\s+(?:\w+)\s+(?:days?|weeks?|months?)\b/i;

export const MEDICATION_TIMING =
  /\b(?:before|after)\s+(?:food|meals?|breakfast|lunch|dinner)\b|\bempty\s+stomach\b|\bat\s+bedtime\b/i;

export const SYMPTOM_TERMS = [
  'shortness of breath', 'difficulty in breathing', 'difficulty breathing',
  'breathing difficulty', 'loss of appetite', 'burning sensation',
  'sore throat', 'chest pain', 'body pain', 'back pain', 'joint pain',
  'muscle pain', 'stomach pain', 'abdominal pain', 'ear pain', 'tooth pain',
  'throat pain', 'runny nose', 'blocked nose', 'night sweats', 'blurred vision',
  'loose motions', 'body ache', 'stomach ache',
  'fever', 'cough', 'cold', 'headache', 'tiredness', 'weakness', 'fatigue',
  'vomiting', 'nausea', 'dizziness', 'giddiness', 'sneezing', 'diarrhea',
  'diarrhoea', 'constipation', 'rash', 'itching', 'chills', 'breathlessness',
  'insomnia', 'cramps', 'swelling', 'restlessness', 'sweating', 'shivering',
];

export const SYMPTOM_MODIFIERS = [
  'mild', 'moderate', 'severe', 'slight', 'high', 'low', 'acute', 'chronic',
  'persistent', 'recurrent', 'dry', 'productive', 'constant', 'intermittent',
  'occasional', 'continuous', 'heavy', 'light', 'bad',
];
