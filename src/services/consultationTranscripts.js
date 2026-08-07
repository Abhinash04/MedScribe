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
    /**
     * One entry per recording pass, in dictation order: `{ index, text }`.
     *
     * This is the stored truth, and `raw` is derived from it. The previous
     * design rebuilt the combined transcript by arithmetic on a snapshot held
     * in a module-level global, which meant a continuation whose snapshot was
     * missing REPLACED the whole transcript instead of extending it, and a
     * pass that never ran left no trace at all.
     */
    passes: [],
    /**
     * The editable draft as it stood before the newest pass contributed.
     *
     * Retrying that pass rebuilds `text` from here, so a replay appends its
     * speech exactly once while every earlier correction the doctor made
     * survives. It lives in state rather than in a global so it cannot go
     * missing between the pass starting and its result landing.
     */
    textBase: '',
    status: ANUVADINI_STATUS.IDLE,
    error: null,
    updatedAt: 0,
  };
}

/**
 * Fills in the pass list for state saved before it existed.
 *
 * An older consultation carries `raw` but no passes; it reads as a single
 * completed pass, so a continuation on top of it appends rather than replacing.
 */
export function normalizeAnuvadini(anuvadini) {
  const current = { ...emptyAnuvadini(), ...anuvadini };
  if (Array.isArray(current.passes) && current.passes.length) {
    return current;
  }
  if (!current.raw?.trim()) {
    return { ...current, passes: [] };
  }
  return { ...current, passes: [{ index: 1, text: current.raw }], textBase: '' };
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
const upsertPass = (passes, index, text) =>
  [...passes.filter(pass => pass.index !== index), { index, text }].sort(
    (a, b) => a.index - b.index,
  );

export function applyResult(anuvadini, result, options = {}) {
  const { now = Date.now() } = options;
  const current = normalizeAnuvadini(anuvadini);

  if (!(result?.ok && result.text)) {
    return {
      ...current,
      status: ANUVADINI_STATUS.FAILED,
      error: result?.errorKind || 'unknown',
      updatedAt: now,
    };
  }

  const highest = current.passes.reduce((max, pass) => Math.max(max, pass.index), 0);
  const requested = Number(options.passIndex);
  const index = Number.isFinite(requested) && requested > 0 ? requested : highest + 1;

  // Only a genuinely new pass moves the base. A replay of the newest one must
  // rebuild from the same place or its speech would append a second time.
  const textBase = index > highest ? current.text : current.textBase ?? '';
  const passes = upsertPass(current.passes, index, result.text);
  const newest = passes[passes.length - 1];

  return {
    text: joined(textBase, newest.text),
    textBase,
    raw: passes.map(pass => pass.text).join(JOIN),
    passes,
    status: ANUVADINI_STATUS.READY,
    error: null,
    updatedAt: now,
  };
}

/** The pass number the next continuation recording will land under. */
export function nextPassIndex(anuvadini) {
  return (
    normalizeAnuvadini(anuvadini).passes.reduce(
      (max, pass) => Math.max(max, pass.index),
      0,
    ) + 1
  );
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
