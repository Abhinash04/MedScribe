export default {
  code: 'ml',
  reviewed: false,

  labels: {
    patientName: 'രോഗിയുടെ പേര്',
    age: 'വയസ്സ്',
    gender: 'ലിംഗം',
    address: 'വിലാസം',
    pinCode: 'പിൻ കോഡ്',
    contactNumber: 'ബന്ധപ്പെടാനുള്ള നമ്പർ',
    symptoms: 'ലക്ഷണങ്ങൾ',
    medicalHistory: 'ചികിത്സാ ചരിത്രം',
    diagnosis: 'രോഗനിർണയം',
    prescriptionNotes: 'മരുന്ന് നിർദ്ദേശങ്ങൾ',
    additionalRemarks: 'അധിക കുറിപ്പുകൾ',
    patientInitials: 'രോഗിയുടെ പേരിന്റെ ആദ്യാക്ഷരങ്ങൾ',
    reactionStartDate: 'പ്രതികരണം തുടങ്ങിയ തീയതി',
    reactionDescription: 'പ്രതികരണത്തിന്റെ വിവരണം',
  },

  join: {
    separator: ', ',
    and: ' ഒപ്പം ',
  },

  frames: {
    one: '{names} ഇതുവരെ രേഖപ്പെടുത്തിയിട്ടില്ല. ദയവായി ഈ നിർബന്ധിത വിവരം പറയുക.',
    few: '{names} ഇതുവരെ രേഖപ്പെടുത്തിയിട്ടില്ല. ദയവായി ഈ നിർബന്ധിത വിവരങ്ങൾ പറയുക.',
    many:
      '{names}, കൂടാതെ മറ്റ് {count} നിർബന്ധിത {detailWord} ഇതുവരെ ' +
      'രേഖപ്പെടുത്തിയിട്ടില്ല. ദയവായി ബാക്കി വിവരങ്ങൾ പറയുക.',
  },

  detailWord: { one: 'വിവരം', other: 'വിവരങ്ങൾ' },
};
