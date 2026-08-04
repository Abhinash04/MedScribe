/**
 * Dual-transcript state fixtures.
 *
 *   node scripts/test-transcript-state.mjs
 *
 * Two transcriptions of one consultation, and the doctor decides which one the
 * report is built from. The rules that matter are the ones that protect work
 * already done: neither transcript may overwrite the other, and a manual field
 * correction must survive a switch.
 */
import {
  ANUVADINI_STATUS,
  TRANSCRIPT_SOURCE,
  activeText,
  applyResult,
  canOffer,
  continuationBaseFrom,
  emptyAnuvadini,
  markPending,
  switchSource,
} from '../src/services/consultationTranscripts.js';
import { summarizeChanges } from '../src/services/transcriptDiff.js';
import { extractPatientFields } from '../src/services/extractionService.js';
import { applyEdit, mergeExtraction, toDraft } from '../src/services/reportDraft.js';
import { ERROR_KIND } from '../src/services/anuvadini/proxyContract.js';

import { check, report } from './lib/fixture-harness.mjs';

const NATIVE =
  'The patient image Nisha Verma she has so thought and should take paracetamol to ice daily';
const REFINED =
  'The patient name is Nisha Verma. She has sore throat and should take Paracetamol twice daily.';

// ── 1. Status transitions ───────────────────────────────────────────────────
check('T1.1 starts idle', emptyAnuvadini().status, ANUVADINI_STATUS.IDLE);
check('T1.2 pending', markPending(emptyAnuvadini()).status, ANUVADINI_STATUS.PENDING);

const ready = applyResult(markPending(emptyAnuvadini()), { ok: true, text: REFINED }, {
  now: 111,
});
check('T1.3 ready on success', ready.status, ANUVADINI_STATUS.READY);
check('T1.4 text stored', ready.text, REFINED);
check('T1.5 error cleared', ready.error, null);
check('T1.6 timestamped', ready.updatedAt, 111);

const failure = applyResult(markPending(emptyAnuvadini()), {
  ok: false,
  errorKind: ERROR_KIND.TIMEOUT,
});
check('T1.7 failed status', failure.status, ANUVADINI_STATUS.FAILED);
check('T1.8 error kind kept for the retry chip', failure.error, ERROR_KIND.TIMEOUT);

// A failed retry must not erase a transcript the doctor already has.
const failedRetry = applyResult(ready, { ok: false, errorKind: ERROR_KIND.NETWORK });
check('T1.9 a failed retry keeps the earlier text', failedRetry.text, REFINED);

// ── 2. What may be offered ──────────────────────────────────────────────────
check(
  'T2.1 ready and different → offered',
  canOffer({ nativeText: NATIVE, anuvadini: ready }),
  true,
);
check(
  'T2.2 pending → not offered',
  canOffer({ nativeText: NATIVE, anuvadini: markPending(emptyAnuvadini()) }),
  false,
);
check(
  'T2.3 failed → not offered',
  canOffer({ nativeText: NATIVE, anuvadini: failure }),
  false,
);
check(
  'T2.4 identical text is not an alternative',
  canOffer({
    nativeText: REFINED,
    anuvadini: applyResult(emptyAnuvadini(), { ok: true, text: REFINED }),
  }),
  false,
);

// ── 3. Active transcript ────────────────────────────────────────────────────
check(
  'T3.1 native by default',
  activeText({ nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.NATIVE }),
  NATIVE,
);
check(
  'T3.2 anuvadini once selected',
  activeText({ nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.ANUVADINI }),
  REFINED,
);
// A failure must never leave the report with no transcript at all.
check(
  'T3.3 falls back to native when the alternative is empty',
  activeText({
    nativeText: NATIVE,
    anuvadini: emptyAnuvadini(),
    source: TRANSCRIPT_SOURCE.ANUVADINI,
  }),
  NATIVE,
);

// ── 4. Switching is refused when there is nothing behind it ─────────────────
check(
  'T4.1 switch accepted when ready',
  switchSource(
    { nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.NATIVE },
    TRANSCRIPT_SOURCE.ANUVADINI,
  ),
  TRANSCRIPT_SOURCE.ANUVADINI,
);
check(
  'T4.2 switch refused when failed',
  switchSource(
    { nativeText: NATIVE, anuvadini: failure, source: TRANSCRIPT_SOURCE.NATIVE },
    TRANSCRIPT_SOURCE.ANUVADINI,
  ),
  TRANSCRIPT_SOURCE.NATIVE,
);
check(
  'T4.3 back to native is always allowed',
  switchSource(
    { nativeText: NATIVE, anuvadini: ready, source: TRANSCRIPT_SOURCE.ANUVADINI },
    TRANSCRIPT_SOURCE.NATIVE,
  ),
  TRANSCRIPT_SOURCE.NATIVE,
);

// ── 5. Re-extraction on switch, with manual edits surviving ─────────────────
const nativeDraft = toDraft(extractPatientFields(NATIVE));
// "patient image" matches no name marker, which is the whole reason a second
// transcription is worth offering.
check('T5.1 the native mishearing yields no name', nativeDraft.patientName.value, '');
check('T5.2 the native symptom is the misheard one', nativeDraft.symptoms.value, [
  'Thought',
  'Should take paracetamol to ice daily',
]);

const edited = applyEdit(nativeDraft, 'patientName', 'N. Verma');
check('T5.3 the doctor typed a name', edited.patientName.edited, true);

const refinedRecord = extractPatientFields(REFINED);
const switched = mergeExtraction(edited, refinedRecord);

check('T5.4 the manual correction outranks the refined extraction', switched.patientName.value, 'N. Verma');
check('T5.5 it is still flagged as edited', switched.patientName.edited, true);
check('T5.6 an unedited field takes the refined value', switched.symptoms.value, [
  'Sore throat',
  'Should take Paracetamol twice daily',
]);

// With no manual edit in the way, the refined name is adopted.
const unedited = mergeExtraction(nativeDraft, refinedRecord);
check('T5.7 refined name adopted when nothing was typed', unedited.patientName.value, 'Nisha Verma');

// Switching back follows the active transcript for unedited fields, and still
// leaves the doctor's own value alone.
const back = mergeExtraction(switched, extractPatientFields(NATIVE));
check('T5.8 the typed name is still the doctor’s', back.patientName.value, 'N. Verma');
check('T5.9 unedited fields follow the active transcript', back.symptoms.value, [
  'Thought',
  'Should take paracetamol to ice daily',
]);

// ── 6. Both texts survive independently ─────────────────────────────────────
const state = {
  nativeText: NATIVE,
  anuvadini: ready,
  source: TRANSCRIPT_SOURCE.ANUVADINI,
};
const afterRoundTrip = {
  ...state,
  source: switchSource(
    { ...state, source: switchSource(state, TRANSCRIPT_SOURCE.NATIVE) },
    TRANSCRIPT_SOURCE.ANUVADINI,
  ),
};
check('T6.1 native text intact', afterRoundTrip.nativeText, NATIVE);
check('T6.2 refined text intact', afterRoundTrip.anuvadini.text, REFINED);
check('T6.3 back on the refined source', afterRoundTrip.source, TRANSCRIPT_SOURCE.ANUVADINI);

// ── 7. Persistence round trip ───────────────────────────────────────────────
const persisted = JSON.parse(
  JSON.stringify({ anuvadiniTranscript: ready, transcriptSource: TRANSCRIPT_SOURCE.ANUVADINI }),
);
check('T7.1 transcript survives serialization', persisted.anuvadiniTranscript.text, REFINED);
check('T7.2 status survives', persisted.anuvadiniTranscript.status, ANUVADINI_STATUS.READY);
check('T7.3 source survives', persisted.transcriptSource, TRANSCRIPT_SOURCE.ANUVADINI);
check(
  'T7.4 a restored session can still resolve its active text',
  activeText({
    nativeText: NATIVE,
    anuvadini: persisted.anuvadiniTranscript,
    source: persisted.transcriptSource,
  }),
  REFINED,
);

// ── 8. Editing the draft never touches the raw baseline ─────────────────────
const SOAR = 'Patient has soar throat.';
const CORRECTED = 'Patient has sore throat.';

const pass1 = applyResult(emptyAnuvadini(), { ok: true, text: SOAR });
const editedAi = { ...pass1, text: CORRECTED };

check('T8.1 the draft holds the correction', editedAi.text, CORRECTED);
check('T8.2 the raw baseline is untouched', editedAi.raw, SOAR);
check(
  'T8.3 the comparison is unchanged by the edit',
  summarizeChanges('Patient has soar throat.', editedAi.raw),
  summarizeChanges('Patient has soar throat.', pass1.raw),
);
check(
  'T8.4 the report uses the edited draft',
  activeText({
    nativeText: 'native',
    anuvadini: editedAi,
    source: TRANSCRIPT_SOURCE.ANUVADINI,
  }),
  CORRECTED,
);

// ── 9. A continuation appends to a snapshot, not to live state ──────────────
const FEVER = 'He also has fever.';
const base = continuationBaseFrom(editedAi);

check('T9.1 the snapshot carries the edited draft', base.text, CORRECTED);
check('T9.2 and the raw baseline separately', base.raw, SOAR);

const pass2 = applyResult(markPending(editedAi), { ok: true, text: FEVER }, {
  append: true,
  base,
});

check('T9.3 the draft keeps the correction and gains the new speech', pass2.text, `${CORRECTED}\n${FEVER}`);
check('T9.4 raw accumulates only what the service produced', pass2.raw, `${SOAR}\n${FEVER}`);
check('T9.5 the doctor’s wording never reaches raw', pass2.raw.includes('sore'), false);
check('T9.6 status is ready', pass2.status, ANUVADINI_STATUS.READY);

// Replaying the same continuation must not append it twice.
const replayed = applyResult(pass2, { ok: true, text: FEVER }, { append: true, base });
check('T9.7 retry from the same base is idempotent', replayed.text, `${CORRECTED}\n${FEVER}`);
check('T9.8 idempotent for raw too', replayed.raw, `${SOAR}\n${FEVER}`);

// ── 10. A failed continuation destroys nothing ──────────────────────────────
const failedContinuation = applyResult(markPending(pass2), {
  ok: false,
  errorKind: ERROR_KIND.TIMEOUT,
}, { append: true, base: continuationBaseFrom(pass2) });

check('T10.1 the draft survives', failedContinuation.text, pass2.text);
check('T10.2 the raw baseline survives', failedContinuation.raw, pass2.raw);
check('T10.3 status reports the failure', failedContinuation.status, ANUVADINI_STATUS.FAILED);
check('T10.4 the error kind is kept for Retry', failedContinuation.error, ERROR_KIND.TIMEOUT);

// ── 11. The full multi-pass sequence ────────────────────────────────────────
// pass 1 success → manual edit → pass 2 failure → retry success → pass 3 success
const RAW_1 = 'Patient has soar throat.';
const EDIT_1 = 'Patient has sore throat.';
const RAW_2 = 'He also has fever.';
const RAW_3 = 'History of asthma.';

let sequence = applyResult(emptyAnuvadini(), { ok: true, text: RAW_1 });
sequence = { ...sequence, text: EDIT_1 };

// Add More Speech: one snapshot for this recording, reused by the retry.
const baseTwo = continuationBaseFrom(sequence);
sequence = applyResult(markPending(sequence), { ok: false, errorKind: ERROR_KIND.NETWORK }, {
  append: true,
  base: baseTwo,
});
check('T11.1 the failure left the edit alone', sequence.text, EDIT_1);

sequence = applyResult(markPending(sequence), { ok: true, text: RAW_2 }, {
  append: true,
  base: baseTwo,
});

// A second Add More Speech takes a FRESH snapshot.
const baseThree = continuationBaseFrom(sequence);
sequence = applyResult(markPending(sequence), { ok: true, text: RAW_3 }, {
  append: true,
  base: baseThree,
});

check('T11.2 final draft', sequence.text, `${EDIT_1}\n${RAW_2}\n${RAW_3}`);
check('T11.3 final raw', sequence.raw, `${RAW_1}\n${RAW_2}\n${RAW_3}`);
check('T11.4 the manual correction survived every pass', sequence.text.includes('sore throat'), true);
check('T11.5 raw still shows what the service actually heard', sequence.raw.includes('soar throat'), true);

for (const [label, chunk] of [
  ['pass 2', RAW_2],
  ['pass 3', RAW_3],
]) {
  check(
    `T11.6 ${label} appears exactly once in the draft`,
    sequence.text.split(chunk).length - 1,
    1,
  );
  check(
    `T11.7 ${label} appears exactly once in raw`,
    sequence.raw.split(chunk).length - 1,
    1,
  );
}

// ── 12. Continuation while Original is selected ─────────────────────────────
const whileNative = {
  nativeText: 'native transcript',
  anuvadini: sequence,
  source: TRANSCRIPT_SOURCE.NATIVE,
};
check(
  'T12.1 the AI draft still accumulated',
  whileNative.anuvadini.text.includes(RAW_3),
  true,
);
check(
  'T12.2 the selected source is unchanged',
  switchSource(whileNative, TRANSCRIPT_SOURCE.NATIVE),
  TRANSCRIPT_SOURCE.NATIVE,
);
check(
  'T12.3 the report still reads the native transcript',
  activeText(whileNative),
  'native transcript',
);

report();
