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

/**
 * Folds a transcription result into the Anuvadini slot.
 *
 * A failure keeps whatever text was already there — a doctor who retries after
 * accepting a result must not lose it — and never touches the native side.
 */
export function applyResult(anuvadini, result, now = Date.now()) {
  const current = { ...emptyAnuvadini(), ...anuvadini };

  if (result?.ok && result.text) {
    return {
      text: result.text,
      raw: result.text,
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
