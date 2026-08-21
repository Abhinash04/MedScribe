import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { translateTexts } from '../src/services/pravah/translationClient.js';
import { PRAVAH_TARGET_ENGLISH } from '../src/services/pravah/translationContract.js';
import { toLatinDigits } from '../src/utils/numerals.js';
import { sampleFor } from './fixtures/dictation-samples.mjs';
import { flag } from './lib/cli-flags.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function keyFromServerEnv() {
  const path = join(HERE, '..', 'server', '.env');
  if (!existsSync(path)) {
    return '';
  }
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^PRAVAH_API_KEY=(.*)$/.exec(line.trim());
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

const key = process.env.PRAVAH_API_KEY || keyFromServerEnv();
if (!key) {
  console.error('PRAVAH_API_KEY is not set and server/.env has no value for it.');
  process.exit(1);
}

const CANDIDATES = {
  'XQ_QX': index => `XQ${letters(index)}QX`,
  'NUM_': index => `NUM${letters(index)}`,
  'brackets': index => `[${letters(index)}]`,
  'doubled': index => `xx${letters(index)}xx`,
};

function letters(index) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let remaining = index;
  let out = '';
  do {
    out = ALPHABET[remaining % 26] + out;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return out;
}

const langs = (flag('langs') ?? 'or,hi,ta,ur,ml,bn').split(',').filter(Boolean);
const samples = (flag('samples') ?? '1,14').split(',').map(Number).filter(Boolean);
const delay = Number(flag('delay') ?? 1200);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const NUMERAL_RUN = /\d+(?:\.\d+)?/g;

console.log('token'.padEnd(10), 'lang/id'.padEnd(9), 'sent', 'back', 'intact');
console.log('-'.repeat(52));

const score = {};

for (const [name, build] of Object.entries(CANDIDATES)) {
  score[name] = { intact: 0, sent: 0, failures: [] };

  for (const code of langs) {
    for (const id of samples) {
      const sample = sampleFor(code, id);
      if (!sample) {
        continue;
      }

      let count = 0;
      const masked = toLatinDigits(sample.text).replace(NUMERAL_RUN, () =>
        build(count++),
      );
      const tokens = Array.from({ length: count }, (unused, index) => build(index));

      const result = await translateTexts({
        texts: [masked],
        to: PRAVAH_TARGET_ENGLISH,
        key,
        url: process.env.PRAVAH_API_URL || undefined,
      });
      await sleep(delay);

      if (!result.ok) {
        console.log(
          `${name.padEnd(10)} ${`${code}/${id}`.padEnd(9)} ${String(count).padEnd(4)} ` +
            `-    ${result.errorKind}`,
        );
        continue;
      }

      const back = result.texts[0] ?? '';
      const intact = tokens.filter(
        token => (back.match(new RegExp(token.replace(/[[\]]/g, '\\$&'), 'g')) ?? []).length === 1,
      ).length;

      score[name].sent += count;
      score[name].intact += intact;
      if (intact < count) {
        score[name].failures.push(`${code}/${id}: ${back.slice(0, 110)}`);
      }

      console.log(
        `${name.padEnd(10)} ${`${code}/${id}`.padEnd(9)} ${String(count).padEnd(4)} ` +
          `${String(intact).padEnd(4)} ${intact === count ? 'yes' : 'NO'}`,
      );
    }
  }
}

console.log(`\n${'='.repeat(52)}`);
const ranked = Object.entries(score).sort(
  (a, b) => b[1].intact / (b[1].sent || 1) - a[1].intact / (a[1].sent || 1),
);
for (const [name, stats] of ranked) {
  const pct = stats.sent ? ((100 * stats.intact) / stats.sent).toFixed(1) : '0.0';
  console.log(`${name.padEnd(10)} ${stats.intact}/${stats.sent} tokens survived (${pct}%)`);
}
console.log('\nfirst corrupted response per losing candidate:');
for (const [name, stats] of ranked) {
  if (stats.failures.length) {
    console.log(`  ${name}: ${stats.failures[0]}`);
  }
}
