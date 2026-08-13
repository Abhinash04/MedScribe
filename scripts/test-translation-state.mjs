globalThis.fetch = () => {
  throw new Error('network access from a fixture suite');
};

import {
  TRANSLATION_STATUS,
  applyTranslation,
  canTranslate,
  editTranslation,
  emptyTranslation,
  isStale,
  markTranslationPending,
  needsTranslation,
  normalizeTranslation,
  setTranslationProgress,
  translationText,
} from '../src/services/consultationTranslation.js';

import { check, report } from './lib/fixture-harness.mjs';

const HINDI = 'रोगी को तीन दिनों से बुखार है।';
const ENGLISH = 'The patient has had fever for three days.';
const ok = text => ({ ok: true, text, errorKind: null });
const failed = errorKind => ({ ok: false, text: '', errorKind });

check('T1.1 English needs none', needsTranslation('en'), false);
check('T1.2 Hindi needs it', needsTranslation('hi'), true);
check('T1.3 Odia needs it', needsTranslation('or'), true);
check('T1.4 null means no session yet', needsTranslation(null), false);
check('T1.5 undefined means no session yet', needsTranslation(undefined), false);
check('T1.6 empty string is not a language', needsTranslation(''), false);

const blank = emptyTranslation();
check('T2.1 starts idle', blank.status, TRANSLATION_STATUS.IDLE);
check('T2.2 starts with no text', blank.text, '');
check('T2.3 starts unedited', blank.edited, false);
check('T2.4 starts with zero progress', blank.progress, { done: 0, total: 0 });

check('T2.5 normalize fills a null', normalizeTranslation(null).status, TRANSLATION_STATUS.IDLE);
check(
  'T2.6 normalize repairs a partial row from disk',
  normalizeTranslation({ text: ENGLISH }).progress,
  { done: 0, total: 0 },
);
check(
  'T2.7 normalize keeps what it is given',
  normalizeTranslation({ text: ENGLISH, sourceText: HINDI }).sourceText,
  HINDI,
);
check(
  'T2.8 normalize coerces edited to a boolean',
  normalizeTranslation({ edited: 'yes' }).edited,
  true,
);
check('T2.9 translationText of nothing', translationText(null), '');

const pending = markTranslationPending(blank, {
  sourceText: `  ${HINDI}  `,
  sourceKind: 'native',
});
check('T3.1 goes pending', pending.status, TRANSLATION_STATUS.PENDING);
check('T3.2 records the trimmed source', pending.sourceText, HINDI);
check('T3.3 records the source kind', pending.sourceKind, 'native');
check('T3.4 clears any previous error', pending.error, null);
check('T3.5 resets progress', pending.progress, { done: 0, total: 0 });

check(
  'T3.6 progress is tracked while pending',
  setTranslationProgress(pending, { done: 2, total: 5 }).progress,
  { done: 2, total: 5 },
);

const ready = applyTranslation(pending, ok(`  ${ENGLISH}  `), {
  now: 1000,
  sourceText: HINDI,
  sourceKind: 'native',
});
check('T4.1 goes ready', ready.status, TRANSLATION_STATUS.READY);
check('T4.2 stores the trimmed text', ready.text, ENGLISH);
check('T4.3 keeps the source it came from', ready.sourceText, HINDI);
check('T4.4 stamps the time', ready.updatedAt, 1000);
check('T4.5 clears the error', ready.error, null);

const broke = applyTranslation(pending, failed('not_configured'), {
  now: 2000,
  sourceText: HINDI,
});
check('T4.6 goes failed', broke.status, TRANSLATION_STATUS.FAILED);
check('T4.7 records the error kind', broke.error, 'not_configured');
check('T4.8 a failure keeps the source', broke.sourceText, HINDI);
check('T4.9 a failure leaves no text', broke.text, '');

check(
  'T4.10 whitespace-only output counts as a failure',
  applyTranslation(pending, ok('   '), { now: 3000 }).status,
  TRANSLATION_STATUS.FAILED,
);
check(
  'T4.11 an unknown failure still records something',
  applyTranslation(pending, null, { now: 3000 }).error,
  'unknown',
);
check(
  'T4.12 omitting sourceText keeps the recorded one',
  applyTranslation(pending, ok(ENGLISH), { now: 4000 }).sourceText,
  HINDI,
);

check('T5.1 idle is always stale', isStale(blank, HINDI), true);
check('T5.2 same source is fresh', isStale(ready, HINDI), false);
check('T5.3 whitespace differences do not count', isStale(ready, `  ${HINDI} `), false);
check('T5.4 a refined transcript is stale', isStale(ready, `${HINDI} खांसी भी है।`), true);
check('T5.5 an emptied source is stale', isStale(ready, ''), true);
check('T5.6 a failed attempt is not automatically stale', isStale(broke, HINDI), false);

const edited = editTranslation(ready, 'The patient has had a high fever for three days.');
check('T6.1 keeps the correction', edited.text.includes('high fever'), true);
check('T6.2 marks it edited', edited.edited, true);
check('T6.3 stays ready', edited.status, TRANSLATION_STATUS.READY);
check('T6.4 an edit does not change the source', edited.sourceText, HINDI);

check('T6.5 an unedited fresh translation may be redone', canTranslate(ready, HINDI), true);
check('T6.6 an edited fresh translation is protected', canTranslate(edited, HINDI), false);
check(
  'T6.7 an edited stale translation may be redone',
  canTranslate(edited, `${HINDI} खांसी भी है।`),
  true,
);
check('T6.8 no second pass while one is in flight', canTranslate(pending, HINDI), false);
check('T6.9 a failed attempt may be retried', canTranslate(broke, HINDI), true);

const cleared = editTranslation(ready, '');
check('T6.10 clearing the english text keeps the edit', cleared.text, '');
check(
  'T6.11 but it must not stay ready, or a report is built from the source language',
  cleared.status === TRANSLATION_STATUS.READY,
  false,
);
check(
  'T6.12 whitespace alone is not a translation either',
  editTranslation(ready, '   \n  ').status === TRANSLATION_STATUS.READY,
  false,
);
check(
  'T6.13 restoring text returns it to ready',
  editTranslation(cleared, 'The patient has a fever.').status,
  TRANSLATION_STATUS.READY,
);

check(
  'T6.10 a fresh translation clears the edited flag',
  applyTranslation(edited, ok(ENGLISH), { now: 5000, sourceText: HINDI }).edited,
  false,
);

const restored = normalizeTranslation(JSON.parse(JSON.stringify(edited)));
check('T7.1 text survives', restored.text, edited.text);
check('T7.2 source survives', restored.sourceText, edited.sourceText);
check('T7.3 edit flag survives', restored.edited, true);
check('T7.4 status survives', restored.status, TRANSLATION_STATUS.READY);
check('T7.5 still fresh after a restore', isStale(restored, HINDI), false);
check('T7.6 still protected after a restore', canTranslate(restored, HINDI), false);

// T8 — a failed RE-translation keeps the earlier English, and says so
//
// Discarding it would be worse: a good pass-1 translation must not be thrown
// away because a pass-2 retry failed. But the report will be built from it, so
// it has to be flagged rather than presented as current.

{
  const first = applyTranslation(pending, ok(ENGLISH), {
    now: 1000,
    sourceText: HINDI,
  });
  check('T8.1 a fresh translation is not stale', first.stale, false);

  const grown = `${HINDI} खांसी भी है।`;
  const retried = markTranslationPending(first, { sourceText: grown });
  const failedRetry = applyTranslation(retried, failed('network'), {
    now: 2000,
    sourceText: grown,
  });

  check('T8.2 the earlier English is kept', failedRetry.text, ENGLISH);
  check('T8.3 and marked stale', failedRetry.stale, true);
  check('T8.4 status is FAILED', failedRetry.status, TRANSLATION_STATUS.FAILED);
  check('T8.5 the error kind is recorded', failedRetry.error, 'network');
  check('T8.6 sourceText advanced to what failed', failedRetry.sourceText, grown);

  // The report uses whatever English exists, so a stale record must still be
  // retryable — otherwise the doctor is stuck with out-of-date text.
  check('T8.7 a stale record can be retried', canTranslate(failedRetry, grown), true);

  const recovered = applyTranslation(failedRetry, ok('Fresh English.'), {
    now: 3000,
    sourceText: grown,
  });
  check('T8.8 a later success clears stale', recovered.stale, false);
  check('T8.9 and replaces the text', recovered.text, 'Fresh English.');

  // A first-ever failure has no text to keep, so nothing is stale.
  const neverHadText = applyTranslation(emptyTranslation(), failed('timeout'), {
    now: 4000,
    sourceText: HINDI,
  });
  check('T8.10 a first failure leaves no text', neverHadText.text, '');
  check('T8.11 and is not stale', neverHadText.stale, false);

  // The doctor rewriting it makes it theirs, not an out-of-date machine output.
  check('T8.12 an edit clears stale', editTranslation(failedRetry, 'Mine.').stale, false);

  // It is persisted in active_sessions.translation_json, so it must round trip.
  const restoredStale = normalizeTranslation(
    JSON.parse(JSON.stringify(failedRetry)),
  );
  check('T8.13 stale survives persistence', restoredStale.stale, true);
  check('T8.14 and so does the kept text', restoredStale.text, ENGLISH);
  check(
    'T8.15 a record from before this field defaults to not stale',
    normalizeTranslation({ text: 'old', status: TRANSLATION_STATUS.READY }).stale,
    false,
  );
}

report();
