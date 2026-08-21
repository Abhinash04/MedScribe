import { SYMPTOM_TERMS } from './clinicalCues.js';
export const NOT_NEGATED = '(?<!\\bnot\\s)(?<!\\bnever\\s)(?<!\\bwithout\\s)';

const STEM_SUFFIX = '(?:s|es|ing|ed|y)?';

const asPattern = term => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/\s/.test(term)) {
    return escaped.replace(/\s+/g, '\\s+');
  }
  const stem = escaped.replace(/(?:ing|s)$/, '');
  return `${stem.length >= 4 ? stem : escaped}${STEM_SUFFIX}`;
};

export const KNOWN_FINDINGS = [...SYMPTOM_TERMS]
  .sort((a, b) => b.length - a.length)
  .map(asPattern)
  .join('|');

export const SYMPTOM_SUBJECT =
  'patients?|she|he|they|the\\s+patient|this\\s+patient';

export const PRESENTATION_VERB =
  'suffer(?:s|ed|ing)?|manifest(?:s|ed|ing)|exhibit(?:s|ed|ing)|display(?:s|ed|ing)|sustain(?:s|ed)';

export const ONSET_VERB_FINAL =
  'developed|appeared|occurred|emerged|erupted|started|began|arose|surfaced|set\\s+in|went\\s+away|subsided|was\\s+seen|were\\s+seen|was\\s+noted|were\\s+noted|was\\s+observed|were\\s+observed';

export const ONSET_TAIL = 'after|following|post|upon|on\\s+taking|with';

export const EXISTENTIAL_LEAD =
  'there\\s+(?:is|are|was|were|has\\s+been|have\\s+been)';

export const FINDING_PREPOSITION = 'with';

export const subjectPresents = () =>
  new RegExp(
    `${NOT_NEGATED}\\b(?:${SYMPTOM_SUBJECT})\\s+(?:${PRESENTATION_VERB})\\s+` +
      `(?!from\\b|no\\b|any\\b|nothing\\b)(?:a\\s+|an\\s+|the\\s+|severe\\s+|mild\\s+)?`,
    'i',
  );

export const existential = () =>
  new RegExp(
    `\\b(?:${EXISTENTIAL_LEAD})\\s+(?!no\\b|not\\b|nothing\\b|any\\b)(?:a\\s+|an\\s+|the\\s+)?`,
    'i',
  );

export const afterDateWith = () =>
  new RegExp(
    `(?<=\\d{4})\\s+(?:${FINDING_PREPOSITION})\\s+(?!no\\b|not\\b)`,
    'i',
  );

export const verbFinalList = () =>
  new RegExp(
    `(?<=^|[.;?!]\\s)(?=[A-Za-z][^.;?!]{3,150}?\\b(?:${ONSET_VERB_FINAL})\\s+(?:${ONSET_TAIL})\\b)`,
    'i',
  );

export const followedBy = () =>
  new RegExp(
    '\\b(?:drug|medication|medicine|dose|therapy|tablet)\\s+' +
      '(?:was|is|were|are|had\\s+been)\\s+followed\\s+by\\s+',
    'i',
  );

export const reactionIncluded = () =>
  new RegExp(
    '\\b(?:adverse\\s+)?(?:reactions?|responses?|events?|symptoms?)\\s+' +
      '(?:seen|observed|noted|reported|presented|experienced)\\s+' +
      '(?:includ(?:e|es|ed)|were|was|are|is)\\s+',
    'i',
  );

export const cameDownWith = () =>
  new RegExp(
    `${NOT_NEGATED}\\b(?:came|come|comes)\\s+(?:down\\s+|in\\s+)?with\\s+(?!no\\b|not\\b)`,
    'i',
  );

export const accompaniedBy = () =>
  new RegExp(
    `${NOT_NEGATED}\\b(?:accompanied|associated|presented|brought\\s+in|admitted)\\s+(?:by|with)\\s+(?!no\\b|not\\b)`,
    'i',
  );

export const findingsWere = () =>
  new RegExp(
    `${NOT_NEGATED}\\b(?:findings?|observations?|examination)\\s+` +
      `(?:on\\s+\\w+\\s+|at\\s+\\w+\\s+)?(?:were|was|are|is|showed|revealed|included?)\\s+(?!no\\b|not\\b)`,
    'i',
  );

export const coordinatedPresents = knownFindings =>
  new RegExp(
    `\\b(?:but|and|then)\\s+(?:${PRESENTATION_VERB})\\s+` +
      `(?!from\\b|no\\b|any\\b)(?:a\\s+|an\\s+|the\\s+)?` +
      `(?=(?:\\w+\\s+){0,2}(?:${knownFindings})\\b)`,
    'i',
  );

export const symptomRun = knownFindings =>
  new RegExp(
    `${NOT_NEGATED}(?<!\\bof\\s)(?<!\\bwith\\s)(?<!\\bfrom\\s)(?<!\\bby\\s)` +
      `(?<!\\bhas\\s)(?<!\\bhad\\s)(?<!\\bhave\\s)(?<!\\bis\\s)(?<!\\bwas\\s)(?<!\\bare\\s)(?<!\\bwere\\s)` +
      `(?<!,\\s)(?<!\\band\\s)(?<!\\bor\\s)` +
      `\\b(?=(?:${knownFindings})s?\\b[\\s,]+(?:and\\s+)?(?:${knownFindings})s?\\b)`,
    'i',
  );
