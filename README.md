# MedScribe

**Voice-powered medical documentation for Android.**

MedScribe lets doctors create patient records by dictating instead of typing. It captures speech through the device microphone, converts it to text using the Android system speech recognizer, hands the transcript back for review and correction, extracts the patient details, and renders a structured clinical report — which the doctor then reviews, corrects, saves to a local database, and exports as a PDF.

> MedScribe is a **documentation aid only**. It performs no diagnosis and makes no medical decisions.

---

## Table of Contents

- [Features](#features)
- [How a Consultation Flows](#how-a-consultation-flows)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Android Development Setup](#android-development-setup)
- [Project Structure](#project-structure)
- [Third-Party Packages](#third-party-packages)
- [Available Scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Documentation](#documentation)

---

## Features

### Available now

- **Light, clinical UI** — a design-token system built for consultation-room readability under bright light, documented in [`DESIGN.md`](DESIGN.md).
- **Animated microphone** — Reanimated idle breathing and press feedback.
- **Full runtime permission flow** — handles granted, denied, permanently blocked (with a working "Open Settings" action), and no-engine-available.
- **Continuous dictation** — Android's speech recognizer stops at the first pause, so MedScribe automatically restarts it and accumulates the results. The doctor can pause naturally between sentences; only an explicit **Pause** or **Stop** ends the listening.
- **Pause and resume** — pause mid-consultation to examine the patient, then resume. The transcript, the extracted fields and the elapsed time are all preserved; resuming appends to what was already dictated rather than starting over.
- **Session status and timer** — a live pill (Listening / Paused / Processing / Stopped) and an MM:SS duration that excludes paused time.
- **One audio cue, not a beep per sentence** — the Android recognizer plays its own tone every time it restarts, which is once per sentence during continuous dictation. MedScribe plays a single cue when a session starts or resumes, then attempts to suppress those system tones for the rest of the session. Suppression works by muting the streams that carry the tone, and which stream that is depends on the device — see the troubleshooting entry if you still hear beeps.
- **Live field preview** — patient name, age, gender, symptoms and diagnosis appear as they are recognised, so a missed field is visible while the patient is still in the room.
- **Live transcript** — confirmed text renders solid, the recognizer's interim guess trails it in muted italics.
- **Real-time audio visualizer** — driven by actual microphone RMS levels, not a canned animation.
- **Graceful error handling** — transient recognizer errors are retried silently; genuine failures surface in plain language.
- **Patient-field extraction** — pulls the eleven clinical fields out of the transcript deterministically, with no AI and no network. Works regardless of the order the doctor dictates in, and handles conversational phrasing, clinical shorthand (`c/o`, `h/o`, `Rx`), filler words, self-correction ("age 32… sorry, 22") and romanised Hindi.
- **Natural clinical speech** — the doctor never has to say a field label. Synonyms ("suggestive of", "known case of", "presents with"), gender inferred from a pronoun when it is the only evidence, and a chronic condition routed to medical history while today's complaint stays in symptoms.
- **Negation and retraction** — "no chest pain" never becomes a symptom; it is recorded as a stated denial instead. "Correction, no history of diabetes" cancels the condition dictated a moment earlier, and "do not start Paracetamol" cancels the prescription.
- **Prescription as a list** — one editable entry per drug, with strength, frequency, duration and timing preserved exactly as dictated.
- **Nothing dictated is discarded** — extraction matches a fixed phrasebook, so speech phrased another way used to vanish without trace. A sentence that reaches no field is now kept verbatim in a **Not captured in any field** card below the report, tagged with the field it looks like. The doctor keeps what belongs in the record and leaves the rest out; only kept notes are printed. Backed by a machine-checked invariant: **no word the report prints is absent from the dictation.**
- **Unmarked speech still reaches its field** — "Examination suggests viral fever" uses no recognised marker, and used to print *Not Available* for something plainly said. Sentences are now scored against every field using clinical vocabulary the app already knows — drug names and doses, symptom terms, chronicity, condition nouns, advice verbs — and a decisive one fills its field, flagged **AUTO** so a value placed by inference is never mistaken for one the doctor stated. Anything short of decisive stays a note: a missing value is visible, a confident wrong one is not. Measured across 40 natural phrasings, coverage went from **27/40 to 40/40**.
- **A value has to suit its field** — the phrase that opens a field no longer settles what goes into it. Measured before this existed: *"Clinically this is viral fever"* put **`Viral Fever` in the patient's name**, conditions landed in the prescription, a dosed drug landed in the remarks, and the fragment "Also been" became a symptom. Each is now rejected or rerouted on the evidence in the value itself, and the patient name refuses clinical vocabulary outright.
- **Structured report** — a preview with an N-of-10 required-field summary. Fields the doctor never mentioned show **Not Available** rather than being hidden, values inferred from a hedged phrase are flagged **UNCERTAIN**, and values placed by classification are flagged **AUTO**. Editing a field clears both — the value is the doctor's from that point on.
- **Completeness gate** — ten of the eleven fields are mandatory and are checked against their own validators before a report is produced; a six-character PIN and a ten-digit contact number are not merely non-empty text. A blocked report names exactly what is still needed and offers **Add More Speech** or **Review Fields**. Additional Remarks is optional and never blocks anything. Medical History and Prescription Notes accept an explicitly dictated absence — "no significant medical history", "no medication prescribed" — which the app never fills in on the doctor's behalf.
- **Transcript review step** — dictation lands on a review screen before any report is generated. Two tabs, **Original** and **AI Transcription**, each with a full editor; a **What AI changed** panel below them; then resume dictating or generate the report.
- **Automatic consultation saving** — the transcript, the report draft and the doctor's manual field edits are written to the database as they change, debounced so a partial speech result never causes a write, and flushed immediately when the app goes to the background. The consultation also records which screen it reached, so after a force-stop, an OS kill or a flat battery the Dashboard offers to resume it at the recording, transcript-review or report stage. The row is cleared only once the report is actually saved or the doctor discards it — not when Generate Report is pressed. Best-effort by design: a failed write is logged and swallowed rather than interrupting the consultation.
- **Transcript inspection** — the report can reveal the original dictation, which is the fastest way to tell a transcription gap from an extraction gap.
- **One dictation, two transcripts** — On the tested Oppo A059 / Android 16 configuration, opening `AudioRecord` caused the system recognizer to return `NO_MATCH` on every utterance across all four audio sources; partials did not finalize until the audio pipe closed, requiring a segmented session architecture. The shared-microphone module inverts that by owning the single `AudioRecord` and feeding the recognizer via `EXTRA_AUDIO_SOURCE`, enabling simultaneous live text and WAV capture for second transcription. Measured on the target device: **88% word recall against a 75% recognizer-only baseline**, with partials from three seconds.
- **Second transcription (Anuvadini)** — the recorded audio is transcribed again by the Anuvadini service, and the doctor picks which transcript the report is built from. A failure is non-blocking: the native transcript still completes the consultation, with a **Retry** offered. See [Environment Setup](#3-anuvadini-credential) for the credential, including what build-time injection does and does not protect.
- **Editable AI transcript** — the AI text is a draft the doctor corrects like any other. The service's own response is kept separately, so **What AI changed** always compares raw against raw and a manual correction can never appear as something the AI did.
- **Add More Speech continues either transcript** — a continuation appends to both: `raw = raw₁ + raw₂` keeps the comparison honest, while `text = edited₁ + raw₂` keeps the doctor's corrections. A failed continuation leaves the existing transcript untouched, and a retry cannot append the same speech twice.
- **Viewing is not selecting** — the tabs change what is on screen; only **Use AI Transcription** / **Use Original Transcription** changes which transcript the report is built from, and only that re-runs extraction. The screen states which one is in use.
- **Diagnostic dump** — in a development build, long-press the Patient Report title to share a six-stage trace: raw utterances, the text extraction received, the candidates it found, the eleven-field result with the phrase each value came from, the draft, and what the form rendered. It carries the whole consultation, so it is **development-only and asks for confirmation** before sharing; release builds have no such handler.
- **Editable report fields** — the generated report is a draft, not a verdict. Every field is an input: tap it and type. Symptoms are a list with add and remove. Fields the doctor changed are flagged **EDITED**, and empty fields can be filled in from scratch.
- **Save Report** — persists the original dictation, the extraction, the doctor's edits, the status and the timestamps together.
- **Doctor Dashboard** — the launch screen. A start-recording card and a round microphone button open a new consultation; overview tiles count total, today, draft and finalized reports; saved reports list newest-first with initials, relative timestamp, diagnosis and a Draft/Final pill. Quick actions search by patient or diagnosis and filter to pending drafts. Tap a report to reopen it for editing; long-press to delete.
- **Local database** — SQLite, so reports survive closing the app, force-stopping it, and rebooting the phone.
- **Finalize** — marks a report `Final` once the doctor is satisfied. Finalized reports still open and still save; the pill records intent rather than locking the record.
- **PDF export** — renders any report as an A4 document (patient details, medical history, symptoms, diagnosis, prescription, remarks, generation timestamp) and hands it to the system share sheet for printing, mailing or filing.

### Planned

Continuous recognition without restart gaps on vendor fallback, and improved accuracy on `en-IN` devices. See [Roadmap](#roadmap).

---

## How a Consultation Flows

```text
                        ┌─→ Native recognizer ──→ live transcript ─┐
Dashboard → New Dictation                                          ├─→ Transcript Review
                        └─→ captured audio ──→ Anuvadini ──────────┘         │
                               ↑                                             ▼
                               │                              Original  vs  AI Transcription
                               │                                             │
                               │                                    doctor selects one
                               │                                             ▼
                               └───── Add More Speech ──────  Report → Edit → Save → Dashboard
                                                                                └──→ Download PDF
```

1. **Open the app.** The Dashboard lists every previously saved report.
2. **New Dictation** → dictate the consultation, pausing and resuming as needed → **Stop**, and confirm. Text appears as you speak; the same audio is recorded once and sent for a second transcription in the background.
3. **Review the transcript.** Two tabs: **Original** from the device recognizer, **AI Transcription** from Anuvadini, both editable, with **What AI changed** showing every substitution between them. Pick one with **Use AI Transcription** / **Use Original Transcription** — until you do, the report keeps using whichever is already selected. **Add More Speech** goes back for more and appends to *both* transcripts, keeping any corrections you have already typed.
4. **Generate Report.** The structured report is extracted from the reviewed transcript. If any of the ten mandatory fields is missing or invalid, generation is held back and the missing details are named — dictate them with **Add More Speech**, which appends to the same consultation and keeps everything already captured, or type them in with **Review Fields**.
5. **Review and correct** any field — the extraction is a starting point, not the record. Anything dictated that reached no field is listed verbatim below the report under **Not captured in any field**; keep what belongs in the record and leave the rest out. A value the app placed by inference rather than from a recognised phrase is flagged **AUTO**, so it is obvious which is which.
6. **Save Report.** It appears on the Dashboard immediately.
7. Optionally **Download PDF** to print, mail or file it.
8. **Tap any saved report** to reopen it with its original dictation and every edit intact, and keep working.

Correcting the transcript before extraction is deliberate: a misheard word fixed at step 3 is one edit, while the same word reaching the report can be wrong in several fields at once.

Single doctor, no login. Multi-doctor and authentication are Roadmap items, not omissions.

---

## Technology Stack

| Layer | Technology |
| :-- | :-- |
| Framework | React Native **0.86.0** (New Architecture — Fabric + TurboModules) |
| UI runtime | React **19.2.3** |
| JS engine | Hermes |
| Language | **JavaScript**, except `src/specs/**` — TypeScript, because codegen requires it |
| Navigation | React Navigation 7 (native stack) |
| State | Zustand 5 |
| Animation | Reanimated 4 + Worklets |
| Speech | Android `SpeechRecognizer`, driven by an in-app Kotlin TurboModule that owns the microphone and feeds it through a pipe (`EXTRA_AUDIO_SOURCE`); `@appcitor/react-native-voice-to-text` remains the fallback path |
| Second transcription | Anuvadini STT over HTTPS, called directly with a build-time Bearer token; `server/` holds a dependency-free Node proxy for local development and future production |
| Permissions | `react-native-permissions` 5 |
| Database | SQLite via `@op-engineering/op-sqlite` 17 (JSI) |
| PDF | In-app Kotlin TurboModule over `android.graphics.pdf.PdfDocument` — no third-party generator |
| Build | Gradle 9.3.1, Kotlin 2.1.20 |

**File-extension convention:** `.jsx` for files containing JSX, `.js` for everything else, and `.ts` only for the TurboModule specs in `src/specs/**`.

---

## Prerequisites

| Tool | Required | Verified working |
| :-- | :-- | :-- |
| **Node.js** | ≥ 22.12.0 (enforced by `engines`) | v24.18.0 |
| **npm** | Bundled with Node | — |
| **JDK** | 17 | OpenJDK 17.0.9 |
| **Android Studio** | Latest stable (for SDK + AVD tooling) | — |
| **Android SDK Platform** | API **36** | — |
| **Android SDK Build-Tools** | **36.0.0** | — |
| **Android NDK** | **27.1.12297006** | — |
| **Android CMake** | Installed via SDK Manager (native builds) | — |

> **A physical Android device is strongly recommended.** Speech recognition **does not work on the Android emulator** — see [Troubleshooting](#dictation-produces-no-text). The emulator is fine for UI work.

---

## Environment Setup

### 1. Install the Android SDK components

Android Studio → **Settings → Languages & Frameworks → Android SDK**:

- **SDK Platforms** tab → check *Android API 36*.
- **SDK Tools** tab → check *Show Package Details*, then select:
  - Android SDK Build-Tools **36.0.0**
  - NDK (Side by side) **27.1.12297006**
  - CMake
  - Android SDK Platform-Tools
  - Android Emulator (only if you intend to run one)

### 2. Set environment variables

**Windows (PowerShell, persistent):**
```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\OpenLogic\jdk-17', 'User')
```
Then add to **Path**:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

**macOS (`~/.zshrc`):**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

**Linux (`~/.bashrc` or `~/.zshrc`):**
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

Restart your terminal, then verify:
```bash
node --version      # ≥ v22.12.0
java -version       # 17.x
adb --version
```

### 3. Anuvadini credential

The second transcription calls the Anuvadini service directly and needs a Bearer token. It is injected at build time from **`android/local.properties`**, which is gitignored:

```properties
ANUVADINI_STT_TOKEN=your-token-here
```

Ask the backend team for the value. `android/app/build.gradle` reads it into `BuildConfig`, and a small `AppConfig` TurboModule hands it to JavaScript — so it is never a literal in a committed source file.

**A clone without it still builds and runs.** Everything except the second transcription works, and the review screen reports *"Not configured in this build"* rather than failing silently.

> **What this does and does not protect.** Build-time injection keeps the token out of Git. It does **not** make it secret inside a compiled APK, where it can be extracted. That trade is accepted deliberately for internal testing. The permanent fix is deploying `server/` — see [`server/README.md`](server/README.md) — after which the app talks to that proxy and the token leaves the device entirely, with no change to any feature code.

For local proxy development instead of the direct call, run `npm run proxy` and set `TRANSCRIPTION_TRANSPORT` to `'proxy'` in [`src/config/endpoints.js`](src/config/endpoints.js).

---

## Installation

Replace `<repository-url>` below with this repository's actual clone URL (copy it from your Git host's **Clone** button):

```bash
git clone <repository-url>
cd MedScribe
npm install
```

No CocoaPods step is needed — this project targets Android. (`ios/` exists but has never been built; see [`docs/handoff.md`](docs/handoff.md).)

---

## Running the App

### On a physical device (recommended)

**1. Enable USB debugging**

On the phone: **Settings → About phone → tap "Build number" seven times** to unlock Developer options, then **Settings → Developer options → USB debugging → On**.

**2. Connect over USB and authorize**

Accept the *"Allow USB debugging?"* prompt on the phone, then confirm the host sees it:

```bash
adb devices
```
```
List of devices attached
0015935AE000363    device
```

If it shows `unauthorized`, re-accept the prompt on the phone. If it shows nothing, see [Troubleshooting](#device-not-detected).

**3. Start Metro** (leave running in its own terminal)

```bash
npm start
```

**4. Build, install and launch** (second terminal)

```bash
npm run android
```

With more than one device or emulator attached, target one explicitly. Any of these work:

```bash
npm run android -- --device 0015935AE000363             # preferred: keeps --active-arch-only
npx react-native run-android --device 0015935AE000363   # works, but builds all four ABIs
npx react-native run-android --deviceId 0015935AE000363 # deprecated, still functional

# or pin the target for any Gradle/adb command in the shell session:
export ANDROID_SERIAL=0015935AE000363        # PowerShell: $env:ANDROID_SERIAL="..."
```

> **Go through `npm run android`.** Calling `npx react-native run-android` directly drops `--active-arch-only`, so it compiles all four ABIs — measured at **4m35s and a ~103 MB APK**, against roughly **3 min and ~45 MB** for the one architecture your device can actually run.
>
> **Speed tip.** `npm run android` **already** passes `--active-arch-only`, so it builds only your device's architecture — no action needed.
>
> The four-ABI cost applies to the plain Gradle path and to `npm run android:all-abis`. If you invoke Gradle directly, restrict it yourself:
> ```bash
> cd android && ./gradlew app:installDebug -PreactNativeArchitectures=arm64-v8a
> ```
> Most modern phones are `arm64-v8a`; confirm with `adb shell getprop ro.product.cpu.abi`.

**5. Grant the microphone permission**

Tap the microphone on the Home screen. When Android asks, choose **"While using the app"** — **not** "Only this time". A one-time grant is silently revoked whenever the app is backgrounded, so the prompt will keep reappearing.

### On an emulator (UI work only)

Create an AVD with **API 36**, a **Google Play** system image, and **at least 4096 MB RAM** (the default 1536 MB hangs during boot). Then:

```bash
npm start
npm run android
```

**Dictation will not work on an emulator.** Everything else will.

---

## Android Development Setup

Values below are declared in `android/build.gradle` and `android/gradle.properties`.

| Setting | Value |
| :-- | :-- |
| `compileSdkVersion` | 36 |
| `targetSdkVersion` | 36 |
| `minSdkVersion` | 24 (Android 7.0) |
| `buildToolsVersion` | 36.0.0 |
| `ndkVersion` | 27.1.12297006 |
| `kotlinVersion` | 2.1.20 |
| Gradle | 9.3.1 |
| `newArchEnabled` | `true` |
| `hermesEnabled` | `true` |
| Application ID | `com.medscribe` |

### Permissions declared

`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<queries>
  <intent>
    <action android:name="android.speech.RecognitionService" />
  </intent>
</queries>
```

The `<queries>` block is **required on API 30+** for the app to see the system speech recognizer at all.

`MODIFY_AUDIO_SETTINGS` is a normal permission, granted at install with no prompt. It lets the app mute the streams the system recognizer plays its start and end tones on, which is the only way to stop a beep between every dictated sentence. Muting the ring, notification and alarm group additionally requires Do-Not-Disturb access — **the app never requests it**, and simply skips any stream the system refuses.

> **Any change to `AndroidManifest.xml` requires a full native rebuild.** Metro fast-refresh will not pick it up.

---

## Project Structure

```
MedScribe/
├── App.jsx                          # Root: SafeAreaProvider + NavigationContainer
├── index.js                         # AppRegistry entry point
├── src/
│   ├── components/                  # Reusable UI
│   │   ├── AdditionalNotes.jsx      #   Dictation that reached no field — keep or leave out
│   │   ├── AnimatedMicButton.jsx    #   Hero microphone with Reanimated feedback
│   │   ├── AppHeader.jsx            #   Brand header + optional back button
│   │   ├── ListeningVisualizer.jsx  #   Aura + spectrum driven by real mic levels
│   │   ├── LiveFieldsPreview.jsx    #   Fields recognised so far, shown while dictating
│   │   ├── MicGlyph.jsx             #   Microphone icon drawn from Views (no icon font)
│   │   ├── PermissionGate.jsx       #   Denied / blocked / unavailable screens
│   │   ├── RecordingControls.jsx    #   State-aware action buttons
│   │   ├── ReportField.jsx          #   One report row — UNCERTAIN / AUTO / EDITED badges
│   │   ├── ScreenContainer.jsx      #   Safe-area + status-bar wrapper
│   │   ├── SectionTitle.jsx         #   Title + subtitle block
│   │   ├── SessionRecoveryModal.jsx #   Restore or discard an interrupted dictation
│   │   ├── StopConfirmationModal.jsx#   Confirm before ending a session
│   │   └── TranscriptView.jsx       #   Live transcript (final + interim)
│   ├── config/
│   │   ├── endpoints.js             # Transport selection, Anuvadini URL, proxy URL
│   │   └── features.js              # Capture enablement, transcription availability
│   ├── constants/
│   │   ├── recordingStates.js       # State machine, error maps, timings
│   │   ├── patientFields.js         # The 11 report fields, order, required flags
│   │   ├── fieldMarkers.js          # Marker vocabulary — add new phrasing here
│   │   └── clinicalCues.js          # Negation, chronicity, pronoun, medication cues
│   ├── dev/
│   │   ├── diagnostics.js           # Six-stage trace — development builds only
│   │   └── spikeReport.js           # Mic-contention matrix as shareable text
│   ├── db/
│   │   ├── database.js              # SQLite connection + migrations (reports, active_sessions)
│   │   └── reportsRepository.js     # Report CRUD SQL queries
│   ├── hooks/
│   │   └── useSpeechRecognition.js  # Session orchestrator: permission → record → transcript
│   ├── navigation/
│   │   └── RootNavigator.jsx        # Dashboard → Recording → TranscriptReview → Report
│   ├── screens/
│   │   ├── DashboardScreen.jsx      # Launch screen: overview, quick actions, saved reports
│   │   ├── RecordingScreen.jsx      # Status, timer, live fields, pause / resume / stop
│   │   ├── TranscriptReviewScreen.jsx  # Correct the transcript before extraction
│   │   └── ReportScreen.jsx         # Editable draft, Save, Finalize, Download PDF
│   ├── services/
│   │   ├── permissionService.js     # Microphone permission handling
│   │   ├── speechService.js         # Vendor speech engine isolation layer
│   │   ├── sharedMicService.js      # Shared-microphone module: live text + WAV, one owner
│   │   ├── appConfigService.js      # Build-time config (the Anuvadini token)
│   │   ├── dictationSessionManager.js  # Session orchestrator: timer, cues, autosave, live fields
│   │   ├── audioFeedbackService.js  # Audio cue + system-tone suppression isolation layer
│   │   ├── audioCaptureService.js   # Capture spike module isolation layer (debug only)
│   │   ├── consultationAudio.js     # Recording lifecycle: budget, read, delete, purge
│   │   ├── audioBudget.js           # WAV/Base64 sizing and the upload ceiling (pure)
│   │   ├── consultationTranscripts.js  # Native vs AI state, raw baselines, continuation (pure)
│   │   ├── transcriptRefinement.js  # Runs the second transcription; owns the continuation base
│   │   ├── transcriptDiff.js        # Word-level LCS diff for "What AI changed" (pure)
│   │   ├── sessionPersistenceService.js  # Debounced autosave and recovery of a live session
│   │   ├── extractionService.js     # Field extraction; extractForReport = record + notes
│   │   ├── captureOutcome.js        # Every recording pass ends with an explicit verdict (pure)
│   │   ├── reportDraft.js           # Extraction → editable draft, notes, badges (pure)
│   │   ├── reportCompleteness.js    # Mandatory-field gate (pure)
│   │   ├── reportDocument.js        # Draft → PDF payload (pure)
│   │   ├── pdfService.js            # Native PDF exporter isolation layer
│   │   ├── anuvadini/               # Transcription client
│   │   │   ├── proxyContract.js     #   Request shapes and error kinds
│   │   │   ├── transcriptionClient.js #  Transport switch: direct or proxy
│   │   │   ├── chunkedUpload.js     #   45 s chunks around the upstream truncation
│   │   │   └── language.js          #   Language normalization (en → en-IN)
│   │   └── extraction/              # One module per pipeline stage
│   │       ├── normalizeTranscript.js
│   │       ├── detectNegation.js
│   │       ├── detectMarkers.js
│   │       ├── segmentTranscript.js
│   │       ├── classifySegment.js
│   │       ├── postProcessors.js
│   │       ├── scoreField.js        #   Evidence per field; rejects and reroutes
│   │       ├── residue.js           #   Sentences no field accounts for
│   │       ├── collectEvidence.js
│   │       ├── suppressNegated.js
│   │       ├── parseMedication.js
│   │       ├── validators.js
│   │       └── resolveConflicts.js
│   ├── specs/                       # TurboModule specs (React Native codegen input)
│   │   ├── NativePdfExporter.ts     #   PDF rendering
│   │   ├── NativeAudioCue.ts        #   Cues, tone suppression, spoken prompts
│   │   ├── NativeSharedMic.ts       #   Shared microphone + consultation recording files
│   │   ├── NativeAudioCapture.ts    #   Contention spike probe (debug builds only)
│   │   └── NativeAppConfig.ts       #   Build-time configuration
│   ├── store/
│   │   ├── useRecordingStore.js     # Zustand recording state
│   │   └── useReportsStore.js       # Zustand saved-report state
│   ├── utils/
│   │   └── datetime.js              # Display + relative timestamps, PDF filename stamps
│   └── theme/
│       ├── colors.js
│       ├── spacing.js
│       ├── typography.js
│       └── index.js
├── scripts/                         # 19 framework-free fixture suites, plain Node
│   ├── lib/fixture-harness.mjs      #   Shared check/report harness
│   ├── test-extraction*.mjs         #   Floor, natural, adversarial, samples, numeric,
│   │                                #   cleanup, synonyms, history, residue, recall
│   ├── test-report.mjs              #   Draft + PDF payload
│   ├── test-completeness.mjs        #   Mandatory-field gate
│   ├── test-capture-outcome.mjs     #   Every recording pass reports a verdict
│   ├── test-transcript-state.mjs    #   Dual transcripts, raw baselines, continuation
│   ├── test-transcript-diff.mjs     #   "What AI changed" diff
│   ├── test-anuvadini-client.mjs    #   Transcription client, both transports
│   ├── test-audio-budget.mjs        #   Upload sizing and the duration ceiling
│   ├── test-chunked-upload.mjs      #   Chunk ordering, partial failure, retry
│   └── test-proxy.mjs               #   Proxy translation and credential containment
├── server/                          # Dependency-free Node proxy — local dev / future prod
│   ├── index.mjs                    #   Routing, body cap, field translation, error mapping
│   ├── anuvadini.mjs                #   The upstream call; the only place the token lives
│   └── .env.example                 #   Property names only, never a real token
├── android/
│   └── app/src/main/
│       ├── java/com/medscribe/pdf/    # Kotlin PDF exporter TurboModule
│       ├── java/com/medscribe/audio/  # Audio cue, shared microphone, capture spike
│       ├── java/com/medscribe/config/ # Build-time config (Anuvadini token)
│       └── res/xml/file_paths.xml     # FileProvider paths for sharing exported PDFs
├── DESIGN.md                        # Design system: colour, type, spacing, components
├── docs/
│   ├── MedSrcibe_SRS.md             # Requirements specification
│   └── handoff.md                   # Architecture, decisions, known issues — read this
└── __tests__/
```

---

## Third-Party Packages

### In active use

| Package | Purpose |
| :-- | :-- |
| `@appcitor/react-native-voice-to-text` | Speech-to-text via Android `SpeechRecognizer`. Exposes partial and final results. |
| `react-native-permissions` | Microphone permission. Used over core `PermissionsAndroid` because it distinguishes **blocked** from **denied** and provides `openSettings()`. |
| `@op-engineering/op-sqlite` | Local SQLite. Real SQL with transactions and versioned migrations, JSI-backed, New-Architecture native. Chosen over key-value storage so the dashboard can list and sort without loading every record. |
| `zustand` | Recording session state and saved-report state, shared across screens. |
| `react-native-reanimated` + `react-native-worklets` | 60 fps animations on the UI thread. |
| `@react-navigation/native` + `@react-navigation/native-stack` | Screen navigation. |
| `react-native-screens` | Native screen optimization. |
| `react-native-safe-area-context` | Notch and system-bar insets. |

**PDF generation has no package.** It is an in-app Kotlin TurboModule over Android's own `PdfDocument` — no maintained React Native PDF *generator* supports the New Architecture, and an unmaintained dependency in the export path of a medical record is a liability.

### Installed but not yet used

`axios`, `zod`, `react-hook-form`, `react-native-gesture-handler`, `react-native-vector-icons`, `@react-native-vector-icons/material-design-icons`, `@react-native/new-app-screen`.

These are reserved for later phases. Listed explicitly so nobody assumes they are load-bearing.

---

## Available Scripts

| Script | Description |
| :-- | :-- |
| `npm start` | Start the Metro bundler. |
| `npm run android` | Build, install and launch. Uses `--active-arch-only` — builds only the connected device's ABI (~4× faster, ~½ the APK size). |
| `npm run android:all-abis` | Build all four ABIs for a universal APK. Slow; only needed for release or an unknown target device. |
| `npm run ios` | iOS build. **Unverified — never built.** |
| `npm run test:extraction` | 240 assertions — the extraction regression floor. Runs under plain Node, no test framework. |
| `npm run test:extraction:natural` | 129 assertions over natural phrasing: synonyms, progressive-aspect symptoms, pronoun gender, negation, chronic vs acute. |
| `npm run test:extraction:adversarial` | 31 assertions over conflicting, corrected and cancelled dictation. |
| `npm run test:extraction:samples` | 195 assertions over twenty real dictation samples, including a punctuation-free variant. |
| `npm run test:extraction:synonyms` | 71 assertions, one per phrase family, so a full-sample fixture cannot hide a broken marker. |
| `npm run test:extraction:numeric` | 49 assertions over PIN and phone grouping, country codes and spoken digits. |
| `npm run test:extraction:cleanup` | 54 assertions over conversational cleanup across all eleven fields. |
| `npm run test:extraction:history` | 68 assertions over medical-history aggregation: positive and negative statements in dictated order, all five retraction cues, and the denials that must stay out of the field. |
| `npm run test:extraction:residue` | 39 assertions over dictation that reaches no field — plus the grounding invariant: no word the report prints was left undictated. |
| `npm run test:extraction:recall` | 119 assertions — the 40-phrasing coverage benchmark against two floors (markers alone, and the whole read), every wrong-field defect ever observed, and the invariant that no field holds a value its own evidence contradicts. |
| `npm run test:report` | 81 assertions over the editable draft, the PDF payload and the dashboard timestamps. Also plain Node. |
| `npm run test:completeness` | 63 assertions over the mandatory-field gate, explicit-none statements and the Add-More-Speech merge. |
| `npm run test:capture` | 23 assertions that every recording pass ends with an explicit verdict — no input combination returns silence — and that a failure with nothing to resend does not offer Retry. |
| `npm run test:transcripts` | 86 assertions over the dual-transcript state: raw baselines, editable drafts, the continuation base, and manual edits surviving a multi-pass sequence. |
| `npm run test:diff` | 30 assertions over "What AI changed": word-level diff, punctuation and casing normalization, medical substitutions. |
| `npm run test:anuvadini` | 78 assertions over the transcription client: both transports, request assembly, language normalization, every failure path, and that the token never reaches a result or an error. |
| `npm run test:audio` | 89 assertions over the capture upload budget: WAV sizing, Base64 growth, the per-request and per-recording ceilings, and chunk plans that are contiguous and disjoint. |
| `npm run test:chunks` | 46 assertions over chunked upload: sequential order, the ordered join, a mid-pass failure keeping earlier chunks, and retry re-sending only what is missing. |
| `npm run test:proxy` | 97 assertions over the transcription and synthesis proxy: field translation, credential containment, every error mapping, and that a URL where base64 was expected is refused. |
| `npm run test:tts:prompt` | 26 assertions over the spoken missing-field prompt: grammar at every count, the four-field cap and its overflow, and that a field VALUE never reaches the text. |
| `npm run test:tts:client` | 86 assertions over the speech client: both transports, every response shape and failure path, and that the token appears in no result or error. |
| `npm run test:tts:service` | 10 assertions over prompt ordering: a stop issued during synthesis prevents playback, and the newer request wins. |
| `npm run proxy` | Runs the local transcription proxy. Needs `server/.env` — see [server/README.md](server/README.md). |
| `npm run lint` | ESLint across the project. |
| `npm test` | Jest. **Currently broken** — see below. |

The twenty-two fixture suites total **1731 assertions** and are the project's real gate — the extraction, report and transcript layers are pure and RN-free, so they run under plain Node with no framework and no device. `npm test` (Jest) is a separate, currently broken path; it is not what guards this codebase.

Useful direct commands:

```bash
npx eslint . --ext .js,.jsx              # lint explicitly including .jsx
adb devices                              # list attached devices
adb reverse tcp:8081 tcp:8081            # let a USB device reach Metro
adb logcat -s ReactNativeJS              # JS console output
cd android && ./gradlew clean            # clean native build
```

---

## Troubleshooting

### Device not detected

`adb devices` shows nothing, or a command fails with `device not found`:

```bash
adb kill-server
adb start-server
adb devices
```

If it lists `unauthorized`, re-accept the USB debugging prompt on the phone. Some devices drop the USB connection intermittently — the server restart above recovers it.

### `Unable to load script`

Metro is not running, or the device cannot reach it.

```bash
npm start                        # in its own terminal
adb reverse tcp:8081 tcp:8081    # required for USB devices
```

`npm run android` sets up `adb reverse` automatically; installing via `adb install` or a direct Gradle task does not.

### Blank white screen

Two different causes. Check Metro's terminal first — it tells you which one you have.

**1. Wedged hot-reload.** Metro is running and has printed `BUNDLE ./index.js`, but the app is stale — most often because Metro was restarted underneath a running app. Force-stop and relaunch:

```bash
adb shell am force-stop com.medscribe
adb shell am start -n com.medscribe/.MainActivity
```

**2. Metro or the Gradle daemon is wedged and the bundle never loads.** Metro shows no `BUNDLE ./index.js` line at all. The app has no JavaScript, so it renders nothing — and the install log still says `Success`, which makes this look like an app bug. Full restart:

```bash
# Windows (PowerShell) — stop the stale daemons and bundler
Get-Process java, node -ErrorAction SilentlyContinue | Stop-Process -Force

npm start                                      # terminal 1 — wait for "Dev server ready"
npm run android -- --device <your-device-id>   # terminal 2
```

The build is confirmed healthy only when **Metro prints `BUNDLE ./index.js`**. A `BUILD SUCCESSFUL` plus `Success` from the installer proves the APK landed, not that the device got a bundle.

Expect the rebuild to take a few minutes — killing the Gradle daemon means it starts cold (`Starting a Gradle Daemon, 1 incompatible and 1 stopped Daemons could not be reused` is the expected message, not an error).

### `No online devices found` (emulator)

The emulator never finished booting. Two common causes:

- **Insufficient AVD RAM.** An API 36 Google Play image needs **≥ 4096 MB**; at 1536 MB it hangs and `adb` reports `offline` indefinitely. Edit the AVD in Android Studio → *Show Advanced Settings* → **RAM**.
- **A bad snapshot** after a force-kill. Cold-boot instead:

```bash
emulator -avd <avd_name> -no-snapshot-load
```

Wait for a real boot before installing — a visible window is not the same as a ready device:

```bash
adb wait-for-device shell getprop sys.boot_completed   # returns 1 when ready
```

### Dictation produces no text

**On an emulator, this is expected — use a physical device.** Emulator microphone passthrough does not deliver usable audio to the speech recognizer, even with a Google Play image and `-allow-host-audio`. This was verified by testing Google's *own* voice search on the same emulator: it also transcribed nothing.

**On a physical device**, check in order:

1. Microphone permission is granted — and granted as **"While using the app"**, not "Only this time":
   ```bash
   adb shell dumpsys package com.medscribe | findstr RECORD_AUDIO
   ```
   A `ONE_TIME` flag means Android will silently revoke it on backgrounding.
2. The device has a speech recognizer:
   ```bash
   adb shell pm query-services -a android.speech.RecognitionService
   ```
3. Network connectivity — some recognizer models require it.

### A beep still plays between every sentence

That tone comes from the **system** speech recognition service, not from MedScribe — Android restarts the recognizer after every utterance and it announces each session. The app mutes the streams that carry it for the duration of a dictation, but which stream a given OEM uses varies.

`suppressSystemTones` resolves with the list of streams it actually managed to mute (`music,system,notification` on a stock device). Check it in logcat:

```bash
adb logcat -s AudioCueModule ReactNativeJS
```

A short list means the system refused some streams. Muting the ring, notification and alarm group requires Do-Not-Disturb access, which the app deliberately never requests — asking a doctor to hand over DND control to silence a beep is not a reasonable trade.

### The device volume seems stuck down

It should not be possible to leave the phone muted. Five independent paths restore the streams: the app's own pause/stop/unmount calls, the native lifecycle callbacks (which cover a JS crash or a Metro reload), a 120-second watchdog inside the module, a flag written to `SharedPreferences` before the first mute and checked on the next launch, and Android's own per-client cleanup when a process dies.

If it ever does happen, that is a real bug — note the device model and the Android version, since stream routing is where OEMs differ most.

### It offers to restore an unfinished dictation

Expected after a crash, a force-stop or the OS killing the app mid-consultation: the transcript is saved as it grows, so it survives. **Restore** continues that session with its transcript and elapsed time intact; **Discard** deletes it. The prompt is answered before the microphone starts, so neither choice can race the recogniser.

### AI Transcription says "Not configured in this build"

The Anuvadini token is missing. Add `ANUVADINI_STT_TOKEN` to `android/local.properties` and **rebuild natively** — it is compiled into `BuildConfig`, so Metro cannot supply it:

```bash
npm run android -- --device <your-device-id>
```

Everything else keeps working without it; only the second transcription is unavailable. See [Environment Setup](#3-anuvadini-credential).

### AI Transcription says "Unable to generate"

The request reached the client and failed. **Retry** is offered and re-sends the same recording, so retrying cannot duplicate anything. Common causes, in order:

1. **No network.** The call goes to `anuvadini-services.aicte-india.org` over HTTPS.
2. **Token rejected server-side.**

Length is no longer a cause. The service processes roughly the first 57 seconds of any submission and silently discards the rest — measured, with a 200 and no marker, so a truncated transcript is indistinguishable from a whole one. A dictation is therefore uploaded in chunks of `SAFE_CHUNK_SECONDS` (45 s), cut at silence so no word is split, and joined in order before anything downstream sees it. See [`src/services/audioBudget.js`](src/services/audioBudget.js) and [`src/services/anuvadini/chunkedUpload.js`](src/services/anuvadini/chunkedUpload.js).

Retry re-sends only the chunks that have not yet succeeded, so retrying a three-chunk dictation that failed on the last one costs one request.

The original transcript is unaffected in every case and still generates a report.

### The diagnostic long-press does nothing

Expected in a release build. The development diagnostic dump carries the full consultation trace and is restricted to development builds, whereas PDF export remains available for generated reports. In a development build, long-press the "Patient Report" title and confirm the prompt.

### The report is missing fields

Tap **"Show original dictation"** on the report screen first. That single step tells you which of two very different problems you have:

- **Symptoms look merged** — dictation with no commas ("fever cough weakness") groups adjacent symptoms into one list item. Deliberate: splitting on spaces would break "chest pain" and "sore throat". Nothing is lost — split the item on the transcript review screen.
- **Words are missing from the transcript** — the recognizer dropped them during a restart gap. No extraction change can recover a field whose introducer phrase was never transcribed. Dictate with a brief pause between sentences, and see the recognizer-restart limitation in [`docs/handoff.md`](docs/handoff.md).
- **The transcript is complete but the field is empty, and the sentence is in the notes card** — the phrasing scored too low to place confidently. Nothing was lost; tap **Keep** to publish it as an Additional Clinical Notes item in the report, or manually edit the suggested report field yourself. To make the phrasing recognised outright, add a row to `src/constants/fieldMarkers.js` — no pipeline logic needs changing.

**Scroll to the notes card before assuming anything was dropped.** Any dictated sentence that reached no field is sitting there verbatim — that card exists precisely so a gap is visible rather than silent.

Fields the doctor genuinely never mentioned correctly show **Not Available** — that is FR-7 behaviour, not a bug.

### A field shows AUTO

Not an error. The value came from classifying a sentence that used no recognised marker phrase — "Examination suggests viral fever" reaching Diagnosis, for instance — rather than from something the doctor labelled. It is flagged so the two are never confused in a medical record, and it carries **UNCERTAIN** alongside for the same reason. Editing the field clears both badges and replaces them with **EDITED**: the value is the doctor's from that point on.

### `PDF export is unavailable in this build`

That exact message means the JavaScript reloaded but the native exporter was never compiled in — the app is running an APK built before the PDF module existed. Metro cannot supply a native module. Rebuild:

```bash
npm run android -- --device <your-device-id>
```

The same applies after pulling changes that touch `src/specs/`, `android/app/src/main/java/com/medscribe/pdf/`, or `AndroidManifest.xml`.

### Where the exported PDF goes

App-scoped external storage, so no storage permission is ever requested:

```bash
adb shell ls /sdcard/Android/data/com.medscribe/files/Documents/MedScribe/
adb pull /sdcard/Android/data/com.medscribe/files/Documents/MedScribe/<file>.pdf
```

The share sheet that appears after export is the intended route for printing or mailing it; the path above is for inspecting the output during development.

### The dashboard shows an error instead of reports

An error banner is **not** the empty state — it means the database did not open, so "no reports listed" is not the same as "no reports saved". Check the real cause:

```bash
adb logcat -s ReactNativeJS
```

The most common cause is running a JS-only reload against an APK built before `@op-engineering/op-sqlite` was added. It is a native library; rebuild with `npm run android -- --device <id>`.

### Saved reports disappeared

Reports live in the app's private SQLite database. **Uninstalling the app, or clearing its storage from Android settings, deletes them permanently** — there is no backup or cloud sync yet. A normal reinstall over the top via `npm run android` preserves them.

### Transcription is inaccurate or mixes languages

On devices set to `en-IN`, the recognizer may code-switch into Hindi and produce Hinglish. Setting the device language to **English (United States)** improves results substantially. A deeper fix is documented in [`docs/handoff.md`](docs/handoff.md).

### Permission dialog keeps reappearing

The permission was granted as **"Only this time"**, which Android revokes when the app is backgrounded. Re-grant with **"While using the app"**.

### `npm test` fails with `Preset @react-native/jest-preset not found`

A known pre-existing gap — the preset is referenced by `jest.config.js` but is not installed:

```bash
npm i -D @react-native/jest-preset@0.86.0
```

### `Another process is running on port 8081. Use port 8082 instead?`

Metro is already running (which is what you want), and `run-android` is offering to start a *second* bundler on another port. Answer **No** — or skip the prompt entirely by telling it not to start a packager:

```bash
npx react-native run-android --active-arch-only --no-packager
```

Accepting port 8082 leaves the app pointed at a bundler your device isn't reverse-forwarded to, which then shows up as `Unable to load script`.

### Stuck at `99% EXECUTING > :app:installDebug`

**Usually not a hang — it is the APK being copied to the device.** Confirm rather than guess by running this twice a few seconds apart:

```bash
adb shell stat -c %s /data/local/tmp/app-debug.apk
```

- **Number growing** → still transferring. Let it finish; killing it wastes the whole build.
- **Number static and install never completes** → see the ColorOS note below.

Measured on this project: a four-ABI debug APK is **~103 MB** and transfers at about **1.09 MB/s** over USB 2.0 — roughly 95 seconds on top of the build. Using `npm run android` (see next entry) cuts the APK to ~45 MB and the transfer to ~40 s.

Verify the install actually landed — do not assume:

```bash
adb shell dumpsys package com.medscribe | findstr lastUpdateTime
```

The timestamp must be from the current run. A stale timestamp means the old build is still installed.

On **ColorOS / Oppo / OnePlus**, enable **Settings → Developer options → "Install via USB"** and **"USB debugging (Security settings)"**. Without them the system can block or prompt on install, which looks identical to a hang.

### Build is slow (~12 minutes)

The default `reactNativeArchitectures` compiles all four ABIs, and every one of them is packaged into the debug APK — inflating both build time and transfer time. Your device can only ever use one.

```bash
npm run android            # --active-arch-only: builds only the connected device's ABI
npm run android:all-abis   # all four, for a universal APK
```

`--active-arch-only` adapts automatically — `arm64-v8a` on a phone, `x86_64` on an emulator — so there is no setting to remember to revert. Expect roughly 13 min → 3–4 min.

**Most changes need no rebuild at all.** A native rebuild is only required for changes to `android/`, `AndroidManifest.xml`, or native dependencies. Anything under `src/`, `App.jsx`, or `index.js` is served by Metro — just save the file. If state is stale:

```bash
adb shell am force-stop com.medscribe
adb shell am start -n com.medscribe/.MainActivity
```

### `Hard link ... failed. Doing a slower copy instead.`

**Harmless.** It appears when the project and the Gradle cache sit on different Windows volumes (e.g. project on `D:`, cache on `C:`), because hard links cannot cross volumes. The build still succeeds.

### Stale build

```bash
cd android && ./gradlew clean
npm start -- --reset-cache
```

---

## Roadmap

| Phase | Scope | Status |
| :-- | :-- | :-- |
| **1** | Design system, components, navigation | Complete |
| **2** | Permissions, speech-to-text, live transcript | Complete |
| **3** | Patient-field extraction, structured report, preview | Complete |
| **4** | Editable fields, save, doctor dashboard, SQLite persistence, PDF export | Complete |
| **5** | Pause/resume, transcript review, session autosave + recovery, audio cues, dashboard redesign | Complete, verified on hardware |
| **6** | Extraction v2 — natural phrasing, negation, retraction, pronoun gender, prescription list | Complete |
| **7** | Auto-save and consultation recovery, mandatory-field completeness gate | Complete |
| **8** | Shared microphone, Anuvadini second transcription, editable AI transcript, continuation, diff | Complete; verified on device in both Debug and Release |
| **9** | Extraction v3 — nothing dictated is discarded, and evidence decides whether a value may stay where a marker put it | Complete against fixtures; **device verification pending** |

**Next up**, in priority order:

1. **Dictate Phase 9 on hardware.** It passes 1731 fixture assertions and has not been spoken to a phone. The fixtures are clean text by construction, so they cannot see transcription loss at all — every other phase here was signed off on a device before being called done.
2. **Deploy `server/` and switch `TRANSCRIPTION_TRANSPORT` to `proxy`.** The Bearer token is currently compiled into the APK, which is acceptable for internal testing and not for distribution. The proxy is written, tested (77 assertions) and dependency-free; deploying it behind HTTPS removes the credential from every device and changes no feature code. See [`server/README.md`](server/README.md#deploying).
3. **Improve `en-IN` recognition accuracy**, still bounded by the recognizer rather than by this codebase.

Recently closed, so nobody re-files them:

- **Dictation reaching no field was silently dropped.** It is now kept verbatim in the notes card, and the report is guarded by an invariant that no printed word was left undictated.
- **Fields could hold values belonging to other fields** — measured, the worst being a diagnosis printed as the patient's name. Evidence now decides, and each observed case is a named assertion in `test:extraction:recall`.
- **Promote the realistic dictation samples to committed fixtures.** Done — twenty samples in `test-extraction:samples`, plus the 40-phrasing coverage benchmark.
- Leaving the Recording screen and returning used to strand the app on a permanent "Speech recognition unavailable".
- **Recognizer restart gaps** were the largest known quality gap. The shared-microphone path addresses them directly — one continuous session instead of a restart per utterance — and measured **88% word recall against the 75% restart-loop baseline** on the target device.
- **Which audio stream carries the recognizer tone** was Phase 5's one unverified item. Resolved during the contention measurements.

Longer term (per the SRS): AI-assisted entity extraction, ICD-10 coding, EHR integration, multi-language recognition, cloud sync, offline recognition. **Multiple doctors and authentication** join that list — the schema carries no `doctor_id` yet, and the database is not encrypted at rest, both of which need addressing before real patient data.

Anuvadini is multilingual, and `normalizeAnuvadiniLanguage` already maps thirteen Indian languages; only `en-IN` has been exercised end to end.

PDF export, patient history and report editing before save were delivered in Phase 4.

---

## Documentation

| Document | Contents |
| :-- | :-- |
| [`docs/handoff.md`](docs/handoff.md) | Architecture, design decisions, conventions, known issues. **Read before modifying the speech pipeline.** |
| [`docs/MedSrcibe_SRS.md`](docs/MedSrcibe_SRS.md) | Requirements specification. |
| [`DESIGN.md`](DESIGN.md) | Design system: colour tokens, typography, spacing, component patterns. |
| [`server/README.md`](server/README.md) | The transcription proxy: contract, how to run it, and what it refuses to log. |
