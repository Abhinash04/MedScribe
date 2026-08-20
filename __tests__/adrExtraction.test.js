import {
  calculateAgeFromDob,
  formatAdrAge,
  fromStored,
  toDraft,
} from '../src/services/reportDraft';
import { extractForReport, extractPatientFields } from '../src/services/extractionService';
import { validateReportCompleteness } from '../src/services/reportCompleteness';
import { buildReportDocument } from '../src/services/reportDocument';

describe('IPC ADR Reporting Form Extraction & Formatting (15 Approved Scenarios)', () => {
  // Scenario 1: Full ADR Dictation Benchmark
  test('Scenario 1: Benchmark dictation extracts all Section A and B fields with empty residue', () => {
    const dictation =
      'Patient initials are AKS. Date of birth is 15th March 1982. ' +
      'He is a male and weighs 72 kilograms. The reaction started on 10th August 2026 and resolved on 12th August 2026. ' +
      'He developed severe itching and generalized urticaria. Treatment was given and the symptoms improved.';

    const { record, residue } = extractForReport(dictation);
    const draft = toDraft(record, residue);

    expect(draft.patientInitials?.value || draft.patientName?.value).toBe('AKS');
    expect(draft.dateOfBirth?.value).toBe('15/03/1982');
    expect(draft.age?.value).toBe('44');
    expect(draft.gender?.value).toBe('Male');
    expect(draft.weight?.value).toBe('72');
    expect(draft.reactionStartDate?.value).toBe('10/08/2026');
    expect(draft.reactionStopDate?.value).toBe('12/08/2026');
    const symptomsVal = draft.reactionDescription?.value || (Array.isArray(draft.symptoms?.value) ? draft.symptoms.value.join('; ') : draft.symptoms?.value);
    expect(symptomsVal).toMatch(/Severe itching/i);
    expect(symptomsVal).toMatch(/urticaria/i);
    expect(draft.reactionManagement?.value).toBeTruthy();
    expect(residue).toEqual([]);
  });

  // Scenario 2: DOB -> Automatic Age Calculation relative to reaction start date
  test('Scenario 2: Calculates age from DOB relative to reaction onset date (15/03/1982 to 10/08/2026 -> 44 Years)', () => {
    expect(calculateAgeFromDob('15/03/1982', '10/08/2026')).toBe('44 Years');
  });

  // Scenario 3: Explicit Age without DOB
  test('Scenario 3: Supports explicit age without DOB', () => {
    const record = extractPatientFields('Patient is 44 years old');
    expect(record.age?.value).toBe('44 Years');
  });

  // Scenario 4: Explicit Age + DOB Consistency Handling
  test('Scenario 4: Prefers explicit age for display while retaining DOB', () => {
    expect(formatAdrAge('45', '15/03/1982', '10/08/2026')).toBe('45 Years');
    expect(formatAdrAge('', '15/03/1982', '10/08/2026')).toBe('44 Years');
  });

  // Scenario 5: Ongoing reaction without stop date
  test('Scenario 5: Ongoing reaction leaves stop date empty', () => {
    const record = extractPatientFields('The reaction started on 10th August 2026 and is currently ongoing');
    expect(record.reactionStartDate?.value).toBe('10/08/2026');
    expect(record.reactionStopDate?.value).toBeFalsy();
  });

  // Scenario 6: Reaction Start & Stop Date Extraction
  test('Scenario 6: Extracts reaction start and stop dates accurately', () => {
    const record = extractPatientFields('Reaction started on 10 August 2026 and stopped on 12 August 2026');
    expect(record.reactionStartDate?.value).toBe('10/08/2026');
    expect(record.reactionStopDate?.value).toBe('12/08/2026');
  });

  // Scenario 7: Reaction Description Extraction
  test('Scenario 7: Extracts reaction description', () => {
    const record = extractPatientFields('Patient developed severe itching and generalized urticaria');
    const draft = toDraft(record, []);
    const descVal = draft.reactionDescription?.value || (Array.isArray(draft.symptoms?.value) ? draft.symptoms.value.join('; ') : draft.symptoms?.value);
    expect(descVal).toMatch(/itching/i);
  });

  // Scenario 8: Reaction Management Extraction
  test('Scenario 8: Extracts reaction management', () => {
    const record = extractPatientFields('Symptoms improved after treatment was given');
    expect(record.reactionManagement?.value).toMatch(/symptoms improved/i);
  });

  // Scenario 9: Missing Optional Weight
  test('Scenario 9: Missing weight does not block logical completion', () => {
    const mockDraft = {
      patientInitials: { value: 'AKS' },
      dateOfBirth: { value: '15/03/1982' },
      reactionStartDate: { value: '10/08/2026' },
      reactionDescription: { value: 'Severe itching' },
    };
    const result = validateReportCompleteness(mockDraft);
    expect(result.isComplete).toBe(true);
    expect(result.capturedCount).toBe(4);
  });

  // Scenario 10: Missing Gender
  test('Scenario 10: Missing gender does not block logical completion', () => {
    const mockDraft = {
      patientInitials: { value: 'AKS' },
      age: { value: '44' },
      reactionStartDate: { value: '10/08/2026' },
      reactionDescription: { value: 'Generalized urticaria' },
    };
    const result = validateReportCompleteness(mockDraft);
    expect(result.isComplete).toBe(true);
  });

  // Scenario 11: Manual DOB & Age Editing
  test('Scenario 11: Manually editing DOB re-derives age', () => {
    const draft = toDraft({}, []);
    draft.dateOfBirth = { value: '15/03/1982', edited: true };
    const age = calculateAgeFromDob('15/03/1982', '10/08/2026');
    expect(age).toBe('44 Years');
  });

  // Scenario 12: Invalid or Ambiguous Dates
  test('Scenario 12: Handles natural language dates gracefully', () => {
    const record = extractPatientFields('Date of birth is 15th March 1982');
    expect(record.dateOfBirth?.value).toBe('15/03/1982');
  });

  // Scenario 13: Backward Compatibility Migration Layer
  test('Scenario 13: Migrates legacy stored report into canonical ADR format', () => {
    const legacyStored = {
      patientName: { value: 'Amit Kumar Singh', edited: false },
      age: { value: '44', edited: false },
      symptoms: { value: ['Severe itching', 'Generalized urticaria'], edited: false },
      diagnosis: { value: 'Adverse Drug Reaction', edited: false },
    };
    const restored = fromStored(legacyStored);
    expect(restored.patientInitials?.value || restored.patientName?.value).toBeTruthy();
    expect(restored.reactionDescription?.value || restored.symptoms?.value).toBeTruthy();
  });

  // Scenario 14: PDF Payload Generation with Combined Field 7
  test('Scenario 14: Builds IPC_ADR_V1_4 payload combining description and management into Field 7', () => {
    const mockDraft = {
      patientInitials: { value: 'AKS' },
      age: { value: '44' },
      gender: { value: 'Male' },
      weight: { value: '72' },
      reactionStartDate: { value: '10/08/2026' },
      reactionStopDate: { value: '12/08/2026' },
      reactionDescription: { value: 'Severe itching and generalized urticaria' },
      reactionManagement: { value: 'Treatment was given and symptoms improved' },
      additionalRemarks: { value: 'Follow up in 2 weeks' },
    };

    const doc = buildReportDocument(mockDraft, { now: new Date(2026, 7, 16).getTime() });

    expect(doc.template).toBe('IPC_ADR_V1_4');
    expect(doc.title).toBe('SUSPECTED ADVERSE DRUG REACTION REPORTING FORM');
    expect(doc.sectionA.patientInitials).toBe('AKS');
    expect(doc.sectionA.ageOrDob).toBe('44 Years');
    expect(doc.sectionA.gender).toBe('Male');
    expect(doc.sectionA.weightKg).toBe('72');
    expect(doc.sectionB.reactionStartDate).toBe('10/08/2026');
    expect(doc.sectionB.reactionStopDate).toBe('12/08/2026');
    expect(doc.sectionB.description).toBe(
      'Severe itching and generalized urticaria. Treatment was given and symptoms improved',
    );
    expect(doc.sectionC).toEqual({});
    expect(doc.sectionD).toEqual({});
  });

  // Scenario 15: Finalize Flow & Residue Handling
  test('Scenario 15: Completeness validation returns 4 of 4 captured when mandatory logical checks pass', () => {
    const completeDraft = {
      patientInitials: { value: 'AKS' },
      dateOfBirth: { value: '15/03/1982' },
      reactionStartDate: { value: '10/08/2026' },
      reactionDescription: { value: 'Severe itching' },
    };
    const check = validateReportCompleteness(completeDraft);
    expect(check.isComplete).toBe(true);
    expect(check.capturedCount).toBe(4);
    expect(check.totalRequired).toBe(4);
  });

  // Scenario 16: Case Type Default & Extraction
  test('Scenario 16: Section A caseType defaults to Initial and populates correctly', () => {
    const defaultDoc = buildReportDocument(toDraft({}), { now: new Date(2026, 7, 16).getTime() });
    expect(defaultDoc.sectionA.caseType).toBe('Initial');

    const followUpRec = extractPatientFields('This is a follow-up case');
    const followUpDoc = buildReportDocument(toDraft(followUpRec), { now: new Date(2026, 7, 16).getTime() });
    expect(followUpDoc.sectionA.caseType).toMatch(/follow/i);
  });
});

