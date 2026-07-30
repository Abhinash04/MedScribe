import { FIELD_MARKERS } from '../../constants/fieldMarkers.js';

/**
 * Stage 2 — find every field introducer in the transcript, with positions.
 *
 * Every marker of every field is searched across the whole text. Nothing here
 * assumes an order, and no field's rules depend on any other field's.
 *
 * @param {string} text normalized transcript
 * @returns {Array<{field, start, valueStart, confidence, source}>}
 */
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
          // Zero-width markers (lookaheads like "N years old") keep the
          // matched text as part of the value.
          valueStart: match.index + match[0].length,
          confidence: marker.confidence,
          source: marker.source,
        });

        // Guard against zero-length matches looping forever.
        pattern.lastIndex =
          match[0].length === 0 ? match.index + 1 : pattern.lastIndex;
        match = pattern.exec(text);
      }
    }
  }

  return suppressWeakInsideStrong(resolveOverlaps(found), text);
}

/**
 * Drops a weak marker when a clearly stronger one opened a segment earlier in
 * the same sentence.
 *
 * "Remarks: Patient advised for blood tests" contains the weak `advised`
 * prescription marker inside a strongly-marked remarks value. Left alone it
 * splits the sentence and steals the text, yielding remarks="Patient" and a
 * prescription holding the remarks. A hedged phrase inside a strongly-marked
 * value is part of that value.
 */
const CONFIDENCE_GAP = 0.2;

function suppressWeakInsideStrong(markers, text) {
  const kept = [];
  // Compare against the last marker actually RETAINED, not markers[index - 1].
  // Once a marker is suppressed it is no longer part of the output, so
  // measuring the gap against it would be measuring against something that
  // does not exist downstream.
  let previous = null;

  for (const marker of markers) {
    if (previous === null) {
      kept.push(marker);
      previous = marker;
      continue;
    }

    // Only the immediately preceding kept marker is considered. Scanning
    // further back is wrong for unpunctuated speech, where the entire
    // transcript is a single "sentence" and one early strong marker would
    // suppress every later weak one.
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
