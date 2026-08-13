import { AppState } from 'react-native';
import { create } from 'zustand';
import { DEFAULT_LANGUAGE_CODE, isKnownLanguage } from '../constants/languages';
import * as speech from '../services/speechService';
import {
  loadBubbleEnabled,
  loadDictationLanguage,
  loadOnboardingSeen,
  saveBubbleEnabled,
  saveDictationLanguage,
  saveOnboardingSeen,
} from '../services/settingsService';
import * as overlay from '../services/dictationOverlayService';
import { disableBubble, enableBubble } from '../services/dictationBubble';

let hydrating = null;

const useSettingsStore = create(set => ({
  dictationLanguage: DEFAULT_LANGUAGE_CODE,
  hydrated: false,
  deviceRecognizerLocales: null,
  bubbleEnabled: false,
  overlayGranted: false,
  onboardingSeen: false,

  hydrate: async () => {
    const dictationLanguage = await loadDictationLanguage();
    const overlayGranted = overlay.canDrawOverlays();
    const bubbleEnabled = await loadBubbleEnabled(overlayGranted);
    const onboardingSeen = await loadOnboardingSeen();

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
      onboardingSeen,
      hydrated: true,
    });

    if (bubbleEnabled && overlayGranted) {
      enableBubble();
    }
  },

  markOnboardingSeen: async () => {
    set({ onboardingSeen: true });
    return saveOnboardingSeen(true);
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

    const started = enabled ? await enableBubble() : await disableBubble();
    const ok = await saveBubbleEnabled(enabled);

    if (!ok || (enabled && !started)) {
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

    if (granted && !wasGranted && state.bubbleEnabled) {
      enableBubble();
    }
  });
}

export function unwatchOverlayGrant() {
  overlayGrantSubscription?.remove();
  overlayGrantSubscription = null;
}

export default useSettingsStore;
