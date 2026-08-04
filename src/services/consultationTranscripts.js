/**
 * Two candidate transcripts for one consultation, and the rules for moving
 * between them.
 *
 * The native recognizer and Anuvadini transcribe the same dictation into two
 * independent texts. Neither may overwrite the other: the doctor picks which
 * one the report is derived from, and can go back. Pure and free of React
 * Native imports so the rules are testable under plain Node.
 */

export const TRANSCRIPT_SOURCE = {
  NATIVE: 'native',
  ANUVADINI: 'anuvadini',
};

export const ANUVADINI_STATUS = {
  IDLE: 'idle',
  PENDING: 'pending',
  READY: 'ready',
  FAILED: 'failed',
};

export function emptyAnuvadini() {
  return {
    text: '',
    // What the service returned, frozen. `text` is the editable draft; this is
    // the comparison baseline, so a doctor's edit can never rewrite what the
    // diff says the AI changed.
    raw: '',
    status: ANUVADINI_STATUS.IDLE,
    error: null,
    updatedAt: 0,
  };
}

/** The text extraction and the report must read. */
export function activeText({ nativeText, anuvadini, source }) {
  if (source === TRANSCRIPT_SOURCE.ANUVADINI && anuvadini?.text) {
    return anuvadini.text;
  }
  return nativeText || '';
}

export function markPending(anuvadini) {
  return {
    ...emptyAnuvadini(),
    ...anuvadini,
    status: ANUVADINI_STATUS.PENDING,
    error: null,
  };
}

/** Continuation passes read as separate lines rather than one running block. */
const JOIN = '\n';

const joined = (before, addition) =>
  before?.trim() ? `${before.trim()}${JOIN}${addition}` : addition;

/**
 * Folds a transcription result into the Anuvadini slot.
 *
 * A failure keeps whatever text was already there — a doctor who retries after
 * accepting a result must not lose it — and never touches the native side.
 *
 * A continuation appends to `base`, a snapshot taken when that continuation was
 * recorded, rather than to live state:
 *
 *   raw  = base.raw  + new    only what the service actually produced
 *   text = base.text + new    the doctor's corrections survive
 *
 * Appending to the snapshot is what makes Retry idempotent — replaying the same
 * continuation any number of times yields exactly one appended chunk.
 */
export function applyResult(anuvadini, result, options = {}) {
  const { append = false, base = null, now = Date.now() } = options;
  const current = { ...emptyAnuvadini(), ...anuvadini };

  if (result?.ok && result.text) {
    const from = append ? base ?? current : null;
    return {
      text: from ? joined(from.text, result.text) : result.text,
      raw: from ? joined(from.raw, result.text) : result.text,
      status: ANUVADINI_STATUS.READY,
      error: null,
      updatedAt: now,
    };
  }

  return {
    ...current,
    status: ANUVADINI_STATUS.FAILED,
    error: result?.errorKind || 'unknown',
    updatedAt: now,
  };
}

/** The snapshot a continuation appends to. Taken when its recording starts. */
export function continuationBaseFrom(anuvadini) {
  const current = { ...emptyAnuvadini(), ...anuvadini };
  return { text: current.text, raw: current.raw };
}

/**
 * True when the doctor may be offered the alternative transcript.
 *
 * An empty or identical result is not an alternative, and offering one would
 * ask the doctor to make a decision with no content behind it.
 */
export function canOffer({ nativeText, anuvadini }) {
  return (
    anuvadini?.status === ANUVADINI_STATUS.READY &&
    !!anuvadini.text?.trim() &&
    anuvadini.text.trim() !== (nativeText || '').trim()
  );
}

/** Refuses a switch to a source that has nothing behind it. */
export function switchSource({ nativeText, anuvadini, source }, next) {
  if (next === TRANSCRIPT_SOURCE.ANUVADINI) {
    return canOffer({ nativeText, anuvadini }) ? next : source;
  }
  return TRANSCRIPT_SOURCE.NATIVE;
}
