
// Recall of the deterministic extractor on MACHINE-TRANSLATED English.
//
// The Pravah API is pure machine translation — no system prompt, no way to
// steer its output toward the phrasings src/constants/fieldMarkers.js matches.
// So a perfectly working translation pipeline can still hand the extractor
// English it does not recognise, and the doctor gets a report with three of
// eleven fields filled. That risk lives here.
//
// GATED ON A PER-FIELD FLOOR, NOT ON 100%. MT output is not something this repo
// controls; a hard gate would break CI whenever Pravah retrains, for a reason
// nobody here can fix. The floor plus the printed table gives the signal
// without the brittleness, and raising a floor after widening a marker is the
// ratchet.
//
// WHEN A CASE FAILS: the fix is a new marker in src/constants/fieldMarkers.js —
// never a change to the extraction engine, never to the translation pipeline.
// Add markers ONE AT A TIME and run `npm run test:all` between each: the marker
// arrays are ordered and a broad new pattern can steal text from a
// higher-priority field. If a widening cannot be made regression-free, record
// the miss as a known gap below and leave the markers alone — a half-filled
// report the doctor completes is strictly better than a confidently wrong one.

import { extractForReport } from '../src/services/extractionService.js';
import { joinTranslated } from '../src/services/pravah/chunkText.js';

import { check, report } from './lib/fixture-harness.mjs';

const valueOf = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join(' ') : String(raw ?? '');
};

const holds = (record, field, fragment) =>
  valueOf(record, field).toLowerCase().includes(String(fragment).toLowerCase());

// Realistic Pravah-style output for Hindi / Odia / Bengali medical dictation.
// The artefacts are the point: dropped articles, durative calques, verb-final
// word order, literal renderings of Indic idiom.
const CASES = {
  patientName: [
    ['plain', 'The patient name is Sunita Devi.', 'Sunita Devi'],
    ['possessive', "The patient's name is Sunita Devi.", 'Sunita Devi'],
    ['dropped article', 'Name of patient is Sunita Devi.', 'Sunita Devi'],
    ['name is', 'Her name is Sunita Devi.', 'Sunita Devi'],
    // Known gap: no marker introduces a bare appositive name, and the obvious
    // one (`patient` followed by a capital) would collide with "The patient
    // complains of…" across the ten protected extraction suites. Left alone
    // deliberately — a name the doctor types is better than a wrong one.
    ['appositive (known gap)', 'Patient Sunita Devi has come today.', 'Sunita Devi'],
    ['named', 'A patient named Sunita Devi came to the clinic.', 'Sunita Devi'],
  ],
  age: [
    ['plain', 'Age is 35 years.', '35'],
    ['n-year-old', 'She is a 35 year old woman.', '35'],
    ['of age', 'The patient is 35 years of age.', '35'],
    ['spelled out', 'Age is thirty five years.', '35'],
    ['inline', 'Sunita Devi, age 35 years, came to the clinic.', '35'],
  ],
  gender: [
    ['explicit', 'Gender is female.', 'female'],
    ['sex', 'Sex is female.', 'female'],
    // `gender` has only one marker, but inferGender in collectEvidence.js
    // recovers a pronoun-only mention. MT keeps English pronouns, so this
    // holds — verified, not assumed.
    ['pronoun only', 'She is 35 years old.', 'female'],
  ],
  address: [
    ['plain', 'Address is Cuttack, Odisha.', 'Cuttack'],
    ['resides', 'The patient resides at Cuttack, Odisha.', 'Cuttack'],
    ['lives in', 'She lives in Cuttack, Odisha.', 'Cuttack'],
    ['hails from', 'She hails from Cuttack, Odisha.', 'Cuttack'],
    // Known gap: an em-dash label is not a marker phrase.
    ['label form (known gap)', 'Residence - Cuttack, Odisha.', 'Cuttack'],
  ],
  pinCode: [
    ['plain', 'PIN code is 751024.', '751024'],
    ['pincode', 'Pincode is 751024.', '751024'],
    ['label dropped', 'PIN 751024.', '751024'],
    ['standalone digits', 'Cuttack, Odisha. 751024.', '751024'],
    // Known gap: the address marker claims the whole sentence, and the
    // bare-six-digit fallback only runs over ranges no marker claimed. Fixing
    // it means changing how fallbacks interact with claimed ranges — an engine
    // change, which this suite is explicitly not allowed to motivate. A doctor
    // who dictates the PIN as its own statement (the common case, and what
    // TX2.5 covers) is unaffected.
    ['inside an address sentence (known gap)', 'Address is Cuttack, Odisha 751024.', '751024'],
  ],
  contactNumber: [
    ['plain', 'Contact number is 9876543210.', '9876543210'],
    ['mobile', 'Mobile number is 9876543210.', '9876543210'],
    ['label dropped', 'Phone 9876543210.', '9876543210'],
    ['number is', 'Her number is 9876543210.', '9876543210'],
    // MT reflows long digit runs into groups. The phone post-processor
    // normalises the spacing, so this survives — verified, not assumed.
    ['reflowed digits', 'Contact number is 98765 43210.', '9876543210'],
  ],
  symptoms: [
    ['complains of', 'The patient complains of fever and cough.', 'fever'],
    ['durative calque', 'The patient is having fever since three days.', 'fever'],
    ['suffering from', 'She is suffering from fever and cough.', 'fever'],
    ['has been having', 'She has been having fever for three days.', 'fever'],
    ['singular complaint', 'Complaint of fever and body ache.', 'fever'],
    ['presents with', 'The patient presents with fever and cough.', 'fever'],
    ['experiencing', 'She is experiencing fever and weakness.', 'fever'],
    // Verb-final existential word order, a direct calque of "बुखार और खांसी है".
    // The obvious candidate for a miss; it survives because the residue
    // classifier claims the sentence for symptoms. Pinned so a future residue
    // change cannot silently lose it.
    ['existential', 'Fever and cough for three days is there.', 'fever'],
  ],
  medicalHistory: [
    ['history of', 'History of diabetes since five years.', 'diabetes'],
    ['past medical', 'Past medical history is diabetes.', 'diabetes'],
    ['known case', 'She is a known case of diabetes.', 'diabetes'],
    ['bare condition', 'The patient is diabetic.', 'diabetic'],
    ['negative', 'No significant medical history.', 'no'],
  ],
  diagnosis: [
    ['plain', 'Diagnosis is viral fever.', 'viral fever'],
    ['diagnosed with', 'She is diagnosed with viral fever.', 'viral fever'],
    ['impression', 'Impression is viral fever.', 'viral fever'],
    ['appears', 'This appears to be viral fever.', 'viral fever'],
    ['suggestive', 'Findings are suggestive of viral fever.', 'viral fever'],
    ['seems like', 'It seems like viral fever.', 'viral fever'],
  ],
  prescriptionNotes: [
    ['prescribed', 'Prescribed paracetamol 500 mg twice a day.', 'paracetamol'],
    ['medication is', 'Medication is paracetamol 500 mg.', 'paracetamol'],
    ['started on', 'I have started her on paracetamol 500 mg.', 'paracetamol'],
    ['give her', 'Give her paracetamol 500 mg twice a day.', 'paracetamol'],
    // "Medicine ... given" is a very common MT rendering of Indic dictation.
    // `medicine` is not a positive marker; only the bare drug+dose fallback
    // rescues these, which is why that fallback matters more for MT than for
    // native English.
    ['medicine given', 'Medicine paracetamol 500 mg given.', 'paracetamol'],
    ['told to take', 'Paracetamol 500 mg told to take twice a day.', 'paracetamol'],
  ],
  additionalRemarks: [
    ['advice', 'Advice is to take rest and drink fluids.', 'rest'],
    ['should', 'She should take rest for three days.', 'rest'],
    ['tell her', 'Tell her to take rest.', 'rest'],
    ['follow up', 'Follow up after three days.', 'follow'],
  ],
};

// Floors are the RATCHET: raise one only after a marker widening proves itself
// against the full suite. Never lower one to make a failing build pass.
// Set AT the measured value, so any regression fails immediately. The three
// shortfalls below are the documented known gaps, not slack.
const FLOOR = {
  patientName: 5, // of 6 — appositive
  age: 5,
  gender: 3,
  address: 4, // of 5 — label form
  pinCode: 4, // of 5 — inside an address sentence
  contactNumber: 5,
  symptoms: 8,
  medicalHistory: 5,
  diagnosis: 6,
  prescriptionNotes: 6,
  additionalRemarks: 4,
};

const rows = [];

for (const [field, cases] of Object.entries(CASES)) {
  let hits = 0;
  const missed = [];

  for (const [label, mt, expected] of cases) {
    const record = extractForReport(mt).record;
    if (holds(record, field, expected)) {
      hits += 1;
    } else {
      missed.push(label);
    }
  }

  rows.push({ field, hits, total: cases.length, missed });
  check(
    `TX1 ${field} recall ${hits}/${cases.length} meets floor ${FLOOR[field]}`,
    hits >= FLOOR[field],
    true,
  );
}

// TX2 — a full translated consultation, end to end.
//
// This is what the extractor actually receives: several MT sentences joined by
// joinTranslated, not one hand-tuned phrase.

const CONSULTATION = joinTranslated([
  'The patient name is Sunita Devi.',
  'Age is 35 years. Gender is female.',
  'Address is Mangalabag, Cuttack, Odisha. PIN code is 753001.',
  'Contact number is 9437012345.',
  'The patient is having fever and body ache since three days.',
  'History of diabetes since five years.',
  'Diagnosis is viral fever.',
  'Prescribed paracetamol 500 mg twice a day.',
  'Advice is to take rest and drink plenty of fluids.',
]);

{
  const record = extractForReport(CONSULTATION).record;

  check('TX2.1 patient name', holds(record, 'patientName', 'Sunita'), true);
  check('TX2.2 age', holds(record, 'age', '35'), true);
  check('TX2.3 gender', holds(record, 'gender', 'female'), true);
  check('TX2.4 address', holds(record, 'address', 'Cuttack'), true);
  check('TX2.5 pin code', holds(record, 'pinCode', '753001'), true);
  check('TX2.6 contact number', holds(record, 'contactNumber', '9437012345'), true);
  check('TX2.7 symptoms', holds(record, 'symptoms', 'fever'), true);
  check('TX2.8 medical history', holds(record, 'medicalHistory', 'diabetes'), true);
  check('TX2.9 diagnosis', holds(record, 'diagnosis', 'viral fever'), true);
  check(
    'TX2.10 prescription notes',
    holds(record, 'prescriptionNotes', 'paracetamol'),
    true,
  );

  const captured = [
    'patientName',
    'age',
    'gender',
    'address',
    'pinCode',
    'contactNumber',
    'symptoms',
    'medicalHistory',
    'diagnosis',
    'prescriptionNotes',
  ].filter(field => valueOf(record, field));

  check(
    'TX2.11 every mandatory field is captured from a full translation',
    captured.length,
    10,
  );
}

// TX3 — chunk-join seams
//
// runTranslation reassembles per-chunk translations with joinTranslated. A
// missing separator would fuse two sentences into "fever.Cough" and the
// extractor would read one mangled value.

{
  const joined = joinTranslated([
    'Diagnosis is viral fever.',
    'Prescribed paracetamol 500 mg.',
  ]);
  check('TX3.1 no fused seam', /\.\S/.test(joined), false);

  const record = extractForReport(joined).record;
  check('TX3.2 diagnosis survives the seam', holds(record, 'diagnosis', 'viral fever'), true);
  check(
    'TX3.3 prescription survives the seam',
    holds(record, 'prescriptionNotes', 'paracetamol'),
    true,
  );
}

{
  // A blank chunk in the middle is legal — readTranslations holds its slot.
  const joined = joinTranslated(['Diagnosis is viral fever.', '', 'Age is 35 years.']);
  const record = extractForReport(joined).record;
  check('TX3.4 a blank chunk does not break reassembly', holds(record, 'age', '35'), true);
  check('TX3.5 nor the field before it', holds(record, 'diagnosis', 'viral fever'), true);
}

// The table is the point of this suite: it is the signal a floor cannot carry.
const width = Math.max(...rows.map(row => row.field.length));
console.log('\nTranslated-extraction recall\n');
for (const row of rows) {
  const bar = row.hits === row.total ? 'ok  ' : 'gap ';
  console.log(
    `  ${bar} ${row.field.padEnd(width)}  ${row.hits}/${row.total}` +
      (row.missed.length ? `   missed: ${row.missed.join(', ')}` : ''),
  );
}

const totalHits = rows.reduce((sum, row) => sum + row.hits, 0);
const totalCases = rows.reduce((sum, row) => sum + row.total, 0);
console.log(`\n  overall ${totalHits}/${totalCases}\n`);

report();
