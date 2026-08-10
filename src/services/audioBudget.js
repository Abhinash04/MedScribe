export const SAMPLE_RATE_HZ = 16000;
export const BITS_PER_SAMPLE = 16;
export const CHANNELS = 1;
export const WAV_HEADER_BYTES = 44;
export const BLOCK_ALIGN = (BITS_PER_SAMPLE * CHANNELS) / 8;
export const BYTES_PER_SECOND =
  (SAMPLE_RATE_HZ * BITS_PER_SAMPLE * CHANNELS) / 8;
export const SAFE_CHUNK_SECONDS = 45;
export const CHUNK_HARD_CAP_SECONDS = 50;
export const CHUNK_SNAP_WINDOW_SECONDS = 1.5;
export const MAX_UPLOAD_SECONDS = CHUNK_HARD_CAP_SECONDS;
export const MAX_UPLOAD_BYTES = wavBytesFor(MAX_UPLOAD_SECONDS);
export const MAX_RECORDING_SECONDS = 30 * 60;
export const MAX_RECORDING_BYTES = wavBytesFor(MAX_RECORDING_SECONDS);
export function wavBytesFor(seconds) {
  const audio = Math.max(0, Math.round(seconds * BYTES_PER_SECOND));
  return audio + WAV_HEADER_BYTES;
}
export function secondsFor(bytes) {
  const audio = Math.max(0, (bytes || 0) - WAV_HEADER_BYTES);
  return audio / BYTES_PER_SECOND;
}
export function base64CharsFor(bytes) {
  return Math.ceil((bytes || 0) / 3) * 4;
}
export function withinUploadBudget(bytes) {
  return (bytes || 0) > 0 && bytes <= MAX_UPLOAD_BYTES;
}
export function withinRecordingBudget(bytes) {
  return (bytes || 0) > 0 && bytes <= MAX_RECORDING_BYTES;
}
const alignDown = bytes => bytes - (bytes % BLOCK_ALIGN);
export function planChunks(fileBytes) {
  return chunksFromBoundaries(planChunkBoundaries(fileBytes));
}
export function planChunkBoundaries(fileBytes) {
  const audio = Math.max(0, (fileBytes || 0) - WAV_HEADER_BYTES);
  if (audio < BLOCK_ALIGN) {
    return [];
  }

  const count = Math.max(
    1,
    Math.ceil(audio / (SAFE_CHUNK_SECONDS * BYTES_PER_SECOND)),
  );
  const boundaries = [];
  for (let index = 0; index <= count; index += 1) {
    boundaries.push(
      WAV_HEADER_BYTES + alignDown(Math.round((audio * index) / count)),
    );
  }
  boundaries[count] = WAV_HEADER_BYTES + alignDown(audio);
  return boundaries;
}
export function chunksFromBoundaries(boundaries) {
  const points = Array.isArray(boundaries) ? boundaries : [];
  const chunks = [];

  for (let index = 0; index + 1 < points.length; index += 1) {
    const start = alignDown(
      Math.max(WAV_HEADER_BYTES, Math.round(points[index])),
    );
    const end = alignDown(Math.max(start, Math.round(points[index + 1])));
    if (end - start < BLOCK_ALIGN) {
      continue;
    }
    chunks.push({
      index: chunks.length,
      start,
      end,
      bytes: end - start,
      seconds: (end - start) / BYTES_PER_SECOND,
    });
  }
  return chunks;
}
export function chunksWithinCap(chunks) {
  return (
    Array.isArray(chunks) &&
    chunks.length > 0 &&
    chunks.every(chunk => chunk.seconds <= CHUNK_HARD_CAP_SECONDS)
  );
}
export function describeBudget() {
  return {
    maxSeconds: MAX_RECORDING_SECONDS,
    maxBytes: MAX_RECORDING_BYTES,
    chunkSeconds: SAFE_CHUNK_SECONDS,
    maxRequestBytes: MAX_UPLOAD_BYTES,
    maxBase64Chars: base64CharsFor(MAX_UPLOAD_BYTES),
  };
}
