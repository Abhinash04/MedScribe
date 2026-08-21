globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { SYMPTOM_TERMS } from '../src/constants/clinicalCues.js';
import { CONFIDENCE, LOW_CONFIDENCE_THRESHOLD } from '../src/constants/fieldMarkers.js';
import { LANGUAGE_BY_CODE } from '../src/constants/languages.js';
import {
  allLexicons,
  findingsInSource,
  lexiconCodes,
  lexiconFor,
  registerLexicon,
  reviewedCodes,
} from '../src/constants/symptomLexicon/index.js';
import { reconcileFindings } from '../src/services/extraction/reconcileSource.js';

import { check, report } from './lib/fixture-harness.mjs';
check(
  'X1.1 nothing is reviewed yet, so nothing is live',
  reviewedCodes(),
  [],
);
check(
  'X1.2 lexiconFor returns null for every unreviewed language',
  lexiconCodes().filter(code => lexiconFor(code) !== null),
  [],
);
check(
  'X1.3 findingsInSource yields nothing while unreviewed',
  lexiconCodes().flatMap(code => findingsInSource('ଜ୍ୱର କାଶ खुजली fever', code)),
  [],
);
check(
  'X1.4 an unknown language is simply empty, not an error',
  findingsInSource('fever', 'zz'),
  [],
);
check('X1.5 empty text is safe', findingsInSource('', 'or'), []);
check('X1.6 null text is safe', findingsInSource(null, 'or'), []);
check('X2.1 at least one language has a draft', allLexicons().length > 0, true);

for (const lexicon of allLexicons()) {
  const id = lexicon.code;
  check(`X2.2 ${id} is a real language`, Boolean(LANGUAGE_BY_CODE[id]), true);
  check(`X2.3 ${id} declares a review state`, typeof lexicon.reviewed, 'boolean');
  check(
    `X2.4 ${id} every key is a canonical finding`,
    Object.keys(lexicon.forms).filter(term => !SYMPTOM_TERMS.includes(term)),
    [],
  );
  check(
    `X2.5 ${id} every value is a non-empty list of strings`,
    Object.entries(lexicon.forms).filter(
      ([, forms]) =>
        !Array.isArray(forms) ||
        forms.length === 0 ||
        forms.some(form => typeof form !== 'string' || !form.trim()),
    ).map(([term]) => term),
    [],
  );
  check(
    `X2.6 ${id} no rendering is left in Latin script`,
    Object.entries(lexicon.forms)
      .filter(([, forms]) => forms.every(form => /^[A-Za-z\s-]+$/.test(form)))
      .map(([term]) => term),
    [],
  );
}

registerLexicon({
  code: 'zz-test',
  reviewed: true,
  forms: {
    itching: ['KHUJLI'],
    nausea: ['MATLI'],
    fever: ['BUKHAR'],
  },
});

check('X3.1 a reviewed lexicon is live', lexiconFor('zz-test') !== null, true);
check(
  'X3.2 findings are read out of the source',
  findingsInSource('BUKHAR aur KHUJLI', 'zz-test').sort(),
  ['fever', 'itching'],
);

{
  const record = {
    symptoms: { value: ['Fever'], confidence: CONFIDENCE.EXPLICIT, source: 'complains of' },
  };
  const { record: merged, added } = reconcileFindings(record, 'BUKHAR aur KHUJLI', 'zz-test');

  check('X3.3 the lost finding is reinstated', added, ['Itching']);
  check('X3.4 alongside the translated one', merged.symptoms.value, ['Fever', 'Itching']);
  check('X3.5 the entry is marked as reconciled', merged.symptoms.origin, 'reconciled');
  check(
    'X3.6 and drops below the review threshold so the UI flags it',
    merged.symptoms.confidence < LOW_CONFIDENCE_THRESHOLD,
    true,
  );
  check('X3.7 what was recovered is named', merged.symptoms.recovered, ['Itching']);
}

{
  const record = {
    symptoms: { value: ['Fever', 'Itching'], confidence: CONFIDENCE.EXPLICIT, source: 'complains of' },
  };
  const { record: merged, added } = reconcileFindings(record, 'BUKHAR aur KHUJLI', 'zz-test');
  check('X3.8 nothing is added when nothing was lost', added, []);
  check('X3.9 and the record is untouched', merged.symptoms.confidence, CONFIDENCE.EXPLICIT);
}

{
  const record = {
    symptoms: { value: ['Vomiting', 'Dizziness'], confidence: CONFIDENCE.EXPLICIT, source: 'had' },
  };
  const { record: merged } = reconcileFindings(record, 'BUKHAR', 'zz-test');
  check(
    'X3.10 translated findings survive recovery',
    merged.symptoms.value.slice(0, 2),
    ['Vomiting', 'Dizziness'],
  );
  check('X3.11 and the recovered one is appended', merged.symptoms.value.includes('Fever'), true);
}

{
  const record = { symptoms: { value: ['Fever'], confidence: CONFIDENCE.EXPLICIT } };
  const { added } = reconcileFindings(record, 'ଜ୍ୱର ଏବଂ କୁଣ୍ଡାଇ', 'or');
  check('X3.12 an unreviewed language recovers nothing', added, []);
}

{
  const { record: merged, added } = reconcileFindings({}, 'BUKHAR', 'zz-test');
  check('X3.13 recovery works from an empty record', added, ['Fever']);
  check('X3.14 marked as source-derived', merged.symptoms.origin, 'source');
}

check(
  'X3.15 a source with no known finding adds nothing',
  reconcileFindings({ symptoms: { value: ['Fever'] } }, 'nothing relevant here', 'zz-test').added,
  [],
);

report();
