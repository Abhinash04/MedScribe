/**
 * Numeric normalization fixtures.
 *
 *   node scripts/test-extraction-numeric.mjs
 *
 * Speech recognisers group digits arbitrarily — "11 00 70", "955 677 4130",
 * "+91-9556-774130" — and the underlying number must survive the grouping.
 * The negative assertions matter as much as the positive ones: a dosage, a
 * duration or an age must never be read as a PIN or a phone number.
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

// ── 1. PIN grouping ─────────────────────────────────────────────────────────
const PIN_FORMS = [
  '110070',
  '110 070',
  '1100 70',
  '11 0070',
  '11 00 70',
  '1 10 070',
  '1 1 0 0 7 0',
];
for (const form of PIN_FORMS) {
  expectFields(
    `N1 PIN "${form}"`,
    `Patient lives in Delhi. PIN code is ${form}.`,
    { pinCode: '110070' },
  );
}

expectFields('N1.8 pincode spelling', 'Pincode 110 070.', { pinCode: '110070' });
expectFields('N1.9 postal code', 'Postal code is 11 00 70.', { pinCode: '110070' });

// ── 2. Phone grouping ───────────────────────────────────────────────────────
const PHONE_FORMS = [
  '9556774130',
  '955 677 4130',
  '9556 774130',
  '95567 74130',
  '955677 4130',
  '95 56 77 41 30',
  '9 5 5 6 7 7 4 1 3 0',
  '9556-774130',
  '95567-74130',
  '955 677-4130',
];
for (const form of PHONE_FORMS) {
  expectFields(`N2 phone "${form}"`, `Contact number is ${form}.`, {
    contactNumber: '9556774130',
  });
}

// ── 3. Indian country code ──────────────────────────────────────────────────
const CC_FORMS = [
  '+919556774130',
  '+91 9556774130',
  '+91 955 677 4130',
  '+91 9556 774130',
  '+91-9556774130',
  '+91-9556-774130',
  '91 9556774130',
  '91 955 677 4130',
];
for (const form of CC_FORMS) {
  expectFields(`N3 country code "${form}"`, `Mobile number is ${form}.`, {
    contactNumber: '9556774130',
  });
}

// ── 4. Spoken digits ────────────────────────────────────────────────────────
expectFields('N4.1 spoken PIN', 'PIN code one one zero zero seven zero.', {
  pinCode: '110070',
});

expectFields(
  'N4.2 spoken phone',
  'Phone number nine five five six seven seven four one three zero.',
  { contactNumber: '9556774130' },
);

expectFields(
  'N4.3 spoken country code',
  'Phone number plus nine one nine five five six seven seven four one three zero.',
  { contactNumber: '9556774130' },
);

// ── 5. PIN and phone in one transcript ──────────────────────────────────────
expectFields(
  'N5.1 grouped PIN then grouped phone',
  'Patient lives in Delhi, PIN code 11 00 70. Contact number 955 677 4130.',
  { pinCode: '110070', contactNumber: '9556774130' },
);

expectFields(
  'N5.2 phone then PIN',
  'Contact number 95567 74130. PIN code 1100 70.',
  { pinCode: '110070', contactNumber: '9556774130' },
);

// ── 6. Numbers that must NOT become PIN or phone ────────────────────────────
expectFields(
  'N6.1 dosage and duration',
  'Prescribed Paracetamol 500 milligrams twice daily for 5 days.',
  { pinCode: null, contactNumber: null, age: null },
);

expectFields('N6.2 age alone', 'Age is 35 years.', {
  age: '35 Years',
  pinCode: null,
  contactNumber: null,
});

expectFields(
  'N6.3 age does not feed the numeric fields',
  'Patient name is Rahul Sharma. Age is 35 years. Gender is male.',
  { age: '35 Years', pinCode: null, contactNumber: null },
);

expectFields(
  'N6.4 dosage list stays a prescription',
  'Prescription notes: Paracetamol 650 milligrams twice daily for three days.',
  {
    prescriptionNotes: ['Paracetamol 650 milligrams twice daily for three days'],
    pinCode: null,
    contactNumber: null,
  },
);

// Digits either side of a sentence boundary must never be concatenated.
const across = extractPatientFields('PIN code is 110070. Contact number is 9556774130.');
check(
  'N6.5 PIN not merged with the following phone',
  valueOf(across.pinCode),
  '110070',
);
check(
  'N6.5 phone not merged with the preceding PIN',
  valueOf(across.contactNumber),
  '9556774130',
);

// ── 7. Raw transcript is never rewritten ────────────────────────────────────
const RAW = 'PIN code is 11 00 70. Contact number is 955 677 4130.';
const before = RAW;
extractPatientFields(RAW);
check('N7 transcript unchanged by extraction', RAW, before);

report();
