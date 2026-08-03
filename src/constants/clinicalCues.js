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
export const NEGATION_ALTERNATION =
  'no|not|without|denies|denied|denying|negative\\s+for|ruled\\s+out|nil';

export const NEGATION_CUES = new RegExp(`\\b(?:${NEGATION_ALTERNATION})\\b`, 'gi');

/** A negation stops here; anything past it is asserted again. */
export const NEGATION_TERMINATORS = /[.;?!]|\b(?:but|however|though|although)\b/i;

/** Pushes a value into medical history regardless of the marker that opened it. */
export const CHRONICITY_CUES =
  /\b(?:for\s+(?:the\s+)?(?:last\s+|past\s+)?\w+\s+(?:years?|months?|decades?)|since\s+(?:childhood|birth|years)|known|chronic|long[\s-]standing|past\s+(?:medical\s+)?history|old\s+case|k\/c\/o)\b/i;

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
  /\b(?:tablet|tab|capsule|cap|syrup|suspension|injection|inj|drops?|ointment|cream|inhaler|spray|sachet)\b/i;

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
