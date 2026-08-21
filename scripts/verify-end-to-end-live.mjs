// The complete workflow, against the live services, with real audio.
//
//   dictation text (original language)
//     -> Anuvadini TTS            .. produces real speech audio
//     -> Anuvadini STT            .. the AI transcription, in the original language
//     -> Pravah                   .. English
//     -> extraction               .. ADR fields
//     -> completeness             .. what is still missing
//     -> speakMissingFields()     .. the production call that speaks the prompt
//
// The last step is the acceptance criterion, and it is checked by capturing the HTTP
// body the app actually sends: the prompt must be requested in the language that was
// DICTATED, never in the language the report happens to be written in.
//
// WHAT THIS DOES NOT PROVE. The audio is synthesised, not spoken. It exercises both
// live services and the whole chain, but not the microphone, the on-device recogniser,
// accents, or background noise. Those rows are marked "not verified" in the matrix and
// are covered by docs/device-acceptance-checklist.md instead.
//
//   npm run verify:e2e
//   npm run verify:e2e -- --langs=or,hi
//   npm run verify:e2e -- --sample=9 --delay=600

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DICTATION_LANGUAGES } from '../src/constants/languages.js';
import { hasCatalog } from '../src/constants/prompts/index.js';
import { normalizeAnuvadiniLanguage } from '../src/services/anuvadini/language.js';
import { synthesize } from '../src/services/anuvadini/speechClient.js';
import { transcribe } from '../src/services/anuvadini/transcriptionClient.js';
import { needsTranslation } from '../src/services/consultationTranslation.js';
import { extractForReport } from '../src/services/extractionService.js';
import { speechLanguageFor } from '../src/services/languageCapabilities.js';
import {
  joinTranslated,
  planBatches,
  splitForTranslation,
} from '../src/services/pravah/chunkText.js';
import {
  protect,
  restore,
  stripSentinels,
} from '../src/services/pravah/protectNumerals.js';
import {
  inferMissingYears,
  repairOrphanedYears,
} from '../src/services/pravah/repairDates.js';
import {
  MAX_BATCH_CHARS,
  MAX_BATCH_ITEMS,
  translateTexts,
} from '../src/services/pravah/translationClient.js';
import { PRAVAH_TARGET_ENGLISH } from '../src/services/pravah/translationContract.js';
import {
  blockingFields,
  validateReportCompleteness,
} from '../src/services/reportCompleteness.js';
import { toDraft } from '../src/services/reportDraft.js';
import { speakMissingFields } from '../src/services/speechPromptService.js';
import { sampleFor } from './fixtures/dictation-samples.mjs';
import { flag } from './lib/cli-flags.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const BOLD = s => `\x1b[1m${s}\x1b[0m`;
const GREEN = s => `\x1b[32m${s}\x1b[0m`;
const RED = s => `\x1b[31m${s}\x1b[0m`;
const YELLOW = s => `\x1b[33m${s}\x1b[0m`;
const GREY = s => `\x1b[90m${s}\x1b[0m`;
const rule = char => char.repeat(100);

const byCode = code => DICTATION_LANGUAGES.find(language => language.code === code) ?? null;

// Proves the transcript came back in its own script rather than transliterated.
const isNonAscii = text => [...text].some(ch => ch.codePointAt(0) > 127);

// Used only when extraction left nothing missing, so that the spoken prompt — and
// therefore the language it is spoken in — is still measured for that language.
const PROBE_FIELD = { key: 'reactionStartDate', label: 'Event / Reaction Start Date' };

// Credentials are read and never printed.
function secret(name) {
  const path = join(HERE, '..', 'server', '.env');
  if (!existsSync(path)) {
    return '';
  }
  const match = new RegExp(`^${name}=(.*)$`, 'm').exec(readFileSync(path, 'utf8'));
  return match ? match[1].trim() : '';
}

const anuvadiniToken = process.env.ANUVADINI_STT_TOKEN || secret('VOICE_TO_TEXT_API_KEY');
const pravahKey = process.env.PRAVAH_API_KEY || secret('PRAVAH_API_KEY');

if (!anuvadiniToken || !pravahKey) {
  console.error(
    'Needs both credentials. Set ANUVADINI_STT_TOKEN and PRAVAH_API_KEY, or provide\n' +
      'VOICE_TO_TEXT_API_KEY and PRAVAH_API_KEY in server/.env. Neither is printed.',
  );
  process.exit(1);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const delay = Number(flag('delay') ?? 400);

// Sample 9 leaves the reaction start date unsaid on purpose. A blocked report is the
// only path that reaches TTS, which is the thing being verified.
const DICTATION_SAMPLE = Number(flag('sample') ?? 9);

const only = flag('langs')?.split(',').map(value => value.trim()).filter(Boolean);
const targets = DICTATION_LANGUAGES.filter(language => !only || only.includes(language.code));

// The transport records the body the application built, then performs the real
// request, so every assertion below is made against the bytes that went to the
// provider rather than against something re-derived from the code.
// Both providers drop requests intermittently: the same language that answers on one
// run returns a network error on the next, on identical input. A transient failure is
// retried a bounded number of times so that provider flakiness is not recorded as a
// language that does not work. A failure that survives every attempt is reported as it
// stands — nothing here converts a real failure into a pass.
//
// 'unsupported_language' is in this list on purpose, and it is not a fudge. Pravah
// answers a 422 for Urdu non-deterministically on byte-identical input — measured as
// fail / ok / fail across three consecutive attempts — and `classifyStatus` maps 422 to
// UNSUPPORTED_LANGUAGE. The production path already treats it as retryable
// (`transcriptTranslation.js` RETRYABLE, with 600 ms and 1800 ms backoff), so a harness
// that did not would report a language as unsupported that the app itself recovers.
const TRANSIENT = new Set([
  'network',
  'timeout',
  'server_error',
  'unsupported_language',
]);
const ATTEMPTS = 5;

async function persist(label, call) {
  let result = await call();
  for (let attempt = 2; attempt <= ATTEMPTS && !result.ok; attempt += 1) {
    if (!TRANSIENT.has(result.errorKind)) {
      return result;
    }
    process.stdout.write(GREY(`  retrying ${label} after ${result.errorKind}\n`));
    await sleep(delay * attempt * 2);
    result = await call();
  }
  return result;
}

const makeRecordingTransport = sink => async ({ url, body, headers, signal }) => {
  sink.push({ url, body });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: '*/*', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed };
};

async function translateToEnglish(text) {
  const { masked, entities } = protect(text);
  const batches = planBatches(splitForTranslation(masked), {
    maxItems: MAX_BATCH_ITEMS,
    maxChars: MAX_BATCH_CHARS,
  });

  const out = [];
  for (const batch of batches) {
    const result = await persist('translation batch', () =>
      translateTexts({ texts: batch, to: PRAVAH_TARGET_ENGLISH, key: pravahKey }),
    );
    await sleep(delay);
    if (!result.ok) {
      return { ok: false, errorKind: result.errorKind };
    }
    out.push(...result.texts);
  }

  const years = entities
    .map(entity => entity.value)
    .filter(value => /^(?:19|20)\d{2}$/.test(value));
  const restored = stripSentinels(restore(joinTranslated(out), entities).text);
  return { ok: true, text: inferMissingYears(repairOrphanedYears(restored), years) };
}

console.log(rule('='));
console.log(BOLD('End-to-end acceptance — live Anuvadini STT/TTS and live Pravah'));
console.log(rule('='));
console.log(
  `${targets.length} language(s), dictation sample ${DICTATION_SAMPLE}.\n` +
    GREY(
      'Audio is synthesised, not spoken. The microphone and the on-device recogniser are\n' +
        'NOT exercised here — see docs/device-acceptance-checklist.md.',
    ) +
    '\n',
);

const rows = [];

for (const language of targets) {
  const code = language.code;
  const row = {
    code,
    name: language.englishName,
    stt: '-',
    originalLocale: '-',
    translation: '-',
    fields: '-',
    ttsLocale: '-',
    ttsVoice: '-',
    verdict: 'unknown',
    note: '',
  };

  let english = null;
  let dictation = '';
  try {
    dictation = sampleFor(code, DICTATION_SAMPLE)?.text ?? '';
  } catch {
    dictation = '';
  }

  // Steps 1 to 3. The round trip is only possible where a voice exists to speak with.
  if (language.voice && dictation) {
    const spoken = await persist(`${code} dictation TTS`, () =>
      synthesize({ text: dictation, language: code, token: anuvadiniToken }),
    );
    await sleep(delay);

    if (!spoken.ok) {
      row.stt = 'n/a';
      row.note = `could not synthesise the dictation (${spoken.errorKind})`;
    } else {
      const heard = await persist(`${code} STT`, () =>
        transcribe({
          audioBase64: spoken.audioBase64,
          language: code,
          token: anuvadiniToken,
        }),
      );
      await sleep(delay);

      if (!heard.ok || !heard.text?.trim()) {
        row.stt = 'FAIL';
        row.verdict = 'provider';
        row.note = `STT ${heard.errorKind ?? 'empty'}`;
      } else {
        row.stt = 'ok';
        row.originalLocale = normalizeAnuvadiniLanguage(code);

        // A Latin-only transcript for a non-Latin language means the original
        // language was lost at the very first hop.
        if (language.script !== 'latin' && !isNonAscii(heard.text)) {
          row.verdict = 'app-bug';
          row.note = 'STT returned Latin text for a non-Latin language';
        }

        if (needsTranslation(code)) {
          const translated = await translateToEnglish(heard.text);
          if (translated.ok) {
            english = translated.text;
            row.translation = 'ok';
          } else {
            row.translation = 'FAIL';
            row.verdict = row.verdict === 'unknown' ? 'provider' : row.verdict;
            row.note = row.note || `translation ${translated.errorKind}`;
          }
        } else {
          english = heard.text;
          row.translation = 'n/a';
        }
      }
    }
  } else if (!language.voice) {
    row.note = 'no voice for this language';
  } else {
    row.note = `no sample ${DICTATION_SAMPLE} in the corpus`;
  }

  // Step 4. Extraction and completeness.
  //
  // Where the round trip could not run, the ADR fields come from the English reference
  // for the same sample, so the TTS step below still receives a real list of missing
  // fields to speak.
  const forExtraction = english ?? sampleFor('en', DICTATION_SAMPLE)?.text ?? '';
  const { record, residue } = extractForReport(forExtraction);
  const completeness = validateReportCompleteness(toDraft(record, residue));
  const extracted = blockingFields(completeness);
  row.fields = `${completeness.capturedCount}/${completeness.totalRequired}`;

  // A complete report never reaches TTS, so a language whose extraction happened to
  // succeed would leave the acceptance criterion unmeasured. Ask for one field anyway,
  // and say so in the note, rather than reporting a row that was never tested.
  const missing = extracted.length ? extracted : [PROBE_FIELD];
  const probed = extracted.length === 0;

  // Step 5. THE ACCEPTANCE CHECK.
  //
  // The report is in English. The dictation was not. This calls the production path
  // and inspects the request it produced.
  const resolved = speechLanguageFor(code);
  const captured = [];
  const outcome = await persist(`${code} prompt TTS`, () => {
    captured.length = 0;
    return speakMissingFields(missing, {
      language: resolved.language,
      fallbackLanguage: resolved.fallbackLanguage,
      token: anuvadiniToken,
      transport: makeRecordingTransport(captured),
    }).then(result => ({
      ...result,
      // speakMissingFields reports success as { spoken }, not { ok }. Playback is
      // expected to fail in Node, and that is not something to retry.
      ok: result.spoken || result.reason === 'playback_failed',
      errorKind: result.reason,
    }));
  });
  await sleep(delay);

  const first = captured[0]?.body ?? {};
  const last = captured[captured.length - 1]?.body ?? {};
  row.ttsLocale = last.lang ?? '-';
  row.ttsVoice = last.languageVoice ?? '-';

  // A language with no voice of its own never reaches the network on the first
  // attempt: synthesize() rejects it locally, so the only captured request is the
  // fallback. Judging such a row by its first request would report the designed
  // fallback as a bug.
  const expectsFallback = !language.voice;
  const fallbackTarget = expectsFallback ? byCode(resolved.fallbackLanguage) : null;

  const askedForOwnLanguage = first.lang === language.tag;
  const spokeOwnLanguage = last.lang === language.tag;
  const usedOwnVoice = last.languageVoice === language.voice;
  // The words must be the ones written for that language, not English words read out
  // by a non-English voice.
  const wordsAreLocalised = code === 'en' || hasCatalog(code);

  if (row.verdict === 'unknown') {
    if (!captured.length) {
      row.verdict = 'app-bug';
      row.note = `no TTS request was made at all (${outcome.reason ?? 'unknown'})`;
    } else if (expectsFallback) {
      const onTarget =
        last.lang === fallbackTarget?.tag &&
        last.languageVoice === fallbackTarget?.voice;
      if (!onTarget) {
        row.verdict = 'app-bug';
        row.note =
          `no voice; expected the fallback to ${resolved.fallbackLanguage} ` +
          `but asked for ${last.lang} / ${last.languageVoice}`;
      } else if (outcome.spoken || outcome.reason === 'playback_failed') {
        row.verdict = 'fallback';
        row.note = `no voice for ${language.tag}; the designed fallback to ` +
          `${fallbackTarget.tag} was used`;
      } else {
        row.verdict = 'provider';
        row.note = `fallback to ${fallbackTarget.tag} failed: ${outcome.reason}`;
      }
    } else if (!askedForOwnLanguage) {
      row.verdict = 'app-bug';
      row.note = `dictated ${language.tag} but asked for ${first.lang}`;
    } else if (spokeOwnLanguage && usedOwnVoice) {
      // playback_failed is expected here: there is no audio device in Node. The audio
      // itself was produced, which is what this step verifies.
      const produced = outcome.spoken || outcome.reason === 'playback_failed';
      row.verdict = produced ? 'working' : 'provider';
      if (!produced) {
        row.note = `TTS ${outcome.reason}`;
      } else if (!wordsAreLocalised) {
        row.note = 'own voice, but the prompt words fall back to English';
      } else if (probed) {
        row.note = 'extraction left nothing missing; the prompt was probed for';
      }
    } else {
      row.verdict = 'app-bug';
      row.note = `asked for ${last.lang} / ${last.languageVoice}`;
    }
  }

  rows.push(row);

  const mark =
    {
      working: GREEN('ok  '),
      fallback: YELLOW('fb  '),
      provider: YELLOW('prov'),
      'app-bug': RED('BUG '),
    }[row.verdict] ?? '?   ';

  console.log(
    `${mark} ${code.padEnd(4)} ` +
      `stt ${row.stt.padEnd(4)} ` +
      `orig ${String(row.originalLocale).padEnd(7)} ` +
      `xlate ${row.translation.padEnd(5)} ` +
      `adr ${row.fields.padEnd(6)} ` +
      `tts ${String(row.ttsLocale).padEnd(7)} ${row.ttsVoice}` +
      (row.note ? GREY(`  (${row.note})`) : ''),
  );
}

const ORDER = ['working', 'fallback', 'provider', 'app-bug', 'unknown'];
const tally = rows.reduce((counts, row) => {
  counts[row.verdict] = (counts[row.verdict] ?? 0) + 1;
  return counts;
}, {});

console.log(`\n${rule('=')}`);
for (const verdict of ORDER) {
  if (tally[verdict]) {
    console.log(`  ${verdict.padEnd(10)} ${tally[verdict]}`);
  }
}
console.log(rule('='));

const bugs = rows.filter(row => row.verdict === 'app-bug');

const md = [
  '# TTS language matrix — measured live',
  '',
  '_Generated by `npm run verify:e2e`. Do not edit by hand._',
  '',
  'Every row with a voice is a real round trip: the dictation is synthesised by',
  'Anuvadini TTS, the audio is sent to Anuvadini STT, the transcript is translated by',
  'Pravah, the ADR fields are extracted, and then the production `speakMissingFields`',
  'call is made — with the HTTP body captured, so the locale and voice recorded below',
  'are the ones that actually went to the provider, not ones inferred from the code.',
  '',
  'The report is written in English at the moment of that last call. The acceptance',
  'criterion is that the prompt is still requested in the dictated language.',
  '',
  '**The audio is synthesised, not spoken.** The microphone, the on-device recogniser,',
  'accents and background noise are NOT exercised here — see',
  '`docs/device-acceptance-checklist.md` for the steps that close those rows.',
  '',
  '| Language | STT | Original locale | Translation | ADR fields | TTS locale | TTS voice | Result |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map(
    row =>
      `| ${row.name} (\`${row.code}\`) | ${row.stt} | ${row.originalLocale} | ${row.translation} ` +
      `| ${row.fields} | ${row.ttsLocale} | ${row.ttsVoice} | **${row.verdict}**` +
      `${row.note ? ` — ${row.note}` : ''} |`,
  ),
  '',
  '## Verdicts',
  '',
  '- **working** — the dictated language was requested, its own voice was selected, and',
  '  the provider returned audio.',
  '- **fallback** — no voice exists for the language, and the designed fallback was used',
  '  (Devanagari scripts fall back to Hindi, everything else to English). A provider',
  '  limitation handled deliberately, not a defect.',
  '- **provider** — a voice exists and was correctly requested, but the service could',
  '  not serve it.',
  '- **app-bug** — the application asked for the wrong language or voice. Any row here',
  '  fails the acceptance criterion.',
  '',
  ...ORDER.filter(verdict => tally[verdict]).map(verdict => `- ${verdict}: ${tally[verdict]}`),
  '',
  bugs.length
    ? `**${bugs.length} application bug(s):** ${bugs.map(row => row.code).join(', ')}.`
    : '**No application bugs.** No row silently converted the dictated language into English.',
  '',
];

writeFileSync(join(HERE, '..', 'docs', 'tts-language-matrix.md'), `${md.join('\n')}\n`, 'utf8');
console.log('wrote docs/tts-language-matrix.md');

process.exit(bugs.length ? 1 : 0);
