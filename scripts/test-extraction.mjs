
import {
  countCapturedFields,
  extractPatientFields,
} from '../src/services/extractionService.js';

let passed = 0;
let failed = 0;
const failures = [];

const valueOf = field => (field ? field.value : null);

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`  ${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
  }
}

function expectFields(label, transcript, expected) {
  const record = extractPatientFields(transcript);
  for (const [key, want] of Object.entries(expected)) {
    check(`${label} → ${key}`, valueOf(record[key]), want);
  }
}

expectFields(
  '1 template',
  'Patient name is Hema Sharma. Age 22 years. Gender Female. Address is Sector 12, Dwarka, New Delhi. PIN code 110078. Contact number 9876543210. Complains of fever, cough and headache. Medical history of diabetes. Diagnosis is viral infection. Prescribed paracetamol twice daily. Remarks patient advised for blood tests.',
  {
    patientName: 'Hema Sharma',
    age: '22 Years',
    gender: 'Female',
    pinCode: '110078',
    contactNumber: '9876543210',
    symptoms: ['Fever', 'Cough', 'Headache'],
    medicalHistory: 'Diabetes',
    diagnosis: 'Viral infection',
  },
);

expectFields(
  '2 unpunctuated',
  'patient name is Hema Sharma age 22 years gender female contact number 9876543210 complains of fever and cough diagnosis is viral infection',
  {
    patientName: 'Hema Sharma',
    age: '22 Years',
    gender: 'Female',
    contactNumber: '9876543210',
    symptoms: ['Fever', 'Cough'],
    diagnosis: 'Viral infection',
  },
);

const permutations = [
  'patient name is Hema Sharma age 22 years diagnosis is viral infection contact number 9876543210',
  'diagnosis is viral infection patient name is Hema Sharma contact number 9876543210 age 22 years',
  'contact number 9876543210 age 22 years diagnosis is viral infection patient name is Hema Sharma',
  'age 22 years contact number 9876543210 patient name is Hema Sharma diagnosis is viral infection',
];
const baseline = extractPatientFields(permutations[0]);
for (let i = 1; i < permutations.length; i += 1) {
  const other = extractPatientFields(permutations[i]);
  for (const key of ['patientName', 'age', 'diagnosis', 'contactNumber']) {
    check(
      `3 order-independence[${i}] → ${key}`,
      valueOf(other[key]),
      valueOf(baseline[key]),
    );
  }
}

expectFields(
  '4 synonyms',
  'the patient is Hema Sharma she is 22 years old she reports fever and cough known case of diabetes started her on paracetamol',
  {
    patientName: 'Hema Sharma',
    age: '22 Years',
    symptoms: ['Fever', 'Cough'],
    medicalHistory: 'Diabetes',
    prescriptionNotes: ['Paracetamol'],
  },
);

expectFields(
  '5 fillers',
  'um so patient name is Hema Sharma uh age 22 years you know diagnosis is viral infection',
  { patientName: 'Hema Sharma', age: '22 Years', diagnosis: 'Viral infection' },
);

expectFields(
  '6 self-correction',
  'age 22 years actually age 42 years',
  { age: '42 Years' },
);

const sparse = extractPatientFields('age 30 years complains of back pain');
check('7 precision → patientName null', sparse.patientName, null);
check('7 precision → diagnosis null', sparse.diagnosis, null);
check('7 precision → contactNumber null', sparse.contactNumber, null);
check('7 precision → symptoms', valueOf(sparse.symptoms), ['Back pain']);

check('8 empty → count', countCapturedFields(extractPatientFields('')), 0);
check('8 null → count', countCapturedFields(extractPatientFields(null)), 0);

const offsetSource =
  'um so patient name is Hema Sharma uh age 22 years';
const offsetRecord = extractPatientFields(offsetSource);
const nameField = offsetRecord.patientName;
check(
  '9 offsets → slice returns source text',
  nameField ? offsetSource.slice(nameField.start, nameField.end).trim().startsWith('Hema') : false,
  true,
);

const explicit = extractPatientFields('diagnosis is viral infection');
const hedged = extractPatientFields('looks like viral infection');
check('10 confidence → explicit > 0.90', explicit.diagnosis?.confidence > 0.9, true);
check('10 confidence → hedged < 0.75', hedged.diagnosis?.confidence < 0.75, true);

const REALISTIC = [
  ['R1 template',
   'Patient name is Hema Sharma. Age 22 years. Gender female. Address is Sector 12, Dwarka, New Delhi. PIN code 110078. Contact number 9876543210. Complains of fever, cough and headache. Medical history of diabetes. Diagnosis is viral infection. Prescribed paracetamol 500 mg twice daily for five days. Remarks: Patient advised for blood tests and adequate hydration.',
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', pinCode: '110078',
     contactNumber: '9876543210', diagnosis: 'Viral infection', medicalHistory: 'Diabetes',
     symptoms: ['Fever', 'Cough', 'Headache'],
     additionalRemarks: 'Patient advised for blood tests and adequate hydration' }],

  ['R2 random order',
   'Diagnosis is viral infection. Patient name is Hema Sharma. Prescribed paracetamol 500 mg twice daily. Age 22 years. Complains of fever and cough. Address is Sector 12, Dwarka. Remarks: Follow up after three days. Gender female. Medical history of diabetes. Contact number 9876543210. PIN code 110078.',
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', pinCode: '110078',
     contactNumber: '9876543210', diagnosis: 'Viral infection', medicalHistory: 'Diabetes' }],

  ['R3 conversational',
   "This is Hema Sharma, a 22-year-old female. She has been complaining of fever, cough, and headache for the last three days. She is a known diabetic. She lives in Sector 12, Dwarka, New Delhi, PIN code 110078. Her contact number is 9876543210. It looks like a viral infection. I'll prescribe paracetamol 500 mg twice daily and advise her to get blood tests done.",
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', pinCode: '110078',
     contactNumber: '9876543210', diagnosis: 'Viral infection' }],

  ['R4 natural consult',
   "Good morning. The patient's name is Hema Sharma. She's 22 years old. She's been running a fever since Monday and also has a persistent cough and headache. She is diabetic. I think this is most likely a viral infection. Please start her on paracetamol twice daily. She stays in Sector 12, Dwarka, New Delhi, PIN code 110078. Her phone number is 9876543210. Ask her to come back after three days with blood reports.",
   { patientName: 'Hema Sharma', age: '22 Years', pinCode: '110078',
     contactNumber: '9876543210', diagnosis: 'Viral infection',
     prescriptionNotes: ['Paracetamol twice daily'] }],

  ['R5 fillers',
   "Okay... so... um... the patient's name is Hema Sharma. She's, uh, around 22 years old. Female. She lives in Sector 12, Dwarka, New Delhi. PIN code 110078. Her contact number is 9876543210. She's been having fever, cough, and headache. She is actually a known diabetic. I think it's probably a viral infection. Let's start paracetamol twice a day. We'll also advise blood tests.",
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', pinCode: '110078',
     contactNumber: '9876543210', diagnosis: 'Viral infection',
     symptoms: ['Fever', 'Cough', 'Headache'] }],

  ['R6 self-correction',
   'Patient name is Hema Sharma. Age 32 years... sorry, 22 years. Contact number 9876543218... correction, 9876543210. Diagnosis is bacterial infection... actually no, viral infection. Prescribe paracetamol twice daily. Address is Sector 12, Dwarka, New Delhi, PIN code 110078. She is diabetic. Complains of fever, cough, and headache.',
   { patientName: 'Hema Sharma', age: '22 Years', contactNumber: '9876543210',
     diagnosis: 'Viral infection' }],

  ['R7 address last',
   "The patient is Hema Sharma. Female. She's 22 years old. Complains of fever and cough. Medical history of diabetes. Viral infection is the diagnosis. Start paracetamol 500 mg twice daily. Her contact number is 9876543210. She lives at Sector 12, Dwarka, New Delhi, PIN code 110078.",
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female',
     contactNumber: '9876543210', pinCode: '110078', medicalHistory: 'Diabetes',
     symptoms: ['Fever', 'Cough'] }],

  ['R8 synonyms',
   "The patient is Hema Sharma. She's a 22-year-old woman. She resides at Sector 12, Dwarka, New Delhi. Postal code 110078. She can be reached on 9876543210. She reports fever, headache, and cough. She is a known case of diabetes mellitus. My impression is viral fever. Put her on paracetamol twice daily. Review after blood investigations.",
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', pinCode: '110078',
     contactNumber: '9876543210', diagnosis: 'Viral fever',
     medicalHistory: 'Diabetes mellitus', symptoms: ['Fever', 'Headache', 'Cough'] }],

  ['R9 hinglish',
   'Patient ka naam Hema Sharma hai. Age 22 years. Female patient hai. Address Sector 12, Dwarka, New Delhi. PIN code 110078. Contact number 9876543210. Fever aur cough hai, headache bhi hai. Patient diabetic hai. Diagnosis viral infection lag raha hai.',
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', pinCode: '110078',
     contactNumber: '9876543210' }],

  ['R11 missing fields stay null',
   'Patient name is Hema Sharma. Age 22 years. Complains of fever and cough. Diagnosis is viral infection. Prescribed paracetamol twice daily.',
   { patientName: 'Hema Sharma', age: '22 Years', diagnosis: 'Viral infection',
     symptoms: ['Fever', 'Cough'], gender: null, address: null, pinCode: null,
     contactNumber: null, medicalHistory: null, additionalRemarks: null }],

  ['R12 many symptoms',
   'Patient name is Hema Sharma. Age 22 years. Complains of fever, chills, sore throat, body ache, headache, dry cough, nausea, weakness, and fatigue. Diagnosis is influenza. Prescribed oseltamivir and paracetamol. Medical history of diabetes and hypertension.',
   { patientName: 'Hema Sharma', age: '22 Years', diagnosis: 'Influenza',
     medicalHistory: 'Diabetes and hypertension',
     symptoms: ['Fever', 'Chills', 'Sore throat', 'Body ache', 'Headache', 'Dry cough', 'Nausea', 'Weakness', 'Fatigue'] }],

  ['R13 long clinical',
   "The patient's name is Hema Sharma, a 22-year-old female. She presented today with complaints of fever, persistent cough, headache, generalized body ache, and weakness for the past four days. She denies chest pain or shortness of breath. She is a known diabetic and has been taking metformin regularly. On examination, she appears clinically stable. My provisional diagnosis is viral upper respiratory tract infection. I am prescribing paracetamol 500 milligrams twice daily after food, encouraging oral fluids and adequate rest. She resides at Sector 12, Dwarka, New Delhi, PIN code 110078. Her contact number is 9876543210. She has been advised to undergo CBC and CRP investigations and return for review after three days.",
   { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', pinCode: '110078',
     contactNumber: '9876543210',
     diagnosis: 'Viral upper respiratory tract infection' }],

  ['R14 repeated fields',
   'Patient name is Hema Sharma. Age 21 years... actually 22 years. Contact number 9876543211... no, use 9876543210. She lives in Delhi... more specifically Sector 12, Dwarka, New Delhi. Diagnosis initially looked bacterial but after examination it appears viral. Start paracetamol twice daily.',
   { patientName: 'Hema Sharma', age: '22 Years', contactNumber: '9876543210' }],

  ['R15 free-flowing',
   "This is Hema Sharma. She came in today because she's been feeling unwell for about three days with fever, cough, headache, and weakness. She's only twenty-two and has diabetes, which she's managing with medication. I don't think it's anything serious—it appears to be a viral infection. I'll prescribe paracetamol twice daily, ask her to stay hydrated, and get a CBC done. She lives in Sector 12, Dwarka, New Delhi, PIN code 110078, and her contact number is 9876543210. I'd like to see her again in three days.",
   { patientName: 'Hema Sharma', age: '22 Years', pinCode: '110078',
     contactNumber: '9876543210', diagnosis: 'Viral infection' }],
];

for (const [label, transcript, expected] of REALISTIC) {
  expectFields(label, transcript, expected);
}

for (const [label, transcript] of REALISTIC) {
  const record = extractPatientFields(transcript);
  for (const [key, field] of Object.entries(record)) {
    if (!field || Array.isArray(field.value)) {
      continue;
    }
    check(`${label} → ${key} no sentence bleed`, /\.\s+[A-Z]/.test(field.value), false);
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failures.length) {
  console.log('FAILURES:\n' + failures.join('\n\n'));
  process.exit(1);
}
