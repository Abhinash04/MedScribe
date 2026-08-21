import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CORPUS_DIR = join(HERE, '..', '..', 'dictationsamples');
export const CORPUS_LANGUAGES = [
  { code: 'en', file: 'english_sample.txt', script: /[A-Za-z]/ },
  { code: 'hi', file: 'hindi_sample.txt', script: /[ऀ-ॿ]/ },
  { code: 'or', file: 'odia_sample.txt', script: /[଀-୿]/ },
  { code: 'bn', file: 'bengali_sample.txt', script: /[ঀ-৿]/ },
  { code: 'as', file: 'assamese_sample.txt', script: /[ঀ-৿]/ },
  { code: 'gu', file: 'gujarati_sample.txt', script: /[઀-૿]/ },
  { code: 'kn', file: 'kannada_sample.txt', script: /[ಀ-೿]/ },
  { code: 'ml', file: 'malayalam_sample.txt', script: /[ഀ-ൿ]/ },
  { code: 'mr', file: 'marathi_sample.txt', script: /[ऀ-ॿ]/ },
  { code: 'ne', file: 'nepali_sample.txt', script: /[ऀ-ॿ]/ },
  { code: 'pa', file: 'punjabi_sample.txt', script: /[਀-੿]/ },
  { code: 'ta', file: 'tamil_sample.txt', script: /[஀-௿]/ },
  { code: 'te', file: 'telugu_sample.txt', script: /[ఀ-౿]/ },
  { code: 'ur', file: 'urdu_sample.txt', script: /[؀-ۿ]/ },
];

const HEADER = /^Sample\s+(\d+)\s+—\s+(.+)$/;

export function parseCorpusFile(text) {
  const samples = [];
  let current = null;

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    const header = HEADER.exec(line);

    if (header) {
      current = {
        id: Number(header[1]),
        title: header[2].trim(),
        lines: [],
      };
      samples.push(current);
      continue;
    }
    if (line && current) {
      current.lines.push(line);
    }
  }

  return samples.map(({ id, title, lines }) => ({
    id,
    title,
    text: lines.join(' ').trim(),
  }));
}

const cache = new Map();

export function samplesFor(code) {
  if (cache.has(code)) {
    return cache.get(code);
  }
  const language = CORPUS_LANGUAGES.find(entry => entry.code === code);
  if (!language) {
    throw new Error(`No dictation corpus for language "${code}"`);
  }
  const parsed = parseCorpusFile(
    readFileSync(join(CORPUS_DIR, language.file), 'utf8'),
  );
  cache.set(code, parsed);
  return parsed;
}

export const sampleFor = (code, id) =>
  samplesFor(code).find(sample => sample.id === id);

export const englishFor = id => sampleFor('en', id);

export const STYLES = {
  1: 'Standard ADR Dictation',
  2: 'Diagnosis/Reaction First / Random Order',
  3: 'Conversational Speech',
  4: 'Symptoms First',
  5: 'Indian Doctor Speaking Style',
  6: 'Pronoun-Based Gender',
  7: 'Male Pronoun Inference',
  8: 'Reaction Management First',
  9: 'Patient Information First',
  10: 'Free-Flowing Dictation',
  11: 'Self-Correction',
  12: 'Formal Clinical Style',
  13: 'Casual Doctor Speech',
  14: 'Negation Challenge',
  15: 'Comprehensive Real-World Dictation',
  16: 'Poor Punctuation / Continuous Speech',
  17: 'Information Completely Out of Order',
  18: 'Synonym-Heavy Natural Dictation',
  19: 'History vs Reaction Context',
  20: 'Repetition Without Correction',
};

export const EXPECTED = {
  1: {
    caseType: 'Initial',
    fullSpokenName: 'Rahul Sharma',
    initials: 'RS',
    age: '34 Years',
    gender: 'Male',
    weight: '70',
    reactionStartDate: '10/08/2026',
    reactionStopDate: '12/08/2026',
    keywords: ['fever', 'itching', 'rash'],
  },
  2: {
    caseType: 'Initial',
    fullSpokenName: 'Priya Verma',
    initials: 'PV',
    age: '27 Years',
    gender: 'Female',
    weight: '58',
    reactionStartDate: '11/08/2026',
    reactionStopDate: '13/08/2026',
    keywords: ['nausea', 'vomiting', 'dizziness'],
  },
  3: {
    caseType: 'Initial',
    fullSpokenName: 'Amit Kumar',
    initials: 'AK',
    age: '42 Years',
    gender: 'Male',
    weight: '76',
    reactionStartDate: '08/08/2026',
    reactionStopDate: '10/08/2026',
    keywords: ['itching', 'swelling'],
  },
  4: {
    caseType: 'Initial',
    fullSpokenName: 'Neha Singh',
    initials: 'NS',
    age: '31 Years',
    gender: 'Female',
    weight: '62',
    reactionStartDate: '15/08/2026',
    reactionStopDate: '16/08/2026',
    keywords: ['nausea', 'weakness'],
  },
  5: {
    caseType: 'Initial',
    fullSpokenName: 'Arjun Patel',
    initials: 'AP',
    age: '38 Years',
    gender: 'Male',
    weight: '74',
    reactionStartDate: '09/08/2026',
    reactionStopDate: '11/08/2026',
    keywords: ['fever', 'cough', 'itching'],
  },
  6: {
    caseType: 'Follow-up',
    fullSpokenName: 'Sneha Gupta',
    initials: 'SG',
    age: '29 Years',
    gender: 'Female',
    weight: '55',
    reactionStartDate: '12/08/2026',
    reactionStopDate: '13/08/2026',
    keywords: ['swelling'],
  },
  7: {
    caseType: 'Initial',
    fullSpokenName: 'Rohit Mehta',
    initials: 'RM',
    age: '46 Years',
    gender: 'Male',
    weight: '82',
    reactionStartDate: '07/08/2026',
    reactionStopDate: '09/08/2026',
    keywords: ['dizziness', 'vomiting', 'weakness'],
  },
  8: {
    caseType: 'Initial',
    fullSpokenName: 'Kavita Rao',
    initials: 'KR',
    age: '36 Years',
    gender: 'Female',
    weight: '61.5',
    reactionStartDate: '05/08/2026',
    reactionStopDate: '07/08/2026',
    keywords: ['fever', 'vomiting', 'itching'],
  },
  9: {
    caseType: 'Initial',
    fullSpokenName: 'Sanjay Yadav',
    initials: 'SY',
    age: '55 Years',
    gender: 'Male',
    weight: '79',
    reactionStartDate: '06/08/2026',
    reactionStopDate: '08/08/2026',
    keywords: ['headache', 'dizziness', 'weakness'],
  },
  10: {
    caseType: 'Follow-up',
    fullSpokenName: 'Pooja Nair',
    initials: 'PN',
    age: '25 Years',
    gender: 'Female',
    weight: '52',
    reactionStartDate: '14/08/2026',
    reactionStopDate: '16/08/2026',
    keywords: ['itching', 'swelling'],
  },
  11: {
    caseType: 'Initial',
    fullSpokenName: 'Mohit Jain',
    initials: 'MJ',
    age: '35 Years',
    gender: 'Male',
    weight: '68',
    reactionStartDate: '10/08/2026',
    reactionStopDate: '11/08/2026',
    keywords: ['nausea', 'vomiting', 'dizziness'],
    forbidden: ['45'],
  },
  12: {
    caseType: 'Initial',
    fullSpokenName: 'Anjali Das',
    initials: 'AD',
    age: '40 Years',
    gender: 'Female',
    weight: '63',
    reactionStartDate: '04/08/2026',
    reactionStopDate: '06/08/2026',
    keywords: ['fever', 'cough', 'rash'],
  },
  13: {
    caseType: 'Initial',
    fullSpokenName: 'Deepak Mishra',
    initials: 'DM',
    age: '33 Years',
    gender: 'Male',
    weight: '71',
    reactionStartDate: '13/08/2026',
    reactionStopDate: '15/08/2026',
    keywords: ['fever', 'itching'],
  },
  14: {
    caseType: 'Initial',
    fullSpokenName: 'Riya Kapoor',
    initials: 'RK',
    age: '24 Years',
    gender: 'Female',
    weight: '57',
    reactionStartDate: '16/08/2026',
    reactionStopDate: '17/08/2026',
    keywords: ['fever', 'headache'],
    forbidden: ['chest pain', 'breathing difficulty'],
  },
  15: {
    caseType: 'Initial',
    fullSpokenName: 'Vikram Joshi',
    initials: 'VJ',
    age: '48 Years',
    gender: 'Male',
    weight: '84',
    reactionStartDate: '10/08/2026',
    reactionStopDate: '13/08/2026',
    keywords: ['itching', 'dizziness'],
  },
  16: {
    caseType: 'Initial',
    fullSpokenName: 'Meera Shah',
    initials: 'MS',
    age: '32 Years',
    gender: 'Female',
    weight: '60',
    reactionStartDate: '09/08/2026',
    reactionStopDate: '11/08/2026',
    keywords: ['fever', 'cough', 'itching'],
  },
  17: {
    caseType: 'Follow-up',
    fullSpokenName: 'Aman Gupta',
    initials: 'AG',
    age: '30 Years',
    gender: 'Male',
    weight: '73',
    reactionStartDate: '12/08/2026',
    reactionStopDate: '14/08/2026',
    keywords: ['fever', 'itching'],
  },
  18: {
    caseType: 'Initial',
    fullSpokenName: 'Nisha Verma',
    initials: 'NV',
    age: '37 Years',
    gender: 'Female',
    weight: '59',
    reactionStartDate: '08/08/2026',
    reactionStopDate: '10/08/2026',
    keywords: ['nausea'],
  },
  19: {
    caseType: 'Initial',
    fullSpokenName: 'Rajesh Kumar',
    initials: 'RK',
    age: '52 Years',
    gender: 'Male',
    weight: '77',
    reactionStartDate: '15/08/2026',
    reactionStopDate: '17/08/2026',
    keywords: ['itching', 'vomiting'],
    history: ['diabet', 'blood pressure'],
  },
  20: {
    caseType: 'Initial',
    fullSpokenName: 'Simran Kaur',
    initials: 'SK',
    age: '28 Years',
    gender: 'Female',
    weight: '56',
    reactionStartDate: '12/08/2026',
    reactionStopDate: '14/08/2026',
    keywords: ['fever', 'cough', 'itching'],
  },
};

export const SAMPLE_IDS = Object.keys(EXPECTED).map(Number).sort((a, b) => a - b);

export const valueOf = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
};

export const holds = (haystack, needle) =>
  String(haystack ?? '')
    .toLowerCase()
    .includes(String(needle).toLowerCase());
