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

**Settings › Troubleshooting › Overlay diagnostics** prints the exact reason.
That row is available in **release builds too** — it is the one screen that
explains this failure, so hiding it behind `__DEV__` made it useless in the
build where it is needed.

| Reading | Meaning | Fix |
|---|---|---|
| `canDrawOverlays: false`, `installer` is a package installer or file manager, API ≥ 33 | Restricted Settings | Settings › Apps › MedScribe › ⋮ › **Allow restricted settings**, then retry |
| `canDrawOverlays: true` but `windowAttached: false` | OEM background-popup block (common on MIUI) | Grant the separate "Display pop-up windows while running in background" toggle in the OEM app-permissions screen |
| `canDrawOverlays: false`, `installer` is `none` / `com.android.shell` | Simply not granted yet | Use the bubble toggle in Settings |

### Why debug works and release does not

This difference is **not** caused by the build type. Debug and release share the
same `applicationId`, the same signing certificate and the same merged manifest
permissions; `minifyEnabled` is false, so R8 never runs and cannot strip the
overlay module.

What differs is **who installed the APK**:

| Install route | `installer` reads | Restricted Settings |
|---|---|---|
| `adb install` (how debug arrives) | `none` / `com.android.shell` | **exempt** |
| Tapping the APK in a file manager (how release is shared) | a package-installer package | **applies** |
| Play Store, including internal testing | `com.android.vending` | **exempt** |

So the same release APK behaves differently depending on how it reaches the
device. To prove it: `adb install -r app-release.apk` and the toggle works.

For a test team, either have them clear the restriction once via the ⋮ menu, or
publish to a **Play internal testing track**, which removes the step entirely.

The `-i com.android.vending` flag on `adb install` is a **development
convenience only**. It must never appear in a release process, and it changes
nothing for users installing from the Play Store.

---

## 1. Architecture

**JS drives, native renders.**

```text
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

**A radial arc on a fixed canvas, not a horizontal row.** The satellites used to
be a `LinearLayout` sibling *to the left of* the anchor inside a `WRAP_CONTENT`
window pinned `TOP|START`. Expanding added 162dp to the row's left edge, which
shoved the anchor 162dp right without changing `params.x` — so at the right edge
the anchor drew past the screen and `FLAG_LAYOUT_NO_LIMITS` stopped Android
clamping it. The window is now a fixed square canvas centred on the anchor, and
satellites are placed by `translationX/Y` on an arc, so **expanding never moves
the anchor**. The window carries two sizes: 60dp collapsed, so a transparent
square never swallows taps, and the full canvas when expanded or showing a
message.

**Bounds are structural, not clamped.** `OverlayRadialGeometry` picks the arc
direction from which half of the screen the anchor sits in, biases the fan away
from the top or bottom edge, and then — if the fan would still exit the display —
translates **all three satellites by one common offset**. A rigid translation
keeps the arc's shape exactly intact while guaranteeing every button stays on
screen. That is why the geometry is a separate pure object: it is ported
verbatim into `scripts/test-overlay-geometry.mjs` and asserted from every corner,
edge midpoint and the centre.

**One gesture owner, hit-tested taps.** Satellites previously carried
`setOnClickListener`, which makes a view clickable, so it consumed `ACTION_DOWN`
and owned the whole gesture — and since `bubble` was its *sibling*, not an
ancestor, the drag listener never saw the event. That is why only the M could be
dragged. Now a single `OnTouchListener` on the canvas root hit-tests the press
target and decides tap versus drag once, so the whole widget drags from any of
its four circles. The arc is deliberately **not** collapsed while dragging.

**Refusals are spoken, not swallowed.** `resolveCommand` always returned a
`reason`, but `handleCommand` destructured only `method` and then called
`publish()` — which produced a byte-identical snapshot that
`DictationOverlayBridge.publish` de-duped on data-class equality. Zero pixels
changed, which is exactly why Play looked dead. The reason now drives a fading
message strip under the bubble.

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
`npm run icons` after changing the source logo. That script needs **Python 3 with
Pillow** (`pip install Pillow`) on PATH — it is a one-off authoring tool, not part
of the build, and it fails with that instruction if either is missing.

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

```text
Idle → Recording → Paused → Processing → Review → Completed
```

`overlayPresenter.resolvePhase` maps `RECORDING_STATE` × `CONSULTATION_STAGE` ×
pipeline status onto a phase. A pending refinement or translation holds the
overlay in **Processing** even after the recorder has settled, so the doctor is
not offered a review of a transcript that is still being produced.

That inference is gated on a session having actually run — `PROCESSING`/`SUCCESS`
status or the review stage. Without the gate, a `PENDING` flag left behind by an
interrupted session promoted a completely **idle** bubble to Processing, which
attached the transcript panel *and* started the rotating messages the moment the
bubble appeared, before Play was ever pressed. The native side was already
correct: `showsTranscript` excludes idle and `startRotation()` is gated on
`PHASE_PROCESSING`. Only the phase was lying.

The transcript body shows `Listening…` while the phase is recording and no text
has arrived yet, so the doctor can tell the microphone is live before speaking.
The first partial replaces it.

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

**38 suites, 2517 assertions, all green.** Seven suites are new:

| Suite | Covers |
|---|---|
| `test-background-teardown.mjs` | the backgrounding predicates — the regression test for the fixed bug |
| `test-overlay-state.mjs` | every status × stage → phase, processing detail, transcript truncation, capability flags, and that a stale pending flag never wakes an idle bubble |
| `test-overlay-commands.mjs` | command routing: pause refused unless recording, play routed to the app when it cannot start in place |
| `test-overlay-handoff.mjs` | queue → flush → consume-once, and the translation-readiness gate |
| `test-bubble-settings.mjs` | the toggle's persistence, including the absent-value default and DB-error fallback |
| `test-consultation-launcher.mjs` | the full headless-vs-open-app truth table, and that every open-app plan names a cause and a route |
| `test-overlay-geometry.mjs` | the arc maths ported verbatim from Kotlin: direction, vertical bias, and every button on screen from nine anchor positions |

Build verified: `assembleDebug` succeeds for `arm64-v8a`, the codegen spec
contains `emitOnOverlayCommand` and `showOverlayMessage`, and the merged manifest
carries all five new permissions plus
`foregroundServiceType="specialUse|microphone"`.

### Device checklist

1. **Diagnose first:** tap **Home**. If MedScribe opens, the native→JS chain is
   alive and any Play failure is routing. If Home does nothing either, the
   headless task never attached — check the overlay diagnostics.
2. Fresh install → onboarding asks for the **microphone**, then the overlay. Deny
   each once to see the explanation and the settings route, then grant both.
3. Bubble appears → **no transcript panel and no processing messages** while idle.
4. Tap Play → starts in place, bubble turns red, panel shows **Listening…**, the
   app never opens.
5. Speak → the placeholder is replaced by live partial text.
6. Tap Stop → **only now** do the rotating processing messages run → review sheet.
7. Drag from the **Play**, **Stop** and **Home** circles, not just the M — the
   whole widget moves and the arc keeps its shape.
8. Park at each edge and corner, expand → all three buttons fully visible.
9. Tap Stop while idle → the message strip explains instead of nothing happening.
10. Leave MedScribe mid-session; confirm the transcript keeps growing and the
    timer advances for five minutes.
11. Pause, switch apps, Resume — same session continues.
12. Save changes → Generate report → MedScribe opens on a populated Report.
13. Repeat 12 after force-stopping MedScribe (cold handover).
14. Cross-over: start in the app, stop from the bubble — and the reverse.
15. Confirm the recogniser's tones stay muted for a whole backgrounded session.
16. Repeat on at least one MIUI and one ColorOS device.

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
  an unfinished consultation routes Play into the app rather than starting a
  second session. That is deliberate — silently clearing the row would discard a
  doctor's unfinished consultation, so the decision is handed to the existing
  `SessionRecoveryModal`.
- **An overlay tap has no Activity**, so it can never raise a runtime permission
  prompt. Play therefore falls back to opening MedScribe at `Recording`, where
  `useSpeechRecognition.beginSession` does the requesting. Onboarding asks for the
  microphone up front specifically so this fallback is rare rather than the normal
  first-run path.
- **Headless Play needs the shared mic.** `shouldContinueRef` and the recogniser
  subscription live inside `useSpeechRecognition`, so a device where
  `SharedMicModule.isSupported()` is false always routes through the app. On
  shared-mic devices those are already dead code, so nothing is lost.
- **The overlay is Android-only.** Every call degrades to a no-op on iOS through
  the lazy-require wrapper.
- **Not yet built:** a level meter driven by real RMS, richer processing
  animation, and localisation of the overlay strings (they are currently English
  in `strings.xml` while the app's spoken prompts are already multilingual).
