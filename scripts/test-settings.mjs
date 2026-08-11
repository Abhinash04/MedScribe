
import { DEFAULT_LANGUAGE_CODE } from '../src/constants/languages.js';
import {
  SETTING_KEY,
  loadDictationLanguage,
  readSetting,
  saveDictationLanguage,
  writeSetting,
} from '../src/services/settingsService.js';

import { check, report } from './lib/fixture-harness.mjs';

function dbReturning(rows = []) {
  const calls = [];
  return {
    calls,
    execute: async (sql, params = []) => {
      calls.push({ sql, params });
      return { rows };
    },
  };
}

function dbThrowing(error) {
  const calls = [];
  return {
    calls,
    execute: async (sql, params = []) => {
      calls.push({ sql, params });
      throw error;
    },
  };
}

const originalWarn = console.warn;
console.warn = () => {};

const stored = dbReturning([{ value: 'hi' }]);
check('S1.1 reads the stored value', await readSetting('k', 'fallback', stored), 'hi');
check('S1.2 selects from app_settings', /FROM app_settings/.test(stored.calls[0].sql), true);
check('S1.3 binds the key', stored.calls[0].params, ['k']);

check(
  'S1.4 missing row falls back',
  await readSetting('k', 'fallback', dbReturning([])),
  'fallback',
);
check(
  'S1.5 null value falls back',
  await readSetting('k', 'fallback', dbReturning([{ value: null }])),
  'fallback',
);
check(
  'S1.6 a db error falls back rather than throwing',
  await readSetting('k', 'fallback', dbThrowing(new Error('disk I/O error'))),
  'fallback',
);

const written = dbReturning();
check('S1.7 write reports success', await writeSetting('k', 'v', written), true);
check('S1.8 write upserts', /ON CONFLICT\(key\) DO UPDATE/.test(written.calls[0].sql), true);
check('S1.9 write binds key and value', written.calls[0].params.slice(0, 2), ['k', 'v']);
check(
  'S1.10 a failed write reports failure',
  await writeSetting('k', 'v', dbThrowing(new Error('readonly database'))),
  false,
);

check(
  'S2.1 a stored code is returned',
  await loadDictationLanguage(dbReturning([{ value: 'or' }])),
  'or',
);
check(
  'S2.2 a three-letter code is returned',
  await loadDictationLanguage(dbReturning([{ value: 'kok' }])),
  'kok',
);
check(
  'S2.3 nothing stored yet → English',
  await loadDictationLanguage(dbReturning([])),
  DEFAULT_LANGUAGE_CODE,
);
check(
  'S2.4 a code dropped from the table → English',
  await loadDictationLanguage(dbReturning([{ value: 'zz' }])),
  DEFAULT_LANGUAGE_CODE,
);
check(
  'S2.5 a tag stored by mistake → English',
  await loadDictationLanguage(dbReturning([{ value: 'hi-IN' }])),
  DEFAULT_LANGUAGE_CODE,
);
check(
  'S2.6 a db error → English',
  await loadDictationLanguage(dbThrowing(new Error('no such table'))),
  DEFAULT_LANGUAGE_CODE,
);

const saved = dbReturning();
check('S2.7 saving a known code succeeds', await saveDictationLanguage('bn', saved), true);
check('S2.8 saves under the settings key', saved.calls[0].params[0], SETTING_KEY.DICTATION_LANGUAGE);
check('S2.9 saves the code', saved.calls[0].params[1], 'bn');

const rejected = dbReturning();
check('S2.10 an unknown code is refused', await saveDictationLanguage('zz', rejected), false);
check('S2.11 a refused save writes nothing', rejected.calls.length, 0);

const rejectedTag = dbReturning();
check('S2.12 a tag is refused', await saveDictationLanguage('hi-IN', rejectedTag), false);
check('S2.13 a refused tag writes nothing', rejectedTag.calls.length, 0);

console.warn = originalWarn;

report();
