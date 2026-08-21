export default {
  code: 'or',
  reviewed: false,

  labels: {
    patientName: 'ରୋଗୀଙ୍କ ନାମ',
    age: 'ବୟସ',
    gender: 'ଲିଙ୍ଗ',
    address: 'ଠିକଣା',
    pinCode: 'ପିନ୍ କୋଡ୍',
    contactNumber: 'ଯୋଗାଯୋଗ ନମ୍ବର',
    symptoms: 'ଲକ୍ଷଣ',
    medicalHistory: 'ଚିକିତ୍ସା ଇତିହାସ',
    diagnosis: 'ରୋଗ ନିର୍ଣ୍ଣୟ',
    prescriptionNotes: 'ଔଷଧ ନିର୍ଦ୍ଦେଶ',
    additionalRemarks: 'ଅତିରିକ୍ତ ମନ୍ତବ୍ୟ',
    patientInitials: 'ରୋଗୀଙ୍କ ନାମର ଆଦ୍ୟାକ୍ଷର',
    reactionStartDate: 'ପ୍ରତିକ୍ରିୟା ଆରମ୍ଭ ତାରିଖ',
    reactionDescription: 'ପ୍ରତିକ୍ରିୟାର ବିବରଣୀ',
  },

  join: {
    separator: ', ',
    and: ' ଏବଂ ',
  },

  frames: {
    one: '{names} ଏପର୍ଯ୍ୟନ୍ତ ମିଳିନାହିଁ। ଦୟାକରି ଏହି ବାଧ୍ୟତାମୂଳକ ତଥ୍ୟ ଜଣାନ୍ତୁ।',
    few: '{names} ଏପର୍ଯ୍ୟନ୍ତ ମିଳିନାହିଁ। ଦୟାକରି ଏହି ବାଧ୍ୟତାମୂଳକ ତଥ୍ୟଗୁଡ଼ିକ ଜଣାନ୍ତୁ।',
    many:
      '{names}, ଏବଂ ଆଉ {count} ଟି ବାଧ୍ୟତାମୂଳକ {detailWord} ଏପର୍ଯ୍ୟନ୍ତ ' +
      'ମିଳିନାହିଁ। ଦୟାକରି ବାକି ସୂଚନା ଜଣାନ୍ତୁ।',
  },

  detailWord: { one: 'ତଥ୍ୟ', other: 'ତଥ୍ୟ' },
};
