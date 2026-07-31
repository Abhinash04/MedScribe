import { RECORDING_STATE } from '../constants/recordingStates';
import * as speech from './speechService';
import audioFeedbackService from './audioFeedbackService';
import { saveSessionDebounced, clearActiveSession } from './sessionPersistenceService';
import useRecordingStore from '../store/useRecordingStore';
import { extractPatientFields } from './extractionService';

/**
 * Dictation Session Manager (Orchestrator).
 *
 * Central orchestrator connecting the Speech Engine, Store, Audio Feedback,
 * Session Persistence, and Live Entity Extraction. UI components interact
 * with this orchestrator.
 */

class DictationSessionManager {
  constructor() {
    this.timerId = null;
    this.extractDebounceId = null;
  }

  /**
   * Starts a new dictation session or begins recording.
   */
  async startSession() {
    const store = useRecordingStore.getState();
    audioFeedbackService.playStartCue();
    this.startTimer();
    store.setStatus(RECORDING_STATE.LISTENING);
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

    try {
      await speech.stop();
    } catch (e) {
      // Ignored
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

    try {
      await speech.stop();
    } catch (e) {
      // Ignored
    }

    // Run immediate final live entity extraction
    this.runLiveExtraction();
    this.persistCurrentSession();
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
      const fullTranscript = store.segments.map(s => s.text).join(' ').trim();
      if (!fullTranscript) return;

      const extracted = extractPatientFields(fullTranscript);
      store.setLiveExtractedFields(extracted);
    } catch (err) {
      console.warn('[dictationSessionManager] Live extraction warning:', err);
    }
  }

  /**
   * Persists session to database asynchronously.
   */
  persistCurrentSession() {
    const store = useRecordingStore.getState();
    saveSessionDebounced({
      id: store.sessionId,
      segments: store.segments,
      liveExtractedFields: store.liveExtractedFields,
      durationSeconds: store.durationSeconds,
    });
  }

  /**
   * Clears saved session when report generation completes or user discards.
   */
  async clearSession() {
    const store = useRecordingStore.getState();
    await clearActiveSession(store.sessionId);
  }
}

export const dictationSessionManager = new DictationSessionManager();
export default dictationSessionManager;
