import { synthesize } from './anuvadini/speechClient';
import { DEFAULT_LANGUAGE } from './anuvadini/language';
import { getAnuvadiniToken } from './appConfigService';
import audioFeedbackService from './audioFeedbackService';
import { missingFieldPrompt } from './missingFieldPrompt';

let inFlight = null;
let speaking = false;

/**
 * Incremented by every request and every stop.
 *
 * Tearing down is asynchronous, so without this a caller that started earlier
 * could resume after the await and overwrite the newer request's state — the
 * stale prompt would win. The dangerous case is an external `stopPrompt()`
 * being overtaken: that is the call `handleResumeRecording` awaits before the
 * microphone opens, and a prompt that slipped past it would play into a live
 * `SharedMicModule` and be transcribed into the report as the doctor's words.
 *
 * A request captures the version it claimed and re-checks it after every await.
 * Losing the comparison means something newer happened, and the older one stops
 * without touching shared state.
 */
let version = 0;

export function isSpeaking() {
  return speaking;
}

/** Teardown alone, so a caller can claim a version without invalidating itself. */
async function halt() {
  inFlight?.abort();
  inFlight = null;
  await audioFeedbackService.stopSpeech();
  speaking = false;
}

export async function stopPrompt() {
  version += 1;
  await halt();
}

export async function speakMissingFields(fields, options = {}) {
  const { language = DEFAULT_LANGUAGE, token = getAnuvadiniToken() } = options;

  const text = missingFieldPrompt(fields);
  if (!text) {
    return { spoken: false, reason: 'nothing_missing' };
  }

  const mine = ++version;
  await halt();
  if (mine !== version) {
    return { spoken: false, reason: 'superseded' };
  }

  const controller = new AbortController();
  inFlight = controller;

  let result;
  try {
    result = await synthesize({ text, language, token, signal: controller.signal });
  } catch {
    result = { ok: false, errorKind: 'network' };
  }

  if (mine !== version || inFlight !== controller) {
    return { spoken: false, reason: 'superseded' };
  }
  inFlight = null;

  if (!result.ok) {
    return { spoken: false, reason: result.errorKind };
  }

  // Re-checked immediately before playback: a stop issued while the synthesis
  // was in the air means the microphone may already be opening.
  if (mine !== version) {
    return { spoken: false, reason: 'superseded' };
  }

  speaking = true;
  try {
    const played = await audioFeedbackService.playSpeech(result.audioBase64);
    return played ? { spoken: true } : { spoken: false, reason: 'playback_failed' };
  } finally {
    speaking = false;
  }
}
