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
    raw: '',
    passes: [],
    textBase: '',
    edited: false,
    status: ANUVADINI_STATUS.IDLE,
    error: null,
    updatedAt: 0,
  };
}

export function editAnuvadini(anuvadini, text) {
  return {
    ...normalizeAnuvadini(anuvadini),
    text: text ?? '',
    edited: true,
  };
}

export function normalizeAnuvadini(anuvadini) {
  const current = { ...emptyAnuvadini(), ...anuvadini };
  if (Array.isArray(current.passes) && current.passes.length) {
    return current;
  }
  if (!current.raw?.trim()) {
    return { ...current, passes: [] };
  }
  return {
    ...current,
    passes: [{ index: 1, text: current.raw }],
    textBase: '',
  };
}

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

const JOIN = '\n';

const joined = (before, addition) =>
  before?.trim() ? `${before.trim()}${JOIN}${addition}` : addition;

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

  const highest = current.passes.reduce(
    (max, pass) => Math.max(max, pass.index),
    0,
  );
  const requested = Number(options.passIndex);
  const index =
    Number.isFinite(requested) && requested > 0 ? requested : highest + 1;
  const appending = index > highest;
  const textBase = appending ? current.text : current.textBase ?? '';
  const passes = upsertPass(current.passes, index, result.text);
  const newest = passes[passes.length - 1];
  const rebuilt = index < newest.index;

  const recovering = current.status === ANUVADINI_STATUS.FAILED;
  const keepsEdit = current.edited === true && !appending && !recovering;

  return {
    text: keepsEdit
      ? current.text
      : rebuilt
      ? passes.map(pass => pass.text).join(JOIN)
      : joined(textBase, newest.text),
    textBase,
    raw: passes.map(pass => pass.text).join(JOIN),
    passes,
    edited: keepsEdit || (current.edited === true && appending),
    status: ANUVADINI_STATUS.READY,
    error: null,
    updatedAt: now,
  };
}

export function nextPassIndex(anuvadini) {
  return (
    normalizeAnuvadini(anuvadini).passes.reduce(
      (max, pass) => Math.max(max, pass.index),
      0,
    ) + 1
  );
}

export function canOffer({ nativeText, anuvadini }) {
  return (
    anuvadini?.status === ANUVADINI_STATUS.READY &&
    !!anuvadini.text?.trim() &&
    anuvadini.text.trim() !== (nativeText || '').trim()
  );
}

export function shouldAutoSelectAi({ nativeText, anuvadini, source, chosen }) {
  if (chosen || source !== TRANSCRIPT_SOURCE.NATIVE) {
    return false;
  }
  return canOffer({ nativeText, anuvadini });
}

export function switchSource({ nativeText, anuvadini, source }, next) {
  if (next === TRANSCRIPT_SOURCE.ANUVADINI) {
    return canOffer({ nativeText, anuvadini }) ? next : source;
  }
  return TRANSCRIPT_SOURCE.NATIVE;
}
