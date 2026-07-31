/**
 * Recording state machine (SRS FR-2 / FR-3 / NFR-4).
 *
 * Single source of truth so screens never compare magic strings.
 */
export const RECORDING_STATE = {
  IDLE: 'idle',
  CHECKING_PERMISSION: 'checkingPermission',
  PERMISSION_DENIED: 'permissionDenied', // Re-requestable
  PERMISSION_BLOCKED: 'permissionBlocked', // Needs the system settings screen
  UNAVAILABLE: 'unavailable', // No microphone or no speech recognizer
  LISTENING: 'listening',
  PAUSED: 'paused',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

/**
 * Android SpeechRecognizer error codes, forwarded verbatim by
 * @appcitor/react-native-voice-to-text as `{ code, message }`.
 */
export const SPEECH_ERROR_CODE = {
  NETWORK_TIMEOUT: 1,
  NETWORK: 2,
  AUDIO: 3,
  SERVER: 4,
  CLIENT: 5,
  SPEECH_TIMEOUT: 6,
  NO_MATCH: 7,
  RECOGNIZER_BUSY: 8,
  INSUFFICIENT_PERMISSIONS: 9,
  // Added in API 31. Observed on the API 36 emulator: rapidly restarting the
  // recognizer makes the system service unbind mid-cycle and emit code 11.
  TOO_MANY_REQUESTS: 10,
  SERVER_DISCONNECTED: 11,
  LANGUAGE_NOT_SUPPORTED: 12,
  LANGUAGE_UNAVAILABLE: 13,
};

/**
 * Doctor-facing copy. The library's own messages are engine jargon
 * ("No speech match found"), which is not useful mid-consultation.
 */
export const SPEECH_ERROR_MESSAGES = {
  [SPEECH_ERROR_CODE.NETWORK_TIMEOUT]:
    'The network timed out. Check your connection and try again.',
  [SPEECH_ERROR_CODE.NETWORK]:
    'No network connection. Speech recognition needs internet access.',
  [SPEECH_ERROR_CODE.AUDIO]:
    'Could not read from the microphone. Close any other app using it and try again.',
  [SPEECH_ERROR_CODE.SERVER]:
    'The speech recognition service is unavailable right now. Try again shortly.',
  [SPEECH_ERROR_CODE.CLIENT]:
    'Speech recognition stopped unexpectedly. Try again.',
  [SPEECH_ERROR_CODE.SPEECH_TIMEOUT]:
    'No speech was detected. Try again and speak clearly into the microphone.',
  [SPEECH_ERROR_CODE.NO_MATCH]:
    'Could not understand the dictation. Try again and speak clearly.',
  [SPEECH_ERROR_CODE.RECOGNIZER_BUSY]:
    'The speech recognizer is busy. Wait a moment and try again.',
  [SPEECH_ERROR_CODE.INSUFFICIENT_PERMISSIONS]:
    'Microphone access is required to dictate patient details.',
  [SPEECH_ERROR_CODE.TOO_MANY_REQUESTS]:
    'Too many recognition requests. Wait a moment and try again.',
  [SPEECH_ERROR_CODE.SERVER_DISCONNECTED]:
    'The speech recognition service disconnected. Try again.',
  [SPEECH_ERROR_CODE.LANGUAGE_NOT_SUPPORTED]:
    'This dictation language is not supported by the device speech engine.',
  [SPEECH_ERROR_CODE.LANGUAGE_UNAVAILABLE]:
    'The dictation language is unavailable. Check the device speech settings.',
};

export const DEFAULT_ERROR_MESSAGE =
  'Speech recognition failed. Please try again.';

/**
 * Errors that fire routinely during normal dictation and must NOT surface
 * to the doctor while the auto-restart loop is running.
 *
 * A natural pause between sentences reliably produces SPEECH_TIMEOUT (6) or
 * NO_MATCH (7); a restart that lands too early produces RECOGNIZER_BUSY (8) or
 * SERVER_DISCONNECTED (11); CLIENT (5) is frequently spurious on Android.
 * These are retried silently and only escalate once
 * MAX_CONSECUTIVE_TRANSIENT_ERRORS is hit.
 *
 * LANGUAGE_NOT_SUPPORTED (12) and LANGUAGE_UNAVAILABLE (13) are deliberately
 * excluded — retrying cannot fix them, so they must surface immediately.
 */
export const TRANSIENT_ERROR_CODES = [
  SPEECH_ERROR_CODE.CLIENT,
  SPEECH_ERROR_CODE.SPEECH_TIMEOUT,
  SPEECH_ERROR_CODE.NO_MATCH,
  SPEECH_ERROR_CODE.RECOGNIZER_BUSY,
  SPEECH_ERROR_CODE.TOO_MANY_REQUESTS,
  SPEECH_ERROR_CODE.SERVER_DISCONNECTED,
];

/**
 * How many transient errors may occur back-to-back without producing any
 * text before the loop gives up. Guards against an invisible infinite
 * restart loop when the microphone is dead or permanently silent.
 */
export const MAX_CONSECUTIVE_TRANSIENT_ERRORS = 5;

/**
 * Delay before restarting the recognizer after it ends an utterance.
 * The native recognizer needs teardown time; restarting synchronously
 * produces ERROR_RECOGNIZER_BUSY.
 */
export const RESTART_DELAY_MS = 400;

/**
 * Ceiling for the escalating backoff applied after consecutive transient
 * errors. Restarting at a fixed short interval makes the system speech
 * service unbind mid-cycle (observed as SERVER_DISCONNECTED on API 36),
 * so each successive failure waits longer.
 */
export const MAX_RESTART_DELAY_MS = 2000;

export const backoffDelay = attempt =>
  Math.min(RESTART_DELAY_MS * (attempt + 1), MAX_RESTART_DELAY_MS);

/**
 * How long stop() waits for a final onSpeechResults before settling on
 * SUCCESS anyway, so the UI can never hang in PROCESSING.
 */
export const FINALIZE_TIMEOUT_MS = 1500;

export const resolveErrorMessage = code =>
  SPEECH_ERROR_MESSAGES[code] || DEFAULT_ERROR_MESSAGE;

export const isTransientError = code => TRANSIENT_ERROR_CODES.includes(code);
