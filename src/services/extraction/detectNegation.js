import {
  CLAUSE_BREAK,
  CONTRAST_WORDS,
  NEGATION_ALTERNATION,
  NEGATION_CUES,
  NEGATION_TERMINATORS,
} from '../../constants/clinicalCues.js';

export function negatedRanges(text) {
  const source = text || '';
  const regex = new RegExp(NEGATION_CUES.source, NEGATION_CUES.flags);
  const ranges = [];

  let match = regex.exec(source);
  while (match) {
    const from = match.index;
    const rest = source.slice(from + match[0].length);
    const stop = rest.search(NEGATION_TERMINATORS);
    ranges.push({
      start: from,
      end: stop === -1 ? source.length : from + match[0].length + stop,
      cue: match[0].toLowerCase(),
    });
    match = regex.exec(source);
  }

  return ranges;
}

const isNegated = (ranges, index) =>
  ranges.some(range => index >= range.start && index < range.end);

const SEPARATOR = new RegExp(
  `\\s*${CLAUSE_BREAK}(?:\\s+|$)|\\s*,\\s*|\\s+(?:${CONTRAST_WORDS}|and|or|aur|bhi)\\s+`,
  'i',
);

export function splitFindings(text) {
  const source = (text || '').trim();
  if (!source) {
    return { positive: [], negative: [] };
  }

  const ranges = negatedRanges(source);
  const positive = [];
  const negative = [];

  let cursor = 0;
  const parts = source.split(SEPARATOR);

  for (const part of parts) {
    if (!part) {
      continue;
    }
    const index = source.indexOf(part, cursor);
    const at = index === -1 ? cursor : index;
    cursor = at + part.length;

    const cleaned = part
      .replace(/^\s*(?:but|however|though|although)\s+/i, '')
      .trim();
    if (!cleaned) {
      continue;
    }

    const offset = at + (part.length - cleaned.length);
    const target = isNegated(ranges, offset) || isNegated(ranges, at) ? negative : positive;
    target.push(stripCue(cleaned));
  }

  return {
    positive: positive.filter(Boolean),
    negative: negative.filter(Boolean),
  };
}

const LEADING_CUE = new RegExp(`^\\s*(?:${NEGATION_ALTERNATION})\\s+`, 'i');

function stripCue(item) {
  return item
    .replace(LEADING_CUE, '')
    .replace(/^\s*(?:any|of)\s+/i, '')
    .trim();
}
