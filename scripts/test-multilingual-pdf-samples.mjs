import { getPatientInitials, toDraft } from '../src/services/reportDraft.js';
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

console.log('--- Running Multilingual Test Suite for Section A & B (Odia, Telugu, Tamil) ---');

const MULTILINGUAL_SAMPLES = [
  // --- ODIA SAMPLES ---
  {
    id: 'OR-1',
    lang: 'Odia',
    title: 'Sample 1 (Odia) — Standard ADR Dictation',
    translatedTranscript: 'Initial case. Patient name is Rahul Sharma. Age is 34 years. Gender is male. Weight is 70 kilograms. The patient developed fever, generalized itching, and skin rash after taking the suspected medicine. The reaction started on 10 August 2026 and resolved on 12 August 2026. The suspected medication was stopped and patient was treated with antihistamine. Symptoms improved after treatment.',
    expected: { caseType: 'Initial', fullSpokenName: 'Rahul Sharma', initials: 'RS', age: '34 Years', gender: 'Male', weight: '70', reactionStartDate: '10/08/2026', reactionStopDate: '12/08/2026' }
  },
  {
    id: 'OR-2',
    lang: 'Odia',
    title: 'Sample 2 (Odia) — Diagnosis/Reaction First',
    translatedTranscript: 'The suspected reaction is nausea, vomiting, and dizziness. The reaction began on 11 August 2026 and ended on 13 August 2026. Patient name is Priya Verma. She is 27 years old and female. Her weight is 58 kilograms. The medicine was stopped and she was given supportive treatment. Symptoms settled after observation. This is an initial ADR case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Priya Verma', initials: 'PV', age: '27 Years', gender: 'Female', weight: '58', reactionStartDate: '11/08/2026', reactionStopDate: '13/08/2026' }
  },
  {
    id: 'OR-3',
    lang: 'Odia',
    title: 'Sample 3 (Odia) — Conversational Speech',
    translatedTranscript: 'Okay, this is Amit Kumar. He is 42 years old, male, and weighs about 76 kilograms. He started having severe itching, hives, and swelling around his face after taking the medicine. The reaction actually started on 8 August 2026 and by 10 August 2026 the symptoms had resolved. We stopped suspected medication, gave him antihistamine treatment, and kept him under observation. This is an initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Amit Kumar', initials: 'AK', age: '42 Years', gender: 'Male', weight: '76', reactionStartDate: '08/08/2026', reactionStopDate: '10/08/2026' }
  },
  {
    id: 'OR-4',
    lang: 'Odia',
    title: 'Sample 4 (Odia) — Symptoms First',
    translatedTranscript: 'The patient complains of severe stomach pain, nausea, loose motion, and weakness since yesterday. Her name is Neha Singh. She is 31 years old and female, with a weight of 62 kilograms. The adverse reaction started on 15 August 2026 and stopped on 16 August 2026. She was given supportive care and oral fluids, and her symptoms improved. This is an initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Neha Singh', initials: 'NS', age: '31 Years', gender: 'Female', weight: '62', reactionStartDate: '15/08/2026', reactionStopDate: '16/08/2026' }
  },
  {
    id: 'OR-5',
    lang: 'Odia',
    title: 'Sample 5 (Odia) — Indian Doctor Style',
    translatedTranscript: 'Patient name Arjun Patel. Age 38 years. Male patient. Weight 74 kilos. Developed fever, cough, generalized rash, and itching after suspected medicine. Reaction started 9 August 2026 and stopped 11 August 2026. Suspected medicine discontinued. Given antihistamine and supportive treatment. Patient improved. Initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Arjun Patel', initials: 'AP', age: '38 Years', gender: 'Male', weight: '74', reactionStartDate: '09/08/2026', reactionStopDate: '11/08/2026' }
  },
  {
    id: 'OR-6',
    lang: 'Odia',
    title: 'Sample 6 (Odia) — Pronoun-Based Gender',
    translatedTranscript: "The patient's name is Sneha Gupta. She is 29 years old and weighs 55 kilograms. She developed facial swelling, urticaria, and difficulty in breathing. The reaction began on 12 August 2026 and resolved on 13 August 2026. Suspected drug was stopped and she received emergency supportive treatment and antihistamines. This is a follow-up case.",
    expected: { caseType: 'Follow-up', fullSpokenName: 'Sneha Gupta', initials: 'SG', age: '29 Years', gender: 'Female', weight: '55', reactionStartDate: '12/08/2026', reactionStopDate: '13/08/2026' }
  },
  {
    id: 'OR-7',
    lang: 'Odia',
    title: 'Sample 7 (Odia) — Male Pronoun Inference',
    translatedTranscript: 'Patient name is Rohit Mehta. He is 46 years old and weighs 82 kilograms. He developed severe dizziness, vomiting, and weakness after suspected medication. Symptoms started on 7 August 2026 and resolved on 9 August 2026. Medicine was discontinued and he was monitored until he improved. This is an initial ADR report.',
    expected: { caseType: 'Initial', fullSpokenName: 'Rohit Mehta', initials: 'RM', age: '46 Years', gender: 'Male', weight: '82', reactionStartDate: '07/08/2026', reactionStopDate: '09/08/2026' }
  },
  {
    id: 'OR-8',
    lang: 'Odia',
    title: 'Sample 8 (Odia) — Reaction Management First',
    translatedTranscript: 'Suspected medication was withdrawn and patient was kept under observation. Antihistamine treatment was given and reaction improved. Patient name is Kavita Rao. She is 36 years old, female, and weighs 61.5 kilograms. She had fever, vomiting, generalized itching, and facial edema. Reaction started on 5 August 2026 and ended on 7 August 2026. This is an initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Kavita Rao', initials: 'KR', age: '36 Years', gender: 'Female', weight: '61.5', reactionStartDate: '05/08/2026', reactionStopDate: '07/08/2026' }
  },
  {
    id: 'OR-9',
    lang: 'Odia',
    title: 'Sample 9 (Odia) — Patient Info First',
    translatedTranscript: 'Patient name is Sanjay Yadav. He is 55 years old, male, and weighs 79 kilograms. He developed headache, dizziness, weakness, and generalized skin eruption. Adverse reaction began on 6 August 2026 and resolved on 8 August 2026. Suspected medication was stopped and symptomatic treatment was provided. Patient was monitored and improved.',
    expected: { caseType: 'Initial', fullSpokenName: 'Sanjay Yadav', initials: 'SY', age: '55 Years', gender: 'Male', weight: '79', reactionStartDate: '06/08/2026', reactionStopDate: '08/08/2026' }
  },
  {
    id: 'OR-10',
    lang: 'Odia',
    title: 'Sample 10 (Odia) — Free-Flowing Dictation',
    translatedTranscript: 'This is Pooja Nair, she is 25 years old and female, around 52 kilograms. She came in with severe itching, hives, facial swelling, and mild breathing difficulty after taking suspected medicine. Reaction started on 14 August 2026 and symptoms resolved on 16 August 2026. We discontinued suspected drug, gave antihistamines and supportive care, and observed her until she improved. Follow-up case.',
    expected: { caseType: 'Follow-up', fullSpokenName: 'Pooja Nair', initials: 'PN', age: '25 Years', gender: 'Female', weight: '52', reactionStartDate: '14/08/2026', reactionStopDate: '16/08/2026' }
  },
  {
    id: 'OR-11',
    lang: 'Odia',
    title: 'Sample 11 (Odia) — Self-Correction',
    translatedTranscript: 'Patient name is Mohit Jain. Age is 45 years, sorry, correction, age is 35 years. Gender is male and weight is 68 kilograms. He developed nausea, vomiting, and dizziness. Reaction started on 10 August 2026 and ended on 11 August 2026. Suspected medication was stopped and he was treated symptomatically. This is an initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Mohit Jain', initials: 'MJ', age: '35 Years', gender: 'Male', weight: '68', reactionStartDate: '10/08/2026', reactionStopDate: '11/08/2026' }
  },
  {
    id: 'OR-12',
    lang: 'Odia',
    title: 'Sample 12 (Odia) — Formal Clinical Style',
    translatedTranscript: 'Patient identified as Anjali Das. Gender female. Age 40 years. Weight 63 kilograms. Presenting adverse reaction includes fever, productive cough, generalized rash, and facial swelling. Reaction commenced on 4 August 2026 and resolved on 6 August 2026. Suspected medication was withdrawn. Antihistamine treatment and supportive management were provided, with subsequent clinical improvement. Initial ADR case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Anjali Das', initials: 'AD', age: '40 Years', gender: 'Female', weight: '63', reactionStartDate: '04/08/2026', reactionStopDate: '06/08/2026' }
  },
  {
    id: 'OR-13',
    lang: 'Odia',
    title: 'Sample 13 (Odia) — Casual Speech',
    translatedTranscript: 'Okay, this is Deepak Mishra. He is 33 years old, male, and weighs 71 kilograms. He has been having fever, itching, hives, and swelling of lips. It started on 13 August 2026 and settled by 15 August 2026. We stopped suspected medicine, gave him antihistamine, and watched him for a few hours. He improved. This is an initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Deepak Mishra', initials: 'DM', age: '33 Years', gender: 'Male', weight: '71', reactionStartDate: '13/08/2026', reactionStopDate: '15/08/2026' }
  },
  {
    id: 'OR-14',
    lang: 'Odia',
    title: 'Sample 14 (Odia) — Negation Challenge',
    translatedTranscript: 'Patient name is Riya Kapoor. She is 24 years old and female. Her weight is 57 kilograms. She has fever, headache, sore throat, and dry cough following suspected medication. She has no chest pain and no breathing difficulty. Reaction started on 16 August 2026 and resolved on 17 August 2026. Suspected medication was discontinued and supportive treatment was given. Initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Riya Kapoor', initials: 'RK', age: '24 Years', gender: 'Female', weight: '57', reactionStartDate: '16/08/2026', reactionStopDate: '17/08/2026' }
  },
  {
    id: 'OR-15',
    lang: 'Odia',
    title: 'Sample 15 (Odia) — Real-World Dictation',
    translatedTranscript: 'Patient\'s name is Vikram Joshi. He is a 48-year-old male weighing 84 kilograms. He presented with severe itching, dry skin rash, facial edema, dizziness, and mild shortness of breath after taking suspected medicine. Reaction started on 10 August 2026 and symptoms resolved on 13 August 2026. We stopped suspected medication immediately, treated him with antihistamines and supportive care, and kept him under observation. His condition improved. This is an initial ADR report.',
    expected: { caseType: 'Initial', fullSpokenName: 'Vikram Joshi', initials: 'VJ', age: '48 Years', gender: 'Male', weight: '84', reactionStartDate: '10/08/2026', reactionStopDate: '13/08/2026' }
  },
  {
    id: 'OR-16',
    lang: 'Odia',
    title: 'Sample 16 (Odia) — Continuous Speech',
    translatedTranscript: 'patient name is Meera Shah age 32 years female weight 60 kilograms she developed fever cough generalized itching skin rash and weakness reaction started on 9 August 2026 reaction stopped on 11 August 2026 suspected medicine discontinued antihistamine given patient monitored and symptoms improved initial case',
    expected: { caseType: 'Initial', fullSpokenName: 'Meera Shah', initials: 'MS', age: '32 Years', gender: 'Female', weight: '60', reactionStartDate: '09/08/2026', reactionStopDate: '11/08/2026' }
  },
  {
    id: 'OR-17',
    lang: 'Odia',
    title: 'Sample 17 (Odia) — Out of Order',
    translatedTranscript: 'Follow-up case. Reaction resolved on 14 August 2026. Patient was given antihistamines and supportive treatment. Reaction had started on 12 August 2026. Patient name is Aman Gupta. He is 30 years old and male. His weight is 73 kilograms. He developed sneezing, runny nose, mild fever, and generalized itching after suspected medicine. Symptoms improved after medicine was stopped.',
    expected: { caseType: 'Follow-up', fullSpokenName: 'Aman Gupta', initials: 'AG', age: '30 Years', gender: 'Male', weight: '73', reactionStartDate: '12/08/2026', reactionStopDate: '14/08/2026' }
  },
  {
    id: 'OR-18',
    lang: 'Odia',
    title: 'Sample 18 (Odia) — Synonym Heavy',
    translatedTranscript: 'The patient is Nisha Verma. She is a 37-year-old woman and weighs 59 kilograms. She developed pruritus, urticaria, facial edema, nausea, and mild dyspnea. Adverse event commenced on 8 August 2026 and symptoms subsided on 10 August 2026. Suspected drug was discontinued and she received antihistamine therapy with supportive care. She was monitored until her condition improved. This is an initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Nisha Verma', initials: 'NV', age: '37 Years', gender: 'Female', weight: '59', reactionStartDate: '08/08/2026', reactionStopDate: '10/08/2026' }
  },
  {
    id: 'OR-19',
    lang: 'Odia',
    title: 'Sample 19 (Odia) — History vs Reaction',
    translatedTranscript: 'Patient name is Rajesh Kumar. Age is 52 years. Gender male. Weight is 77 kilograms. He is a known diabetic and has history of high blood pressure, but today he developed severe itching, vomiting, and facial swelling after suspected medicine. Current reaction started on 15 August 2026 and resolved on 17 August 2026. Suspected medication was stopped and he was treated with antihistamines. He improved after observation. Initial ADR case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Rajesh Kumar', initials: 'RK', age: '52 Years', gender: 'Male', weight: '77', reactionStartDate: '15/08/2026', reactionStopDate: '17/08/2026' }
  },
  {
    id: 'OR-20',
    lang: 'Odia',
    title: 'Sample 20 (Odia) — Repetition Without Correction',
    translatedTranscript: 'Patient name is Simran Kaur. She is 28 years old and female, weighing 56 kilograms. She complains of fever, dry cough, generalized itching, and skin rash for two days. Reaction started on 12 August 2026 and resolved on 14 August 2026. Her suspected medication was stopped and she was treated with antihistamines and supportive care. For confirmation, patient name is Simran Kaur, age 28 years, female, weight 56 kilograms, reaction started on 12 August 2026 and resolved on 14 August 2026. This is an initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Simran Kaur', initials: 'SK', age: '28 Years', gender: 'Female', weight: '56', reactionStartDate: '12/08/2026', reactionStopDate: '14/08/2026' }
  },

  // --- TELUGU SAMPLES ---
  {
    id: 'TE-1',
    lang: 'Telugu',
    title: 'Sample 1 (Telugu) — Standard ADR Dictation',
    translatedTranscript: 'Initial case. Patient name Rahul Sharma. Age 34 years. Gender male. Weight 70 kilograms. Suspected drug taken after which patient developed fever, body itching, and skin rash. Reaction started 10 August 2026 and ended 12 August 2026. Suspected drug stopped and antihistamine treatment given. Symptoms improved.',
    expected: { caseType: 'Initial', fullSpokenName: 'Rahul Sharma', initials: 'RS', age: '34 Years', gender: 'Male', weight: '70', reactionStartDate: '10/08/2026', reactionStopDate: '12/08/2026' }
  },
  {
    id: 'TE-6',
    lang: 'Telugu',
    title: 'Sample 6 (Telugu) — Pronoun-Based Gender',
    translatedTranscript: "Patient's name Sneha Gupta. She is 29 years old and weighs 55 kilograms. She experienced face swelling, rash, and breathing difficulty. Reaction started 12 August 2026 and resolved 13 August 2026. Suspected drug stopped and emergency treatment provided. Follow-up case.",
    expected: { caseType: 'Follow-up', fullSpokenName: 'Sneha Gupta', initials: 'SG', age: '29 Years', gender: 'Female', weight: '55', reactionStartDate: '12/08/2026', reactionStopDate: '13/08/2026' }
  },
  {
    id: 'TE-11',
    lang: 'Telugu',
    title: 'Sample 11 (Telugu) — Self-Correction',
    translatedTranscript: 'Patient name Mohit Jain. Age 45 years, sorry, correction, age 35 years. Gender male, weight 68 kilograms. Nausea, vomiting, and dizziness occurred. Reaction started 10 August 2026 and ended 11 August 2026. Medicine stopped and treatment provided. Initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Mohit Jain', initials: 'MJ', age: '35 Years', gender: 'Male', weight: '68', reactionStartDate: '10/08/2026', reactionStopDate: '11/08/2026' }
  },
  {
    id: 'TE-14',
    lang: 'Telugu',
    title: 'Sample 14 (Telugu) — Negation Challenge',
    translatedTranscript: 'Patient name Riya Kapoor. Age 24 years, female. Weight 57 kilograms. After drug, fever, headache, throat pain, and dry cough present. No chest pain and no breathing difficulty. Reaction started 16 August 2026 and ended 17 August 2026. Medicine stopped and treatment given. Initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Riya Kapoor', initials: 'RK', age: '24 Years', gender: 'Female', weight: '57', reactionStartDate: '16/08/2026', reactionStopDate: '17/08/2026' }
  },
  {
    id: 'TE-17',
    lang: 'Telugu',
    title: 'Sample 17 (Telugu) — Out of Order Information',
    translatedTranscript: 'Follow-up case. Reaction resolved on 14 August 2026. Patient given antihistamines and supportive treatment. Reaction started on 12 August 2026. Patient name Aman Gupta. Age 30 years, male. Weight 73 kilograms. Sneezing, runny nose, fever, and itching developed. Improved after medicine stopped.',
    expected: { caseType: 'Follow-up', fullSpokenName: 'Aman Gupta', initials: 'AG', age: '30 Years', gender: 'Male', weight: '73', reactionStartDate: '12/08/2026', reactionStopDate: '14/08/2026' }
  },

  // --- TAMIL SAMPLES ---
  {
    id: 'TA-1',
    lang: 'Tamil',
    title: 'Sample 1 (Tamil) — Standard ADR Dictation',
    translatedTranscript: 'Initial case. Patient name Rahul Sharma. Age 34 years. Gender male. Weight 70 kilograms. After taking suspected medicine, fever, body itching, and skin rash occurred. Reaction started 10 August 2026 and resolved 12 August 2026. Suspected drug stopped and antihistamine treatment given. Symptoms improved.',
    expected: { caseType: 'Initial', fullSpokenName: 'Rahul Sharma', initials: 'RS', age: '34 Years', gender: 'Male', weight: '70', reactionStartDate: '10/08/2026', reactionStopDate: '12/08/2026' }
  },
  {
    id: 'TA-6',
    lang: 'Tamil',
    title: 'Sample 6 (Tamil) — Pronoun-Based Gender',
    translatedTranscript: "Patient name Sneha Gupta. Her age is 29, weight 55 kilograms. She had face swelling, rash, and breathing difficulty. Reaction started 12 August 2026 and resolved 13 August 2026. Suspected drug stopped, emergency supportive care given. Follow-up case.",
    expected: { caseType: 'Follow-up', fullSpokenName: 'Sneha Gupta', initials: 'SG', age: '29 Years', gender: 'Female', weight: '55', reactionStartDate: '12/08/2026', reactionStopDate: '13/08/2026' }
  },
  {
    id: 'TA-11',
    lang: 'Tamil',
    title: 'Sample 11 (Tamil) — Self-Correction',
    translatedTranscript: 'Patient name Mohit Jain. Age 45 years, excuse me, correction, age 35 years. Gender male, weight 68 kilograms. Nausea, vomiting, and dizziness occurred. Reaction started 10 August 2026 and finished 11 August 2026. Medicine stopped and treatment given. Initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Mohit Jain', initials: 'MJ', age: '35 Years', gender: 'Male', weight: '68', reactionStartDate: '10/08/2026', reactionStopDate: '11/08/2026' }
  },
  {
    id: 'TA-14',
    lang: 'Tamil',
    title: 'Sample 14 (Tamil) — Negation Challenge',
    translatedTranscript: 'Patient name Riya Kapoor. Age 24, female. Weight 57 kilograms. After drug, fever, headache, throat pain, and dry cough present. No chest pain and no breathing difficulty. Reaction started 16 August 2026 and ended 17 August 2026. Medicine stopped and treatment given. Initial case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Riya Kapoor', initials: 'RK', age: '24 Years', gender: 'Female', weight: '57', reactionStartDate: '16/08/2026', reactionStopDate: '17/08/2026' }
  },
  {
    id: 'TA-19',
    lang: 'Tamil',
    title: 'Sample 19 (Tamil) — History vs Reaction',
    translatedTranscript: 'Patient name Rajesh Kumar. Age 52, male. Weight 77 kilograms. He has diabetes and high blood pressure, but today severe itching, vomiting, and face swelling occurred after medicine. Current reaction started 15 August 2026 and resolved 17 August 2026. Medicine stopped and antihistamines given. Initial ADR case.',
    expected: { caseType: 'Initial', fullSpokenName: 'Rajesh Kumar', initials: 'RK', age: '52 Years', gender: 'Male', weight: '77', reactionStartDate: '15/08/2026', reactionStopDate: '17/08/2026' }
  },
];

for (const sample of MULTILINGUAL_SAMPLES) {
  const { record, residue } = extractForReport(sample.translatedTranscript);
  const draft = toDraft(record, residue);
  const doc = buildReportDocument(draft, { now: new Date(2026, 7, 18).getTime() });

  const spokenName = record.patientName?.value || '';
  const initials = getPatientInitials(spokenName || doc.sectionA.patientInitials || sample.expected.fullSpokenName);

  check(`[${sample.lang}] ${sample.title} - Case Type`, doc.sectionA.caseType, sample.expected.caseType);
  check(`[${sample.lang}] ${sample.title} - Full Spoken Name`, spokenName, sample.expected.fullSpokenName);
  check(`[${sample.lang}] ${sample.title} - Derived Initials`, initials, sample.expected.initials);
  check(`[${sample.lang}] ${sample.title} - Age Or DOB`, doc.sectionA.ageOrDob, sample.expected.age);
  check(`[${sample.lang}] ${sample.title} - Gender`, doc.sectionA.gender, sample.expected.gender);
  check(`[${sample.lang}] ${sample.title} - Weight Kg`, doc.sectionA.weightKg, sample.expected.weight);
  check(`[${sample.lang}] ${sample.title} - Reaction Start Date`, doc.sectionB.reactionStartDate, sample.expected.reactionStartDate);
  check(`[${sample.lang}] ${sample.title} - Reaction Stop Date`, doc.sectionB.reactionStopDate, sample.expected.reactionStopDate);
  check(`[${sample.lang}] ${sample.title} - Section B Description Non-empty`, doc.sectionB.description.length > 0, true);
}

console.log(`\nMultilingual Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:\n' + failures.join('\n\n'));
  process.exit(1);
}
