const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/realtime/chat-calls.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;

const outgoing = {
  conversationId: '507f1f77bcf86cd799439011',
  callId: '11b94825-984c-472c-87a8-a7260dda01d9',
  mode: 'video',
};
const incoming = {
  conversationId: '507f1f77bcf86cd799439012',
  callId: '427eb872-4b09-4a2b-99a7-2e39285898a0',
  mode: 'voice',
  callerId: 'peer',
};
const callKey = ({ conversationId, callId }) => ({ conversationId, callId });

function setup({ historyAcks = [], ...options } = {}) {
  const exports = {};
  const timers = new Map();
  let nextTimer = 0;
  vm.runInNewContext(source, {
    exports,
    setTimeout(fn, ms) {
      timers.set(++nextTimer, { fn, ms });
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
  });

  const signals = [];
  const errors = [];
  let session = null;
  let acknowledge;
  const calls = exports.createChatCalls({
    emitWithAck(event, data, timeoutMs) {
      signals.push({ event, data: JSON.parse(JSON.stringify(data)), timeoutMs });
      if (event === 'chat:call:invite') {
        return new Promise((resolve) => (acknowledge = resolve));
      }
      if (event === 'chat:call:history-ready') {
        return Promise.resolve(
          historyAcks.shift() ? { ok: true, ack: { ok: true } } : { ok: false }
        );
      }
      return Promise.resolve({ ok: true });
    },
    isConnected: () => true,
    newCallId: () => outgoing.callId,
    lookupParticipantName: async () => 'Người gọi',
    onChange: (next) => (session = next),
    onInviteError: (message) => errors.push(message),
    ...options,
  });
  calls.setForeground(true);
  return {
    calls,
    signals,
    errors,
    timers,
    session: () => session,
    ack: (result) => acknowledge(result),
  };
}

test('outgoing room waits for a matching gateway ACK and repeated presses send one invite', async () => {
  const { calls, signals, session, ack } = setup();
  const start = calls.start(outgoing.conversationId, outgoing.mode, 'Người nhận');
  await calls.start(outgoing.conversationId, 'voice', 'Người nhận');

  assert.equal(session().phase, 'inviting');
  assert.deepEqual(signals, [{ event: 'chat:call:invite', data: outgoing, timeoutMs: 10_000 }]);
  ack({ ok: true, ack: { ...outgoing, callerId: 'me' } });
  await start;
  assert.equal(session().phase, 'active');
  assert.equal(session().call.callId, outgoing.callId);
  assert.equal(session().participantName, 'Người nhận');

  calls.receive('chat:call:ended', {
    ...callKey(outgoing),
    conversationId: incoming.conversationId,
  });
  assert.equal(session().phase, 'active');
  calls.receive('chat:call:ended', callKey(outgoing));
  assert.equal(session(), null);
  assert.equal(signals.length, 1);
});

test('failed and malformed ACKs close the invite and withdraw it from the recipient', async () => {
  for (const result of [
    { ok: false },
    { ok: true, ack: { ...outgoing, mode: 'voice', callerId: 'me' } },
    { ok: true, ack: { ...outgoing, callerId: '' } },
  ]) {
    const { calls, signals, errors, session, ack } = setup();
    const start = calls.start(outgoing.conversationId, outgoing.mode, 'Người nhận');
    ack(result);
    await start;
    assert.equal(session(), null);
    assert.equal(errors.length, 1);
    assert.equal(signals[1].event, 'chat:call:end');
    assert.deepEqual(signals[1].data, callKey(outgoing));
  }
});

test('decline arriving before the ACK cannot reopen the room', async () => {
  const { calls, errors, session, ack } = setup();
  const start = calls.start(outgoing.conversationId, outgoing.mode, 'Người nhận');
  calls.receive('chat:call:ended', callKey(outgoing));
  ack({ ok: true, ack: { ...outgoing, callerId: 'me' } });
  await start;
  assert.equal(session(), null);
  assert.equal(errors.length, 0);
});

test('incoming offer uses gateway IDs, ignores duplicates and rejects other calls as busy', async () => {
  const { calls, signals, session, timers } = setup();
  calls.receive('chat:call:incoming', { ...incoming, callId: 'bad' });
  assert.equal(session(), null);
  calls.receive('chat:call:incoming', incoming);
  calls.receive('chat:call:incoming', incoming);
  await Promise.resolve();
  assert.equal(session().phase, 'ringing');
  assert.equal(session().participantName, 'Người gọi');
  assert.equal(timers.size, 1);
  assert.equal(signals.length, 0);
  assert.equal(calls.accept(incoming), true);
  assert.equal(calls.accept(incoming), false);
  assert.equal(session().phase, 'active');
  assert.equal(session().call.mode, incoming.mode);
  assert.equal(timers.size, 0);
  assert.deepEqual(signals, [
    { event: 'chat:call:accept', data: callKey(incoming), timeoutMs: undefined },
  ]);

  calls.receive('chat:call:incoming', { ...outgoing, callerId: 'other-peer' });
  assert.equal(session().call.callId, incoming.callId);
  assert.equal(signals[1].event, 'chat:call:end');
  assert.deepEqual(signals[1].data, callKey(outgoing));
});

test('unanswered incoming calls expire, and decline or remote end clears their timer', () => {
  const { calls, signals, session, timers } = setup();
  calls.receive('chat:call:incoming', incoming);
  const timer = [...timers.values()][0];
  assert.equal(timer.ms, 30_000);
  timer.fn();
  assert.equal(session(), null);
  assert.equal(timers.size, 0);
  assert.deepEqual(signals[0].data, callKey(incoming));

  calls.receive('chat:call:incoming', incoming);
  calls.end(incoming);
  assert.equal(session(), null);
  assert.equal(timers.size, 0);
  assert.equal(signals[1].event, 'chat:call:end');

  calls.receive('chat:call:incoming', incoming);
  calls.receive('chat:call:ended', callKey(incoming));
  assert.equal(session(), null);
  assert.equal(timers.size, 0);
  assert.equal(signals.length, 2);
});

test('leaving the foreground cancels pending invites and ignores their late ACKs', async () => {
  const { calls, signals, session, errors, ack } = setup();
  const start = calls.start(outgoing.conversationId, outgoing.mode, 'Người nhận');
  calls.setForeground(false);
  calls.receive('chat:call:incoming', incoming);
  ack({ ok: true, ack: { ...outgoing, callerId: 'me' } });
  await start;
  assert.equal(session(), null);
  assert.equal(errors.length, 0);
  assert.deepEqual(
    signals.slice(1).map(({ data }) => data),
    [callKey(outgoing), callKey(incoming)]
  );
});

test('an Android permission prompt keeps the accepted call active', () => {
  const { calls, signals, session } = setup();
  calls.receive('chat:call:incoming', incoming);
  calls.accept(incoming);

  calls.setForeground(false);
  calls.setForeground(true);

  assert.equal(session().phase, 'active');
  assert.deepEqual(
    signals.map(({ event }) => event),
    ['chat:call:accept']
  );
});

test('sign-out ends the active room and a stale end callback cannot close a different call', () => {
  const { calls, signals, session } = setup();
  calls.receive('chat:call:incoming', incoming);
  calls.accept(incoming);
  calls.setForeground(false);
  calls.end();
  assert.equal(session(), null);
  assert.equal(signals[1].event, 'chat:call:end');
  assert.deepEqual(signals[1].data, callKey(incoming));

  calls.setForeground(true);
  calls.receive('chat:call:incoming', { ...outgoing, callerId: 'other-peer' });
  calls.end(incoming);
  assert.equal(session().call.callId, outgoing.callId);
  assert.equal(signals.length, 2);
});

test('an unavailable authenticated socket never opens an outgoing room', async () => {
  const { calls, signals, errors, session } = setup({ isConnected: () => false });
  await calls.start(outgoing.conversationId, outgoing.mode, 'Người nhận');
  assert.equal(session(), null);
  assert.equal(signals.length, 0);
  assert.equal(errors.length, 1);
});

test('call history negotiates each connection, adding invite version and supported end reasons', async () => {
  const { calls, signals, session, ack } = setup({ historyAcks: [true, false] });
  for (const history of [true, false]) {
    const offset = signals.length;
    calls.receive('connect');
    const start = calls.start(outgoing.conversationId, outgoing.mode, 'Người nhận');
    await new Promise(setImmediate);
    assert.equal(signals[offset].event, 'chat:call:history-ready');
    assert.deepEqual(signals[offset].data, {});
    assert.equal(signals[offset + 1].data.historyVersion, history ? 1 : undefined);
    ack({
      ok: true,
      ack: { ...outgoing, callerId: 'me', ...(history ? { historyVersion: 1 } : {}) },
    });
    await start;
    assert.equal(session().phase, 'active');
    calls.end(outgoing, 'failed');
    assert.deepEqual(signals[offset + 2].data, {
      ...callKey(outgoing),
      ...(history ? { reason: 'failed' } : {}),
    });
  }
});

test('tracked ringing waits for server expiry, and manual decline sends the reason', () => {
  const { calls, signals, session, timers } = setup();
  const tracked = { ...incoming, historyVersion: 1 };
  calls.receive('chat:call:incoming', tracked);
  const timer = [...timers.values()][0];
  assert.equal(timer.ms, 45_000);
  timer.fn();
  assert.equal(session(), null);
  assert.equal(signals.length, 0);

  calls.receive('chat:call:incoming', tracked);
  calls.end(tracked, 'declined');
  assert.deepEqual(signals[0].data, { ...callKey(incoming), reason: 'declined' });
});
