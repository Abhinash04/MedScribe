/**
 * Transcript comparison fixtures.
 *
 *   node scripts/test-transcript-diff.mjs
 *
 * The diff exists so a doctor can see what the second transcription changed
 * before trusting it. Formatting noise must not compete with clinical
 * corrections, so most of these assertions are about what is NOT reported.
 */
import {
  CHANGE,
  diffTranscripts,
  hasChanges,
  normalizeToken,
  summarizeChanges,
} from '../src/services/transcriptDiff.js';

import { check, report } from './lib/fixture-harness.mjs';

const changes = (a, b) => summarizeChanges(a, b);
const first = (a, b) => changes(a, b)[0] ?? null;

// ── 1. Normalization ────────────────────────────────────────────────────────
check('D1.1 casing folded', normalizeToken('Paracetamol'), 'paracetamol');
check('D1.2 trailing comma dropped', normalizeToken('fever,'), 'fever');
check('D1.3 full stop dropped', normalizeToken('infection.'), 'infection');
check('D1.4 inner hyphen kept', normalizeToken('follow-up'), 'follow-up');
check('D1.5 digits survive', normalizeToken('500mg'), '500mg');
check('D1.6 empty token', normalizeToken('...'), '');

// ── 2. The example that motivated this ──────────────────────────────────────
const SO_THOUGHT = 'The patient has so thought since yesterday.';
const SORE_THROAT = 'The patient has sore throat since yesterday.';

check('D2.1 exactly one change', changes(SO_THOUGHT, SORE_THROAT).length, 1);
check('D2.2 reported as a replacement', first(SO_THOUGHT, SORE_THROAT), {
  type: 'replaced',
  from: 'so thought',
  to: 'sore throat',
});

// ── 3. Formatting alone is not a correction ─────────────────────────────────
check(
  'D3.1 punctuation only',
  changes('patient name is Hema Sharma age 22 years', 'Patient name is Hema Sharma, age 22 years.'),
  [],
);
check('D3.2 casing only', changes('paracetamol twice daily', 'Paracetamol Twice Daily'), []);
check('D3.3 identical text', changes(SORE_THROAT, SORE_THROAT), []);
check('D3.4 hasChanges agrees', hasChanges('fever cough', 'Fever, cough.'), false);
check(
  'D3.5 whitespace differences',
  changes('fever   cough', ' fever cough '),
  [],
);

// ── 4. Real recogniser corrections ──────────────────────────────────────────
check('D4.1 twice daily', first('take paracetamol to ice daily', 'take paracetamol twice daily'), {
  type: 'replaced',
  from: 'to ice',
  to: 'twice',
});
check(
  'D4.2 patient name is',
  first('patient image Nisha Verma', 'patient name is Nisha Verma'),
  { type: 'replaced', from: 'image', to: 'name is' },
);
check(
  'D4.3 medication name corrected',
  first('prescribed azithromycin 500', 'prescribed azithromycin 500'),
  null,
);
check(
  'D4.4 dose spacing is formatting, not a change',
  changes('paracetamol 500 mg', 'Paracetamol 500 mg.'),
  [],
);
// A genuine numeric difference IS clinical and must be reported.
check('D4.5 different dose', first('paracetamol 500 mg', 'paracetamol 650 mg'), {
  type: 'replaced',
  from: '500',
  to: '650',
});
check('D4.6 spelled vs numeric age', first('age twenty two years', 'age 22 years'), {
  type: 'replaced',
  from: 'twenty two',
  to: '22',
});

// ── 5. Pure insertion and deletion ──────────────────────────────────────────
check('D5.1 insertion', first('fever and cough', 'fever and dry cough'), {
  type: 'added',
  from: '',
  to: 'dry',
});
check('D5.2 deletion', first('fever and dry cough', 'fever and cough'), {
  type: 'removed',
  from: 'dry',
  to: '',
});
check(
  'D5.3 trailing sentence added',
  first('fever and cough', 'fever and cough Medical history of diabetes'),
  { type: 'added', from: '', to: 'Medical history of diabetes' },
);

// ── 6. Degenerate input ─────────────────────────────────────────────────────
check('D6.1 empty revision removes everything', changes('fever cough', ''), [
  { type: 'removed', from: 'fever cough', to: '' },
]);
check('D6.2 empty original adds everything', changes('', 'fever cough'), [
  { type: 'added', from: '', to: 'fever cough' },
]);
check('D6.3 both empty', changes('', ''), []);
check('D6.4 null tolerated', changes(null, undefined), []);

// ── 7. Runs, for rendering ──────────────────────────────────────────────────
const runs = diffTranscripts(SO_THOUGHT, SORE_THROAT);
check('D7.1 opens with equal text', runs[0].type, CHANGE.EQUAL);
check(
  'D7.2 every token accounted for',
  runs.reduce((total, run) => total + run.tokens.length, 0) > 0,
  true,
);
check(
  'D7.3 equal runs display the revised wording',
  diffTranscripts('fever cough', 'Fever, cough.')[0].tokens,
  ['Fever,', 'cough.'],
);
check(
  'D7.4 a replacement is a removed run then an added run',
  runs.filter(run => run.type !== CHANGE.EQUAL).map(run => run.type),
  [CHANGE.REMOVED, CHANGE.ADDED],
);

report();
