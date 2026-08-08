/**
 * The upstream Anuvadini call, isolated so the request handler can be tested
 * against a fake and so the credential lives in exactly one function.
 *
 * The token is read from the environment and never returned, logged or placed
 * in an error. The phone must not be able to obtain it, and neither should a
 * stack trace.
 */

export const UPSTREAM_TIMEOUT_MS = 60000;

export const UPSTREAM_ERROR = {
  NOT_CONFIGURED: 'not_configured',
  UNAUTHORIZED: 'unauthorized',
  RATE_LIMITED: 'rate_limited',
  UPSTREAM_ERROR: 'upstream_error',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  MALFORMED: 'malformed',
  EMPTY_TRANSCRIPTION: 'empty_transcription',
  EMPTY_SPEECH: 'empty_speech',
};

export function readConfig(env = process.env) {
  return {
    url: env.VOICE_TO_TEXT_API_URL || '',
    key: env.VOICE_TO_TEXT_API_KEY || '',
    // Same host and same credential as transcription; separated only so a
    // deployment can point them at different paths without a code change.
    ttsUrl:
      env.TEXT_TO_SPEECH_API_URL ||
      'https://anuvadini-services.aicte-india.org/api/text-to-speech',
  };
}

/**
 * @returns {Promise<{ok: boolean, text?: string, error?: string, status?: number, ms: number}>}
 */
export async function transcribe(
  { audioBuffer, audioLanguage },
  { config = readConfig(), fetchImpl = fetch, timeoutMs = UPSTREAM_TIMEOUT_MS } = {},
) {
  const startedAt = Date.now();
  const done = extra => ({ ms: Date.now() - startedAt, ...extra });

  if (!config.url || !config.key) {
    return done({ ok: false, error: UPSTREAM_ERROR.NOT_CONFIGURED });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({ audioBuffer, audioLanguage }),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    return done({
      ok: false,
      error: aborted ? UPSTREAM_ERROR.TIMEOUT : UPSTREAM_ERROR.NETWORK,
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    return done({ ok: false, error: UPSTREAM_ERROR.UNAUTHORIZED, status: response.status });
  }
  if (response.status === 429) {
    return done({ ok: false, error: UPSTREAM_ERROR.RATE_LIMITED, status: response.status });
  }
  if (!response.ok) {
    return done({ ok: false, error: UPSTREAM_ERROR.UPSTREAM_ERROR, status: response.status });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return done({ ok: false, error: UPSTREAM_ERROR.MALFORMED, status: response.status });
  }

  if (!body || typeof body.transcription !== 'string') {
    return done({ ok: false, error: UPSTREAM_ERROR.MALFORMED, status: response.status });
  }

  const text = body.transcription.trim();
  if (!text) {
    return done({ ok: false, error: UPSTREAM_ERROR.EMPTY_TRANSCRIPTION, status: response.status });
  }

  return done({ ok: true, text, status: response.status });
}

/** Where the upstream may put the base64 audio. Mirrors the client's reader. */
const AUDIO_KEYS = ['audio', 'audio_url', 'audioFile'];

/**
 * The upstream synthesis call. Same credential handling as `transcribe`: the
 * key is attached here and appears in no return value and no error.
 *
 * @returns {Promise<{ok: boolean, audio?: string, error?: string, status?: number, ms: number}>}
 */
export async function synthesize(
  { text, lang, languageVoice, gender },
  { config = readConfig(), fetchImpl = fetch, timeoutMs = UPSTREAM_TIMEOUT_MS } = {},
) {
  const startedAt = Date.now();
  const done = extra => ({ ms: Date.now() - startedAt, ...extra });

  if (!config.ttsUrl || !config.key) {
    return done({ ok: false, error: UPSTREAM_ERROR.NOT_CONFIGURED });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  let response;
  try {
    response = await fetchImpl(config.ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({ text, lang, languageVoice, gender }),
      signal: controller.signal,
    });
  } catch {
    const aborted = controller.signal.aborted;
    return done({
      ok: false,
      error: aborted ? UPSTREAM_ERROR.TIMEOUT : UPSTREAM_ERROR.NETWORK,
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    return done({ ok: false, error: UPSTREAM_ERROR.UNAUTHORIZED, status: response.status });
  }
  if (response.status === 429) {
    return done({ ok: false, error: UPSTREAM_ERROR.RATE_LIMITED, status: response.status });
  }
  if (!response.ok) {
    return done({ ok: false, error: UPSTREAM_ERROR.UPSTREAM_ERROR, status: response.status });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return done({ ok: false, error: UPSTREAM_ERROR.MALFORMED, status: response.status });
  }

  const found = [
    ...AUDIO_KEYS.map(key => body?.[key]),
    ...AUDIO_KEYS.map(key => body?.data?.[key]),
  ].find(value => typeof value === 'string' && value.trim());

  if (found === undefined) {
    return done({ ok: false, error: UPSTREAM_ERROR.MALFORMED, status: response.status });
  }

  const audio = found.trim().replace(/^data:[^,]*,/, '');
  if (!audio) {
    return done({ ok: false, error: UPSTREAM_ERROR.EMPTY_SPEECH, status: response.status });
  }

  return done({ ok: true, audio, status: response.status });
}
