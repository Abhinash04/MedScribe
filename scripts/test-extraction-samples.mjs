/**
 * The twenty supplied dictation samples.
 *
 *   node scripts/test-extraction-samples.mjs
 *
 * Real dictation shapes from the field. Every field a sample states is
 * asserted with its exact expected value; a field a sample never mentions is
 * asserted null, so a stray value cannot pass unnoticed.
 */
import { extractPatientFields } from '../src/services/extractionService.js';

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
  'S1 standard',
  'Patient name is Rahul Sharma. Age is 34 years. Gender is male. Address is House 24, Sector 10, Noida, Uttar Pradesh. PIN code is 201301. Contact number is 9876543210. Symptoms are fever, dry cough, headache, and weakness for the past three days. Medical history includes diabetes. Diagnosis is viral fever. Prescription notes: Paracetamol 500 milligrams twice daily for five days and cough syrup twice daily. Additional remarks: Drink plenty of water, take adequate rest, and return for review after three days.',
  {
    patientName: 'Rahul Sharma',
    age: '34 Years',
    gender: 'Male',
    pinCode: '201301',
    contactNumber: '9876543210',
    medicalHistory: 'Diabetes',
    diagnosis: 'Viral fever',
  },
);

expectFields(
  'S2 diagnosis first',
  'Diagnosis is common cold. Prescription notes: Paracetamol 500 milligrams twice daily and cough syrup at night for three days. Patient name is Priya Verma. Contact number is 9812345678. She is 27 years old and female. Symptoms include runny nose, mild fever, sneezing, and sore throat. Medical history includes asthma. She lives at House 18, Rohini Sector 7, New Delhi. PIN code is 110085. Additional remarks: Take steam twice daily, drink warm fluids, and return after five days if symptoms continue.',
  {
    patientName: 'Priya Verma',
    age: '27 Years',
    gender: 'Female',
    pinCode: '110085',
    contactNumber: '9812345678',
    medicalHistory: 'Asthma',
    diagnosis: 'Common cold',
  },
);

expectFields(
  'S3 conversational',
  'This is Amit Kumar. He is 42 years old. He has been having fever, body pain, headache, and tiredness since yesterday. He is a known diabetic. He lives at Flat 12, Green Park, New Delhi, PIN code 110016, and his phone number is 9898765432. He is male. It looks like viral fever. I am prescribing Paracetamol 650 milligrams twice daily for three days and vitamin tablets once daily. Additional remarks: He should drink plenty of fluids, take complete rest, and come back after three days.',
  {
    patientName: 'Amit Kumar',
    age: '42 Years',
    gender: 'Male',
    pinCode: '110016',
    contactNumber: '9898765432',
    diagnosis: 'Viral fever',
  },
);

expectFields(
  'S4 symptoms first',
  'The patient complains of stomach pain, nausea, loose motion, and weakness since morning. Her name is Neha Singh. She is 31 years old and female. She lives at House 45, Gomti Nagar, Lucknow, Uttar Pradesh. PIN code is 226010. Her contact number is 9765432108. Medical history includes high blood pressure. Diagnosis is stomach infection. Prescription notes: ORS after every loose motion and Paracetamol 500 milligrams if fever develops. Additional remarks: Drink plenty of clean water, eat light food, and return tomorrow if the condition gets worse.',
  {
    patientName: 'Neha Singh',
    age: '31 Years',
    gender: 'Female',
    pinCode: '226010',
    contactNumber: '9765432108',
    medicalHistory: 'High blood pressure',
    diagnosis: 'Stomach infection',
  },
);

expectFields(
  'S5 indian style',
  'Patient name Arjun Patel. Age 38 years. Male patient. Address Flat 21, Satellite Road, Ahmedabad, Gujarat. PIN code 380015. Mobile number 9823456710. Complains of fever, cough, cold, headache, and weakness for two days. Known diabetic. Diagnosis looks like viral infection. Give Paracetamol 500 milligrams twice daily for five days and cough syrup three times daily. Additional remarks: Plenty of fluids, proper rest, and review after three days.',
  {
    patientName: 'Arjun Patel',
    age: '38 Years',
    gender: 'Male',
    pinCode: '380015',
    contactNumber: '9823456710',
    diagnosis: 'Viral infection',
  },
);

expectFields(
  'S6 female pronoun inference',
  "The patient's name is Sneha Gupta. She is 29 years old and lives at House 14, Civil Lines, Jaipur, Rajasthan. Her PIN code is 302006 and her contact number is 9712345680. She has been complaining of headache, fever, sore throat, and dry cough for the past two days. Her medical history includes asthma. My diagnosis is throat infection. Prescription notes: Paracetamol 500 milligrams twice daily and cough syrup twice daily for five days. Additional remarks: She should drink warm water, take steam, avoid cold drinks, and return after four days.",
  {
    patientName: 'Sneha Gupta',
    age: '29 Years',
    gender: 'Female',
    pinCode: '302006',
    contactNumber: '9712345680',
    medicalHistory: 'Asthma',
    diagnosis: 'Throat infection',
  },
);

expectFields(
  'S7 male pronoun inference',
  'Patient name is Rohit Mehta. He is 46 years old. He resides at House 32, Vasant Nagar, Nagpur, Maharashtra, PIN code 440010. His contact number is 9867123450. He reports back pain, stiffness, and difficulty bending for the past five days. His medical history includes high blood pressure. Diagnosis is muscle strain. Prescription notes: Paracetamol 500 milligrams twice daily for three days and apply pain relief gel twice daily. Additional remarks: He should avoid lifting heavy objects, take adequate rest, and return after one week.',
  {
    patientName: 'Rohit Mehta',
    age: '46 Years',
    gender: 'Male',
    pinCode: '440010',
    contactNumber: '9867123450',
    medicalHistory: 'High blood pressure',
    diagnosis: 'Muscle strain',
  },
);

expectFields(
  'S8 prescription first',
  'Prescription notes: Paracetamol 500 milligrams twice daily for five days and ORS twice daily. Patient name is Kavita Rao. She is 36 years old and female. Her address is Flat 8, Lake View Road, Bhopal, Madhya Pradesh. PIN code is 462016. Contact number is 9753102468. Symptoms include fever, vomiting, weakness, and stomach pain. Medical history includes thyroid problems. Diagnosis is stomach infection. Additional remarks: Take light meals, drink enough water, and return after two days if vomiting continues.',
  {
    patientName: 'Kavita Rao',
    age: '36 Years',
    gender: 'Female',
    pinCode: '462016',
    contactNumber: '9753102468',
    medicalHistory: 'Thyroid problems',
    diagnosis: 'Stomach infection',
  },
);

expectFields(
  'S9 history first',
  'Medical history includes diabetes and high blood pressure. The patient is Sanjay Yadav. He is 55 years old and male. His contact number is 9810765432. His address is House 67, Indira Nagar, Kanpur, Uttar Pradesh, PIN code 208026. He complains of headache, dizziness, weakness, and tiredness. Diagnosis is high blood pressure. Prescription notes: Continue regular blood pressure medicine and take Paracetamol 500 milligrams if headache continues. Additional remarks: Check blood pressure twice daily, reduce salt intake, and return after five days.',
  {
    patientName: 'Sanjay Yadav',
    age: '55 Years',
    gender: 'Male',
    pinCode: '208026',
    contactNumber: '9810765432',
    medicalHistory: 'Diabetes and high blood pressure',
    diagnosis: 'High blood pressure',
  },
);

expectFields(
  'S10 free flowing',
  'This is Pooja Nair, she is 25 years old and female. She stays at Flat 16, MG Road, Kochi, Kerala, PIN code 682016, and her mobile number is 9846123570. She came in with fever, sore throat, headache, and weakness for the last three days. She has a history of asthma. I think this is a viral throat infection. Start Paracetamol 500 milligrams twice daily and cough syrup twice daily for four days. Additional remarks: Drink warm fluids, take steam inhalation, rest properly, and come back after four days.',
  {
    patientName: 'Pooja Nair',
    age: '25 Years',
    gender: 'Female',
    pinCode: '682016',
    contactNumber: '9846123570',
    medicalHistory: 'Asthma',
  },
);

expectFields(
  'S11 self correction',
  'Patient name is Mohit Jain. Age is 45 years, sorry, correction, age is 35 years. Gender is male. Address is House 11, Malviya Nagar, Jaipur, Rajasthan. PIN code is 302017. Contact number is 9876501234, correction, contact number is 9876501243. Symptoms are fever, cough, headache, and body pain. Medical history includes diabetes. Diagnosis is bacterial infection, actually correction, diagnosis is viral infection. Prescription notes: Paracetamol 500 milligrams twice daily for five days and cough syrup at night. Additional remarks: Take adequate rest, drink plenty of water, and review after three days.',
  {
    patientName: 'Mohit Jain',
    age: '35 Years',
    gender: 'Male',
    pinCode: '302017',
    contactNumber: '9876501243',
    medicalHistory: 'Diabetes',
    diagnosis: 'Viral infection',
  },
);

expectFields(
  'S12 formal clinical',
  'Patient identified as Anjali Das. Gender female. Age 40 years. Residential address is House 28, Salt Lake, Kolkata, West Bengal. Postal code is 700091. Contact number is 9831024567. Presenting symptoms include fever, productive cough, headache, and tiredness for four days. Past medical history includes asthma. Clinical diagnosis is chest infection. Prescription notes include Paracetamol 500 milligrams twice daily and cough syrup three times daily for five days. Additional remarks: Steam inhalation is advised, along with adequate hydration and follow-up after five days.',
  {
    patientName: 'Anjali Das',
    age: '40 Years',
    gender: 'Female',
    pinCode: '700091',
    contactNumber: '9831024567',
    medicalHistory: 'Asthma',
    diagnosis: 'Chest infection',
  },
);

expectFields(
  'S13 casual speech',
  "Okay, this is Deepak Mishra. He's 33 years old and male. He lives at House 15, Kankarbagh, Patna, Bihar. PIN code is 800020. His phone number is 9708123456. He's been having fever, cough, headache, and body pain for about three days. He has a history of asthma. Looks like viral fever to me. Give him Paracetamol 500 milligrams twice daily and cough syrup twice daily for three days. Additional remarks: Ask him to drink plenty of water, rest properly, and come back after three days if he is not improving.",
  {
    patientName: 'Deepak Mishra',
    age: '33 Years',
    gender: 'Male',
    pinCode: '800020',
    contactNumber: '9708123456',
    medicalHistory: 'Asthma',
  },
);

expectFields(
  'S14 negation challenge',
  'Patient name is Riya Kapoor. She is 24 years old and female. Her address is Flat 19, Sector 21, Chandigarh. PIN code is 160022. Contact number is 9872013456. She complains of fever, headache, sore throat, and dry cough. She has no chest pain and no breathing difficulty. Her medical history includes asthma, with no history of diabetes or high blood pressure. Diagnosis is viral throat infection. Prescription notes: Paracetamol 500 milligrams twice daily and cough syrup at night for five days. Additional remarks: Drink warm water, take steam twice daily, and return after five days.',
  {
    patientName: 'Riya Kapoor',
    age: '24 Years',
    gender: 'Female',
    pinCode: '160022',
    contactNumber: '9872013456',
    symptoms: ['Fever', 'Headache', 'Sore throat', 'Dry cough'],
    diagnosis: 'Viral throat infection',
  },
);

expectFields(
  'S15 comprehensive',
  "The patient's name is Vikram Joshi. He is a 48-year-old male residing at House 36, Baner Road, Pune, Maharashtra. PIN code is 411045 and his contact number is 9823014567. He presented today with fever, dry cough, headache, body pain, weakness, tiredness, and loss of appetite for the past four days. He has a medical history of diabetes and high blood pressure. Based on the symptoms and examination, my diagnosis is viral infection. I am prescribing Paracetamol 650 milligrams twice daily after food for five days, cough syrup twice daily, and vitamin tablets once daily. Additional remarks: Drink plenty of water, take adequate rest, check temperature regularly, and return for follow-up after three days. If the fever increases or breathing becomes difficult, seek medical attention immediately.",
  {
    patientName: 'Vikram Joshi',
    age: '48 Years',
    gender: 'Male',
    pinCode: '411045',
    contactNumber: '9823014567',
    diagnosis: 'Viral infection',
  },
);

expectFields(
  'S16 poor punctuation',
  'patient name is Meera Shah age 32 years female address house 27 river road Surat Gujarat pin code 395007 contact number 9825123406 she complains of fever cough headache sore throat and weakness medical history includes asthma diagnosis is viral fever prescription notes paracetamol 500 milligrams twice daily for five days and cough syrup twice daily additional remarks drink plenty of water take adequate rest and return after three days',
  {
    patientName: 'Meera Shah',
    age: '32 Years',
    gender: 'Female',
    pinCode: '395007',
    contactNumber: '9825123406',
    medicalHistory: 'Asthma',
    diagnosis: 'Viral fever',
  },
);

expectFields(
  'S17 out of order',
  'Additional remarks: Drink warm water and return after four days. Diagnosis is common cold. Contact number is 9873456120. Symptoms include sneezing, runny nose, headache, mild fever, and sore throat. Prescription notes: Paracetamol 500 milligrams twice daily and cough syrup at night for four days. Medical history includes asthma. PIN code is 122001. Patient name is Aman Gupta. Address is House 42, Sector 15, Gurugram, Haryana. Gender is male. Age is 30 years.',
  {
    patientName: 'Aman Gupta',
    age: '30 Years',
    gender: 'Male',
    pinCode: '122001',
    contactNumber: '9873456120',
    medicalHistory: 'Asthma',
    diagnosis: 'Common cold',
  },
);

expectFields(
  'S18 synonym heavy',
  'The patient is Nisha Verma. She is a 37-year-old woman. She resides at House 10, Shastri Nagar, Meerut, Uttar Pradesh. Postal code is 250004 and she can be reached on 9812345067. She presents with fever, cough, headache, sore throat, and tiredness. She is a known case of diabetes. My clinical impression is viral fever. Start her on Paracetamol 500 milligrams twice a day for five days and cough syrup at bedtime. Advice is to maintain good hydration, get sufficient rest, and come back for review after three days.',
  {
    patientName: 'Nisha Verma',
    age: '37 Years',
    gender: 'Female',
    pinCode: '250004',
    medicalHistory: 'Diabetes',
    diagnosis: 'Viral fever',
  },
);

expectFields(
  'S19 history vs symptoms vs diagnosis',
  'Patient name is Rajesh Kumar. Age is 52 years. Gender male. He lives at House 17, Ashok Nagar, Ranchi, Jharkhand, PIN code 834002. His mobile number is 9835124670. He is a known diabetic and has a history of high blood pressure. Today he presents with fever, cough, headache, and weakness. He has no vomiting and no chest pain. My diagnosis is viral fever. Prescription notes: Paracetamol 500 milligrams twice daily for five days and cough syrup twice daily. Additional remarks: Continue regular diabetes and blood pressure medicines, drink enough water, rest, and return after three days.',
  {
    patientName: 'Rajesh Kumar',
    age: '52 Years',
    gender: 'Male',
    pinCode: '834002',
    contactNumber: '9835124670',
    symptoms: ['Fever', 'Cough', 'Headache', 'Weakness'],
    diagnosis: 'Viral fever',
  },
);

expectFields(
  'S20 repetition without correction',
  'Patient name is Simran Kaur. She is 28 years old and female. She lives at House 25, Model Town, Ludhiana, Punjab. PIN code is 141002. Her contact number is 9876123450. She complains of fever, dry cough, headache, and weakness for two days. Her medical history includes asthma. Diagnosis is viral infection. Prescription notes: Paracetamol 500 milligrams twice daily for four days and cough syrup at night. Additional remarks: Take steam, drink warm fluids, rest properly, and review after four days. For confirmation, patient name is Simran Kaur, age 28 years, contact number 9876123450, and diagnosis is viral infection.',
  {
    patientName: 'Simran Kaur',
    age: '28 Years',
    gender: 'Female',
    pinCode: '141002',
    contactNumber: '9876123450',
    medicalHistory: 'Asthma',
    diagnosis: 'Viral infection',
  },
);

// ── Every sample must produce a prescription ────────────────────────────────
const RX_SAMPLES = [
  ['S1', 'Prescription notes: Paracetamol 500 milligrams twice daily for five days and cough syrup twice daily.'],
  ['S5', 'Give Paracetamol 500 milligrams twice daily for five days and cough syrup three times daily.'],
  ['S12', 'Prescription notes include Paracetamol 500 milligrams twice daily and cough syrup three times daily for five days.'],
  ['S17', 'Prescription notes: Paracetamol 500 milligrams twice daily and cough syrup at night for four days.'],
];
for (const [label, transcript] of RX_SAMPLES) {
  const value = valueOf(extractPatientFields(transcript).prescriptionNotes);
  check(`${label} → prescription is populated`, Array.isArray(value) && value.length > 0, true);
  check(
    `${label} → prescription names the drug`,
    (Array.isArray(value) ? value.join(' ').toLowerCase() : '').includes('paracetamol'),
    true,
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failures.length) {
  console.log('FAILURES:\n' + failures.join('\n\n'));
  process.exit(1);
}
