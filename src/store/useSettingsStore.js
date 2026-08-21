import { AppState } from 'react-native';
import { create } from 'zustand';
import { DEFAULT_LANGUAGE_CODE, isKnownLanguage } from '../constants/languages';
import * as speech from '../services/speechService';
import {
  loadBubbleEnabled,
  loadBubbleEnablePending,
  loadDictationLanguage,
  loadOnboardingSeen,
  saveBubbleEnabled,
  saveBubbleEnablePending,
  saveDictationLanguage,
  saveOnboardingSeen,
} from '../services/settingsService';
import * as overlay from '../services/dictationOverlayService';
import { disableBubble, enableBubble } from '../services/dictationBubble';
import { checkMicPermission, isGranted } from '../services/permissionService';

let hydrating = null;

const useSettingsStore = create(set => ({
  dictationLanguage: DEFAULT_LANGUAGE_CODE,
  hydrated: false,
  deviceRecognizerLocales: null,
  bubbleEnabled: false,
  overlayGranted: false,
  micGranted: false,
  onboardingSeen: false,

  hydrate: async () => {
    const dictationLanguage = await loadDictationLanguage();
    const overlayGranted = overlay.canDrawOverlays();
    const bubbleEnabled = await loadBubbleEnabled();
    const onboardingSeen = await loadOnboardingSeen();

    let micGranted = false;
    try {
      micGranted = isGranted(await checkMicPermission());
    } catch {
      micGranted = false;
    }

    let deviceRecognizerLocales = null;
    try {
      const locales = await speech.getSupportedLanguages();
      deviceRecognizerLocales = Array.isArray(locales) ? locales : null;
    } catch {
      deviceRecognizerLocales = null;
    }

    set({
      dictationLanguage,
      deviceRecognizerLocales,
      bubbleEnabled,
      overlayGranted,
      micGranted,
      onboardingSeen,
      hydrated: true,
    });

    if (bubbleEnabled && overlayGranted) {
      enableBubble();
    }
  },

  markOnboardingSeen: async () => {
    const ok = await saveOnboardingSeen(true);
    if (ok) {
      set({ onboardingSeen: true });
    }
    return ok;
  },

  refreshOverlayGrant: () => {
    const overlayGranted = overlay.canDrawOverlays();
    set({ overlayGranted });
    return overlayGranted;
  },

  setBubbleEnabled: async next => {
    const enabled = next === true;

    if (enabled && !overlay.canDrawOverlays()) {
      set({ overlayGranted: false });
      return false;
    }

    const previous = useSettingsStore.getState().bubbleEnabled;
    set({ bubbleEnabled: enabled, overlayGranted: overlay.canDrawOverlays() });

    const applied = enabled ? await enableBubble() : await disableBubble();
    if (!applied) {
      set({ bubbleEnabled: previous });
      return false;
    }

    const ok = await saveBubbleEnabled(enabled);
    if (!ok) {
      if (enabled) {
        await disableBubble();
      } else {
        await enableBubble();
      }
      set({ bubbleEnabled: previous });
      return false;
    }
    return true;
  },

  setDictationLanguage: async code => {
    if (!isKnownLanguage(code)) {
      return false;
    }
    const previous = useSettingsStore.getState().dictationLanguage;
    set({ dictationLanguage: code });
    const ok = await saveDictationLanguage(code);
    if (!ok) {
      set({ dictationLanguage: previous });
    }
    return ok;
  },
}));

export const getBubbleEnabled = () =>
  useSettingsStore.getState().bubbleEnabled;

export const getDictationLanguage = () =>
  useSettingsStore.getState().dictationLanguage;

export async function ensureHydrated() {
  if (useSettingsStore.getState().hydrated) {
    return;
  }
  if (!hydrating) {
    hydrating = useSettingsStore
      .getState()
      .hydrate()
      .catch(error => {
        console.warn('[useSettingsStore] Hydrate error:', error);
      })
      .finally(() => {
        hydrating = null;
      });
  }
  await hydrating;
}

let overlayGrantSubscription = null;

export function watchOverlayGrant() {
  if (overlayGrantSubscription) {
    return;
  }
  overlayGrantSubscription = AppState.addEventListener('change', next => {
    if (next !== 'active') {
      return;
    }
    const state = useSettingsStore.getState();
    const wasGranted = state.overlayGranted;
    const granted = state.refreshOverlayGrant();

    if (!granted || wasGranted) {
      return;
    }

    (async () => {
      const pending = await loadBubbleEnablePending();
      if (!pending && !state.bubbleEnabled) {
        return;
      }
      await useSettingsStore.getState().setBubbleEnabled(true);
      if (pending) {
        await saveBubbleEnablePending(false);
      }
    })().catch(() => {});
  });
}

export function unwatchOverlayGrant() {
  overlayGrantSubscription?.remove();
  overlayGrantSubscription = null;
}

export default useSettingsStore;
