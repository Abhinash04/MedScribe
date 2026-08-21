export default {
  code: 'mr',
  reviewed: false,

  labels: {
    patientName: 'रुग्णाचे नाव',
    age: 'वय',
    gender: 'लिंग',
    address: 'पत्ता',
    pinCode: 'पिन कोड',
    contactNumber: 'संपर्क क्रमांक',
    symptoms: 'लक्षणे',
    medicalHistory: 'वैद्यकीय इतिहास',
    diagnosis: 'निदान',
    prescriptionNotes: 'औषधांच्या सूचना',
    additionalRemarks: 'अतिरिक्त टिप्पणी',
    patientInitials: 'रुग्णाच्या नावाची आद्याक्षरे',
    reactionStartDate: 'प्रतिक्रिया सुरू झाल्याची तारीख',
    reactionDescription: 'प्रतिक्रियेचे वर्णन',
  },

  join: {
    separator: ', ',
    and: ' आणि ',
  },

  frames: {
    one: '{names} अद्याप नोंदवलेले नाही. कृपया ही अनिवार्य माहिती सांगा.',
    few: '{names} अद्याप नोंदवलेले नाहीत. कृपया ही अनिवार्य माहिती सांगा.',
    many:
      '{names}, आणि इतर {count} अनिवार्य {detailWord} अद्याप नोंदवलेली नाही. ' +
      'कृपया उर्वरित माहिती सांगा.',
  },

  detailWord: { one: 'माहिती', other: 'माहिती' },
};
