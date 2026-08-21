// Safety-critical extraction behaviour.
//
// In an ADR workflow a WRONG value is worse than a missing one: a missing field is
// prompted for, an invented symptom is filed with a regulator. Every case here asserts
// that the pipeline prefers silence to invention.

globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { extractForReport, extractPatientFields } from '../src/services/extractionService.js';
import { LOW_CONFIDENCE_THRESHOLD } from '../src/constants/fieldMarkers.js';
import { validateReportCompleteness } from '../src/services/reportCompleteness.js';
import { selectExtractionOptions } from '../src/store/useRecordingStore.js';
import { buildReportDocument } from '../src/services/reportDocument.js';
import { toDraft } from '../src/services/reportDraft.js';

import { check, report } from './lib/fixture-harness.mjs';

const read = text => extractPatientFields(text);
const value = (record, field) => {
  const raw = record?.[field]?.value;
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
};
const symptomsOf = text => value(read(text), 'symptoms').toLowerCase();
const remarksOf = text => value(read(text), 'additionalRemarks').toLowerCase();

const describe = text => {
  const { record, residue } = extractForReport(text);
  const doc = buildReportDocument(toDraft(record, residue), { now: 0 });
  return String(doc.sectionB?.description ?? '').toLowerCase();
};

// S1 — negation vs assertion, the core distinction

check('S1.1 "has nausea" is present', symptomsOf('The patient has nausea.'), 'nausea');
check('S1.2 "no nausea" is not present', symptomsOf('The patient has fever. No nausea.').includes('nausea'), false);
check('S1.3 "denies nausea" is not present', symptomsOf('Fever is present. The patient denies nausea.').includes('nausea'), false);
check(
  'S1.4 "does not have nausea" is not present',
  symptomsOf('The patient has fever. She does not have nausea.').includes('nausea'),
  false,
);
check(
  'S1.5 "without nausea" is not present',
  symptomsOf('The patient has fever without nausea.').includes('nausea'),
  false,
);

// A denial is RECORDED, not merely dropped — the regulator needs to see it was asked.
check(
  'S1.6 a denial is recorded in the remarks',
  remarksOf('The patient denies nausea and vomiting.').includes('nausea'),
  true,
);

// S2 — multiple symptoms with a mixed denial in one sentence

{
  const text = 'Patient has fever and nausea but no vomiting.';
  check('S2.1 fever is present', symptomsOf(text).includes('fever'), true);
  check('S2.2 nausea is present', symptomsOf(text).includes('nausea'), true);
  check('S2.3 vomiting is NOT present', symptomsOf(text).includes('vomiting'), false);
  check(
    'S2.4 and the denial does not reach the reaction description',
    /(?<!no )vomiting/.test(describe(text)),
    false,
  );
}

// S3 — history versus the current reaction
//
// A standing condition must not be filed as the adverse reaction.

{
  const text =
    'The patient is a known diabetic with a history of hypertension. ' +
    'Today he developed itching and swelling after the suspected drug.';
  check('S3.1 today\'s finding is the reaction', symptomsOf(text).includes('itching'), true);
  check('S3.2 diabetes is not a reaction', symptomsOf(text).includes('diabet'), false);
  check('S3.3 hypertension is not a reaction', symptomsOf(text).includes('hypertension'), false);
  check(
    'S3.4 neither reaches the printed description',
    ['diabet', 'hypertension'].filter(word => describe(text).includes(word)),
    [],
  );
  check(
    'S3.5 the history is still recorded, not discarded',
    value(read(text), 'medicalHistory').toLowerCase().includes('hypertension'),
    true,
  );
}

check(
  'S3.6 a past symptom alone is not filed as a current reaction',
  symptomsOf('The patient previously had nausea. No current complaints.').includes('nausea'),
  false,
);

// S4 — conflicting temporal statements
//
// "had X but denies X now" — the current state wins, which is what the ADR form
// records. Pinned so a vocabulary change cannot quietly flip it.

{
  const text = 'Patient had chest pain yesterday but currently denies chest pain.';
  check('S4.1 the current denial wins', symptomsOf(text).includes('chest pain'), false);
  check('S4.2 and the denial is recorded', remarksOf(text).includes('chest pain'), true);
}

{
  const text = 'Patient denied nausea earlier but now has nausea.';
  check('S4.3 a current assertion after a denial is present', symptomsOf(text).includes('nausea'), true);
}

// S5 — corrections erase the retracted value everywhere

{
  const text = 'Age is 61 years, sorry, correction, age is 16 years. She has fever.';
  const { record, residue } = extractForReport(text);
  const doc = buildReportDocument(toDraft(record, residue), { now: 0 });
  check('S5.1 the correction wins', value(record, 'age'), '16 Years');
  check('S5.2 the retracted age is nowhere in the payload', JSON.stringify(doc).includes('61'), false);
}

// S6 — multiple dates are associated with the right field

{
  const text =
    'The reaction started on 3 August 2026, worsened on 5 August 2026, ' +
    'and subsided on 9 August 2026.';
  const record = read(text);
  check('S6.1 the start date is the first', value(record, 'reactionStartDate'), '03/08/2026');
  check('S6.2 the stop date is the last', value(record, 'reactionStopDate'), '09/08/2026');
}

check(
  'S6.3 a date of birth is not a reaction date',
  value(read('Born on 3 August 1980. No reaction reported.'), 'reactionStartDate'),
  '',
);

// S7 — nothing is invented when the dictation is silent

const MUST_STAY_EMPTY = [
  ['age', 'The patient has fever and cough.'],
  ['weight', 'The patient has fever and cough.'],
  ['gender', 'The patient came in today with fever.'],
  ['reactionStartDate', 'The patient has fever and cough.'],
  ['reactionStopDate', 'The reaction started on 3 August 2026.'],
  ['diagnosis', 'Patient has fever and body ache.'],
];

for (const [field, text] of MUST_STAY_EMPTY) {
  check(`S7.1 no ${field} invented from "${text.slice(0, 34)}…"`, value(read(text), field), '');
}

// S8 — a value is either parsed and normalised, or absent. Never half-read.

{
  const record = read('The reaction started on the day after the festival.');
  check(
    'S8.1 an unparseable date is not filed as a date',
    value(record, 'reactionStartDate'),
    '',
  );
}
check(
  'S8.2 a parsed date is always normalised to DD/MM/YYYY',
  value(read('The reaction started on 3 Aug 2026.'), 'reactionStartDate'),
  '03/08/2026',
);
check(
  'S8.3 an implausible age is rejected rather than filed',
  value(read('Age is 250 years.'), 'age'),
  '',
);
check(
  'S8.4 an implausible weight is rejected rather than filed',
  value(read('Weight is 900 kg.'), 'weight'),
  '',
);

// S9 — the grounding invariant on safety-critical text
//
// Every word printed in the reaction description must have been dictated.

{
  const text =
    'Initial case. Patient Asha Rao. Aged 44 years. Female. Weight 58 kg. ' +
    'There was fever, itching and swelling. The reaction started on 2 March 2026 ' +
    'and subsided on 6 March 2026.';
  const spoken = new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean),
  );
  const ALLOWED = new Set(['not', 'available', 'years', 'denies', 'male', 'female', 'medication']);

  check(
    'S9.1 the description invents no word',
    describe(text)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(
        word =>
          !spoken.has(word) &&
          !ALLOWED.has(word) &&
          ![...spoken].some(said => said.slice(0, 4) === word.slice(0, 4)),
      ),
    [],
  );
}


// S10 — a pronoun in a translation is the translator's word, not the doctor's
//
// Odia ସେ, Hindi वह, Gujarati તે and Urdu وہ do not mark gender. Pravah has to pick one,
// and it picks "he" — confidently, uniformly, and for a patient named Sneha. Measured
// on the corpus: or/6, bn/6, as/6, ne/6 and ta/6 all come back male for a female
// patient, with no hedging anywhere in the English to hint at the guess.
//
// Extraction cannot tell a translation from a dictation by reading it, so the caller
// says. When the text is a translation and gender rests on nothing but a pronoun, the
// value is kept — dropping it would lose a required field — but its confidence falls
// below the review threshold, which is what puts the UNCERTAIN badge on the field and
// makes the doctor, not the translator, the one who decides.

{
  const sneha =
    'The patient name is Sneha Gupta. He is 29 years old and weighs 55 kg. ' +
    'He had facial swelling and difficulty breathing. The reaction began on ' +
    '12 August 2026 and ended on 13 August 2026. This is a follow-up case.';

  const dictated = extractPatientFields(sneha);
  const translated = extractPatientFields(sneha, { translated: true });

  check('S10.1 the same text yields the same value either way', [
    dictated.gender.value,
    translated.gender.value,
  ], ['Male', 'Male']);

  check(
    'S10.2 a dictated pronoun is trusted',
    dictated.gender.confidence > LOW_CONFIDENCE_THRESHOLD,
    true,
  );
  check(
    'S10.3 a translated pronoun is not',
    translated.gender.confidence <= LOW_CONFIDENCE_THRESHOLD,
    true,
  );
  check(
    'S10.4 and the field says why',
    translated.gender.source,
    'pronoun in a translation',
  );

  // ReportField draws the UNCERTAIN badge from the entry's own confidence, which is
  // what the doctor sees on the form. The ADR completeness path reports only the four
  // required checks and carries no uncertainty list, so this asserts against the rule
  // the UI actually applies.
  const draft = toDraft(translated, []);
  check(
    'S10.5 the doctor is asked to check it',
    draft.gender.confidence < LOW_CONFIDENCE_THRESHOLD && !draft.gender.edited,
    true,
  );
  check(
    'S10.6 but the report is not blocked over it',
    validateReportCompleteness(draft).isComplete,
    true,
  );
}

{
  // An explicit statement of gender is evidence in its own right. Translation does not
  // weaken it, or every translated report would arrive covered in warnings.
  const explicit =
    'The patient name is Sneha Gupta. Gender female. She is 29 years old, weight 55 kg.';
  const translated = extractPatientFields(explicit, { translated: true });

  check('S10.7 an explicit gender survives translation', translated.gender.value, 'Female');
  check(
    'S10.8 at full confidence',
    translated.gender.confidence > LOW_CONFIDENCE_THRESHOLD,
    true,
  );
}

{
  // Contradictory pronouns are already refused outright, translated or not. hi/6, gu/6,
  // ml/6 and pa/6 land here: the translation says "She is 29 … He developed …", and
  // guessing which one meant the patient is exactly the invention this suite forbids.
  const mixed =
    'The patient name is Sneha Gupta. She is 29 years old and weighs 55 kg. ' +
    'He developed facial swelling and difficulty breathing.';

  check('S10.9 a contradiction yields nothing, dictated', read(mixed).gender, null);
  check(
    'S10.10 and nothing, translated',
    extractPatientFields(mixed, { translated: true }).gender,
    null,
  );
}

{
  // The flag reaches extraction from the store, not from a guess inside it.
  const state = {
    translation: { text: 'The patient is Sneha Gupta. He is 29.', status: 'ready' },
    segments: [{ text: 'ରୋଗୀଙ୍କ ନାମ ସ୍ନେହା ଗୁପ୍ତା।', final: true }],
    language: 'or',
  };

  check(
    'S10.11 a translated report is flagged as one',
    selectExtractionOptions(state),
    { translated: true },
  );
  check(
    'S10.12 an English dictation is not',
    selectExtractionOptions({ ...state, translation: null }),
    { translated: false },
  );
}

report();
