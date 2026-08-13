import {
  SETTING_KEY,
  loadBubbleEnabled,
  saveBubbleEnabled,
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

check(
  'U1.1 no stored value and permission granted defaults on',
  await loadBubbleEnabled(true, dbReturning([])),
  true,
);
check(
  'U1.2 no stored value without permission defaults off',
  await loadBubbleEnabled(false, dbReturning([])),
  false,
);
check(
  'U1.3 an explicit on is honoured',
  await loadBubbleEnabled(false, dbReturning([{ value: '1' }])),
  true,
);
check(
  'U1.4 an explicit off is honoured even with permission',
  await loadBubbleEnabled(true, dbReturning([{ value: '0' }])),
  false,
);
check(
  'U1.5 an unrecognised value reads as off',
  await loadBubbleEnabled(true, dbReturning([{ value: 'yes' }])),
  false,
);
check(
  'U1.6 a db error falls back to the permission default',
  await loadBubbleEnabled(true, dbThrowing(new Error('no such table'))),
  true,
);
check(
  'U1.7 and to off when there is no permission',
  await loadBubbleEnabled(false, dbThrowing(new Error('no such table'))),
  false,
);

const on = dbReturning();
check('U2.1 saving on succeeds', await saveBubbleEnabled(true, on), true);
check('U2.2 under the bubble key', on.calls[0].params[0], SETTING_KEY.DICTATION_BUBBLE);
check('U2.3 as "1"', on.calls[0].params[1], '1');

const off = dbReturning();
check('U2.4 saving off succeeds', await saveBubbleEnabled(false, off), true);
check('U2.5 as "0"', off.calls[0].params[1], '0');

check(
  'U2.6 a failed write reports failure',
  await saveBubbleEnabled(true, dbThrowing(new Error('readonly database'))),
  false,
);

check(
  'U3.1 the bubble key is distinct from the language key',
  SETTING_KEY.DICTATION_BUBBLE === SETTING_KEY.DICTATION_LANGUAGE,
  false,
);

console.warn = originalWarn;

report();
