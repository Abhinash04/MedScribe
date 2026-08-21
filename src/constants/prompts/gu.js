export default {
  code: 'gu',
  reviewed: false,

  labels: {
    patientName: 'દર્દીનું નામ',
    age: 'ઉંમર',
    gender: 'લિંગ',
    address: 'સરનામું',
    pinCode: 'પિન કોડ',
    contactNumber: 'સંપર્ક નંબર',
    symptoms: 'લક્ષણો',
    medicalHistory: 'તબીબી ઇતિહાસ',
    diagnosis: 'નિદાન',
    prescriptionNotes: 'દવાની સૂચનાઓ',
    additionalRemarks: 'વધારાની ટિપ્પણી',
    patientInitials: 'દર્દીના નામના પ્રથમ અક્ષરો',
    reactionStartDate: 'પ્રતિક્રિયા શરૂ થયાની તારીખ',
    reactionDescription: 'પ્રતિક્રિયાનું વર્ણન',
  },

  join: {
    separator: ', ',
    and: ' અને ',
  },

  frames: {
    one: '{names} હજુ સુધી નોંધાયેલ નથી. કૃપા કરીને આ ફરજિયાત માહિતી જણાવો.',
    few: '{names} હજુ સુધી નોંધાયેલ નથી. કૃપા કરીને આ ફરજિયાત માહિતી જણાવો.',
    many:
      '{names}, અને બીજી {count} ફરજિયાત {detailWord} હજુ સુધી નોંધાયેલ નથી. ' +
      'કૃપા કરીને બાકીની માહિતી જણાવો.',
  },

  detailWord: { one: 'માહિતી', other: 'માહિતી' },
};
