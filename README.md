# MedScribe

**Voice-powered medical documentation for Android.**

MedScribe lets doctors create patient records by dictating instead of typing. It captures speech through the device microphone, converts it to text on-device, and (from Phase 3 onward) will extract patient fields into a structured clinical report.

> MedScribe is a **documentation aid only**. It performs no diagnosis and makes no medical decisions.

---

## Table of Contents

- [Features](#features)
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

---

## Features

### Available now

- **Dark, clinical UI** — design-token theme built for consultation-room readability.
- **Animated microphone** — Reanimated idle breathing and press feedback.
- **Full runtime permission flow** — handles granted, denied, permanently blocked (with a working "Open Settings" action), and no-engine-available.
- **Continuous dictation** — Android's speech recognizer stops at the first pause, so MedScribe automatically restarts it and accumulates the results. The doctor can pause naturally between sentences; only an explicit **Stop** ends the session.
- **Live transcript** — confirmed text renders solid, the recognizer's interim guess trails it in muted italics.
- **Real-time audio visualizer** — driven by actual microphone RMS levels, not a canned animation.
- **Graceful error handling** — transient recognizer errors are retried silently; genuine failures surface in plain language.

### Planned

Patient-field extraction, structured report generation, missing-field handling, and report preview. See [Roadmap](#roadmap).

---

## Technology Stack

| Layer | Technology |
| :-- | :-- |
| Framework | React Native **0.86.0** (New Architecture — Fabric + TurboModules) |
| UI runtime | React **19.2.3** |
| JS engine | Hermes |
| Language | **JavaScript only** — no TypeScript |
| Navigation | React Navigation 7 (native stack) |
| State | Zustand 5 |
| Animation | Reanimated 4 + Worklets |
| Speech | `@appcitor/react-native-voice-to-text` (Android `SpeechRecognizer`) |
| Permissions | `react-native-permissions` 5 |
| Build | Gradle 9.3.1, Kotlin 2.1.20 |

**File-extension convention:** `.jsx` for files containing JSX, `.js` for everything else.

---

## Prerequisites

| Tool | Required | Verified working |
| :-- | :-- | :-- |
| **Node.js** | ≥ 22.11.0 (enforced by `engines`) | v24.18.0 |
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

**macOS / Linux (`~/.zshrc` or `~/.bashrc`):**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

Restart your terminal, then verify:
```bash
node --version      # ≥ v22.11.0
java -version       # 17.x
adb --version
```

---

## Installation

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
npx react-native run-android --device 0015935AE000363   # preferred
npx react-native run-android --deviceId 0015935AE000363 # deprecated, still functional

# or pin the target for any Gradle/adb command in the shell session:
export ANDROID_SERIAL=0015935AE000363        # PowerShell: $env:ANDROID_SERIAL="..."
```

> **Speed tip.** The default build compiles all four ABIs. Building only your device's architecture cuts build time roughly 4×:
> ```bash
> npx react-native run-android --active-arch-only
> # or, calling Gradle directly:
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

<queries>
  <intent>
    <action android:name="android.speech.RecognitionService" />
  </intent>
</queries>
```

The `<queries>` block is **required on API 30+** for the app to see the system speech recognizer at all.

> **Any change to `AndroidManifest.xml` requires a full native rebuild.** Metro fast-refresh will not pick it up.

---

## Project Structure

```
MedScribe/
├── App.jsx                          # Root: SafeAreaProvider + NavigationContainer
├── index.js                         # AppRegistry entry point
├── src/
│   ├── components/                  # Reusable UI
│   │   ├── AnimatedMicButton.jsx    #   Hero microphone with Reanimated feedback
│   │   ├── AppHeader.jsx            #   Brand header + optional back button
│   │   ├── ListeningVisualizer.jsx  #   Aura + spectrum driven by real mic levels
│   │   ├── PermissionGate.jsx       #   Denied / blocked / unavailable screens
│   │   ├── RecordingControls.jsx    #   State-aware action buttons
│   │   ├── ScreenContainer.jsx      #   Safe-area + status-bar wrapper
│   │   ├── SectionTitle.jsx         #   Title + subtitle block
│   │   └── TranscriptView.jsx       #   Live transcript (final + interim)
│   ├── constants/
│   │   └── recordingStates.js       # State machine, error maps, timings
│   ├── hooks/
│   │   └── useSpeechRecognition.js  # Session orchestrator: permission → record → transcript
│   ├── navigation/
│   │   └── RootNavigator.jsx        # Native stack: Home → Recording
│   ├── screens/
│   │   ├── HomeScreen.jsx
│   │   └── RecordingScreen.jsx
│   ├── services/
│   │   ├── permissionService.js     # Microphone permission handling
│   │   └── speechService.js         # Speech engine isolation layer
│   ├── store/
│   │   └── useRecordingStore.js     # Zustand recording state
│   └── theme/
│       ├── colors.js
│       ├── spacing.js
│       ├── typography.js
│       └── index.js
├── android/
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
| `zustand` | Recording session state, shared across screens. |
| `react-native-reanimated` + `react-native-worklets` | 60 fps animations on the UI thread. |
| `@react-navigation/native` + `@react-navigation/native-stack` | Screen navigation. |
| `react-native-screens` | Native screen optimization. |
| `react-native-safe-area-context` | Notch and system-bar insets. |

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
| `npm run lint` | ESLint across the project. |
| `npm test` | Jest. **Currently broken** — see below. |

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

Usually a wedged hot-reload — most often because Metro was restarted underneath a running app. Force-stop and relaunch:

```bash
adb shell am force-stop com.medscribe
adb shell am start -n com.medscribe/.MainActivity
```

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
| **3** | Patient-field extraction, structured report, preview | Planned |

Longer term (per the SRS): AI-assisted entity extraction, ICD-10 coding, PDF export, EHR integration, multi-language recognition, cloud sync, patient history, offline recognition.

---

## Documentation

| Document | Contents |
| :-- | :-- |
| [`docs/handoff.md`](docs/handoff.md) | Architecture, design decisions, conventions, known issues. **Read before modifying the speech pipeline.** |
| [`docs/MedSrcibe_SRS.md`](docs/MedSrcibe_SRS.md) | Requirements specification. |
