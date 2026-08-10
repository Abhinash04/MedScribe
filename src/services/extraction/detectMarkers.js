import { FIELD_MARKERS } from '../../constants/fieldMarkers.js';

export function detectMarkers(text) {
  const found = [];

  for (const [field, config] of Object.entries(FIELD_MARKERS)) {
    for (const marker of config.markers) {
      const pattern = new RegExp(
        marker.pattern.source,
        marker.pattern.flags.includes('g')
          ? marker.pattern.flags
          : `${marker.pattern.flags}g`,
      );

      let match = pattern.exec(text);
      while (match) {
        found.push({
          field,
          start: match.index,
          valueStart: match.index + match[0].length,
          confidence: marker.confidence,
          source: marker.source,
        });

        pattern.lastIndex =
          match[0].length === 0 ? match.index + 1 : pattern.lastIndex;
        match = pattern.exec(text);
      }
    }
  }

  return suppressWeakInsideStrong(resolveOverlaps(found), text);
}

const CONFIDENCE_GAP = 0.2;

function suppressWeakInsideStrong(markers, text) {
  const kept = [];
  let previous = null;

  for (const marker of markers) {
    if (previous === null) {
      kept.push(marker);
      previous = marker;
      continue;
    }

    const sentenceBreak = /[.;?!]/.test(text.slice(previous.start, marker.start));
    const withinGap = previous.confidence - marker.confidence < CONFIDENCE_GAP;

    if (sentenceBreak || withinGap) {
      kept.push(marker);
      previous = marker;
    }
  }

  return kept;
}

/**
 * Keeps the most specific marker where several match at or near the same spot.
 *
 * "patient name is" and "name is" both match the same phrase; without this the
 * looser one would open a second, wrong segment. Longer match wins; ties go to
 * higher confidence.
 */
function resolveOverlaps(markers) {
  const sorted = [...markers].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    const aLen = a.valueStart - a.start;
    const bLen = b.valueStart - b.start;
    if (aLen !== bLen) {
      return bLen - aLen;
    }
    return b.confidence - a.confidence;
  });

  const kept = [];
  for (const marker of sorted) {
    const clashes = kept.some(
      existing =>
        marker.start < existing.valueStart && marker.valueStart > existing.start,
    );
    if (!clashes) {
      kept.push(marker);
    }
  }

  return kept.sort((a, b) => a.start - b.start);
}
