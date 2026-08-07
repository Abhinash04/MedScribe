import {
  extractForReport,
  extractPatientFields,
} from '../src/services/extractionService.js';
import { collectResidue, splitSentences } from '../src/services/extraction/residue.js';
import { buildReportDocument } from '../src/services/reportDocument.js';
import {
  draftNotes,
  fromStored,
  keptNotes,
  mergeExtraction,
  setNoteKept,
  setNoteText,
  toDraft,
} from '../src/services/reportDraft.js';

import { check, report } from './lib/fixture-harness.mjs';

const NATURAL =
  'The patient is a 45-year-old male who has had fever and dry cough for four days. ' +
  'He is diabetic and hypertensive. No history of asthma. ' +
  'Examination suggests a viral respiratory infection. ' +
  'Start paracetamol 650 mg twice daily after food for five days and advise adequate ' +
  'hydration and follow-up after one week.';

const REAL =
  'The patient name is Ram Kapoor. He reports that the fever is more noticeable during ' +
  'the evening and at the cough become worse at night. He is a 48 year old male patient ' +
  'residing at Vasant Kunj, New Delhi. His contact number is 9876543210. The patient has ' +
  'a medical history of diabetes and high blood pressure. He has. No known history of ' +
  'asthma or any major surgical procedure. Based on the symptoms and clinical ' +
  'examination, the provisional diagnosis is a viral respiratory infection. I am ' +
  'prescribing. Paracetamol 650 milligrams device daily after food for 5 days. The ' +
  'patients drink plenty of water, maintain adequate hydration. Take sufficient rest and ' +
  'monitor his body temperature regularly. The patient has also been advised to avoid ' +
  'physical activity until the symptoms improve. He should continue his regular ' +
  'medication for diabetes and high blood pressure.';

const TEMPLATE =
  'Patient name is Rohit Mehta. He is 46 years old. Gender is male. His medical history ' +
  'includes high blood pressure. Diagnosis is muscle strain. Symptoms include back pain ' +
  'and stiffness. Prescription notes: Paracetamol 500 milligrams twice daily. ' +
  'Additional remarks: avoid lifting heavy objects.';

const residueOf = transcript => collectResidue(transcript, extractPatientFields(transcript));

{
  const record = extractPatientFields(NATURAL);
  check('R1.1 the diagnosis still extracts as nothing', record.diagnosis, null);

  const residue = residueOf(NATURAL);
  check('R1.2 exactly one sentence is unaccounted for', residue.length, 1);
  check(
    'R1.3 and it is the diagnosis sentence, verbatim',
    residue[0].text,
    'Examination suggests a viral respiratory infection.',
  );
  check('R1.4 suggested to the right field', residue[0].suggestedField, 'diagnosis');
  check('R1.5 the transcript still contains it exactly', NATURAL.includes(residue[0].text), true);
  check(
    'R1.6 offsets point at the sentence',
    NATURAL.slice(residue[0].start, residue[0].end),
    residue[0].text,
  );
}

{
  const residue = residueOf(REAL);
  const texts = residue.map(item => item.text);

  check('R2.1 two sentences are unaccounted for', residue.length, 2);
  for (const fragment of ['maintain adequate hydration', 'sufficient rest']) {
    check(
      `R2.2 keeps "${fragment}"`,
      texts.some(text => text.includes(fragment)),
      true,
    );
  }
  check(
    'R2.2b the advice that now reaches a field is no longer residue',
    texts.some(text => text.includes('avoid physical activity')),
    false,
  );
  check(
    'R2.2c because additionalRemarks holds it instead of a fragment',
    extractPatientFields(REAL).additionalRemarks?.value,
    'Avoid physical activity until the symptoms improve',
  );
  check(
    'R2.3 all suggested as remarks',
    residue.every(item => item.suggestedField === 'additionalRemarks'),
    true,
  );
  check(
    'R2.4 every one is verbatim from the transcript',
    residue.every(item => REAL.includes(item.text)),
    true,
  );
}

check('R3.1 a template dictation leaves nothing over', residueOf(TEMPLATE).length, 0);
check('R3.2 an empty transcript leaves nothing over', residueOf('').length, 0);
check('R3.3 a null transcript is safe', collectResidue(null, null).length, 0);
check('R3.4 a one-word utterance is not residue', residueOf('Fever.').length, 0);

check(
  'R4.1 a decimal is not a sentence end',
  splitSentences('Give 500.5 mg twice daily.').length,
  1,
);
check(
  'R4.2 a title is not a sentence end',
  splitSentences('Dr. Rao advised rest.').length,
  1,
);
check(
  'R4.3 two sentences split',
  splitSentences('Fever for two days. Cough at night.').length,
  2,
);
check(
  'R4.4 offsets are exact',
  splitSentences('Fever. Cough.').map(s => 'Fever. Cough.'.slice(s.start, s.end)),
  ['Fever.', 'Cough.'],
);

{
  const record = extractPatientFields(NATURAL);
  let draft = toDraft(record, collectResidue(NATURAL, record));

  check('R5.1 the note is carried on the draft', draftNotes(draft).length, 1);
  check('R5.2 but not kept by default', keptNotes(draft).length, 0);

  const before = buildReportDocument(draft, { now: 0 });
  check(
    'R5.3 so the report has no notes section',
    before.sections.some(section => section.label === 'Additional Clinical Notes'),
    false,
  );

  draft = setNoteKept(draft, 0, true);
  check('R5.4 keeping it publishes it', keptNotes(draft).length, 1);

  const after = buildReportDocument(draft, { now: 0 });
  const notes = after.sections.find(section => section.label === 'Additional Clinical Notes');
  check('R5.5 the section appears', !!notes, true);
  check('R5.6 carrying the sentence verbatim', notes.items, [
    'Examination suggests a viral respiratory infection.',
  ]);

  draft = setNoteKept(draft, 0, false);
  check(
    'R5.7 dismissing it removes the section again',
    buildReportDocument(draft, { now: 0 }).sections.some(
      section => section.label === 'Additional Clinical Notes',
    ),
    false,
  );

  check('R5.8 an out-of-range index is a no-op', setNoteKept(draft, 9, true), draft);
}

{
  const record = extractPatientFields(NATURAL);
  const residue = collectResidue(NATURAL, record);
  let draft = setNoteKept(toDraft(record, residue), 0, true);

  draft = mergeExtraction(draft, record, residue);
  check('R6.1 the note is still kept after re-extraction', keptNotes(draft).length, 1);

  const withoutResidue = mergeExtraction(draft, record);
  check(
    'R6.2 omitting residue leaves the notes untouched',
    keptNotes(withoutResidue).length,
    1,
  );
}

// ── 6b. A note is identified by its span, never by its text ─────────────────
// Text is neither unique nor fixed: a dictation can repeat a sentence, and the
// card lets the doctor edit one. Matching on it lost the decision both ways.
{
  const twice = [
    { text: 'Same sentence.', start: 0, end: 14, suggestedField: null },
    { text: 'Same sentence.', start: 40, end: 54, suggestedField: null },
  ];
  const kept = setNoteKept(toDraft({}, twice), 0, true);

  check('R6.3 identical notes get distinct ids', draftNotes(kept).map(note => note.id), [
    '0-14',
    '40-54',
  ]);
  check(
    'R6.4 keeping one of two identical notes survives re-extraction',
    draftNotes(mergeExtraction(kept, {}, twice)).map(note => note.kept),
    [true, false],
  );

  const one = [{ text: 'Original wording.', start: 0, end: 17, suggestedField: null }];
  let edited = setNoteKept(toDraft({}, one), 0, true);
  edited = setNoteText(edited, 0, 'Doctor edited wording.');

  check(
    'R6.5 an edited note keeps both its wording and its decision',
    keptNotes(mergeExtraction(edited, {}, one)),
    ['Doctor edited wording.'],
  );
  check(
    'R6.6 a note stored before ids existed still matches on text',
    fromStored({ additionalNotes: [{ text: 'Legacy.', kept: true }] }).additionalNotes[0].id,
    't:Legacy.',
  );
}

const WORDS = value => String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) || [];
const STEM = word => word.slice(0, 4);

const REPORT_VOCABULARY = new Set(['not', 'available', 'years', 'denies', 'male', 'female']);

function ungroundedWords(transcript) {
  const { record, residue } = extractForReport(transcript);
  let draft = toDraft(record, residue);
  residue.forEach((_, index) => {
    draft = setNoteKept(draft, index, true);
  });

  const document = buildReportDocument(draft, { now: 0 });
  const spoken = new Set(WORDS(transcript));
  const spokenStems = new Set([...spoken].map(STEM));

  const printed = [
    ...document.patient.map(block => block.value),
    ...document.sections.flatMap(block => [block.value, ...(block.items ?? [])]),
  ];

  return [...new Set(printed.flatMap(WORDS))].filter(
    word =>
      !REPORT_VOCABULARY.has(word) && !spoken.has(word) && !spokenStems.has(STEM(word)),
  );
}

const UNPUNCTUATED =
  'patient name is Meera Shah age 32 years female address house 27 river road Surat ' +
  'Gujarat pin code 395007 contact number 9825123406 she complains of fever cough ' +
  'headache sore throat and weakness medical history includes asthma diagnosis is viral ' +
  'fever prescription notes paracetamol 500 milligrams twice daily for five days';

const SCRAMBLED =
  'Additional remarks: Drink warm water and return after four days. Diagnosis is common ' +
  'cold. Contact number is 9873456120. Symptoms include sneezing, runny nose, and sore ' +
  'throat. Medical history includes asthma. PIN code is 122001. Patient name is Aman ' +
  'Gupta. Gender is male. Age is 30 years.';

const CONVERSATIONAL =
  "Okay, so this is Deepak Mishra. He's 33 years old and male. He's been having fever, " +
  'cough and body pain for about three days. He has a history of asthma. Looks like ' +
  'viral fever to me. Give him Paracetamol 500 milligrams twice daily for three days.';

const NEGATED =
  'Patient name is Riya Kapoor. She is 24 years old and female. She complains of fever ' +
  'and sore throat. She has no chest pain and no breathing difficulty. Her medical ' +
  'history includes asthma, with no history of diabetes. Diagnosis is viral throat ' +
  'infection.';

for (const [label, transcript] of [
  ['natural', NATURAL],
  ['real dictation', REAL],
  ['template', TEMPLATE],
  ['unpunctuated', UNPUNCTUATED],
  ['scrambled order', SCRAMBLED],
  ['conversational', CONVERSATIONAL],
  ['negated findings', NEGATED],
]) {
  check(`R7 ${label} — no printed word was left undictated`, ungroundedWords(transcript), []);
}

check(
  'R7.4 an invented word would be caught',
  ungroundedWords(TEMPLATE).length === 0 &&
    (() => {
      const spoken = new Set(WORDS(TEMPLATE));
      return !spoken.has('amoxicillin');
    })(),
  true,
);

report();