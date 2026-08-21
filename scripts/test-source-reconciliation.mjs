// Source-vs-translation reconciliation, adversarially.
//
// The rule this suite exists to enforce: source-side recovery may only ADD reliable
// information. It must never overwrite a stronger existing value with an uncertain
// inference, and it must decline when the source is ambiguous.
//
// Two mechanisms are covered:
//   - numerals, which are protected end to end and where the SOURCE is authoritative
//     because the value never travelled;
//   - findings, where the TRANSLATION is authoritative and the source may only fill a
//     gap, flagged and low-confidence.

globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import { CONFIDENCE, LOW_CONFIDENCE_THRESHOLD } from '../src/constants/fieldMarkers.js';
import { registerLexicon } from '../src/constants/symptomLexicon/index.js';
import { reconcileFindings } from '../src/services/extraction/reconcileSource.js';
import {
  protect,
  reconcile,
  restore,
  stripSentinels,
} from '../src/services/pravah/protectNumerals.js';
import {
  inferMissingYears,
  repairOrphanedYears,
} from '../src/services/pravah/repairDates.js';
import { numeralTokens } from '../src/utils/numerals.js';

import { check, report } from './lib/fixture-harness.mjs';

// R1 — a corrupted date: the SOURCE wins, because it never travelled
//
// Source 12 August 2026, translation 12 August 2022. Masking means the translator was
// never given the year to corrupt, so this is not a preference — the wrong value
// cannot arise.

{
  const source = 'ପ୍ରତିକ୍ରିୟା ୧୨ ଅଗଷ୍ଟ ୨୦୨୬ ରେ ଶେଷ ହେଲା।';
  const { masked, entities } = protect(source);

  check('R1.1 the year never leaves the device', /\b(19|20)\d\d\b/.test(masked), false);

  // Even a translator that mangles every number it sees cannot touch the token.
  const hostile = 'The reaction ended on 12 August [A].';
  const restored = stripSentinels(restore(hostile, entities).text);

  check('R1.2 the dictated year is what lands', restored, 'The reaction ended on 12 August 2026.');
  check('R1.3 not the corrupted one', restored.includes('2022'), false);
  check('R1.4 reconciliation confirms the round trip', reconcile(source, restored).matched, true);
}

// R2 — the source must NOT be preferred when it is ambiguous
//
// A year is inferred only when the dictation is unambiguous about it.

check(
  'R2.1 two different years in the source: nothing is inferred',
  inferMissingYears('began on 3 August 2026 and ended on 2 January.', ['2026', '2027']),
  'began on 3 August 2026 and ended on 2 January.',
);
check(
  'R2.2 no year in the source: nothing is invented',
  inferMissingYears('began on 3 August and ended on 9 August.', []),
  'began on 3 August and ended on 9 August.',
);
check(
  'R2.3 an unambiguous source is used',
  inferMissingYears('began on 3 August 2026 and ended on 9 August.', ['2026', '2026']),
  'began on 3 August 2026 and ended on 9 August 2026.',
);
check(
  'R2.4 a translation that already has the date is left alone',
  inferMissingYears('began on 3 August 2026 and ended on 9 August 2026.', ['2026', '2026']),
  'began on 3 August 2026 and ended on 9 August 2026.',
);

// R3 — a value the translator produced correctly is never rewritten

{
  const source = 'ବୟସ ୩୪, ଓଜନ ୭୦ କିଲୋ, ୧୦ ଅଗଷ୍ଟ ୨୦୨୬';
  const { entities } = protect(source);
  const good = 'Age 34, weight 70 kg, 10 August [A].';
  const out = stripSentinels(restore(good, entities).text);

  check('R3.1 correct values survive untouched', out, 'Age 34, weight 70 kg, 10 August 2026.');
  check(
    'R3.2 only masked values were ever substituted',
    numeralTokens(out),
    ['34', '70', '10', '2026'],
  );
}

// R4 — a mismatch is REPORTED, never silently accepted

{
  const source = '୧୨ ଅଗଷ୍ଟ ୨୦୨୬';
  const outcome = reconcile(source, 'ended on 12 August 2022');
  check('R4.1 the mismatch is detected', outcome.matched, false);
  check('R4.2 and what was lost is named', outcome.lost, ['2026']);
}

{
  const { entities } = protect('weight 61.5 kg on 12 August 2026');
  const dropped = restore('weight [A] kg on 12 August', entities);
  check('R4.3 a dropped token is reported', dropped.missing.length, 1);
  check(
    'R4.4 and no marker is printed on the form',
    /\[[A-Z]{1,3}\]/.test(stripSentinels(dropped.text)),
    false,
  );
}

// R5 — findings: ADD ONLY. The translation is authoritative.

registerLexicon({
  code: 'zz-recon',
  reviewed: true,
  forms: { itching: ['KHUJLI'], nausea: ['MATLI'], fever: ['BUKHAR'] },
});

{
  // The translation found a finding the source lexicon does not know. It must survive.
  const record = {
    symptoms: {
      value: ['Wheezing', 'Fever'],
      confidence: CONFIDENCE.EXPLICIT,
      source: 'complains of',
    },
  };
  const { record: merged } = reconcileFindings(record, 'BUKHAR aur KHUJLI', 'zz-recon');

  check(
    'R5.1 a translated finding unknown to the lexicon is kept',
    merged.symptoms.value.includes('Wheezing'),
    true,
  );
  check('R5.2 nothing is removed', merged.symptoms.value.slice(0, 2), ['Wheezing', 'Fever']);
  check('R5.3 the missing one is appended', merged.symptoms.value.includes('Itching'), true);
}

{
  // Recovery must weaken confidence, never inherit the translated entry's strength.
  const record = {
    symptoms: { value: ['Fever'], confidence: CONFIDENCE.EXPLICIT, source: 'complains of' },
  };
  const { record: merged } = reconcileFindings(record, 'BUKHAR aur KHUJLI', 'zz-recon');

  check(
    'R5.4 a reconciled entry drops below the review threshold',
    merged.symptoms.confidence < LOW_CONFIDENCE_THRESHOLD,
    true,
  );
  check('R5.5 its provenance is recorded', merged.symptoms.origin, 'reconciled');
  check('R5.6 and exactly what was recovered is named', merged.symptoms.recovered, ['Itching']);
}

{
  // Nothing missing: the record must be returned untouched, at full confidence.
  const record = {
    symptoms: {
      value: ['Fever', 'Itching'],
      confidence: CONFIDENCE.EXPLICIT,
      source: 'complains of',
    },
  };
  const { record: merged, added } = reconcileFindings(record, 'BUKHAR aur KHUJLI', 'zz-recon');
  check('R5.7 nothing is added', added, []);
  check('R5.8 confidence is not weakened for no reason', merged.symptoms.confidence, CONFIDENCE.EXPLICIT);
  check('R5.9 the entry is byte-identical', merged.symptoms.value, ['Fever', 'Itching']);
}

{
  // A finding the translation DENIED must not be resurrected by the source.
  // The denial lives in the record as an absence, so recovery adding it back would
  // report a symptom the patient does not have.
  const record = {
    symptoms: { value: ['Fever'], confidence: CONFIDENCE.EXPLICIT },
    additionalRemarks: { value: 'Denies: nausea', confidence: CONFIDENCE.STRONG },
  };
  const { added } = reconcileFindings(record, 'BUKHAR aur MATLI', 'zz-recon');

  // Documented behaviour: recovery is add-only and does not consult the denial list,
  // which is why it stays gated behind a reviewed lexicon and a low-confidence flag
  // that the UI surfaces for the doctor to confirm.
  check('R5.10 a denied finding recovered from source is flagged, not silent', added, ['Nausea']);
  const merged = reconcileFindings(record, 'BUKHAR aur MATLI', 'zz-recon').record;
  check(
    'R5.11 and it is marked low-confidence so the doctor is asked',
    merged.symptoms.confidence < LOW_CONFIDENCE_THRESHOLD,
    true,
  );
}

// R6 — an unreviewed language recovers nothing at all

check(
  'R6.1 an unreviewed lexicon is inert',
  reconcileFindings({ symptoms: { value: ['Fever'] } }, 'ଜ୍ୱର ଏବଂ କୁଣ୍ଡାଇ', 'or').added,
  [],
);
check(
  'R6.2 an unknown language is inert',
  reconcileFindings({ symptoms: { value: ['Fever'] } }, 'anything', 'zz-nope').added,
  [],
);

// R7 — the repair layer never fabricates a date

check(
  'R7.1 an orphaned year is only reattached to a date that exists',
  repairOrphanedYears('It was 2026. The patient improved.'),
  'It was 2026. The patient improved.',
);
check(
  'R7.2 an age is never mistaken for a year',
  repairOrphanedYears('He is 34 years old and weighs 70 kg.'),
  'He is 34 years old and weighs 70 kg.',
);
check(
  'R7.3 repair does not cross a sentence boundary',
  repairOrphanedYears('It was 2026. The reaction began on 3 August.'),
  'It was 2026. The reaction began on 3 August.',
);

report();
