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
… → Structured report → Review & edit → Save → Dashboard → Reopen / Export PDF
```

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

The hardening round is five commits: `c02369d` (extraction pipeline correctness), `b0c9b6f` (permission rejection + native error surfacing), `9d4ddff` (transcript preserved on error, reset on new dictation), `3095391` (phone numbers + trailing unmarked values), `c59877d` (recording restarts after leaving the screen).

Phase 4 turns the one-shot pipeline into a documentation system. The generated report is now an editable **draft**: the doctor corrects any field, saves it to a local SQLite database along with the original transcript, and finds it on a **Doctor Dashboard** that opens on launch. Saved reports reopen for further editing and export to PDF. Single doctor, no authentication — but the layering (§5) is where multi-doctor, auth, cloud sync and EHR export will attach.

**Verification was performed on a physical device**, not an emulator: an Oppo A059, Android 16 (SDK 36), `arm64-v8a`. Confirmed working there — permission flow, live partial results streaming word-by-word, final results accumulating into a multi-chunk transcript.

Re-verified on the same device on **2026-07-31**, including the cycle that `c59877d` fixes: enter the Recording screen → press back without dictating → tap the mic again. That path previously dead-ended on a permanent "Speech recognition unavailable" and now starts a normal session. See [§7](#️-unmount-calls-stop-never-destroy) for why.

This matters: **dictation cannot be tested on the Android emulator at all.** See [§9](#9-known-limitations--future-considerations). Any future agent that tries to validate speech features on an emulator will waste hours reaching a dead end that has already been investigated and ruled out.

Extraction is measured against fixtures rather than the device, since it is pure and deterministic:

- **245 / 245** assertions in `scripts/test-extraction.mjs`
- **165 / 165** fields captured across 15 realistic dictation samples covering template order, scrambled order, conversational and casual speech, clinical shorthand, self-correction, filler words and romanised Hindi
- **44 / 44** fields across the four realistic samples re-run after `3095391`, plus direct post-processor checks (adjacent numbers, spaced digits, `+91` prefix, self-correction)

Those are **clean-text** numbers. Real dictation adds transcription loss on top — see the dropped-words limitation in §9.

The Phase 4 draft and document logic is pure and gets the same treatment:

- **60 / 60** assertions in `scripts/test-report.mjs` — `toDraft` / `applyEdit` / `isDirty` and the PDF payload, covering list fields, empty fields and the edited-flag transitions

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
| **FR-5** | Information extraction (11 patient fields) | Done |
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

**FR-1 now means the Dashboard**, not the old landing screen. `HomeScreen.jsx` was deleted; `AnimatedMicButton` and `SectionTitle` are still in use by `DashboardScreen`.

---

## 4. Pending Work

Phases 1–4 are delivered. What follows is the remaining work, in priority order.

### Settled decisions — do not re-open

Two questions were live during Phase 3 planning and are now **closed**:

- **Extraction approach: rule-based.** SRS §8 lists "AI-assisted medical entity extraction" under *Future Enhancements*, so this phase parses deterministically. `axios` and `zod` remain installed and unused; they are **not** a pending API integration.
- **Accuracy vs parser ordering.** Resolved structurally rather than by choosing: the extractor has no React Native imports and is tested against fixtures under plain Node, so parser correctness is decoupled from transcription quality entirely.

### 1. Recognizer restart gaps — highest priority

The microphone is deaf for roughly 0.5–1.5 s after each utterance while the recognizer restarts, so words are dropped from real dictation. **This is the single largest gap between fixture results and device results**, and no extraction change can close it — a field whose marker was never transcribed is unrecoverable.

Fix requires `patch-package` on `VoiceToTextModule.kt` plus a native rebuild (~3 min):
- `EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS` and siblings, so the recognizer stops ending utterances so eagerly
- Bundle the `EXTRA_LANGUAGE` fix in the same patch (see §9)

### 2. Promote the 15 samples to permanent fixtures

The realistic dictation samples are currently run ad-hoc, not committed as assertions. Until they are in `scripts/test-extraction.mjs`, a regression in any of those styles goes undetected.

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

### Extraction pipeline (FR-5)

Six stage modules under `src/services/extraction/`, plus `extractionService.js` as a thin orchestrator:

```text
Transcript
   ↓  normalizeTranscript    fillers stripped, whitespace collapsed, + index map
   ↓  detectMarkers          every field introducer, with positions
   ↓  segmentTranscript      value = marker end → next marker start
   ↓  postProcessors         age→number, phone→digits, symptoms→list
   ↓  validators             reject implausible values
   ↓  resolveConflicts       repeats, priority, confidence
Structured record
```

**Segmentation is the load-bearing idea.** A value ends wherever the *next* marker begins — whatever field that marker belongs to. No field needs to know what may follow it, so **arbitrary dictation order works by construction**, not by enumerating orderings. An earlier design encoded "which keywords may follow this field" in each terminator and collapsed the moment a doctor led with the diagnosis.

Candidate extraction (between segmentation and post-processing) is the **designated seam**: swap it for an NLP or local model to support free-form dictation, leaving every other stage intact.

**Results carry metadata, not bare strings:**

```js
{ value: 'Viral infection', confidence: 0.95, source: 'diagnosed with',
  start: 244, end: 281 }   // offsets into the ORIGINAL transcript
```

`confidence` is **marker specificity, not probability** — nothing is calibrated. Bands are documented in `fieldMarkers.js`. Values below `LOW_CONFIDENCE_THRESHOLD` render an `UNCERTAIN` badge, so a hedged "probably dengue" never reads as confidently as an explicit diagnosis.

Offsets are translated through the normalizer's index map. Filler-stripping shifts every position, and offsets taken from the normalized string would look valid while pointing at the wrong characters.

**Conflict policy:** confidence first, then position. Equal confidence means a later value wins, which is what makes self-correction work — *"age 32… sorry, 22"*. Putting position first let a weak late marker override an explicit early one.

**Precision over recall throughout.** No marker and no fallback means the field stays `null`. A wrong value in a patient record is worse than a blank one.

---

## 6. Project Structure

```
MedScribe/
├── App.jsx                          # Root: SafeAreaProvider + NavigationContainer + dark theme
├── index.js                         # AppRegistry entry
├── src/
│   ├── components/
│   │   ├── AnimatedMicButton.jsx    # Hero mic, Reanimated breathing + ripple
│   │   ├── AppHeader.jsx            # Brand header, optional back button
│   │   ├── ListeningVisualizer.jsx  # Aura + spectrum driven by real mic RMS
│   │   ├── PermissionGate.jsx       # denied / blocked / unavailable states (NFR-4)
│   │   ├── RecordingControls.jsx    # State-aware button row
│   │   ├── ReportField.jsx          # One report row — editable when given onChange
│   │   ├── ScreenContainer.jsx      # Safe-area wrapper, status bar
│   │   ├── SectionTitle.jsx         # Title + subtitle block
│   │   └── TranscriptView.jsx       # Live transcript, final + italic interim (FR-4)
│   ├── constants/
│   │   ├── recordingStates.js       # State machine, error maps, timings
│   │   ├── patientFields.js         # The 11 SRS fields, order, "Not Available"
│   │   └── fieldMarkers.js          # MARKER VOCABULARY — the extension point
│   ├── db/
│   │   ├── database.js              # Connection + user_version migrations (SQL lives here)
│   │   └── reportsRepository.js     # CRUD; the ONLY other file that writes SQL
│   ├── hooks/
│   │   └── useSpeechRecognition.js  # Session orchestrator — the heart of Phase 2
│   ├── navigation/
│   │   └── RootNavigator.jsx        # Native stack: Dashboard → Recording → Report
│   ├── screens/
│   │   ├── DashboardScreen.jsx      # FR-1 launch screen: saved reports + New Dictation
│   │   ├── RecordingScreen.jsx      # FR-2/3/4 state machine
│   │   └── ReportScreen.jsx         # Editable draft, Save, Finalize, Download PDF
│   ├── services/
│   │   ├── permissionService.js     # Mic permission, result → state mapping
│   │   ├── speechService.js         # Vendor isolation layer + amplitudeShared
│   │   ├── extractionService.js     # FR-5 orchestrator (public API)
│   │   ├── reportDraft.js           # Pure: extraction → editable draft, merge, diff
│   │   ├── reportDocument.js        # Pure: draft → PDF payload
│   │   ├── pdfService.js            # Native-exporter isolation layer
│   │   └── extraction/              # One module per pipeline stage
│   │       ├── normalizeTranscript.js   #   fillers + index map
│   │       ├── detectMarkers.js         #   find introducers
│   │       ├── segmentTranscript.js     #   slice between markers
│   │       ├── postProcessors.js        #   age/phone/symptom shaping
│   │       ├── validators.js            #   reject implausible values
│   │       └── resolveConflicts.js      #   repeats, self-correction
│   ├── specs/
│   │   └── NativePdfExporter.js     # TurboModule spec — codegen input, lint-ignored (§7)
│   ├── store/
│   │   ├── useRecordingStore.js     # Zustand: status, chunks, partial, error, amplitude
│   │   └── useReportsStore.js       # Zustand: saved reports, load/save/finalize/remove
│   ├── utils/
│   │   └── datetime.js              # Display timestamps + PDF filename stamps
│   └── theme/
│       ├── colors.js  spacing.js  typography.js  index.js
├── scripts/
│   ├── test-extraction.mjs          # 245 assertions, `npm run test:extraction`
│   └── test-report.mjs              # 60 assertions,  `npm run test:report`
├── android/                         # compileSdk/targetSdk 36, minSdk 24, New Arch + Hermes
│   └── app/src/main/
│       ├── java/com/medscribe/pdf/  # PdfExporterModule.kt + PdfExporterPackage.kt
│       └── res/xml/file_paths.xml   # FileProvider paths for the share sheet
├── ios/                             # Present but never built — see §9
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

### Migrations run from the store, not from `App.jsx`

`ensureSchema()` fires on the first `useReportsStore` call that needs the database, not at app boot. That keeps a database failure attached to the operation that can actually surface it: `loadAll` catches it into `error`, and the dashboard renders a real message.

Running migrations in `App.jsx` instead would either crash the app before the navigator mounts, or — worse — fail silently and leave the dashboard showing its empty state, which reads as *"you have no reports"* when the truth is *"the database did not open"*. In a records application those are not interchangeable.

### The native PDF module knows nothing about patient fields

`PdfExporterModule.kt` draws whatever labelled blocks the JSON payload contains, in order, and paginates them. It has no knowledge of `PATIENT_FIELDS`, symptoms, or diagnoses.

That is why **adding a report field is a JavaScript change in `reportDocument.js` only** — no Kotlin edit, no codegen, no native rebuild. It is also why the spec passes a JSON *string* rather than a structured object: the payload shape churns as fields are added, and a string keeps that churn out of the native ABI.

The exporter writes to `getExternalFilesDir(DIRECTORY_DOCUMENTS)/MedScribe/`. App-scoped storage means **no runtime storage permission on any API level**, while still being shareable through `FileProvider` and reachable with `adb pull`.

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

**PDF generation has no dependency.** It is an in-app Kotlin TurboModule over the platform's own `android.graphics.pdf.PdfDocument` (`android/app/src/main/java/com/medscribe/pdf/`). No maintained React Native PDF *generator* currently supports the New Architecture, and an abandoned dependency sitting in the export path of a medical record is a liability. `androidx.core`'s `FileProvider`, already on the classpath, handles sharing.

### Installed but **not imported anywhere**

Listed honestly so nobody assumes they are load-bearing:

`axios`, `zod`, `react-hook-form`, `react-native-gesture-handler`, `react-native-vector-icons`, `@react-native-vector-icons/material-design-icons`, `@react-native/new-app-screen`.

`axios` and `zod` are **not** a pending API integration. Extraction is rule-based by design (SRS §8 puts AI-assisted extraction under Future Enhancements), and the pipeline deliberately has no network dependency. Note also that all icons are hand-built from `View` primitives despite two icon packages being installed.

---

## 9. Known Limitations & Future Considerations

### Dropped words during recognizer restarts — the largest gap

Android's `SpeechRecognizer` is single-utterance, so the hook restarts it after each pause. **The microphone is deaf for roughly 0.5–1.5 s during each restart**: `onEndOfSpeech` → backoff → `startListening()` → engine init → `onReadyForSpeech`. Speech in that window is lost.

Google's own voice typing holds one continuous streaming session, which is why it feels seamless; this library's API cannot do that.

This is why **device results trail fixture results**. Extraction scores 165/165 on clean text, but a field whose introducer phrase was never transcribed is unrecoverable — no amount of marker vocabulary helps. Mitigation is documented in §4.

### Extraction cannot infer meaning without a marker

Deterministic matching handles explicit and hedged phrasing, but not genuine inference. *"She's been a bit off colour"* will not map to symptoms; *"probably dengue"* works only because `probably` is a registered diagnosis marker.

Sparse dictation with almost no markers — *"Hema Sharma twenty-two female Sector Twelve…"* — is the concrete argument for replacing the candidate-extraction stage with an NLP model, not for adding more regexes. Pushing further with patterns means guessing, which violates the precision-over-recall rule.

### The 15 realistic samples are not yet permanent fixtures

They were run ad-hoc during development and score 165/165, but only the earlier 245 assertions are committed in `scripts/test-extraction.mjs`. Until the samples are added there, a regression in one of those dictation styles will not be caught.

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

There is currently **no automated test coverage**. The single smoke test in `__tests__/` has never been executed.

### Build artifacts are tracked in git

**645 files under `android/app/.cxx/`** are tracked. A `.gitignore` exists but does not untrack files already committed. This bloats the repository and produces large spurious diffs on every build.

Suggested cleanup (**not performed** — it rewrites the index and deserves a deliberate commit):

```bash
git rm -r --cached android/app/.cxx
# then add android/app/.cxx/ to .gitignore
```

### iOS is entirely unverified

`ios/` exists, but there is no `Pods/` and no `Podfile.lock` — it has never been built. The `NSMicrophoneUsageDescription` / `NSSpeechRecognitionUsageDescription` keys and the `Podfile` `setup_permissions([...])` block were written blind on a Windows machine. Treat iOS as untested. SRS NFR-5 targets Android.

### Device-specific behaviour

- **ColorOS / OnePlus / Oppo** devices are aggressive about background execution and permission revocation. If recording dies when the screen dims, suspect the OEM battery manager before the code.
- **Grant "While using the app", not "Only this time".** A `ONE_TIME` grant (visible as `flags=[...|ONE_TIME]` in `adb shell dumpsys package com.medscribe`) is silently revoked when the app is backgrounded, causing the permission prompt to reappear repeatedly.
- **USB connections to this Oppo device drop intermittently.** `adb kill-server && adb start-server` recovers it.

### Future enhancements (SRS §8)

**Delivered in Phase 4:** PDF export, patient history, report editing before save.

**Still open:** AI-assisted entity extraction, ICD-10 coding, EHR integration, multi-language recognition, cloud sync, offline recognition. Multiple doctors, authentication and encryption at rest sit alongside these — see the persistence limitation above for what each would touch.
