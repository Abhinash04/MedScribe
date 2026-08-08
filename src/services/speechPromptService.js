import { synthesize } from './anuvadini/speechClient';
import { DEFAULT_LANGUAGE } from './anuvadini/language';
import { getAnuvadiniToken } from './appConfigService';
import audioFeedbackService from './audioFeedbackService';
import { missingFieldPrompt } from './missingFieldPrompt';

let inFlight = null;
let speaking = false;

export function isSpeaking() {
  return speaking;
}

export async function stopPrompt() {
  inFlight?.abort();
  inFlight = null;
  await audioFeedbackService.stopSpeech();
  speaking = false;
}

export async function speakMissingFields(fields, options = {}) {
  const { language = DEFAULT_LANGUAGE, token = getAnuvadiniToken() } = options;

  const text = missingFieldPrompt(fields);
  if (!text) {
    return { spoken: false, reason: 'nothing_missing' };
  }

  await stopPrompt();

  const controller = new AbortController();
  inFlight = controller;

  let result;
  try {
    result = await synthesize({ text, language, token, signal: controller.signal });
  } catch {
    result = { ok: false, errorKind: 'network' };
  }

  if (inFlight !== controller) {
    return { spoken: false, reason: 'superseded' };
  }
  inFlight = null;

  if (!result.ok) {
    return { spoken: false, reason: result.errorKind };
  }

  speaking = true;
  try {
    const played = await audioFeedbackService.playSpeech(result.audioBase64);
    return played ? { spoken: true } : { spoken: false, reason: 'playback_failed' };
  } finally {
    speaking = false;
  }
}
