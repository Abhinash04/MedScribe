import {
  FIELD_MARKERS,
  LOW_CONFIDENCE_THRESHOLD,
} from '../constants/fieldMarkers.js';
import { PATIENT_FIELDS } from '../constants/patientFields.js';
import { isValid } from './extraction/validators.js';
import { hasValue } from './reportDraft.js';

const describe = (key, label) => ({ key, label });

export function validateReportCompleteness(draft) {
  const isAdr =
    (hasValue(draft?.reactionStartDate, 'reactionStartDate') &&
      (hasValue(draft?.reactionManagement, 'reactionManagement') ||
        hasValue(draft?.reactionDescription, 'reactionDescription') ||
        hasValue(draft?.caseType, 'caseType'))) ||
    hasValue(draft?.caseType, 'caseType');

  if (isAdr) {
    const missingFields = [];
    const check1 =
      hasValue(draft?.patientInitials, 'patientInitials') ||
      hasValue(draft?.patientName, 'patientName');
    const check2 =
      hasValue(draft?.age, 'age') || hasValue(draft?.dateOfBirth, 'dateOfBirth');
    const check3 = hasValue(draft?.reactionStartDate, 'reactionStartDate');
    const check4 =
      hasValue(draft?.reactionDescription, 'reactionDescription') ||
      hasValue(draft?.symptoms, 'symptoms');

    if (!check1) {
      missingFields.push(describe('patientInitials', 'Patient Initials'));
    }
    if (!check2) {
      missingFields.push(describe('age', 'Age / Date of Birth'));
    }
    if (!check3) {
      missingFields.push(
        describe('reactionStartDate', 'Event / Reaction Start Date'),
      );
    }
    if (!check4) {
      missingFields.push(
        describe('reactionDescription', 'Describe Event / Reaction'),
      );
    }

    const capturedCount = [check1, check2, check3, check4].filter(
      Boolean,
    ).length;
    return {
      isComplete: missingFields.length === 0,
      capturedCount,
      totalRequired: 4,
      missingFields,
      invalidFields: [],
      uncertainFields: [],
      optionalEmptyFields: [],
    };
  }

  const missingFields = [];
  const invalidFields = [];
  const uncertainFields = [];
  const optionalEmptyFields = [];

  for (const field of PATIENT_FIELDS) {
    const entry = draft?.[field.key];
    const present = hasValue(entry, field.key);

    if (!field.required) {
      if (!present) {
        optionalEmptyFields.push(describe(field.key, field.label));
      }
      continue;
    }

    if (!present) {
      missingFields.push(describe(field.key, field.label));
      continue;
    }

    if (!isValid(FIELD_MARKERS[field.key]?.validator, entry.value)) {
      invalidFields.push(describe(field.key, field.label));
    } else if (entry.confidence <= LOW_CONFIDENCE_THRESHOLD && !entry.edited) {
      uncertainFields.push(describe(field.key, field.label));
    }
  }

  const capturedCount = PATIENT_FIELDS.filter(
    field => field.required && hasValue(draft?.[field.key], field.key),
  ).length;

  return {
    isComplete: missingFields.length === 0 && invalidFields.length === 0,
    capturedCount,
    totalRequired: PATIENT_FIELDS.filter(field => field.required).length,
    missingFields,
    invalidFields,
    uncertainFields,
    optionalEmptyFields,
  };
}

export function blockingFields(result) {
  if (!result) {
    return [];
  }
  return [...(result.missingFields ?? []), ...(result.invalidFields ?? [])];
}

