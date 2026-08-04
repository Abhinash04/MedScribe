import { AppState } from 'react-native';
import { RECORDING_STATE } from '../constants/recordingStates';
import * as speech from './speechService';
import audioFeedbackService from './audioFeedbackService';
import {
  clearActiveSession,
  flushPendingSave,
  saveSessionDebounced,
} from './sessionPersistenceService';
import * as consultationAudio from './consultationAudio';
import * as sharedMic from './sharedMicService';
import { isCaptureEnabled, isTranscriptionAvailable } from '../config/features';
import {
  beginContinuation,
  clearContinuation,
  refineTranscript,
} from './transcriptRefinement';
import useRecordingStore, {
  selectFullTranscript,
} from '../store/useRecordingStore';
import { extractPatientFields } from './extractionService';

/**
 * Dictation Session Manager (Orchestrator).
 *
 * Central orchestrator connecting the Speech Engine, Store, Audio Feedback,
 * Session Persistence, and Live Entity Extraction. UI components interact
 * with this orchestrator.
 */

const SAMPLE_RATE_HZ = 16000;
const RECOGNITION_LANGUAGE = 'en-IN';
const SHARED_MIC_POLL_MS = 400;

/**
 * The vendor recognizer reports roughly -2..10 for silence..loud speech, and
 * the visualizer is tuned to that. PCM RMS is 0..32767, so it is mapped onto
 * the same range rather than giving the waveform a scale it cannot draw.
 */
const rmsToLevel = rms => Math.max(0, Math.min(10, ((rms ?? 0) / 3000) * 10));

class DictationSessionManager {
  constructor() {
    this.timerId = null;
    this.extractDebounceId = null;
    this.lastExtractedTranscript = '';
    this.sharedMicActive = false;
    this.sharedMicPollId = null;
    this.lastSharedText = '';
    // The two-second debounce is exactly long enough to lose the last edit to
    // a process the OS kills while the app sits in the background.
    this.appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        flushPendingSave().catch(() => {});
      }
    });
    // Patient audio an interrupted app left behind must not accumulate.
    consultationAudio.purgeAbandoned().catch(() => {});
  }

  /**
   * Starts a new dictation session or begins recording.
   */
  async startSession() {
    const store = useRecordingStore.getState();
    // A new session starts from no extraction history, so an identical
    // transcript in a later consultation is not mistaken for "unchanged".
    this.lastExtractedTranscript = '';
    audioFeedbackService.playStartCue();
    this.startTimer();
    store.setStatus(RECORDING_STATE.LISTENING);

    // One dictation, two outputs: the recognizer produces live text while the
    // same speech is written to a WAV for the alternative transcription. Whether
    // the two can share the microphone is a per-device question, so a failure
    // to start capture is silent — the consultation continues on native alone.
    if (isCaptureEnabled() && (await sharedMic.isSupported())) {
      // A later pass captures only the new speech, so its transcript extends
      // the earlier one rather than replacing it. The snapshot is taken here,
      // as the continuation is recorded, so it holds the draft exactly as the
      // doctor left it — corrections included.
      if (store.anuvadini?.text) {
        beginContinuation();
      }
      await this.startSharedMic(store.sessionId);
    }
  }

  /**
   * One microphone feeding both the recognizer and the recording.
   *
   * Returns whether it took over. When it does, the vendor recognizer must stay
   * out of the way — a second client would starve this one, which is the
   * contention the device measurements established.
   */
  async startSharedMic(sessionId) {
    try {
      await sharedMic.start(SAMPLE_RATE_HZ, sessionId, RECOGNITION_LANGUAGE, true);
      this.sharedMicActive = true;
      this.lastSharedText = '';
      this.startSharedMicPolling();
      return true;
    } catch (error) {
      console.warn('[dictationSessionManager] shared mic unavailable:', error?.message);
      this.sharedMicActive = false;
      return false;
    }
  }

  usesSharedMic() {
    return this.sharedMicActive;
  }

  /**
   * The module reports state rather than emitting events, so the live
   * transcript is polled. Partials arrive continuously; a segmented session
   * delivers its final text only when the audio closes.
   */
  startSharedMicPolling() {
    this.stopSharedMicPolling();
    this.sharedMicPollId = setInterval(async () => {
      const state = await sharedMic.getState();
      if (!state) {
        return;
      }
      const store = useRecordingStore.getState();
      store.setPartial(state.partial ?? '');
      this.absorbSharedText(state.text);
      // The visualizer reads the same shared value the vendor recognizer feeds,
      // so it keeps animating on whichever engine holds the microphone.
      speech.amplitudeShared.value = rmsToLevel(state.lastRms);
    }, SHARED_MIC_POLL_MS);
  }

  stopSharedMicPolling() {
    if (this.sharedMicPollId) {
      clearInterval(this.sharedMicPollId);
      this.sharedMicPollId = null;
    }
  }

  /** Appends only what is new, so a poll cannot duplicate an utterance. */
  absorbSharedText(text) {
    const full = (text ?? '').trim();
    if (!full || full === this.lastSharedText) {
      return;
    }
    const addition = full.startsWith(this.lastSharedText)
      ? full.slice(this.lastSharedText.length).trim()
      : full;
    this.lastSharedText = full;
    if (addition) {
      useRecordingStore.getState().appendSegment({ text: addition });
      this.scheduleLiveExtraction();
    }
  }

  /**
   * Pauses the active dictation session.
   */
  async pauseSession() {
    const store = useRecordingStore.getState();
    this.stopTimer();
    audioFeedbackService.playPauseCue();
    store.setStatus(RECORDING_STATE.PAUSED);
    store.setPartial('');
    speech.amplitudeShared.value = 0;

    if (this.sharedMicActive) {
      await sharedMic.pause();
    } else {
      try {
        await speech.stop();
      } catch (error) {
        console.warn('[dictationSessionManager] Pause stop warning:', error);
      }
      await consultationAudio.pause();
    }

    this.persistCurrentSession();
  }

  /**
   * Resumes dictation from a paused state.
   */
  async resumeSession() {
    const store = useRecordingStore.getState();
    audioFeedbackService.playResumeCue();
    this.startTimer();
    store.setStatus(RECORDING_STATE.LISTENING);
    if (this.sharedMicActive) {
      await sharedMic.resume();
    } else {
      await consultationAudio.resume();
    }
  }

  /**
   * Finalizes and stops the dictation session.
   */
  async stopSession() {
    const store = useRecordingStore.getState();
    audioFeedbackService.playStopCue();
    this.stopTimer();
    store.setPartial('');
    speech.amplitudeShared.value = 0;
    store.setStatus(RECORDING_STATE.PROCESSING);

    let captured = null;

    if (this.sharedMicActive) {
      this.stopSharedMicPolling();
      // A segmented session delivers its transcript when the audio closes, so
      // the authoritative text is whatever stop() comes back with.
      const final = await sharedMic.stop();
      this.sharedMicActive = false;
      if (final) {
        this.absorbSharedText(final.text);
        captured = consultationAudio.adopt(final.path, final.bytes);
      }
    } else {
      try {
        await speech.stop();
      } catch (error) {
        console.warn('[dictationSessionManager] Stop warning:', error);
      }
    }

    // Cancel the queued run first: a debounced extraction landing after
    // clearSession() would repopulate liveExtractedFields for a session that
    // no longer exists.
    if (this.extractDebounceId) {
      clearTimeout(this.extractDebounceId);
      this.extractDebounceId = null;
    }
    // Frozen before the review screen can offer an editor, so the comparison
    // baseline is always the recognizer's own words.
    useRecordingStore.getState().setNativeRaw(selectFullTranscript(useRecordingStore.getState()));

    this.runLiveExtraction();
    this.persistCurrentSession();

    // The doctor moves on to the transcript review immediately; the alternative
    // transcription runs behind them and reports into the store when it lands.
    captured = captured ?? (await consultationAudio.finish());
    // No endpoint means the recording has no purpose, so it is not kept.
    if (captured?.path && captured.withinBudget && isTranscriptionAvailable()) {
      refineTranscript().catch(() => {});
    } else if (captured?.path) {
      await consultationAudio.discard();
    }
  }

  /**
   * Timer management.
   */
  startTimer() {
    this.stopTimer();
    this.timerId = setInterval(() => {
      const store = useRecordingStore.getState();
      if (store.status === RECORDING_STATE.LISTENING) {
        store.incrementDuration();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Drops every timer this singleton owns. Called from the recording screen's
   * teardown — the manager outlives the screen, so anything left running here
   * leaks for the rest of the app's life.
   */
  dispose() {
    this.stopTimer();
    if (this.extractDebounceId) {
      clearTimeout(this.extractDebounceId);
      this.extractDebounceId = null;
    }
  }

  /**
   * Handles incoming segment text and triggers debounced persistence and extraction.
   */
  onSegmentReceived(text, confidence = 1.0) {
    const store = useRecordingStore.getState();
    store.appendSegment({ text, confidence });

    this.persistCurrentSession();
    this.scheduleLiveExtraction();
  }

  /**
   * Debounced background live entity extraction.
   */
  scheduleLiveExtraction() {
    if (this.extractDebounceId) {
      clearTimeout(this.extractDebounceId);
    }
    this.extractDebounceId = setTimeout(() => {
      this.extractDebounceId = null;
      this.runLiveExtraction();
    }, 1500);
  }

  runLiveExtraction() {
    try {
      const store = useRecordingStore.getState();
      // Shared selector rather than a local join, so the live preview and the
      // report always read the transcript the same way.
      const fullTranscript = selectFullTranscript(store);
      if (!fullTranscript || fullTranscript === this.lastExtractedTranscript) {
        return;
      }

      const extracted = extractPatientFields(fullTranscript);
      this.lastExtractedTranscript = fullTranscript;
      store.setLiveExtractedFields(extracted);
    } catch (err) {
      console.warn('[dictationSessionManager] Live extraction warning:', err);
    }
  }

  /**
   * Persists the whole consultation — transcript, draft, manual edits and the
   * stage the doctor reached — so recovery can reopen where they left off.
   */
  persistCurrentSession() {
    const store = useRecordingStore.getState();
    saveSessionDebounced({
      id: store.sessionId,
      segments: store.segments,
      liveExtractedFields: store.liveExtractedFields,
      durationSeconds: store.durationSeconds,
      draft: store.reportDraft,
      stage: store.stage,
      createdAt: store.createdAt,
      anuvadiniTranscript: store.anuvadini,
      transcriptSource: store.transcriptSource,
      nativeRaw: store.nativeRaw,
    });
  }

  /** Writes now rather than in two seconds — used at stage boundaries. */
  async persistNow() {
    this.persistCurrentSession();
    await flushPendingSave();
  }

  /**
   * Clears saved session when report generation completes or user discards.
   */
  async clearSession() {
    const store = useRecordingStore.getState();
    await clearActiveSession(store.sessionId);
    // The audio a continuation would have retried with is going away, so the
    // snapshot that belonged to it must not outlive the consultation.
    clearContinuation();
    await consultationAudio.discard();
  }
}

export const dictationSessionManager = new DictationSessionManager();
export default dictationSessionManager;
