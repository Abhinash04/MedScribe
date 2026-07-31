import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import {
  DEFAULT_ERROR_MESSAGE,
  FINALIZE_TIMEOUT_MS,
  MAX_CONSECUTIVE_TRANSIENT_ERRORS,
  RECORDING_STATE,
  RESTART_DELAY_MS,
  SPEECH_ERROR_CODE,
  SPEECH_ERROR_MESSAGES,
  backoffDelay,
  isTransientError,
  resolveErrorMessage,
} from '../constants/recordingStates';
import {
  RESULTS,
  checkMicPermission,
  isGranted,
  openAppSettings,
  requestMicPermission,
  toRecordingState,
} from '../services/permissionService';
import * as speech from '../services/speechService';
import audioFeedbackService from '../services/audioFeedbackService';
import dictationSessionManager from '../services/dictationSessionManager';
import useRecordingStore, {
  selectFullTranscript,
} from '../store/useRecordingStore';

const NO_SPEECH_MESSAGE =
  'No speech detected. Check that your microphone is working and try again.';

/**
 * Owns the whole dictation session: permission flow, recognizer lifecycle,
 * the continuous auto-restart loop, and teardown (SRS FR-2, FR-3, NFR-4).
 *
 * Android's SpeechRecognizer is single-utterance — it ends on the first pause.
 * Since a doctor dictating patient details pauses constantly, this hook
 * restarts the recognizer after every utterance and accumulates the results
 * as chunks. Only an explicit stop(), an unmount, or backgrounding ends the
 * session.
 */
export default function useSpeechRecognition({
  autoStart = true,
  keepTranscript = false,
} = {}) {
  const status = useRecordingStore(state => state.status);
  const partialText = useRecordingStore(state => state.partialText);
  const errorMessage = useRecordingStore(state => state.errorMessage);

  const setStatus = useRecordingStore(state => state.setStatus);
  const setPartial = useRecordingStore(state => state.setPartial);
  const setError = useRecordingStore(state => state.setError);
  const reset = useRecordingStore(state => state.reset);

  // Amplitude is intentionally absent: it is written directly to a Reanimated
  // shared value by speechService. Subscribing to it here re-rendered this
  // hook's consumers 10-20x/second and was the cause of the 2-3s transcript lag.
  const resetAmplitude = useCallback(() => {
    speech.amplitudeShared.value = 0;
  }, []);

  // Uses the shared selector rather than re-deriving the join/trim, so the
  // transcript stays consistent with what ReportScreen reads.
  const transcript = useRecordingStore(selectFullTranscript);

  const mountedRef = useRef(false);
  const shouldContinueRef = useRef(false);
  const isListeningRef = useRef(false);
  const restartTimerRef = useRef(null);
  const finalizeTimerRef = useRef(null);
  const consecutiveTransientRef = useRef(0);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearRestartTimer();
    clearFinalizeTimer();
  }, [clearRestartTimer, clearFinalizeTimer]);

  /**
   * True once the session has landed somewhere the user must act on.
   * The recognizer can emit trailing events after teardown; without this
   * guard a stray NO_MATCH could flip a PERMISSION_BLOCKED screen to SUCCESS.
   */
  const isSettled = useCallback(() => {
    const current = useRecordingStore.getState().status;
    return (
      current === RECORDING_STATE.SUCCESS ||
      current === RECORDING_STATE.ERROR ||
      current === RECORDING_STATE.PERMISSION_DENIED ||
      current === RECORDING_STATE.PERMISSION_BLOCKED ||
      current === RECORDING_STATE.UNAVAILABLE
    );
  }, []);

  /** Settles the session on SUCCESS and stops every animation input. */
  const finalize = useCallback(() => {
    clearTimers();
    isListeningRef.current = false;

    if (isSettled()) {
      return;
    }

    setPartial('');
    resetAmplitude();
    setStatus(RECORDING_STATE.SUCCESS);
  }, [clearTimers, isSettled, setPartial, resetAmplitude, setStatus]);

  const safeStart = useCallback(async () => {
    if (!mountedRef.current || !shouldContinueRef.current) {
      return;
    }

    try {
      await speech.start();
      isListeningRef.current = true;
      if (mountedRef.current) {
        setStatus(RECORDING_STATE.LISTENING);
      }
    } catch (error) {
      const code = String(error?.code ?? '');

      // The recognizer is already running — the loop is healthy, not broken.
      if (code === 'ALREADY_LISTENING') {
        isListeningRef.current = true;
        return;
      }

      shouldContinueRef.current = false;
      isListeningRef.current = false;

      if (!mountedRef.current) {
        return;
      }

      if (code === 'PERMISSION_DENIED') {
        setStatus(RECORDING_STATE.PERMISSION_BLOCKED);
        return;
      }

      if (code === 'NOT_AVAILABLE') {
        setStatus(RECORDING_STATE.UNAVAILABLE);
        return;
      }

      setError(error?.message || DEFAULT_ERROR_MESSAGE);
    }
  }, [setStatus, setError]);

  /**
   * Queues exactly one delayed restart. The delay lets the native recognizer
   * finish tearing down — restarting synchronously yields RECOGNIZER_BUSY.
   */
  const scheduleRestart = useCallback(
    (delay = RESTART_DELAY_MS) => {
      if (!shouldContinueRef.current || !mountedRef.current) {
        return;
      }
      if (restartTimerRef.current) {
        return;
      }

      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        safeStart();
      }, delay);
    },
    [safeStart],
  );

  // --- Speech event handlers -------------------------------------------

  /**
   * The recognizer reported itself ready, so a session is demonstrably alive.
   *
   * ERROR_SERVER_DISCONNECTED (11) can fire spuriously on API 31+ and then the
   * same session proceeds normally. The restart queued by that error would
   * tear down this healthy session mid-utterance, so cancel it.
   */
  const handleStart = useCallback(() => {
    isListeningRef.current = true;
    clearRestartTimer();
  }, [clearRestartTimer]);

  /** Speech is actively being captured — same reasoning as handleStart. */
  const handleBegin = useCallback(() => {
    isListeningRef.current = true;
    clearRestartTimer();
  }, [clearRestartTimer]);

  const handleEnd = useCallback(() => {
    isListeningRef.current = false;
    resetAmplitude();

    // Results normally arrive right after end. If the session is still live,
    // get the recognizer back up; otherwise let stop()'s finalize path run.
    if (shouldContinueRef.current) {
      scheduleRestart();
    }
  }, [resetAmplitude, scheduleRestart]);

  const handleResults = useCallback(
    text => {
      isListeningRef.current = false;

      if (isSettled()) {
        return;
      }

      if (text) {
        dictationSessionManager.onSegmentReceived(text);
        consecutiveTransientRef.current = 0;
      }

      if (shouldContinueRef.current) {
        scheduleRestart();
      } else {
        finalize();
      }
    },
    [scheduleRestart, finalize, isSettled],
  );

  const handlePartialResults = useCallback(
    text => {
      if (!shouldContinueRef.current) {
        return;
      }

      // Interim text proves audio is decoding, so this session must not count
      // toward the "no speech detected" retry cap.
      if (text) {
        consecutiveTransientRef.current = 0;
      }

      setPartial(text);
    },
    [setPartial],
  );

  const handleError = useCallback(
    ({ code, message }) => {
      isListeningRef.current = false;
      resetAmplitude();

      // A trailing error after the session already resolved must not
      // overwrite the screen the user is looking at.
      if (isSettled()) {
        return;
      }

      if (code === SPEECH_ERROR_CODE.INSUFFICIENT_PERMISSIONS) {
        shouldContinueRef.current = false;
        clearTimers();
        setStatus(RECORDING_STATE.PERMISSION_BLOCKED);
        return;
      }

      // The user tapped Stop; a trailing NO_MATCH here just means the last
      // utterance was silence. Settle on what we already captured.
      if (!shouldContinueRef.current) {
        if (isTransientError(code)) {
          finalize();
        } else {
          clearTimers();
          setError(resolveErrorMessage(code), code);
        }
        return;
      }

      if (isTransientError(code)) {
        consecutiveTransientRef.current += 1;

        if (
          consecutiveTransientRef.current >= MAX_CONSECUTIVE_TRANSIENT_ERRORS
        ) {
          shouldContinueRef.current = false;
          clearTimers();
          setError(NO_SPEECH_MESSAGE, code);
          return;
        }

        // Back off progressively: hammering the recognizer at a fixed short
        // interval is what makes the system service disconnect in the first
        // place.
        scheduleRestart(backoffDelay(consecutiveTransientRef.current));
        return;
      }

      shouldContinueRef.current = false;
      clearTimers();
      // `resolveErrorMessage` always returns a string (it falls back to
      // DEFAULT_ERROR_MESSAGE), so `|| message` was dead code and the native
      // message was never surfaced. Prefer our copy when the code is mapped,
      // otherwise fall back to whatever the engine reported.
      setError(SPEECH_ERROR_MESSAGES[code] || message || resolveErrorMessage(code), code);
    },
    [
      resetAmplitude,
      setStatus,
      setError,
      clearTimers,
      scheduleRestart,
      finalize,
      isSettled,
    ],
  );

  // No volume handler: speechService writes RMS straight to a shared value.

  // --- Public actions ---------------------------------------------------

  /**
   * Runs the permission gate then starts dictating. Also used by the
   * "Grant access", "Try again" and "Record again" buttons.
   */
  const beginSession = useCallback(async (options) => {
    // `options` is often a press event (the retry / grant-access buttons pass
    // the handler straight to onPress), so the flag is read defensively.
    const resumeExisting = options?.keepTranscript === true;

    shouldContinueRef.current = false;
    clearTimers();
    // Resuming from the transcript review must not wipe what was dictated —
    // reset() clears segments, the duration and the session id alike.
    if (!resumeExisting) {
      reset();
    }
    consecutiveTransientRef.current = 0;
    setStatus(RECORDING_STATE.CHECKING_PERMISSION);

    // beginSession is called fire-and-forget from the mount effect, so an
    // unhandled rejection here would strand the UI on CHECKING_PERMISSION
    // with no button and no way out.
    let result;
    try {
      result = await checkMicPermission();
      if (result === RESULTS.DENIED) {
        result = await requestMicPermission();
      }
    } catch (error) {
      if (mountedRef.current) {
        setError(
          error?.message ||
            'Could not check microphone permission. Please try again.',
        );
      }
      return;
    }

    if (!mountedRef.current) {
      return;
    }

    if (!isGranted(result)) {
      setStatus(toRecordingState(result));
      return;
    }

    // No isRecognitionAvailable() pre-check here on purpose. It proved
    // unreliable — a transient rejection would strand the user on
    // "Speech recognition unavailable" despite a working recognizer being
    // installed. startListening() already rejects with NOT_AVAILABLE when the
    // engine is genuinely missing, and safeStart maps that to UNAVAILABLE, so
    // the real condition is still reported without the false positives.
    shouldContinueRef.current = true;
    // Goes through the manager rather than setStatus(LISTENING) directly: it
    // also plays the start cue and starts the duration timer. Calling it here
    // rather than in a wrapper covers the mount path, which is how every real
    // session begins.
    await dictationSessionManager.startSession();
    await safeStart();
  }, [clearTimers, reset, setStatus, setError, safeStart]);

  const stop = useCallback(async () => {
    // A paused session has already cleared shouldContinueRef, but it still has
    // to be stoppable — otherwise Stop from PAUSED leaves the UI in PROCESSING
    // with no finalize ever scheduled.
    const isPausedNow =
      useRecordingStore.getState().status === RECORDING_STATE.PAUSED;
    if (!shouldContinueRef.current && !isPausedNow) {
      return;
    }

    shouldContinueRef.current = false;
    clearRestartTimer();
    setPartial('');
    setStatus(RECORDING_STATE.PROCESSING);

    try {
      await speech.stop();
    } catch {
      // stopListening() resolves "Not listening" or rejects if the recognizer
      // already ended on its own. Either way the finalize path below settles.
    }

    // Guarantees the UI can never hang in PROCESSING waiting for a final
    // result that never arrives.
    clearFinalizeTimer();
    finalizeTimerRef.current = setTimeout(() => {
      finalizeTimerRef.current = null;
      if (mountedRef.current) {
        finalize();
      }
    }, FINALIZE_TIMEOUT_MS);
  }, [clearRestartTimer, clearFinalizeTimer, setPartial, setStatus, finalize]);

  // Ref indirection keeps the subscribe/teardown effect mount-only while the
  // handlers themselves stay current.
  const handlersRef = useRef({});
  handlersRef.current = {
    onStart: handleStart,
    onBegin: handleBegin,
    onEnd: handleEnd,
    onResults: handleResults,
    onPartialResults: handlePartialResults,
    onError: handleError,
  };

  const beginSessionRef = useRef(beginSession);
  beginSessionRef.current = beginSession;

  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = speech.subscribe({
      onStart: () => handlersRef.current.onStart?.(),
      onBegin: () => handlersRef.current.onBegin?.(),
      onEnd: () => handlersRef.current.onEnd?.(),
      onResults: text => handlersRef.current.onResults?.(text),
      onPartialResults: text => handlersRef.current.onPartialResults?.(text),
      onError: error => handlersRef.current.onError?.(error),
    });

    return () => {
      // Without this, leaving the screen mid-dictation leaves a live
      // recognizer holding the microphone and emitting into a dead component.
      mountedRef.current = false;
      shouldContinueRef.current = false;

      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }

      unsubscribe();
      // The duration timer lives on the manager singleton, so it outlives this
      // screen unless it is stopped here — leaving the screen any way other
      // than Stop would otherwise leak a 1 Hz interval for the app's lifetime.
      dictationSessionManager.stopTimer();
      // Muted audio streams must never outlive the screen that muted them.
      audioFeedbackService.restoreNow();
      // stop(), not destroy(). destroy() also clears the native listener map,
      // which left the module unusable on the next visit to this screen —
      // recognition could not restart without killing the app. stop() releases
      // the microphone, and startListening() re-initialises the recognizer on
      // the next session anyway.
      speech.stop().catch(() => {});
    };
  }, []);

  // Starting is a separate effect from subscribing so a caller can hold the
  // session back — RecordingScreen does that until the crash-recovery prompt
  // has been answered, otherwise beginSession's reset() would race the restore
  // and wipe the very transcript being recovered.
  const startedRef = useRef(false);
  const keepTranscriptRef = useRef(keepTranscript);
  keepTranscriptRef.current = keepTranscript;
  useEffect(() => {
    if (!autoStart || startedRef.current) {
      return;
    }
    startedRef.current = true;
    beginSessionRef.current({ keepTranscript: keepTranscriptRef.current });
  }, [autoStart]);

  // Release the microphone when the doctor switches apps mid-consultation.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        // Unconditional: the streams may be muted even when the session has
        // already settled, and a backgrounded app must not hold the volume down.
        audioFeedbackService.restoreNow();
      }
      if (nextState !== 'active' && shouldContinueRef.current) {
        stopRef.current();
      }
    });

    return () => subscription.remove();
  }, []);

  const durationSeconds = useRecordingStore(state => state.durationSeconds);
  const liveExtractedFields = useRecordingStore(
    state => state.liveExtractedFields,
  );
  const segments = useRecordingStore(state => state.segments);

  const pause = useCallback(async () => {
    if (!shouldContinueRef.current) {
      return;
    }
    shouldContinueRef.current = false;
    clearRestartTimer();
    await dictationSessionManager.pauseSession();
  }, [clearRestartTimer]);

  const resume = useCallback(async () => {
    shouldContinueRef.current = true;
    consecutiveTransientRef.current = 0;
    await dictationSessionManager.resumeSession();
    await safeStart();
  }, [safeStart]);

  const stopWithManager = useCallback(async () => {
    await dictationSessionManager.stopSession();
    await stop();
  }, [stop]);

  /**
   * Starts listening again on top of whatever is already transcribed — the
   * "Resume dictation" path back from the transcript review, and the path taken
   * after a recovered session is restored. `retry` is the opposite: it starts a
   * new consultation and deliberately clears the previous one.
   */
  const resumeDictation = useCallback(
    () => beginSession({ keepTranscript: true }),
    [beginSession],
  );

  return {
    status,
    transcript,
    partialText,
    errorMessage,
    durationSeconds,
    segments,
    liveExtractedFields,
    isListening: status === RECORDING_STATE.LISTENING,
    isPaused: status === RECORDING_STATE.PAUSED,
    pause,
    resume,
    resumeDictation,
    stop: stopWithManager,
    retry: beginSession,
    requestPermission: beginSession,
    openAppSettings,
  };
}
