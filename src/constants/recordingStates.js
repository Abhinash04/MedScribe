export const RECORDING_STATE = {
  IDLE: 'idle',
  CHECKING_PERMISSION: 'checkingPermission',
  PERMISSION_DENIED: 'permissionDenied', 
  PERMISSION_BLOCKED: 'permissionBlocked',
  UNAVAILABLE: 'unavailable',
  LISTENING: 'listening',
  PAUSED: 'paused',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};
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
  TOO_MANY_REQUESTS: 10,
  SERVER_DISCONNECTED: 11,
  LANGUAGE_NOT_SUPPORTED: 12,
  LANGUAGE_UNAVAILABLE: 13,
};
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

export const TRANSIENT_ERROR_CODES = [
  SPEECH_ERROR_CODE.CLIENT,
  SPEECH_ERROR_CODE.SPEECH_TIMEOUT,
  SPEECH_ERROR_CODE.NO_MATCH,
  SPEECH_ERROR_CODE.RECOGNIZER_BUSY,
  SPEECH_ERROR_CODE.TOO_MANY_REQUESTS,
  SPEECH_ERROR_CODE.SERVER_DISCONNECTED,
];

export const MAX_CONSECUTIVE_TRANSIENT_ERRORS = 5;
export const RESTART_DELAY_MS = 400;
export const MAX_RESTART_DELAY_MS = 2000;
export const backoffDelay = attempt =>
  Math.min(RESTART_DELAY_MS * (attempt + 1), MAX_RESTART_DELAY_MS);

export const FINALIZE_TIMEOUT_MS = 1500;
export const resolveErrorMessage = code =>
  SPEECH_ERROR_MESSAGES[code] || DEFAULT_ERROR_MESSAGE;

export const isTransientError = code => TRANSIENT_ERROR_CODES.includes(code);
