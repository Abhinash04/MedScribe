import { ERROR_KIND } from './anuvadini/proxyContract';
import {
  canTranslate,
  isStale,
  needsTranslation,
} from './consultationTranslation';
import { getPravahKey } from './appConfigService';
import { resolveTranslationTransport, TRANSPORT } from '../config/endpoints';
import {
  joinTranslated,
  planBatches,
  splitForTranslation,
} from './pravah/chunkText';
import {
  MAX_BATCH_CHARS,
  MAX_BATCH_ITEMS,
  translateTexts,
} from './pravah/translationClient';
import { PRAVAH_TARGET_ENGLISH } from './pravah/translationContract';
import { translationCodeFor } from '../constants/languages';
import useRecordingStore, {
  selectActiveTranscript,
} from '../store/useRecordingStore';

let inFlight = null;

// Over eight batches (~96k characters, a very long consultation) we refuse
// before sending anything, so a runaway transcript cannot burn a whole key
// quota on one tap.
const MAX_BATCHES = 8;

// Only these are worth a second attempt. Everything else — and 429/401/422 in
// particular — fails identically the second time and only delays the doctor.
const RETRYABLE = new Set([
  ERROR_KIND.NETWORK,
  ERROR_KIND.TIMEOUT,
  ERROR_KIND.SERVER_ERROR,
  ERROR_KIND.EMPTY_TRANSLATION,
]);

const RETRY_DELAYS_MS = [600, 1800];

// Without a wall-clock budget the worst case is 8 batches x 3 attempts x 60s.
const TRANSLATION_BUDGET_MS = 150000;

const failed = errorKind => ({ ok: false, text: '', errorKind });

// ---------------------------------------------------------------------------
// Quota latch
//
// A 429 means the key's word/character allowance is spent. Retrying cannot
// help, and neither can the next consultation, so translation is switched off
// for the rest of the session.
//
// Module state, deliberately:
//   - not useRecordingStore, because it must OUTLIVE reset(), and "remember to
//     exempt this one field from reset" is the invariant a refactor loses;
//   - not app_settings, because the quota resets on the server's schedule and
//     persisting it would leave translation dead after it came back.
// It dies on app restart, which is the honest reset.
// ---------------------------------------------------------------------------
let quotaExhaustedAt = 0;

export const isTranslationDisabled = () => quotaExhaustedAt > 0;
export const disableTranslationForSession = () => {
  quotaExhaustedAt = Date.now();
};

// Named apart from clearTranslationState on purpose. That function has no
// callers today and its obvious future home is clearSession(), which runs per
// consultation — clearing the latch there would defeat the whole point.
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

// Policy: always let the API auto-detect the source language.
//
// We think we know it, but recognizerFellBack is precisely the case where our
// belief is wrong — the store says Hindi and the text is English. Recognisers
// also emit code-mixed output, and two rows are KNOWN to disagree with the
// script the recogniser produces (sd is tagged sd-IN but Pravah only serves
// Sindhi in Devanagari). Every `from` we send is another chance at a 422, which
// is never retried. Detection on 900-character chunks is reliable.
//
// Kept as a function so making it conditional is a one-line change here rather
// than a client change.
export function shouldSendFrom() {
  return false;
}

const jitter = ms => Math.round(ms * (0.8 + Math.random() * 0.4));

// Must be abortable, or cancelling leaves a zombie that wakes up and fires
// against a superseded controller.
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
    // MT is near-deterministic: a second empty answer is a real empty.
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

      // An undocumented per-item cap would truncate silently — readTranslations
      // cannot see it. Warn rather than fail: a false positive must not break a
      // working consultation.
      if (
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

export async function translateSession({
  text,
  language,
  sourceKind = '',
} = {}) {
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

  // Before setTranslationPending, so the UI never flickers a spinner it is
  // about to retract.
  if (isTranslationDisabled()) {
    const result = failed(ERROR_KIND.QUOTA_EXCEEDED);
    store.setTranslationResult(result, { sourceText: source, sourceKind });
    return result;
  }

  store.setTranslationPending({ sourceText: source, sourceKind });

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

// The single entry point for every re-translate trigger: refinement landed, the
// doctor toggled Original/AI, the doctor edited the original text, or they
// pressed Translate again. Each changes the source text, and isStale notices.
export async function ensureTranslation({ force = false } = {}) {
  const state = useRecordingStore.getState();
  const { language, translation } = state;

  if (!needsTranslation(language)) {
    return { ok: true, text: '', errorKind: null };
  }

  const source = selectActiveTranscript(state);

  if (!force) {
    if (!isStale(translation, source)) {
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
