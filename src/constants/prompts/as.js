export default {
  code: 'as',
  reviewed: false,

  labels: {
    patientName: 'ৰোগীৰ নাম',
    age: 'বয়স',
    gender: 'লিংগ',
    address: 'ঠিকনা',
    pinCode: 'পিন কোড',
    contactNumber: 'যোগাযোগ নম্বৰ',
    symptoms: 'লক্ষণ',
    medicalHistory: 'চিকিৎসাৰ ইতিহাস',
    diagnosis: 'ৰোগ নিৰ্ণয়',
    prescriptionNotes: 'ঔষধৰ নিৰ্দেশ',
    additionalRemarks: 'অতিৰিক্ত মন্তব্য',
    patientInitials: 'ৰোগীৰ নামৰ আদ্যক্ষৰ',
    reactionStartDate: 'প্ৰতিক্ৰিয়া আৰম্ভৰ তাৰিখ',
    reactionDescription: 'প্ৰতিক্ৰিয়াৰ বিৱৰণ',
  },

  join: {
    separator: ', ',
    and: ' আৰু ',
  },

  frames: {
    one: '{names} এতিয়াও লিপিবদ্ধ হোৱা নাই। অনুগ্ৰহ কৰি এই বাধ্যতামূলক তথ্যটো দিয়ক।',
    few: '{names} এতিয়াও লিপিবদ্ধ হোৱা নাই। অনুগ্ৰহ কৰি এই বাধ্যতামূলক তথ্যবোৰ দিয়ক।',
    many:
      '{names}, আৰু আন {count} টা বাধ্যতামূলক {detailWord} এতিয়াও লিপিবদ্ধ ' +
      'হোৱা নাই। অনুগ্ৰহ কৰি বাকী তথ্য দিয়ক।',
  },

  detailWord: { one: 'তথ্য', other: 'তথ্য' },
};
