import { extractPatientFields } from '../src/services/extractionService.js';

import { check, expectFields as assertFields, report } from './lib/fixture-harness.mjs';

const expectFields = (label, transcript, expected) =>
  assertFields(extractPatientFields, label, transcript, expected);

const history = transcript => extractPatientFields(transcript).medicalHistory?.value ?? null;

const ordered = (label, transcript, parts) => {
  const value = history(transcript);
  for (const part of parts) {
    check(`${label} → keeps "${part}"`, (value ?? '').toLowerCase().includes(part.toLowerCase()), true);
  }
  const positions = parts.map(part => (value ?? '').toLowerCase().indexOf(part.toLowerCase()));
  check(
    `${label} → in dictated order`,
    positions.every((at, index) => index === 0 || at > positions[index - 1]),
    true,
  );
};

ordered(
  'H1.1 positive then negative',
  'He has a medical history of diabetes and high blood pressure. He has no known history of asthma.',
  ['diabetes and high blood pressure', 'no known history of asthma'],
);

expectFields(
  'H1.2 the exact reported dictation',
  'He has a medical history of diabetes and high blood pressure. He has no known history of asthma.',
  { medicalHistory: 'Diabetes and high blood pressure. No known history of asthma' },
);

ordered(
  'H2.1 negative then positive',
  'He has no known history of asthma. He has a medical history of diabetes and high blood pressure.',
  ['no known history of asthma', 'diabetes and high blood pressure'],
);

check(
  'H2.2 reversing the dictation reverses the field, losing nothing',
  history('He has no known history of asthma. He has a medical history of diabetes and high blood pressure.'),
  'No known history of asthma. Diabetes and high blood pressure',
);

ordered(
  'H3.1 two positive statements',
  'History of diabetes and hypertension. Known case of thyroid disorder.',
  ['diabetes and hypertension', 'thyroid disorder'],
);

ordered(
  'H3.2 three positive statements',
  'History of diabetes. Known case of thyroid disorder. Previously diagnosed with anaemia.',
  ['diabetes', 'thyroid disorder', 'anaemia'],
);

ordered(
  'H4.1 two denials',
  'No history of asthma. No previous cardiac disease.',
  ['no history of asthma', 'no previous cardiac disease'],
);

ordered(
  'H5.1 four statements, mixed polarity',
  'History of diabetes and hypertension. No history of asthma. Known case of thyroid disorder. No previous cardiac disease.',
  ['diabetes and hypertension', 'no history of asthma', 'thyroid disorder', 'no previous cardiac disease'],
);

ordered(
  'H5.2 the same four, reordered',
  'No previous cardiac disease. Known case of thyroid disorder. No history of asthma. History of diabetes and hypertension.',
  ['no previous cardiac disease', 'thyroid disorder', 'no history of asthma', 'diabetes and hypertension'],
);

check(
  'H6.1 a denied condition is never recorded as positive',
  /\bno\b[^.]*asthma/i.test(history('History of diabetes. No history of asthma.') ?? ''),
  true,
);

check(
  'H6.2 the denial does not leak its condition into the positive clause',
  /diabetes[^.]*asthma/i.test(history('History of diabetes. No history of asthma.') ?? ''),
  false,
);

expectFields('H6.3 a denial alone stays a denial', 'She has no history of asthma.', {
  medicalHistory: 'No history of asthma',
});

ordered(
  'H6.4 opposite polarity on the same condition keeps both statements',
  'Known case of diabetes. No history of gestational diabetes.',
  ['diabetes', 'no history of gestational diabetes'],
);

ordered(
  'H7.1 denial verb then positive',
  'He denies any history of asthma. Medical history of diabetes.',
  ['asthma', 'diabetes'],
);

ordered(
  'H7.2 positive then denial verb',
  'Medical history of diabetes. He denies any history of asthma.',
  ['diabetes', 'asthma'],
);

expectFields('H8.1 no previous <condition> disease', 'No previous cardiac disease.', {
  medicalHistory: 'No previous cardiac disease',
});
expectFields('H8.2 no known <condition> disorder', 'No known thyroid disorder.', {
  medicalHistory: 'No known thyroid disorder',
});
expectFields('H8.3 no prior surgery', 'No prior surgery.', {
  medicalHistory: 'No prior surgery',
});
expectFields('H8.4 no significant cardiac illness', 'No significant cardiac illness.', {
  medicalHistory: 'No significant cardiac illness',
});
expectFields('H8.5 a bare denial is not a history', 'No diabetes.', { medicalHistory: null });
expectFields('H8.6 nor is an unqualified condition', 'No cardiac disease.', {
  medicalHistory: null,
});
expectFields('H8.7 nor a non-condition noun', 'No other complaints.', { medicalHistory: null });
expectFields('H8.8 a symptom denial is not a history', 'No fever and no chest pain.', {
  medicalHistory: null,
});

for (const [cue, transcript] of [
  ['correction', 'Medical history of diabetes. Correction, medical history of hypertension.'],
  ['sorry', 'History of diabetes. Sorry, history of hypertension.'],
  ['actually', 'Known case of diabetes. Actually, known case of hypertension.'],
  ['i mean', 'History of diabetes. I mean, history of hypertension.'],
  ['scratch that', 'History of diabetes. Scratch that, history of hypertension.'],
]) {
  check(`H9 "${cue}" replaces rather than accumulates`, history(transcript), 'Hypertension');
}

expectFields(
  'H9.6 a cancelled positive leaves only the denial',
  'Known diabetic. Correction, no history of diabetes.',
  { medicalHistory: 'No history of diabetes' },
);

expectFields(
  'H10.1 the same condition twice is not duplicated',
  'Medical history of diabetes. Known case of diabetes.',
  { medicalHistory: 'Diabetes' },
);
expectFields(
  'H10.2 a superset absorbs the statement it restates',
  'History of diabetes. History of diabetes and hypertension.',
  { medicalHistory: 'Diabetes and hypertension' },
);
expectFields(
  'H10.3 and in the other order',
  'History of diabetes and hypertension. History of diabetes.',
  { medicalHistory: 'Diabetes and hypertension' },
);

expectFields('H11.1 one positive', 'He has a medical history of diabetes and high blood pressure.', {
  medicalHistory: 'Diabetes and high blood pressure',
});
expectFields('H11.2 one denial', 'He has no known history of asthma.', {
  medicalHistory: 'No known history of asthma',
});
expectFields('H11.3 none dictated', 'Patient name is Ram Kapoor.', { medicalHistory: null });

check(
  'H12.1 a combined history is still a string',
  typeof history('History of diabetes. No history of asthma.'),
  'string',
);
check(
  'H12.2 with no doubled separators',
  /\.\s*\.|\s{2,}/.test(history('History of diabetes. No history of asthma.') ?? ''),
  false,
);

expectFields(
  'H13.1 diagnosis still replaces',
  'Diagnosis is viral fever. Diagnosis is dengue.',
  { diagnosis: 'Dengue' },
);
expectFields('H13.2 age still replaces', 'Age 22. Sorry, age 42.', { age: '42 Years' });
expectFields(
  'H13.3 a full dictation is unaffected elsewhere',
  'Patient name is Ram Kapoor. He is 48 years old male. History of diabetes. No history of asthma. Diagnosis is viral fever.',
  {
    patientName: 'Ram Kapoor',
    age: '48 Years',
    gender: 'Male',
    diagnosis: 'Viral fever',
  },
);

report();
