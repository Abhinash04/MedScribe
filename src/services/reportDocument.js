import { NOT_AVAILABLE, PATIENT_FIELDS } from '../constants/patientFields.js';
import { draftValues, isListField } from './reportDraft.js';
import { fileStamp, formatDateTime } from '../utils/datetime.js';

/**
 * Turns an editable draft into the payload the native PDF exporter draws.
 *
 * The native side stays dumb on purpose: it lays out whatever blocks it is
 * given, in order, and knows nothing about patient fields. All decisions about
 * what a report contains live here — in pure JavaScript that runs under Node,
 * so `scripts/test-report.mjs` can assert the document without a device.
 *
 * @typedef {Object} DocumentBlock
 * @property {string} label
 * @property {string} [value]     paragraph text
 * @property {string[]} [items]   bullet list
 */

/** Fields that make up the identity block at the top of the page. */
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

/** Filename-safe patient name: "Rahul Sharma" -> "rahul-sharma". */
export function slugify(name) {
  const slug = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'patient-report';
}

/**
 * @param {Object} draft            editable draft (see reportDraft.js)
 * @param {Object} [meta]
 * @param {number} [meta.createdAt] epoch ms the report was first saved
 * @param {number} [meta.now]       epoch ms of the export itself
 * @param {string} [meta.status]    'draft' | 'final'
 * @returns {{fileName: string, title: string, generatedAt: string,
 *            status: string, patient: DocumentBlock[],
 *            sections: DocumentBlock[], disclaimer: string}}
 */
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
