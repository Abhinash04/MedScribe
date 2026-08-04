/**
 * Report-completeness fixtures.
 *
 *   node scripts/test-completeness.mjs
 *
 * Ten fields must be answered before a report can be produced; Additional
 * Remarks must never block one. The negative assertions carry the weight here:
 * an empty optional field appearing in `missingFields` would stop a doctor from
 * finishing a perfectly complete consultation.
 */
import { extractPatientFields } from '../src/services/extractionService.js';
import {
  blockingFields,
  validateReportCompleteness,
} from '../src/services/reportCompleteness.js';
import {
  applyEdit,
  countRequiredFilled,
  mergeExtraction,
  toDraft,
} from '../src/services/reportDraft.js';

import { check, report } from './lib/fixture-harness.mjs';

const COMPLETE = {
  patientName: 'Rahul Sharma',
  age: '34 Years',
  gender: 'Male',
  address: 'House 24, Sector 10, Noida',
  pinCode: '201301',
  contactNumber: '9556774130',
  symptoms: ['Fever', 'Cough'],
  medicalHistory: 'Diabetes',
  diagnosis: 'Viral fever',
  prescriptionNotes: ['Paracetamol 500 mg twice daily'],
};

const draftOf = (values, confidence = 0.95) =>
  toDraft(
    Object.entries(values).reduce((acc, [key, value]) => {
      acc[key] = value === null ? null : { value, confidence, source: 'fixture' };
      return acc;
    }, {}),
  );

const without = (...keys) => {
  const copy = { ...COMPLETE };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
};

const keysOf = list => list.map(item => item.key);

const validateTranscript = transcript =>
  validateReportCompleteness(toDraft(extractPatientFields(transcript)));

// ── 1. Complete drafts ──────────────────────────────────────────────────────
const withRemarks = validateReportCompleteness(
  draftOf({ ...COMPLETE, additionalRemarks: 'Review after three days' }),
);
check('V1.1 ten mandatory plus remarks → allowed', withRemarks.isComplete, true);
check('V1.2 nothing optional left empty', withRemarks.optionalEmptyFields, []);

const emptyRemarks = validateReportCompleteness(
  draftOf({ ...COMPLETE, additionalRemarks: '' }),
);
check('V1.3 empty remarks → allowed', emptyRemarks.isComplete, true);
check(
  'V1.4 empty remarks is reported as optional, not missing',
  keysOf(emptyRemarks.optionalEmptyFields),
  ['additionalRemarks'],
);
check('V1.5 remarks never in missingFields', emptyRemarks.missingFields, []);

const nullRemarks = validateReportCompleteness(
  draftOf({ ...COMPLETE, additionalRemarks: null }),
);
check('V1.6 null remarks → allowed', nullRemarks.isComplete, true);

const absentEntry = draftOf(COMPLETE);
delete absentEntry.additionalRemarks;
check(
  'V1.7 remarks entry missing from the draft object → allowed',
  validateReportCompleteness(absentEntry).isComplete,
  true,
);

// ── 2. Missing mandatory fields ─────────────────────────────────────────────
const noContact = validateReportCompleteness(draftOf(without('contactNumber')));
check('V2.1 one mandatory missing → blocked', noContact.isComplete, false);
check('V2.2 the missing field is named', keysOf(noContact.missingFields), [
  'contactNumber',
]);

const noThree = validateReportCompleteness(
  draftOf(without('address', 'pinCode', 'contactNumber')),
);
check('V2.3 three missing → blocked', noThree.isComplete, false);
check('V2.4 exact list in display order', keysOf(noThree.missingFields), [
  'address',
  'pinCode',
  'contactNumber',
]);
check(
  'V2.5 an empty remarks field is not counted among them',
  keysOf(noThree.optionalEmptyFields),
  ['additionalRemarks'],
);

const noHistory = validateReportCompleteness(draftOf(without('medicalHistory')));
check('V2.6 medical history missing → blocked', noHistory.isComplete, false);
check('V2.7 history is named', keysOf(noHistory.missingFields), [
  'medicalHistory',
]);

const noPrescription = validateReportCompleteness(
  draftOf(without('prescriptionNotes')),
);
check('V2.8 prescription missing → blocked', noPrescription.isComplete, false);

const emptyList = validateReportCompleteness(
  draftOf({ ...COMPLETE, symptoms: [] }),
);
check('V2.9 an empty list is missing, not present', emptyList.isComplete, false);
check('V2.10 empty symptoms named', keysOf(emptyList.missingFields), ['symptoms']);

// ── 3. Present but invalid ──────────────────────────────────────────────────
const shortPhone = validateReportCompleteness(
  draftOf({ ...COMPLETE, contactNumber: '98765' }),
);
check('V3.1 invalid contact → blocked', shortPhone.isComplete, false);
check('V3.2 invalid, not missing', keysOf(shortPhone.invalidFields), [
  'contactNumber',
]);
check('V3.3 nothing missing', shortPhone.missingFields, []);

const shortPin = validateReportCompleteness(
  draftOf({ ...COMPLETE, pinCode: '1100' }),
);
check('V3.4 invalid PIN → blocked', shortPin.isComplete, false);
check('V3.5 PIN reported invalid', keysOf(shortPin.invalidFields), ['pinCode']);

const badAge = validateReportCompleteness(draftOf({ ...COMPLETE, age: 'abc' }));
check('V3.6 unparseable age → blocked', badAge.isComplete, false);

const badGender = validateReportCompleteness(
  draftOf({ ...COMPLETE, gender: 'Unknown' }),
);
check('V3.7 unsupported gender → blocked', badGender.isComplete, false);

const blocking = blockingFields(
  validateReportCompleteness(
    draftOf({ ...without('address'), contactNumber: '98765' }),
  ),
);
check('V3.8 missing and invalid are named together, in order', keysOf(blocking), [
  'address',
  'contactNumber',
]);

// ── 4. Uncertain values never block ─────────────────────────────────────────
const uncertain = validateReportCompleteness({
  ...draftOf(COMPLETE),
  gender: { value: 'Female', original: 'Female', confidence: 0.45, source: 'pronoun', edited: false },
});
check('V4.1 low confidence still generates', uncertain.isComplete, true);
check('V4.2 flagged for review', keysOf(uncertain.uncertainFields), ['gender']);

const editedUncertain = validateReportCompleteness({
  ...draftOf(COMPLETE),
  gender: { value: 'Male', original: 'Female', confidence: 0.45, source: 'pronoun', edited: true },
});
check(
  'V4.3 a value the doctor typed is not uncertain',
  editedUncertain.uncertainFields,
  [],
);

// ── 5. Manual editing ───────────────────────────────────────────────────────
const typed = applyEdit(draftOf(without('contactNumber')), 'contactNumber', '9556774130');
const afterTyping = validateReportCompleteness(typed);
check('V5.1 manually typed contact completes the report', afterTyping.isComplete, true);
check('V5.2 no longer missing', afterTyping.missingFields, []);

const typedBad = applyEdit(draftOf(without('pinCode')), 'pinCode', '11');
check(
  'V5.3 a manual value still has to be valid',
  keysOf(validateReportCompleteness(typedBad).invalidFields),
  ['pinCode'],
);

// ── 6. Explicitly none ──────────────────────────────────────────────────────
const HISTORY_NONE = [
  'No significant medical history.',
  'No known medical history.',
  'No previous medical conditions.',
  'Patient has no past medical history.',
  'Nothing significant in the past history.',
];
for (const phrase of HISTORY_NONE) {
  const result = validateTranscript(phrase);
  check(
    `V6 "${phrase}" answers medical history`,
    keysOf(result.missingFields).includes('medicalHistory'),
    false,
  );
}

const PRESCRIPTION_NONE = [
  'No medication prescribed.',
  'No medicines prescribed.',
  'No drugs required.',
  'Advice only, no medication.',
];
for (const phrase of PRESCRIPTION_NONE) {
  const result = validateTranscript(phrase);
  check(
    `V6 "${phrase}" answers prescription notes`,
    keysOf(result.missingFields).includes('prescriptionNotes'),
    false,
  );
}

check(
  'V6.10 advice alone does not answer prescription notes',
  keysOf(
    validateTranscript('Advised rest and plenty of fluids.').missingFields,
  ).includes('prescriptionNotes'),
  true,
);
check(
  'V6.11 an empty field is never auto-filled with an explicit none',
  validateTranscript('Patient name is Rahul Sharma.').missingFields.length,
  9,
);

// ── 7. Add More Speech ──────────────────────────────────────────────────────
const FIRST_PASS =
  'Patient name is Rahul Sharma. He is 34 years old. Gender is male. ' +
  'Complains of fever and cough. Known case of diabetes. Diagnosis is viral fever. ' +
  'Prescribed Paracetamol 500 milligrams twice daily.';

const firstDraft = toDraft(extractPatientFields(FIRST_PASS));
const firstResult = validateReportCompleteness(firstDraft);
check('V7.1 first pass is blocked', firstResult.isComplete, false);
// Seven of the ten: name, age, gender, symptoms, history, diagnosis and
// prescription are dictated; the three demographics are not.
check('V7.1b seven required fields captured', countRequiredFilled(firstDraft), 7);
check('V7.2 it names the three demographics', keysOf(firstResult.missingFields), [
  'address',
  'pinCode',
  'contactNumber',
]);

const SECOND_PASS =
  `${FIRST_PASS} She lives at House 24, Sector 10, Noida. ` +
  'PIN code is 201301. Contact number is 9556774130.';

const secondDraft = mergeExtraction(firstDraft, extractPatientFields(SECOND_PASS));
const secondResult = validateReportCompleteness(secondDraft);
check('V7.3 additional speech completes the report', secondResult.isComplete, true);
check('V7.3b all ten required fields captured', countRequiredFilled(secondDraft), 10);
check('V7.4 nothing missing', secondResult.missingFields, []);
check(
  'V7.5 remarks stayed empty and did not block',
  keysOf(secondResult.optionalEmptyFields),
  ['additionalRemarks'],
);
check('V7.6 earlier name survived', secondDraft.patientName.value, 'Rahul Sharma');
check('V7.7 earlier diagnosis survived', secondDraft.diagnosis.value, 'Viral fever');
check('V7.8 earlier symptoms survived', secondDraft.symptoms.value, ['Fever', 'Cough']);
check('V7.9 new address landed', secondDraft.address.value, 'House 24, Sector 10, Noida');
check('V7.10 new PIN landed', secondDraft.pinCode.value, '201301');
check('V7.11 new contact landed', secondDraft.contactNumber.value, '9556774130');

const oneMore = mergeExtraction(
  firstDraft,
  extractPatientFields(`${FIRST_PASS} Contact number is 9556774130.`),
);
check(
  'V7.12 one field filled, the other two still missing',
  keysOf(validateReportCompleteness(oneMore).missingFields),
  ['address', 'pinCode'],
);

const moreSymptoms = mergeExtraction(
  firstDraft,
  extractPatientFields(`${FIRST_PASS} She also complains of fever and headache.`),
);
check(
  'V7.13 additional symptoms merge without duplicating fever',
  moreSymptoms.symptoms.value,
  ['Fever', 'Cough', 'Headache'],
);

const corrected = mergeExtraction(
  firstDraft,
  extractPatientFields(`${FIRST_PASS} Correction, patient name is Rahul Verma.`),
);
check('V7.14 a correction replaces the value', corrected.patientName.value, 'Rahul Verma');

const handEdited = applyEdit(firstDraft, 'patientName', 'R. Sharma');
const afterMerge = mergeExtraction(
  handEdited,
  extractPatientFields(`${FIRST_PASS} Contact number is 9556774130.`),
);
check('V7.15 a manual edit outranks re-extraction', afterMerge.patientName.value, 'R. Sharma');
check('V7.16 the edit flag survives', afterMerge.patientName.edited, true);
check('V7.17 unedited fields still update', afterMerge.contactNumber.value, '9556774130');

const silent = mergeExtraction(firstDraft, extractPatientFields('Nothing relevant.'));
check('V7.18 speech that mentions nothing erases nothing', silent.patientName.value, 'Rahul Sharma');
check('V7.19 lists are not blanked either', silent.symptoms.value, ['Fever', 'Cough']);

report();
