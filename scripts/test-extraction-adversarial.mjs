/**
 * Adversarial extraction fixtures.
 *
 *   node scripts/test-extraction-adversarial.mjs
 *
 * Conflicting, corrected and cancelled dictation — the cases designed to break
 * confidence-only conflict resolution. Every fixture asserts the exact value of
 * the affected fields AND explicitly asserts the fields that must stay empty or
 * must not carry a cancelled value.
 */
import { extractPatientFields } from '../src/services/extractionService.js';

import {
  check,
  expectFields as assertFields,
  report,
  valueOf,
} from './lib/fixture-harness.mjs';

const expectFields = (label, transcript, expected) =>
  assertFields(extractPatientFields, label, transcript, expected);

/** Asserts a field exists but does not contain a forbidden substring. */
function expectAbsent(label, transcript, key, forbidden) {
  const record = extractPatientFields(transcript);
  const value = valueOf(record[key]);
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  check(
    `${label} → ${key} excludes "${forbidden}"`,
    text.toLowerCase().includes(forbidden.toLowerCase()),
    false,
  );
}

// ── 1. Explicit declaration vs conflicting pronoun ──────────────────────────
expectFields('A1 explicit male vs she', 'Patient is male. She has fever.', {
  gender: 'Male',
  symptoms: ['Fever'],
});

expectFields('A2 explicit female vs he', 'Gender female. He complains of headache.', {
  gender: 'Female',
  symptoms: ['Headache'],
});

// ── 2. Corrections ──────────────────────────────────────────────────────────
expectFields('A3 age correction', 'Age is 42 years. Sorry, correction, age is 24 years.', {
  age: '24 Years',
});

expectFields(
  'A4 contact correction',
  'Contact number is 9876543210. Sorry, correction, contact number is 9812345678.',
  { contactNumber: '9812345678' },
);

const A5_TRANSCRIPT =
  'Diagnosis is viral fever. Actually, diagnosis is throat infection.';

expectFields('A5 diagnosis correction', A5_TRANSCRIPT, {
  diagnosis: 'Throat infection',
});
expectAbsent('A5 diagnosis correction', A5_TRANSCRIPT, 'diagnosis', 'viral fever');

expectFields(
  'A6 name correction',
  'Patient name is Rahul Sharma. Sorry, correction, patient name is Rahul Verma.',
  { patientName: 'Rahul Verma' },
);

// ── 3. Cancellation ─────────────────────────────────────────────────────────
expectFields('A7 history cancelled', 'Known diabetic. Correction, no history of diabetes.', {
  medicalHistory: 'No history of diabetes',
});

expectFields(
  'A10 medication cancelled',
  'Start Paracetamol 500 milligrams twice daily. Correction, do not start Paracetamol.',
  { prescriptionNotes: null },
);

// ── 4. Negation ordering ────────────────────────────────────────────────────
expectFields(
  'A8 negation then later positive',
  'No fever yesterday, but the patient developed fever this morning.',
  { symptoms: ['Fever this morning'] },
);

expectFields(
  'A9 past positive then current denial',
  'Patient had chest pain yesterday but currently denies chest pain.',
  { symptoms: null, additionalRemarks: 'Denies: chest pain' },
);

// ── 5. Repetition and numeric separation ────────────────────────────────────
expectFields(
  'A11 repetition reinforces',
  'Patient name is Simran Kaur. Age 28 years. For confirmation, patient name is Simran Kaur, age 28 years.',
  { patientName: 'Simran Kaur', age: '28 Years' },
);

expectFields(
  'A12 numeric fields do not bleed',
  'Age is 34 years. PIN code is 201301. Contact number is 9876543210. Prescription notes: Paracetamol 500 milligrams twice daily for five days.',
  {
    age: '34 Years',
    pinCode: '201301',
    contactNumber: '9876543210',
    prescriptionNotes: ['Paracetamol 500 milligrams twice daily for five days'],
  },
);

// ── 6. Companion references ─────────────────────────────────────────────────
expectFields('A13 companion pronoun', 'Her husband says the patient has fever.', {
  gender: null,
  symptoms: ['Fever'],
});

// ── 7. Messy recogniser output ──────────────────────────────────────────────
expectFields(
  'A14 unstructured',
  'patient name is meera shah age 32 years female pin code 395007 contact number 9825123406 she complains of fever cough and weakness diagnosis is viral fever',
  {
    patientName: 'Meera Shah',
    age: '32 Years',
    gender: 'Female',
    pinCode: '395007',
    contactNumber: '9825123406',
    diagnosis: 'Viral fever',
    // "fever cough" separates because both words are known findings and the
    // run is fully accounted for. A run containing anything unrecognised is
    // left exactly as dictated rather than shattered on whitespace.
    symptoms: ['Fever', 'Cough', 'Weakness'],
  },
);

expectFields(
  'A15 recogniser restart duplicates',
  'Complains of fever and cough. Complains of fever and cough. Diagnosis is viral fever. Diagnosis is viral fever.',
  { symptoms: ['Fever', 'Cough'], diagnosis: 'Viral fever' },
);

// ── Report ──────────────────────────────────────────────────────────────────
report();
