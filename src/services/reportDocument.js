import { NOT_AVAILABLE, PATIENT_FIELDS } from '../constants/patientFields.js';
import {
  draftValues,
  formatAdrAge,
  getPatientInitials,
  isListField,
  keptNotes,
} from './reportDraft.js';
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

export function combineReactionDescriptionAndManagement(desc, mgmt) {
  const d = typeof desc === 'string' ? desc.trim() : Array.isArray(desc) ? desc.join('; ').trim() : '';
  const m = typeof mgmt === 'string' ? mgmt.trim() : '';
  if (d && m) {
    return `${d}. ${m}`;
  }
  return d || m;
}

export function buildReportDocument(draft, meta = {}) {
  const values = draftValues(draft, true);
  const now = meta.now ?? Date.now();

  const rawInitials =
    values.patientInitials ||
    values.patientName ||
    draft?.patientInitials?.value ||
    draft?.patientName?.value ||
    '';
  const initials = getPatientInitials(rawInitials);

  const dateOfBirth =
    (typeof values.dateOfBirth === 'string' && values.dateOfBirth)
      ? values.dateOfBirth.trim()
      : (typeof draft?.dateOfBirth?.value === 'string')
      ? draft.dateOfBirth.value.trim()
      : '';

  const reactionStartDate =
    (typeof values.reactionStartDate === 'string' && values.reactionStartDate)
      ? values.reactionStartDate.trim()
      : (typeof draft?.reactionStartDate?.value === 'string')
      ? draft.reactionStartDate.value.trim()
      : '';

  const reactionStopDate =
    (typeof values.reactionStopDate === 'string' && values.reactionStopDate)
      ? values.reactionStopDate.trim()
      : (typeof draft?.reactionStopDate?.value === 'string')
      ? draft.reactionStopDate.value.trim()
      : (typeof draft?.reactionStopDate === 'string')
      ? draft.reactionStopDate.trim()
      : '';

  const ageDisplay = formatAdrAge(
    values.age || draft?.age?.value,
    dateOfBirth,
    reactionStartDate || now,
  );

  const gender = typeof values.gender === 'string' ? values.gender.trim() : '';
  const weight =
    (typeof values.weight === 'string' && values.weight)
      ? values.weight.trim()
      : (typeof draft?.weight?.value === 'string')
      ? draft.weight.value.trim()
      : '';

  const caseType =
    (typeof values.caseType === 'string' && values.caseType.trim())
      ? values.caseType.trim()
      : (typeof draft?.caseType?.value === 'string' && draft.caseType.value.trim())
      ? draft.caseType.value.trim()
      : (typeof draft?.caseType === 'string' && draft.caseType.trim())
      ? draft.caseType.trim()
      : 'Initial';

  const descRaw =
    values.reactionDescription ||
    values.symptoms ||
    draft?.reactionDescription?.value ||
    draft?.symptoms?.value ||
    '';

  const mgmtRaw =
    values.reactionManagement ||
    draft?.reactionManagement?.value ||
    draft?.reactionManagement ||
    '';

  const combinedDescription = combineReactionDescriptionAndManagement(descRaw, mgmtRaw);
  const additionalInfo =
    (typeof values.additionalRemarks === 'string' && values.additionalRemarks)
      ? values.additionalRemarks.trim()
      : (typeof draft?.additionalRemarks?.value === 'string')
      ? draft.additionalRemarks.value.trim()
      : '';

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

  const isAdr =
    meta.template === 'IPC_ADR_V1_4' ||
    !!reactionStartDate ||
    !!reactionStopDate ||
    (typeof values.caseType === 'string' && values.caseType.trim().length > 0) ||
    (typeof values.reactionManagement === 'string' && values.reactionManagement.trim().length > 0) ||
    !values.diagnosis;

  if (!isAdr) {
    return {
      title: 'Patient Consultation Report',
      status: (meta.status || 'draft').toUpperCase(),
      createdAt: formatDateTime(now),
      generatedAt: formatDateTime(now),
      patient,
      sections,
      disclaimer: DISCLAIMER,
      fileName: `${slugify(values.patientName)}-${fileStamp(now)}.pdf`,
    };
  }

  return {
    template: 'IPC_ADR_V1_4',
    fileName: `${slugify(initials || 'patient-report')}-${fileStamp(now)}.pdf`,
    title: 'SUSPECTED ADVERSE DRUG REACTION REPORTING FORM',
    version: 'Version 1.4',
    generatedAt: formatDateTime(now),
    createdAt: meta.createdAt ? formatDateTime(meta.createdAt) : '',
    status: (meta.status || 'draft').toUpperCase(),

    sectionA: {
      caseType: caseType,
      patientInitials: initials,
      ageOrDob: ageDisplay || (dateOfBirth ? `DOB: ${dateOfBirth}` : ''),
      gender: gender,
      weightKg: weight,
    },

    sectionB: {
      reactionStartDate: reactionStartDate,
      reactionStopDate: reactionStopDate,
      description: combinedDescription,
    },

    sectionC: {},
    sectionD: {},
    additionalInformation: additionalInfo,
    amcNcc: {},

    patient,
    sections,
    disclaimer: DISCLAIMER,
  };
}


