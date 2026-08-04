/**
 * What a captured consultation costs to upload.
 *
 * The transcription contract carries the audio as a Base64 string inside JSON,
 * which is a third larger than the bytes and lands in memory as UTF-16 on top
 * of that. On an entry-level device a long dictation is an out-of-memory rather
 * than a slow request, so the ceiling is arithmetic rather than a guess.
 */

export const SAMPLE_RATE_HZ = 16000;
export const BITS_PER_SAMPLE = 16;
export const CHANNELS = 1;

/** Canonical PCM WAV header. */
export const WAV_HEADER_BYTES = 44;

export const BYTES_PER_SECOND = (SAMPLE_RATE_HZ * BITS_PER_SAMPLE * CHANNELS) / 8;

/**
 * The longest capture we will upload until the backend publishes its own limit.
 * 120 s is ~3.8 MB of WAV and ~5.1 MB of Base64.
 */
export const MAX_UPLOAD_SECONDS = 120;

export const MAX_UPLOAD_BYTES = wavBytesFor(MAX_UPLOAD_SECONDS);

export function wavBytesFor(seconds) {
  const audio = Math.max(0, Math.round(seconds * BYTES_PER_SECOND));
  return audio + WAV_HEADER_BYTES;
}

export function secondsFor(bytes) {
  const audio = Math.max(0, (bytes || 0) - WAV_HEADER_BYTES);
  return audio / BYTES_PER_SECOND;
}

/** Base64 is 4 characters per 3 bytes, padded up to a multiple of four. */
export function base64CharsFor(bytes) {
  return Math.ceil((bytes || 0) / 3) * 4;
}

export function withinUploadBudget(bytes) {
  return (bytes || 0) > 0 && bytes <= MAX_UPLOAD_BYTES;
}

/** For the message shown when a dictation is too long to refine. */
export function describeBudget() {
  return {
    maxSeconds: MAX_UPLOAD_SECONDS,
    maxBytes: MAX_UPLOAD_BYTES,
    maxBase64Chars: base64CharsFor(MAX_UPLOAD_BYTES),
  };
}
