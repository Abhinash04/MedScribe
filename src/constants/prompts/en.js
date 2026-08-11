export default {
  code: 'en',
  reviewed: true,

  labels: {
    patientName: 'patient name',
    age: 'age',
    gender: 'gender',
    address: 'address',
    pinCode: 'PIN code',
    contactNumber: 'contact number',
    symptoms: 'symptoms',
    medicalHistory: 'medical history',
    diagnosis: 'diagnosis',
    prescriptionNotes: 'prescription notes',
    additionalRemarks: 'additional remarks',
  },

  join: { separator: ', ', and: ' and ' },

  frames: {
    one: 'The {names} is still missing. Please provide this mandatory detail.',
    few: 'The {names} are still missing. Please provide these mandatory details.',
    many:
      'The {names}, and {count} other mandatory {detailWord} are still ' +
      'missing. Please provide the missing information.',
  },

  detailWord: { one: 'detail', other: 'details' },
};
