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
    label: 'Additional Remarks',
    multiline: true,
    required: false,
  },
];

export const REQUIRED_FIELDS = PATIENT_FIELDS.filter(field => field.required);

export const NOT_AVAILABLE = 'Not Available';

export const EMPTY_PATIENT_RECORD = PATIENT_FIELDS.reduce((acc, field) => {
  acc[field.key] = field.list ? [] : '';
  return acc;
}, {});
