import { FILLER_PATTERN } from '../../constants/fieldMarkers.js';

export function normalizeTranscript(transcript) {
  const original = typeof transcript === 'string' ? transcript : '';
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
  let lastWasSpace = true;

  for (let i = 0; i < original.length; i += 1) {
    if (dropped[i]) {
      continue;
    }

    const char = original[i];
    const isSpace = /\s/.test(char);

    if (isSpace) {
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

  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    indexMap.pop();
  }

  return { text, indexMap, original };
}

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
