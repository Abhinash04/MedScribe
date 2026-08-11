import { create } from 'zustand';
import { DEFAULT_LANGUAGE_CODE, isKnownLanguage } from '../constants/languages';
import * as speech from '../services/speechService';
import {
  loadDictationLanguage,
  saveDictationLanguage,
} from '../services/settingsService';

let hydrating = null;

const useSettingsStore = create(set => ({
  dictationLanguage: DEFAULT_LANGUAGE_CODE,
  hydrated: false,
  deviceRecognizerLocales: null,

  hydrate: async () => {
    const dictationLanguage = await loadDictationLanguage();

    let deviceRecognizerLocales = null;
    try {
      const locales = await speech.getSupportedLanguages();
      deviceRecognizerLocales = Array.isArray(locales) ? locales : null;
    } catch {
      deviceRecognizerLocales = null;
    }

    set({ dictationLanguage, deviceRecognizerLocales, hydrated: true });
  },

  setDictationLanguage: async code => {
    if (!isKnownLanguage(code)) {
      return false;
    }
    set({ dictationLanguage: code });
    return saveDictationLanguage(code);
  },
}));

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

export default useSettingsStore;
