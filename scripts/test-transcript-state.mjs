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
  emptyAnuvadini,
  markPending,
  switchSource,
} from '../src/services/consultationTranscripts.js';
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

const ready = applyResult(markPending(emptyAnuvadini()), { ok: true, text: REFINED }, 111);
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

report();
