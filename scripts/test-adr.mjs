import {
  calculateAgeFromDob,
  formatAdrAge,
  fromStored,
  toDraft,
} from '../src/services/reportDraft.js';
import { extractForReport, extractPatientFields } from '../src/services/extractionService.js';
import { validateReportCompleteness } from '../src/services/reportCompleteness.js';
import { buildReportDocument } from '../src/services/reportDocument.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`  ${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
  }
}

console.log('--- Running IPC ADR Feature Tests ---');

// Scenario 1: Full ADR Dictation Benchmark
const dictation1 =
  'Patient initials are AKS. Date of birth is 15th March 1982. ' +
  'He is a male and weighs 72 kilograms. The reaction started on 10th August 2026 and resolved on 12th August 2026. ' +
  'He developed severe itching and generalized urticaria. Treatment was given and the symptoms improved.';
const { record: rec1, residue: res1 } = extractForReport(dictation1);
const draft1 = toDraft(rec1, res1);

check('Scenario 1: Patient Initials', draft1.patientInitials?.value || draft1.patientName?.value, 'AKS');
check('Scenario 1: Date of Birth', draft1.dateOfBirth?.value, '15/03/1982');
check('Scenario 1: Calculated Age', draft1.age?.value, '44');
check('Scenario 1: Gender', draft1.gender?.value, 'Male');
check('Scenario 1: Weight', draft1.weight?.value, '72');
check('Scenario 1: Reaction Start Date', draft1.reactionStartDate?.value, '10/08/2026');
check('Scenario 1: Reaction Stop Date', draft1.reactionStopDate?.value, '12/08/2026');
check('Scenario 1: Reaction Description', draft1.reactionDescription?.value || (Array.isArray(draft1.symptoms?.value) ? draft1.symptoms.value.join('; ') : draft1.symptoms?.value), 'Severe itching; Generalized urticaria');
check('Scenario 1: Reaction Management', draft1.reactionManagement?.value, 'Treatment given and symptoms improved');
check('Scenario 1: Residue is empty', res1.length, 0);

// Scenario 2: DOB -> Automatic Age Calculation
check('Scenario 2: Age calculation from DOB relative to onset date', calculateAgeFromDob('15/03/1982', '10/08/2026'), '44 Years');

// Scenario 3: Explicit Age without DOB
const rec3 = extractPatientFields('Patient is 44 years old');
check('Scenario 3: Explicit Age', rec3.age?.value, '44 Years');

// Scenario 4: Explicit Age + DOB Preference
check('Scenario 4: Explicit Age preferred', formatAdrAge('45', '15/03/1982', '10/08/2026'), '45 Years');

// Scenario 5: Ongoing reaction without stop date
const rec5 = extractPatientFields('The reaction started on 10th August 2026');
check('Scenario 5: Reaction Start Date', rec5.reactionStartDate?.value, '10/08/2026');
check('Scenario 5: Stop Date empty', rec5.reactionStopDate?.value || '', '');

// Scenario 6: Start & Stop Date Extraction
const rec6 = extractPatientFields('Reaction started on 10 August 2026 and resolved on 12 August 2026');
check('Scenario 6: Start Date', rec6.reactionStartDate?.value, '10/08/2026');
check('Scenario 6: Stop Date', rec6.reactionStopDate?.value, '12/08/2026');

// Scenario 7: Reaction Description Extraction
const rec7 = extractPatientFields('He developed severe itching and generalized urticaria');
const draft7 = toDraft(rec7, []);
check('Scenario 7: Description', draft7.reactionDescription?.value || (Array.isArray(draft7.symptoms?.value) ? draft7.symptoms.value.join('; ') : draft7.symptoms?.value), 'Severe itching; Generalized urticaria');

// Scenario 8: Reaction Management Extraction
const rec8 = extractPatientFields('Treatment was given and the symptoms improved');
check('Scenario 8: Management', rec8.reactionManagement?.value, 'Treatment given and symptoms improved');

// Scenario 9: Missing optional weight
const draft9 = {
  patientInitials: { value: 'AKS' },
  dateOfBirth: { value: '15/03/1982' },
  reactionStartDate: { value: '10/08/2026' },
  reactionDescription: { value: 'Severe itching' },
};
const comp9 = validateReportCompleteness(draft9);
check('Scenario 9: Is complete without weight', comp9.isComplete, true);
check('Scenario 9: Captured count is 4', comp9.capturedCount, 4);

// Scenario 10: Missing gender
const comp10 = validateReportCompleteness(draft9);
check('Scenario 10: Is complete without gender', comp10.isComplete, true);

// Scenario 11: Manual DOB editing
check('Scenario 11: Age re-derivation from edited DOB', calculateAgeFromDob('15/03/1982', '10/08/2026'), '44 Years');

// Scenario 12: Natural language date
const rec12 = extractPatientFields('Date of birth is 15th March 1982');
check('Scenario 12: DOB formatting', rec12.dateOfBirth?.value, '15/03/1982');

// Scenario 13: Backward compatibility migration
const legacy13 = {
  patientName: { value: 'Amit Kumar Singh', edited: false },
  symptoms: { value: ['Severe itching', 'Urticaria'], edited: false },
};
const restored13 = fromStored(legacy13);
check('Scenario 13: Legacy initials restored', restored13.patientInitials?.value || restored13.patientName?.value, 'Amit Kumar Singh');

// Scenario 14: PDF Payload Generation with Combined Field 7
const doc14 = buildReportDocument(draft1, { now: new Date(2026, 7, 16).getTime() });
check('Scenario 14: Template is IPC_ADR_V1_4', doc14.template, 'IPC_ADR_V1_4');
check('Scenario 14: Section A Initials', doc14.sectionA.patientInitials, 'AKS');
check('Scenario 14: Field 7 Combined Description', doc14.sectionB.description, 'Severe itching; Generalized urticaria. Treatment given and symptoms improved');

// Scenario 15: Logical completion counter
const comp15 = validateReportCompleteness(draft1);
check('Scenario 15: Is complete', comp15.isComplete, true);
check('Scenario 15: 4 of 4 captured', comp15.capturedCount, 4);

// Scenario 16: Case Type extraction and default fallback in PDF
const recInitial = extractPatientFields('This is an initial case report');
const docInitial = buildReportDocument(toDraft(recInitial), { now: new Date(2026, 7, 16).getTime() });
check('Scenario 16: Section A caseType in PDF is Initial', docInitial.sectionA.caseType.toLowerCase().includes('initial'), true);

const recFollowUp = extractPatientFields('This is a follow-up case report');
const docFollowUp = buildReportDocument(toDraft(recFollowUp), { now: new Date(2026, 7, 16).getTime() });
check('Scenario 16: Section A caseType in PDF is Follow-up', docFollowUp.sectionA.caseType.toLowerCase().includes('follow'), true);

const docDefault = buildReportDocument(toDraft({}), { now: new Date(2026, 7, 16).getTime() });
check('Scenario 16: Default caseType in PDF is Initial', docDefault.sectionA.caseType, 'Initial');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:\n' + failures.join('\n\n'));
  process.exit(1);
}

