export const PATIENT_FIELDS = [
  { key: 'patientName', label: 'Patient Name', required: true },
  { key: 'age', label: 'Age', keyboard: 'number-pad', required: true },
  { key: 'gender', label: 'Gender', required: true },
  { key: 'address', label: 'Address', multiline: true, required: true },
  { key: 'pinCode', label: 'PIN Code', keyboard: 'number-pad', required: true },
  {
    key: 'contactNumber',
    label: 'Contact Number',
    keyboard: 'phone-pad',
    required: true,
  },
  { key: 'symptoms', label: 'Symptoms', list: true, required: true },
  {
    key: 'medicalHistory',
    label: 'Medical History',
    multiline: true,
    required: true,
  },
  { key: 'diagnosis', label: 'Diagnosis', multiline: true, required: true },
  {
    key: 'prescriptionNotes',
    label: 'Prescription Notes',
    list: true,
    required: true,
  },
  {
    key: 'additionalRemarks',
    label: 'Additional Information',
    multiline: true,
    required: false,
  },
];

export const CORE_ADR_FIELDS = [
  { key: 'caseType', label: 'Case Type', placeholder: 'Initial / Follow-up', required: false },
  { key: 'patientName', label: 'Patient Name', required: true },
  { key: 'age', label: 'Age', keyboard: 'number-pad', required: true },
  { key: 'dateOfBirth', label: 'Date of Birth', placeholder: 'DD/MM/YYYY', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'weight', label: 'Weight (kg)', keyboard: 'decimal-pad', required: false },
  { key: 'reactionStartDate', label: 'Event / Reaction Start Date', placeholder: 'DD/MM/YYYY', required: true },
  { key: 'reactionStopDate', label: 'Event / Reaction Stop Date', placeholder: 'DD/MM/YYYY', required: false },
  { key: 'reactionDescription', label: 'Describe Event / Reaction', multiline: true, required: true },
  { key: 'reactionManagement', label: 'Management With Details, If Any', multiline: true, required: false },
  { key: 'additionalRemarks', label: 'Additional Information', multiline: true, required: false },
];

export const REQUIRED_FIELDS = PATIENT_FIELDS.filter(field => field.required);

export const NOT_AVAILABLE = 'Not Available';

export const EMPTY_PATIENT_RECORD = PATIENT_FIELDS.reduce((acc, field) => {
  acc[field.key] = field.list ? [] : '';
  return acc;
}, {});

