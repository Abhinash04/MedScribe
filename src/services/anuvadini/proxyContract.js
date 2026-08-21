export const REQUEST_FIELDS = {
  AUDIO: 'audio_buffer',
  LANGUAGE: 'audio_language',
};

export const DIRECT_REQUEST_FIELDS = {
  AUDIO: 'audioBuffer',
  LANGUAGE: 'audioLanguage',
};

export const ERROR_KIND = {
  NOT_CONFIGURED: 'not_configured',
  UNSUPPORTED_LANGUAGE: 'unsupported_language',
  NO_AUDIO: 'no_audio',
  AUDIO_TOO_LARGE: 'audio_too_large',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
  CLIENT_ERROR: 'client_error',
  SERVER_ERROR: 'server_error',
  MALFORMED: 'malformed',
  EMPTY_TRANSCRIPTION: 'empty_transcription',
  NO_TEXT: 'no_text',
  EMPTY_SPEECH: 'empty_speech',
  UNAUTHORIZED: 'unauthorized',
  QUOTA_EXCEEDED: 'quota_exceeded',
  TEXT_TOO_LARGE: 'text_too_large',
  EMPTY_TRANSLATION: 'empty_translation',
  COUNT_MISMATCH: 'count_mismatch',
};

export function buildRequestBody(audioBase64, normalizedLanguage) {
  return {
    [REQUEST_FIELDS.AUDIO]: audioBase64,
    [REQUEST_FIELDS.LANGUAGE]: normalizedLanguage,
  };
}

export function buildDirectRequestBody(audioBase64, normalizedLanguage) {
  return {
    [DIRECT_REQUEST_FIELDS.AUDIO]: audioBase64,
    [DIRECT_REQUEST_FIELDS.LANGUAGE]: normalizedLanguage,
  };
}

export function readTranscription(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, errorKind: ERROR_KIND.MALFORMED };
  }
  if (body.success === false) {
    return { ok: false, errorKind: ERROR_KIND.SERVER_ERROR };
  }
  if (typeof body.transcription !== 'string') {
    return { ok: false, errorKind: ERROR_KIND.MALFORMED };
  }

  const text = body.transcription.trim();
  if (!text) {
    return { ok: false, errorKind: ERROR_KIND.EMPTY_TRANSCRIPTION };
  }

  return { ok: true, text };
}
