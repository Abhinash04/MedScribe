import {
  DEFAULT_LANGUAGE_CODE,
  isKnownLanguage,
  resolveLegacyCode,
} from '../constants/languages.js';

export const SETTING_KEY = {
  DICTATION_LANGUAGE: 'dictation_language',
  DICTATION_BUBBLE: 'dictation_bubble',
  OVERLAY_ONBOARDING_SEEN: 'overlay_onboarding_seen',
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
  const migrated = resolveLegacyCode(stored);
  return isKnownLanguage(migrated) ? migrated : DEFAULT_LANGUAGE_CODE;
}

export async function loadBubbleEnabled(db = null) {
  const stored = await readSetting(SETTING_KEY.DICTATION_BUBBLE, null, db);
  return stored === '1';
}

export async function saveBubbleEnabled(enabled, db = null) {
  return writeSetting(SETTING_KEY.DICTATION_BUBBLE, enabled ? '1' : '0', db);
}

export async function loadOnboardingSeen(db = null) {
  const stored = await readSetting(SETTING_KEY.OVERLAY_ONBOARDING_SEEN, null, db);
  return stored === '1';
}

export async function saveOnboardingSeen(seen, db = null) {
  return writeSetting(
    SETTING_KEY.OVERLAY_ONBOARDING_SEEN,
    seen ? '1' : '0',
    db,
  );
}

export async function saveDictationLanguage(code, db = null) {
  if (!isKnownLanguage(code)) {
    return false;
  }
  return writeSetting(SETTING_KEY.DICTATION_LANGUAGE, code, db);
}
