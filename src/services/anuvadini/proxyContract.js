/**
 * The MedScribe app ↔ MedScribe proxy contract.
 *
 * Deliberately says nothing about Anuvadini itself: the proxy owns the
 * credential, the header and the upstream field names, and the phone must not
 * be able to reach that service directly.
 *
 *   POST /voice-to-text
 *   { "audio_buffer": "<base64>", "audio_language": "en-IN" }
 *   -> { "success": true, "transcription": "..." }
 */

export const REQUEST_FIELDS = {
  AUDIO: 'audio_buffer',
  LANGUAGE: 'audio_language',
};

/** Anuvadini's own field names, used only when the app calls it directly. */
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

/** Reads the transcript out of a proxy response, or says why it could not. */
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
