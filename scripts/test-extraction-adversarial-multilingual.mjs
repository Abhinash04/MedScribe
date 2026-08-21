globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { extractForReport, extractPatientFields } from '../src/services/extractionService.js';
import { buildReportDocument } from '../src/services/reportDocument.js';
import {
  blockingFields,
  validateReportCompleteness,
} from '../src/services/reportCompleteness.js';
import { toDraft } from '../src/services/reportDraft.js';
import { toLatinDigits } from '../src/utils/numerals.js';
import {
  inferMissingYears,
  repairOrphanedYears,
} from '../src/services/pravah/repairDates.js';
import { protect, restore, stripSentinels } from '../src/services/pravah/protectNumerals.js';

import { check, report } from './lib/fixture-harness.mjs';

const value = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
};
const read = text => extractPatientFields(text);
const symptomsOf = text => value(read(text), 'symptoms').toLowerCase();
const startOf = text => value(read(text), 'reactionStartDate');
const stopOf = text => value(read(text), 'reactionStopDate');
const PARAPHRASES = [
  ['the patient voiced complaints of nausea', 'nausea'],
  ['she turned up complaining of a splitting headache', 'headache'],
  ['he was brought in with vomiting', 'vomiting'],
  ['there has been fever since Tuesday', 'fever'],
  ['findings on examination were swelling and rash', 'swelling'],
  ['the man exhibited dizziness and weakness', 'dizziness'],
  ['presenting complaint is a sore throat', 'sore throat'],
];

for (const [text, expected] of PARAPHRASES) {
  check(`M1.1 "${text.slice(0, 40)}…" finds ${expected}`, symptomsOf(text).includes(expected), true);
}

const DENIALS = [
  'She has fever but denies any chest pain.',
  'She has fever. Chest pain is absent.',
  'She has fever, with no chest pain.',
  'She has fever. There is no chest pain.',
  'She has fever. He does not have chest pain.',
  'She has fever. Chest pain was ruled out.',
  'She has fever and is negative for chest pain.',
];

for (const text of DENIALS) {
  check(`M2.1 denied: "${text.slice(10, 50)}"`, symptomsOf(text).includes('chest pain'), false);
  check(`M2.2 asserted survives: "${text.slice(10, 50)}"`, symptomsOf(text).includes('fever'), true);
}

check(
  'M2.3 a mixed sentence keeps the positive half',
  symptomsOf('He has fever and cough but no chest pain.'),
  'fever; cough',
);

const DATE_FORMS = [
  ['The reaction started on 03/08/2026.', '03/08/2026'],
  ['The reaction started on 3.8.2026.', '03/08/2026'],
  ['The reaction started on 3-8-2026.', '03/08/2026'],
  ['The reaction started on the 3rd of August 2026.', '03/08/2026'],
  ['The reaction started on August 3, 2026.', '03/08/2026'],
  ['The reaction started on 2026 August 3.', '03/08/2026'],
  ['The reaction started on 3 Aug 2026.', '03/08/2026'],
];

for (const [text, expected] of DATE_FORMS) {
  check(`M3.1 "${text.slice(28)}" parses`, startOf(text), expected);
}

check(
  'M3.2 Indic numerals normalise before extraction',
  startOf(toLatinDigits('The reaction started on ୦୩/୦୮/୨୦୨୬.')),
  '03/08/2026',
);
check(
  'M3.3 Devanagari numerals too',
  startOf(toLatinDigits('The reaction started on ०३/०८/२०२६.')),
  '03/08/2026',
);

{
  const text =
    'The reaction started on 3 August 2026, worsened on 5 August 2026 and finally ' +
    'subsided on 9 August 2026.';
  check('M4.1 the first date is the start', startOf(text), '03/08/2026');
  check('M4.2 the last is the stop', stopOf(text), '09/08/2026');
}

check(
  'M4.3 a date of birth is not a reaction date',
  startOf('The patient was born on 3 August 1980. No reaction has been reported.'),
  '',
);

check(
  'M5.1 a corrected age wins',
  value(read('Age is 61 years, sorry, correction, age is 16 years.'), 'age'),
  '16 Years',
);
check(
  'M5.2 the retracted age is gone',
  value(read('Age is 61 years, sorry, correction, age is 16 years.'), 'age').includes('61'),
  false,
);
check(
  'M5.3 a later restatement of the name wins',
  value(read('Patient name is Anil Kumar. Sorry, patient name is Sunil Kumar.'), 'patientName'),
  'Sunil Kumar',
);
check(
  'M5.4 a repeated fact is not duplicated',
  value(read('She has fever and cough. To confirm, she has fever and cough.'), 'symptoms'),
  'Fever; Cough',
);

{
  const text =
    'He is a known asthmatic with a history of hypertension. Today he developed ' +
    'itching and swelling after the suspected drug.';
  check('M6.1 today\'s finding is a symptom', symptomsOf(text).includes('itching'), true);
  check('M6.2 the standing condition is not', symptomsOf(text).includes('hypertension'), false);
  check(
    'M6.3 and it is recorded as history instead',
    value(read(text), 'medicalHistory').toLowerCase().includes('hypertension'),
    true,
  );
}

{
  const text =
    'patient name is Asha Rao age 44 years female weight 58 kg fever cough and ' +
    'itching reaction started on 3 August 2026 reaction stopped on 5 August 2026 ' +
    'medicine stopped antihistamine given initial case';
  const record = read(text);
  check('M7.1 the name survives', value(record, 'patientName'), 'Asha Rao');
  check('M7.2 the age survives', value(record, 'age'), '44 Years');
  check('M7.3 the weight survives', value(record, 'weight'), '58');
  check('M7.4 the start date survives', value(record, 'reactionStartDate'), '03/08/2026');
  check('M7.5 the stop date survives', value(record, 'reactionStopDate'), '05/08/2026');
  check('M7.6 the findings survive', symptomsOf(text).includes('fever'), true);
}

check(
  'M8.1 a Hindi name cue still works',
  value(read('Patient ka naam Rekha Nair hai. She has fever.'), 'patientName'),
  'Rekha Nair',
);
check(
  'M8.2 and the English half still extracts',
  symptomsOf('Patient ka naam Rekha Nair hai. She has fever.').includes('fever'),
  true,
);

const WEIGHTS = [
  ['Weight is 58 kg.', '58'],
  ['Weight is 58 kilograms.', '58'],
  ['She weighs 58 kilos.', '58'],
  ['He weighed 58 kgs.', '58'],
  ['They weigh 58 kg.', '58'],
  ['Body weight 58.5 kg.', '58.5'],
  ['With a weight of 58 kg.', '58'],
];

for (const [text, expected] of WEIGHTS) {
  check(`M9.1 "${text}" reads ${expected}`, value(read(text), 'weight'), expected);
}

check(
  'M9.2 a dose is not a weight',
  value(read('Prescribed paracetamol 500 mg twice daily.'), 'weight'),
  '',
);

{
  const text = 'Initial case. Patient name is Meera Rao. She has fever and itching.';
  const { record, residue } = extractForReport(text);
  const completeness = validateReportCompleteness(toDraft(record, residue));
  const missing = blockingFields(completeness).map(field => field.key);

  check('M10.1 the report is incomplete', completeness.isComplete, false);
  check('M10.2 the missing start date is named', missing.includes('reactionStartDate'), true);
  check('M10.3 no age is invented', value(record, 'age'), '');
  check('M10.4 no date is invented', value(record, 'reactionStartDate'), '');
}

check(
  'M10.5 an empty dictation extracts nothing',
  Object.values(read('')).filter(Boolean).length,
  0,
);
check('M10.6 a bare one-word utterance extracts nothing', value(read('Fever.'), 'symptoms'), '');
check(
  'M10.7 but a one-word finding with any cue does extract',
  value(read('She has fever.'), 'symptoms'),
  'Fever',
);

{
  const source = 'ਮਰੀਜ਼ ਦਾ ਭਾਰ ੬੨.੫ ਕਿਲੋ ਹੈ ਅਤੇ ਪ੍ਰਤੀਕਿਰਿਆ ੨੦੨੬ ਵਿੱਚ ਸ਼ੁਰੂ ਹੋਈ।';
  const { masked, entities } = protect(source);
  check('M11.1 the decimal weight is protected', entities.some(e => e.value === '62.5'), true);
  check('M11.2 the year is protected', entities.some(e => e.value === '2026'), true);
  check('M11.3 no protected value is left in the payload', /62\.5|2026/.test(masked), false);

  const returned = 'The weight is [A] kg and the reaction began in [B].';
  const back = stripSentinels(restore(returned, entities).text);
  check('M11.4 both come back', back, 'The weight is 62.5 kg and the reaction began in 2026.');
}
check(
  'M12.1 an orphaned year is reattached',
  repairOrphanedYears('The event 2027 commenced on 4 March and 2027 ceased on 9 March.'),
  'The event commenced on 4 March 2027 and ceased on 9 March 2027.',
);
check(
  'M12.2 a dropped year is inferred from the dictation',
  inferMissingYears('The event commenced on 4 March 2027 and ceased on 9 March.', ['2027', '2027']),
  'The event commenced on 4 March 2027 and ceased on 9 March 2027.',
);
check(
  'M12.3 an ambiguous dictation is left alone',
  inferMissingYears('commenced on 4 March 2026 and ceased on 9 March.', ['2026', '2027']),
  'commenced on 4 March 2026 and ceased on 9 March.',
);

{
  const text =
    'Initial case. Patient Vimala Iyer. Aged 61 years. Female. Weight 54 kg. ' +
    'There was fever, itching and swelling. The reaction started on 2 March 2026 ' +
    'and subsided on 6 March 2026. The drug was stopped.';
  const { record, residue } = extractForReport(text);
  const doc = buildReportDocument(toDraft(record, residue), { now: 0 });

  const spoken = new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
  const ALLOWED = new Set([
    'not', 'available', 'years', 'denies', 'male', 'female', 'initial', 'medication',
  ]);

  const printed = [doc.sectionA?.caseType, doc.sectionA?.gender, doc.sectionB?.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  check(
    'M13.1 every printed word was dictated',
    printed.filter(
      word =>
        !spoken.has(word) &&
        !ALLOWED.has(word) &&
        ![...spoken].some(said => said.slice(0, 4) === word.slice(0, 4)),
    ),
    [],
  );
}

report();
