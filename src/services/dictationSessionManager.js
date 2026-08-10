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
  beginPass,
  clearRefinementState,
  refineTranscript,
} from './transcriptRefinement';
import { ERROR_KIND } from './anuvadini/proxyContract';
import { CAPTURE_OUTCOME, decideCaptureOutcome } from './captureOutcome';
import useRecordingStore, {
  selectFullTranscript,
} from '../store/useRecordingStore';
import { extractPatientFields } from './extractionService';

const SAMPLE_RATE_HZ = 16000;
const RECOGNITION_LANGUAGE = 'en-IN';
const SHARED_MIC_POLL_MS = 400;
const SHARED_MIC_RETRY_DELAY_MS = 400;
const SHARED_MIC_START_ATTEMPTS = 3;
const rmsToLevel = rms => Math.max(0, Math.min(10, ((rms ?? 0) / 3000) * 10));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const describeNativeError = error =>
  `${error?.code ?? 'no-code'}: ${error?.message ?? error}`;

class DictationSessionManager {
  constructor() {
    this.timerId = null;
    this.extractDebounceId = null;
    this.lastExtractedTranscript = '';
    this.sharedMicActive = false;
    this.sharedMicPollId = null;
    this.lastSharedText = '';
    this.passIndex = 0;
    this.appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        flushPendingSave().catch(() => {});
      }
    });
    consultationAudio.purgeAbandoned().catch(() => {});
  }

  async startSession() {
    const store = useRecordingStore.getState();
    this.lastExtractedTranscript = '';
    store.setCaptureUnavailable(false);
    audioFeedbackService.playStartCue();
    this.startTimer();
    store.setStatus(RECORDING_STATE.LISTENING);

    if (!isCaptureEnabled()) {
      return;
    }

    if (!(await sharedMic.isSupported())) {
      console.warn(
        '[dictationSessionManager] shared mic not supported on this device; ' +
          'this dictation will have no audio to refine',
      );
      store.setCaptureUnavailable(true);
      return;
    }

    beginPass();
    await this.startSharedMic(store.sessionId);
  }

  async startSharedMic(sessionId) {
    this.passIndex += 1;
    const name = `${sessionId}-${this.passIndex}`;

    for (let attempt = 1; attempt <= SHARED_MIC_START_ATTEMPTS; attempt += 1) {
      try {
        await sharedMic.start(SAMPLE_RATE_HZ, name, RECOGNITION_LANGUAGE, true);
        this.sharedMicActive = true;
        this.lastSharedText = '';
        this.startSharedMicPolling();
        return true;
      } catch (error) {
        console.warn(
          `[dictationSessionManager] shared mic start attempt ${attempt}/` +
            `${SHARED_MIC_START_ATTEMPTS} failed — ${describeNativeError(error)}`,
        );
        if (attempt === SHARED_MIC_START_ATTEMPTS) {
          break;
        }
        try {
          await sharedMic.stop();
        } catch {}
        await wait(SHARED_MIC_RETRY_DELAY_MS);
      }
    }

    console.warn(
      '[dictationSessionManager] shared mic unavailable; recognizer runs alone ' +
        'and this dictation will have no audio to refine',
    );
    this.sharedMicActive = false;
    useRecordingStore.getState().setCaptureUnavailable(true);
    return false;
  }

  usesSharedMic() {
    return this.sharedMicActive;
  }

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
      speech.amplitudeShared.value = rmsToLevel(state.lastRms);
    }, SHARED_MIC_POLL_MS);
  }

  stopSharedMicPolling() {
    if (this.sharedMicPollId) {
      clearInterval(this.sharedMicPollId);
      this.sharedMicPollId = null;
    }
  }

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
      let final = null;
      try {
        final = await sharedMic.stop();
      } catch (error) {
        console.warn(
          '[dictationSessionManager] shared mic stop failed:',
          error?.message ?? error,
        );
      }
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

    if (this.extractDebounceId) {
      clearTimeout(this.extractDebounceId);
      this.extractDebounceId = null;
    }
    useRecordingStore
      .getState()
      .setNativeRaw(selectFullTranscript(useRecordingStore.getState()));

    this.runLiveExtraction();
    this.persistCurrentSession();
    captured = captured ?? (await consultationAudio.finish());

    const outcome = decideCaptureOutcome({
      path: captured?.path,
      withinBudget: captured?.withinBudget,
      transcriptionAvailable: isTranscriptionAvailable(),
    });

    if (outcome === CAPTURE_OUTCOME.REFINE) {
      refineTranscript().catch(() => {});
      return outcome;
    }

    if (outcome === CAPTURE_OUTCOME.NO_AUDIO) {
      useRecordingStore
        .getState()
        .setAnuvadiniResult({ ok: false, errorKind: ERROR_KIND.NO_AUDIO });
      return outcome;
    }

    if (outcome === CAPTURE_OUTCOME.TOO_LARGE) {
      useRecordingStore
        .getState()
        .setAnuvadiniResult({
          ok: false,
          errorKind: ERROR_KIND.AUDIO_TOO_LARGE,
        });
    }

    if (captured?.path) {
      await consultationAudio.discard();
    }

    return outcome;
  }

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

  dispose() {
    this.stopTimer();
    if (this.extractDebounceId) {
      clearTimeout(this.extractDebounceId);
      this.extractDebounceId = null;
    }
  }

  onSegmentReceived(text, confidence = 1.0) {
    const store = useRecordingStore.getState();
    store.appendSegment({ text, confidence });

    this.persistCurrentSession();
    this.scheduleLiveExtraction();
  }

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

  async persistNow() {
    this.persistCurrentSession();
    await flushPendingSave();
  }

  async clearSession() {
    const store = useRecordingStore.getState();
    await clearActiveSession(store.sessionId);
    clearRefinementState();
    this.passIndex = 0;
    await consultationAudio.discard();
  }
}

export const dictationSessionManager = new DictationSessionManager();
export default dictationSessionManager;
