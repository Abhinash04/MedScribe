import {
  FIELD_MARKERS,
  LOW_CONFIDENCE_THRESHOLD,
} from '../constants/fieldMarkers.js';
import { PATIENT_FIELDS } from '../constants/patientFields.js';
import { isValid } from './extraction/validators.js';
import { hasValue } from './reportDraft.js';

const describe = field => ({ key: field.key, label: field.label });

export function validateReportCompleteness(draft) {
  const missingFields = [];
  const invalidFields = [];
  const uncertainFields = [];
  const optionalEmptyFields = [];

  for (const field of PATIENT_FIELDS) {
    const entry = draft?.[field.key];
    const present = hasValue(entry, field.key);

    if (!field.required) {
      if (!present) {
        optionalEmptyFields.push(describe(field));
      }
      continue;
    }

    if (!present) {
      missingFields.push(describe(field));
      continue;
    }

    const validator = FIELD_MARKERS[field.key]?.validator;
    if (!isValid(validator, entry.value)) {
      invalidFields.push(describe(field));
      continue;
    }

    if (!entry.edited && (entry.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD) {
      uncertainFields.push(describe(field));
    }
  }

  return {
    isComplete: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
    uncertainFields,
    optionalEmptyFields,
  };
}

export function blockingFields(result) {
  return PATIENT_FIELDS.filter(field =>
    [...result.missingFields, ...result.invalidFields].some(
      item => item.key === field.key,
    ),
  ).map(describe);
}
