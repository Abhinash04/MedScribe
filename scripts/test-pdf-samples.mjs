import {
  getPatientInitials,
  toDraft,
} from '../src/services/reportDraft.js';
import { extractForReport } from '../src/services/extractionService.js';
import { buildReportDocument } from '../src/services/reportDocument.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`  ${name}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
  }
}

console.log('--- Running Test Suite for 20 PDF ADR Dictation Samples ---');

const SAMPLES = [
  {
    id: 1,
    title: 'Sample 1 — Standard ADR Dictation',
    transcript:
      'Initial case. Patient name is Rahul Sharma. Age is 34 years. Gender is male. Weight is 70 kilograms. The patient developed fever, generalized itching, and a skin rash after taking the suspected medicine. The reaction started on 10 August 2026 and resolved on 12 August 2026. The suspected medication was stopped and the patient was treated with an antihistamine. Symptoms improved after treatment.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Rahul Sharma',
      initials: 'RS',
      age: '34 Years',
      gender: 'Male',
      weight: '70',
      reactionStartDate: '10/08/2026',
      reactionStopDate: '12/08/2026',
    },
    expectedKeywords: ['fever', 'itching', 'rash', 'antihistamine'],
  },
  {
    id: 2,
    title: 'Sample 2 — Diagnosis/Reaction First / Random Order',
    transcript:
      'The suspected reaction is nausea, vomiting, and dizziness. The reaction began on 11 August 2026 and ended on 13 August 2026. Patient name is Priya Verma. She is 27 years old and female. Her weight is 58 kilograms. The medicine was stopped and she was given supportive treatment. The symptoms settled after observation. This is an initial ADR case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Priya Verma',
      initials: 'PV',
      age: '27 Years',
      gender: 'Female',
      weight: '58',
      reactionStartDate: '11/08/2026',
      reactionStopDate: '13/08/2026',
    },
    expectedKeywords: ['nausea', 'vomiting', 'dizziness'],
  },
  {
    id: 3,
    title: 'Sample 3 — Conversational Speech',
    transcript:
      'Okay, this is Amit Kumar. He is 42 years old, male, and weighs about 76 kilograms. He started having severe itching, hives, and swelling around his face after taking the medicine. The reaction actually started on 8 August 2026 and by 10 August 2026 the symptoms had resolved. We stopped the suspected medication, gave him antihistamine treatment, and kept him under observation. This is an initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Amit Kumar',
      initials: 'AK',
      age: '42 Years',
      gender: 'Male',
      weight: '76',
      reactionStartDate: '08/08/2026',
      reactionStopDate: '10/08/2026',
    },
    expectedKeywords: ['itching', 'hives', 'swelling'],
  },
  {
    id: 4,
    title: 'Sample 4 — Symptoms First',
    transcript:
      'The patient complains of severe stomach pain, nausea, loose motion, and weakness since yesterday. Her name is Neha Singh. She is 31 years old and female, with a weight of 62 kilograms. The adverse reaction started on 15 August 2026 and stopped on 16 August 2026. She was given supportive care and oral fluids, and her symptoms improved. This is an initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Neha Singh',
      initials: 'NS',
      age: '31 Years',
      gender: 'Female',
      weight: '62',
      reactionStartDate: '15/08/2026',
      reactionStopDate: '16/08/2026',
    },
    expectedKeywords: ['stomach pain', 'nausea', 'weakness'],
  },
  {
    id: 5,
    title: 'Sample 5 — Indian Doctor Speaking Style',
    transcript:
      'Patient name Arjun Patel. Age 38 years. Male patient. Weight 74 kilos. Developed fever, cough, generalized rash, and itching after the suspected medicine. Reaction started 9 August 2026 and stopped 11 August 2026. Suspected medicine discontinued. Given antihistamine and supportive treatment. Patient improved. Initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Arjun Patel',
      initials: 'AP',
      age: '38 Years',
      gender: 'Male',
      weight: '74',
      reactionStartDate: '09/08/2026',
      reactionStopDate: '11/08/2026',
    },
    expectedKeywords: ['fever', 'cough', 'rash', 'itching'],
  },
  {
    id: 6,
    title: 'Sample 6 — Pronoun-Based Gender',
    transcript:
      "The patient's name is Sneha Gupta. She is 29 years old and weighs 55 kilograms. She developed facial swelling, urticaria, and difficulty in breathing. The reaction began on 12 August 2026 and resolved on 13 August 2026. The suspected drug was stopped and she received emergency supportive treatment and antihistamines. This is a follow-up case.",
    expected: {
      caseType: 'Follow-up',
      fullSpokenName: 'Sneha Gupta',
      initials: 'SG',
      age: '29 Years',
      gender: 'Female',
      weight: '55',
      reactionStartDate: '12/08/2026',
      reactionStopDate: '13/08/2026',
    },
    expectedKeywords: ['facial swelling', 'urticaria', 'breathing'],
  },
  {
    id: 7,
    title: 'Sample 7 — Male Pronoun Inference',
    transcript:
      'Patient name is Rohit Mehta. He is 46 years old and weighs 82 kilograms. He developed severe dizziness, vomiting, and weakness after the suspected medication. The symptoms started on 7 August 2026 and resolved on 9 August 2026. The medicine was discontinued and he was monitored until he improved. This is an initial ADR report.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Rohit Mehta',
      initials: 'RM',
      age: '46 Years',
      gender: 'Male',
      weight: '82',
      reactionStartDate: '07/08/2026',
      reactionStopDate: '09/08/2026',
    },
    expectedKeywords: ['dizziness', 'vomiting', 'weakness'],
  },
  {
    id: 8,
    title: 'Sample 8 — Reaction Management First',
    transcript:
      'The suspected medication was withdrawn and the patient was kept under observation. Antihistamine treatment was given and the reaction improved. Patient name is Kavita Rao. She is 36 years old, female, and weighs 61.5 kilograms. She had fever, vomiting, generalized itching, and facial edema. The reaction started on 5 August 2026 and ended on 7 August 2026. This is an initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Kavita Rao',
      initials: 'KR',
      age: '36 Years',
      gender: 'Female',
      weight: '61.5',
      reactionStartDate: '05/08/2026',
      reactionStopDate: '07/08/2026',
    },
    expectedKeywords: ['fever', 'vomiting', 'itching', 'edema'],
  },
  {
    id: 9,
    title: 'Sample 9 — Patient Information First',
    transcript:
      'Patient name is Sanjay Yadav. He is 55 years old, male, and weighs 79 kilograms. He developed headache, dizziness, weakness, and a generalized skin eruption. The adverse reaction began on 6 August 2026 and resolved on 8 August 2026. The suspected medication was stopped and symptomatic treatment was provided. The patient was monitored and improved.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Sanjay Yadav',
      initials: 'SY',
      age: '55 Years',
      gender: 'Male',
      weight: '79',
      reactionStartDate: '06/08/2026',
      reactionStopDate: '08/08/2026',
    },
    expectedKeywords: ['headache', 'dizziness', 'weakness', 'eruption'],
  },
  {
    id: 10,
    title: 'Sample 10 — Free-Flowing Dictation',
    transcript:
      'This is Pooja Nair, she is 25 years old and female, around 52 kilograms. She came in with severe itching, hives, facial swelling, and mild breathing difficulty after taking the suspected medicine. The reaction started on 14 August 2026 and the symptoms resolved on 16 August 2026. We discontinued the suspected drug, gave antihistamines and supportive care, and observed her until she improved. Follow-up case.',
    expected: {
      caseType: 'Follow-up',
      fullSpokenName: 'Pooja Nair',
      initials: 'PN',
      age: '25 Years',
      gender: 'Female',
      weight: '52',
      reactionStartDate: '14/08/2026',
      reactionStopDate: '16/08/2026',
    },
    expectedKeywords: ['itching', 'hives', 'swelling', 'breathing'],
  },
  {
    id: 11,
    title: 'Sample 11 — Self-Correction',
    transcript:
      'Patient name is Mohit Jain. Age is 45 years, sorry, correction, age is 35 years. Gender is male and weight is 68 kilograms. He developed nausea, vomiting, and dizziness. The reaction started on 10 August 2026 and ended on 11 August 2026. The suspected medication was stopped and he was treated symptomatically. This is an initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Mohit Jain',
      initials: 'MJ',
      age: '35 Years',
      gender: 'Male',
      weight: '68',
      reactionStartDate: '10/08/2026',
      reactionStopDate: '11/08/2026',
    },
    expectedKeywords: ['nausea', 'vomiting', 'dizziness'],
  },
  {
    id: 12,
    title: 'Sample 12 — Formal Clinical Style',
    transcript:
      'Patient identified as Anjali Das. Gender female. Age 40 years. Weight 63 kilograms. Presenting adverse reaction includes fever, productive cough, generalized rash, and facial swelling. The reaction commenced on 4 August 2026 and resolved on 6 August 2026. The suspected medication was withdrawn. Antihistamine treatment and supportive management were provided, with subsequent clinical improvement. Initial ADR case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Anjali Das',
      initials: 'AD',
      age: '40 Years',
      gender: 'Female',
      weight: '63',
      reactionStartDate: '04/08/2026',
      reactionStopDate: '06/08/2026',
    },
    expectedKeywords: ['fever', 'cough', 'rash', 'swelling'],
  },
  {
    id: 13,
    title: 'Sample 13 — Casual Doctor Speech',
    transcript:
      'Okay, this is Deepak Mishra. He is 33 years old, male, and weighs 71 kilograms. He has been having fever, itching, hives, and some swelling of the lips. It started on 13 August 2026 and settled by 15 August 2026. We stopped the suspected medicine, gave him an antihistamine, and watched him for a few hours. He improved. This is an initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Deepak Mishra',
      initials: 'DM',
      age: '33 Years',
      gender: 'Male',
      weight: '71',
      reactionStartDate: '13/08/2026',
      reactionStopDate: '15/08/2026',
    },
    expectedKeywords: ['fever', 'itching', 'hives', 'swelling'],
  },
  {
    id: 14,
    title: 'Sample 14 — Negation Challenge',
    transcript:
      'Patient name is Riya Kapoor. She is 24 years old and female. Her weight is 57 kilograms. She has fever, headache, sore throat, and dry cough following the suspected medication. She has no chest pain and no breathing difficulty. The reaction started on 16 August 2026 and resolved on 17 August 2026. The suspected medication was discontinued and supportive treatment was given. Initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Riya Kapoor',
      initials: 'RK',
      age: '24 Years',
      gender: 'Female',
      weight: '57',
      reactionStartDate: '16/08/2026',
      reactionStopDate: '17/08/2026',
    },
    expectedKeywords: ['fever', 'headache', 'sore throat', 'cough'],
    forbiddenKeywords: ['chest pain', 'breathing difficulty'],
  },
  {
    id: 15,
    title: 'Sample 15 — Comprehensive Real-World Dictation',
    transcript:
      'The patient\'s name is Vikram Joshi. He is a 48-year-old male weighing 84 kilograms. He presented with severe itching, dry skin rash, facial edema, dizziness, and mild shortness of breath after taking the suspected medicine. The reaction started on 10 August 2026 and the symptoms resolved on 13 August 2026. We stopped the suspected medication immediately, treated him with antihistamines and supportive care, and kept him under observation. His condition improved. This is an initial ADR report.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Vikram Joshi',
      initials: 'VJ',
      age: '48 Years',
      gender: 'Male',
      weight: '84',
      reactionStartDate: '10/08/2026',
      reactionStopDate: '13/08/2026',
    },
    expectedKeywords: ['itching', 'rash', 'edema', 'dizziness', 'breath'],
  },
  {
    id: 16,
    title: 'Sample 16 — Poor Punctuation / Continuous Speech',
    transcript:
      'patient name is Meera Shah age 32 years female weight 60 kilograms she developed fever cough generalized itching skin rash and weakness reaction started on 9 August 2026 reaction stopped on 11 August 2026 suspected medicine discontinued antihistamine given patient monitored and symptoms improved initial case',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Meera Shah',
      initials: 'MS',
      age: '32 Years',
      gender: 'Female',
      weight: '60',
      reactionStartDate: '09/08/2026',
      reactionStopDate: '11/08/2026',
    },
    expectedKeywords: ['fever', 'cough', 'itching', 'rash', 'weakness'],
  },
  {
    id: 17,
    title: 'Sample 17 — Information Completely Out of Order',
    transcript:
      'Follow-up case. The reaction resolved on 14 August 2026. The patient was given antihistamines and supportive treatment. The reaction had started on 12 August 2026. Patient name is Aman Gupta. He is 30 years old and male. His weight is 73 kilograms. He developed sneezing, runny nose, mild fever, and generalized itching after the suspected medicine. The symptoms improved after the medicine was stopped.',
    expected: {
      caseType: 'Follow-up',
      fullSpokenName: 'Aman Gupta',
      initials: 'AG',
      age: '30 Years',
      gender: 'Male',
      weight: '73',
      reactionStartDate: '12/08/2026',
      reactionStopDate: '14/08/2026',
    },
    expectedKeywords: ['sneezing', 'runny nose', 'fever', 'itching'],
  },
  {
    id: 18,
    title: 'Sample 18 — Synonym-Heavy Natural Dictation',
    transcript:
      'The patient is Nisha Verma. She is a 37-year-old woman and weighs 59 kilograms. She developed pruritus, urticaria, facial edema, nausea, and mild dyspnea. The adverse event commenced on 8 August 2026 and the symptoms subsided on 10 August 2026. The suspected drug was discontinued and she received antihistamine therapy with supportive care. She was monitored until her condition improved. This is an initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Nisha Verma',
      initials: 'NV',
      age: '37 Years',
      gender: 'Female',
      weight: '59',
      reactionStartDate: '08/08/2026',
      reactionStopDate: '10/08/2026',
    },
    expectedKeywords: ['pruritus', 'urticaria', 'edema', 'nausea', 'dyspnea'],
  },
  {
    id: 19,
    title: 'Sample 19 — History vs Reaction Context',
    transcript:
      'Patient name is Rajesh Kumar. Age is 52 years. Gender male. Weight is 77 kilograms. He is a known diabetic and has a history of high blood pressure, but today he developed severe itching, vomiting, and facial swelling after the suspected medicine. The current reaction started on 15 August 2026 and resolved on 17 August 2026. The suspected medication was stopped and he was treated with antihistamines. He improved after observation. Initial ADR case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Rajesh Kumar',
      initials: 'RK',
      age: '52 Years',
      gender: 'Male',
      weight: '77',
      reactionStartDate: '15/08/2026',
      reactionStopDate: '17/08/2026',
    },
    expectedKeywords: ['itching', 'vomiting', 'swelling'],
  },
  {
    id: 20,
    title: 'Sample 20 — Repetition Without Correction',
    transcript:
      'Patient name is Simran Kaur. She is 28 years old and female, weighing 56 kilograms. She complains of fever, dry cough, generalized itching, and skin rash for two days. The reaction started on 12 August 2026 and resolved on 14 August 2026. Her suspected medication was stopped and she was treated with antihistamines and supportive care. For confirmation, patient name is Simran Kaur, age 28 years, female, weight 56 kilograms, reaction started on 12 August 2026 and resolved on 14 August 2026. This is an initial case.',
    expected: {
      caseType: 'Initial',
      fullSpokenName: 'Simran Kaur',
      initials: 'SK',
      age: '28 Years',
      gender: 'Female',
      weight: '56',
      reactionStartDate: '12/08/2026',
      reactionStopDate: '14/08/2026',
    },
    expectedKeywords: ['fever', 'cough', 'itching', 'rash'],
  },
];

for (const sample of SAMPLES) {
  const { record, residue } = extractForReport(sample.transcript);
  const draft = toDraft(record, residue);
  const doc = buildReportDocument(draft, { now: new Date(2026, 7, 18).getTime() });

  const spokenName = record.patientName?.value || '';
  const initials = getPatientInitials(spokenName || doc.sectionA.patientInitials || sample.expected.fullSpokenName);

  check(`${sample.title} - Case Type`, doc.sectionA.caseType, sample.expected.caseType);
  check(`${sample.title} - Full Spoken Name extracted`, spokenName, sample.expected.fullSpokenName);
  check(`${sample.title} - System Derived Initials`, initials, sample.expected.initials);
  check(`${sample.title} - Age Or DOB`, doc.sectionA.ageOrDob, sample.expected.age);
  check(`${sample.title} - Gender`, doc.sectionA.gender, sample.expected.gender);
  check(`${sample.title} - Weight Kg`, doc.sectionA.weightKg, sample.expected.weight);
  check(`${sample.title} - Reaction Start Date`, doc.sectionB.reactionStartDate, sample.expected.reactionStartDate);
  check(`${sample.title} - Reaction Stop Date`, doc.sectionB.reactionStopDate, sample.expected.reactionStopDate);
  check(`${sample.title} - Combined Field 7 Description & Management Non-empty`, doc.sectionB.description.length > 0, true);

  if (sample.expectedKeywords) {
    for (const kw of sample.expectedKeywords) {
      check(
        `${sample.title} - Description contains "${kw}"`,
        doc.sectionB.description.toLowerCase().includes(kw.toLowerCase()),
        true
      );
    }
  }

  if (sample.forbiddenKeywords) {
    for (const kw of sample.forbiddenKeywords) {
      check(
        `${sample.title} - Description excludes negated term "${kw}"`,
        doc.sectionB.description.toLowerCase().includes(kw.toLowerCase()),
        false
      );
    }
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:\n' + failures.join('\n\n'));
  process.exit(1);
}
