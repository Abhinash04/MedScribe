import { check, report } from './lib/fixture-harness.mjs';

const defer = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

function makeService({ stopGate, synthGate }) {
  let version = 0;
  let inFlight = null;
  const played = [];

  async function halt() {
    inFlight?.abort();
    inFlight = null;
    await stopGate();
  }

  async function stopPrompt() {
    version += 1;
    await halt();
  }

  async function speak(text) {
    const mine = ++version;
    await halt();
    if (mine !== version) {
      return { spoken: false, reason: 'superseded' };
    }

    const controller = new AbortController();
    inFlight = controller;

    await synthGate(text);

    if (mine !== version || inFlight !== controller) {
      return { spoken: false, reason: 'superseded' };
    }
    inFlight = null;

    if (mine !== version) {
      return { spoken: false, reason: 'superseded' };
    }

    played.push(text);
    return { spoken: true };
  }

  return { stopPrompt, speak, played };
}
{
  const synth = defer();
  const service = makeService({
    stopGate: async () => {},
    synthGate: () => synth.promise,
  });

  const speaking = service.speak('missing fields');
  await Promise.resolve();
  await service.stopPrompt();
  synth.resolve();

  const result = await speaking;
  check('V1.1 the superseded prompt reports it', result.reason, 'superseded');
  check('V1.2 and never plays', service.played, []);
}

{
  const stop = defer();
  let stops = 0;
  const service = makeService({
    stopGate: async () => {
      stops += 1;
      if (stops === 1) {
        await stop.promise;
      }
    },
    synthGate: async text => text,
  });

  const first = service.speak('older');
  await Promise.resolve();
  const second = service.speak('newer');
  stop.resolve();

  const [a, b] = await Promise.all([first, second]);
  check('V2.1 the older request is superseded', a.reason, 'superseded');
  check('V2.2 the newer one speaks', b.spoken, true);
  check('V2.3 only the newer text is played', service.played, ['newer']);
}

{
  const service = makeService({
    stopGate: async () => {},
    synthGate: async text => text,
  });

  check('V3.1 first prompt speaks', (await service.speak('one')).spoken, true);
  check('V3.2 second prompt speaks', (await service.speak('two')).spoken, true);
  check('V3.3 both played in order', service.played, ['one', 'two']);
}
{
  const service = makeService({
    stopGate: async () => {},
    synthGate: async text => text,
  });

  await service.stopPrompt();
  check('V4.1 speaking still works afterwards', (await service.speak('x')).spoken, true);
  check('V4.2 and played once', service.played, ['x']);
}

report();
