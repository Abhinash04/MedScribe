/**
 * The eleven patient fields defined by SRS FR-5, in the display order used by
 * the structured report (FR-6).
 *
 * `list: true` marks fields rendered as bullet points rather than a paragraph.
 *
 * `multiline` and `keyboard` only affect the editable report rows; extraction
 * never reads them. Marker vocabulary stays in `fieldMarkers.js`.
 *
 * `required` is the single source of truth for report completeness. Ten fields
 * block report generation until they hold a value that passes their validator;
 * Additional Remarks is the doctor's own note and never blocks anything.
 */
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

/**
 * SRS FR-7: a field absent from the dictation is shown explicitly rather than
 * left blank, so the doctor can see what still needs capturing.
 */
export const NOT_AVAILABLE = 'Not Available';

/** An empty result shaped like a full extraction — every field unset. */
export const EMPTY_PATIENT_RECORD = PATIENT_FIELDS.reduce((acc, field) => {
  acc[field.key] = field.list ? [] : '';
  return acc;
}, {});
