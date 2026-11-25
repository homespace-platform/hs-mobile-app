const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}) {
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
    require(name) {
      if (name in dependencies) return dependencies[name];
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return module.exports;
}

const push = load('lib/push/pure.ts');
const { createUnreadStore, unreadReducer } = load('lib/unread-store.ts');
const realtime = load('lib/realtime/pure.ts', {
  '@/lib/notification': load('lib/notification.ts'),
  '@/lib/chat-threads': load('lib/chat-threads.ts'),
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test('install identity: uuid v4 and 43-char base64url secret', () => {
  const bytes = Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256);
  const secret = push.bytesToBase64Url(bytes);
  assert.equal(secret.length, 43);
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(push.bytesToBase64Url([0xfb, 0xff]), '-_8');
  const id = push.uuidV4FromBytes(new Array(16).fill(255));
  assert.equal(id, 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  assert.equal(push.isValidIdentity({ installationId: id, installationSecret: secret }), true);
  assert.equal(push.isValidIdentity({ installationId: id, installationSecret: 'short' }), false);
  assert.equal(push.isValidIdentity(null), false);
});

test('FCM token validation rejects APNs/hex and junk', () => {
  const fcm = `${'a'.repeat(22)}:APA91b${'x'.repeat(100)}`;
  assert.equal(push.isValidFcmToken(fcm), true);
  assert.equal(push.isValidFcmToken('a'.repeat(64)), false);
  assert.equal(push.isValidFcmToken(''), false);
  assert.equal(push.isValidFcmToken(undefined), false);
  assert.equal(push.isValidFcmToken(`${fcm} `), false);
});

test('register/unregister bodies match the backend contract', () => {
  const identity = { installationId: 'id', installationSecret: 'secret' };
  assert.deepEqual(plain(push.buildRegisterBody(identity, 'android', 'tok')), {
    installationId: 'id',
    installationSecret: 'secret',
    platform: 'android',
    fid: 'tok',
  });
  assert.deepEqual(plain(push.buildUnregisterBody(identity)), { installationSecret: 'secret' });
});

test('push data maps to navigation targets', () => {
  const data = (category) => ({ event: 'notifications.changed', category });
  assert.equal(push.pushRouteFromData(data('CHAT')), 'messages');
  assert.equal(push.pushRouteFromData(data('CONTRACT')), 'notifications');
  assert.equal(push.pushRouteFromData({ category: 'CHAT' }), null);
  assert.equal(push.pushRouteFromData(null), null);
  const remote = { content: { data: {} }, trigger: { remoteMessage: { data: data('CHAT') } } };
  assert.equal(push.pushRouteFromData(push.pushDataFromRequest(remote)), 'messages');
  assert.equal(
    push.pushRouteFromData(push.pushDataFromRequest({ content: { data: data('PAYMENT') } })),
    'notifications'
  );
});

test('unread reducer clamps and the store notifies only on change', () => {
  assert.equal(unreadReducer(2, { type: 'decrement', by: 5 }), 0);
  assert.equal(unreadReducer(2, { type: 'increment' }), 3);
  assert.equal(unreadReducer(2, { type: 'set', count: -4 }), 0);
  assert.equal(unreadReducer(2, { type: 'set', count: NaN }), 0);
  assert.equal(unreadReducer(9, { type: 'reset' }), 0);
  const store = createUnreadStore();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.dispatch({ type: 'set', count: 3 });
  store.dispatch({ type: 'set', count: 3 });
  assert.equal(store.get(), 3);
  assert.equal(calls, 1);
  off();
  store.dispatch({ type: 'reset' });
  assert.equal(calls, 1);
});

test('socket targets go through the Gateway; Origin comes from the web URL', () => {
  assert.deepEqual(plain(realtime.gatewaySocketTarget('http://10.0.2.2:8080', 'chat')), {
    origin: 'http://10.0.2.2:8080',
    path: '/api/v1/chat/socket.io',
  });
  assert.deepEqual(
    plain(realtime.gatewaySocketTarget('https://api.example.com/gw/api/v1/', 'notifications')),
    {
      origin: 'https://api.example.com',
      path: '/gw/api/v1/notifications/socket.io',
    }
  );
  assert.equal(realtime.gatewaySocketTarget('not a url', 'chat'), null);
  assert.equal(
    realtime.normalizeOrigin('https://mobile.example.com/path/'),
    'https://mobile.example.com'
  );
  assert.equal(realtime.normalizeOrigin(undefined), undefined);
  assert.equal(
    realtime.reconnectDelay(0, () => 0.5),
    1000
  );
  assert.equal(
    realtime.reconnectDelay(20, () => 0.5),
    30000
  );
});

const item = (id, category = 'CONTRACT', extra = {}) => ({
  id,
  category,
  type: 'T',
  title: 't',
  body: 'b',
  readAt: null,
  popupAllowed: true,
  ...extra,
});
const all = { tab: 'ALL', unreadOnly: false };

test('notification:new inserts on top, respecting filters, chat and duplicates', () => {
  const list = [item('1')];
  const next = realtime.applyNotificationEvent(list, 'notification:new', item('2'), all);
  assert.deepEqual(plain(next.map((n) => n.id)), ['2', '1']);
  assert.equal(next[0].popupAllowed, undefined);
  assert.equal(realtime.applyNotificationEvent(list, 'notification:new', item('1'), all), list);
  assert.equal(
    realtime.applyNotificationEvent(list, 'notification:new', item('3', 'CHAT'), all),
    list
  );
  assert.equal(
    realtime.applyNotificationEvent(list, 'notification:new', item('4', 'PAYMENT'), {
      tab: 'CONTRACT',
      unreadOnly: false,
    }),
    list
  );
  assert.equal(realtime.applyNotificationEvent(list, 'notification:new', { id: 'x' }, all), list);
});

test('notification read/deleted update the loaded list', () => {
  const list = [item('1'), item('2')];
  const now = '2026-01-01T00:00:00.000Z';
  const read = realtime.applyNotificationEvent(
    list,
    'notification:read',
    item('1', 'CONTRACT', { readAt: now }),
    all,
    now
  );
  assert.equal(read[0].readAt, now);
  assert.equal(read[1].readAt, null);
  assert.deepEqual(
    plain(
      realtime
        .applyNotificationEvent(list, 'notification:read', item('1'), {
          tab: 'ALL',
          unreadOnly: true,
        })
        .map((n) => n.id)
    ),
    ['2']
  );
  assert.ok(
    realtime
      .applyNotificationEvent(list, 'notification:read', { all: true }, all, now)
      .every((n) => n.readAt === now)
  );
  assert.deepEqual(
    plain(
      realtime.applyNotificationEvent(
        list,
        'notification:read',
        { all: true },
        { tab: 'ALL', unreadOnly: true }
      )
    ),
    []
  );
  assert.deepEqual(
    plain(
      realtime
        .applyNotificationEvent(list, 'notification:deleted', { id: '2' }, all)
        .map((n) => n.id)
    ),
    ['1']
  );
});

test('chat:message updates list, unread count and open thread', () => {
  const conv = (id, unreadCount = 0) => ({ id, participantId: 'p', unreadCount });
  const list = [conv('a'), conv('b', 2)];
  const message = (conversationId, senderId) =>
    realtime.toChatMessage({ id: 'm', conversationId, senderId, content: 'hi', createdAt: 'T' });
  const incoming = realtime.applyChatMessage(list, message('b', 'other'), {
    myId: 'me',
    openId: null,
  });
  assert.deepEqual(plain(incoming.conversations.map((c) => [c.id, c.unreadCount, c.lastMessage])), [
    ['b', 3, 'hi'],
    ['a', 0, null],
  ]);
  assert.equal(incoming.appendToOpen, false);
  const open = realtime.applyChatMessage(list, message('b', 'other'), { myId: 'me', openId: 'b' });
  assert.equal(open.conversations[0].unreadCount, 0);
  assert.deepEqual([open.appendToOpen, open.markRead], [true, true]);
  const mine = realtime.applyChatMessage(list, message('b', 'me'), { myId: 'me', openId: null });
  assert.deepEqual([mine.conversations[0].unreadCount, mine.markRead], [2, false]);
  assert.equal(
    realtime.applyChatMessage(list, message('zzz', 'other'), { myId: 'me' }).unknown,
    true
  );
  assert.equal(realtime.toChatMessage({ id: 1 }), null);
});

test('chat preserves history cards and uses the file name as a captionless preview', () => {
  const base = { id: 'm', conversationId: 'a', senderId: 'peer', content: '', createdAt: 'T' };
  const call = { callId: 'c', callerId: 'peer', mode: 'audio', status: 'missed' };
  assert.deepEqual(plain(realtime.toChatMessage({ ...base, call }).call), call);
  assert.equal(
    realtime.toChatMessage({ ...base, call: { ...call, mode: 'voice' } }).call,
    undefined
  );
  const attachment = realtime.toChatMessage({ ...base, attachments: [{ fileName: 'ảnh.png' }] });
  const result = realtime.applyChatMessage([{ id: 'a', unreadCount: 0 }], attachment, {
    myId: 'me',
  });
  assert.equal(result.conversations[0].lastMessage, 'ảnh.png');
});
