export default {
  code: 'kn',
  reviewed: false,

  labels: {
    patientName: 'ರೋಗಿಯ ಹೆಸರು',
    age: 'ವಯಸ್ಸು',
    gender: 'ಲಿಂಗ',
    address: 'ವಿಳಾಸ',
    pinCode: 'ಪಿನ್ ಕೋಡ್',
    contactNumber: 'ಸಂಪರ್ಕ ಸಂಖ್ಯೆ',
    symptoms: 'ಲಕ್ಷಣಗಳು',
    medicalHistory: 'ವೈದ್ಯಕೀಯ ಇತಿಹಾಸ',
    diagnosis: 'ರೋಗನಿರ್ಣಯ',
    prescriptionNotes: 'ಔಷಧಿ ಸೂಚನೆಗಳು',
    additionalRemarks: 'ಹೆಚ್ಚುವರಿ ಟಿಪ್ಪಣಿ',
    patientInitials: 'ರೋಗಿಯ ಹೆಸರಿನ ಮೊದಲಕ್ಷರಗಳು',
    reactionStartDate: 'ಪ್ರತಿಕ್ರಿಯೆ ಪ್ರಾರಂಭವಾದ ದಿನಾಂಕ',
    reactionDescription: 'ಪ್ರತಿಕ್ರಿಯೆಯ ವಿವರಣೆ',
  },

  join: {
    separator: ', ',
    and: ' ಮತ್ತು ',
  },

  frames: {
    one: '{names} ಇನ್ನೂ ದಾಖಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಈ ಕಡ್ಡಾಯ ಮಾಹಿತಿಯನ್ನು ತಿಳಿಸಿ.',
    few: '{names} ಇನ್ನೂ ದಾಖಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಈ ಕಡ್ಡಾಯ ಮಾಹಿತಿಗಳನ್ನು ತಿಳಿಸಿ.',
    many:
      '{names}, ಮತ್ತು ಇನ್ನೂ {count} ಕಡ್ಡಾಯ {detailWord} ದಾಖಲಾಗಿಲ್ಲ. ' +
      'ದಯವಿಟ್ಟು ಉಳಿದ ಮಾಹಿತಿಯನ್ನು ತಿಳಿಸಿ.',
  },

  detailWord: { one: 'ಮಾಹಿತಿ', other: 'ಮಾಹಿತಿಗಳು' },
};
