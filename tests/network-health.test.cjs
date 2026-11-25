const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { exports: module.exports, Math, Infinity, Set });
  return module.exports;
}

const { createNetworkHealthMonitor } = load('lib/network-health-monitor.ts');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const GOOD = 100;
const SLOW = 3_000;
const FAIL = null;

// Fake clock + app state. `results` are RTTs in ms (null = every URL failed); the last one repeats.
// `impl` replaces the probe, e.g. to hold a lap open.
function setup(results, impl) {
  let now = 1_000_000;
  let active = true;
  let nextHandle = 1;
  const timers = new Map();
  const activeListeners = new Set();
  let probes = 0;
  let unblocked = 0;
  const monitor = createNetworkHealthMonitor(
    impl ??
      (async () => {
        const value = results[Math.min(probes, results.length - 1)];
        probes += 1;
        return value;
      }),
    () => (unblocked += 1),
    {
      isActive: () => active,
      subscribeActive: (listener) => {
        activeListeners.add(listener);
        return () => activeListeners.delete(listener);
      },
      now: () => now,
      setTimer: (callback, delay) => {
        const handle = nextHandle++;
        timers.set(handle, { at: now + delay, callback });
        return handle;
      },
      clearTimer: (handle) => timers.delete(handle),
    }
  );
  return {
    monitor,
    probes: () => probes,
    unblocked: () => unblocked,
    state: () => monitor.getSnapshot(),
    setActive(value) {
      active = value;
      activeListeners.forEach((listener) => listener(value));
    },
    async advance(ms) {
      now += ms;
      for (const [handle, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(handle);
          timer.callback();
        }
      }
      await flush();
    },
  };
}

async function start(t) {
  t.monitor.subscribe(() => undefined);
  await flush();
}

test('starts as checking and does not block, then goes online on a good lap', async () => {
  const t = setup([GOOD]);
  assert.deepEqual({ ...t.state() }, { status: 'checking', reason: 'offline', goodStreak: 0 });
  await start(t);
  assert.equal(t.state().status, 'online');
});

test('does not block after a single bad lap', async () => {
  const t = setup([GOOD, FAIL, GOOD]);
  await start(t);
  await t.advance(15_000);
  assert.equal(t.probes(), 2);
  assert.equal(t.state().status, 'online');
  const first = setup([FAIL, GOOD]);
  await start(first);
  assert.equal(first.state().status, 'checking');
});

test('blocks after two consecutive bad laps, and a good lap in between resets the count', async () => {
  const t = setup([GOOD, FAIL, FAIL]);
  await start(t);
  await t.advance(15_000);
  assert.equal(t.state().status, 'online');
  await t.advance(2_000);
  assert.equal(t.state().status, 'offline');

  const reset = setup([GOOD, FAIL, GOOD, FAIL, GOOD]);
  await start(reset);
  for (let i = 0; i < 4; i += 1) await reset.advance(15_000);
  assert.equal(reset.state().status, 'online');
});

test('a slow lap (RTT > 2500ms) is bad, exactly 2500ms is good', async () => {
  const slow = setup([SLOW, SLOW]);
  await start(slow);
  await slow.advance(2_000);
  assert.equal(slow.state().status, 'offline');

  const edge = setup([2_500, 2_500, 2_500]);
  await start(edge);
  await edge.advance(15_000);
  assert.equal(edge.state().status, 'online');
});

test('reason is offline when every URL fails and weak when responses are slow', async () => {
  const down = setup([FAIL, FAIL]);
  await start(down);
  await down.advance(2_000);
  assert.deepEqual({ ...down.state() }, { status: 'offline', reason: 'offline', goodStreak: 0 });

  const weak = setup([SLOW, SLOW]);
  await start(weak);
  await weak.advance(2_000);
  assert.deepEqual({ ...weak.state() }, { status: 'offline', reason: 'weak', goodStreak: 0 });
});

test('unblocks only after 3 consecutive good laps 2s apart; a bad lap resets the streak', async () => {
  const t = setup([FAIL, FAIL, GOOD, GOOD, FAIL, GOOD, GOOD, GOOD]);
  const streaks = [];
  t.monitor.subscribe(() => streaks.push(t.state().goodStreak));
  await flush();
  await t.advance(2_000);
  assert.equal(t.state().status, 'offline');
  await t.advance(2_000);
  await t.advance(2_000);
  assert.equal(t.state().goodStreak, 2);
  await t.advance(2_000);
  assert.equal(t.state().goodStreak, 0);
  assert.equal(t.state().status, 'offline');
  await t.advance(2_000);
  await t.advance(2_000);
  assert.equal(t.state().status, 'offline');
  assert.equal(t.unblocked(), 0);
  await t.advance(2_000);
  assert.equal(t.state().status, 'online');
  assert.equal(t.unblocked(), 1);
  assert.deepEqual(streaks, [0, 1, 2, 0, 1, 2, 0]);
});

test('polls every 15s while online and every 2s while blocked', async () => {
  const t = setup([GOOD]);
  await start(t);
  await t.advance(14_000);
  assert.equal(t.probes(), 1);
  await t.advance(1_000);
  assert.equal(t.probes(), 2);

  const b = setup([FAIL]);
  await start(b);
  await b.advance(2_000);
  assert.equal(b.state().status, 'offline');
  await b.advance(1_000);
  assert.equal(b.probes(), 2);
  await b.advance(1_000);
  assert.equal(b.probes(), 3);
  await b.advance(2_000);
  assert.equal(b.probes(), 4);
});

test('pauses while the app is in the background and checks immediately when it returns', async () => {
  const t = setup([GOOD]);
  await start(t);
  t.setActive(false);
  await t.advance(120_000);
  assert.equal(t.probes(), 1);
  t.setActive(true);
  await flush();
  assert.equal(t.probes(), 2);
});

test('external re-check is throttled to 1s and never runs two laps in parallel', async () => {
  const t = setup([GOOD]);
  await start(t);
  t.monitor.recheck();
  await flush();
  assert.equal(t.probes(), 1);
  await t.advance(999);
  assert.equal(t.probes(), 1);
  await t.advance(1);
  assert.equal(t.probes(), 2);

  let calls = 0;
  let release;
  const held = setup(
    [],
    () =>
      new Promise((resolve) => {
        calls += 1;
        release = () => resolve(GOOD);
      })
  );
  held.monitor.subscribe(() => undefined);
  await flush();
  assert.equal(calls, 1);
  await held.advance(5_000);
  held.monitor.recheck();
  await flush();
  assert.equal(calls, 1);
  release();
  await flush();
  assert.equal(held.state().status, 'online');
});

test('asks the backend monitor to re-check when it leaves the blocked state', async () => {
  const t = setup([FAIL, FAIL, GOOD]);
  await start(t);
  await t.advance(2_000);
  await t.advance(2_000);
  await t.advance(2_000);
  assert.equal(t.unblocked(), 0);
  await t.advance(2_000);
  assert.equal(t.unblocked(), 1);
  assert.equal(t.state().status, 'online');
});

test('stops all timers when the last subscriber leaves', async () => {
  const t = setup([GOOD]);
  const off = t.monitor.subscribe(() => undefined);
  await flush();
  off();
  await t.advance(60_000);
  assert.equal(t.probes(), 1);
});
