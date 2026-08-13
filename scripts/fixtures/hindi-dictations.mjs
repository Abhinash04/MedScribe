export const HINDI_SAMPLES = [
  {
    id: 1,
    title: 'Standard dictation',
    hindi:
      'रोगी का नाम राहुल शर्मा है। उम्र 34 वर्ष है। लिंग पुरुष है। पता है मकान नंबर 24, ' +
      'सेक्टर 10, नोएडा, उत्तर प्रदेश। पिन कोड 201301 है। संपर्क नंबर 9876543210 है। ' +
      'पिछले तीन दिनों से बुखार, सूखी खांसी, सिरदर्द और कमजोरी की शिकायत है। पहले से ' +
      'मधुमेह की बीमारी है। निदान वायरल फीवर है। दवा में पैरासिटामोल 500 मिलीग्राम दिन ' +
      'में दो बार पाँच दिनों तक और कफ सिरप दिन में दो बार लेने की सलाह दी जाती है। ' +
      'अतिरिक्त सलाह: पर्याप्त पानी पिएं, पूरा आराम करें और तीन दिन बाद पुनः जांच के ' +
      'लिए आएं।',
    expect: {
      patientName: 'Rahul',
      age: '34',
      gender: 'male',
      address: 'Noida',
      pinCode: '201301',
      contactNumber: '9876543210',
      symptoms: 'fever',
      medicalHistory: 'diabet',
      diagnosis: 'viral fever',
      prescriptionNotes: 'paracetamol',
      additionalRemarks: 'rest',
    },
    preserve: ['201301', '9876543210', '34', '500'],
  },
  {
    id: 2,
    title: 'Diagnosis first, random order',
    hindi:
      'निदान सामान्य सर्दी है। दवा में पैरासिटामोल 500 मिलीग्राम दिन में दो बार और कफ ' +
      'सिरप रात में एक बार तीन दिनों तक लेने की सलाह है। रोगी का नाम प्रिया वर्मा है। ' +
      'संपर्क नंबर 9812345678 है। उम्र 27 वर्ष है और लिंग महिला है। लक्षणों में नाक बहना, ' +
      'हल्का बुखार, छींक आना और गले में खराश शामिल हैं। पहले से अस्थमा की बीमारी है। ' +
      'पता है मकान नंबर 18, रोहिणी सेक्टर 7, नई दिल्ली। पिन कोड 110085 है। अतिरिक्त ' +
      'सलाह: दिन में दो बार भाप लें, गर्म तरल पदार्थ पिएं और यदि पाँच दिनों तक लक्षण ' +
      'बने रहें तो पुनः परामर्श के लिए आएं।',
    expect: {
      patientName: 'Priya',
      age: '27',
      gender: 'female',
      address: 'Delhi',
      pinCode: '110085',
      contactNumber: '9812345678',
      symptoms: 'nose',
      medicalHistory: 'asthma',
      diagnosis: 'cold',
      prescriptionNotes: 'paracetamol',
      additionalRemarks: 'steam',
    },
    preserve: ['110085', '9812345678', '27', '500'],
  },
  {
    id: 3,
    title: 'Conversational speech',
    hindi:
      'यह अमित कुमार हैं। इनकी उम्र 42 वर्ष है। इन्हें कल से बुखार, शरीर में दर्द, सिरदर्द ' +
      'और थकान की शिकायत है। इन्हें पहले से मधुमेह है। इनका पता फ्लैट नंबर 12, ग्रीन ' +
      'पार्क, नई दिल्ली है। पिन कोड 110016 है और इनका मोबाइल नंबर 9898765432 है। ' +
      'लिंग पुरुष है। यह वायरल फीवर प्रतीत होता है। मैं पैरासिटामोल 650 मिलीग्राम दिन ' +
      'में दो बार तीन दिनों तक और विटामिन की गोली दिन में एक बार लेने की सलाह देता ' +
      'हूँ। अतिरिक्त सलाह: अधिक मात्रा में तरल पदार्थ लें, पूरा आराम करें और तीन दिन ' +
      'बाद पुनः जांच के लिए आएं।',
    expect: {
      patientName: 'Amit',
      age: '42',
      gender: 'male',
      address: 'Park, New Delhi',
      pinCode: '110016',
      contactNumber: '9898765432',
      symptoms: 'fever',
      medicalHistory: 'diabet',
      diagnosis: 'viral fever',
      prescriptionNotes: 'paracetamol',
      additionalRemarks: 'rest',
    },
    preserve: ['110016', '9898765432', '42', '650'],
  },
];

export const sampleById = id =>
  HINDI_SAMPLES.find(sample => String(sample.id) === String(id)) ?? null;
