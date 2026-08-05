/**
 * Draft + PDF-document fixture suite.
 *
 *   node scripts/test-report.mjs
 *
 * Covers the layer between extraction and storage: the editable draft, the
 * edited/original bookkeeping that the audit trail depends on, and the payload
 * handed to the native PDF exporter.
 *
 * Runs under plain Node with no test framework, like the extraction suite —
 * which is why every module under test avoids React Native imports and uses
 * explicit `.js` extensions.
 */
import { NOT_AVAILABLE } from '../src/constants/patientFields.js';
import { extractPatientFields } from '../src/services/extractionService.js';
import { buildReportDocument, slugify } from '../src/services/reportDocument.js';
import { formatRelativeDateTime } from '../src/utils/datetime.js';
import {
  addListItem,
  applyEdit,
  countFilledFields,
  draftValues,
  fromStored,
  hasEdits,
  hasValue,
  isDirty,
  removeListItem,
  summaryFrom,
  toDraft,
} from '../src/services/reportDraft.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `  ${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`,
    );
  }
}

const TRANSCRIPT =
  'Patient name is Hema Sharma. Age 22 years. Gender Female. ' +
  'Address is Sector 12, Dwarka, New Delhi. PIN code 110078. ' +
  'Contact number 9876543210. Complains of fever, cough and headache. ' +
  'Medical history of diabetes. Diagnosis is viral infection. ' +
  'Prescribed paracetamol twice daily. Remarks patient advised for blood tests.';

const record = extractPatientFields(TRANSCRIPT);
const base = toDraft(record);

// ── 1. toDraft mirrors the extraction ───────────────────────────────────────
check('1 draft carries the extracted value', base.patientName.value, 'Hema Sharma');
check('1 draft keeps the original', base.patientName.original, 'Hema Sharma');
check('1 nothing is edited yet', hasEdits(base), false);
check('1 list field is an array', Array.isArray(base.symptoms.value), true);
check('1 symptoms captured', base.symptoms.value, ['Fever', 'Cough', 'Headache']);
check('1 confidence survives', base.diagnosis.confidence > 0, true);

// A field the dictation never mentioned is present and empty, never undefined.
const sparse = toDraft(extractPatientFields('Diagnosis is dengue'));
check('1 missing scalar is empty string', sparse.patientName.value, '');
check('1 missing list is empty array', sparse.symptoms.value, []);
check('1 filled count', countFilledFields(sparse), 1);

// ── 2. Editing sets and clears the edited flag ──────────────────────────────
const corrected = applyEdit(base, 'patientName', 'Rahul Sharma');
check('2 value replaced', corrected.patientName.value, 'Rahul Sharma');
check('2 original preserved', corrected.patientName.original, 'Hema Sharma');
check('2 edited flag set', corrected.patientName.edited, true);
check('2 other fields untouched', corrected.age.edited, false);
check('2 draft reports edits', hasEdits(corrected), true);

// Typing the original value back is not an edit.
const reverted = applyEdit(corrected, 'patientName', 'Hema Sharma');
check('2 edited flag cleared on revert', reverted.patientName.edited, false);
check('2 no edits after revert', hasEdits(reverted), false);

// Clearing a field is a legitimate edit, not a no-op.
const cleared = applyEdit(base, 'diagnosis', '');
check('2 cleared value', cleared.diagnosis.value, '');
check('2 cleared counts as edited', cleared.diagnosis.edited, true);
check('2 cleared drops the filled count', countFilledFields(cleared), countFilledFields(base) - 1);

// A field that was never dictated can be filled in.
const added = applyEdit(sparse, 'patientName', 'Asha Devi');
check('2 added value', added.patientName.value, 'Asha Devi');
check('2 added counts as edited', added.patientName.edited, true);

// ── 3. List editing ─────────────────────────────────────────────────────────
const withItem = addListItem(base, 'symptoms', 'Sore throat');
check('3 item appended', withItem.symptoms.value, [
  'Fever',
  'Cough',
  'Headache',
  'Sore throat',
]);
check('3 list edit flagged', withItem.symptoms.edited, true);

const withoutItem = removeListItem(withItem, 'symptoms', 1);
check('3 item removed', withoutItem.symptoms.value, ['Fever', 'Headache', 'Sore throat']);

const restored = removeListItem(addListItem(base, 'symptoms', 'X'), 'symptoms', 3);
check('3 add then remove is not an edit', restored.symptoms.edited, false);

// ── 4. Dirty tracking against the last save ─────────────────────────────────
check('4 unsaved draft is dirty', isDirty(base, null), true);
check('4 saved draft is clean', isDirty(base, base), false);
check('4 edited draft is dirty', isDirty(corrected, base), true);
check('4 clean again after saving', isDirty(corrected, corrected), false);

// ── 5. Round-trip through storage ───────────────────────────────────────────
const rehydrated = fromStored(JSON.parse(JSON.stringify(corrected)));
check('5 value survives storage', rehydrated.patientName.value, 'Rahul Sharma');
check('5 original survives storage', rehydrated.patientName.original, 'Hema Sharma');
check('5 edited flag recomputed', rehydrated.patientName.edited, true);
check('5 list survives storage', rehydrated.symptoms.value, ['Fever', 'Cough', 'Headache']);

// A row saved before a field existed must not crash the report screen.
const partial = fromStored({ diagnosis: { value: 'Dengue', original: 'Dengue' } });
check('5 missing keys are filled in', partial.patientName.value, '');
check('5 missing list key is an array', partial.symptoms.value, []);
check('5 surviving key kept', partial.diagnosis.value, 'Dengue');
check('5 garbage input yields an empty draft', countFilledFields(fromStored(null)), 0);

// ── 6. Dashboard summary columns ────────────────────────────────────────────
check('6 summary from draft', summaryFrom(base), {
  patientName: 'Hema Sharma',
  diagnosis: 'Viral infection',
});
check('6 summary follows edits', summaryFrom(corrected).patientName, 'Rahul Sharma');
check('6 summary of an empty draft', summaryFrom(toDraft({})), {
  patientName: '',
  diagnosis: '',
});

// ── 7. Values view ──────────────────────────────────────────────────────────
const values = draftValues(base);
check('7 scalar value', values.age, '22 Years');
check('7 list value', values.symptoms, ['Fever', 'Cough', 'Headache']);
check('7 every field present', Object.keys(values).length, 11);

// ── 8. PDF document payload ─────────────────────────────────────────────────
const NOW = Date.UTC(2026, 2, 12, 8, 35); // fixed clock: the payload is compared literally
const localStamp = new Date(NOW);
const doc = buildReportDocument(base, { now: NOW, status: 'draft' });

check('8 title', doc.title, 'Patient Consultation Report');
check('8 status upper-cased', doc.status, 'DRAFT');
check('8 patient block size', doc.patient.length, 6);
check('8 patient name row', doc.patient[0], {
  label: 'Patient Name',
  value: 'Hema Sharma',
});
check('8 section count', doc.sections.length, 5);
check('8 symptoms render as bullets', doc.sections[0], {
  label: 'Symptoms',
  items: ['Fever', 'Cough', 'Headache'],
});
check('8 diagnosis renders as text', doc.sections[2], {
  label: 'Diagnosis',
  value: 'Viral infection',
});
check('8 disclaimer present', doc.disclaimer.includes('documentation aid only'), true);
check(
  '8 generated timestamp',
  doc.generatedAt,
  `${localStamp.getDate()} Mar 2026, ${String(localStamp.getHours()).padStart(2, '0')}:${String(
    localStamp.getMinutes(),
  ).padStart(2, '0')}`,
);

// Empty fields print "Not Available" rather than disappearing (FR-7).
const sparseDoc = buildReportDocument(sparse, { now: NOW });
check('8 missing detail marked', sparseDoc.patient[0].value, NOT_AVAILABLE);
check('8 empty list marked', sparseDoc.sections[0], {
  label: 'Symptoms',
  value: NOT_AVAILABLE,
});

// Filenames must survive a name with punctuation, and never come out empty.
check('8 filename from patient', doc.fileName.startsWith('hema-sharma-'), true);
check('8 filename extension', doc.fileName.endsWith('.pdf'), true);
check('8 filename of an unnamed report', sparseDoc.fileName.startsWith('patient-report-'), true);
check('9 slug strips punctuation', slugify("Dr. O'Brien-Smith"), 'dr-o-brien-smith');
check('9 slug of nothing', slugify('   '), 'patient-report');

// Edits, not extraction, are what gets printed.
const editedDoc = buildReportDocument(corrected, { now: NOW });
check('9 pdf prints the edited value', editedDoc.patient[0].value, 'Rahul Sharma');

// ── 11. Prescription became a list ──────────────────────────────────────────
// Rows saved while the field was a scalar must survive the type change.
const legacy = fromStored({
  prescriptionNotes: {
    value: 'Paracetamol 500 mg twice daily',
    original: 'Paracetamol 500 mg twice daily',
    confidence: 0.95,
    source: 'prescribed',
  },
});
check('11 legacy string becomes a list', legacy.prescriptionNotes.value, [
  'Paracetamol 500 mg twice daily',
]);
check('11 legacy original is coerced too', legacy.prescriptionNotes.original, [
  'Paracetamol 500 mg twice daily',
]);
check('11 legacy row is not marked edited', legacy.prescriptionNotes.edited, false);
check('11 empty legacy string becomes an empty list', fromStored({
  prescriptionNotes: { value: '', original: '' },
}).prescriptionNotes.value, []);

// ── 10. Dashboard timestamps ────────────────────────────────────────────────
// The list is scanned between consultations, so today and yesterday read as
// words; anything older stays an unambiguous date.
const CLOCK = new Date(2026, 2, 12, 14, 5).getTime();
const MINUTE = 60 * 1000;
check('10 today', formatRelativeDateTime(CLOCK - 30 * MINUTE, CLOCK), 'Today, 13:35');
check('10 start of today', formatRelativeDateTime(new Date(2026, 2, 12, 0, 0).getTime(), CLOCK), 'Today, 00:00');
check('10 yesterday', formatRelativeDateTime(new Date(2026, 2, 11, 19, 15).getTime(), CLOCK), 'Yesterday, 19:15');
check('10 last minute of yesterday', formatRelativeDateTime(new Date(2026, 2, 11, 23, 59).getTime(), CLOCK), 'Yesterday, 23:59');
check('10 older falls back to a date', formatRelativeDateTime(new Date(2026, 2, 9, 8, 5).getTime(), CLOCK), '9 Mar 2026, 08:05');
check('10 missing timestamp', formatRelativeDateTime(0, CLOCK), '');
check('10 invalid timestamp', formatRelativeDateTime(Number.NaN, CLOCK), '');

// ── Editing a list keeps blank rows; ingest still drops them ────────────────
// "+ Add item" appends an empty row for the doctor to type into. The ingest
// normalizer stripped it before render, so the button appeared to do nothing,
// and clearing a row to retype it deleted the row mid-edit.
{
  const draft = toDraft(extractPatientFields('Complains of fever and cough.'));
  check('E1 extraction ingested two findings', draft.symptoms.value, ['Fever', 'Cough']);

  const added = addListItem(draft, 'symptoms');
  check('E2 + Add item leaves a row to type into', added.symptoms.value, [
    'Fever',
    'Cough',
    '',
  ]);
  check('E3 the row is editable', added.symptoms.value.length, 3);

  const typed = applyEdit(added, 'symptoms', ['Fever', 'Cough', 'Headache']);
  check('E4 typing into the new row works', typed.symptoms.value, [
    'Fever',
    'Cough',
    'Headache',
  ]);

  const cleared = applyEdit(draft, 'symptoms', ['', 'Cough']);
  check('E5 clearing a row does not delete it', cleared.symptoms.value, ['', 'Cough']);

  const removed = removeListItem(typed, 'symptoms', 2);
  check('E6 remove still works', removed.symptoms.value, ['Fever', 'Cough']);

  // A blank row must not look like a captured field.
  const blankOnly = applyEdit(draft, 'symptoms', ['', '']);
  check('E7 a blank-only list is not a value', hasValue(blankOnly.symptoms, 'symptoms'), false);
  // The section still appears — FR-7 shows an unmentioned field rather than
  // hiding it — but it must carry no bullets and read Not Available.
  const blankSection = buildReportDocument(blankOnly, {
    createdAt: Date.now(),
  }).sections.find(section => section.label === 'Symptoms');
  check('E8 blank rows produce no PDF bullets', blankSection.items, undefined);
  check('E8b and the section reads Not Available', blankSection.value, NOT_AVAILABLE);

  // Ingest is unchanged — a stored or extracted blank must not render.
  const stored = fromStored({
    symptoms: { value: ['Fever', '', 'Cough'], original: ['Fever', '', 'Cough'] },
  });
  check('E9 ingest still drops blanks', stored.symptoms.value, ['Fever', 'Cough']);
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failures.length) {
  console.log('FAILURES:\n' + failures.join('\n\n'));
  process.exit(1);
}
