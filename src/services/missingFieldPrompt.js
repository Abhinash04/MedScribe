import {
  DEFAULT_CATALOG_CODE,
  catalogFor,
} from '../constants/prompts/index.js';

export const SPOKEN_FIELD_LIMIT = 4;

const SPOKEN_LABEL = {
  pinCode: 'PIN code',
  contactNumber: 'contact number',
  medicalHistory: 'medical history',
  prescriptionNotes: 'prescription notes',
  additionalRemarks: 'additional remarks',
};

const spokenLabel = (field, catalog) =>
  catalog?.labels?.[field?.key] ||
  SPOKEN_LABEL[field?.key] ||
  String(field?.label ?? '').toLowerCase();

function joinNames(names, join) {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(join.separator)}${join.and}${
    names[names.length - 1]
  }`;
}

const fill = (frame, values) =>
  String(frame).replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );

export function missingFieldPrompt(fields, language = DEFAULT_CATALOG_CODE) {
  const catalog = catalogFor(language) ?? catalogFor(DEFAULT_CATALOG_CODE);

  const names = (Array.isArray(fields) ? fields : [])
    .map(field => spokenLabel(field, catalog))
    .filter(Boolean);

  if (!names.length) {
    return '';
  }

  if (names.length === 1) {
    return fill(catalog.frames.one, { names: names[0] });
  }

  if (names.length <= SPOKEN_FIELD_LIMIT) {
    return fill(catalog.frames.few, {
      names: joinNames(names, catalog.join),
    });
  }

  const spoken = names.slice(0, SPOKEN_FIELD_LIMIT);
  const rest = names.length - SPOKEN_FIELD_LIMIT;

  return fill(catalog.frames.many, {
    names: spoken.join(catalog.join.separator),
    count: rest,
    detailWord: rest === 1 ? catalog.detailWord.one : catalog.detailWord.other,
  });
}
