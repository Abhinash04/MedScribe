# MedScribe — Project Handoff

> **Purpose of this document.** It captures the state of MedScribe after Phases 1 and 2, including the reasoning behind decisions that are not obvious from reading the code. Several parts of this codebase look like mistakes and are not — those are called out explicitly in [Implementation Notes](#7-implementation-notes--conventions). Read that section before changing anything in the speech pipeline.

**Last updated:** 2026-07-29
**Branch:** `main`

---

## Table of Contents

1. [Project Overview & Objectives](#1-project-overview--objectives)
2. [Current Status](#2-current-status)
3. [Features Completed](#3-features-completed)
4. [Pending Work & Phase 3](#4-pending-work--phase-3)
5. [Technical Architecture & Design Decisions](#5-technical-architecture--design-decisions)
6. [Project Structure](#6-project-structure)
7. [Implementation Notes & Conventions](#7-implementation-notes--conventions)
8. [Dependencies](#8-dependencies)
9. [Known Limitations & Future Considerations](#9-known-limitations--future-considerations)

---

## 1. Project Overview & Objectives

MedScribe is a React Native (Android) application that lets doctors create structured patient records by dictating instead of typing.

The intended pipeline, per the SRS:

```
Dictate  →  Transcribe  →  Extract patient fields  →  Structured report
 (FR-2)      (FR-3/4)          (FR-5)                  (FR-6/7/8)
```

**Scope boundary:** the application is a *documentation aid only*. It performs no diagnosis and makes no medical decisions (SRS §1.2). Nothing in Phase 3 should change that.

Full requirements live in [`MedSrcibe_SRS.md`](./MedSrcibe_SRS.md). The two Antigravity documents in this folder describe the *original Phase 1 plan* and are historical — they do not reflect the current codebase.

---

## 2. Current Status

| Phase | Scope | State |
| :-- | :-- | :-- |
| **Phase 1** | Design system, components, navigation | Complete |
| **Phase 2** | Permissions, speech-to-text, live transcript | Complete, verified on hardware |
| **Phase 3** | Field extraction + structured report | **Not started** |

**Verification was performed on a physical device**, not an emulator: an Oppo A059, Android 16 (SDK 36), `arm64-v8a`. Confirmed working there — permission flow, live partial results streaming word-by-word, final results accumulating into a multi-chunk transcript.

This matters: **dictation cannot be tested on the Android emulator at all.** See [§9](#9-known-limitations--future-considerations). Any future agent that tries to validate speech features on an emulator will waste hours reaching a dead end that has already been investigated and ruled out.

---

## 3. Features Completed

Mapped to SRS requirement IDs so this table stays anchored to the specification.

| Requirement | Description | Status |
| :-- | :-- | :-- |
| **FR-1** | Application launch, Home screen | Done |
| **FR-2** | Voice recording + runtime permission flow | Done |
| **FR-3** | Speech recognition via `@appcitor/react-native-voice-to-text` | Done |
| **FR-4** | Transcript display, including live interim text | Done |
| **NFR-4** | Graceful handling of denial, blocking, engine failure | Done |
| **FR-5** | Information extraction (11 patient fields) | Not started |
| **FR-6** | Structured report generation | Not started |
| **FR-7** | Missing-field handling | Not started |
| **FR-8** | Report preview | Not started |

Permission handling covers all four outcomes: **granted**, **denied** (re-requestable), **blocked** (needs system settings, with a working `openSettings()` button), and **unavailable** (no engine on device).

Recording states implemented: `idle`, `checkingPermission`, `permissionDenied`, `permissionBlocked`, `unavailable`, `listening`, `processing`, `success`, `error`.

---

## 4. Pending Work & Phase 3

Phase 3 delivers **FR-5 → FR-8**: parse the transcript into the 11 patient fields (Patient Name, Age, Gender, Address, PIN Code, Contact Number, Symptoms, Medical History, Diagnosis, Prescription Notes, Additional Remarks), render a structured report, mark absent fields, and display a preview.

### Two decisions are open and deliberately unresolved

Both were raised with the project owner and **not** decided. Do not assume an answer.

**1. Extraction approach.**
- *Rule-based* (regex / keyword parsing). SRS §8 lists "AI-assisted medical entity extraction" under **Future Enhancements**, which reads as an argument that Phase 3 should be rule-based.
- *API-backed*. However, `axios` and `zod` are installed and completely unused, which may indicate a different intent.

These produce very different codebases. Confirm before building.

**2. Should transcription accuracy be fixed first?**
The `en-IN` locale problem in [§9](#9-known-limitations--future-considerations) means the transcript currently contains Hinglish rather than the dictated English. A field parser cannot extract patient data from a transcript that renders "Rahul Sharma" as "Hema Sharma film Hindi mein district" — no parser quality compensates for that. Either fix accuracy first, or develop the parser against known-clean fixture text and defer live testing.

### Integration seam already in place

Phase 3 does **not** need to touch the speech pipeline. The finished transcript is already available:

```js
import useRecordingStore, { selectFullTranscript } from '../store/useRecordingStore';

const transcript = useRecordingStore(selectFullTranscript);
```

`RecordingControls` already renders a **"Continue to report"** button, intentionally disabled with a "coming in the next phase" note. Wiring that button and adding a report screen to `RootNavigator` is the natural entry point.

---

## 5. Technical Architecture & Design Decisions

### Layering

```
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
│   │   ├── ScreenContainer.jsx      # Safe-area wrapper, status bar
│   │   ├── SectionTitle.jsx         # Title + subtitle block
│   │   └── TranscriptView.jsx       # Live transcript, final + italic interim (FR-4)
│   ├── constants/
│   │   └── recordingStates.js       # State machine, error maps, timings
│   ├── hooks/
│   │   └── useSpeechRecognition.js  # Session orchestrator — the heart of Phase 2
│   ├── navigation/
│   │   └── RootNavigator.jsx        # Native stack: Home → Recording
│   ├── screens/
│   │   ├── HomeScreen.jsx           # FR-1 landing
│   │   └── RecordingScreen.jsx      # FR-2/3/4 state machine
│   ├── services/
│   │   ├── permissionService.js     # Mic permission, result → state mapping
│   │   └── speechService.js         # Vendor isolation layer
│   ├── store/
│   │   └── useRecordingStore.js     # Zustand: status, chunks, partial, error, amplitude
│   └── theme/
│       ├── colors.js  spacing.js  typography.js  index.js
├── android/                         # compileSdk/targetSdk 36, minSdk 24, New Arch + Hermes
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

### ⚠️ `BackHandler` in `RecordingScreen` is required
Without it, hardware/gesture back during an active recording falls through to the default activity-finish path, tearing down the React root while the Activity survives. The result is a **blank white screen**, with `Dropping event due to root view being removed` in logcat. The handler routes hardware back through the same `stop()` → `goBack()` path as the header arrow and returns `true` to consume the event.

The in-app header back arrow was never affected — only hardware/gesture back.

### ⚠️ No `isRecognitionAvailable()` pre-check
An earlier implementation gated `beginSession` on `isAvailable()`. Any transient rejection landed in the catch and stranded the user on a permanent "Speech recognition unavailable" dead end, despite a working recognizer being installed. It was removed: `startListening()` already rejects with `NOT_AVAILABLE` when the engine is genuinely missing, and `safeStart` maps that to the same state — correct reporting, without false positives.

### `onSpeechVolumeChanged` must stay registered
The native module gates volume emission on its internal listener count. If nothing subscribes to that event, no RMS values are emitted and the visualizer goes flat. `speechService` registers it unconditionally.

### Permission result fallback
`toRecordingState()` maps only an explicit `RESULTS.UNAVAILABLE` to the dead-end "unavailable" screen. Anything unrecognized falls back to `permissionDenied`, which is recoverable — a silently revoked one-time grant, or an OEM-specific result string, must leave a working "Grant access" button rather than claiming the device cannot do speech recognition.

### Build & tooling gotchas
- **Manifest changes require a full native rebuild.** Metro fast-refresh will not pick them up. If permission dialogs silently stop appearing after a manifest edit, this is why.
- **`adb reverse tcp:8081 tcp:8081`** is mandatory for USB devices when installing outside `run-android` (e.g. via `adb install` or a direct Gradle task). Without it: `Unable to load script`.
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
| `zustand` | ^5.0.14 | Recording session state; the Phase 3 integration seam. |
| `react-native-reanimated` | ^4.5.3 | Mic button and visualizer animations. |
| `react-native-worklets` | ^0.11.3 | Reanimated 4 dependency; provides the Babel plugin. |
| `@react-navigation/native` | ^7.3.14 | Navigation. |
| `@react-navigation/native-stack` | ^7.18.6 | Native stack navigator. |
| `react-native-screens` | ^4.26.2 | Native screen primitives. |
| `react-native-safe-area-context` | ^5.8.0 | Safe-area insets. |

### Installed but **not imported anywhere**

Listed honestly so nobody assumes they are load-bearing:

`axios`, `zod`, `react-hook-form`, `react-native-gesture-handler`, `react-native-vector-icons`, `@react-native-vector-icons/material-design-icons`, `@react-native/new-app-screen`.

`axios` and `zod` may signal an intended API-backed extraction approach for Phase 3 — see [§4](#4-pending-work--phase-3). Note that all icons in the app are currently hand-built from `View` primitives despite two icon packages being installed.

---

## 9. Known Limitations & Future Considerations

### Recognition accuracy — the most significant open issue (SRS NFR-2)

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

AI-assisted entity extraction, ICD-10 coding, PDF export, EHR integration, multi-language recognition, cloud sync, patient history, offline recognition, report editing before save.
