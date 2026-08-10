
import { extractPatientFields } from '../src/services/extractionService.js';

import { check, report, valueOf } from './lib/fixture-harness.mjs';

const expectField = (field, transcript, expected) =>
  check(`${field} ← "${transcript}"`, valueOf(extractPatientFields(transcript)[field]), expected);

const ADDRESS = 'House 10, Shastri Nagar, Meerut';
for (const phrase of [
  `She resides at ${ADDRESS}.`,
  `Residing at ${ADDRESS}.`,
  `She lives at ${ADDRESS}.`,
  `Living at ${ADDRESS}.`,
  `She stays at ${ADDRESS}.`,
  `Staying at ${ADDRESS}.`,
  `Address is ${ADDRESS}.`,
  `Her address is ${ADDRESS}.`,
  `Located at ${ADDRESS}.`,
]) {
  expectField('address', phrase, ADDRESS);
}
expectField('address', 'She lives in Meerut.', 'Meerut');

expectField('address', 'Address is Likely Lane, Sector 10.', 'Likely Lane, Sector 10');

for (const phrase of [
  'PIN 250004.',
  'PIN code is 250004.',
  'Pincode 250004.',
  'Postal code is 250004.',
  'Zip code 250004.',
]) {
  expectField('pinCode', phrase, '250004');
}

for (const phrase of [
  'Contact number is 9812345067.',
  'Phone number is 9812345067.',
  'Mobile number is 9812345067.',
  'Contact is 9812345067.',
  'Reachable at 9812345067.',
  'She can be reached on 9812345067.',
  'He can be reached at 9812345067.',
]) {
  expectField('contactNumber', phrase, '9812345067');
}

expectField('contactNumber', 'She can be reached on 98123 45067.', '9812345067');

for (const phrase of [
  'She complains of fever, cough and sore throat.',
  'Complaining of fever, cough and sore throat.',
  'She presents with fever, cough and sore throat.',
  'Presenting with fever, cough and sore throat.',
  'Symptoms include fever, cough and sore throat.',
  'She is experiencing fever, cough and sore throat.',
  'Suffering from fever, cough and sore throat.',
  'She is having fever, cough and sore throat.',
  'She has been having fever, cough and sore throat.',
]) {
  expectField('symptoms', phrase, ['Fever', 'Cough', 'Sore throat']);
}

expectField('symptoms', 'She presents with fever cough headache sore throat.', [
  'Fever',
  'Cough',
  'Headache',
  'Sore throat',
]);
expectField('symptoms', 'She presents with mild fever and dry cough.', [
  'Mild fever',
  'Dry cough',
]);

expectField('symptoms', 'She complains of body pain for about three days.', [
  'Body pain for about three days',
]);

for (const phrase of [
  'She is a known case of diabetes.',
  'Medical history of diabetes.',
  'History of diabetes.',
  'Past history of diabetes.',
  'Previously diagnosed with diabetes.',
]) {
  expectField('medicalHistory', phrase, 'Diabetes');
}
expectField('medicalHistory', 'Known diabetic.', 'Known diabetic');
expectField('medicalHistory', 'Known hypertensive.', 'Known hypertensive');

for (const phrase of [
  'Diagnosis is viral fever.',
  'Diagnosed with viral fever.',
  'My clinical impression is viral fever.',
  'Clinical impression is viral fever.',
  'Impression is viral fever.',
  'Looks like viral fever.',
  'Appears to be viral fever.',
]) {
  expectField('diagnosis', phrase, 'Viral fever');
}

const DOSE = 'Paracetamol 500 milligrams twice daily';
for (const phrase of [
  `Prescribed ${DOSE}.`,
  `I'll prescribe ${DOSE}.`,
  `Start her on ${DOSE}.`,
  `Start him on ${DOSE}.`,
  `Started on ${DOSE}.`,
  `Medication is ${DOSE}.`,
  `Treatment is ${DOSE}.`,
]) {
  expectField('prescriptionNotes', phrase, [DOSE]);
}

expectField(
  'prescriptionNotes',
  'Start her on Paracetamol 500 milligrams twice a day for five days and cough syrup at bedtime.',
  [
    'Paracetamol 500 milligrams twice a day for five days',
    'Cough syrup at bedtime',
  ],
);

expectField(
  'additionalRemarks',
  'Advice is to maintain good hydration.',
  'Maintain good hydration',
);
expectField(
  'additionalRemarks',
  'Advice: maintain good hydration.',
  'Maintain good hydration',
);
expectField(
  'additionalRemarks',
  'Advised to maintain good hydration.',
  'Maintain good hydration',
);
expectField(
  'additionalRemarks',
  'Recommendations are to maintain good hydration.',
  'Maintain good hydration',
);

expectField(
  'additionalRemarks',
  'Come back for review after three days.',
  'Come back for review after three days',
);
expectField('additionalRemarks', 'Review after three days.', 'Review after three days');
expectField('additionalRemarks', 'Return after three days.', 'Return after three days');
expectField('additionalRemarks', 'Follow up after three days.', 'Follow up after three days');

expectField('additionalRemarks', 'Diagnosis is viral fever.', null);

expectField(
  'symptoms',
  'she presents with fever and tiredness she is a known case of diabetes',
  ['Fever', 'Tiredness'],
);
expectField(
  'medicalHistory',
  'she is a known case of diabetes my clinical impression is viral fever',
  'Diabetes',
);
expectField(
  'address',
  'she resides at house 10 Shastri Nagar Meerut postal code is 250004',
  'House 10 Shastri Nagar Meerut',
);
expectField(
  'diagnosis',
  'my clinical impression is viral fever start her on paracetamol 500 milligrams twice daily',
  'Viral fever',
);

report();
