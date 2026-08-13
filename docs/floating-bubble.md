# Floating dictation bubble

A system-wide overlay that lets a doctor dictate from any screen without opening
MedScribe. It is an **additional front end to the existing pipeline**, not a
second pipeline.

---

## If "Display over other apps" is refused

If Android shows **"App was denied access. Access to this permission can put
your personal and financial info at risk"**, that is not a bug in MedScribe.
It is Android 13+ **Restricted Settings**, which blocks Accessibility,
Notification access and Display-over-apps for apps installed from an untrusted
source. The manifest is correct and the permission is declared.

**Settings › Developer › Overlay diagnostics** prints the exact reason. Read
`installer` and `windowAttached`:

| Reading | Meaning | Fix |
|---|---|---|
| `installer` is `none` / `com.android.shell`, API ≥ 33 | Restricted Settings | Reinstall with `adb install -r -i com.android.vending app-debug.apk`, or Settings › Apps › MedScribe › ⋮ › **Allow restricted settings** |
| `canDrawOverlays: true` but `windowAttached: false` | OEM background-popup block (common on MIUI) | Grant the separate "Display pop-up windows while running in background" toggle in the OEM app-permissions screen |
| `canDrawOverlays: false`, trusted installer | Simply not granted yet | Use the bubble toggle in Settings |

The `-i com.android.vending` flag is a **development convenience only**. It must
never appear in a release process, and it changes nothing for users installing
from the Play Store.

---

## 1. Architecture

**JS drives, native renders.**

```
overlay tap ──emitOnOverlayCommand──▶ dictationBubble
                                          │ overlayCommandRouter (pure)
                                          ▼
                                 dictationSessionManager   ← unchanged
                                          │ zustand subscribe
                                          ▼
                                 overlayPresenter (pure) ──pushState──▶ overlay views
```

Native owns only drag, expand/collapse and painting. Every state transition runs
through the JavaScript pipeline that already existed, so refinement, translation,
extraction, validation and persistence are reused verbatim.

### Why not drive the session natively

`stopSession()` is a twelve-step ordered pipeline of HTTP clients, the extraction
engine and op-sqlite persistence. Reimplementing that ordering in Kotlin would
duplicate business logic *and* still have to call back into JS for refinement and
translation.

### The constraint that shaped everything

React Native **hard-stops** JS timers when the Activity pauses — it does not
throttle them. `JavaTimerManager.onHostPause()` sets `isPaused` and clears the
choreographer callback; `doFrame` early-returns while `isPaused && !isRunningTasks`.
Without intervention, backgrounding freezes the 400 ms mic poll, the duration
timer, the autosave debounce and the finalize timer.

The escape hatch is `isRunningTasks`, set by `onHeadlessJsTaskStart`. The
foreground service starts a `HeadlessJsTaskConfig(..., isAllowedInForeground = true)`,
which restores the choreographer callback so **every existing timer keeps running
unchanged**. That single move is why no pipeline code needed rewriting.

---

## 2. Files added

**Kotlin** (`android/app/src/main/java/com/medscribe/overlay/`)

| File | Role |
|---|---|
| `DictationOverlayModule.kt` | TurboModule surface: permission, service control, `pushState`, review, handoff |
| `DictationOverlayPackage.kt` | Registration, mirroring `SharedMicPackage` |
| `DictationOverlayBridge.kt` | Kotlin `object` joining service views to the module's event emitter; pending-command queue |
| `DictationBubbleService.kt` | Foreground service, notification channel, headless task, FGS type promotion |
| `OverlayViewController.kt` | The window: bubble, controls, live transcript panel, drag and edge-snap |
| `OverlayReviewActivity.kt` | Transparent RN Activity hosting the review sheet |
| `OverlaySnapshot.kt` | Immutable state carried across the bridge |

**Resources** — `drawable/ic_dictation_notification.xml`, `values/colors.xml`,
new strings, and `OverlayReviewTheme` in `styles.xml`.

**JavaScript**

| File | Role |
|---|---|
| `src/specs/NativeDictationOverlay.ts` | Codegen spec, including the `EventEmitter` |
| `services/dictationOverlayService.js` | Lazy-require wrapper; every call is a safe no-op without the native module |
| `services/dictationBubble.js` | Runtime: subscribes to commands, routes them, publishes state |
| `services/dictationBubbleSession.js` | The bubble-session flag, dependency-free so it stays testable |
| `services/overlayPresenter.js` | Pure store → snapshot |
| `services/overlayCommandRouter.js` | Pure command + state → manager method |
| `services/overlayHandoff.js` | Pending-route queue and the report-readiness gate |
| `services/dictationBackground.js` | Pure backgrounding predicates |
| `navigation/navigationRef.js` | Navigation ref with queue-until-ready |
| `screens/OverlayReviewScreen.jsx` | The review sheet |

---

## 3. Files modified

`AndroidManifest.xml` (permissions, `<service>`, review Activity) ·
`MainApplication.kt` (one package) · `SharedMicModule.kt` (`invalidate` override) ·
`AudioCueModule.kt` (gate `onHostPause`) · `index.js` (headless task + review
component) · `App.jsx` (navigation ref) · `useSpeechRecognition.js` (backgrounding
fix) · `settingsService.js`, `useSettingsStore.js`, `SettingsScreen.jsx` (toggle).

**Deliberately untouched:** `dictationSessionManager`, `transcriptRefinement`,
`transcriptTranslation`, `extractionService`, `reportDraft`, `reportCompleteness`,
`ReportScreen`, `TranscriptReviewScreen`, `RecordingScreen`. The existing in-app
flow behaves exactly as before.

---

## 4. Design decisions

**Native views, not Compose or XML.** The project has two Gradle dependencies and
no layouts. Programmatic Android views add zero dependencies and no APK weight.
The review sheet is the exception — it needs a real IME, so it is a transparent
RN Activity that reuses React components and shares the same zustand store.

**Two overlay windows, not one.** The bubble and the live transcript are separate
`WindowManager` windows so each can be dragged and positioned independently, and
so the transcript can appear the moment recording starts rather than only when
the bubble is expanded. Both go through one attach/detach path.

**Satellite actions, animated with framework APIs.** Tapping the bubble expands
three satellites (Play/Pause, Stop, Home) with a staggered `ViewPropertyAnimator`
using `OvershootInterpolator` out and `AnticipateInterpolator` back.
`androidx.dynamicanimation` is not on the classpath and was not worth adding for
this.

**Processing messages rotate in Kotlin, not JS.** A `Handler` cycles the eight
messages every 2.5 s while the phase is processing. Native, because JS timers
stall when the host is paused. Real progress from JS (`Refining… 2 of 3`) always
wins over the decorative rotation — the rotation only fills the gap when there is
nothing concrete to say.

**Three icon treatments from one logo.** `src/assets/MedScribe_Logo.png` has no
alpha channel, so it is *masked*, never composited. The launcher gets a rounded
and a circular variant plus an adaptive icon; the bubble gets a circle-masked crop
of the M with the wordmark excluded, because the wordmark is illegible at 60dp.
The notification keeps its monochrome mic vector — Android masks small icons to
alpha, so a colour logo would render as a grey blob. Regenerate the whole set with
`node scripts/generate-icons.mjs` after changing the source logo.

**Spec-declared `EventEmitter`, not `RCTDeviceEventEmitter`.** Codegen emits a
typed `emitOnOverlayCommand` on the Kotlin spec, so there are no string-keyed
event names duplicated on both sides. Verified present in the generated spec.

**FGS type promotion rather than one fixed type.** `microphone` is what legally
permits `AudioRecord` to keep delivering while backgrounded; `specialUse`
honestly describes an idle bubble. Running `microphone` all day would pin the
mic privacy indicator on. The service promotes on dictation start and demotes on
stop.

**Report handover by navigation ref, not deep linking.** Deep linking needs a
manifest intent-filter, a scheme and a URL parser, and would *still* need a
navigation ref for the warm case. The handoff sets `stage = REPORT`, persists,
then navigates to `Report` **with no params** so `ReportScreen`'s existing
self-population runs. A cold start after a process kill needs no new code — the
existing `DashboardScreen` probe routes by stage.

---

## 5. State management

Six phases, derived from existing state rather than stored separately:

```
Idle → Recording → Paused → Processing → Review → Completed
```

`overlayPresenter.resolvePhase` maps `RECORDING_STATE` × `CONSULTATION_STAGE` ×
pipeline status onto a phase. A pending refinement or translation holds the
overlay in **Processing** even after the recorder has settled, so the doctor is
not offered a review of a transcript that is still being produced.

There is **one source of truth**: the zustand store. The overlay subscribes and
pushes a snapshot; it never keeps its own copy. `DictationOverlayBridge` drops a
publish whose snapshot equals the last one, so a 400 ms poll does not cause 400 ms
redraws.

---

## 6. Overlay lifecycle

The service is independent of every Activity. It survives MainActivity being
destroyed or swiped from recents, because in bridgeless RN the JS runtime outlives
Activity destruction — only `reactHost.destroy()` or process death ends it.

- **Start:** Settings toggle → `startBubbleService` → `startForeground` →
  headless task → window attached.
- **Dictation:** `beginDictationForeground` promotes the FGS to include
  `microphone`; `endDictationForeground` demotes it.
- **Process death:** `START_STICKY` plus the existing `active_sessions` recovery.
- **Teardown:** `onDestroy` removes the window, finishes the headless task and
  resets the bridge. `DictationOverlayModule.invalidate()` clears the emitter.

Two pre-existing native defects were fixed because the bubble makes them
constant rather than rare:

1. `SharedMicModule` had no `invalidate()`, so its two threads and the
   `AudioRecord` leaked on React context death, holding the mic.
2. `AudioCueModule.onHostPause()` treated backgrounding as "session over" and
   unmuted the system streams — which would have made the recogniser's
   per-utterance tones audible for an entire consultation.

---

## 7. Testing

**35 suites, 2441 assertions, all green.** Five suites are new:

| Suite | Covers |
|---|---|
| `test-background-teardown.mjs` | the backgrounding predicates — the regression test for the fixed bug |
| `test-overlay-state.mjs` | every status × stage → phase, processing detail, transcript truncation, capability flags |
| `test-overlay-commands.mjs` | command routing: pause refused unless recording, play refused without the mic or with a foreign session |
| `test-overlay-handoff.mjs` | queue → flush → consume-once, and the translation-readiness gate |
| `test-bubble-settings.mjs` | the toggle's persistence, including the absent-value default and DB-error fallback |

Build verified: `assembleDebug` succeeds, the codegen spec contains
`emitOnOverlayCommand`, and the merged manifest carries all five new permissions
plus `foregroundServiceType="specialUse|microphone"`.

### Device checklist

1. First launch → Settings → toggle the bubble → explainer → grant → bubble appears.
2. Drag it, release near each edge, confirm it snaps and survives a reboot.
3. Tap to expand; Play; leave MedScribe; confirm the transcript keeps growing and
   the timer keeps advancing for five minutes.
4. Pause, switch apps, Resume — same session continues.
5. Stop → processing panel → review sheet; edit both fields; Minimize; take a
   call; reopen and confirm the edits survived.
6. Save changes → Generate report → MedScribe opens on a populated Report.
7. Repeat 6 after force-stopping MedScribe (cold handover).
8. Cross-over: start in the app, stop from the bubble — and the reverse.
9. Confirm the recogniser's tones stay muted for a whole backgrounded session.
10. Repeat on at least one MIUI and one ColorOS device.

---

## 8. Limitations and future work

- **OEM battery killers.** MIUI, ColorOS and EMUI kill foreground-service
  processes. MIUI additionally has a separate "display pop-up windows while
  running in background" permission that `canDrawOverlays` reports as *granted*
  while the window silently never appears. `START_STICKY` and the existing
  session recovery are the safety net; the bubble will still die on some devices.
- **`specialUse` is a Play review gate.** It requires written justification at
  submission. The fallback is a session-scoped `microphone`-only service, which
  changes the lifetime rule from "runs until turned off" to "appears when a
  consultation starts".
- **Screen-off stalls timers even with the headless task**, because the
  choreographer is vsync-driven. Nothing is lost — the native recogniser
  accumulates text and JS drains the delta on wake — but `durationSeconds` drifts.
  Anchoring the duration to wall clock would fix it.
- **One active session, ever.** `saveSessionImmediate` deletes every other row, so
  the router refuses to start a second session while one is unfinished.
- **The overlay is Android-only.** Every call degrades to a no-op on iOS through
  the lazy-require wrapper.
- **Not yet built:** a level meter driven by real RMS, richer processing
  animation, and localisation of the overlay strings (they are currently English
  in `strings.xml` while the app's spoken prompts are already multilingual).
