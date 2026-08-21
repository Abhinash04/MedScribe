export const REACTION_SUBJECT =
  'adverse\\s+reactions?|adverse\\s+events?|adverse\\s+drug\\s+reactions?|reactions?|responses?|events?|episodes?|symptoms?|complaints?';

export const REACTION_PRONOUN = 'it|these|they|those|this';

export const PATIENT_SUBJECT = 'patient|she|he|they';

export const SUBJECT_LEAD =
  '(?:the\\s+|his\\s+|her\\s+|their\\s+|this\\s+)?(?:current\\s+|present\\s+|suspected\\s+|said\\s+)?';

export const TENSE_GAP =
  '(?:\\s+(?:was|were|had|has|have|got|been|is|are|then|to|also|finally))*';

export const STOP_VERB_PLAIN =
  'ended|ends|ending|stopped|stops|resolved|resolves|subsided|subsides|abated|ceased|ceases|cleared|settled|settles|disappeared|vanished|remitted|discontinued';

export const STOP_VERB_CONTEXTUAL =
  'recovered|recovers|healed|heals|cured|improved|improves|mitigated|corrected|completed|closed|closes|normalised|normalized|decelerated|declined|reduced|lessened|eased|got\\s+better|became\\s+good|became\\s+better|went\\s+away|came\\s+good|in\\s+remission|under\\s+control';
// "perfect" is what Tamil translation returns for சரியானது — six of the twelve
// remaining stop-date failures were "the reaction was perfect on 13 August", which my
// own failure matrix had mislabelled as upstream loss.
export const STOP_STATE_ADJECTIVE =
  'good|fine|better|normal|alright|clear|perfect|correct|healthy|stable|symptom-free';

export const START_VERB_PLAIN =
  'started|starts|starting|began|begun|begins|begin|commenced|commences|commence|initiated|initiates|appeared|appears|arose|arisen|occurred|occurs|erupted|set\\s+in|onset';

export const START_VERB_CONTEXTUAL =
  'developed|develops|manifested|manifests|triggered|originated|surfaced|presented|first\\s+noticed|was\\s+noticed|was\\s+first\\s+seen|came\\s+on';
export const DATE_PREPOSITION = 'on|by|from|since|at';

const MONTH =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';

// The date itself, as a matchable group. Kept separate from the lookahead so builders
// can either look past a date or consume one without string surgery on DATE_AHEAD.
export const DATE_BODY =
  `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH})\\b` +
  `|(?:${MONTH})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b` +
  `|\\d{4}\\s+(?:${MONTH})\\s+\\d{1,2}\\b` +
  `|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b)`;

export const DATE_AHEAD = `(?=\\s*${DATE_BODY})`;

export const MONTH_NAMES = MONTH;

export const subjectAnchored = (subjects, verbs) =>
  new RegExp(
    `\\b${SUBJECT_LEAD}(?:${subjects})${TENSE_GAP}\\s+(?:${verbs})` +
      `(?:\\s+(?:${DATE_PREPOSITION})\\s+|\\s+${DATE_AHEAD})`,
    'i',
  );
export const dateGuarded = verbs =>
  new RegExp(
    `\\b(?:${verbs})\\s+(?:${DATE_PREPOSITION})\\s+${DATE_AHEAD}`,
    'i',
  );

export const stateAnchored = (subjects, adjectives) =>
  new RegExp(
    `\\b${SUBJECT_LEAD}(?:${subjects})\\s+(?:was|were|is|are|became|got|had\\s+become)\\s+` +
      `(?:${adjectives})\\s+(?:${DATE_PREPOSITION})\\s+${DATE_AHEAD}`,
    'i',
  );

// "Reaction 9 Aug 2026 Started ... Reaction 11 Aug 2026 Stopped" — run-on speech with
// the verb AFTER the date, which is the order Indic word order produces and
// translation preserves. Zero-width so the segment begins at the date, and anchored to
// a reaction subject so a bare date cannot claim a field.
export const dateThenVerb = verbs =>
  new RegExp(
    `\\b(?:${REACTION_SUBJECT})\\s+(?=${DATE_BODY}[^.;?!]{0,40}?\\b(?:${verbs})\\b)`,
    'i',
  );

export const coordinated = verbs =>
  new RegExp(
    `\\band\\s+(?:then\\s+|later\\s+|finally\\s+)?(?:(?:was|were|had|has|got|been)\\s+)?` +
      // The preposition is optional: translation drops it — "and corrected 14 August
      // 2026" — and the mandatory date that follows is what keeps this safe.
      `(?:${verbs})\\s+(?:(?:${DATE_PREPOSITION})\\s+)?${DATE_AHEAD}`,
    'i',
  );
