import { createServer } from 'node:http';
import { synthesize, transcribe, UPSTREAM_ERROR } from './anuvadini.mjs';

/**
 * MedScribe transcription proxy.
 *
 * The phone sends Base64 audio and a language; this attaches the Anuvadini
 * credential and forwards it. The credential exists only here, so an APK on a
 * doctor's phone cannot leak it and does not have to be rebuilt to rotate it.
 *
 * Dependency-free on purpose — Node has the HTTP server and fetch it needs.
 */

export const PORT = Number(process.env.PORT || 8787);

/** Base64 for the 120 s capture ceiling is ~5.1 MB; 8 MB leaves headroom. */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

export const REQUEST_ERROR = {
  NOT_FOUND: 'not_found',
  METHOD_NOT_ALLOWED: 'method_not_allowed',
  INVALID_JSON: 'invalid_json',
  MISSING_AUDIO: 'missing_audio',
  MISSING_LANGUAGE: 'missing_language',
  MISSING_TEXT: 'missing_text',
  MISSING_VOICE: 'missing_voice',
  TOO_LARGE: 'too_large',
};

/** A prompt is a sentence; anything larger is a caller bug, not a request. */
export const MAX_SPEECH_CHARS = 600;

const STATUS_FOR = {
  [UPSTREAM_ERROR.NOT_CONFIGURED]: 503,
  [UPSTREAM_ERROR.UNAUTHORIZED]: 502,
  [UPSTREAM_ERROR.RATE_LIMITED]: 429,
  [UPSTREAM_ERROR.UPSTREAM_ERROR]: 502,
  [UPSTREAM_ERROR.TIMEOUT]: 504,
  [UPSTREAM_ERROR.NETWORK]: 502,
  [UPSTREAM_ERROR.MALFORMED]: 502,
  [UPSTREAM_ERROR.EMPTY_TRANSCRIPTION]: 422,
  [UPSTREAM_ERROR.EMPTY_SPEECH]: 422,
};

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

/**
 * Reads the body, refusing anything over the cap without buffering it. A
 * request that is too large is a client bug or an attack; either way the
 * server should not hold it in memory to find out.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY_BYTES) {
      reject(new Error(REQUEST_ERROR.TOO_LARGE));
      return;
    }

    const chunks = [];
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(REQUEST_ERROR.TOO_LARGE));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * The request handler, exported so the suite can drive it without a socket.
 *
 * Nothing here logs the audio, the transcript or the credential: the log line
 * is shape and timing only.
 */
export async function handleVoiceToText(body, deps = {}) {
  if (typeof body?.audio_buffer !== 'string' || !body.audio_buffer) {
    return { status: 400, body: { success: false, error: REQUEST_ERROR.MISSING_AUDIO } };
  }
  if (typeof body?.audio_language !== 'string' || !body.audio_language) {
    return { status: 400, body: { success: false, error: REQUEST_ERROR.MISSING_LANGUAGE } };
  }

  const result = await transcribe(
    { audioBuffer: body.audio_buffer, audioLanguage: body.audio_language },
    deps,
  );

  if (result.ok) {
    return { status: 200, body: { success: true, transcription: result.text }, ms: result.ms };
  }

  return {
    status: STATUS_FOR[result.error] ?? 502,
    body: { success: false, error: result.error },
    ms: result.ms,
  };
}

/**
 * Speech synthesis, exported for the same reason as `handleVoiceToText`: the
 * suite drives it without opening a socket.
 *
 * The prompt names absent fields and never carries a field value, so this route
 * logs shape and timing only - the same discipline as the audio route, for the
 * same reason.
 */
export async function handleTextToSpeech(body, deps = {}) {
  if (typeof body?.text !== 'string' || !body.text.trim()) {
    return { status: 400, body: { success: false, error: REQUEST_ERROR.MISSING_TEXT } };
  }
  if (body.text.length > MAX_SPEECH_CHARS) {
    return { status: 413, body: { success: false, error: REQUEST_ERROR.TOO_LARGE } };
  }
  if (typeof body?.lang !== 'string' || !body.lang) {
    return { status: 400, body: { success: false, error: REQUEST_ERROR.MISSING_LANGUAGE } };
  }
  if (typeof body?.language_voice !== 'string' || !body.language_voice) {
    return { status: 400, body: { success: false, error: REQUEST_ERROR.MISSING_VOICE } };
  }

  const result = await synthesize(
    {
      text: body.text,
      lang: body.lang,
      languageVoice: body.language_voice,
      gender: body.gender || 'Female',
    },
    deps,
  );

  if (result.ok) {
    return { status: 200, body: { success: true, audio: result.audio }, ms: result.ms };
  }

  return {
    status: STATUS_FOR[result.error] ?? 502,
    body: { success: false, error: result.error },
    ms: result.ms,
  };
}

/** The two routes, so adding a third is a row rather than another branch. */
const ROUTES = {
  '/voice-to-text': { handle: handleVoiceToText },
  '/text-to-speech': { handle: handleTextToSpeech },
};

export function createProxyServer(deps = {}) {
  return createServer(async (req, res) => {
    const startedAt = Date.now();
    const url = req.url?.split('?')[0] ?? '/';

    if (url === '/health') {
      json(res, 200, { success: true, service: 'medscribe-stt-proxy' });
      return;
    }

    const route = ROUTES[url];
    if (!route) {
      json(res, 404, { success: false, error: REQUEST_ERROR.NOT_FOUND });
      return;
    }

    if (req.method !== 'POST') {
      json(res, 405, { success: false, error: REQUEST_ERROR.METHOD_NOT_ALLOWED });
      return;
    }

    let raw;
    try {
      raw = await readBody(req);
    } catch (error) {
      const tooLarge = error?.message === REQUEST_ERROR.TOO_LARGE;
      json(res, tooLarge ? 413 : 400, {
        success: false,
        error: tooLarge ? REQUEST_ERROR.TOO_LARGE : REQUEST_ERROR.INVALID_JSON,
      });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      json(res, 400, { success: false, error: REQUEST_ERROR.INVALID_JSON });
      return;
    }

    const result = await route.handle(parsed, deps);
    json(res, result.status, result.body);

    console.log(
      `[proxy] POST ${url} ${result.status} ${raw.length}B upstream=${result.ms ?? 0}ms total=${Date.now() - startedAt}ms`,
    );
  });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  createProxyServer().listen(PORT, () => {
    console.log(`[proxy] listening on http://localhost:${PORT}`);
    console.log('[proxy] expose to a device with: adb reverse tcp:8787 tcp:8787');
  });
}
