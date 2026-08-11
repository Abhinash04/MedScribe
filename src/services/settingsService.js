import {
  DEFAULT_LANGUAGE_CODE,
  isKnownLanguage,
  resolveLegacyCode,
} from '../constants/languages.js';

export const SETTING_KEY = {
  DICTATION_LANGUAGE: 'dictation_language',
};

function openSettingsDb() {
  const { getDb, runMigrations } = require('../db/database');
  runMigrations();
  return getDb();
}

export async function readSetting(key, fallback = null, db = null) {
  try {
    const handle = db ?? openSettingsDb();
    const { rows } = await handle.execute(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [key],
    );
    const value = rows?.[0]?.value;
    return value == null ? fallback : String(value);
  } catch (error) {
    console.warn('[settingsService] Read error:', error);
    return fallback;
  }
}

export async function writeSetting(key, value, db = null) {
  try {
    const handle = db ?? openSettingsDb();
    await handle.execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at;`,
      [key, String(value), Date.now()],
    );
    return true;
  } catch (error) {
    console.warn('[settingsService] Write error:', error);
    return false;
  }
}

export async function loadDictationLanguage(db = null) {
  const stored = await readSetting(
    SETTING_KEY.DICTATION_LANGUAGE,
    DEFAULT_LANGUAGE_CODE,
    db,
  );
  // Migrate a code that has since been split by script, then fall back: a code
  // dropped from the table must not strand the doctor on a language nothing
  // else in the app understands.
  const migrated = resolveLegacyCode(stored);
  return isKnownLanguage(migrated) ? migrated : DEFAULT_LANGUAGE_CODE;
}

export async function saveDictationLanguage(code, db = null) {
  if (!isKnownLanguage(code)) {
    return false;
  }
  return writeSetting(SETTING_KEY.DICTATION_LANGUAGE, code, db);
}
