export default {
  code: 'ne',
  reviewed: false,

  labels: {
    patientName: 'बिरामीको नाम',
    age: 'उमेर',
    gender: 'लिङ्ग',
    address: 'ठेगाना',
    pinCode: 'पिन कोड',
    contactNumber: 'सम्पर्क नम्बर',
    symptoms: 'लक्षणहरू',
    medicalHistory: 'चिकित्सकीय इतिहास',
    diagnosis: 'रोग निदान',
    prescriptionNotes: 'औषधिको निर्देशन',
    additionalRemarks: 'थप टिप्पणी',
    patientInitials: 'बिरामीको नामको सुरुका अक्षर',
    reactionStartDate: 'प्रतिक्रिया सुरु भएको मिति',
    reactionDescription: 'प्रतिक्रियाको विवरण',
  },

  join: {
    separator: ', ',
    and: ' र ',
  },

  frames: {
    one: '{names} अझै दर्ता भएको छैन। कृपया यो अनिवार्य विवरण भन्नुहोस्।',
    few: '{names} अझै दर्ता भएका छैनन्। कृपया यी अनिवार्य विवरणहरू भन्नुहोस्।',
    many:
      '{names}, र अन्य {count} अनिवार्य {detailWord} अझै दर्ता भएका छैनन्। ' +
      'कृपया बाँकी जानकारी भन्नुहोस्।',
  },

  detailWord: { one: 'विवरण', other: 'विवरणहरू' },
};
