export default {
  code: 'pa',
  reviewed: false,

  labels: {
    patientName: 'ਮਰੀਜ਼ ਦਾ ਨਾਮ',
    age: 'ਉਮਰ',
    gender: 'ਲਿੰਗ',
    address: 'ਪਤਾ',
    pinCode: 'ਪਿੰਨ ਕੋਡ',
    contactNumber: 'ਸੰਪਰਕ ਨੰਬਰ',
    symptoms: 'ਲੱਛਣ',
    medicalHistory: 'ਡਾਕਟਰੀ ਇਤਿਹਾਸ',
    diagnosis: 'ਨਿਦਾਨ',
    prescriptionNotes: 'ਦਵਾਈ ਦੀਆਂ ਹਦਾਇਤਾਂ',
    additionalRemarks: 'ਵਾਧੂ ਟਿੱਪਣੀ',
    patientInitials: 'ਮਰੀਜ਼ ਦੇ ਨਾਮ ਦੇ ਪਹਿਲੇ ਅੱਖਰ',
    reactionStartDate: 'ਪ੍ਰਤੀਕਿਰਿਆ ਸ਼ੁਰੂ ਹੋਣ ਦੀ ਤਾਰੀਖ਼',
    reactionDescription: 'ਪ੍ਰਤੀਕਿਰਿਆ ਦਾ ਵੇਰਵਾ',
  },

  join: {
    separator: ', ',
    and: ' ਅਤੇ ',
  },

  frames: {
    one: '{names} ਅਜੇ ਤੱਕ ਦਰਜ ਨਹੀਂ ਹੋਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਇਹ ਲਾਜ਼ਮੀ ਜਾਣਕਾਰੀ ਦੱਸੋ।',
    few: '{names} ਅਜੇ ਤੱਕ ਦਰਜ ਨਹੀਂ ਹੋਏ। ਕਿਰਪਾ ਕਰਕੇ ਇਹ ਲਾਜ਼ਮੀ ਜਾਣਕਾਰੀਆਂ ਦੱਸੋ।',
    many:
      '{names}, ਅਤੇ ਹੋਰ {count} ਲਾਜ਼ਮੀ {detailWord} ਅਜੇ ਤੱਕ ਦਰਜ ਨਹੀਂ ਹੋਈਆਂ। ' +
      'ਕਿਰਪਾ ਕਰਕੇ ਬਾਕੀ ਜਾਣਕਾਰੀ ਦੱਸੋ।',
  },

  detailWord: { one: 'ਜਾਣਕਾਰੀ', other: 'ਜਾਣਕਾਰੀਆਂ' },
};
