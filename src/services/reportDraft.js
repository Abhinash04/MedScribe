import { CORE_ADR_FIELDS, PATIENT_FIELDS, REQUIRED_FIELDS } from '../constants/patientFields.js';

export const ALL_DRAFT_FIELDS = [
  ...PATIENT_FIELDS,
  ...CORE_ADR_FIELDS.filter(adr => !PATIENT_FIELDS.some(p => p.key === adr.key)),
];

const LIST_FIELDS = new Set(
  ALL_DRAFT_FIELDS.filter(field => field.list).map(field => field.key),
);

export const NOTES_KEY = 'additionalNotes';

const noteId = (start, end, text) =>
  Number.isFinite(start) && Number.isFinite(end)
    ? `${start}-${end}`
    : `t:${text}`;

export function notesFrom(residue) {
  return (Array.isArray(residue) ? residue : [])
    .map(item => {
      const text = String(item?.text ?? '').trim();
      return {
        id: noteId(item?.start, item?.end, text),
        text,
        suggestedField: item?.suggestedField ?? null,
        kept: false,
      };
    })
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
  const decided = new Map(existing.map(note => [note.id, note.kept]));
  const edited = new Map(existing.map(note => [note.id, note.text]));
  return incoming.map(note => ({
    ...note,
    text: edited.get(note.id) ?? note.text,
    kept: decided.get(note.id) ?? note.kept,
  }));
}

export function setNoteKept(draft, index, kept) {
  const notes = draftNotes(draft);
  if (index < 0 || index >= notes.length) {
    return draft;
  }
  return withNotes(
    draft,
    notes.map((note, position) =>
      position === index ? { ...note, kept: !!kept } : note,
    ),
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
      position === index
        ? { ...note, text: typeof text === 'string' ? text : '' }
        : note,
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

  for (const field of ALL_DRAFT_FIELDS) {
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

  if (draft.dateOfBirth?.value && (!draft.age?.value || draft.age?.value === '')) {
    const refDate = draft.reactionStartDate?.value || Date.now();
    const computed = calculateAgeFromDob(draft.dateOfBirth.value, refDate);
    if (computed) {
      const num = computed.replace(/\s*Years\s*/i, '');
      draft.age = {
        value: num,
        original: num,
        confidence: draft.dateOfBirth.confidence ?? 0,
        source: 'dob calculation',
        edited: false,
        auto: true,
      };
    }
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

  for (const field of ALL_DRAFT_FIELDS) {
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

  // Alias mapping
  if (record?.patientName && (!merged.patientInitials?.value || !merged.patientInitials.edited)) {
    const initialsVal = record.patientName.value;
    merged.patientInitials = {
      value: initialsVal,
      original: initialsVal,
      confidence: record.patientName.confidence ?? 0,
      source: record.patientName.source ?? '',
      edited: false,
      auto: false,
    };
  }

  if (record?.symptoms && (!merged.reactionDescription?.value || !merged.reactionDescription.edited)) {
    const descVal = Array.isArray(record.symptoms.value)
      ? record.symptoms.value.join('; ')
      : String(record.symptoms.value ?? '');
    if (descVal) {
      merged.reactionDescription = {
        value: descVal,
        original: descVal,
        confidence: record.symptoms.confidence ?? 0,
        source: record.symptoms.source ?? '',
        edited: false,
        auto: false,
      };
    }
  }

  if (merged.dateOfBirth?.value && (!merged.age?.value || !merged.age?.edited)) {
    const refDate = merged.reactionStartDate?.value || Date.now();
    const computed = calculateAgeFromDob(merged.dateOfBirth.value, refDate);
    if (computed) {
      const num = computed.replace(/\s*Years\s*/i, '');
      merged.age = {
        value: num,
        original: num,
        confidence: merged.dateOfBirth.confidence ?? 0,
        source: 'dob calculation',
        edited: false,
        auto: true,
      };
    }
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
    [NOTES_KEY]: draftNotes(stored).map(note => {
      const text = String(note?.text ?? '');
      return {
        id: note?.id ?? noteId(note?.start, note?.end, text),
        text,
        suggestedField: note?.suggestedField ?? null,
        kept: !!note?.kept,
      };
    }),
  };

  for (const field of ALL_DRAFT_FIELDS) {
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

  const updated = {
    ...draft,
    [key]: {
      ...entry,
      value: next,
      edited,
      auto: !!entry.auto && !edited,
    },
  };

  if (key === 'dateOfBirth' && typeof next === 'string' && next.trim()) {
    const refDate = updated.reactionStartDate?.value || Date.now();
    const computed = calculateAgeFromDob(next, refDate);
    if (computed && (!draft.age?.edited || !draft.age?.value)) {
      const num = computed.replace(/\s*Years\s*/i, '');
      const ageEntry = draft.age ?? emptyEntry('age');
      updated.age = {
        ...ageEntry,
        value: num,
        edited: false,
        auto: true,
      };
    }
  }

  return updated;
}

export function addListItem(draft, key, item = '') {
  const current = draft[key]?.value;
  return applyEdit(draft, key, [
    ...(Array.isArray(current) ? current : []),
    item,
  ]);
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
  if (key && isListField(key)) {
    return (
      Array.isArray(entry?.value) && entry.value.some(item => !!item?.trim?.())
    );
  }
  if (Array.isArray(entry?.value)) {
    return entry.value.some(item => !!item?.trim?.());
  }
  return !!entry?.value?.trim?.();
}

export function countFilledFields(draft) {
  return PATIENT_FIELDS.filter(field => hasValue(draft?.[field.key], field.key))
    .length;
}

export function countRequiredFilled(draft) {
  return REQUIRED_FIELDS.filter(field =>
    hasValue(draft?.[field.key], field.key),
  ).length;
}

export function hasEdits(draft) {
  return ALL_DRAFT_FIELDS.some(field => draft?.[field.key]?.edited);
}

export function isDirty(draft, saved) {
  if (!saved) {
    return true;
  }
  return (
    ALL_DRAFT_FIELDS.some(
      field =>
        !valuesEqual(draft?.[field.key]?.value, saved?.[field.key]?.value),
    ) || !valuesEqual(keptNotes(draft), keptNotes(saved))
  );
}

export function draftValues(draft, includeExtra = false) {
  const fields = includeExtra ? ALL_DRAFT_FIELDS : PATIENT_FIELDS;
  return fields.reduce((acc, field) => {
    acc[field.key] = draft?.[field.key]?.value ?? emptyValue(field.key);
    return acc;
  }, {});
}

export function summaryFrom(draft) {
  const name = (
    draft?.patientName?.value ||
    draft?.patientInitials?.value ||
    ''
  ).trim();
  const rawDx = draft?.diagnosis?.value || draft?.reactionDescription?.value || draft?.symptoms?.value || '';
  const dx = Array.isArray(rawDx) ? rawDx.join('; ') : String(rawDx);
  return {
    patientName: name,
    diagnosis: dx.trim(),
  };
}

export function getPatientInitials(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  const cleanName = name.replace(/^(Mr|Mrs|Ms|Miss|Dr|Doctor|Master)\.?\s+/i, '').trim();
  if (/^[A-Z]{1,4}$/.test(cleanName)) {
    return cleanName;
  }
  const parts = cleanName.split(/[\s.]+/).filter(Boolean);
  if (!parts.length) {
    return '';
  }
  return parts
    .map(part => {
      const char = part.charAt(0).toUpperCase();
      return /[A-Z]/.test(char) ? char : '';
    })
    .join('');
}

export function calculateAgeFromDob(dobStr, reportDate = Date.now()) {
  if (!dobStr || typeof dobStr !== 'string') {
    return '';
  }

  let birthDay = 0;
  let birthMonth = 0;
  let birthYear = 0;

  const dmyMatch = dobStr.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (dmyMatch) {
    birthDay = parseInt(dmyMatch[1], 10);
    birthMonth = parseInt(dmyMatch[2], 10);
    birthYear = parseInt(dmyMatch[3], 10);
  } else {
    const ymdMatch = dobStr.match(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/);
    if (ymdMatch) {
      birthYear = parseInt(ymdMatch[1], 10);
      birthMonth = parseInt(ymdMatch[2], 10);
      birthDay = parseInt(ymdMatch[3], 10);
    } else {
      const MONTHS = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
        apr: 4, april: 4, may: 5, june: 6, jun: 6, jul: 7, july: 7,
        aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
        nov: 11, november: 11, dec: 12, december: 12,
      };
      const wordMatch = dobStr.match(/\b([0-3]?\d)(?:st|nd|rd|th)?(?:\s+of)?\s+([a-zA-Z]+)\s+(\d{4})\b/i);
      if (wordMatch) {
        birthDay = parseInt(wordMatch[1], 10);
        const monthKey = wordMatch[2].toLowerCase();
        birthMonth = MONTHS[monthKey] || MONTHS[monthKey.slice(0, 3)] || 0;
        birthYear = parseInt(wordMatch[3], 10);
      }
    }
  }

  if (!birthYear || !birthMonth || !birthDay) {
    return '';
  }

  let rDate = reportDate;
  if (typeof reportDate === 'string') {
    const dMatch = reportDate.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
    if (dMatch) {
      rDate = new Date(parseInt(dMatch[3], 10), parseInt(dMatch[2], 10) - 1, parseInt(dMatch[1], 10));
    } else {
      rDate = new Date(reportDate);
    }
  } else if (!(reportDate instanceof Date)) {
    rDate = new Date(reportDate);
  }

  if (isNaN(rDate.getTime())) {
    rDate = new Date();
  }

  const repYear = rDate.getFullYear();
  const repMonth = rDate.getMonth() + 1;
  const repDay = rDate.getDate();

  let age = repYear - birthYear;
  if (repMonth < birthMonth || (repMonth === birthMonth && repDay < birthDay)) {
    age -= 1;
  }

  return age >= 0 ? `${age} Years` : '';
}

export function formatAdrAge(ageVal, dobVal, reportDate = Date.now()) {
  const cleanAge = typeof ageVal === 'string' ? ageVal.trim() : '';
  if (cleanAge) {
    const num = parseInt(cleanAge, 10);
    if (Number.isFinite(num) && num > 0) {
      return `${num} Years`;
    }
  }
  return calculateAgeFromDob(dobVal, reportDate);
}

