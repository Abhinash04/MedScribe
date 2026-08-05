# MedScribe — Project Handoff

> **Purpose of this document.** It captures the state of MedScribe after Phases 1–4, including the reasoning behind decisions that are not obvious from reading the code. Several parts of this codebase look like mistakes and are not — those are called out explicitly in [Implementation Notes](#7-implementation-notes--conventions). Read that section before changing anything in the speech, persistence or export pipelines.

**Last updated:** 2026-07-31
**Branch:** `abhi-dev`

---

## Table of Contents

1. [Project Overview & Objectives](#1-project-overview--objectives)
2. [Current Status](#2-current-status)
3. [Features Completed](#3-features-completed)
4. [Pending Work](#4-pending-work)
5. [Technical Architecture & Design Decisions](#5-technical-architecture--design-decisions)
6. [Project Structure](#6-project-structure)
7. [Implementation Notes & Conventions](#7-implementation-notes--conventions)
8. [Dependencies](#8-dependencies)
9. [Known Limitations & Future Considerations](#9-known-limitations--future-considerations)

---

## 1. Project Overview & Objectives

MedScribe is a React Native (Android) application that lets doctors create structured patient records by dictating instead of typing.

The intended pipeline, per the SRS:

```text
Dictate  →  Transcribe  →  Extract patient fields  →  Structured report
 (FR-2)      (FR-3/4)          (FR-5)                  (FR-6/7/8)
```

Phase 4 continues that line past the preview the SRS stops at:

```text
… → Transcript review → Structured report → Review & edit → Save → Dashboard → Reopen / Export PDF
```

Phase 5 adds the transcript review step in front of extraction, and makes the dictation itself controllable: pause, resume, a live status and timer, automatic saving of the in-flight session, and a single audio cue in place of the system recogniser's beep between every sentence.

**Scope boundary:** the application is a *documentation aid only*. It performs no diagnosis and makes no medical decisions (SRS §1.2). Editable fields do not change that — the doctor is the author of every value; the app only proposes.

Full requirements live in [`MedSrcibe_SRS.md`](./MedSrcibe_SRS.md). The two Antigravity documents in this folder describe the *original Phase 1 plan* and are historical — they do not reflect the current codebase.

---

## 2. Current Status

| Phase | Scope | State |
| :-- | :-- | :-- |
| **Phase 1** | Design system, components, navigation | Complete |
| **Phase 2** | Permissions, speech-to-text, live transcript | Complete, verified on hardware |
| **Phase 3** | Field extraction + structured report | Complete |
| **Hardening** | Post-Phase-3 correctness pass | Complete, verified on hardware |
| **Phase 4** | Editable reports, SQLite persistence, doctor dashboard, PDF export | Complete, verified on hardware |
| **Phase 5** | Pause/resume, transcript review, session autosave + recovery, audio cues, dashboard redesign | Complete, verified on hardware |
| **Phase 6** | Extraction v2 — natural phrasing, negation, retraction, pronoun gender, prescription list | Complete |
| **Phase 7** | Auto-save and consultation recovery, mandatory-field completeness gate | Complete |
| **Phase 8** | Shared microphone, Anuvadini second transcription, editable AI transcript, continuation, diff | Complete, verified on hardware in **both Debug and Release** |

The hardening round is five commits: `c02369d` (extraction pipeline correctness), `b0c9b6f` (permission rejection + native error surfacing), `9d4ddff` (transcript preserved on error, reset on new dictation), `3095391` (phone numbers + trailing unmarked values), `c59877d` (recording restarts after leaving the screen).

Phase 4 turns the one-shot pipeline into a documentation system. The generated report is now an editable **draft**: the doctor corrects any field, saves it to a local SQLite database along with the original transcript, and finds it on a **Doctor Dashboard** that opens on launch. Saved reports reopen for further editing and export to PDF. Single doctor, no authentication — but the layering (§5) is where multi-doctor, auth, cloud sync and EHR export will attach.

**Verification was performed on a physical device**, not an emulator: an Oppo A059, Android 16 (SDK 36), `arm64-v8a`. Confirmed working there — permission flow, live partial results streaming word-by-word, final results accumulating into a multi-chunk transcript.

Re-verified on the same device on **2026-07-31**, including the cycle that `c59877d` fixes: enter the Recording screen → press back without dictating → tap the mic again. That path previously dead-ended on a permanent "Speech recognition unavailable" and now starts a normal session. See [§7](#️-unmount-calls-stop-never-destroy) for why.

This matters: **dictation cannot be tested on the Android emulator at all.** See [§9](#9-known-limitations--future-considerations). Any future agent that tries to validate speech features on an emulator will waste hours reaching a dead end that has already been investigated and ruled out.

**Phase 8 was measured, not assumed.** The microphone-contention question was answered with a six-phase matrix on the Oppo A059 (§5), and the shared-microphone path that came out of it scores **88% word recall against a 75% recognizer-only baseline**, with partials from 3.0 s and a clean segmented finalisation. The full workflow — dictate → live transcript → Anuvadini → review → select → report — passes on both the Debug and Release APKs.

The extraction and report layers are pure and deterministic, so they are measured against fixtures rather than the device. The full automated gate:

| Suite | Assertions | What it guards |
| :-- | --: | :-- |
| `npm run test:extraction` | **239 / 239** | The regression floor — template, scrambled, conversational, shorthand, filler and Hinglish dictation |
| `npm run test:extraction:natural` | **129 / 129** | Natural phrasing: synonyms, pronoun gender, negation, chronic-vs-acute, prescription vs advice |
| `npm run test:extraction:adversarial` | **31 / 31** | Conflicting and cancelled dictation: explicit-vs-pronoun, corrections, retractions, numeric bleed, restart duplicates |
| `npm run test:extraction:samples` | **195 / 195** | Twenty real dictation samples, every stated field asserted exactly, each proving its prescription, plus a punctuation-free variant |
| `npm run test:extraction:synonyms` | **71 / 71** | One assertion per phrase family across all eleven fields, so a full-sample fixture cannot hide a broken marker |
| `npm run test:extraction:numeric` | **49 / 49** | PIN and phone grouping, country codes, spoken digits, and the numbers that must never become either |
| `npm run test:extraction:cleanup` | **54 / 54** | Conversational scaffolding removed from all eleven fields, and the clinical modifiers that must survive it |
| `npm run test:report` | **81 / 81** | Draft bookkeeping, the list-typed prescription round-trip and the PDF payload |
| `npm run test:completeness` | **63 / 63** | The ten mandatory fields, optional remarks, explicit-none history and prescription, and the Add-More-Speech merge |
| `npm run test:transcripts` | **69 / 69** | Native vs Anuvadini state, raw baselines versus editable drafts, the continuation base, and a full pass-1 → edit → fail → retry → pass-3 sequence |
| `npm run test:diff` | **30 / 30** | "What AI changed": word-level LCS, punctuation and casing normalization, medical substitutions, insertion and deletion |
| `npm run test:anuvadini` | **78 / 78** | Both transports, request assembly, language normalization, every failure path, no auto-retry, and no audio or token in any result or error |
| `npm run test:audio` | **89 / 89** | WAV sizing, Base64 growth, the per-request and per-recording ceilings, and chunk plans that are contiguous, disjoint and under the cut |
| `npm run test:chunks` | **41 / 41** | Chunked upload: sequential order, the ordered join, a mid-pass failure keeping earlier chunks, retry re-sending only what is missing, and a superseded pass applying nothing |
| `npm run test:proxy` | **77 / 77** | Proxy field translation, Bearer containment, guards before any upstream call, and every error mapping |
| `npm run lint` | **0 errors** | — |

Those are **clean-text** numbers. Real dictation adds transcription loss on top — see the dropped-words limitation in §9.

---

## 3. Features Completed

Mapped to SRS requirement IDs so this table stays anchored to the specification.

| Requirement | Description | Status |
| :-- | :-- | :-- |
| **FR-1** | Application launch, Dashboard screen | Done |
| **FR-2** | Voice recording + runtime permission flow | Done |
| **FR-3** | Speech recognition via `@appcitor/react-native-voice-to-text` | Done |
| **FR-4** | Transcript display, including live interim text | Done |
| **NFR-4** | Graceful handling of denial, blocking, engine failure | Done |
| **FR-5** | Information extraction (11 patient fields) | Done — v2, see §5 |
| **FR-6** | Structured report generation | Done |
| **FR-7** | Missing-field handling ("Not Available") | Done |
| **FR-8** | Report preview | Done |

Permission handling covers all four outcomes: **granted**, **denied** (re-requestable), **blocked** (needs system settings, with a working `openSettings()` button), and **unavailable** (no engine on device).

Recording states implemented: `idle`, `checkingPermission`, `permissionDenied`, `permissionBlocked`, `unavailable`, `listening`, `processing`, `success`, `error`.

Phase 4 goes beyond the original FR list — the SRS stops at *preview*, and these close the gap between a demonstration and a record system:

| Capability | Description |
| :-- | :-- |
| Editable fields | Every report row is a `TextInput`. Symptoms are a list with add/remove. An `EDITED` badge marks values the doctor changed. |
| Save Report | Persists transcript, extraction, edited values, status and timestamps in one call. Re-saving an open report updates it rather than inserting a duplicate. |
| Doctor Dashboard | Launch screen. Lists saved reports newest-first with patient name, date/time, diagnosis and a Draft/Final pill. Tap to reopen, long-press to delete. |
| Persistence | SQLite via `@op-engineering/op-sqlite`. Survives force-stop and reinstall-free relaunch. |
| Finalize | `draft` → `final`. Finalized reports stay openable and editable — the pill records intent, it is not a lock. |
| PDF export | A4 document rendered by an in-app Kotlin TurboModule, handed to the system share sheet (SRS §8). |

Phase 5 turns the recording step from a one-shot capture into a controllable session:

| Capability | Description |
| :-- | :-- |
| Pause / Resume | Pause stops the recogniser and freezes the timer; resume appends to the same transcript. Stop is confirmed through a dialog, since an accidental tap used to end a consultation. |
| Status + timer | A live pill (Listening / Paused / Processing / Stopped) and an MM:SS duration that excludes paused time. |
| Utterance model | The store holds `segments` — `{ id, text, originalText, confidence, timestamp, edited }` — instead of flat strings. `chunks` remains as a derived mirror so existing readers did not have to change. |
| Transcript review | A screen between recording and extraction: a full-text editor, or a sentence-by-sentence breakdown with per-utterance edit and delete. "Resume Dictation" returns to recording without discarding anything. |
| Live field preview | Extraction runs debounced against the transcript so far, so a missed field is visible while the patient is still present. |
| Session autosave | The live session is written to `active_sessions` on a 2 s debounce and cleared when the report is generated. |
| Crash recovery | Entering the recording screen with an unfinished session offers Restore or Discard, and the recogniser does not start until that is answered. |
| Audio cues | One cue at start and resume; the app then attempts to suppress the system recogniser's per-utterance tones for the rest of the session by muting the streams that carry them. Which stream that is depends on the OEM, so suppression is best-effort and unconfirmed on the target hardware (§9). |

Extraction v2 makes the extractor robust to natural clinical speech rather than to field labels:

| Capability | Description |
| :-- | :-- |
| Synonym vocabulary | Around 20 additional markers — `suggestive of`, `consistent with`, `previously diagnosed with`, `experiencing`, `investigations advised`, `prescription notes` and others. New phrasing is still a row in `fieldMarkers.js`, never a logic change. |
| Negation | Negated findings never populate a positive field; the denial is recorded in remarks as `Denies: …`. |
| Correction and retraction | A correction cue keeps the tail, a restated field label is stripped, and a retraction cancels an earlier positive value — including a cancelled prescription. |
| Pronoun gender | Gender inferred from a single pronoun at low confidence, with explicit statements always winning and a companion-noun guard. Never inferred from the name. |
| Chronic vs acute | Chronicity cues route a condition to medical history while presentation cues keep it in symptoms. |
| Prescription as a list | `prescriptionNotes` is list-typed, one entry per drug, dictated wording preserved. Rows saved while it was a scalar are coerced on load. |

**FR-4 now spans two screens** — the live transcript during dictation and the review screen after it. Extraction reads whatever the doctor approved on the second, never the raw recogniser output.

**FR-1 now means the Dashboard**, not the old landing screen. `HomeScreen.jsx` was deleted; `AnimatedMicButton` and `SectionTitle` are still in use by `DashboardScreen`.

---

## 4. Pending Work

Phases 1–4 are delivered. What follows is the remaining work, in priority order.

### Settled decisions — do not re-open

Two questions were live during Phase 3 planning and are now **closed**:

- **Extraction approach: rule-based.** SRS §8 lists "AI-assisted medical entity extraction" under *Future Enhancements*, so this phase parses deterministically. `axios` and `zod` remain installed and unused; they are **not** a pending API integration.
- **Accuracy vs parser ordering.** Resolved structurally rather than by choosing: the extractor has no React Native imports and is tested against fixtures under plain Node, so parser correctness is decoupled from transcription quality entirely.

### 1. Deploy `server/` and move the token off the device — highest priority

The Anuvadini Bearer token is compiled into the APK. That is acceptable for internal testing and **not** for distribution: it can be extracted from the artifact, and rotating it requires a rebuild for every installed device.

Everything needed is already written. `server/` is a dependency-free Node proxy with 77 assertions covering field translation, credential containment and error mapping, and the client already speaks its contract. Deployment is:

1. Host `server/` behind HTTPS with `VOICE_TO_TEXT_API_URL` and `VOICE_TO_TEXT_API_KEY` in its environment.
2. Point `MEDSCRIBE_PROXY_BASE_URL` at it and set `TRANSCRIPTION_TRANSPORT = TRANSPORT.PROXY`.
3. Drop `ANUVADINI_STT_TOKEN` from `android/local.properties`.

No feature code changes.

### 2. Recognizer restart gaps — largely addressed

The restart loop left the microphone deaf for roughly 0.5–1.5 s after each utterance, dropping words from real dictation. The shared-microphone path (§5) replaces it with **one continuous segmented session**, measured at 88% recall against the 75% restart-loop baseline on the target device.

Remaining: the vendor recogniser path is still the fallback when `SharedMic` is unavailable, and it still has the gap. `EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS` via `patch-package` remains the fix for that path if it is ever needed on a device below API 31.

### 2. Promote the samples to permanent fixtures — done

Delivered with Extraction v2: `scripts/test-extraction-samples.mjs` covers all
twenty supplied samples, and `test-extraction-adversarial.mjs` covers the
conflicting and cancelled dictation cases.

### 3. Recognition accuracy on `en-IN`

See §9. Bounded by the library bug rather than by our code.

### Extending extraction

New phrasing is a **row in `src/constants/fieldMarkers.js`**, never a logic change. That is the designed extension point — reach for it before touching pipeline stages.

---

## 5. Technical Architecture & Design Decisions

### Layering

```text
RecordingScreen (UI state machine)
      │
      ├── useSpeechRecognition  ← owns the whole session
      │        ├── permissionService  → react-native-permissions
      │        ├── speechService      → @appcitor/react-native-voice-to-text
      │        └── useRecordingStore  → Zustand
      │
      └── TranscriptView / PermissionGate / RecordingControls / ListeningVisualizer
```

**`speechService` isolates the vendor package.** No screen or hook imports `@appcitor/react-native-voice-to-text` directly. Swapping the speech engine, or mocking it for tests, touches exactly one file. It also normalizes payloads, so callers receive plain strings and `{ code, message }` rather than digging through `results.transcriptions[0].text`.

**`useSpeechRecognition` owns the entire session lifecycle** — permission gate, recognizer start/stop, the restart loop, and teardown. Screens stay declarative.

**Zustand holds the transcript** specifically so Phase 3 can read the finished text without prop drilling or re-running recognition.

### Layering, Phase 4

```text
DashboardScreen ─┬─ useReportsStore ── reportsRepository ── database.js ── op-sqlite
                 │                       (report CRUD SQL)
                 ├─→ RecordingScreen → ReportScreen        (fresh dictation)
                 └─→ ReportScreen({ reportId })            (saved report)

ReportScreen ─┬─ reportDraft.js    (pure: extraction → editable draft, merge, diff)
              ├─ extractionService.js                      (unchanged)
              └─ pdfService.js ── reportDocument.js  (pure: draft → print payload)
                     └─→ NativePdfExporter (Kotlin TurboModule)
```

Three invariants. Each mirrors a convention this codebase already follows, and each is the reason a future backend swap is a one-file change rather than a rewrite:

- **`reportsRepository.js` is the only module that handles report CRUD SQL.** Same isolation rule `speechService` applies to the speech vendor. Screens do not import it — they go through `useReportsStore`. Replacing SQLite with a cloud or EHR backend touches that one file.
- **`pdfService.js` is the only module that touches the native exporter.** No screen imports the TurboModule.
- **`reportDraft.js` and `reportDocument.js` are pure and RN-free**, with explicit `.js` import extensions, so they run under plain Node exactly like the extraction pipeline — which is what makes `scripts/test-report.mjs` possible with zero test dependencies.

### Layering, Phase 5

```text
RecordingScreen / TranscriptReviewScreen
      │
      ├── useSpeechRecognition        ← recogniser lifecycle, permission, restart loop
      │        └── dictationSessionManager   ← session lifecycle
      │                 ├── speechService            (engine driver only)
      │                 ├── audioFeedbackService     → AudioCue TurboModule
      │                 ├── sessionPersistenceService → active_sessions
      │                 ├── extractionService        (debounced live fields)
      │                 └── useRecordingStore        (segments, status, duration)
      │
      └── LiveFieldsPreview / TranscriptView / RecordingControls / modals
```

The split matters more than the box count:

- **`speechService` remains a pure engine driver.** It starts, stops and normalizes events. It knows nothing about sessions, timers or persistence — which is what keeps an offline or on-device recogniser a one-file swap.
- **`dictationSessionManager` owns everything that is true of a *session* rather than a *recogniser*:** the duration timer, the audio cues, the debounced autosave and the debounced live extraction. It is a plain singleton with no React dependency, so it can be driven from a voice command or a background trigger later without a hook to host it.
- **`useSpeechRecognition` still owns the recogniser lifecycle** — permission, the restart loop, error classification, teardown — and delegates session concerns to the manager. Pause and resume are hook actions because they must also cancel the restart timer, which only the hook holds.
- **The amplitude rule from Phase 2 is unchanged and still binding**: RMS goes to a Reanimated shared value, never to the store. The duration timer follows the same principle — the store holds no ticking value.

### One microphone, two consumers — Phase 8

**Two audio clients cannot share the microphone on Android.** This was measured, not assumed. Six phases on the Oppo A059, 30 s each, reading a fixed script:

| Phase | Source | Word recall | Recognizer result |
| :-- | :-- | --: | :-- |
| A | none (baseline) | 75% | 3 finals |
| B | MIC | 0% | `NO_MATCH` ×5 |
| C | VOICE_RECOGNITION | 0% | `NO_MATCH` ×5 |
| D | MIC, started 5 s late | 22% | died the moment capture began |
| E | VOICE_COMMUNICATION | 0% | `NO_MATCH` ×5 |
| F | CAMCORDER | 0% | `NO_MATCH` ×5 |

`isClientSilenced` was **false** throughout and our capture was healthy (peak 9.5k–16k), so it is not that the OS silenced us — **our `AudioRecord` wins the microphone outright and the recognizer starves.** Start order does not decide it: phase D shows the recognizer working until capture begins, then stopping.

The fix inverts the arrangement. `SharedMicModule` owns the only `AudioRecord` and hands the recognizer a pipe via `RecognizerIntent.EXTRA_AUDIO_SOURCE` (API 31+), so nothing contends. Three properties of that module are load-bearing:

- **The WAV is written first and unconditionally**, then the frame is offered to a bounded drop-oldest queue for the pipe. A slow recognition service can therefore never damage the recording.
- **Segmented session mode** (`EXTRA_SEGMENTED_SESSION = EXTRA_AUDIO_SOURCE`) is the only shape that works. The classic per-utterance mode streams partials over a pipe but **never finalises** — measured: `TIMED OUT after EOF · segments=0`.
- Results arrive at **end-of-audio**, so partials carry the live view during dictation and the confirmed transcript lands at Stop.

Result: 88% recall against the 75% baseline, partials from 3.0 s, one clean finalisation.

### Transcript state — Phase 8

Four values, and the distinction between them is the whole design:

```text
nativeRaw          recognizer output, frozen when dictation stops
anuvadini.raw      service response, frozen on arrival
segments           the editable native transcript
anuvadini.text     the editable AI transcript
```

**The diff always compares raw against raw.** A doctor's correction can never appear as something the AI did, and cannot rewrite history.

**A continuation appends to a snapshot, not to live state.** When "Add More Speech" begins recording, `transcriptRefinement.beginContinuation()` captures `{ text, raw }` as it stands. The result is then folded in as:

```text
raw  = base.raw  + "\n" + new     only what the service produced
text = base.text + "\n" + new     the doctor's corrections survive
```

Appending to the snapshot rather than to live state is what makes **Retry idempotent by construction** — replaying the same continuation any number of times yields exactly one appended chunk. The base belongs to the *recording*, not the request: retained on failure so Retry replays the same starting point, cleared on success, and cleared by `clearSession`, consultation discard and starting a new consultation.

**Viewing is separate from selecting.** `viewedSource` is screen-local; `transcriptSource` in the store is what the report is built from. Only the explicit *Use …* action changes the latter, and only that re-runs extraction — folded through the existing `mergeExtraction`, so manually corrected report fields survive.

### Transcription transport — Phase 8

`TRANSCRIPTION_TRANSPORT` in `src/config/endpoints.js` is a **declared constant**, not inferred from whichever URL happens to be set — a debug default silently winning on a device cost a test cycle before it was made explicit.

| Mode | Request | Credential |
| :-- | :-- | :-- |
| `direct` (shipping) | `{ audioBuffer, audioLanguage }` → Anuvadini | `Authorization: Bearer <token>` from `BuildConfig` |
| `proxy` (local dev, future prod) | `{ audio_buffer, audio_language }` → `server/` | none on the device |
| `none` | — | feature reports unconfigured |

Direct mode **ignores the proxy URL entirely**, even in a debug build. Switching to the proxy after deployment is one constant and no feature code.

### The `reports` schema

Migration 1, in `src/db/database.js`:

```sql
CREATE TABLE reports (
  id             TEXT PRIMARY KEY,      -- app-generated, sync-friendly (not AUTOINCREMENT)
  patient_name   TEXT,                  -- denormalized for the dashboard list
  diagnosis      TEXT,                  -- denormalized for the dashboard list
  transcript     TEXT NOT NULL,         -- the original dictation, verbatim
  extracted_json TEXT NOT NULL,         -- raw extractPatientFields() output
  edited_json    TEXT NOT NULL,         -- the doctor-facing values
  status         TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'final'
  created_at     INTEGER NOT NULL,      -- epoch ms
  updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_reports_created_at ON reports (created_at DESC);
```

Two decisions here look redundant and are not:

- **`patient_name` and `diagnosis` are deliberately denormalized** out of `edited_json`. The dashboard then lists and sorts without parsing a JSON blob per row, and they cannot drift because only the repository writes rows.
- **Both `extracted_json` and `edited_json` are kept.** The extraction carries `confidence`, `source` and transcript offsets; that metadata is what drives the `UNCERTAIN` badges. Storing only the edited values would silently disable them the first time a doctor touched a field, and would make "what did the machine actually hear?" unanswerable — a question that matters in a medical record.

The id comes from a small `makeId()` (timestamp + random suffix). `crypto.randomUUID` is **not** assumed to exist on Hermes.

**Migrations are append-only.** `MIGRATIONS` is an ordered array driven by `PRAGMA user_version`; index 0 takes a fresh database to version 1. Editing a migration that has already shipped will not re-run on an installed app — add a new entry instead.

### The `active_sessions` schema

Migration 2, added in Phase 5:

```sql
CREATE TABLE active_sessions (
  id               TEXT PRIMARY KEY,   -- 'sess_<base36 timestamp>'
  segments_json    TEXT NOT NULL,      -- the utterance array, verbatim
  live_fields_json TEXT,               -- last live extraction result
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL    -- epoch ms
);
```

- **One row per session, with the utterances as JSON**, rather than a row per utterance. A session is only ever read whole, so an upsert of one row costs one write per debounce tick instead of N inserts, and it matches the `extracted_json` / `edited_json` convention already in `reports`. Each save rewrites the whole blob — irrelevant at consultation length.
- **The row is transient by design.** It is deleted when the report is generated or the doctor discards a recovered session. A row that outlives its session means the app died, which is exactly the condition the recovery prompt exists for.
- **Writes are debounced 2 s and every failure is swallowed.** Autosave is insurance; it must never be able to interrupt a dictation in progress.
- `sessionPersistenceService` calls `runMigrations()` before every query through its own `openSessionDb()` helper, because dictation can be the first thing that touches the database on a fresh install — the reports store is not guaranteed to have run first.

**Migration 0 must never be edited.** The array is append-only, driven by `PRAGMA user_version`; an installed app at version 1 only runs index 1 to reach version 2.

### The auto-restart loop — the core of Phase 2

Android's `SpeechRecognizer` is **single-utterance**: it stops at the first pause. The native module's `onResults`/`onEndOfSpeech`/`onError` all clear its `isListening` flag.

A doctor dictating patient details pauses constantly. So the hook restarts the recognizer after every utterance and accumulates the results as **chunks** in the store. Only an explicit Stop, an unmount, or the app being backgrounded ends a session. `selectFullTranscript` joins the chunks.

### Error classification

The library forwards raw Android `SpeechRecognizer` error codes. They are split into transient and fatal in `src/constants/recordingStates.js`:

| Codes | Handling | Why |
| :-- | :-- | :-- |
| 5, 6, 7, 8, 10, 11 | **Transient** — retried silently | 6 (speech timeout) and 7 (no match) fire on *every natural pause*. Surfacing them would make normal dictation look broken. |
| 12, 13 | **Fatal** — surfaced immediately | Language not supported / unavailable. Retrying cannot fix these. |
| 9 | Maps to `permissionBlocked` | Insufficient permissions. |

**Retry cap:** 5 consecutive transient errors that produce no text end the session with "No speech detected". This prevents an invisible infinite restart loop when the microphone is dead or permanently silent.

**Restart backoff:** 400 ms base, escalating, capped at 2 s. Restarting too aggressively causes the *system* speech service to unbind mid-cycle and emit `SERVER_DISCONNECTED` (code 11) — the loop was provoking the very error it then had to handle.

**Live-session guard:** `onReadyForSpeech` and `onBeginningOfSpeech` both cancel any queued restart. Code 11 can arrive spuriously and the same session then proceeds normally; without this guard the queued restart fires ~2 s later and destroys a healthy session *mid-sentence*, silently discarding the doctor's speech. This was observed in logs and is the reason the guard exists.

### Visualizer

`ListeningVisualizer` is driven by real `onSpeechVolumeChanged` RMS dB, normalized from roughly `-2…10` to `0…1`, with a per-bar gain so a uniform level still produces an organic silhouette. It is not a decorative animation.

**Amplitude never enters React state.** Android emits `onRmsChanged` 10–20×/second; routing that through the store re-rendered the whole screen subtree at that rate and pushed transcript updates 2–3 seconds behind speech. It is a Reanimated shared value (`amplitudeShared` in `speechService`) read inside worklets, so the waveform costs zero renders.

### Extraction pipeline (FR-5) — v2

Ten stages under `src/services/extraction/`, with `extractionService.js` as a thin orchestrator and `clinicalCues.js` holding the contextual vocabulary:

```text
Transcript
   ↓  normalizeTranscript   fillers stripped, whitespace collapsed, + index map
   ↓  detectNegation        NegEx-lite scopes: cue → terminator
   ↓  detectMarkers         every field introducer, with positions
   ↓  segmentTranscript     value = marker end → next marker start
   ↓  classifySegment       chronicity reroutes a symptom to history
   ↓  postProcessors        age/phone/PIN typing, findings and medication lists
   ↓  collectEvidence       gender from patient nouns and pronouns
   ↓  suppressNegated       drops negated and cancelled candidates
   ↓  validators            reject implausible values
   ↓  resolveConflicts      confidence, then position
Structured record
```

**Marker segmentation is still the load-bearing idea.** A value ends wherever the *next* marker begins — whatever field that marker belongs to. No field needs to know what may follow it, so **arbitrary dictation order works by construction**, not by enumerating orderings. An earlier design encoded "which keywords may follow this field" in each terminator and collapsed the moment a doctor led with the diagnosis.

#### Scalar replacement vs accumulating fields

`symptoms`, `prescriptionNotes` and `additionalRemarks` merge across sentence boundaries — a doctor lists them over several breaths. **Scalar fields do not.** A scalar restated in a later sentence is a correction, not a continuation.

That distinction was missing originally, and its absence produced the worst class of bug found in validation: *"Diagnosis is viral fever. Actually, diagnosis is throat infection"* merged into one segment, so conflict resolution never saw two candidates and the field held both values concatenated. The same fault silently kept the first of two dictated patient names.

#### Negation

`detectNegation` scopes each cue (`no`, `not`, `denies`, `without`, `negative for`, `ruled out`) from its own position to the first terminator — a sentence end, or a contrast word such as `but` or `however`. Nothing is rewritten; the ranges are consulted by whoever builds a list.

- Negated findings never enter a positive field. `splitFindings` separates positives from negatives item by item.
- The negatives are still recorded, because a stated denial is clinical information: they surface in remarks as `Denies: chest pain, breathing difficulty`.
- **Joined with `;`, not `.`** — a full stop trips the suite's no-sentence-bleed assertion, and a semicolon reads correctly in a printed record.
- `suppressNegated` covers the scalar fields, where a marker fires happily inside a negation: `history of` matches "no history of diabetes" and would otherwise record diabetes as a positive condition.

#### Correction and retraction

Three mechanisms, in order:

1. **Intra-segment cut.** A correction cue (`sorry`, `correction`, `I mean`, `make that`) discards everything before it and keeps the tail. Numeric fields additionally take the *last* plausible value, because `actually` is stripped as a filler in stage 1 and may not survive to be seen as a cue.
2. **Restated-label strip.** The surviving tail often repeats the field label — *"…correction, diagnosis is viral infection"* — so `RESTATED_LABEL_PATTERN` removes it. Without this the diagnosis field literally read "Diagnosis is viral infection".
3. **Cancellation of an earlier positive.** A negation *preceded by a retraction cue* cancels a previous value in the same field, matched on a 6-character stem so that "no history of diabetes" cancels "known diabetic", and "do not start Paracetamol" cancels the earlier prescription.

The retraction-cue requirement is the safety guard. Without it a plain "no chest pain" would delete any earlier finding that merely shared a word.

#### Pronoun-based gender evidence

Precedence is strict: **explicit declaration > explicit patient noun > pronoun**. A single pronoun is enough, at confidence `0.45` — deliberately below `LOW_CONFIDENCE_THRESHOLD`, so an inferred gender always renders with the `UNCERTAIN` badge.

- Conflicting evidence at the same level yields **blank**, never a guess.
- Gender is **never** inferred from the patient's name.
- A companion-noun guard ignores pronouns within ~40 characters of `mother`, `husband`, `attendant` and similar, so "Her husband says the patient has fever" does not set the patient's gender.

That guard is a word list, not comprehension. It covers the common phrasings and will not catch every case, which is exactly why the inference sits below the uncertainty threshold.

#### Symptoms vs medical history

`classifySegment` reroutes a symptoms segment to medical history when chronicity cues are present (`for N years`, `known`, `chronic`, `k/c/o`) and no presentation cue contradicts them (`today`, `now`, `since yesterday`). It runs **before** segment merging — otherwise "has had diabetes for ten years" and "presents with fever", both symptoms markers, fuse into one span and the distinction is unrecoverable.

**Trap worth remembering:** a bare `past` in the chronicity list matched *"for the past three days"* and silently moved acute symptoms into medical history, emptying the symptoms field in several real dictation samples. The cue now requires `past history`, and `for the past N days` counts as presentation.

#### Prescription vs advice

Both "advised paracetamol" and "advised blood tests" are grammatical, so the marker alone cannot decide. The rule: **only weak markers reroute.** A prescription segment opened by the ambiguous `advised` marker whose content parses as no medication moves to remarks; a segment opened by an explicit marker (`prescribed`, `Rx`, `prescription notes`) keeps its content even with no parsable dose, because "Prescribed paracetamol" is a prescription.

`prescription notes` needs its own explicit marker specifically so that it spans the word `notes`. The bare `notes` remarks marker starts one word later and, before this existed, stole the medication out of nine of ten real dictation samples.

#### Conversational cleanup is field-aware

A value must hold the clinical information, not the phrasing that introduced
it. Two mechanisms do that: the **marker consumes the introducer** ("diagnosis
is", "known case of", "I am prescribing"), and `trimLeading`/`trimTrailing`
strip whatever connective survives at the edges.

Diagnostic hedging is the one piece that is **not** global. `looks like`,
`seems to be`, `most likely` and friends live in `DIAGNOSIS_HEDGE_PATTERN` and
are applied only by the `diagnosis` processor. They used to sit in the shared
leading trim, where they cost an address its first word — "Likely Lane, Sector
10" became "Lane, Sector 10".

What is never stripped is clinical meaning: `suspected dengue` and `probable
dengue` keep their qualifier, and `severe`, `mild`, `persistent`, `dry`,
`productive` and `recurrent` stay attached to their symptom. Hedging that
frames the doctor's confidence goes; hedging that qualifies the condition
stays.

Every extracted field also carries `sourceText` — the dictated words the value
came from — beside the marker that matched and the offsets into the original
transcript. The raw transcript is never rewritten.

#### Numeric normalization

Speech recognisers group digits arbitrarily, so `parseNumbers.js` recovers the
number from the grouping rather than matching it literally. `digitGroups` joins
a run **only** across spaces and hyphens; every other character ends it, which
is what stops a PIN from swallowing the phone number in the next sentence.

- **PIN** is six digits not starting at zero. Grouping applies only inside a
  marked segment — the unmarked fallback keeps its strict contiguous pattern, so
  an explicit "PIN code" stays stronger evidence than a bare six-digit number.
- **Phone** reduces to the bare ten digits the report stores: `+91`, `91` and a
  leading `0` are stripped when what remains is a plausible Indian mobile. A
  candidate that cannot be reduced is rejected rather than stored half-parsed.
- **Spoken digits** run through the same normalizer, so "plus nine one nine
  five five six…" resolves to the same ten digits as "+91 9556774130".

Dosage and duration are unaffected by construction: "500 milligrams" ends the
run at `m`, and "5 days" is a single-digit group — neither reaches six or ten.

#### Medication parsing

`parseMedication` splits one entry per drug on `,` and `;`, and on `and` **only** when a drug-like token follows — so "twice daily for five days and review after three days" never splits mid-instruction. Strength, frequency, duration, route, form and timing are parsed for validation and traceability; the dictated wording is preserved verbatim and never normalised or reordered.

#### Confidence and evidence

Bands are unchanged and still mean **marker specificity, not probability**; nothing is calibrated. Explicit marker 0.90–0.95, typed pattern 0.75–0.90, contextual 0.60–0.75, pronoun inference 0.45.

**There is no explicit conflict-precedence layer, and none is justified.** Every failure found in adversarial validation was a segment-merge bug or missing vocabulary — never a ranking error. Once two validated candidates reach `resolveConflicts`, "higher confidence wins, equal confidence means later wins" already produces the corrected value, which is why the age, contact-number and diagnosis corrections all pass. If a future case shows two validated candidates ranked wrongly, that is when precedence earns its place.

**Conflict policy:** confidence first, then position. Equal confidence means a later value wins, which is what makes self-correction work — *"age 32… sorry, 22"*. Putting position first let a weak late marker override an explicit early one.

**Precision over recall throughout.** No marker and no fallback means the field stays `null`. A wrong value in a patient record is worse than a blank one.

Offsets are translated through the normalizer's index map. Filler-stripping shifts every position, and offsets taken from the normalized string would look valid while pointing at the wrong characters.

**Results carry metadata, not bare strings:**

```js
{ value: 'Viral infection', confidence: 0.95, source: 'diagnosed with',
  start: 244, end: 281 }   // offsets into the ORIGINAL transcript
```

Candidate extraction remains the **designated seam**: swap it for an NLP or local model to support free-form dictation, leaving every other stage intact.

---

## 6. Project Structure

```
MedScribe/
├── App.jsx                          # Root: SafeAreaProvider + NavigationContainer + theme
├── index.js                         # AppRegistry entry
├── src/
│   ├── components/
│   │   ├── AnimatedMicButton.jsx    # Hero mic, Reanimated breathing + ripple
│   │   ├── AppHeader.jsx            # Brand header, optional back button
│   │   ├── ListeningVisualizer.jsx  # Aura + spectrum driven by real mic RMS
│   │   ├── LiveFieldsPreview.jsx    # Fields recognised so far, shown mid-dictation
│   │   ├── MicGlyph.jsx             # Mic icon drawn from Views (no icon font in use)
│   │   ├── PermissionGate.jsx       # denied / blocked / unavailable states (NFR-4)
│   │   ├── RecordingControls.jsx    # State-aware button row
│   │   ├── ReportField.jsx          # One report row — editable when given onChange
│   │   ├── ScreenContainer.jsx      # Safe-area wrapper, status bar
│   │   ├── SectionTitle.jsx         # Title + subtitle block
│   │   ├── SessionRecoveryModal.jsx # Restore / discard an interrupted dictation
│   │   ├── StopConfirmationModal.jsx # Confirm before ending a session
│   │   └── TranscriptView.jsx       # Live transcript, final + italic interim (FR-4)
│   ├── constants/
│   │   ├── recordingStates.js       # State machine, error maps, timings
│   │   ├── patientFields.js         # The 11 SRS fields, order, "Not Available"
│   │   ├── fieldMarkers.js          # MARKER VOCABULARY — the extension point
│   │   └── clinicalCues.js          # Negation, chronicity, pronoun, medication cues
│   ├── db/
│   │   ├── database.js              # Connection + user_version migrations (SQL lives here)
│   │   └── reportsRepository.js     # CRUD; the ONLY other file that writes SQL
│   ├── hooks/
│   │   └── useSpeechRecognition.js  # Session orchestrator — the heart of Phase 2
│   ├── navigation/
│   │   └── RootNavigator.jsx        # Dashboard → Recording → TranscriptReview → Report
│   ├── screens/
│   │   ├── DashboardScreen.jsx      # FR-1 launch screen: overview, quick actions, reports
│   │   ├── RecordingScreen.jsx      # FR-2/3/4 state machine, pause/resume, recovery
│   │   ├── TranscriptReviewScreen.jsx  # Correct the transcript before extraction (FR-4)
│   │   └── ReportScreen.jsx         # Editable draft, Save, Finalize, Download PDF
│   ├── services/
│   │   ├── permissionService.js     # Mic permission, result → state mapping
│   │   ├── speechService.js         # Vendor isolation layer + amplitudeShared
│   │   ├── extractionService.js     # FR-5 orchestrator (public API)
│   │   ├── reportDraft.js           # Pure: extraction → editable draft, merge, diff
│   │   ├── reportDocument.js        # Pure: draft → PDF payload
│   │   ├── pdfService.js            # Native-exporter isolation layer
│   │   ├── dictationSessionManager.js   # Session lifecycle: timer, cues, autosave, live fields
│   │   ├── audioFeedbackService.js  # AudioCue isolation layer; no-ops without the module
│   │   ├── sessionPersistenceService.js # Debounced autosave + recovery (active_sessions)
│   │   └── extraction/              # One module per pipeline stage (v2)
│   │       ├── normalizeTranscript.js   #   fillers + index map
│   │       ├── detectNegation.js        #   negation scopes, findings split
│   │       ├── detectMarkers.js         #   find introducers
│   │       ├── segmentTranscript.js     #   slice between markers
│   │       ├── classifySegment.js       #   chronic condition -> history
│   │       ├── postProcessors.js        #   typing, findings + medication lists
│   │       ├── collectEvidence.js       #   gender from nouns and pronouns
│   │       ├── suppressNegated.js       #   drop negated / cancelled values
│   │       ├── parseMedication.js       #   one entry per drug, attributes
│   │       ├── validators.js            #   reject implausible values
│   │       └── resolveConflicts.js      #   repeats, self-correction
│   ├── specs/
│   │   ├── NativePdfExporter.js     # TurboModule spec — codegen input, lint-ignored (§7)
│   │   └── NativeAudioCue.js        # TurboModule spec — cues + system-tone suppression
│   ├── store/
│   │   ├── useRecordingStore.js     # Zustand: status, segments, partial, duration, live fields
│   │   └── useReportsStore.js       # Zustand: saved reports, load/save/finalize/remove
│   ├── utils/
│   │   └── datetime.js              # Display + relative timestamps, PDF filename stamps
│   └── theme/
│       ├── colors.js  spacing.js  typography.js  index.js
├── scripts/
│   ├── test-extraction.mjs          # 238 assertions — regression floor
│   ├── test-extraction-natural.mjs  # 89  assertions — natural phrasing
│   ├── test-extraction-adversarial.mjs # 31 assertions — conflicts and corrections
│   ├── test-extraction-samples.mjs  # 142 assertions — 20 real dictation samples
│   └── test-report.mjs              # 71  assertions — draft + PDF payload
├── android/                         # compileSdk/targetSdk 36, minSdk 24, New Arch + Hermes
│   └── app/src/main/
│       ├── java/com/medscribe/pdf/  # PdfExporterModule.kt + PdfExporterPackage.kt
│       ├── java/com/medscribe/audio/ # AudioCueModule.kt + AudioCuePackage.kt
│       └── res/xml/file_paths.xml   # FileProvider paths for the share sheet
├── ios/                             # Present but never built — see §9
├── DESIGN.md                        # Design system: colour, type, spacing, components
└── docs/
    ├── MedSrcibe_SRS.md             # Requirements (authoritative)
    ├── Antigravity_Plan.md          # Historical — Phase 1 plan
    ├── Antigravity_walkthrogh.md    # Historical — Phase 1 walkthrough
    └── handoff.md                   # This file
```

---

## 7. Implementation Notes & Conventions

> Each item below cost real debugging time. Several look like defects and are not.

### File extensions
`.jsx` for any file containing JSX, `.js` for everything else. The project is **100% JavaScript** — TypeScript was removed and `tsconfig.json` deleted. The TS devDependencies (`typescript`, `@types/*`, `@react-native/typescript-config`) remain in `package.json` but are inert; removing them requires an `npm install` and lockfile churn.

### ESLint jest override
`@react-native`'s ESLint config globs its jest environment as `*.{spec,test}.{js,ts,tsx}` — note the absent `jsx`. Renaming the test file to `.jsx` therefore broke `no-undef` on `test`/`expect`. `.eslintrc.js` carries a local override to restore it. Do not remove it.

### `src/specs/**` is excluded from ESLint

`hermes-eslint` is not installed, so `@react-native`'s config parses `.js` with `@babel/eslint-parser`. Its scope analysis has no visitor keys for the Flow `interface` node a TurboModule spec is built around, and dies with `Parsing error: Cannot read properties of undefined (reading 'forEach')` — a parser crash, not a code defect.

The spec is validated where it matters: React Native codegen reads it at build time and emits `NativePdfExporterSpec.java`, which `PdfExporterModule.kt` must satisfy to compile. A signature error there is a **build** failure, which is stricter than lint. Do not "fix" this by rewriting the spec to please the parser.

### ⚠️ `getEnforcing` is resolved lazily inside `pdfService`

`TurboModuleRegistry.getEnforcing` throws at **import** time when the native module is absent — which is exactly what happens after a JS-only reload that has not been paired with a native rebuild. At module scope that takes down the whole bundle: a white screen on launch, with the real cause buried.

So `pdfService` requires the spec inside a function, caches it, and converts the failure into *"PDF export is unavailable in this build. Rebuild the app natively…"*. Failing at the button press with a readable message beats failing at startup with none. The `require` is deliberate — a static `import` would defeat the whole arrangement.

`audioFeedbackService` follows the identical pattern for `NativeAudioCue`, with one difference: it has no user-facing failure message. Every method simply no-ops when the module is absent, so a JS-only reload still dictates normally — it just beeps the way it did before Phase 5. **Editing anything under `src/specs/` requires a native rebuild**; codegen emits `NativePdfExporterSpec.java` and `NativeAudioCueSpec.java` at build time, and the Kotlin modules must satisfy them to compile.

### Migrations run from the store, not from `App.jsx`

`ensureSchema()` fires on the first `useReportsStore` call that needs the database, not at app boot. That keeps a database failure attached to the operation that can actually surface it: `loadAll` catches it into `error`, and the dashboard renders a real message.

Running migrations in `App.jsx` instead would either crash the app before the navigator mounts, or — worse — fail silently and leave the dashboard showing its empty state, which reads as *"you have no reports"* when the truth is *"the database did not open"*. In a records application those are not interchangeable.

### The native PDF module knows nothing about patient fields

`PdfExporterModule.kt` draws whatever labelled blocks the JSON payload contains, in order, and paginates them. It has no knowledge of `PATIENT_FIELDS`, symptoms, or diagnoses.

That is why **adding a report field is a JavaScript change in `reportDocument.js` only** — no Kotlin edit, no codegen, no native rebuild. It is also why the spec passes a JSON *string* rather than a structured object: the payload shape churns as fields are added, and a string keeps that churn out of the native ABI.

The exporter writes to `getExternalFilesDir(DIRECTORY_DOCUMENTS)/MedScribe/`. App-scoped storage means **no runtime storage permission on any API level**, while still being shareable through `FileProvider` and reachable with `adb pull`.

### ⚠️ Muted audio streams must always be restored

`AudioCueModule` mutes `STREAM_MUSIC`, `STREAM_SYSTEM` and `STREAM_NOTIFICATION` for the length of a dictation, because the start/end tone heard between sentences is played by the **system** RecognitionService and cannot be disabled through `SpeechRecognizer`. Audio focus does not help — focus asks other apps to yield, it does not silence a system service.

That makes "restore, always" the module's central obligation, and it is enforced five separate ways:

1. JavaScript calls `restoreNow()` on pause, stop, error, unmount and backgrounding.
2. `onHostPause`, `onHostDestroy` and `invalidate()` restore natively — these cover a JS crash, a red box and a Metro reload, none of which run JS cleanup.
3. A 120-second watchdog inside the module restores unconditionally if JS never calls back.
4. A `SharedPreferences` flag is `commit()`-ed *before* the first mute and read in the module's constructor, so a process death mid-session is undone on the next launch.
5. Android's AudioService drops per-client mute requests when the process dies. A bonus, never relied upon.

**Do not add the ring/notification/alarm group behind a Do-Not-Disturb permission request.** On API 23+ those streams need DND access, and asking a doctor to hand over DND control to silence a beep is not a trade this app makes. Each stream is muted in its own try/catch, and a refusal is logged rather than escalated.

### ⚠️ The session starts inside `beginSession`, not around it

`dictationSessionManager.startSession()` — which plays the cue and starts the duration timer — is called from inside `beginSession`, after the permission gate. It was originally called from a wrapper that only the retry button used, so the mount path never reached it: the timer never started and a whole consultation displayed `00:00`. Anything that must happen once per session belongs inside `beginSession`.

### ⚠️ `stop()` must work from `PAUSED`

`pause()` clears `shouldContinueRef`, and `stop()`'s guard used to return early when that ref was false. Stopping from a paused session therefore set the status to `PROCESSING`, scheduled no finalize, and hung there forever. The guard now admits `PAUSED` explicitly. Any new state that stops the restart loop has to be considered here too.

### ⚠️ Crash recovery is answered before the recogniser starts

`RecordingScreen` holds a `recoveryState` of `checking → prompting → settled` and passes `autoStart` to the hook; the mount effect only begins a session once that is settled. Starting first would run `beginSession`'s `reset()` against the very transcript being restored, and whichever won the race would decide whether the doctor keeps their dictation. A restored session then starts with `keepTranscript: true`, which is the same path "Resume Dictation" uses from the review screen.

### ⚠️ Anything on a filled accent surface uses `colors.onPrimary`

The palette is light (see `DESIGN.md`), so `colors.textPrimary` is near-black. On a `primaryAccent` button that fails contrast outright. Filled blue surfaces — primary buttons, the dashboard CTA, the round mic, active toggles — take `colors.onPrimary`; outline and surface variants keep `textPrimary`. The status bar is `dark-content` for the same reason.

### ⚠️ Scalar fields must not merge across a sentence boundary

`mergeAdjacentSameField` exists so "Additional remarks: advise hydration, CBC, and review after three days" stays one value. That case is intra-sentence. A **scalar** field restated in a *later* sentence is a correction, and merging it concatenates the retracted value onto the new one — *"Diagnosis is viral fever. Actually, diagnosis is throat infection"* produced a field holding both. Only `symptoms`, `prescriptionNotes` and `additionalRemarks` merge across sentences.

### ⚠️ `past` is not a chronicity cue on its own

A bare `past` matched *"for the past three days"* and rerouted acute symptoms into medical history, leaving the symptoms field empty in several real samples while medical history held the symptom text. The cue requires `past history`; `for the past N days` is a presentation cue. Any new chronicity vocabulary must be checked against an acute phrasing before it ships.

### ⚠️ Cancellation requires a retraction cue

`suppressNegated` lets a negation cancel an *earlier* positive value, matched on a 6-character word stem. That is only safe because it additionally requires a retraction cue (`correction`, `sorry`, `actually`) near the negation, or an explicit cancel instruction (`do not start`). Without that guard a plain "no chest pain" would delete any earlier finding sharing a word.

### The restated field label is stripped after a correction

Doctors repeat the label when restating a value: *"…correction, diagnosis is viral infection"*. The surviving tail therefore begins with the marker phrase, and the diagnosis field read "Diagnosis is viral infection" until `RESTATED_LABEL_PATTERN` was applied inside `afterLastCorrection`.

### `prescription notes` needs its own marker

The bare `notes` remarks marker starts one word after `prescription`, so it opened a remarks segment and left the prescription segment empty — the medication went to remarks in **nine of ten** real dictation samples. The explicit `prescription notes` marker spans the word `notes`, so overlap resolution drops the competitor. Any new two-word marker whose second word is itself a marker needs the same treatment.

### ⚠️ Never call `subscription.remove()` on speech listeners
The library's native `removeListeners` iterates its event map **while deleting from that same map**:

```kotlin
// node_modules/@appcitor/react-native-voice-to-text/.../VoiceToTextModule.kt:292
for (eventName in eventListeners.keys) {
  ...
  eventListeners.remove(eventName)   // ConcurrentModificationException
}
```

This surfaces in logcat as **"Exception in native call"** on every teardown.

`speechService.subscribe()` therefore registers the native listeners **once for the application's lifetime and never removes them**, swapping handlers on the JS side instead. This looks like a listener leak. It is not — it is the workaround. Removing a listener is the only way to trigger the bug, so we never do.

The alternative is `patch-package` plus a full native rebuild (~12 minutes); that remains available if the library is ever forked.

### ⚠️ Unmount calls `stop()`, never `destroy()`

The other half of the register-once design above — read the two together.

The library's `destroy()` also runs `eventListeners.clear()`, wiping the native listener-count map. Because `ensureNativeListeners()` short-circuits on a non-null `nativeSubscriptions`, there was no way to rebuild it: one back-press left the module with a destroyed recognizer **and** an empty listener map while JS still believed it was subscribed. Device logs showed seven `addListener` calls on first entry, `destroy` on back, then zero native calls on the second attempt.

The symptom was a permanent **"Speech recognition unavailable"** on re-entering the Recording screen, unrecoverable without force-closing the app.

Two rules follow:

- **Unmount calls `stop()`.** It releases the microphone, and `startListening()` re-initialises the recognizer on every start regardless — so `destroy()` bought nothing and cost the listener registration.
- **`destroy()` nulls `nativeSubscriptions`**, so the next `subscribe()` re-registers. Only *removal* triggers the library's `ConcurrentModificationException`; adding again is safe. This keeps `destroy()` usable for genuine disposal without stranding the module.

### ⚠️ `BackHandler` in `RecordingScreen` is required
Without it, hardware/gesture back during an active recording falls through to the default activity-finish path, tearing down the React root while the Activity survives. The result is a **blank white screen**, with `Dropping event due to root view being removed` in logcat. The handler routes hardware back through the same `stop()` → `goBack()` path as the header arrow and returns `true` to consume the event.

The in-app header back arrow was never affected — only hardware/gesture back.

### ⚠️ No `isRecognitionAvailable()` pre-check
An earlier implementation gated `beginSession` on `isAvailable()`. Any transient rejection landed in the catch and stranded the user on a permanent "Speech recognition unavailable" dead end, despite a working recognizer being installed. It was removed: `startListening()` already rejects with `NOT_AVAILABLE` when the engine is genuinely missing, and `safeStart` maps that to the same state — correct reporting, without false positives.

### `onSpeechVolumeChanged` must stay registered
The native module gates volume emission on its internal listener count. If nothing subscribes to that event, no RMS values are emitted and the visualizer goes flat. `speechService` registers it unconditionally.

### Permission result fallback
`toRecordingState()` maps only an explicit `RESULTS.UNAVAILABLE` to the dead-end "unavailable" screen. Anything unrecognized falls back to `permissionDenied`, which is recoverable — a silently revoked one-time grant, or an OEM-specific result string, must leave a working "Grant access" button rather than claiming the device cannot do speech recognition.

### ⚠️ Microphone amplitude must never enter React state

`onRmsChanged` fires 10–20×/second. Putting it in the Zustand store re-rendered `RecordingScreen` and its whole subtree at that rate and starved partial-transcript updates — the visible symptom was transcript text appearing **2–3 seconds behind speech**. It lives in the `amplitudeShared` Reanimated value and is read inside worklets. Do not "simplify" it back into state or props.

### Extending extraction: add a marker row, not logic

New phrasing goes in `src/constants/fieldMarkers.js` as a row with a confidence band. The pipeline stages should not need editing to support a new way of saying something. If a change seems to require touching `segmentTranscript` or `detectMarkers`, that is a signal to re-check whether a marker would do.

### Extraction terminators must not depend on punctuation

Fixtures written by hand contain full stops; **live dictation contains none**. An early version terminated values only at `.` and `;`, which worked perfectly in tests and ran to end-of-transcript on real speech. Keyword boundaries are the primary terminator; punctuation is a bonus.

### Extraction regexes ship to Hermes — no lookbehind

The phone pattern in `postProcessors.js` anchors with `\b` rather than a `(?<!\d)` lookbehind. That is deliberate: Hermes has had gaps in lookbehind support, and this pipeline runs on the device as well as under Node.

The pattern also carries a `(?![\s-]?\d)` guard. Without it, capping the digit count left the match greedy: *"9876543210 9812345678"* matched as one 20-digit run, failed the 10–13 digit filter, and consumed both numbers — losing them entirely. The guard rejects a candidate that runs into a following number, so the scan skips the first and matches the second.

### `unclaimedRanges` must claim the trailing text

Sentence-boundary termination means the final segment usually stops at a full stop rather than at end-of-transcript. Anything after it belonged to neither the segment nor the unclaimed pool, so a bare closing value — a PIN or phone number with no introducer — was invisible to the fallbacks. `segmentTranscript.js` claims that tail exactly once, from the final segment's end.

A related trap: verifying a post-processor *through* `extractPatientFields` with a marker prefix takes a different code path and can produce a plausible-looking result while the processor itself returns `''`. Call the processor directly when testing one.

### Extraction imports use explicit `.js` extensions

Deliberate. Metro resolves extensionless imports, Node does not. The explicit extensions let the whole pipeline run under plain Node, which is what makes `scripts/test-extraction.mjs` possible with zero test dependencies. Do not "tidy" them away.

### ⚠️ A segmented session must be closed before the recognizer is destroyed

`stop()` in `SharedMicModule` closes the **write** end of the pipe, waits on a latch for `onEndOfSegmentedSession` (10 s ceiling), and only then destroys the recognizer. The reverse order — destroy, then close — produced a session that opened cleanly, detected speech and returned **nothing**, because the results were discarded microseconds before they arrived. On the tested Oppo A059 / Android 16 configuration, partial results do not finalize until the audio pipe is closed, so closing the write descriptor is what requests finalization.

`EXTRA_AUDIO_SOURCE` also states that "the caller of the recognizer is responsible for closing the audio" — so the read descriptor is held for the life of the session, not closed after `startListening`. Closing it immediately raced the service and produced `ERROR_CLIENT` on every attempt.

### ⚠️ The continuation base belongs to the recording, not the request

`continuationBase` is captured when "Add More Speech" starts recording and cleared only on success or teardown. A failed attempt keeps it so Retry replays against the same starting point. Appending to live state instead would make a retry duplicate the continuation the moment any path updated the store first.

### ⚠️ Production file operations must not live in a debug-only package

`AudioCapturePackage` is registered only when `BuildConfig.DEBUG`. When consultation audio's `readCaptureBase64` / `deleteCapture` / `purgeCaptures` still lived there, a **release** APK recorded audio it could neither read nor delete — no AI transcription, and patient WAVs accumulating forever. Nothing crashed, because the service degrades when a module is absent, so it failed silently.

They now live in `SharedMicModule`, which writes the file and is registered in every build. Before moving anything into `audio/AudioCaptureModule.kt`, check which variants register it.

### ⚠️ Recording file paths are validated, not trusted

`readCaptureBase64` and `deleteCapture` resolve the canonical path and refuse anything whose parent is not `filesDir/consultations`, which also closes `..` traversal and symlinks. The path arrives from JavaScript and these methods only ever need one directory.

### ⚠️ The Anuvadini token is never logged, returned or dumped

It reaches JavaScript only through `appConfigService.getAnuvadiniToken()`, is attached as a header, and appears in no result, no error payload, no log line and not in the diagnostic dump. `test-anuvadini-client.mjs` and `test-proxy.mjs` both assert this across every failure path.

Build-time injection keeps it out of Git. It does **not** make it secret inside a compiled APK — see §9.

### ⚠️ The diagnostic dump is development-only

`DIAGNOSTICS_ENABLED = __DEV__`. `ReportScreen` passes `onLongPressTitle` only when it is true, so a release build has no handler at all rather than an inert one. The diagnostic dump carries the full consultation trace and is restricted to development builds; PDF export remains available in release builds.

### Build & tooling gotchas
- **Manifest changes require a full native rebuild.** Metro fast-refresh will not pick them up. If permission dialogs silently stop appearing after a manifest edit, this is why.
- **Three Phase 4 pieces are native and each needs a rebuild:** `@op-engineering/op-sqlite` (JSI library), the `PdfExporter` TurboModule (codegen + Kotlin), and the `FileProvider` entry in `AndroidManifest.xml`. Pulling these changes and running only `npm start` gives you a dashboard that cannot open its database and a PDF button that reports itself unavailable. Neither is a code defect.
- **`adb reverse tcp:8081 tcp:8081`** is mandatory for USB devices when installing outside `run-android` (e.g. via `adb install` or a direct Gradle task). Without it: `Unable to load script`.
- **A blank screen with no red box is usually a wedged Metro or Gradle daemon, not code.** Observed 2026-07-31: the app launched to nothing and Metro never printed a bundle line. Recovery is a full restart — kill the `java` and `node` processes, `npm start`, then rebuild and install. **Metro printing `BUNDLE ./index.js` is the proof the bundle is actually being served**; without that line the device has no JS regardless of what the install log says. Distinguish this from the `BackHandler` blank screen above, which logs `Dropping event due to root view being removed`.
- **`npx react-native run-android --device <id>` loses `--active-arch-only`.** That path builds all four ABIs — measured 4m35s and a ~103 MB APK where one ABI needs ~3 min and ~45 MB. Use `npm run android -- --device <id>` when targeting a specific device.
- **Use `npm run android`, which passes `--active-arch-only`.** The default four-ABI build takes ~11 min and produces a **~103 MB** debug APK, which then crawls to the device at a measured **1.09 MB/s** over USB 2.0 (~95 s). Building only the attached device's ABI cuts both: ~3–4 min and ~45 MB. `npm run android:all-abis` remains for universal APKs.
  `reactNativeArchitectures` in `gradle.properties` is deliberately left listing all four — `--active-arch-only` picks the right one per run, so nothing needs reverting when switching between phone and emulator.
- **`99% EXECUTING > :app:installDebug` is usually a slow APK transfer, not a hang.** Confirm before killing it — run `adb shell stat -c %s /data/local/tmp/app-debug.apk` twice; a growing number means it is still working. Then verify the install actually landed with `adb shell dumpsys package com.medscribe | grep lastUpdateTime`, because a stale timestamp means the old build is still installed.
- **Most work needs no native rebuild at all.** Only `android/`, `AndroidManifest.xml`, or native dependency changes require Gradle. Everything under `src/`, `App.jsx`, and `index.js` is served by Metro. Phase 3 is almost entirely JS and should rarely touch Gradle.
- **`react-native-reanimated/plugin`** in `babel.config.js` is correct for Reanimated 4.5.3 — it is a two-line re-export of `react-native-worklets/plugin`. Do not "fix" it.

---

## 8. Dependencies

### In active use

| Package | Version | Purpose |
| :-- | :-- | :-- |
| `react-native` | 0.86.0 | Framework. New Architecture (Fabric + TurboModules) and Hermes both enabled. |
| `react` | 19.2.3 | — |
| `@appcitor/react-native-voice-to-text` | ^0.2.1 | Speech recognition (FR-3). TurboModule. See warnings in §7 and §9. |
| `react-native-permissions` | ^5.6.1 | Mic permission. Chosen over core `PermissionsAndroid` because it distinguishes **BLOCKED** from **DENIED** and ships `openSettings()` — both required by the SRS permission flow. |
| `@op-engineering/op-sqlite` | ^17.1.3 | Local persistence (Phase 4). Real SQL with transactions and `user_version` migrations, JSI-backed and New-Architecture native, actively maintained. Chosen over key-value storage because the dashboard needs to list and sort without loading every record. |
| `zustand` | ^5.0.14 | Recording session state and saved-report state. |
| `react-native-reanimated` | ^4.5.3 | Mic button and visualizer animations. |
| `react-native-worklets` | ^0.11.3 | Reanimated 4 dependency; provides the Babel plugin. |
| `@react-navigation/native` | ^7.3.14 | Navigation. |
| `@react-navigation/native-stack` | ^7.18.6 | Native stack navigator. |
| `react-native-screens` | ^4.26.2 | Native screen primitives. |
| `react-native-safe-area-context` | ^5.8.0 | Safe-area insets. |

**Phase 5 added no npm dependencies.** The app now ships **two** app-local Kotlin TurboModules — `com/medscribe/pdf` and `com/medscribe/audio`. Neither is autolinked; both are registered by hand in `MainApplication.kt`, and forgetting that line is a silent failure that only shows up as a missing module at runtime.

**PDF generation has no dependency.** It is an in-app Kotlin TurboModule over the platform's own `android.graphics.pdf.PdfDocument` (`android/app/src/main/java/com/medscribe/pdf/`). No maintained React Native PDF *generator* currently supports the New Architecture, and an abandoned dependency sitting in the export path of a medical record is a liability. `androidx.core`'s `FileProvider`, already on the classpath, handles sharing.

### Installed but **not imported anywhere**

Listed honestly so nobody assumes they are load-bearing:

`axios`, `zod`, `react-hook-form`, `react-native-gesture-handler`, `react-native-vector-icons`, `@react-native-vector-icons/material-design-icons`, `@react-native/new-app-screen`.

`axios` and `zod` are **not** a pending API integration. Extraction is rule-based by design (SRS §8 puts AI-assisted extraction under Future Enhancements), and the pipeline deliberately has no network dependency. Note also that all icons are hand-built from `View` primitives despite two icon packages being installed.

---

## 9. Known Limitations & Future Considerations

### ⚠️ The Anuvadini token ships inside the APK

`ANUVADINI_STT_TOKEN` is injected from `android/local.properties` into `BuildConfig` at build time. That keeps it out of Git, and **that is all it does** — anyone with the APK can extract it, and rotating it means rebuilding for every installed device.

Accepted deliberately, for internal testing only. It must not go to a clinic in this form. The remedy is §4 item 1, and it is written and tested, not speculative.

### The proxy exists but is not deployed

`server/` is complete and covered by 77 assertions, but runs only on a developer machine. Until it is hosted, `TRANSCRIPTION_TRANSPORT` stays `direct`.

### Anuvadini silently truncates a submission at ~57 seconds — measured, and worked around

The service has never published a limit, so it was measured against one 99.6 s recording retained by a failed request. Trimmed to 30/45/48/52/55/58/60/62/75/90/99 s and sent with the production payload, the returned transcript **stops growing at 58 s and is byte-identical from there upward** — 41 further seconds of audio produced zero further words. The control that word count alone cannot give: the final 20 s of each clip, sent alone, transcribes perfectly, yet only 7–32 % of it appears in the whole-clip transcript, against 100 % for clips under the cut. A word-rate cross-check agrees: 1.50 words/s sustained, 86 words returned, 86 ÷ 1.50 ≈ 57 s processed.

Every response was **HTTP 200 with no error, no flag and no truncation marker**, so a partial answer is indistinguishable from a whole one and nothing downstream can detect it. Staying under the cut is the only defence.

A dictation is therefore uploaded as several requests of `SAFE_CHUNK_SECONDS` (45 s, 12 s of margin), divided evenly rather than into full chunks plus an offcut, with each interior cut moved to the quietest offset within 1.5 s so no word is split. Chunks are disjoint byte ranges of the one file — contiguous, covering it exactly — which is what makes losing or duplicating speech impossible at a join. They are sent sequentially and joined in index order *before* `applyResult`, so the raw/draft split, the diff, the continuation base, `mergeExtraction` and the report flow all still see exactly one transcription per pass.

Verified end to end against the same recording: **140 words versus 86 from a single request**, both joins landing at sentence boundaries, and extraction recovering two more fields — `prescriptionNotes` and `additionalRemarks`, precisely the end-of-dictation fields the truncation was destroying.

The per-request ceiling and the per-recording ceiling are now separate constants in `src/services/audioBudget.js`. The recording ceiling is 30 minutes and is a memory guard, not a service limit; the 120 s budget that used to **delete** a longer recording at Stop is gone.

### Confirmed AI text arrives at Stop, not while speaking

Segmented recognition delivers its result at end-of-audio. During dictation the live view is carried by partials — continuous, from about three seconds in — and the confirmed transcript lands when the doctor stops. This is a property of the platform's segmented session, not a delay we introduced.

### Only `en-IN` has been exercised

`normalizeAnuvadiniLanguage` maps thirteen Indian languages and rejects anything unknown rather than blindly appending `-IN`, but only English has been run end to end against the service.

### Dropped words during recognizer restarts — largely addressed

Android's `SpeechRecognizer` is single-utterance, so the hook restarts it after each pause. **The microphone is deaf for roughly 0.5–1.5 s during each restart**: `onEndOfSpeech` → backoff → `startListening()` → engine init → `onReadyForSpeech`. Speech in that window is lost.

Google's own voice typing holds one continuous streaming session, which is why it feels seamless; the vendor library's API cannot do that.

**The shared-microphone path removes this for API 31+ devices** — one continuous segmented session, no restarts, measured at 88% recall against the 75% restart-loop baseline. The limitation above still applies to the vendor fallback, which is what runs when `SharedMic` is unavailable.

Device results still trail fixture results whenever the fallback is in use: extraction passes its 239-assertion regression floor on clean text, but a field whose introducer phrase was never transcribed is unrecoverable — no amount of marker vocabulary helps.

### Unpunctuated adjacent symptoms stay grouped

Continuous dictation with no commas — "fever cough weakness" — yields `["Fever cough", "Weakness"]` rather than three items. Symptoms split on commas and `and` only.

**This is deliberate and is not being fixed.** Splitting on whitespace would corrupt every multi-word symptom in real use: "chest pain", "body pain", "sore throat", "shortness of breath", "burning micturition". No word is lost — two simply share one list item, and the doctor can split them on the review screen. `scripts/test-extraction-adversarial.mjs` asserts the current grouped output, so changing it is a conscious decision rather than a surprise regression.

A future fix would need a symptom lexicon or an NLP stage at the candidate-extraction seam, not a smarter separator.

### Gender inference can follow the wrong person

A single pronoun sets the gender, at low confidence and with the `UNCERTAIN` badge. The companion-noun guard covers "her husband", "his mother" and similar, but it is a word list rather than comprehension — an unusual phrasing that refers to an accompanying relative can still set the patient's gender. The badge is the mitigation; the doctor sees the field flagged for review.

### Extraction cannot infer meaning without a marker

Deterministic matching handles explicit and hedged phrasing, but not genuine inference. *"She's been a bit off colour"* will not map to symptoms; *"probably dengue"* works only because `probably` is a registered diagnosis marker.

Sparse dictation with almost no markers — *"Hema Sharma twenty-two female Sector Twelve…"* — is the concrete argument for replacing the candidate-extraction stage with an NLP model, not for adding more regexes. Pushing further with patterns means guessing, which violates the precision-over-recall rule.

### Dictation samples are now committed fixtures

Superseded. Twenty real dictation samples are committed in
`scripts/test-extraction-samples.mjs`, asserting every field each sample
states, plus a check that each prescription is populated and names its drug.
A regression in any of those dictation styles now fails the gate.

### PDF layout is verified on one device only

`PdfExporterModule.kt` measures text with `StaticLayout`, so wrapping and page breaks follow the platform's own metrics rather than a fixed character count. Output has been checked on the Oppo A059 (Android 16) — A4 geometry is device-independent, but font fallback for non-Latin glyphs is not. A transcript containing Devanagari may render differently on another OEM's font stack.

The export path itself is permission-free: `getExternalFilesDir` is app-scoped, so no storage permission is requested on any API level, and the file is reachable at `/sdcard/Android/data/com.medscribe/files/Documents/MedScribe/`.

### Persistence is single-doctor and unencrypted

The `reports` table has no `doctor_id` and no authentication guards it, per the brief. The database file sits in app-private storage, so another app cannot read it without root — but it is **not encrypted at rest**, and a report is real patient data. Before this reaches an actual clinic, `op-sqlite` supports SQLCipher, and adding a `doctor_id` column is one appended migration (§5).

There is also no sync, no export-import, and no backup: uninstalling the app destroys every saved report.

### Recognition accuracy on `en-IN` (SRS NFR-2)

Transcription on an `en-IN` device produces Hinglish rather than the dictated English. Observed: *"Patient name is Rahul Sharma"* transcribed as **"Hema Sharma film Hindi mein district"**.

Two compounding causes:

1. The `en-IN` recognizer model readily code-switches into Hindi.
2. **A library bug.** `VoiceToTextModule.kt:56` passes a `Locale` **object** to `EXTRA_LANGUAGE`, where Android expects an IETF tag **String**. `getStringExtra()` therefore returns null and the language is effectively never set:

```kotlin
putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())   // should be .toLanguageTag()
```

The library's own `setRecognitionLanguage()` cannot work around this — `startListening()` calls `initializeSpeechRecognizer()` on every start, rebuilding the intent from `Locale.getDefault()` and discarding any language previously set. Since the auto-restart loop restarts constantly, that API is useless here.

**Quick test:** set the device language to English (US) and re-dictate. **Proper fix:** `patch-package` to pass `toLanguageTag()` and stop rebuilding the intent on every start — requires a native rebuild.

This directly threatens SRS NFR-2. A patient record that renders "Rahul Sharma" as "Hema Sharma" is not usable.

### The Android emulator cannot be used for dictation

Fully investigated and ruled out. Even with a **Google Play** system image (which does have a speech recognizer), `hw.audioInput = yes`, the emulator's *"Virtual microphone uses host audio input"* toggle enabled, and the emulator launched with **`-allow-host-audio`** (without which it explicitly *zeroes out* microphone audio), **Google's own voice search transcribed nothing.**

Since a first-party Google app fails on the same emulator, the problem is emulator audio passthrough, not application code. **Use a physical device for anything touching speech.** The emulator remains fine for UI work.

Related emulator notes, if one is used for UI:
- An API 36 Play Store AVD needs **≥ 4096 MB RAM**. At 1536 MB it hangs during boot and `adb` reports the device as `offline` indefinitely.
- Cold-boot with `-no-snapshot-load` after any force-kill; a snapshot written by a killed emulator can hang on restore.

### Tests cannot run

`npx jest` fails with `Preset @react-native/jest-preset not found`. That preset is referenced by `jest.config.js` but is absent from both `node_modules` and `devDependencies`. **This has been broken since the initial commit** — it is not a regression from Phase 2.

Fix: `npm i -D @react-native/jest-preset@0.86.0` (touches `package-lock.json`).

There is currently **no Jest component or UI test coverage** (the single smoke test in `__tests__/` has never been executed). Automated coverage for core domain logic, extraction, reports, audio budgets, transcript state, and proxy features is provided by the Node test suites listed in §2.

### Build artifacts are tracked in git

**645 files under `android/app/.cxx/`** are tracked. A `.gitignore` exists but does not untrack files already committed. This bloats the repository and produces large spurious diffs on every build.

Suggested cleanup (**not performed** — it rewrites the index and deserves a deliberate commit):

```bash
git rm -r --cached android/app/.cxx
# then add android/app/.cxx/ to .gitignore
```

### Beep suppression is unverified across OEMs

`AudioCueModule` mutes `STREAM_MUSIC`, `STREAM_SYSTEM` and `STREAM_NOTIFICATION`, which covers a stock Android recogniser. Which stream carries the tone is not contractual, and OEM skins differ. `suppressSystemTones` resolves with the streams it actually muted so the answer can be read from logcat on a real device rather than guessed. If a device turns out to need the ring group, that needs Do-Not-Disturb access, and the deliberate decision (§7) is not to ask for it.

Two things follow: the feature has not been confirmed on the Oppo A059, and "no beeps on my phone" is not evidence it works on another.

### Live extraction re-runs the whole pipeline

`runLiveExtraction` extracts against the entire transcript on every debounce tick rather than incrementally. Extraction is pure and fast at consultation length, so this is the right trade today — incremental extraction would need per-utterance offsets and conflict resolution across ticks, which is real complexity for no current benefit. It is worth revisiting if sessions ever run to many minutes of continuous speech.

### Session recovery is only offered on the recording screen

An interrupted session is found when the doctor next enters Recording. A crash-killed session is invisible from the Dashboard, so a doctor who reopens the app and browses reports has no indication that unfinished dictation exists. A dashboard banner reading the same `getActiveSession()` would close it.

### Release APKs are ignored, but only going forward

The shared release APK is written to `dist/`, which `.gitignore` now covers. That only stops *new* accidents: `.gitignore` does not untrack anything already committed, so if an APK ever landed in the index it still needs `git rm --cached dist/<file>.apk` — the same caveat as the `.cxx` artifacts above.

### iOS is entirely unverified

`ios/` exists, but there is no `Pods/` and no `Podfile.lock` — it has never been built. The `NSMicrophoneUsageDescription` / `NSSpeechRecognitionUsageDescription` keys and the `Podfile` `setup_permissions([...])` block were written blind on a Windows machine. Treat iOS as untested. SRS NFR-5 targets Android.

### Device-specific behaviour

- **ColorOS / OnePlus / Oppo** devices are aggressive about background execution and permission revocation. If recording dies when the screen dims, suspect the OEM battery manager before the code.
- **Grant "While using the app", not "Only this time".** A `ONE_TIME` grant (visible as `flags=[...|ONE_TIME]` in `adb shell dumpsys package com.medscribe`) is silently revoked when the app is backgrounded, causing the permission prompt to reappear repeatedly.
- **USB connections to this Oppo device drop intermittently.** `adb kill-server && adb start-server` recovers it.

### Future enhancements (SRS §8)

**Delivered in Phase 4:** PDF export, patient history, report editing before save.

**Still open:** AI-assisted entity extraction, ICD-10 coding, EHR integration, multi-language recognition, cloud sync, offline recognition. Multiple doctors, authentication and encryption at rest sit alongside these — see the persistence limitation above for what each would touch.
