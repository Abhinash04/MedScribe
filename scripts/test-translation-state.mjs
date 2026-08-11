
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

// T1 — needsTranslation
//
// This predicate is what keeps English a no-op path. Everything downstream —
// the live-extraction guard, stopSession, selectEnglishTranscript — hangs off it.

check('T1.1 English needs none', needsTranslation('en'), false);
check('T1.2 Hindi needs it', needsTranslation('hi'), true);
check('T1.3 Odia needs it', needsTranslation('or'), true);
check('T1.4 null means no session yet', needsTranslation(null), false);
check('T1.5 undefined means no session yet', needsTranslation(undefined), false);
check('T1.6 empty string is not a language', needsTranslation(''), false);

// T2 — empty and normalize

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

// T3 — pending

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

// T4 — apply

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

// T5 — staleness
//
// One predicate answers "re-translate?" for every trigger: refinement landed,
// the doctor toggled Original/AI, the doctor edited the original text.

check('T5.1 idle is always stale', isStale(blank, HINDI), true);
check('T5.2 same source is fresh', isStale(ready, HINDI), false);
check('T5.3 whitespace differences do not count', isStale(ready, `  ${HINDI} `), false);
check('T5.4 a refined transcript is stale', isStale(ready, `${HINDI} खांसी भी है।`), true);
check('T5.5 an emptied source is stale', isStale(ready, ''), true);
check('T5.6 a failed attempt is not automatically stale', isStale(broke, HINDI), false);

// T6 — the doctor's edit
//
// A correction typed into the English box must survive the next re-render, but
// must NOT survive the source text changing underneath it.

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

check(
  'T6.10 a fresh translation clears the edited flag',
  applyTranslation(edited, ok(ENGLISH), { now: 5000, sourceText: HINDI }).edited,
  false,
);

// T7 — round trip through persistence
//
// The record is JSON.stringify'd into active_sessions.translation_json and read
// back by restoreSession, so it has to survive that unchanged.

const restored = normalizeTranslation(JSON.parse(JSON.stringify(edited)));
check('T7.1 text survives', restored.text, edited.text);
check('T7.2 source survives', restored.sourceText, edited.sourceText);
check('T7.3 edit flag survives', restored.edited, true);
check('T7.4 status survives', restored.status, TRANSLATION_STATUS.READY);
check('T7.5 still fresh after a restore', isStale(restored, HINDI), false);
check('T7.6 still protected after a restore', canTranslate(restored, HINDI), false);

report();
