export default {
  code: 'ta',
  reviewed: false,

  labels: {
    patientName: 'நோயாளியின் பெயர்',
    age: 'வயது',
    gender: 'பாலினம்',
    address: 'முகவரி',
    pinCode: 'பின் குறியீடு',
    contactNumber: 'தொடர்பு எண்',
    symptoms: 'அறிகுறிகள்',
    medicalHistory: 'மருத்துவ வரலாறு',
    diagnosis: 'நோய் கண்டறிதல்',
    prescriptionNotes: 'மருந்து அறிவுரைகள்',
    additionalRemarks: 'கூடுதல் குறிப்புகள்',
    patientInitials: 'நோயாளியின் பெயரின் முதலெழுத்துகள்',
    reactionStartDate: 'எதிர்வினை தொடங்கிய தேதி',
    reactionDescription: 'எதிர்வினையின் விவரம்',
  },

  join: {
    separator: ', ',
    and: ' மற்றும் ',
  },

  frames: {
    one: '{names} இன்னும் பதிவு செய்யப்படவில்லை. இந்த கட்டாய தகவலைத் தெரிவிக்கவும்.',
    few: '{names} இன்னும் பதிவு செய்யப்படவில்லை. இந்த கட்டாய தகவல்களைத் தெரிவிக்கவும்.',
    many:
      '{names}, மற்றும் மேலும் {count} கட்டாய {detailWord} இன்னும் பதிவு ' +
      'செய்யப்படவில்லை. மீதமுள்ள தகவல்களைத் தெரிவிக்கவும்.',
  },

  detailWord: { one: 'தகவல்', other: 'தகவல்கள்' },
};
