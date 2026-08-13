import { extractForReport } from '../src/services/extractionService.js';
import { joinTranslated } from '../src/services/pravah/chunkText.js';

import { check, report } from './lib/fixture-harness.mjs';

const valueOf = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join(' ') : String(raw ?? '');
};

const holds = (record, field, fragment) =>
  valueOf(record, field).toLowerCase().includes(String(fragment).toLowerCase());

const CASES = {
  patientName: [
    ['plain', 'The patient name is Sunita Devi.', 'Sunita Devi'],
    ['possessive', "The patient's name is Sunita Devi.", 'Sunita Devi'],
    ['dropped article', 'Name of patient is Sunita Devi.', 'Sunita Devi'],
    ['name is', 'Her name is Sunita Devi.', 'Sunita Devi'],
    ['appositive (known gap)', 'Patient Sunita Devi has come today.', 'Sunita Devi'],
    ['named', 'A patient named Sunita Devi came to the clinic.', 'Sunita Devi'],
  ],
  age: [
    ['plain', 'Age is 35 years.', '35'],
    ['n-year-old', 'She is a 35 year old woman.', '35'],
    ['of age', 'The patient is 35 years of age.', '35'],
    ['spelled out', 'Age is thirty five years.', '35'],
    ['inline', 'Sunita Devi, age 35 years, came to the clinic.', '35'],
  ],
  gender: [
    ['explicit', 'Gender is female.', 'female'],
    ['sex', 'Sex is female.', 'female'],
    ['pronoun only', 'She is 35 years old.', 'female'],
  ],
  address: [
    ['plain', 'Address is Cuttack, Odisha.', 'Cuttack'],
    ['resides', 'The patient resides at Cuttack, Odisha.', 'Cuttack'],
    ['lives in', 'She lives in Cuttack, Odisha.', 'Cuttack'],
    ['hails from', 'She hails from Cuttack, Odisha.', 'Cuttack'],
    ['label form (known gap)', 'Residence - Cuttack, Odisha.', 'Cuttack'],
  ],
  pinCode: [
    ['plain', 'PIN code is 751024.', '751024'],
    ['pincode', 'Pincode is 751024.', '751024'],
    ['label dropped', 'PIN 751024.', '751024'],
    ['standalone digits', 'Cuttack, Odisha. 751024.', '751024'],
    ['inside an address sentence (known gap)', 'Address is Cuttack, Odisha 751024.', '751024'],
  ],
  contactNumber: [
    ['plain', 'Contact number is 9876543210.', '9876543210'],
    ['mobile', 'Mobile number is 9876543210.', '9876543210'],
    ['label dropped', 'Phone 9876543210.', '9876543210'],
    ['number is', 'Her number is 9876543210.', '9876543210'],
    ['reflowed digits', 'Contact number is 98765 43210.', '9876543210'],
  ],
  symptoms: [
    ['complains of', 'The patient complains of fever and cough.', 'fever'],
    ['durative calque', 'The patient is having fever since three days.', 'fever'],
    ['suffering from', 'She is suffering from fever and cough.', 'fever'],
    ['has been having', 'She has been having fever for three days.', 'fever'],
    ['singular complaint', 'Complaint of fever and body ache.', 'fever'],
    ['presents with', 'The patient presents with fever and cough.', 'fever'],
    ['experiencing', 'She is experiencing fever and weakness.', 'fever'],
    ['existential', 'Fever and cough for three days is there.', 'fever'],
  ],
  medicalHistory: [
    ['history of', 'History of diabetes since five years.', 'diabetes'],
    ['past medical', 'Past medical history is diabetes.', 'diabetes'],
    ['known case', 'She is a known case of diabetes.', 'diabetes'],
    ['bare condition', 'The patient is diabetic.', 'diabetic'],
    ['negative', 'No significant medical history.', 'no significant medical history'],
  ],
  diagnosis: [
    ['plain', 'Diagnosis is viral fever.', 'viral fever'],
    ['diagnosed with', 'She is diagnosed with viral fever.', 'viral fever'],
    ['impression', 'Impression is viral fever.', 'viral fever'],
    ['appears', 'This appears to be viral fever.', 'viral fever'],
    ['suggestive', 'Findings are suggestive of viral fever.', 'viral fever'],
    ['seems like', 'It seems like viral fever.', 'viral fever'],
  ],
  prescriptionNotes: [
    ['prescribed', 'Prescribed paracetamol 500 mg twice a day.', 'paracetamol'],
    ['medication is', 'Medication is paracetamol 500 mg.', 'paracetamol'],
    ['started on', 'I have started her on paracetamol 500 mg.', 'paracetamol'],
    ['give her', 'Give her paracetamol 500 mg twice a day.', 'paracetamol'],
    ['medicine given', 'Medicine paracetamol 500 mg given.', 'paracetamol'],
    ['told to take', 'Paracetamol 500 mg told to take twice a day.', 'paracetamol'],
  ],
  additionalRemarks: [
    ['advice', 'Advice is to take rest and drink fluids.', 'rest'],
    ['should', 'She should take rest for three days.', 'rest'],
    ['tell her', 'Tell her to take rest.', 'rest'],
    ['follow up', 'Follow up after three days.', 'follow'],
  ],
};

const FLOOR = {
  patientName: 5,
  age: 5,
  gender: 3,
  address: 4,
  pinCode: 4,
  contactNumber: 5,
  symptoms: 8,
  medicalHistory: 5,
  diagnosis: 6,
  prescriptionNotes: 6,
  additionalRemarks: 4,
};

const rows = [];

for (const [field, cases] of Object.entries(CASES)) {
  let hits = 0;
  const missed = [];

  for (const [label, mt, expected] of cases) {
    const record = extractForReport(mt).record;
    if (holds(record, field, expected)) {
      hits += 1;
    } else {
      missed.push(label);
    }
  }

  rows.push({ field, hits, total: cases.length, missed });
  check(
    `TX1 ${field} recall ${hits}/${cases.length} meets floor ${FLOOR[field]}`,
    hits >= FLOOR[field],
    true,
  );
}

const CONSULTATION = joinTranslated([
  'The patient name is Sunita Devi.',
  'Age is 35 years. Gender is female.',
  'Address is Mangalabag, Cuttack, Odisha. PIN code is 753001.',
  'Contact number is 9437012345.',
  'The patient is having fever and body ache since three days.',
  'History of diabetes since five years.',
  'Diagnosis is viral fever.',
  'Prescribed paracetamol 500 mg twice a day.',
  'Advice is to take rest and drink plenty of fluids.',
]);

{
  const record = extractForReport(CONSULTATION).record;

  check('TX2.1 patient name', holds(record, 'patientName', 'Sunita'), true);
  check('TX2.2 age', holds(record, 'age', '35'), true);
  check('TX2.3 gender', holds(record, 'gender', 'female'), true);
  check('TX2.4 address', holds(record, 'address', 'Cuttack'), true);
  check('TX2.5 pin code', holds(record, 'pinCode', '753001'), true);
  check('TX2.6 contact number', holds(record, 'contactNumber', '9437012345'), true);
  check('TX2.7 symptoms', holds(record, 'symptoms', 'fever'), true);
  check('TX2.8 medical history', holds(record, 'medicalHistory', 'diabetes'), true);
  check('TX2.9 diagnosis', holds(record, 'diagnosis', 'viral fever'), true);
  check(
    'TX2.10 prescription notes',
    holds(record, 'prescriptionNotes', 'paracetamol'),
    true,
  );

  const captured = [
    'patientName',
    'age',
    'gender',
    'address',
    'pinCode',
    'contactNumber',
    'symptoms',
    'medicalHistory',
    'diagnosis',
    'prescriptionNotes',
  ].filter(field => valueOf(record, field));

  check(
    'TX2.11 every mandatory field is captured from a full translation',
    captured.length,
    10,
  );
}

{
  const joined = joinTranslated([
    'Diagnosis is viral fever.',
    'Prescribed paracetamol 500 mg.',
  ]);
  check('TX3.1 no fused seam', /\.\S/.test(joined), false);

  const record = extractForReport(joined).record;
  check('TX3.2 diagnosis survives the seam', holds(record, 'diagnosis', 'viral fever'), true);
  check(
    'TX3.3 prescription survives the seam',
    holds(record, 'prescriptionNotes', 'paracetamol'),
    true,
  );
}

{
  const joined = joinTranslated(['Diagnosis is viral fever.', '', 'Age is 35 years.']);
  const record = extractForReport(joined).record;
  check('TX3.4 a blank chunk does not break reassembly', holds(record, 'age', '35'), true);
  check('TX3.5 nor the field before it', holds(record, 'diagnosis', 'viral fever'), true);
}

const width = Math.max(...rows.map(row => row.field.length));
console.log('\nTranslated-extraction recall\n');
for (const row of rows) {
  const bar = row.hits === row.total ? 'ok  ' : 'gap ';
  console.log(
    `  ${bar} ${row.field.padEnd(width)}  ${row.hits}/${row.total}` +
      (row.missed.length ? `   missed: ${row.missed.join(', ')}` : ''),
  );
}

const totalHits = rows.reduce((sum, row) => sum + row.hits, 0);
const totalCases = rows.reduce((sum, row) => sum + row.total, 0);
console.log(`\n  overall ${totalHits}/${totalCases}\n`);

report();
