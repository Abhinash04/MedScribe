
import { extractPatientFields } from '../src/services/extractionService.js';
import { splitFindings } from '../src/services/extraction/detectNegation.js';
import {
  looksLikeMedication,
  splitMedications,
} from '../src/services/extraction/parseMedication.js';

import {
  check,
  expectFields as assertFields,
  report,
  valueOf,
} from './lib/fixture-harness.mjs';

const expectFields = (label, transcript, expected) =>
  assertFields(extractPatientFields, label, transcript, expected);

expectFields('C1.1 looks like … to me', 'Looks like viral fever to me.', {
  diagnosis: 'Viral fever',
});
expectFields('C1.2 it looks like', 'It looks like viral infection.', {
  diagnosis: 'Viral infection',
});
expectFields('C1.3 seems to be', 'Seems to be viral fever.', { diagnosis: 'Viral fever' });
expectFields('C1.4 diagnosis is', 'Diagnosis is viral fever.', { diagnosis: 'Viral fever' });
expectFields('C1.5 my diagnosis is', 'My diagnosis is viral fever.', {
  diagnosis: 'Viral fever',
});
expectFields('C1.6 clinical impression', 'Clinical impression is viral infection.', {
  diagnosis: 'Viral infection',
});
expectFields('C1.7 I think this is', 'I think this is common cold.', {
  diagnosis: 'Common cold',
});
expectFields('C1.8 this appears to be', 'This appears to be throat infection.', {
  diagnosis: 'Throat infection',
});
expectFields('C1.9 most likely', 'Most likely viral fever.', { diagnosis: 'Viral fever' });
expectFields('C1.10 probably a', 'Probably a viral infection.', {
  diagnosis: 'Viral infection',
});

expectFields('C1.11 KEEP suspected', 'Diagnosis is suspected dengue.', {
  diagnosis: 'Suspected dengue',
});
expectFields('C1.12 KEEP probable', 'Diagnosis is probable dengue.', {
  diagnosis: 'Probable dengue',
});

expectFields(
  'C2.1 is having, scaffolding removed',
  'He is having fever, cough, headache, and body pain for about three days.',
  { symptoms: ['Fever', 'Cough', 'Headache', 'Body pain for about three days'] },
);
expectFields(
  'C2.2 complaining of',
  'She is complaining of severe headache and weakness.',
  { symptoms: ['Severe headache', 'Weakness'] },
);
expectFields(
  'C2.3 has been experiencing',
  'The patient has been experiencing fever and dry cough.',
  { symptoms: ['Fever', 'Dry cough'] },
);

expectFields('C2.4 KEEP persistent', 'Complains of persistent cough.', {
  symptoms: ['Persistent cough'],
});
expectFields('C2.5 KEEP mild and productive', 'Complains of mild fever and productive cough.', {
  symptoms: ['Mild fever', 'Productive cough'],
});
expectFields('C2.6 KEEP recurrent', 'Complains of recurrent chest pain.', {
  symptoms: ['Recurrent chest pain'],
});

expectFields('C3.1 known case of', 'She is a known case of diabetes.', {
  medicalHistory: 'Diabetes',
});
expectFields('C3.2 has a medical history of', 'He has a medical history of high blood pressure.', {
  medicalHistory: 'High blood pressure',
});
expectFields('C3.3 duration preserved', 'Patient has been diabetic for five years.', {
  medicalHistory: 'Diabetic for five years',
});
expectFields('C3.4 negation still wins', 'She has no history of asthma.', {
  medicalHistory: 'No history of asthma',
});

expectFields(
  'C4.1 I am prescribing',
  'I am prescribing Paracetamol 500 milligrams twice daily for five days.',
  { prescriptionNotes: ['Paracetamol 500 milligrams twice daily for five days'] },
);
expectFields(
  'C4.2 I want her to start',
  'I want her to start Paracetamol 500 milligrams twice daily.',
  { prescriptionNotes: ['Paracetamol 500 milligrams twice daily'] },
);
expectFields('C4.3 give him', 'Give him cough syrup twice daily for three days.', {
  prescriptionNotes: ['Cough syrup twice daily for three days'],
});

expectFields('C4.4 bare drug and dose', 'Paracetamol 500 milligrams after food.', {
  prescriptionNotes: ['Paracetamol 500 milligrams after food'],
});
const noFrequency = valueOf(
  extractPatientFields('Paracetamol 500 milligrams after food.').prescriptionNotes,
);
check(
  'C4.5 frequency is not invented',
  (noFrequency || []).join(' ').toLowerCase().includes('twice daily'),
  false,
);
expectFields(
  'C4.6 cancelled medication stays out',
  'Start Paracetamol 500 milligrams twice daily. Correction, do not start Paracetamol.',
  { prescriptionNotes: null },
);

expectFields(
  'C4.7 two drugs split without a strength',
  'Prescribed cough syrup twice daily and vitamin tablets once daily.',
  { prescriptionNotes: ['Cough syrup twice daily', 'Vitamin tablets once daily'] },
);
check(
  'C4.8 an advice clause stays attached, never its own entry',
  splitMedications('Paracetamol 500 mg twice daily and drink plenty of water'),
  ['Paracetamol 500 mg twice daily and drink plenty of water'],
);

check('C4.9 frequency alone is not medication', looksLikeMedication('twice daily'), false);
check(
  'C4.10 advice with a frequency is not medication',
  looksLikeMedication('plenty of oral fluids every four hours'),
  false,
);
expectFields(
  'C4.11 weak advice with a frequency routes to remarks',
  'Advised plenty of oral fluids every four hours.',
  {
    prescriptionNotes: null,
    additionalRemarks: 'Plenty of oral fluids every four hours',
  },
);
expectFields('C4.12 a daily walk is advice', 'Advised a daily walk and adequate rest.', {
  prescriptionNotes: null,
  additionalRemarks: 'Daily walk and adequate rest',
});

expectFields(
  'C5.1 I would advise the patient to',
  'I would advise the patient to drink plenty of water and return after three days.',
  { additionalRemarks: 'Drink plenty of water and return after three days' },
);
expectFields(
  'C5.2 tell her to',
  'Tell her to take adequate rest and come back after five days.',
  { additionalRemarks: 'Take adequate rest and come back after five days' },
);
expectFields(
  'C5.3 patient should',
  'Patient should get a CBC and review after three days.',
  { additionalRemarks: 'Get a CBC and review after three days' },
);

check('C5.4 semicolon ends the negation', splitFindings('no fever; cough'), {
  positive: ['cough'],
  negative: ['fever'],
});
check('C5.5 full stop ends the negation', splitFindings('no fever. cough'), {
  positive: ['cough'],
  negative: ['fever'],
});
check('C5.6 "though" ends the negation', splitFindings('no fever though cough'), {
  positive: ['cough'],
  negative: ['fever'],
});
check('C5.7 "although" ends the negation', splitFindings('no fever although cough'), {
  positive: ['cough'],
  negative: ['fever'],
});

check(
  'C5.8 a decimal reading is one finding',
  splitFindings('fever 101.5 degrees and cough'),
  { positive: ['fever 101.5 degrees', 'cough'], negative: [] },
);

expectFields('C6.1 name', "Patient's name is Rahul Sharma.", { patientName: 'Rahul Sharma' });
expectFields('C6.2 age', 'He is 34 years old.', { age: '34 Years' });
expectFields('C6.3 gender phrase', 'She is a female patient.', { gender: 'Female' });
expectFields('C6.4 address', 'She lives at House 24, Sector 10, Noida.', {
  address: 'House 24, Sector 10, Noida',
});
expectFields('C6.5 pin code', 'PIN code is 110070.', { pinCode: '110070' });
expectFields('C6.6 contact', 'Her phone number is 955 677 4130.', {
  contactNumber: '9556774130',
});

const traced = extractPatientFields('Looks like viral fever to me.');
check('C7.1 cleaned value', valueOf(traced.diagnosis), 'Viral fever');
check(
  'C7.2 source span covers the dictated phrase',
  'Looks like viral fever to me.'
    .slice(traced.diagnosis.start, traced.diagnosis.end)
    .toLowerCase()
    .includes('viral fever'),
  true,
);
check('C7.3 marker recorded', typeof traced.diagnosis.source === 'string', true);

expectFields(
  'C7.4 hedge words are not stripped from an address',
  'Address is Likely Lane, Sector 10, Noida.',
  { address: 'Likely Lane, Sector 10, Noida' },
);

report();
