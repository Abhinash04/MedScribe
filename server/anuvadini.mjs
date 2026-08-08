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
    ttsUrl:
      env.TEXT_TO_SPEECH_API_URL ||
      'https://anuvadini-services.aicte-india.org/api/text-to-speech',
  };
}

async function callUpstream({ url, key, payload, read }, { fetchImpl, timeoutMs }) {
  const startedAt = Date.now();
  const done = extra => ({ ms: Date.now() - startedAt, ...extra });

  if (!url || !key) {
    return done({ ok: false, error: UPSTREAM_ERROR.NOT_CONFIGURED });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
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

  const status = response.status;
  if (status === 401 || status === 403) {
    return done({ ok: false, error: UPSTREAM_ERROR.UNAUTHORIZED, status });
  }
  if (status === 429) {
    return done({ ok: false, error: UPSTREAM_ERROR.RATE_LIMITED, status });
  }
  if (!response.ok) {
    return done({ ok: false, error: UPSTREAM_ERROR.UPSTREAM_ERROR, status });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return done({ ok: false, error: UPSTREAM_ERROR.MALFORMED, status });
  }

  return done({ ...read(body), status });
}

export function transcribe(
  { audioBuffer, audioLanguage },
  { config = readConfig(), fetchImpl = fetch, timeoutMs = UPSTREAM_TIMEOUT_MS } = {},
) {
  return callUpstream(
    {
      url: config.url,
      key: config.key,
      payload: { audioBuffer, audioLanguage },
      read: body => {
        if (!body || typeof body.transcription !== 'string') {
          return { ok: false, error: UPSTREAM_ERROR.MALFORMED };
        }
        const text = body.transcription.trim();
        if (!text) {
          return { ok: false, error: UPSTREAM_ERROR.EMPTY_TRANSCRIPTION };
        }
        return { ok: true, text };
      },
    },
    { fetchImpl, timeoutMs },
  );
}

const AUDIO_KEYS = ['audio', 'audio_url', 'audioFile'];
const LOOKS_LIKE_URL = /^https?:\/\//i;

export function synthesize(
  { text, lang, languageVoice, gender },
  { config = readConfig(), fetchImpl = fetch, timeoutMs = UPSTREAM_TIMEOUT_MS } = {},
) {
  return callUpstream(
    {
      url: config.ttsUrl,
      key: config.key,
      payload: { text, lang, languageVoice, gender },
      read: readSpeechBody,
    },
    { fetchImpl, timeoutMs },
  );
}

function readSpeechBody(body) {
  const candidates = [
    ...AUDIO_KEYS.map(key => body?.[key]),
    ...AUDIO_KEYS.map(key => body?.data?.[key]),
  ];
  const found =
    candidates.find(value => typeof value === 'string' && value.trim()) ??
    candidates.find(value => typeof value === 'string');

  if (found === undefined) {
    return { ok: false, error: UPSTREAM_ERROR.MALFORMED };
  }

  const audio = found.trim().replace(/^data:[^,]*,/, '');
  if (!audio) {
    return { ok: false, error: UPSTREAM_ERROR.EMPTY_SPEECH };
  }
  if (LOOKS_LIKE_URL.test(audio)) {
    return { ok: false, error: UPSTREAM_ERROR.MALFORMED };
  }

  return { ok: true, audio };
}
