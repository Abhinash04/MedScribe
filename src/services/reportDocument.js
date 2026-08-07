import { NOT_AVAILABLE, PATIENT_FIELDS } from '../constants/patientFields.js';
import { draftValues, isListField, keptNotes } from './reportDraft.js';
import { fileStamp, formatDateTime } from '../utils/datetime.js';

const PATIENT_DETAIL_KEYS = [
  'patientName',
  'age',
  'gender',
  'address',
  'pinCode',
  'contactNumber',
];

const DISCLAIMER =
  'MedScribe is a documentation aid only. It performs no diagnosis and makes ' +
  'no medical decisions. Verify all details before clinical use.';

function labelFor(key) {
  return PATIENT_FIELDS.find(field => field.key === key)?.label ?? key;
}

function textOf(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || NOT_AVAILABLE;
}

export function slugify(name) {
  const slug = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'patient-report';
}

export function buildReportDocument(draft, meta = {}) {
  const values = draftValues(draft);
  const now = meta.now ?? Date.now();

  const patient = PATIENT_DETAIL_KEYS.map(key => ({
    label: labelFor(key),
    value: textOf(values[key]),
  }));

  const sections = PATIENT_FIELDS.filter(
    field => !PATIENT_DETAIL_KEYS.includes(field.key),
  ).map(field => {
    if (isListField(field.key)) {
      const items = Array.isArray(values[field.key])
        ? values[field.key].map(item => String(item).trim()).filter(Boolean)
        : [];
      return items.length
        ? { label: field.label, items }
        : { label: field.label, value: NOT_AVAILABLE };
    }

    return { label: field.label, value: textOf(values[field.key]) };
  });

  const notes = keptNotes(draft);
  if (notes.length) {
    sections.push({ label: 'Additional Clinical Notes', items: notes });
  }

  return {
    fileName: `${slugify(values.patientName)}-${fileStamp(now)}.pdf`,
    title: 'Patient Consultation Report',
    generatedAt: formatDateTime(now),
    createdAt: meta.createdAt ? formatDateTime(meta.createdAt) : '',
    status: (meta.status || 'draft').toUpperCase(),
    patient,
    sections,
    disclaimer: DISCLAIMER,
  };
}
