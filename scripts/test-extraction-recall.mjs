import { extractForReport, extractPatientFields } from '../src/services/extractionService.js';
import { isScorable, scoreField } from '../src/services/extraction/scoreField.js';

import { check, report } from './lib/fixture-harness.mjs';

const valueOf = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join(' ') : String(raw ?? '');
};

const holds = (record, field, fragment) =>
  valueOf(record, field).toLowerCase().includes(fragment.toLowerCase());

const readFully = transcript => extractForReport(transcript).record;

const RECALL = {
  diagnosis: [
    ['Diagnosis is viral fever.', 'viral fever'],
    ['My diagnosis is viral fever.', 'viral fever'],
    ['Examination suggests viral fever.', 'viral fever'],
    ['Findings are consistent with viral fever.', 'viral fever'],
    ['This appears to be viral fever.', 'viral fever'],
    ['Impression viral fever.', 'viral fever'],
    ['Clinically this is viral fever.', 'viral fever'],
    ['I would call this viral fever.', 'viral fever'],
    ['Working diagnosis viral fever.', 'viral fever'],
    ['Assessment is viral fever.', 'viral fever'],
    ['Most likely viral fever.', 'viral fever'],
    ['Points towards viral fever.', 'viral fever'],
    ['Provisionally viral fever.', 'viral fever'],
    ['Seems to be a case of viral fever.', 'viral fever'],
  ],
  symptoms: [
    ['Complains of fever and cough.', 'fever'],
    ['Symptoms are fever and cough.', 'fever'],
    ['He reports fever and cough.', 'fever'],
    ['Presents with fever and cough.', 'fever'],
    ['He has been having fever and cough.', 'fever'],
    ['Came in with fever and cough.', 'fever'],
    ['Troubled by fever and cough.', 'fever'],
    ['Chief complaint fever and cough.', 'fever'],
    ['He is down with fever and cough.', 'fever'],
    ['Bothered by fever and cough since Monday.', 'fever'],
  ],
  prescriptionNotes: [
    ['Prescription is paracetamol 500 milligrams.', 'paracetamol'],
    ['Start paracetamol 500 milligrams.', 'paracetamol'],
    ['I am prescribing paracetamol 500 milligrams.', 'paracetamol'],
    ['Give paracetamol 500 milligrams.', 'paracetamol'],
    ['Put him on paracetamol 500 milligrams.', 'paracetamol'],
    ['He should take paracetamol 500 milligrams.', 'paracetamol'],
    ['Advise paracetamol 500 milligrams twice daily.', 'paracetamol'],
    ['Rx paracetamol 500 milligrams.', 'paracetamol'],
  ],
  medicalHistory: [
    ['Medical history of diabetes.', 'diabetes'],
    ['Known case of diabetes.', 'diabetes'],
    ['He is a diabetic.', 'diabet'],
    ['Background of diabetes.', 'diabetes'],
    ['He carries a diagnosis of diabetes.', 'diabetes'],
    ['Previously treated for diabetes.', 'diabetes'],
    ['Comorbidities include diabetes.', 'diabetes'],
    ['Past history of diabetes.', 'diabetes'],
  ],
};

const MARKERS = {
  diagnosis: 8,
  symptoms: 10,
  prescriptionNotes: 8,
  medicalHistory: 8,
};

const FULL = {
  diagnosis: 14,
  symptoms: 10,
  prescriptionNotes: 8,
  medicalHistory: 8,
};

let markerHits = 0;
let fullHits = 0;
let total = 0;

for (const [field, rows] of Object.entries(RECALL)) {
  const byMarker = rows.filter(([text, want]) =>
    holds(extractPatientFields(text), field, want),
  );
  const byRead = rows.filter(([text, want]) => holds(readFully(text), field, want));

  markerHits += byMarker.length;
  fullHits += byRead.length;
  total += rows.length;

  check(
    `N1 ${field} marker recall holds at ${MARKERS[field]}/${rows.length}`,
    byMarker.length >= MARKERS[field],
    true,
  );
  check(
    `N1 ${field} full recall holds at ${FULL[field]}/${rows.length}`,
    byRead.length >= FULL[field],
    true,
  );
}

check('N1.overall the benchmark is 40 phrasings', total, 40);
check(
  `N1.overall marker recall does not regress below 34/40 (measured ${markerHits}/40)`,
  markerHits >= 34,
  true,
);
check(
  `N1.overall full recall does not regress below 40/40 (measured ${fullHits}/40)`,
  fullHits >= 40,
  true,
);

for (const [field, rows] of Object.entries(RECALL)) {
  for (const [text] of rows) {
    const marked = !!extractPatientFields(text)[field];
    const entry = readFully(text)[field];
    if (!entry) {
      continue;
    }
    check(
      `N1.flag ${marked ? 'marked' : 'promoted'} — "${text}"`,
      !!entry.auto,
      !marked,
    );
  }
}

for (const rows of Object.values(RECALL)) {
  for (const [text] of rows) {
    for (const [field, entry] of Object.entries(readFully(text))) {
      if (!entry || !isScorable(field)) {
        continue;
      }
      const entries = Array.isArray(entry.value) ? entry.value : [entry.value];
      for (const value of entries) {
        check(
          `N1.invariant ${field} = "${value}" is not contradicted by its own evidence`,
          scoreField(field, value) >= 0,
          true,
        );
      }
    }
  }
}

{
  const record = readFully('Clinically this is viral fever.');
  check('N2.1 a diagnosis never becomes the patient name', holds(record, 'patientName', 'fever'), false);
}

{
  const record = readFully(
    'He should continue his regular medication for diabetes and high blood pressure.',
  );
  check('N2.2 a condition never enters the prescription', holds(record, 'prescriptionNotes', 'diabetes'), false);
  check('N2.3 nor does a bare connective fragment reach remarks', valueOf(record, 'additionalRemarks').trim(), '');
}

{
  const record = readFully(
    'The patient has also been advised to avoid physical activity until symptoms improve.',
  );
  check('N2.4 a connective fragment is never a symptom', holds(record, 'symptoms', 'also been'), false);
  check(
    'N2.5 the advice still reaches remarks',
    holds(record, 'additionalRemarks', 'avoid physical activity'),
    true,
  );
}

{
  const record = readFully('Symptoms are fever. He has diabetes.');
  check('N2.6 fever is still a symptom', holds(record, 'symptoms', 'fever'), true);
  check('N2.7 diabetes is not', holds(record, 'symptoms', 'diabetes'), false);
}

{
  const record = readFully('He should take paracetamol 500 milligrams.');
  check('N2.8 a dosed drug is not filed as a remark', holds(record, 'additionalRemarks', 'paracetamol'), false);
  
  check(
    'N2.9 and it is listed once, not twice',
    (record.prescriptionNotes?.value ?? []).filter(entry => /paracetamol/i.test(entry)).length,
    1,
  );
}

{
  const said = 'His brother will bring the previous reports tomorrow.';
  const { record, residue } = extractForReport(said);
  check('N2.10 a bare time adverb is never a symptom', holds(record, 'symptoms', 'tomorrow'), false);
  check(
    'N2.11 and the sentence is still reviewable rather than dropped',
    residue.some(item => item.text === said),
    true,
  );
  
  check(
    'N2.12 a finding keeps its time qualifier',
    holds(readFully('She has fever tomorrow.'), 'symptoms', 'fever tomorrow'),
    true,
  );
}

{
  const record = readFully(
    'Patient name is Rohit Mehta. He is 46 years old. Gender is male. ' +
      'Medical history includes high blood pressure. Diagnosis is muscle strain. ' +
      'Symptoms include back pain and stiffness. ' +
      'Prescription notes: Paracetamol 500 milligrams twice daily.',
  );

  check('N3.1 the name survives', valueOf(record, 'patientName'), 'Rohit Mehta');
  check('N3.2 the diagnosis survives', holds(record, 'diagnosis', 'muscle strain'), true);
  check('N3.3 the symptoms survive', holds(record, 'symptoms', 'back pain'), true);
  check('N3.4 the history survives', holds(record, 'medicalHistory', 'high blood pressure'), true);
  check('N3.5 the prescription survives', holds(record, 'prescriptionNotes', 'paracetamol'), true);
  check('N3.6 history did not leak into symptoms', holds(record, 'symptoms', 'blood pressure'), false);
}

report();
