/**
 * Stage 3 — slice the transcript into per-field segments.
 *
 * This is the core of the redesign. A segment runs from its marker to
 * wherever the NEXT marker begins — whatever field that next marker happens to
 * belong to. No field needs to know what may follow it, which is what makes
 * arbitrary dictation order work by construction rather than by enumerating
 * every possible ordering.
 *
 * @param {string} text normalized transcript
 * @param {Array} markers from detectMarkers, sorted by position
 * @returns {Array<{field, value, start, end, confidence, source}>}
 */
/**
 * Fields whose value is a list keep merging across sentences — a doctor lists
 * symptoms and remarks in several breaths. A scalar field restated in a LATER
 * sentence is a correction, not a continuation, and merging it concatenates
 * the old value onto the new one.
 */
const MERGEABLE_FIELDS = new Set(['symptoms', 'prescriptionNotes', 'additionalRemarks']);

export function segmentTranscript(text, markers, classify = segment => segment) {
  // Classification runs BEFORE merging: "has had diabetes for ten years" and
  // "presents with fever" are both symptoms markers, so merging first would
  // fuse a chronic condition onto an acute complaint and hide the distinction.
  return mergeAdjacentSameField(buildSegments(text, markers).map(classify), text);
}

/**
 * Joins consecutive segments belonging to the same field.
 *
 * "Additional remarks: advise hydration, CBC investigation, and review after
 * three days" contains two remarks markers. Treating them as rivals makes
 * conflict resolution discard one and leaves the survivor truncated at "and".
 * They are one remark, so they are concatenated instead.
 */
function mergeAdjacentSameField(segments, text) {
  const merged = [];

  for (const segment of segments) {
    const previous = merged[merged.length - 1];

    // A recognizer restart repeats a whole phrase; merging the repeat would
    // build "fever and cough. Complains of fever and cough".
    //
    // Matched on whole tokens, not as a substring: "fever and cough" contains
    // "cough", so a substring test discarded a later, genuinely separate
    // "cough" segment.
    const repeats = previous && isRepeatOf(previous.value, segment.value);

    if (previous && previous.field === segment.field && repeats) {
      continue;
    }

    // "Patient denies chest pain. Complains of fever" is two opposite
    // statements; merging them would negate the second one too.
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

/**
 * A later segment whose entire value already appeared in the earlier one is a
 * restatement, not new content.
 *
 * Matched on whole tokens: a bare substring test also matched "cough" inside
 * "coughing". Empty values never count as a repeat — two blank segments are
 * not the same statement twice.
 */
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

    // A segment also ends at a sentence boundary. Without this a value runs
    // into the following sentence whenever no marker happens to follow it —
    // "diagnosis is viral infection. Let's start paracetamol. We'll also…".
    // Unpunctuated speech is unaffected: there is no boundary to find, so the
    // marker boundary above still governs.
    const sentenceEnd = findSentenceEnd(text, marker.valueStart, markerEnd);
    const end = Math.min(markerEnd, sentenceEnd);

    return {
      field: marker.field,
      value: text.slice(marker.valueStart, end),
      start: marker.valueStart,
      end,
      confidence: marker.confidence,
      source: marker.source,
    };
  });
}

/** Short titles whose trailing period is not a sentence end. */
const ABBREVIATIONS = /(?:^|\s)(?:dr|mr|mrs|ms|prof|st)$/i;

/**
 * First sentence-terminating punctuation in [from, limit), or `limit`.
 *
 * Decimals and abbreviations must not count: "500.5 mg" and "Dr. Rao" are not
 * sentence ends. A terminator only counts when followed by whitespace or the
 * end of the slice, not preceded by a digit, and not closing a known title.
 */
function findSentenceEnd(text, from, limit) {
  for (let i = from; i < limit; i += 1) {
    const char = text[i];
    if (char !== '.' && char !== ';' && char !== '?' && char !== '!') {
      continue;
    }

    if (char === '.' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) {
      continue; // decimal number
    }

    // Ellipsis ("32 years... sorry, 22 years") is a hesitation, not a sentence
    // end — self-correction handling needs the whole span. Check both
    // neighbours so every dot of the run is skipped, not just the first.
    if (text[i + 1] === '.' || text[i - 1] === '.') {
      continue;
    }

    // Titles are not sentence ends — "Dr. Rao advised rest" is one segment.
    if (char === '.' && ABBREVIATIONS.test(text.slice(Math.max(0, i - 4), i))) {
      continue;
    }

    const after = text[i + 1];
    if (after === undefined || /\s/.test(after)) {
      return i;
    }
  }

  return limit;
}

/**
 * Character ranges no marker segment claimed.
 *
 * Unmarked fallbacks ("female", a bare 6-digit number) may only look here —
 * otherwise a "male" inside an address, or the middle of a phone number, gets
 * mistaken for a field of its own.
 */
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

  // Text after the final marker normally belongs to that marker's segment.
  // But once sentence-boundary termination was added, the last segment often
  // stops at a full stop — and anything past it was in neither the segment nor
  // this pool, so trailing unmarked values (a bare PIN, a bare phone number)
  // became invisible to the fallbacks. Claim that tail exactly once.
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && lastSegment.end < text.length) {
    ranges.push({ start: lastSegment.end, end: text.length });
  }

  return ranges;
}
