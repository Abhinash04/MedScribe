/**
 * The eleven patient fields defined by SRS FR-5, in the display order used by
 * the structured report (FR-6).
 *
 * `list: true` marks fields rendered as bullet points rather than a paragraph.
 */
export const PATIENT_FIELDS = [
  { key: 'patientName', label: 'Patient Name' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'address', label: 'Address' },
  { key: 'pinCode', label: 'PIN Code' },
  { key: 'contactNumber', label: 'Contact Number' },
  { key: 'symptoms', label: 'Symptoms', list: true },
  { key: 'medicalHistory', label: 'Medical History' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'prescriptionNotes', label: 'Prescription Notes' },
  { key: 'additionalRemarks', label: 'Additional Remarks' },
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
