/**
 * Audio feedback for dictation (isolation layer over the AudioCue TurboModule).
 *
 * The problem this solves: Android's SpeechRecognizer is single-utterance, so
 * continuous dictation restarts it after every sentence, and the system
 * RecognitionService plays its own start and end tone on each of those
 * sessions. A doctor dictating a consultation hears a beep pair between every
 * sentence, which is exactly the complaint this module exists to fix.
 *
 * Those tones come from a system process, so they cannot be disabled through
 * SpeechRecognizer. The native module mutes the streams that carry them for the
 * duration of the session instead, and we play one deliberate cue of our own at
 * the two moments that actually mean something to the doctor:
 *
 *   session start  -> one cue, then mute after a short grace window
 *   resume         -> one cue, then mute again
 *   pause / stop    -> restore the streams, after a delay so the recognizer's
 *                      trailing end tone is swallowed too
 *
 * Every method is a no-op when the native module is absent — a JS-only reload,
 * a build without the module, or iOS — so dictation keeps working and simply
 * beeps the way it used to.
 */

/**
 * Cue plays, then this long until the streams are muted. Long enough that the
 * cue and the recognizer's start tone are heard as one event.
 */
export const CUE_GRACE_MS = 450;

/**
 * Streams stay muted this long after pause/stop so the trailing end tone from
 * the recognizer teardown is not heard.
 */
export const RESTORE_DELAY_MS = 500;

/**
 * The native watchdog restores the streams if JS never calls back. Re-armed on
 * every suppress(), so a wedged JS thread self-heals within this window.
 */
export const MUTE_WATCHDOG_MS = 120000;

/**
 * How often the suppression is re-armed while a session is live. Comfortably
 * inside `MUTE_WATCHDOG_MS`, so the native watchdog only ever fires when this
 * side has genuinely stopped running.
 */
export const REARM_INTERVAL_MS = 60000;

let nativeModule;
let resolved = false;

/**
 * Resolved lazily rather than at import time: the spec uses `getEnforcing`,
 * which throws when the native side is missing. Same reasoning as `pdfService`.
 */
function audioCue() {
  if (!resolved) {
    resolved = true;
    try {
      nativeModule = require('../specs/NativeAudioCue').default;
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
}

export function isAvailable() {
  return !!audioCue();
}

class AudioFeedbackService {
  constructor() {
    this.enabled = true;
    this.muteTimer = null;
    this.restoreTimer = null;
    this.rearmTimer = null;
  }

  clearTimers() {
    if (this.muteTimer) {
      clearTimeout(this.muteTimer);
      this.muteTimer = null;
    }
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }
    if (this.rearmTimer) {
      clearInterval(this.rearmTimer);
      this.rearmTimer = null;
    }
  }

  playCue(kind) {
    if (!this.enabled) {
      return;
    }
    audioCue()
      ?.playCue(kind)
      .catch(() => {
        // A cue is a nicety. Never let it interrupt a consultation.
      });
  }

  /**
   * One cue, then silence: plays the tone, then mutes the recognizer's streams
   * once the grace window has passed. Used for session start and resume, the
   * only two moments the doctor needs an audible confirmation.
   */
  cueThenSuppress(kind) {
    // A pause schedules the restore RESTORE_DELAY_MS out. Resuming inside that
    // window would otherwise only cancel it, leaving the streams muted — and the
    // cue below plays on one of them, so the doctor would hear nothing.
    if (this.restoreTimer) {
      this.restoreNow();
    }

    this.clearTimers();
    this.playCue(kind);

    this.muteTimer = setTimeout(() => {
      this.muteTimer = null;
      this.suppress();
      // The native watchdog restores unconditionally after MUTE_WATCHDOG_MS, so
      // a session longer than that would start beeping again mid-consultation.
      // Re-arming on a shorter interval keeps it permanently deferred, and the
      // watchdog still fires promptly if this JS thread ever stops running.
      this.rearmTimer = setInterval(() => this.suppress(), REARM_INTERVAL_MS);
    }, CUE_GRACE_MS);
  }

  suppress() {
    const module = audioCue();
    if (!module) {
      return;
    }
    module.suppressSystemTones(MUTE_WATCHDOG_MS).catch(() => {
      // Nothing to undo: the native side restores on its own failure path.
    });
  }

  /**
   * Restores after a short delay so the recognizer's own end tone, which fires
   * as it tears down, is still muted when it plays.
   */
  scheduleRestore() {
    this.clearTimers();
    if (!audioCue()) {
      return;
    }
    this.restoreTimer = setTimeout(() => {
      this.restoreTimer = null;
      this.restoreNow();
    }, RESTORE_DELAY_MS);
  }

  /** Immediate, unconditional restore. Unmount, backgrounding and errors. */
  restoreNow() {
    this.clearTimers();
    const module = audioCue();
    if (!module) {
      return;
    }
    module.restoreSystemTones().catch(() => {
      // The native watchdog, the lifecycle listener and the launch-time
      // SharedPreferences check all still stand behind this.
    });
  }

  playStartCue() {
    this.cueThenSuppress('start');
  }

  playResumeCue() {
    this.cueThenSuppress('resume');
  }

  playPauseCue() {
    this.scheduleRestore();
  }

  playStopCue() {
    // No tone on stop: the screen already moves to transcript review, so the
    // part that matters here is giving the doctor their volume back.
    this.scheduleRestore();
  }
}

export const audioFeedbackService = new AudioFeedbackService();
export default audioFeedbackService;