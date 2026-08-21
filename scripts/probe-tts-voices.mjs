import { flag } from './lib/cli-flags.mjs';
import { ANUVADINI_TTS_URL } from '../src/config/endpoints.js';
import { DICTATION_LANGUAGES } from '../src/constants/languages.js';
import { buildDirectSpeechRequestBody } from '../src/services/anuvadini/speechContract.js';

const TIMEOUT_MS = 20000;
const SAMPLE_TEXT = 'This is a test of the medical dictation voice prompt.';

const token = process.env.ANUVADINI_STT_TOKEN || '';
if (!token) {
  console.error(
    'ANUVADINI_STT_TOKEN is not set. Export it before running this probe.\n' +
      'The token is never printed by this script.',
  );
  process.exit(0);
}

const only = flag('only')?.split(',').map(value => value.trim()).filter(Boolean);
const voiceOverrides = flag('voices')
  ?.split(',')
  .map(value => value.trim())
  .filter(Boolean);
const gender = flag('gender') || 'Female';

const targets = DICTATION_LANGUAGES.filter(
  language => !only || only.includes(language.code),
);

if (!targets.length) {
  console.error('No languages matched --only.');
  process.exit(0);
}

async function probe(language, voice) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);

  try {
    const response = await fetch(ANUVADINI_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        buildDirectSpeechRequestBody(SAMPLE_TEXT, language.tag, {
          voice,
          gender,
        }),
      ),
      signal: controller.signal,
    });

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const audio =
      body?.audio ?? body?.audioFile ?? body?.data?.audio ?? body?.data?.audioFile;
    const bytes =
      typeof audio === 'string'
        ? Math.floor(audio.replace(/^data:[^,]*,/, '').length * 0.75)
        : 0;

    return { status: response.status, bytes, ok: response.ok && bytes > 0 };
  } catch (error) {
    const reason = String(error?.message || error?.name || error);
    return { status: 0, bytes: 0, ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

console.log(
  ['code', 'tag', 'voice', 'http', 'bytes', 'ok'].join('\t') + '\n' + '-'.repeat(72),
);

const working = [];

for (const language of targets) {
  const candidates = voiceOverrides ?? (language.voice ? [language.voice] : []);

  if (!candidates.length) {
    console.log(
      [language.code, language.tag, '(no voice id)', '-', '-', '-'].join('\t'),
    );
    continue;
  }

  for (const voice of candidates) {
    const result = await probe(language, voice);
    console.log(
      [
        language.code,
        language.tag,
        voice,
        result.status || result.reason || '-',
        result.bytes,
        result.ok ? 'yes' : 'no',
      ].join('\t'),
    );
    if (result.ok) {
      working.push({ code: language.code, voice });
    }
  }
}

if (working.length) {
  console.log('\nAdd to src/constants/languages.js:');
  for (const entry of working) {
    console.log(
      `  ${entry.code}: voice: '${entry.voice}', gender: '${gender}', confirmed: true`,
    );
  }
}
