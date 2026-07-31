/**
 * The eleven patient fields defined by SRS FR-5, in the display order used by
 * the structured report (FR-6).
 *
 * `list: true` marks fields rendered as bullet points rather than a paragraph.
 *
 * `multiline` and `keyboard` only affect the editable report rows; extraction
 * never reads them. Marker vocabulary stays in `fieldMarkers.js`.
 */
export const PATIENT_FIELDS = [
  { key: 'patientName', label: 'Patient Name' },
  { key: 'age', label: 'Age', keyboard: 'number-pad' },
  { key: 'gender', label: 'Gender' },
  { key: 'address', label: 'Address', multiline: true },
  { key: 'pinCode', label: 'PIN Code', keyboard: 'number-pad' },
  { key: 'contactNumber', label: 'Contact Number', keyboard: 'phone-pad' },
  { key: 'symptoms', label: 'Symptoms', list: true },
  { key: 'medicalHistory', label: 'Medical History', multiline: true },
  { key: 'diagnosis', label: 'Diagnosis', multiline: true },
  { key: 'prescriptionNotes', label: 'Prescription Notes', multiline: true },
  { key: 'additionalRemarks', label: 'Additional Remarks', multiline: true },
];

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
