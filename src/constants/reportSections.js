import { PATIENT_FIELDS } from './patientFields.js';

/**
 * Presentation-only grouping for the report screen.
 *
 * Fields are referenced by key and resolved against PATIENT_FIELDS, which stays
 * the single contract shared with extraction, completeness and PDF export.
 */
const SECTION_DEFINITIONS = [
  {
    key: 'patient',
    title: 'Patient Details',
    icon: 'user',
    keys: [
      'patientName',
      'age',
      'gender',
      'address',
      'pinCode',
      'contactNumber',
    ],
  },
  {
    key: 'clinical',
    title: 'Clinical',
    icon: 'activity',
    keys: ['symptoms', 'medicalHistory', 'diagnosis', 'prescriptionNotes'],
  },
  {
    key: 'additional',
    title: 'Additional',
    icon: 'edit-3',
    keys: ['additionalRemarks'],
  },
];

/** Short fields that read well two to a row on a phone. */
export const HALF_WIDTH = new Set([
  'age',
  'gender',
  'pinCode',
  'contactNumber',
]);

const fieldFor = key => PATIENT_FIELDS.find(field => field.key === key);

export const REPORT_SECTIONS = SECTION_DEFINITIONS.map(section => ({
  ...section,
  fields: section.keys.map(fieldFor).filter(Boolean),
}));

export default REPORT_SECTIONS;
