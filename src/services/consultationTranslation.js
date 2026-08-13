import { DEFAULT_LANGUAGE_CODE } from '../constants/languages.js';
export const TRANSLATION_STATUS = {
  IDLE: 'idle',
  PENDING: 'pending',
  READY: 'ready',
  FAILED: 'failed',
};

export function emptyTranslation() {
  return {
    text: '',
    sourceText: '',
    sourceKind: '',
    edited: false,
    stale: false,
    status: TRANSLATION_STATUS.IDLE,
    error: null,
    updatedAt: 0,
    progress: { done: 0, total: 0 },
  };
}

export function normalizeTranslation(translation) {
  const current = { ...emptyTranslation(), ...translation };
  return {
    ...current,
    text: current.text ?? '',
    sourceText: current.sourceText ?? '',
    sourceKind: current.sourceKind ?? '',
    edited: Boolean(current.edited),
    stale: Boolean(current.stale),
    progress: {
      done: Number(current.progress?.done ?? 0),
      total: Number(current.progress?.total ?? 0),
    },
  };
}

export function needsTranslation(language) {
  return Boolean(language) && language !== DEFAULT_LANGUAGE_CODE;
}

export function markTranslationPending(
  translation,
  { sourceText = '', sourceKind = '' } = {},
) {
  return {
    ...normalizeTranslation(translation),
    sourceText: (sourceText ?? '').trim(),
    sourceKind,
    status: TRANSLATION_STATUS.PENDING,
    error: null,
    progress: { done: 0, total: 0 },
  };
}

export function applyTranslation(translation, result, options = {}) {
  const { now = Date.now(), sourceText, sourceKind } = options;
  const current = normalizeTranslation(translation);

  const source =
    sourceText === undefined ? current.sourceText : (sourceText ?? '').trim();
  const kind = sourceKind === undefined ? current.sourceKind : sourceKind;

  if (!(result?.ok && result.text?.trim())) {
    const keptText = current.text ?? '';
    return {
      ...current,
      text: keptText,
      stale: Boolean(keptText),
      sourceText: source,
      sourceKind: kind,
      status: TRANSLATION_STATUS.FAILED,
      error: result?.errorKind || 'unknown',
      updatedAt: now,
    };
  }

  return {
    ...current,
    text: result.text.trim(),
    sourceText: source,
    sourceKind: kind,
    edited: false,
    stale: false,
    status: TRANSLATION_STATUS.READY,
    error: null,
    updatedAt: now,
  };
}

export function setTranslationProgress(translation, { done = 0, total = 0 } = {}) {
  return { ...normalizeTranslation(translation), progress: { done, total } };
}

export function editTranslation(translation, text) {
  const next = text ?? '';
  return {
    ...normalizeTranslation(translation),
    text: next,
    edited: true,
    stale: false,
    status:
      next.trim().length > 0 ? TRANSLATION_STATUS.READY : TRANSLATION_STATUS.IDLE,
    error: null,
  };
}

export function isStale(translation, currentSourceText) {
  const current = normalizeTranslation(translation);
  if (current.status === TRANSLATION_STATUS.IDLE) {
    return true;
  }
  return current.sourceText !== (currentSourceText ?? '').trim();
}

export function canTranslate(translation, currentSourceText) {
  const current = normalizeTranslation(translation);
  if (current.status === TRANSLATION_STATUS.PENDING) {
    return false;
  }
  if (current.edited && !isStale(current, currentSourceText)) {
    return false;
  }
  return true;
}

export function translationText(translation) {
  return normalizeTranslation(translation).text;
}
