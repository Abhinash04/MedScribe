import { extractForReport } from '../../src/services/extractionService.js';
import {
  blockingFields,
  validateReportCompleteness,
} from '../../src/services/reportCompleteness.js';
import { buildReportDocument } from '../../src/services/reportDocument.js';
import { getPatientInitials, toDraft } from '../../src/services/reportDraft.js';

export const NOW = new Date(2026, 7, 18).getTime();

export const valueOf = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
};

export const holds = (haystack, needle) =>
  String(haystack ?? '')
    .toLowerCase()
    .includes(String(needle).toLowerCase());

export function runPipeline(transcript, options = {}) {
  const { record, residue } = extractForReport(transcript, options);
  const draft = toDraft(record, residue);
  const completeness = validateReportCompleteness(draft);
  const doc = buildReportDocument(draft, { now: NOW });
  return { record, draft, completeness, doc };
}

export function gradeReport(
  transcript,
  expected,
  { strictName = false, translated = false } = {},
) {
  const { record, completeness, doc } = runPipeline(transcript, { translated });
  const sectionA = doc.sectionA ?? {};
  const sectionB = doc.sectionB ?? {};
  const spokenName = valueOf(record, 'patientName');
  const initials = getPatientInitials(spokenName || sectionA.patientInitials || '');
  const description = String(sectionB.description ?? '');

  const hard = [
    ['caseType', sectionA.caseType, expected.caseType],
    ['initials', initials, expected.initials],
    ['age', valueOf(record, 'age'), expected.age],
    ['gender', valueOf(record, 'gender'), expected.gender],
    ['weight', valueOf(record, 'weight'), expected.weight],
    ['reactionStartDate', sectionB.reactionStartDate, expected.reactionStartDate],
    ['reactionStopDate', sectionB.reactionStopDate, expected.reactionStopDate],
    ['isComplete', completeness.isComplete, true],
    ['capturedCount', completeness.capturedCount, 4],
    ['blocking', blockingFields(completeness), []],
    ['template', doc.template, 'IPC_ADR_V1_4'],
    [
      'keywords',
      (expected.keywords ?? []).filter(word => !holds(description, word)),
      [],
    ],
    [
      'forbidden',
      (expected.forbidden ?? []).filter(word => holds(description, word)),
      [],
    ],
  ];

  if (strictName) {
    hard.push(['patientName', spokenName, expected.fullSpokenName]);
  }

  const checks = hard.map(([name, actual, want]) => ({
    name,
    actual,
    want,
    ok: JSON.stringify(actual) === JSON.stringify(want),
  }));

  const failures = checks
    .filter(entry => !entry.ok)
    .map(({ name, actual, want }) => ({ name, actual, want }));

  const notes = [];
  if (!strictName && spokenName !== expected.fullSpokenName) {
    notes.push({
      name: 'patientName',
      actual: spokenName,
      want: expected.fullSpokenName,
    });
  }

  return {
    record,
    doc,
    completeness,
    initials,
    spokenName,
    checks,
    failures,
    notes,
  };
}
