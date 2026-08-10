
import { PATIENT_FIELDS } from '../src/constants/patientFields.js';
import { blockingFields, validateReportCompleteness } from '../src/services/reportCompleteness.js';
import { missingFieldPrompt, SPOKEN_FIELD_LIMIT } from '../src/services/missingFieldPrompt.js';
import { toDraft } from '../src/services/reportDraft.js';

import { check, report } from './lib/fixture-harness.mjs';

const field = key => {
  const found = PATIENT_FIELDS.find(item => item.key === key);
  return { key: found.key, label: found.label };
};

const promptFor = (...keys) => missingFieldPrompt(keys.map(field));

check('S1.1 no fields produces no prompt', missingFieldPrompt([]), '');
check('S1.2 null is safe', missingFieldPrompt(null), '');
check('S1.3 undefined is safe', missingFieldPrompt(undefined), '');

check(
  'S2.1 one field is singular throughout',
  promptFor('patientName'),
  'The patient name is still missing. Please provide this mandatory detail.',
);

check(
  'S2.2 two fields join with "and"',
  promptFor('patientName', 'contactNumber'),
  'The patient name and contact number are still missing. Please provide these mandatory details.',
);

check(
  'S2.3 three fields comma-separate then "and"',
  promptFor('patientName', 'contactNumber', 'pinCode'),
  'The patient name, contact number and PIN code are still missing. ' +
    'Please provide these mandatory details.',
);

check(
  'S2.4 four fields still name every one',
  promptFor('patientName', 'contactNumber', 'pinCode', 'age'),
  'The patient name, contact number, PIN code and age are still missing. ' +
    'Please provide these mandatory details.',
);

check(
  'S3.1 five fields name four and count the rest',
  promptFor('patientName', 'contactNumber', 'pinCode', 'age', 'gender'),
  'The patient name, contact number, PIN code, age, and 1 other mandatory detail ' +
    'are still missing. Please provide the missing information.',
);

check(
  'S3.2 seven fields pluralise the remainder',
  promptFor('patientName', 'contactNumber', 'pinCode', 'age', 'gender', 'address', 'diagnosis'),
  'The patient name, contact number, PIN code, age, and 3 other mandatory details ' +
    'are still missing. Please provide the missing information.',
);

{
  const all = PATIENT_FIELDS.filter(item => item.required).map(item => item.key);
  const spoken = missingFieldPrompt(all.map(field));
  check('S3.3 every required field missing still yields one sentence', spoken.split('.').length, 3);
  const named = spoken.split(', and ')[0].replace(/^The /, '').split(', ');
  check(`S3.4 and names exactly ${SPOKEN_FIELD_LIMIT}`, named.length, SPOKEN_FIELD_LIMIT);
  check(
    'S3.4b the fifth required field is not named aloud',
    spoken.includes(PATIENT_FIELDS.filter(item => item.required)[4].label.toLowerCase()),
    false,
  );
  check(
    'S3.5 announcing the other 6',
    spoken.includes(`${all.length - SPOKEN_FIELD_LIMIT} other mandatory details`),
    true,
  );
}

check('S4.1 PIN Code keeps its acronym', promptFor('pinCode').includes('PIN code'), true);
check(
  'S4.2 titles are otherwise lowered',
  promptFor('diagnosis'),
  'The diagnosis is still missing. Please provide this mandatory detail.',
);
check(
  'S4.2b including inside a list',
  promptFor('symptoms', 'medicalHistory').includes('symptoms and medical history'),
  true,
);
check(
  'S4.3 order follows the report, not the caller',
  promptFor('diagnosis', 'patientName'),
  'The diagnosis and patient name are still missing. Please provide these mandatory details.',
);

{
  const VALUES = {
    patientName: 'Rohit Mehta',
    age: '46 Years',
    gender: 'Male',
    address: '12 Nehru Road, Pune',
    pinCode: '411001',
    contactNumber: '9876543210',
    diagnosis: 'Viral fever',
  };

  const record = Object.fromEntries(
    Object.entries(VALUES).map(([key, value]) => [
      key,
      { value, confidence: 0.95, source: 'test' },
    ]),
  );

  const draft = toDraft(record, []);
  const spoken = missingFieldPrompt(blockingFields(validateReportCompleteness(draft)));

  check('S5.1 the remaining fields are still named', spoken.length > 0, true);
  for (const [key, value] of Object.entries(VALUES)) {
    check(`S5.2 "${value}" (${key}) never reaches the prompt`, spoken.includes(value), false);
  }
  
  check('S5.3 no digit from any value appears', /\d/.test(spoken.replace(/\d+ other/, '')), false);
}

report();