import { FILLER_PATTERN } from '../../constants/fieldMarkers.js';

/**
 * Stage 1 — normalize the transcript for matching.
 *
 * Removing fillers and collapsing whitespace shifts every character position,
 * so any offset recorded against the normalized string points somewhere else
 * in the original. Those bad offsets look perfectly valid, which makes them
 * worse than having none at all.
 *
 * This therefore emits an index map alongside the normalized text:
 * `indexMap[i]` is the position in the ORIGINAL transcript of the character at
 * position `i` in the normalized one. Every offset the pipeline reports is
 * translated back through it.
 *
 * @param {string} transcript
 * @returns {{ text: string, indexMap: number[], original: string }}
 */
export function normalizeTranscript(transcript) {
  const original = typeof transcript === 'string' ? transcript : '';

  // Mark filler spans first; drop them character-by-character below so the
  // index map stays exact.
  const dropped = new Array(original.length).fill(false);
  FILLER_PATTERN.lastIndex = 0;
  let match = FILLER_PATTERN.exec(original);
  while (match) {
    for (let i = match.index; i < match.index + match[0].length; i += 1) {
      dropped[i] = true;
    }
    match = FILLER_PATTERN.exec(original);
  }

  let text = '';
  const indexMap = [];
  let lastWasSpace = true; // trims leading whitespace

  for (let i = 0; i < original.length; i += 1) {
    if (dropped[i]) {
      continue;
    }

    const char = original[i];
    const isSpace = /\s/.test(char);

    if (isSpace) {
      // Collapse runs of whitespace to a single space.
      if (lastWasSpace) {
        continue;
      }
      text += ' ';
      indexMap.push(i);
      lastWasSpace = true;
      continue;
    }

    text += char;
    indexMap.push(i);
    lastWasSpace = false;
  }

  // Drop a single trailing space produced by the collapse above.
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    indexMap.pop();
  }

  return { text, indexMap, original };
}

/**
 * Translates a [start, end) range in normalized space back to the original
 * transcript. `end` is exclusive, so it maps via the last included character.
 */
export function toOriginalRange(indexMap, start, end) {
  if (!indexMap.length) {
    return { start: 0, end: 0 };
  }

  const safeStart = Math.max(0, Math.min(start, indexMap.length - 1));
  const lastIncluded = Math.max(safeStart, Math.min(end, indexMap.length) - 1);

  return {
    start: indexMap[safeStart],
    end: indexMap[lastIncluded] + 1,
  };
}
