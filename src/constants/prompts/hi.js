export default {
  code: 'hi',
  reviewed: false,

  labels: {
    patientName: 'रोगी का नाम',
    age: 'आयु',
    gender: 'लिंग',
    address: 'पता',
    pinCode: 'पिन कोड',
    contactNumber: 'संपर्क नंबर',
    symptoms: 'लक्षण',
    medicalHistory: 'चिकित्सा इतिहास',
    diagnosis: 'निदान',
    prescriptionNotes: 'दवा संबंधी निर्देश',
    additionalRemarks: 'अतिरिक्त टिप्पणी',
    patientInitials: 'रोगी के नाम के प्रथम अक्षर',
    reactionStartDate: 'प्रतिक्रिया शुरू होने की तारीख',
    reactionDescription: 'प्रतिक्रिया का विवरण',
  },

  join: { separator: ', ', and: ' और ' },

  frames: {
    one: '{names} अभी तक दर्ज नहीं है। कृपया यह अनिवार्य जानकारी बताइए।',
    few: '{names} अभी तक दर्ज नहीं हैं। कृपया ये अनिवार्य जानकारियाँ बताइए।',
    many:
      '{names}, और {count} अन्य अनिवार्य {detailWord} अभी तक दर्ज नहीं हैं। ' +
      'कृपया शेष जानकारी बताइए।',
  },

  detailWord: { one: 'जानकारी', other: 'जानकारियाँ' },
};
