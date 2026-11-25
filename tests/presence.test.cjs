const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports,
    Date,
    Number,
    Array,
    Math,
    Set,
    Map,
    String,
    Promise,
    Object,
    JSON,
    Error,
    setTimeout,
    clearTimeout,
    ...globals,
    require(name) {
      if (name in dependencies) return dependencies[name];
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return module.exports;
}

const presence = load('lib/chat-presence.ts');
const { createPresenceSync } = load('lib/realtime/presence-sync.ts', {}, { __DEV__: false, console });
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise((resolve) => setImmediate(resolve));

const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime(); // local time, like the formatter
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

test('labels match the web app', () => {
  assert.equal(presence.ONLINE_LABEL, 'Đang hoạt động');
  assert.equal(presence.OFFLINE_LABEL, 'Ngoại tuyến');
});

test('formatLastActive: missing or invalid input is offline', () => {
  for (const value of [null, undefined, '', 'not-a-date', '2026-13-45']) {
    assert.equal(presence.formatLastActive(value, NOW), 'Ngoại tuyến', String(value));
  }
});

test('formatLastActive: minutes, hours and the date boundaries', () => {
  const f = (ms) => presence.formatLastActive(ago(ms), NOW);
  assert.equal(f(0), 'Hoạt động 1 phút trước');
  assert.equal(f(59_000), 'Hoạt động 1 phút trước');
  assert.equal(f(MIN), 'Hoạt động 1 phút trước');
  assert.equal(f(5 * MIN + 30_000), 'Hoạt động 5 phút trước');
  assert.equal(f(59 * MIN), 'Hoạt động 59 phút trước');
  assert.equal(f(59 * MIN + 59_000), 'Hoạt động 59 phút trước');
  assert.equal(f(60 * MIN), 'Hoạt động 1 giờ trước');
  assert.equal(f(2 * HOUR + 10 * MIN), 'Hoạt động 2 giờ trước');
  assert.equal(f(23 * HOUR + 59 * MIN), 'Hoạt động 23 giờ trước');
});

test('formatLastActive: 24h or more shows a hand-formatted dd/MM/yyyy date', () => {
  const seen = new Date(2026, 2, 5, 9, 30, 0); // 5 March 2026 local
  const now = new Date(2026, 5, 15, 12, 0, 0).getTime();
  assert.equal(presence.formatLastActive(seen.toISOString(), now), 'Hoạt động 05/03/2026');
  const exactly24h = new Date(NOW - 24 * HOUR);
  const day = String(exactly24h.getDate()).padStart(2, '0');
  const month = String(exactly24h.getMonth() + 1).padStart(2, '0');
  assert.equal(
    presence.formatLastActive(exactly24h.toISOString(), NOW),
    `Hoạt động ${day}/${month}/${exactly24h.getFullYear()}`
  );
  const newYear = new Date(2025, 0, 1, 8, 0, 0);
  assert.equal(presence.formatLastActive(newYear.toISOString(), NOW), 'Hoạt động 01/01/2025');
});

test('formatLastActive: a future timestamp never goes negative', () => {
  assert.equal(presence.formatLastActive(ago(-10 * MIN), NOW), 'Hoạt động 1 phút trước');
  assert.equal(presence.formatLastActive(ago(-48 * HOUR), NOW), 'Hoạt động 1 phút trước');
});

test('presenceLabel: no data is offline, online wins over lastSeenAt', () => {
  assert.equal(presence.presenceLabel(undefined, NOW), 'Ngoại tuyến');
  assert.equal(
    presence.presenceLabel({ online: true, lastSeenAt: ago(HOUR) }, NOW),
    'Đang hoạt động'
  );
  assert.equal(presence.presenceLabel({ online: false, lastSeenAt: null }, NOW), 'Ngoại tuyến');
  assert.equal(
    presence.presenceLabel({ online: false, lastSeenAt: ago(3 * HOUR) }, NOW),
    'Hoạt động 3 giờ trước'
  );
});

test('mergePresence: adds, updates and keeps the same object when nothing changed', () => {
  const empty = {};
  assert.equal(presence.mergePresence(empty, []), empty);
  const a = presence.mergePresence(empty, [{ userId: 'u1', online: true, lastSeenAt: null }]);
  assert.notEqual(a, empty);
  assert.deepEqual(plain(a), { u1: { online: true, lastSeenAt: null } });
  assert.deepEqual(plain(empty), {}, 'input is never mutated');
  assert.equal(presence.mergePresence(a, [{ userId: 'u1', online: true, lastSeenAt: null }]), a);
  assert.equal(
    presence.mergePresence(a, [{ userId: 'u1', online: true, lastSeenAt: undefined }]),
    a
  );
});

test('mergePresence: online to offline updates lastSeenAt; null/undefined become null', () => {
  const seen = '2026-06-15T11:00:00.000Z';
  const online = presence.mergePresence({}, [{ userId: 'u1', online: true, lastSeenAt: null }]);
  const offline = presence.mergePresence(online, [
    { userId: 'u1', online: false, lastSeenAt: seen },
  ]);
  assert.deepEqual(plain(offline), { u1: { online: false, lastSeenAt: seen } });
  assert.equal(
    presence.mergePresence(offline, [{ userId: 'u1', online: false, lastSeenAt: seen }]),
    offline
  );
  const later = presence.mergePresence(offline, [
    { userId: 'u1', online: false, lastSeenAt: '2026-06-15T11:30:00.000Z' },
  ]);
  assert.equal(later.u1.lastSeenAt, '2026-06-15T11:30:00.000Z');
  const nullSeen = presence.mergePresence({}, [
    { userId: 'u2', online: false, lastSeenAt: undefined },
  ]);
  assert.deepEqual(plain(nullSeen), { u2: { online: false, lastSeenAt: null } });
  assert.equal(
    presence.mergePresence({}, [{ userId: 'u2', online: false, lastSeenAt: 123 }]).u2.lastSeenAt,
    null
  );
});

test('mergePresence: skips malformed entries without breaking the valid ones', () => {
  const state = {};
  const bad = [
    null,
    undefined,
    'text',
    { userId: 1, online: true, lastSeenAt: null },
    { userId: 'u1', online: 'yes', lastSeenAt: null },
    { userId: 'u1', lastSeenAt: null },
    { userId: '', online: true, lastSeenAt: null },
    { userId: '__proto__', online: true, lastSeenAt: null },
  ];
  assert.equal(presence.mergePresence(state, bad), state);
  const next = presence.mergePresence(state, [
    ...bad,
    { userId: 'ok', online: false, lastSeenAt: null },
  ]);
  assert.deepEqual(Object.keys(next), ['ok']);
  assert.equal(Object.prototype.hasOwnProperty.call(next, '__proto__'), false);
});

test('store: notifies only on change, and clear() drops the previous account state', () => {
  const store = presence.createPresenceStore();
  let calls = 0;
  const off = store.subscribe(() => (calls += 1));
  const initial = store.get();
  store.clear();
  assert.equal(calls, 0, 'clearing an empty store is silent');
  store.apply([{ userId: 'u1', online: true, lastSeenAt: null }]);
  assert.equal(calls, 1);
  const snapshot = store.get();
  store.apply([{ userId: 'u1', online: true, lastSeenAt: null }]);
  store.apply([{ userId: 5, online: true }]);
  assert.equal(calls, 1);
  assert.equal(store.get(), snapshot, 'stable snapshot for useSyncExternalStore');
  store.clear();
  assert.equal(calls, 2);
  assert.equal(store.get(), initial);
  assert.deepEqual(plain(store.get()), {});
  off();
  store.apply([{ userId: 'u2', online: true, lastSeenAt: null }]);
  assert.equal(calls, 2, 'unsubscribed listener is not called');
});

// ---- subscription logic with a fake socket ----

function setupSync({ connected = true, reply } = {}) {
  const sent = [];
  const applied = [];
  const state = { connected };
  const sync = createPresenceSync({
    isConnected: () => state.connected,
    emitWithAck: async (event, payload, timeoutMs) => {
      sent.push({ event, ids: [...payload.userIds], timeoutMs });
      return reply ? reply(payload) : { ok: true, ack: { presences: [] } };
    },
    apply: (updates) => applied.push(...updates),
  });
  return { sync, sent, applied, state };
}

test('sync: sends chat:presence:subscribe with a 5s ack timeout and applies the ack', async () => {
  const rows = [{ userId: 'a', online: true, lastSeenAt: null }];
  const { sync, sent, applied } = setupSync({
    reply: () => ({ ok: true, ack: { presences: rows } }),
  });
  sync.watch(['a', 'b']);
  await flush();
  assert.deepEqual(sent, [{ event: 'chat:presence:subscribe', ids: ['a', 'b'], timeoutMs: 5000 }]);
  assert.deepEqual(applied, rows);
});

test('sync: de-duplicates ids and drops invalid ones (empty, non-string, > 128 chars)', async () => {
  const { sync, sent } = setupSync();
  sync.watch(['a', 'a', '', 7, null, 'x'.repeat(129), 'y'.repeat(128)]);
  await flush();
  assert.deepEqual(
    sent.map((s) => s.ids),
    [['a', 'y'.repeat(128)]]
  );
});

test('sync: splits into batches of 200', async () => {
  const { sync, sent } = setupSync();
  const ids = Array.from({ length: 450 }, (_, i) => `u${i}`);
  sync.watch(ids);
  await flush();
  assert.deepEqual(
    sent.map((s) => s.ids.length),
    [200, 200, 50]
  );
  assert.deepEqual(
    sent.flatMap((s) => s.ids),
    ids
  );
});

test('sync: only unsent ids are subscribed, even across watchers', async () => {
  const { sync, sent } = setupSync();
  sync.watch(['a', 'b']);
  sync.watch(['b', 'c']);
  sync.watch(['a', 'b', 'c']);
  await flush();
  assert.deepEqual(
    sent.map((s) => s.ids),
    [['a', 'b'], ['c']]
  );
});

test('sync: releasing a watcher does not unsubscribe and does not resend on re-watch', async () => {
  const { sync, sent } = setupSync();
  const release = sync.watch(['a']);
  release();
  release();
  sync.watch(['a']);
  await flush();
  assert.equal(sent.length, 1);
});

test('sync: nothing is sent while disconnected, then everything on connect', async () => {
  const { sync, sent, state } = setupSync({ connected: false });
  sync.watch(['a', 'b']);
  await flush();
  assert.equal(sent.length, 0);
  state.connected = true;
  sync.onConnect();
  await flush();
  assert.deepEqual(
    sent.map((s) => s.ids),
    [['a', 'b']]
  );
});

test('sync: reconnect clears the subscribed set and re-subscribes every shown user', async () => {
  const { sync, sent } = setupSync();
  sync.watch(['a', 'b']);
  await flush();
  sync.onConnect();
  await flush();
  assert.deepEqual(
    sent.map((s) => s.ids),
    [
      ['a', 'b'],
      ['a', 'b'],
    ]
  );
});

test('sync: users released before a reconnect are not re-subscribed', async () => {
  const { sync, sent } = setupSync();
  const releaseA = sync.watch(['a']);
  const releaseB = sync.watch(['a', 'b']);
  await flush();
  assert.equal(sent.length, 2);
  releaseA();
  releaseB();
  sync.onConnect();
  await flush();
  assert.equal(sent.length, 2, 'nobody is shown any more, so nothing is re-sent');
  sync.watch(['c']);
  sync.onConnect();
  await flush();
  assert.deepEqual(sent.at(-1).ids, ['c']);
});

test('sync: a user shown by two screens stays subscribed until both release', async () => {
  const { sync, sent } = setupSync();
  const first = sync.watch(['a']);
  const second = sync.watch(['a']);
  first();
  sync.onConnect();
  await flush();
  assert.equal(sent.length, 2);
  second();
});

test('sync: timeout, error, malformed or rejected acks are swallowed (users stay offline)', async () => {
  for (const reply of [
    () => ({ ok: false }),
    () => ({ ok: true }),
    () => ({ ok: true, ack: null }),
    () => ({ ok: true, ack: { presences: 'nope' } }),
    () => Promise.reject(new Error('boom')),
  ]) {
    const { sync, applied } = setupSync({ reply });
    sync.watch(['a']);
    await flush();
    assert.deepEqual(applied, []);
  }
});

test('sync: an ack that arrives after a reset/reconnect is ignored', async () => {
  let resolveAck;
  const { sync, applied } = setupSync({
    reply: () => new Promise((resolve) => (resolveAck = resolve)),
  });
  sync.watch(['a']);
  sync.reset();
  resolveAck({ ok: true, ack: { presences: [{ userId: 'a', online: true, lastSeenAt: null }] } });
  await flush();
  assert.deepEqual(applied, [], 'previous account state must not leak back into the store');
});

test('sync: reset forgets subscriptions so the next connect sends them again', async () => {
  const { sync, sent } = setupSync();
  sync.watch(['a']);
  await flush();
  sync.reset();
  sync.onConnect();
  await flush();
  assert.equal(sent.length, 2);
});

// ---- emitWithAck of the managed socket, with a fake socket.io ----

function setupManaged(behaviour) {
  const created = [];
  const io = () => {
    const handlers = {};
    const fake = {
      emitted: [],
      on: (event, handler) => {
        handlers[event] = handler;
      },
      onAny: () => {},
      removeAllListeners: () => {},
      disconnect: () => {},
      timeout(ms) {
        return {
          emit: (event, payload, callback) => {
            fake.emitted.push({ event, payload, ms });
            behaviour(callback, event, payload);
          },
        };
      },
      handlers,
    };
    created.push(fake);
    return fake;
  };
  const { createManagedSocket } = load(
    'lib/realtime/socket-manager.ts',
    {
      'socket.io-client': { io },
      '@/features/auth/session': { getAccessToken: async () => 'token' },
      '@/lib/realtime/pure': { reconnectDelay: () => 1_000_000 },
    },
    { __DEV__: false, console }
  );
  const manager = createManagedSocket({ url: 'http://x', path: '/p', headers: () => ({}) });
  return { manager, created };
}

test('emitWithAck: resolves { ok: false } and emits nothing before the socket is connected', async () => {
  const { manager, created } = setupManaged(() => assert.fail('must not emit'));
  assert.deepEqual(plain(await manager.emitWithAck('e', {}, 100)), { ok: false });
  manager.start();
  await flush();
  assert.equal(manager.isConnected(), false);
  assert.deepEqual(plain(await manager.emitWithAck('e', {}, 100)), { ok: false });
  assert.equal(created[0].emitted.length, 0);
  manager.stop();
});

test('emitWithAck: error first, ack second (socket.io .timeout() order)', async () => {
  const replies = [
    (callback) => callback(null, { presences: [] }),
    (callback) => callback(new Error('operation has timed out')),
    (callback) => callback(undefined, undefined),
    () => {
      throw new Error('socket gone');
    },
  ];
  let call = 0;
  const { manager, created } = setupManaged((callback) => replies[call++](callback));
  manager.start();
  await flush();
  created[0].handlers.connect();
  assert.equal(manager.isConnected(), true);
  assert.deepEqual(
    plain(await manager.emitWithAck('chat:presence:subscribe', { userIds: ['a'] }, 1234)),
    {
      ok: true,
      ack: { presences: [] },
    }
  );
  assert.deepEqual(created[0].emitted[0], {
    event: 'chat:presence:subscribe',
    payload: { userIds: ['a'] },
    ms: 1234,
  });
  assert.deepEqual(plain(await manager.emitWithAck('e', {}, 10)), { ok: false });
  assert.deepEqual(plain(await manager.emitWithAck('e', {}, 10)), { ok: true });
  assert.deepEqual(plain(await manager.emitWithAck('e', {}, 10)), { ok: false });
  manager.stop();
  assert.deepEqual(plain(await manager.emitWithAck('e', {}, 10)), { ok: false });
});
