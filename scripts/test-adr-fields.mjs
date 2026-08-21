import {
  calculateAgeFromDob,
  formatAdrAge,
  getPatientInitials,
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

console.log('--- Running Comprehensive IPC ADR Form Field & Synonym Test Suite ---');

// ==========================================
// 1. CASE TYPE (Initial vs Follow-up Case)
// ==========================================
const case1_1 = extractPatientFields('This is an initial case report');
check('1.1 Case Type - Explicit Initial', case1_1.caseType?.value, 'Initial');

const case1_2 = extractPatientFields('First time ADR report for this patient');
check('1.2 Case Type - Synonym First Time', case1_2.caseType?.value, 'Initial');

const case1_3 = extractPatientFields('This is a follow-up case report');
check('1.3 Case Type - Explicit Follow-up', case1_3.caseType?.value, 'Follow-up');

const case1_4 = extractPatientFields('Patient is here for follow-up regarding previous adverse event');
check('1.4 Case Type - Synonym Follow-up Patient', case1_4.caseType?.value, 'Follow-up');

const doc1_5 = buildReportDocument(toDraft({}), { now: new Date(2026, 7, 16).getTime() });
check('1.5 Case Type - Default Fallback in Report Document', doc1_5.sectionA.caseType, 'Initial');


// ==========================================
// 2. PATIENT INITIALS (Full Name spoken -> System derives Initials)
// ==========================================
const rec2_1 = extractPatientFields('Patient name is Amit Kumar Singh');
const name2_1 = rec2_1.patientName?.value || 'Amit Kumar Singh';
check('2.1 Full Name spoken: "Amit Kumar Singh" -> Initials', getPatientInitials(name2_1), 'AKS');

const rec2_2 = extractPatientFields('Doctor, patient full name is Dr. Rajesh Sharma');
const name2_2 = rec2_2.patientName?.value || 'Dr. Rajesh Sharma';
check('2.2 Full Name with title: "Dr. Rajesh Sharma" -> Initials', getPatientInitials(name2_2), 'RS');

const rec2_3 = extractPatientFields('Name of the patient is Sunita Devi Prasad');
const name2_3 = rec2_3.patientName?.value || 'Sunita Devi Prasad';
check('2.3 Three-word name: "Sunita Devi Prasad" -> Initials', getPatientInitials(name2_3), 'SDP');

const rec2_4 = extractPatientFields('Patient name is Pooja Verma Nair');
const name2_4 = rec2_4.patientName?.value || 'Pooja Verma Nair';
check('2.4 Three-part full name: "Pooja Verma Nair" -> Initials', getPatientInitials(name2_4), 'PVN');

const rec2_5 = extractPatientFields('Subject full name is Vikramaditya Rao');
const name2_5 = rec2_5.patientName?.value || 'Vikramaditya Rao';
check('2.5 Synonym phrasing: "Vikramaditya Rao" -> Initials', getPatientInitials(name2_5), 'VR');


// ==========================================
// 3. AGE OR DATE OF BIRTH
// ==========================================
const rec3_1 = extractPatientFields('Patient is 44 years old');
check('3.1 Explicit Age in years', rec3_1.age?.value, '44 Years');

const rec3_2 = extractPatientFields('Date of birth is 15th March 1982');
check('3.2 DOB Spoken in natural language', rec3_2.dateOfBirth?.value, '15/03/1982');
check('3.2 Auto-computed Age from DOB', calculateAgeFromDob('15/03/1982', '10/08/2026'), '44 Years');

const rec3_3 = extractPatientFields('DOB 15/03/1982');
check('3.3 Numeric DOB string', rec3_3.dateOfBirth?.value, '15/03/1982');

check('3.4 Explicit Age preferred over DOB calculation', formatAdrAge('45', '15/03/1982', '10/08/2026'), '45 Years');

const rec3_5 = extractPatientFields('Patient aged 6 years');
check('3.5 Spoken phrase for pediatric age in years', rec3_5.age?.value, '6 Years');


// ==========================================
// 4. GENDER (M / F / Other)
// ==========================================
const rec4_1 = extractPatientFields('He is a male patient');
check('4.1 Gender Male synonym "male patient"', rec4_1.gender?.value, 'Male');

const rec4_2 = extractPatientFields('She is a female and presented with rash');
check('4.2 Gender Female synonym "female"', rec4_2.gender?.value, 'Female');

const rec4_3 = extractPatientFields('Gentleman aged 50 years');
check('4.3 Gender Male synonym "gentleman"', rec4_3.gender?.value, 'Male');

const rec4_4 = extractPatientFields('Lady aged 30 years');
check('4.4 Gender Female synonym "lady"', rec4_4.gender?.value, 'Female');

const rec4_5 = extractPatientFields('Transgender individual');
check('4.5 Gender Transgender', rec4_5.gender?.value, 'Transgender');


// ==========================================
// 5. WEIGHT (in Kg.)
// ==========================================
const rec5_1 = extractPatientFields('He weighs 72 kilograms');
check('5.1 Weight with "kilograms"', rec5_1.weight?.value, '72');

const rec5_2 = extractPatientFields('Body weight is 65 kgs');
check('5.2 Weight with "kgs"', rec5_2.weight?.value, '65');

const rec5_3 = extractPatientFields('Weight is 75 kilos');
check('5.3 Weight with "kilos"', rec5_3.weight?.value, '75');

const draft5_4 = {
  patientInitials: { value: 'AKS' },
  dateOfBirth: { value: '15/03/1982' },
  reactionStartDate: { value: '10/08/2026' },
  reactionDescription: { value: 'Severe itching' },
};
const comp5_4 = validateReportCompleteness(draft5_4);
check('5.4 Optional Weight omitted does not block completeness', comp5_4.isComplete, true);


// ==========================================
// 6. EVENT / REACTION START DATE (dd/mm/yyyy)
// ==========================================
const rec6_1 = extractPatientFields('The reaction started on 10th August 2026');
check('6.1 Reaction Start Date natural string', rec6_1.reactionStartDate?.value, '10/08/2026');

const rec6_2 = extractPatientFields('Onset of symptoms was 10-08-2026');
check('6.2 Onset synonym phrasing', rec6_2.reactionStartDate?.value, '10/08/2026');

const rec6_3 = extractPatientFields('Event began on 10th of August 2026');
check('6.3 Event began synonym phrasing', rec6_3.reactionStartDate?.value, '10/08/2026');

const rec6_4 = extractPatientFields('The reaction started on 10/08/2026');
check('6.4 Started on, slash-separated numeric date', rec6_4.reactionStartDate?.value, '10/08/2026');

const rec6_5 = extractPatientFields('The reaction started on 10.08.2026');
check('6.5 Started on, dot-separated numeric date', rec6_5.reactionStartDate?.value, '10/08/2026');

const rec6_6 = extractPatientFields('The reaction started on 10-08-2026');
check('6.6 Started on, hyphen-separated numeric date', rec6_6.reactionStartDate?.value, '10/08/2026');


// ==========================================
// 7. EVENT / REACTION STOP DATE (dd/mm/yyyy)
// ==========================================
const rec7_1 = extractPatientFields('Reaction resolved on 12th August 2026');
check('7.1 Reaction Stop Date resolved phrasing', rec7_1.reactionStopDate?.value, '12/08/2026');

const rec7_2 = extractPatientFields('Symptoms stopped on 12-08-2026');
check('7.2 Stop date synonym phrasing', rec7_2.reactionStopDate?.value, '12/08/2026');

const rec7_3 = extractPatientFields('The reaction started on 10th August 2026 and is currently ongoing');
check('7.3 Ongoing reaction leaves stop date empty', rec7_3.reactionStopDate?.value || '', '');


// ==========================================
// 8. DESCRIBE EVENT / REACTION MANAGEMENT (Field 7)
// ==========================================
const dictation8_1 =
  'Patient name is Amit Kumar Singh. Date of birth is 15th March 1982. ' +
  'He is a male and weighs 72 kilograms. The reaction started on 10th August 2026 and resolved on 12th August 2026. ' +
  'He developed severe itching and generalized urticaria. Treatment was given with IV hydrocortisone and symptoms improved.';

const { record: rec8_1, residue: res8_1 } = extractForReport(dictation8_1);
const draft8_1 = toDraft(rec8_1, res8_1);
const doc8_1 = buildReportDocument(draft8_1, { now: new Date(2026, 7, 16).getTime() });

check('8.1 Section A Patient Initials derived from spoken full name', doc8_1.sectionA.patientInitials, 'AKS');
check('8.1 Section A Age formatted from DOB', doc8_1.sectionA.ageOrDob, '44 Years');
check('8.1 Section A Gender', doc8_1.sectionA.gender, 'Male');
check('8.1 Section A Weight', doc8_1.sectionA.weightKg, '72');
check('8.1 Section B Reaction Start Date', doc8_1.sectionB.reactionStartDate, '10/08/2026');
check('8.1 Section B Reaction Stop Date', doc8_1.sectionB.reactionStopDate, '12/08/2026');
check('8.1 Section B Combined Field 7 Description & Management', doc8_1.sectionB.description,
  'Severe itching; Generalized urticaria. Treatment was given with IV hydrocortisone and symptoms improved');

const dictation8_2 =
  'Patient full name is Dr. Rajesh Sharma. Gentleman aged 50 years. Weight is 80 kilos. ' +
  'Onset of symptoms was 01/09/2026. Experienced anaphylactic shock and shortness of breath. ' +
  'Treatment given and symptoms improved.';

const { record: rec8_2 } = extractForReport(dictation8_2);
const draft8_2 = toDraft(rec8_2, []);
const doc8_2 = buildReportDocument(draft8_2, { now: new Date(2026, 7, 16).getTime() });

check('8.2 Anaphylaxis Dictation - Initials derived from full name', doc8_2.sectionA.patientInitials, 'RS');
check('8.2 Anaphylaxis Dictation - Gender Male inferred', doc8_2.sectionA.gender, 'Male');
check('8.2 Anaphylaxis Dictation - Weight extracted', doc8_2.sectionA.weightKg, '80');
check('8.2 Anaphylaxis Dictation - Combined Field 7', doc8_2.sectionB.description,
  'Anaphylactic shock; Shortness of breath. Treatment given and symptoms improved');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:\n' + failures.join('\n\n'));
  process.exit(1);
}
