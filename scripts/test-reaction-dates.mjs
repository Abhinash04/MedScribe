globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { extractPatientFields } from '../src/services/extractionService.js';
import {
  START_VERB_CONTEXTUAL,
  START_VERB_PLAIN,
  STOP_STATE_ADJECTIVE,
  STOP_VERB_CONTEXTUAL,
  STOP_VERB_PLAIN,
} from '../src/constants/reactionCues.js';

import { check, report } from './lib/fixture-harness.mjs';

const valueOf = (record, field) => String(record?.[field]?.value ?? '');
const startOf = text => valueOf(extractPatientFields(text), 'reactionStartDate');
const stopOf = text => valueOf(extractPatientFields(text), 'reactionStopDate');
const alternatives = source =>
  source
    .split('|')
    .map(entry => entry.replace(/\\s\+/g, ' ').replace(/\\/g, ''))
    .filter(Boolean);

for (const verb of alternatives(`${STOP_VERB_PLAIN}|${STOP_VERB_CONTEXTUAL}`)) {
  const text = `The patient had fever. The reaction ${verb} on 12 August 2026.`;
  check(`D1.1 "the reaction ${verb} on" sets the stop date`, stopOf(text), '12/08/2026');
}

for (const adjective of alternatives(STOP_STATE_ADJECTIVE)) {
  check(
    `D1.2 "the reaction was ${adjective} on <date>" sets the stop date`,
    stopOf(`The patient had fever. The reaction was ${adjective} on 12 August 2026.`),
    '12/08/2026',
  );
  check(
    `D1.3 "the reaction ${adjective} on <date>" without a copula does NOT`,
    stopOf(`The patient had fever. The reaction ${adjective} on 12 August 2026.`),
    '',
  );
}

for (const verb of alternatives(STOP_VERB_PLAIN)) {
  check(
    `D2.1 bare "${verb} on <date>" is accepted`,
    stopOf(`The patient had fever, and it ${verb} on 12 August 2026.`),
    '12/08/2026',
  );
}

for (const verb of alternatives(STOP_VERB_CONTEXTUAL).slice(0, 12)) {
  check(
    `D3.1 "started on ... and ${verb} on ..." sets both dates`,
    stopOf(`The reaction started on 10 August 2026 and ${verb} on 12 August 2026.`),
    '12/08/2026',
  );
}

check(
  'D3.2 the start date is unaffected by the coordinate stop clause',
  startOf('The reaction started on 10 August 2026 and recovered on 12 August 2026.'),
  '10/08/2026',
);

for (const verb of alternatives(`${START_VERB_PLAIN}|${START_VERB_CONTEXTUAL}`)) {
  check(
    `D4.1 "the reaction ${verb} on" sets the start date`,
    startOf(`The reaction ${verb} on 10 August 2026.`),
    '10/08/2026',
  );
}

for (const subject of ['reaction', 'response', 'event', 'adverse reaction', 'adverse event', 'episode', 'symptoms']) {
  check(
    `D5.1 subject "${subject}" carries the start date`,
    startOf(`The ${subject} started on 10 August 2026.`),
    '10/08/2026',
  );
  check(
    `D5.2 subject "${subject}" carries the stop date`,
    stopOf(`The ${subject} ended on 12 August 2026.`),
    '12/08/2026',
  );
}

check(
  'D5.3 an elided pronoun subject works',
  startOf('He had fever. It began on 13 August 2026.'),
  '13/08/2026',
);
check(
  'D5.4 a qualifier before the subject works',
  startOf('The current response began on 15 August 2026.'),
  '15/08/2026',
);
check(
  'D5.5 an inserted auxiliary works',
  startOf('The response was to begin on 12 August 2026.'),
  '12/08/2026',
);

const FORMATS = {
  '12 August 2026': '12/08/2026',
  '12th August 2026': '12/08/2026',
  'August 12, 2026': '12/08/2026',
  '12/08/2026': '12/08/2026',
  '12-08-2026': '12/08/2026',
  '2026 August 12': '12/08/2026',
  '12 Aug 2026': '12/08/2026',
};

for (const [written, expected] of Object.entries(FORMATS)) {
  check(
    `D6.1 stop date reads "${written}"`,
    stopOf(`The reaction ended on ${written}.`),
    expected,
  );
  check(
    `D6.2 start date reads "${written}"`,
    startOf(`The reaction started on ${written}.`),
    expected,
  );
}

check(
  'D6.3 a missing preposition still parses',
  startOf('Response Started 9 August 2026.'),
  '09/08/2026',
);

{
  const both = 'The reaction started on 10 August 2026 and subsided on 12 August 2026.';
  check('D7.1 start is the earlier clause', startOf(both), '10/08/2026');
  check('D7.2 stop is the later clause', stopOf(both), '12/08/2026');
}

{
  const reversed =
    'The reaction resolved on 14 August 2026. The reaction had started on 12 August 2026.';
  check('D7.3 start is found when dictated second', startOf(reversed), '12/08/2026');
  check('D7.4 stop is found when dictated first', stopOf(reversed), '14/08/2026');
}

{
  const spread =
    'Patient name is Rahul Sharma. The reaction began on 3 August 2026. ' +
    'He was given antihistamines. The symptoms cleared on 9 August 2026.';
  check('D7.5 dates separated by other fields — start', startOf(spread), '03/08/2026');
  check('D7.6 dates separated by other fields — stop', stopOf(spread), '09/08/2026');
}

const MUST_NOT_SET_STOP = [
  'The case was closed on 3 August 2026.',
  'The dose was corrected on 3 August 2026.',
  'The file was completed on 3 August 2026.',
  'The form was closed on 3 August 2026.',
  'The record was normalised on 3 August 2026.',
  'The prescription was corrected on 3 August 2026.',
  'The appointment was confirmed on 3 August 2026.',
  'His insurance claim was closed on 3 August 2026.',
];

for (const text of MUST_NOT_SET_STOP) {
  check(`D8.1 not a stop date: "${text}"`, stopOf(text), '');
}

const MUST_NOT_SET_START = [
  'The prescription was started on paracetamol.',
  'The consultation began without incident.',
];

for (const text of MUST_NOT_SET_START) {
  check(`D8.2 not a start date: "${text}"`, startOf(text), '');
}

const NOT_DATES = [
  'The reaction started on a course of antibiotics.',
  'The reaction ended on the advice of the physician.',
  'The reaction subsided on treatment.',
];

for (const text of NOT_DATES) {
  const record = extractPatientFields(text);
  check(
    `D9.1 no date is invented from: "${text}"`,
    [valueOf(record, 'reactionStartDate'), valueOf(record, 'reactionStopDate')].filter(
      value => value && !/^\d{2}\/\d{2}\/\d{4}$/.test(value),
    ),
    [],
  );
}

check(
  'D9.2 a real date is still accepted alongside prose',
  stopOf('After treatment the reaction finally subsided on 12 August 2026, thankfully.'),
  '12/08/2026',
);

check(
  'D10.1 "resolved on"',
  stopOf('The reaction started on 10 August 2026 and resolved on 12 August 2026.'),
  '12/08/2026',
);
check(
  'D10.2 "by <date>"',
  stopOf('It started on 8 August 2026 and by 10 August 2026 the symptoms had resolved.'),
  '10/08/2026',
);
check(
  'D10.3 "stopped on"',
  stopOf('Reaction started 9 August 2026 and stopped 11 August 2026.'),
  '11/08/2026',
);
check(
  'D10.4 "commenced on"',
  startOf('The reaction commenced on 4 August 2026.'),
  '04/08/2026',
);
check(
  'D10.5 "onset date was"',
  startOf('Onset date was 4 August 2026.'),
  '04/08/2026',
);

const symptomsOf = text => {
  const value = extractPatientFields(text).symptoms?.value;
  return Array.isArray(value) ? value.join('; ').toLowerCase() : '';
};

const DENIALS = [
  'She has fever. She does not have chest pain and shortness of breath.',
  'She has fever. He does not have chest pains and breathing difficulties.',
  'She has fever. She never has chest pain.',
  'She has fever. She has no chest pain.',
];

for (const text of DENIALS) {
  check(
    `D11.1 denied symptom is not reported: "${text.slice(16, 60)}…"`,
    symptomsOf(text).includes('chest pain'),
    false,
  );
  check(
    `D11.2 the asserted symptom survives: "${text.slice(16, 60)}…"`,
    symptomsOf(text).includes('fever'),
    true,
  );
}

const SHAPES = [
  ['existential', 'There was nausea and vomiting.', 'There was no nausea.'],
  ['existential present', 'There is fever and itching.', 'There is no fever.'],
  ['plural had', 'They had headaches, dizziness and weakness.', 'They did not have headaches.'],
  ['bare transitive', 'They suffered headaches and dizziness.', 'They never suffered headaches.'],
  ['came down with', 'They came down with severe itching.', 'They did not come down with itching.'],
  ['reaction seen included', 'The adverse reaction seen included fever and cough.', 'The adverse reaction seen included no fever.'],
  ['followed by', 'The suspected drug is followed by fever and cough.', 'The drug is followed by no fever.'],
  ['after date', 'The reaction began on 9 August 2026 with fever and cough.', 'The reaction began on 9 August 2026 with no fever.'],
  ['verb-final', 'Fever, cough and itching went away after the suspected drug.', 'No fever or cough appeared after the drug.'],
];

for (const [label, positive, negative] of SHAPES) {
  check(`D12.1 ${label} extracts the finding`, symptomsOf(positive).length > 0, true);
  check(
    `D12.2 ${label} denial does not report the finding as present`,
    /\b(?:nausea|fever|headache|itching|cough)\b/.test(symptomsOf(negative)),
    false,
  );
}

// D13 — the negation forms your brief lists, on the widest cue
for (const denial of [
  'She has fever. She does not have nausea.',
  'She has fever. She denies nausea.',
  'She has fever. She has no nausea.',
  'She has fever. There was no nausea.',
  'She has fever. She is without nausea.',
]) {
  check(`D13.1 denied: "${denial.slice(15, 55)}"`, symptomsOf(denial).includes('nausea'), false);
  check(`D13.2 asserted survives: "${denial.slice(15, 55)}"`, symptomsOf(denial).includes('fever'), true);
}

check(
  'D11.3 an ordinary "has" clause is untouched',
  symptomsOf('The patient has fever and cough.'),
  'fever; cough',
);
check(
  'D11.4 "have" after a noun still works',
  symptomsOf('They have nausea and vomiting.'),
  'nausea; vomiting',
);

report();
