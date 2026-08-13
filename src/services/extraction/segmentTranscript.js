const MERGEABLE_FIELDS = new Set(['symptoms', 'prescriptionNotes', 'additionalRemarks']);

export function segmentTranscript(text, markers, classify = segment => segment) {
  return mergeAdjacentSameField(buildSegments(text, markers).map(classify), text);
}

function mergeAdjacentSameField(segments, text) {
  const merged = [];

  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    const repeats = previous && isRepeatOf(previous.value, segment.value);

    if (previous && previous.field === segment.field && repeats) {
      continue;
    }

    const polarityBreak =
      previous &&
      NEGATED.test(previous.value) &&
      /[.;?!]/.test(text.slice(previous.end, segment.start));

    const restatement =
      previous &&
      !MERGEABLE_FIELDS.has(segment.field) &&
      /[.;?!]/.test(text.slice(previous.end, segment.start));

    if (
      previous &&
      previous.field === segment.field &&
      !polarityBreak &&
      !restatement
    ) {
      previous.value = text.slice(previous.start, segment.end);
      previous.end = segment.end;
      previous.confidence = Math.max(previous.confidence, segment.confidence);
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}

const NEGATED = /\b(?:no|not|without|denies|denied|negative\s+for|nil)\b/i;

function isRepeatOf(previousValue, value) {
  const candidate = normalizedValue(value);
  const earlier = normalizedValue(previousValue);
  if (!candidate || !earlier) {
    return false;
  }
  return ` ${earlier} `.includes(` ${candidate} `);
}

const normalizedValue = value =>
  (value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function buildSegments(text, markers) {
  return markers.map((marker, index) => {
    const next = markers[index + 1];
    const markerEnd = next ? next.start : text.length;

    const sentenceEnd = findSentenceEnd(text, marker.valueStart, markerEnd);
    const end = Math.min(markerEnd, sentenceEnd);

    return {
      field: marker.field,
      value: text.slice(marker.valueStart, end),
      start: marker.valueStart,
      end,
      markerStart: marker.start,
      confidence: marker.confidence,
      source: marker.source,
    };
  });
}

const ABBREVIATIONS = /(?:^|\s)(?:dr|mr|mrs|ms|prof|st)$/i;

export function findSentenceEnd(text, from, limit) {
  for (let i = from; i < limit; i += 1) {
    const char = text[i];
    if (char !== '.' && char !== ';' && char !== '?' && char !== '!') {
      continue;
    }

    if (char === '.' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) {
      continue; // decimal number
    }

    if (text[i + 1] === '.' || text[i - 1] === '.') {
      continue;
    }

    if (char === '.' && ABBREVIATIONS.test(text.slice(Math.max(0, i - 4), i))) {
      continue;
    }

    // "House No. 24" / "Flat No. 12" — an abbreviation for "number", not a
    // sentence end. Indian addresses use it constantly, and breaking here
    // truncates the address to "House No". Kept narrow: only when a digit
    // follows, so a sentence genuinely ending in the word "no" still breaks.
    if (
      char === '.' &&
      /(?:^|\s)no$/i.test(text.slice(Math.max(0, i - 3), i)) &&
      /^\s*\d/.test(text.slice(i + 1, i + 4))
    ) {
      continue;
    }

    const after = text[i + 1];
    if (after === undefined || /\s/.test(after)) {
      return i;
    }
  }

  return limit;
}

export function unclaimedRanges(text, markers, segments = []) {
  if (!markers.length) {
    return text.length ? [{ start: 0, end: text.length }] : [];
  }

  const ranges = [];
  let cursor = 0;

  for (const marker of markers) {
    if (marker.start > cursor) {
      ranges.push({ start: cursor, end: marker.start });
    }
    cursor = Math.max(cursor, marker.start);
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment && lastSegment.end < text.length) {
    ranges.push({ start: lastSegment.end, end: text.length });
  }

  return ranges;
}
