/**
 * Contextual cue vocabulary for the evidence stages.
 *
 * Kept apart from FIELD_MARKERS because these never open a segment — they
 * classify, negate or infer around segments that already exist.
 */

/**
 * Single source for every negation cue. `detectNegation` builds both its
 * scope-finding pattern and its cue-stripping pattern from this, so the two
 * cannot drift apart and leave a cue that scopes but never gets removed.
 */
// `non` covers both "non diabetic" and "non-diabetic" — the hyphen is a word
// boundary. Without it the bare-condition marker read "Non diabetic" as a
// POSITIVE history of diabetes, which is the worst kind of extraction error.
export const NEGATION_ALTERNATION =
  'no|non|not|without|denies|denied|denying|negative\\s+for|ruled\\s+out|nil';

export const NEGATION_CUES = new RegExp(`\\b(?:${NEGATION_ALTERNATION})\\b`, 'gi');

/**
 * One clause boundary definition, used for both halves of the negation logic.
 *
 * A negation's scope ends here, and a findings list splits here. When the two
 * were written separately they drifted: "no fever; cough" ended the negation at
 * the semicolon but never split there, so "cough" was reported as denied.
 */
export const CLAUSE_BREAK = '[.;?!]';
export const CONTRAST_WORDS = 'but|however|though|although';

/** A negation stops here; anything past it is asserted again. */
export const NEGATION_TERMINATORS = new RegExp(
  `${CLAUSE_BREAK}|\\b(?:${CONTRAST_WORDS})\\b`,
  'i',
);

/** Pushes a value into medical history regardless of the marker that opened it. */
export const CHRONICITY_CUES =
  /\b(?:for\s+(?:the\s+)?(?:last\s+|past\s+)?\w+\s+(?:years?|months?|decades?)|since\s+(?:childhood|birth|years)|known|chronic|long[\s-]standing|past\s+(?:medical\s+)?history|old\s+case|k\/c\/o)\b/i;

/**
 * A time adverb may sit between a verb and its preposition.
 *
 * "presented today with", "complains now of", "came in yesterday with" — every
 * marker built as verb + preposition previously required the two to be
 * adjacent, so a single adverb stopped the marker firing at all and the whole
 * sentence went unclaimed. Composed into those markers rather than pasted into
 * each, so the family stays one rule.
 */
export const ADVERB_GAP =
  '(?:\\s+(?:today|now|currently|yesterday|recently|lately|again|still|this\\s+morning|last\\s+night|since\\s+morning))?';

/** Discourse fillers that close a list without naming a finding. */
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

/** Keeps a value in symptoms even when a history-ish marker opened it. */
export const PRESENTATION_CUES =
  /\b(?:today|now|currently|since\s+(?:yesterday|this\s+morning|last\s+night)|for\s+(?:the\s+)?(?:last|past)\s+\w+\s+(?:days?|weeks?)|acute|sudden)\b/i;

/** A pronoun near one of these refers to a companion, not the patient. */
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

/**
 * Every unit the app accepts. `parseMedication` builds both the strength
 * pattern and the "and <drug> <dose>" splitter from this list — when they
 * disagreed, a second drug dictated in "milligrams" was never split out.
 */
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

/**
 * Findings a recogniser can run together when the doctor dictates without
 * commas: "fever cough headache sore throat".
 *
 * A CLOSED list, and used only to split a run in which EVERY word is accounted
 * for. Splitting on whitespace alone would shatter "sore throat"; requiring
 * full coverage means an unrecognised phrase is left exactly as dictated rather
 * than guessed at.
 */
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

/** Qualifiers that belong to the finding they precede, not to a new one. */
export const SYMPTOM_MODIFIERS = [
  'mild', 'moderate', 'severe', 'slight', 'high', 'low', 'acute', 'chronic',
  'persistent', 'recurrent', 'dry', 'productive', 'constant', 'intermittent',
  'occasional', 'continuous', 'heavy', 'light', 'bad',
];
