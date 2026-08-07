import { PATIENT_FIELDS, REQUIRED_FIELDS } from '../constants/patientFields.js';

const LIST_FIELDS = new Set(
  PATIENT_FIELDS.filter(field => field.list).map(field => field.key),
);

export const NOTES_KEY = 'additionalNotes';

export function notesFrom(residue) {
  return (Array.isArray(residue) ? residue : [])
    .map(item => ({
      text: String(item?.text ?? '').trim(),
      suggestedField: item?.suggestedField ?? null,
      kept: false,
    }))
    .filter(note => note.text);
}

export function draftNotes(draft) {
  return Array.isArray(draft?.[NOTES_KEY]) ? draft[NOTES_KEY] : [];
}

export function keptNotes(draft) {
  return draftNotes(draft)
    .filter(note => note.kept && note.text.trim())
    .map(note => note.text.trim());
}

function withNotes(draft, notes) {
  return { ...draft, [NOTES_KEY]: notes };
}

function mergeNotes(existing, incoming) {
  const decided = new Map(existing.map(note => [note.text, note.kept]));
  return incoming.map(note => ({ ...note, kept: decided.get(note.text) ?? note.kept }));
}

export function setNoteKept(draft, index, kept) {
  const notes = draftNotes(draft);
  if (index < 0 || index >= notes.length) {
    return draft;
  }
  return withNotes(
    draft,
    notes.map((note, position) => (position === index ? { ...note, kept: !!kept } : note)),
  );
}

export function setNoteText(draft, index, text) {
  const notes = draftNotes(draft);
  if (index < 0 || index >= notes.length) {
    return draft;
  }
  return withNotes(
    draft,
    notes.map((note, position) =>
      position === index ? { ...note, text: typeof text === 'string' ? text : '' } : note,
    ),
  );
}

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
    auto: false,
  };
}

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

export function toDraft(record, residue) {
  const draft = { [NOTES_KEY]: notesFrom(residue) };

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
      auto: !!extracted.auto,
    };
  }

  return draft;
}

function normalizeValue(key, value) {
  if (isListField(key)) {
    const entries = Array.isArray(value)
      ? value
      : String(typeof value === 'string' ? value : '').split(/\r?\n/);
    return entries
      .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }
  return typeof value === 'string' ? value : '';
}

export function mergeExtraction(draft, record, residue) {
  const merged = {
    [NOTES_KEY]:
      residue === undefined
        ? draftNotes(draft)
        : mergeNotes(draftNotes(draft), notesFrom(residue)),
  };

  for (const field of PATIENT_FIELDS) {
    const entry = draft?.[field.key] ?? emptyEntry(field.key);
    const extracted = record?.[field.key];

    if (entry.edited || !extracted) {
      merged[field.key] = entry;
      continue;
    }

    const value = normalizeValue(field.key, extracted.value);
    if (!hasValue({ value }, field.key)) {
      merged[field.key] = entry;
      continue;
    }

    merged[field.key] = {
      value,
      original: value,
      confidence: extracted.confidence ?? 0,
      source: extracted.source ?? '',
      edited: false,
      auto: !!extracted.auto,
    };
  }

  return merged;
}

function normalizeEdit(key, value) {
  if (isListField(key)) {
    const entries = Array.isArray(value) ? value : [value];
    return entries.map(entry => (typeof entry === 'string' ? entry : ''));
  }
  return typeof value === 'string' ? value : '';
}

export function fromStored(stored) {
  const draft = {
    [NOTES_KEY]: draftNotes(stored).map(note => ({
      text: String(note?.text ?? ''),
      suggestedField: note?.suggestedField ?? null,
      kept: !!note?.kept,
    })),
  };

  for (const field of PATIENT_FIELDS) {
    const entry = stored?.[field.key];

    if (!entry || typeof entry !== 'object') {
      draft[field.key] = emptyEntry(field.key);
      continue;
    }

    const value = normalizeValue(field.key, entry.value);
    const original = normalizeValue(field.key, entry.original);
    const edited = !valuesEqual(value, original);

    draft[field.key] = {
      value,
      original,
      confidence: entry.confidence ?? 0,
      source: entry.source ?? '',
      edited,
      auto: !!entry.auto && !edited,
    };
  }

  return draft;
}

export function applyEdit(draft, key, value) {
  const entry = draft[key] ?? emptyEntry(key);
  const next = normalizeEdit(key, value);
  const edited = !valuesEqual(next, entry.original);

  return {
    ...draft,
    [key]: {
      ...entry,
      value: next,
      edited,
      // Once the doctor has typed over it the value is theirs, not the
      // classifier's, and must stop claiming otherwise.
      auto: !!entry.auto && !edited,
    },
  };
}

export function addListItem(draft, key, item = '') {
  const current = draft[key]?.value;
  return applyEdit(draft, key, [...(Array.isArray(current) ? current : []), item]);
}

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

export function hasValue(entry, key) {
  if (isListField(key)) {
    return Array.isArray(entry?.value) && entry.value.some(item => !!item?.trim?.());
  }
  return !!entry?.value?.trim?.();
}

export function countFilledFields(draft) {
  return PATIENT_FIELDS.filter(field => hasValue(draft?.[field.key], field.key))
    .length;
}

export function countRequiredFilled(draft) {
  return REQUIRED_FIELDS.filter(field => hasValue(draft?.[field.key], field.key))
    .length;
}

export function hasEdits(draft) {
  return PATIENT_FIELDS.some(field => draft?.[field.key]?.edited);
}

export function isDirty(draft, saved) {
  if (!saved) {
    return true;
  }
  return (
    PATIENT_FIELDS.some(
      field => !valuesEqual(draft?.[field.key]?.value, saved?.[field.key]?.value),
    ) || !valuesEqual(keptNotes(draft), keptNotes(saved))
  );
}

export function draftValues(draft) {
  return PATIENT_FIELDS.reduce((acc, field) => {
    acc[field.key] = draft?.[field.key]?.value ?? emptyValue(field.key);
    return acc;
  }, {});
}

export function summaryFrom(draft) {
  return {
    patientName: (draft?.patientName?.value ?? '').trim(),
    diagnosis: (draft?.diagnosis?.value ?? '').trim(),
  };
}
