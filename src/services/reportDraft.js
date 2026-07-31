import { PATIENT_FIELDS } from '../constants/patientFields.js';

/**
 * The editable draft that sits between extraction (FR-5) and the saved record.
 *
 * The extracted value is kept alongside the doctor's value in every entry, so
 * "what the machine heard" is never lost once the doctor corrects a field —
 * a patient record needs that audit trail, and it is what drives the EDITED
 * badge without a second lookup.
 *
 * Pure and free of React Native imports, with explicit `.js` extensions on
 * every import, so the whole module runs under plain Node like the extraction
 * pipeline. `scripts/test-report.mjs` depends on that.
 *
 * @typedef {Object} DraftEntry
 * @property {string|string[]} value     what the doctor sees and edits
 * @property {string|string[]} original  what extraction produced
 * @property {number} confidence         marker specificity, NOT probability
 * @property {string} source             which phrase matched, for debugging
 * @property {boolean} edited            value differs from original
 */

const LIST_FIELDS = new Set(
  PATIENT_FIELDS.filter(field => field.list).map(field => field.key),
);

/** True when a field renders as bullets rather than a paragraph. */
export function isListField(key) {
  return LIST_FIELDS.has(key);
}

function emptyValue(key) {
  return isListField(key) ? [] : '';
}

function emptyEntry(key) {
  return {
    value: emptyValue(key),
    original: emptyValue(key),
    confidence: 0,
    source: '',
    edited: false,
  };
}

/** Deep-ish equality — values are only strings or arrays of strings. */
export function valuesEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    return (
      left.length === right.length &&
      left.every((item, index) => item === right[index])
    );
  }
  return (a ?? '') === (b ?? '');
}

/**
 * Build an editable draft from an extraction result.
 *
 * @param {Object<string, {value: string|string[], confidence: number, source: string}|null>} record
 * @returns {Object<string, DraftEntry>} every field present, missing ones empty
 */
export function toDraft(record) {
  const draft = {};

  for (const field of PATIENT_FIELDS) {
    const extracted = record?.[field.key];

    if (!extracted) {
      draft[field.key] = emptyEntry(field.key);
      continue;
    }

    const value = normalizeValue(field.key, extracted.value);

    draft[field.key] = {
      value,
      original: value,
      confidence: extracted.confidence ?? 0,
      source: extracted.source ?? '',
      edited: false,
    };
  }

  return draft;
}

function normalizeValue(key, value) {
  if (isListField(key)) {
    return Array.isArray(value) ? [...value] : [];
  }
  return typeof value === 'string' ? value : '';
}

/**
 * Rebuild a draft loaded from storage.
 *
 * Fields added to PATIENT_FIELDS after a report was saved come back empty
 * rather than undefined, so an old row never crashes the report screen.
 */
export function fromStored(stored) {
  const draft = {};

  for (const field of PATIENT_FIELDS) {
    const entry = stored?.[field.key];

    if (!entry || typeof entry !== 'object') {
      draft[field.key] = emptyEntry(field.key);
      continue;
    }

    const value = normalizeValue(field.key, entry.value);
    const original = normalizeValue(field.key, entry.original);

    draft[field.key] = {
      value,
      original,
      confidence: entry.confidence ?? 0,
      source: entry.source ?? '',
      edited: !valuesEqual(value, original),
    };
  }

  return draft;
}

/**
 * Set one field's value. Returns a new draft — never mutates, so React state
 * updates are seen.
 *
 * `edited` is recomputed rather than latched: a doctor who types over a value
 * and then types the original back has not edited anything.
 */
export function applyEdit(draft, key, value) {
  const entry = draft[key] ?? emptyEntry(key);
  const next = normalizeValue(key, value);

  return {
    ...draft,
    [key]: {
      ...entry,
      value: next,
      edited: !valuesEqual(next, entry.original),
    },
  };
}

/** Append a blank item to a list field, ready for the doctor to type into. */
export function addListItem(draft, key, item = '') {
  const current = draft[key]?.value;
  return applyEdit(draft, key, [...(Array.isArray(current) ? current : []), item]);
}

/** Remove one item from a list field. */
export function removeListItem(draft, key, index) {
  const current = draft[key]?.value;
  if (!Array.isArray(current)) {
    return draft;
  }
  return applyEdit(
    draft,
    key,
    current.filter((_, position) => position !== index),
  );
}

/** Set one item of a list field. */
export function setListItem(draft, key, index, item) {
  const current = draft[key]?.value;
  if (!Array.isArray(current)) {
    return draft;
  }
  return applyEdit(
    draft,
    key,
    current.map((existing, position) => (position === index ? item : existing)),
  );
}

/** True when the field holds something worth printing. */
export function hasValue(entry, key) {
  if (isListField(key)) {
    return Array.isArray(entry?.value) && entry.value.some(item => !!item?.trim?.());
  }
  return !!entry?.value?.trim?.();
}

/** How many of the eleven fields the report actually carries. */
export function countFilledFields(draft) {
  return PATIENT_FIELDS.filter(field => hasValue(draft?.[field.key], field.key))
    .length;
}

/** True when any field was changed by the doctor. */
export function hasEdits(draft) {
  return PATIENT_FIELDS.some(field => draft?.[field.key]?.edited);
}

/** True when the draft differs from the last saved copy. */
export function isDirty(draft, saved) {
  if (!saved) {
    return true;
  }
  return PATIENT_FIELDS.some(
    field => !valuesEqual(draft?.[field.key]?.value, saved?.[field.key]?.value),
  );
}

/** Plain `{ key: value }` view, for the PDF builder and for list rows. */
export function draftValues(draft) {
  return PATIENT_FIELDS.reduce((acc, field) => {
    acc[field.key] = draft?.[field.key]?.value ?? emptyValue(field.key);
    return acc;
  }, {});
}

/**
 * The two columns the dashboard lists reports by.
 *
 * Denormalized into their own SQL columns by `reportsRepository`, so listing
 * never has to parse every stored draft.
 */
export function summaryFrom(draft) {
  return {
    patientName: (draft?.patientName?.value ?? '').trim(),
    diagnosis: (draft?.diagnosis?.value ?? '').trim(),
  };
}
