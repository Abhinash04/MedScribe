export default {
  code: 'ur',
  reviewed: false,

  labels: {
    patientName: 'مریض کا نام',
    age: 'عمر',
    gender: 'جنس',
    address: 'پتہ',
    pinCode: 'پن کوڈ',
    contactNumber: 'رابطہ نمبر',
    symptoms: 'علامات',
    medicalHistory: 'طبی تاریخ',
    diagnosis: 'تشخیص',
    prescriptionNotes: 'دوا کی ہدایات',
    additionalRemarks: 'اضافی تبصرہ',
    patientInitials: 'مریض کے نام کے ابتدائی حروف',
    reactionStartDate: 'ردعمل شروع ہونے کی تاریخ',
    reactionDescription: 'ردعمل کی تفصیل',
  },

  join: {
    separator: ', ',
    and: ' اور ',
  },

  frames: {
    one: '{names} ابھی تک درج نہیں ہوا۔ براہ کرم یہ لازمی تفصیل بتائیں۔',
    few: '{names} ابھی تک درج نہیں ہوئے۔ براہ کرم یہ لازمی تفصیلات بتائیں۔',
    many:
      '{names}، اور مزید {count} لازمی {detailWord} ابھی تک درج نہیں ہوئیں۔ ' +
      'براہ کرم باقی معلومات بتائیں۔',
  },

  detailWord: { one: 'تفصیل', other: 'تفصیلات' },
};
