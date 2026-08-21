import { synthesize } from './anuvadini/speechClient.js';
import { DEFAULT_LANGUAGE } from './anuvadini/language.js';
import { ERROR_KIND } from './anuvadini/proxyContract.js';
import { getAnuvadiniToken } from './appConfigService.js';
import audioFeedbackService from './audioFeedbackService.js';
import { missingFieldPrompt } from './missingFieldPrompt.js';

let inFlight = null;
let speaking = false;
let version = 0;

export function isSpeaking() {
  return speaking;
}

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
  const {
    language = DEFAULT_LANGUAGE,
    token = getAnuvadiniToken(),
    fallbackLanguage = null,
    transport,
    url,
  } = options;

  const text = missingFieldPrompt(fields, language);
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
    result = await synthesize({
      text,
      language,
      token,
      transport,
      url,
      signal: controller.signal,
    });

    if (
      !result.ok &&
      result.errorKind === ERROR_KIND.UNSUPPORTED_LANGUAGE &&
      fallbackLanguage &&
      fallbackLanguage !== language
    ) {
      result = await synthesize({
        text: missingFieldPrompt(fields, fallbackLanguage),
        language: fallbackLanguage,
        token,
        transport,
        url,
        signal: controller.signal,
      });
    }
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
