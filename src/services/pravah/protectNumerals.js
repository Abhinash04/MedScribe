import { numeralTokens, toLatinDigits } from '../../utils/numerals.js';
const PREFIX = '[';
const SUFFIX = ']';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function lettersFor(index) {
  let remaining = Number(index);
  let letters = '';
  do {
    letters = LETTERS[remaining % 26] + letters;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return letters;
}

export function sentinelFor(index) {
  return `${PREFIX}${lettersFor(index)}${SUFFIX}`;
}
function sentinelPattern(index) {
  return new RegExp(`\\[\\s*${lettersFor(index)}\\s*\\]`, 'gi');
}

const NUMERAL_RUN = /\d+(?:\.\d+)?/g;
const needsProtection = value => value.includes('.') || /^\d{4}$/.test(value);

export function protect(text) {
  const source = String(text ?? '');
  const latin = toLatinDigits(source);
  const entities = [];

  const masked = latin.replace(NUMERAL_RUN, match => {
    if (!needsProtection(match)) {
      return match;
    }
    const token = sentinelFor(entities.length);
    entities.push({ index: entities.length, value: match, token });
    return token;
  });

  return { masked, entities };
}
export function restore(translated, entities) {
  let text = String(translated ?? '');
  const missing = [];
  const duplicated = [];

  for (const entity of entities ?? []) {
    const pattern = sentinelPattern(entity.index);
    const hits = text.match(pattern)?.length ?? 0;

    if (hits === 0) {
      missing.push(entity);
      continue;
    }
    if (hits > 1) {
      duplicated.push(entity);
    }
    text = text.replace(pattern, entity.value);
  }

  return {
    text,
    restored: (entities?.length ?? 0) - missing.length,
    missing,
    duplicated,
  };
}

export function reconcile(sourceText, resultText) {
  const expected = numeralTokens(sourceText);
  const actual = numeralTokens(resultText);
  const matched =
    expected.length === actual.length &&
    expected.every((value, index) => value === actual[index]);

  return {
    expected: expected.length,
    actual: actual.length,
    matched,
    lost: expected.filter(value => !actual.includes(value)),
  };
}

export function stripSentinels(text) {
  return String(text ?? '')
    .replace(/\[\s*[A-Z]{1,3}\s*\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

export const SENTINEL_PREFIX = PREFIX;
export const SENTINEL_SUFFIX = SUFFIX;
