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
  const resetAmplitude = useCallback(() => {
    speech.amplitudeShared.value = 0;
  }, []);
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
    if (dictationSessionManager.usesSharedMic()) {
      return;
    }
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
  const handleStart = useCallback(() => {
    isListeningRef.current = true;
    clearRestartTimer();
  }, [clearRestartTimer]);
  const handleBegin = useCallback(() => {
    isListeningRef.current = true;
    clearRestartTimer();
  }, [clearRestartTimer]);
  const handleEnd = useCallback(() => {
    isListeningRef.current = false;
    resetAmplitude();
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
      if (isSettled()) {
        return;
      }

      if (code === SPEECH_ERROR_CODE.INSUFFICIENT_PERMISSIONS) {
        shouldContinueRef.current = false;
        clearTimers();
        setStatus(RECORDING_STATE.PERMISSION_BLOCKED);
        return;
      }
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
        scheduleRestart(backoffDelay(consecutiveTransientRef.current));
        return;
      }
      shouldContinueRef.current = false;
      clearTimers();
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
  const beginSession = useCallback(async (options) => {
    const resumeExisting = options?.keepTranscript === true;
    shouldContinueRef.current = false;
    clearTimers();
    if (!resumeExisting) {
      reset();
    }
    consecutiveTransientRef.current = 0;
    setStatus(RECORDING_STATE.CHECKING_PERMISSION);
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
    shouldContinueRef.current = true;
    await dictationSessionManager.startSession();
    if (!dictationSessionManager.usesSharedMic()) {
      await safeStart();
    }
  }, [clearTimers, reset, setStatus, setError, safeStart]);

  const stop = useCallback(async () => {
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
      // Expected: stopListening() resolves "Not listening" or rejects outright
      // when the recognizer already ended on its own. The finalize timer below
      // settles the session either way, so there is nothing to recover from.
    }
    clearFinalizeTimer();
    finalizeTimerRef.current = setTimeout(() => {
      finalizeTimerRef.current = null;
      if (mountedRef.current) {
        finalize();
      }
    }, FINALIZE_TIMEOUT_MS);
  }, [clearRestartTimer, clearFinalizeTimer, setPartial, setStatus, finalize]);

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
      dictationSessionManager.dispose();
      audioFeedbackService.restoreNow();
      // This stop() IS the microphone release on unmount — destroy() is
      // deliberately never called here (see handoff §7). A rejection means the
      // recognizer had already ended on its own, which is the same end state,
      // and startListening() re-initialises it on the next session regardless.
      speech.stop().catch(() => { });
    };
  }, []);

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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
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
