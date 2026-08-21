export default {
  code: 'bn',
  reviewed: false,

  labels: {
    patientName: 'রোগীর নাম',
    age: 'বয়স',
    gender: 'লিঙ্গ',
    address: 'ঠিকানা',
    pinCode: 'পিন কোড',
    contactNumber: 'যোগাযোগ নম্বর',
    symptoms: 'উপসর্গ',
    medicalHistory: 'চিকিৎসা ইতিহাস',
    diagnosis: 'রোগ নির্ণয়',
    prescriptionNotes: 'ওষুধের নির্দেশ',
    additionalRemarks: 'অতিরিক্ত মন্তব্য',
    patientInitials: 'রোগীর নামের আদ্যক্ষর',
    reactionStartDate: 'প্রতিক্রিয়া শুরুর তারিখ',
    reactionDescription: 'প্রতিক্রিয়ার বিবরণ',
  },

  join: {
    separator: ', ',
    and: ' এবং ',
  },

  frames: {
    one: '{names} এখনও নথিভুক্ত হয়নি। অনুগ্রহ করে এই বাধ্যতামূলক তথ্যটি জানান।',
    few: '{names} এখনও নথিভুক্ত হয়নি। অনুগ্রহ করে এই বাধ্যতামূলক তথ্যগুলি জানান।',
    many:
      '{names}, এবং আরও {count} টি বাধ্যতামূলক {detailWord} এখনও নথিভুক্ত ' +
      'হয়নি। অনুগ্রহ করে বাকি তথ্য জানান।',
  },

  detailWord: { one: 'তথ্য', other: 'তথ্য' },
};
