import { ERROR_KIND } from './anuvadini/proxyContract.js';
import { getPravahKey } from './appConfigService.js';
import {
  canTranslate,
  isStale,
  needsTranslation,
  TRANSLATION_STATUS,
} from './consultationTranslation.js';
import { resolveTranslationTransport, TRANSPORT } from '../config/endpoints.js';
import {
  joinTranslated,
  planBatches,
  splitForTranslation,
} from './pravah/chunkText.js';
import {
  MAX_BATCH_CHARS,
  MAX_BATCH_ITEMS,
  translateTexts,
} from './pravah/translationClient.js';
import { PRAVAH_TARGET_ENGLISH } from './pravah/translationContract.js';
import { translationCodeFor } from '../constants/languages.js';
import useRecordingStore, {
  selectActiveTranscript,
} from '../store/useRecordingStore.js';

let inFlight = null;

// The promise for the run `inFlight` belongs to. markTranslationPending stamps
// sourceText to the CURRENT source, so isStale reports false the moment a run
// starts — which means a caller asking "is the translation current?" during a
// PENDING run would otherwise get back the PREVIOUS text (empty on pass one)
// and build the report from untranslated Hindi. ensureTranslation awaits this
// instead.
let inFlightPromise = null;

const MAX_BATCHES = 8;
const RETRYABLE = new Set([
  ERROR_KIND.NETWORK,
  ERROR_KIND.TIMEOUT,
  ERROR_KIND.SERVER_ERROR,
  ERROR_KIND.EMPTY_TRANSLATION,
]);

const RETRY_DELAYS_MS = [600, 1800];
const TRANSLATION_BUDGET_MS = 150000;
const failed = errorKind => ({ ok: false, text: '', errorKind });

let quotaExhaustedAt = 0;

export const isTranslationDisabled = () => quotaExhaustedAt > 0;
export const disableTranslationForSession = () => {
  quotaExhaustedAt = Date.now();
};

export const resetTranslationQuota = () => {
  quotaExhaustedAt = 0;
};

export function isTranslating() {
  return inFlight !== null;
}

export function cancelTranslation() {
  inFlight?.abort();
  inFlight = null;
}

export function clearTranslationState() {
  cancelTranslation();
}

export function shouldSendFrom(language) {
  return false;
}

const jitter = ms => Math.round(ms * (0.8 + Math.random() * 0.4));

const sleep = (ms, signal) =>
  new Promise(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });

async function withRetry(attempt, { signal, deadline }) {
  let result = await attempt();

  for (let index = 0; index < RETRY_DELAYS_MS.length; index += 1) {
    if (result.ok || !RETRYABLE.has(result.errorKind)) {
      return result;
    }
    if (result.errorKind === ERROR_KIND.EMPTY_TRANSLATION && index > 0) {
      return result;
    }
    if (signal?.aborted || Date.now() >= deadline) {
      return result;
    }

    await sleep(jitter(RETRY_DELAYS_MS[index]), signal);
    if (signal?.aborted || Date.now() >= deadline) {
      return result;
    }
    result = await attempt();
  }

  return result;
}

async function runTranslation({ text, language, key, signal, onProgress }) {
  if (isTranslationDisabled()) {
    return failed(ERROR_KIND.QUOTA_EXCEEDED);
  }

  const chunks = splitForTranslation(text);
  const batches = planBatches(chunks, {
    maxItems: MAX_BATCH_ITEMS,
    maxChars: MAX_BATCH_CHARS,
  });

  if (!batches.length) {
    return failed(ERROR_KIND.NO_TEXT);
  }
  if (batches.length > MAX_BATCHES) {
    return failed(ERROR_KIND.TEXT_TOO_LARGE);
  }

  const from = shouldSendFrom(language) ? translationCodeFor(language) : '';
  const out = new Array(chunks.length);
  const total = chunks.length;
  const deadline = Date.now() + TRANSLATION_BUDGET_MS;
  let cursor = 0;
  let done = 0;

  onProgress({ done: 0, total });

  for (const batch of batches) {
    const result = await withRetry(
      () =>
        translateTexts({
          texts: batch,
          to: PRAVAH_TARGET_ENGLISH,
          from,
          key,
          signal,
        }),
      { signal, deadline },
    );

    if (!result.ok) {
      if (result.errorKind === ERROR_KIND.QUOTA_EXCEEDED) {
        disableTranslationForSession();
      }
      return failed(result.errorKind);
    }

    for (let index = 0; index < batch.length; index += 1) {
      const translated = result.texts[index];
      out[cursor + index] = translated;

      if (
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        translated &&
        translated.length < batch[index].length * 0.25
      ) {
        console.warn(
          '[transcriptTranslation] chunk came back far shorter than its ' +
            `source (${translated.length} vs ${batch[index].length}) — ` +
            'possible upstream truncation',
        );
      }
    }

    cursor += batch.length;
    done += batch.length;
    onProgress({ done, total });
  }

  const joined = joinTranslated(out);
  return joined
    ? { ok: true, text: joined, errorKind: null }
    : failed(ERROR_KIND.EMPTY_TRANSLATION);
}

export async function translateSession(options = {}) {
  const promise = runSession(options);
  inFlightPromise = promise;
  try {
    return await promise;
  } finally {
    // Only clear if a newer run has not already taken the slot.
    if (inFlightPromise === promise) {
      inFlightPromise = null;
    }
  }
}

async function runSession({ text, language, sourceKind = '' } = {}) {
  const store = useRecordingStore.getState();
  const source = (text ?? '').trim();

  if (!needsTranslation(language)) {
    return failed(ERROR_KIND.NO_TEXT);
  }
  if (!source) {
    const result = failed(ERROR_KIND.NO_TEXT);
    store.setTranslationResult(result, { sourceText: source, sourceKind });
    return result;
  }

  if (isTranslationDisabled()) {
    const result = failed(ERROR_KIND.QUOTA_EXCEEDED);
    store.setTranslationResult(result, { sourceText: source, sourceKind });
    return result;
  }

  store.setTranslationPending({ sourceText: source, sourceKind });

  // Read once and thread it through: resolveTranslationTransport decides
  // direct-vs-proxy from whether a key exists, and translateTexts needs the
  // same value to build the Authorization header.
  const key = getPravahKey();
  if (resolveTranslationTransport(key) === TRANSPORT.NONE) {
    const result = failed(ERROR_KIND.NOT_CONFIGURED);
    useRecordingStore
      .getState()
      .setTranslationResult(result, { sourceText: source, sourceKind });
    return result;
  }

  cancelTranslation();
  const controller = new AbortController();
  inFlight = controller;

  try {
    const result = await runTranslation({
      text: source,
      language,
      key,
      signal: controller.signal,
      onProgress: counts => {
        if (inFlight === controller) {
          useRecordingStore.getState().setTranslationProgress(counts);
        }
      },
    });

    if (inFlight !== controller) {
      return failed(ERROR_KIND.CANCELLED);
    }
    inFlight = null;

    useRecordingStore
      .getState()
      .setTranslationResult(result, { sourceText: source, sourceKind });
    return result;
  } catch (error) {
    if (inFlight === controller) {
      inFlight = null;
      const result = failed(
        controller.signal.aborted ? ERROR_KIND.CANCELLED : ERROR_KIND.NETWORK,
      );
      useRecordingStore
        .getState()
        .setTranslationResult(result, { sourceText: source, sourceKind });
      return result;
    }
    throw error;
  }
}

export async function ensureTranslation({ force = false } = {}) {
  const state = useRecordingStore.getState();
  const { language, translation } = state;

  if (!needsTranslation(language)) {
    return { ok: true, text: '', errorKind: null };
  }

  const source = selectActiveTranscript(state);

  // A run already under way has stamped sourceText, so isStale would say
  // "current" while text is still the previous (empty) value. Wait for it, then
  // re-evaluate against settled state. Single re-entry: after the await the
  // status is READY or FAILED, never PENDING, so this cannot recurse twice.
  if (
    !force &&
    translation.status === TRANSLATION_STATUS.PENDING &&
    inFlightPromise
  ) {
    await inFlightPromise.catch(() => {});
    return ensureTranslation({ force });
  }

  if (!force) {
    if (!isStale(translation, source)) {
      return { ok: true, text: translation.text, errorKind: null };
    }
    if (translation.edited) {
      return { ok: true, text: translation.text, errorKind: null };
    }
    if (!canTranslate(translation, source)) {
      return failed(ERROR_KIND.CANCELLED);
    }
  }

  return translateSession({
    text: source,
    language,
    sourceKind: state.transcriptSource,
  });
}
