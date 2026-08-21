import {
  SETTING_KEY,
  loadBubbleEnabled,
  loadBubbleEnablePending,
  saveBubbleEnabled,
  saveBubbleEnablePending,
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
  'U1.1 no stored value defaults off, so the bubble is never self-enabling',
  await loadBubbleEnabled(dbReturning([])),
  false,
);
check(
  'U1.2 an explicit on is honoured',
  await loadBubbleEnabled(dbReturning([{ value: '1' }])),
  true,
);
check(
  'U1.3 an explicit off is honoured',
  await loadBubbleEnabled(dbReturning([{ value: '0' }])),
  false,
);
check(
  'U1.4 an unrecognised value reads as off',
  await loadBubbleEnabled(dbReturning([{ value: 'yes' }])),
  false,
);
check(
  'U1.5 a db error reads as off rather than enabling the bubble',
  await loadBubbleEnabled(dbThrowing(new Error('no such table'))),
  false,
);
check(
  'U1.6 an empty string reads as off',
  await loadBubbleEnabled(dbReturning([{ value: '' }])),
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

check(
  'U4.1 no pending intent by default, so a stray grant never enables the bubble',
  await loadBubbleEnablePending(dbReturning([])),
  false,
);
check(
  'U4.2 a recorded intent round trips',
  await loadBubbleEnablePending(dbReturning([{ value: '1' }])),
  true,
);
check(
  'U4.3 a consumed intent reads as false',
  await loadBubbleEnablePending(dbReturning([{ value: '0' }])),
  false,
);
check(
  'U4.4 a db error reads as no intent',
  await loadBubbleEnablePending(dbThrowing(new Error('no such table'))),
  false,
);

const pendingWrite = dbReturning();
check(
  'U4.5 recording the intent succeeds',
  await saveBubbleEnablePending(true, pendingWrite),
  true,
);
check(
  'U4.6 under its own key, distinct from the bubble preference',
  pendingWrite.calls[0].params[0] === SETTING_KEY.DICTATION_BUBBLE,
  false,
);
check('U4.7 as "1"', pendingWrite.calls[0].params[1], '1');

console.warn = originalWarn;

report();
