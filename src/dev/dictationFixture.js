export const FIXTURE_SCRIPT =
  'Patient name is Hema Sharma. ' +
  'Age twenty two years. ' +
  'Gender female. ' +
  'Address is Sector twelve Dwarka New Delhi. ' +
  'PIN code one one zero zero seven eight. ' +
  'Contact number nine eight seven six five four three two one zero. ' +
  'Complains of fever cough and headache. ' +
  'Medical history of diabetes. ' +
  'Diagnosis is viral infection. ' +
  'Prescribed paracetamol five hundred milligram twice daily.';

/**
 * Each entry passes if ANY variant appears in the normalized transcript.
 * Variants cover both the spoken form and the digit form, because the engine
 * may return either and both are correct for the record.
 */
export const CRITICAL_VALUES = [
  { key: 'patientName', label: 'Patient name', variants: ['hema sharma'] },
  { key: 'age', label: 'Age', variants: ['twenty two years', '22 years', 'age 22'] },
  { key: 'gender', label: 'Gender', variants: ['female'] },
  { key: 'pinCode', label: 'PIN code', variants: ['110078', 'one one zero zero seven eight'] },
  {
    key: 'contactNumber',
    label: 'Contact number',
    variants: ['9876543210', 'nine eight seven six five four three two one zero'],
  },
  { key: 'medication', label: 'Medication', variants: ['paracetamol'] },
  { key: 'dosage', label: 'Dosage', variants: ['500 milligram', 'five hundred milligram', '500 mg'] },
  { key: 'diagnosis', label: 'Diagnosis', variants: ['viral infection'] },
];
