import { CORE_ADR_FIELDS } from './patientFields.js';

/**
 * Presentation-only grouping for the report screen.
 *
 * Fields are referenced by key and resolved against CORE_ADR_FIELDS, which stays
 * the contract shared with extraction and UI presentation.
 */
const SECTION_DEFINITIONS = [
  {
    key: 'sectionA',
    title: 'A. Patient Information',
    icon: 'user',
    keys: ['caseType', 'patientName', 'age', 'dateOfBirth', 'gender', 'weight'],
  },
  {
    key: 'sectionB',
    title: 'B. Suspected Adverse Reaction',
    icon: 'alert-triangle',
    keys: [
      'reactionStartDate',
      'reactionStopDate',
      'reactionDescription',
      'reactionManagement',
    ],
  },
  {
    key: 'additional',
    title: 'Additional Information',
    icon: 'file-text',
    keys: ['additionalRemarks'],
  },
];

/** Short fields that read well two to a row on a phone. */
export const HALF_WIDTH = new Set([
  'caseType',
  'patientName',
  'age',
  'dateOfBirth',
  'gender',
  'weight',
  'reactionStartDate',
  'reactionStopDate',
]);

const fieldFor = key => CORE_ADR_FIELDS.find(field => field.key === key);

export const REPORT_SECTIONS = SECTION_DEFINITIONS.map(section => ({
  ...section,
  fields: section.keys.map(fieldFor).filter(Boolean),
}));

export default REPORT_SECTIONS;

