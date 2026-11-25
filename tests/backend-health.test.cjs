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

const { createBackendHealthMonitor } = load('lib/backend-health-monitor.ts');
const flush = () => new Promise((resolve) => setImmediate(resolve));

// Fake clock + app state so the monitor can be driven deterministically.
function setup(results) {
  let now = 1_000_000;
  let active = true;
  let nextHandle = 1;
  const timers = new Map();
  const activeListeners = new Set();
  let probes = 0;
  const monitor = createBackendHealthMonitor(
    async () => {
      const value = results[Math.min(probes++, results.length - 1)];
      if (value instanceof Error) throw value;
      return value;
    },
    60_000,
    10_000,
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
    timerCount: () => timers.size,
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

test('starts as checking, probes on the first subscriber and becomes ready', async () => {
  const t = setup([true]);
  assert.equal(t.monitor.getSnapshot(), 'checking');
  const off = t.monitor.subscribe(() => undefined);
  await flush();
  assert.equal(t.probes(), 1);
  assert.equal(t.monitor.getSnapshot(), 'ready');
  off();
});

test('goes unavailable on a failed or throwing probe and retries every 10s until it recovers', async () => {
  const t = setup([false, new Error('network'), true]);
  const seen = [];
  t.monitor.subscribe(() => seen.push(t.monitor.getSnapshot()));
  await flush();
  assert.equal(t.monitor.getSnapshot(), 'unavailable');
  await t.advance(10_000);
  assert.equal(t.probes(), 2);
  assert.equal(t.monitor.getSnapshot(), 'unavailable');
  await t.advance(10_000);
  assert.equal(t.probes(), 3);
  assert.equal(t.monitor.getSnapshot(), 'ready');
  assert.deepEqual(seen, ['unavailable', 'ready']);
});

test('polls every 60s while ready, not every 10s', async () => {
  const t = setup([true]);
  t.monitor.subscribe(() => undefined);
  await flush();
  await t.advance(30_000);
  assert.equal(t.probes(), 1);
  await t.advance(30_000);
  assert.equal(t.probes(), 2);
});

test('a manual re-check inside the 10s window waits instead of probing again', async () => {
  const t = setup([false, true]);
  t.monitor.subscribe(() => undefined);
  await flush();
  assert.equal(t.probes(), 1);
  t.monitor.recheck();
  await flush();
  assert.equal(t.probes(), 1);
  await t.advance(10_000);
  assert.equal(t.probes(), 2);
  assert.equal(t.monitor.getSnapshot(), 'ready');
});

test('pauses while the app is in the background and checks again when it returns', async () => {
  const t = setup([true]);
  t.monitor.subscribe(() => undefined);
  await flush();
  t.setActive(false);
  await t.advance(120_000);
  assert.equal(t.probes(), 1);
  t.setActive(true);
  await flush();
  assert.equal(t.probes(), 2);
});

test('stops all timers when the last subscriber leaves', async () => {
  const t = setup([true]);
  const off = t.monitor.subscribe(() => undefined);
  await flush();
  assert.equal(t.timerCount(), 1);
  off();
  assert.equal(t.timerCount(), 0);
});
