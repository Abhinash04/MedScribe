import { CRITICAL_VALUES, FIXTURE_SCRIPT } from './dictationFixture.js';

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(text) {
  const clean = normalize(text);
  return clean ? clean.split(' ') : [];
}

/**
 * Spoken-to-digit forms the engine may return instead of the dictated words.
 * Longest phrases first so "twenty two" is not consumed by "two".
 */
const NUMBER_PHRASES = [
  ['five hundred', '500'],
  ['twenty two', '22'],
  ['twelve', '12'],
];

/**
 * Collapses spoken numbers so the dictated form and the engine's digit form
 * score as the same token. Applied to both sides of every comparison —
 * otherwise a perfect transcript scores ~64% purely on notation.
 */
export function digitFolded(text) {
  let source = normalize(text);
  NUMBER_PHRASES.forEach(([phrase, digits]) => {
    source = source.split(phrase).join(digits);
  });
  const out = [];
  let run = '';
  tokens(source).forEach(token => {
    const digit = NUMBER_WORDS[token];
    if (digit) {
      run += digit;
      return;
    }
    if (run) {
      out.push(run);
      run = '';
    }
    out.push(token);
  });
  if (run) {
    out.push(run);
  }
  return out.join(' ');
}

export function overallRecall(transcript, script = FIXTURE_SCRIPT) {
  const expected = tokens(digitFolded(script));
  if (expected.length === 0) {
    return { recall: 0, hits: 0, total: 0, missing: [] };
  }
  const heard = new Set(tokens(digitFolded(transcript)));
  const missing = expected.filter(word => !heard.has(word));
  const hits = expected.length - missing.length;
  return {
    recall: hits / expected.length,
    hits,
    total: expected.length,
    missing: [...new Set(missing)],
  };
}

/**
 * Joins adjacent digit groups: the engine returns "9876 543210" for a dictated
 * ten-digit number, which is the same value. The extraction pipeline already
 * handles spaced digits, so the scorer must not report a miss the app recovers.
 */
function joinDigitRuns(text) {
  return text.replace(/(\d)[\s-]+(?=\d)/g, '$1');
}

export function criticalRecall(transcript, values = CRITICAL_VALUES) {
  const forms = [
    normalize(transcript),
    digitFolded(transcript),
    joinDigitRuns(digitFolded(transcript)),
  ];
  const results = values.map(value => ({
    key: value.key,
    label: value.label,
    found: value.variants.some(variant => {
      const needles = [normalize(variant), joinDigitRuns(digitFolded(variant))];
      return forms.some(form => needles.some(needle => form.includes(needle)));
    }),
  }));
  return {
    results,
    hits: results.filter(item => item.found).length,
    total: results.length,
    missing: results.filter(item => !item.found).map(item => item.label),
  };
}

/**
 * Repeated tokens where one final's tail reappears at the next final's head —
 * the signature of a restart that replayed audio it had already transcribed.
 */
export function duplicatesAcrossBoundaries(finals, window = 6) {
  let count = 0;
  const examples = [];
  for (let index = 1; index < finals.length; index += 1) {
    const previous = tokens(finals[index - 1]).slice(-window);
    const next = tokens(finals[index]).slice(0, window);
    let overlap = 0;
    for (let size = Math.min(previous.length, next.length); size > 0; size -= 1) {
      if (previous.slice(-size).join(' ') === next.slice(0, size).join(' ')) {
        overlap = size;
        break;
      }
    }
    if (overlap > 0) {
      count += overlap;
      examples.push(next.slice(0, overlap).join(' '));
    }
  }
  return { count, examples };
}

export function gapStats(gaps) {
  if (!gaps.length) {
    return { median: 0, max: 0, count: 0 };
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
      : sorted[middle];
  return { median, max: sorted[sorted.length - 1], count: sorted.length };
}

export function buildReport({ transcript, finals, gaps, counters, locale }) {
  const overall = overallRecall(transcript);
  const critical = criticalRecall(transcript);
  const duplicates = duplicatesAcrossBoundaries(finals);
  const gap = gapStats(gaps);

  return {
    overallRecall: Number((overall.recall * 100).toFixed(1)),
    overallHits: `${overall.hits}/${overall.total}`,
    missingWords: overall.missing,
    criticalRecall: `${critical.hits}/${critical.total}`,
    criticalMissing: critical.missing,
    criticalDetail: critical.results,
    sessions: counters.ready,
    restarts: counters.restarts,
    medianGapMs: gap.median,
    maxGapMs: gap.max,
    measuredGaps: gap.count,
    duplicateWords: duplicates.count,
    duplicateExamples: duplicates.examples,
    errorsByCode: counters.errorsByCode,
    fatalErrors: counters.fatal,
    partials: counters.partials,
    finals: counters.finals,
    locale,
    transcript,
  };
}
