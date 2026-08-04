import {
  CLAUSE_BREAK,
  CONTRAST_WORDS,
  NEGATION_ALTERNATION,
  NEGATION_CUES,
  NEGATION_TERMINATORS,
} from '../../constants/clinicalCues.js';

/**
 * NegEx-lite scoping. A cue negates from its own position to the first
 * terminator — sentence end or a contrast word. Nothing is rewritten; the
 * ranges are consulted by whoever builds a list.
 */
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

/**
 * Item separators for a findings list. "or" joins negated alternatives.
 *
 * Built from the same clause boundary a negation scopes to, so a cue can never
 * stop covering text that still belongs to the item it was scoping. Punctuation
 * must be followed by space or end of string — "fever 101.5 degrees" is one
 * finding, not two.
 */
const SEPARATOR = new RegExp(
  `\\s*${CLAUSE_BREAK}(?:\\s+|$)|\\s*,\\s*|\\s+(?:${CONTRAST_WORDS}|and|or|aur|bhi)\\s+`,
  'i',
);

/**
 * Splits a findings phrase into positive and negated items.
 *
 * "fever and cough but no chest pain or breathing difficulty"
 *   -> positive ["fever", "cough"], negative ["chest pain", "breathing difficulty"]
 *
 * The negation cue itself is stripped from the item it introduces, so the
 * caller renders "chest pain" rather than "no chest pain".
 */
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

    // "but no chest pain" — the contrast word belongs to neither item.
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

/** Built from the same alternation `negatedRanges` scopes with, so no cue can
 *  scope an item and then survive into the rendered text. */
const LEADING_CUE = new RegExp(`^\\s*(?:${NEGATION_ALTERNATION})\\s+`, 'i');

function stripCue(item) {
  return item
    .replace(LEADING_CUE, '')
    .replace(/^\s*(?:any|of)\s+/i, '')
    .trim();
}
