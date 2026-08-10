export const CUE_GRACE_MS = 450;
export const RESTORE_DELAY_MS = 500;
export const MUTE_WATCHDOG_MS = 120000;
export const REARM_INTERVAL_MS = 60000;

let nativeModule;
let resolved = false;

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

  async playSpeech(audioBase64) {
    const module = audioCue();
    if (!module || !audioBase64) {
      return false;
    }
    try {
      return await module.playSpeech(audioBase64);
    } catch {
      return false;
    }
  }

  async stopSpeech() {
    try {
      await audioCue()?.stopSpeech();
    } catch {
      // Stopping something that is not playing is not a failure.
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

  cueThenSuppress(kind) {
    if (this.restoreTimer) {
      this.restoreNow();
    }

    this.clearTimers();
    this.playCue(kind);

    this.muteTimer = setTimeout(() => {
      this.muteTimer = null;
      this.suppress();
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

  restoreNow() {
    this.clearTimers();
    const module = audioCue();
    if (!module) {
      return;
    }
    module.restoreSystemTones().catch(() => {});
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
    this.scheduleRestore();
  }
}

export const audioFeedbackService = new AudioFeedbackService();
export default audioFeedbackService;
