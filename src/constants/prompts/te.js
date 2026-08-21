export default {
  code: 'te',
  reviewed: false,

  labels: {
    patientName: 'రోగి పేరు',
    age: 'వయస్సు',
    gender: 'లింగం',
    address: 'చిరునామా',
    pinCode: 'పిన్ కోడ్',
    contactNumber: 'సంప్రదింపు నంబరు',
    symptoms: 'లక్షణాలు',
    medicalHistory: 'వైద్య చరిత్ర',
    diagnosis: 'రోగ నిర్ధారణ',
    prescriptionNotes: 'మందుల సూచనలు',
    additionalRemarks: 'అదనపు వ్యాఖ్యలు',
    patientInitials: 'రోగి పేరులోని మొదటి అక్షరాలు',
    reactionStartDate: 'ప్రతిచర్య ప్రారంభమైన తేదీ',
    reactionDescription: 'ప్రతిచర్య వివరణ',
  },

  join: {
    separator: ', ',
    and: ' మరియు ',
  },

  frames: {
    one: '{names} ఇంకా నమోదు కాలేదు. దయచేసి ఈ తప్పనిసరి సమాచారాన్ని తెలియజేయండి.',
    few: '{names} ఇంకా నమోదు కాలేదు. దయచేసి ఈ తప్పనిసరి సమాచారాలను తెలియజేయండి.',
    many:
      '{names}, మరియు మరో {count} తప్పనిసరి {detailWord} ఇంకా నమోదు కాలేదు. ' +
      'దయచేసి మిగిలిన సమాచారాన్ని తెలియజేయండి.',
  },

  detailWord: { one: 'సమాచారం', other: 'సమాచారాలు' },
};
