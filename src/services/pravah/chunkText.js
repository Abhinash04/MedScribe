import { MAX_BATCH_CHARS, MAX_BATCH_ITEMS } from './translationClient.js';

export const DEFAULT_CHUNK_CHARS = 900;

export const SENTENCE_TERMINATORS = '.?!।॥۔؟᱾᱿';

const SENTENCE_SPLIT = /(?<=[.?!।॥۔؟᱾᱿])\s+/u;

const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();

function hardSplit(sentence, maxChars) {
  const pieces = [];
  let rest = sentence;

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars + 1);
    const breakAt = window.lastIndexOf(' ');
    const cut = breakAt > 0 ? breakAt : maxChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) {
    pieces.push(rest);
  }
  return pieces;
}

export function splitForTranslation(text, maxChars = DEFAULT_CHUNK_CHARS) {
  const source = normalize(text);
  if (!source) {
    return [];
  }

  const sentences = source
    .split(SENTENCE_SPLIT)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .flatMap(sentence =>
      sentence.length > maxChars ? hardSplit(sentence, maxChars) : [sentence],
    );

  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (current.length + 1 + sentence.length <= maxChars) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export function planBatches(
  chunks,
  { maxItems = MAX_BATCH_ITEMS, maxChars = MAX_BATCH_CHARS } = {},
) {
  const batches = [];
  let current = [];
  let chars = 0;

  for (const chunk of chunks) {
    const wouldExceed =
      current.length >= maxItems || chars + chunk.length > maxChars;

    if (current.length && wouldExceed) {
      batches.push(current);
      current = [];
      chars = 0;
    }

    current.push(chunk);
    chars += chunk.length;
  }

  if (current.length) {
    batches.push(current);
  }
  return batches;
}

export function joinTranslated(texts) {
  return (Array.isArray(texts) ? texts : [])
    .map(text => String(text ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
