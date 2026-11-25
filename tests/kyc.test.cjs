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
    require(name) {
      if (name in dependencies) return dependencies[name];
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return module.exports;
}

const pure = load('lib/kyc/pure.ts', { '@/lib/push/pure': load('lib/push/pure.ts') });
const { createKycFlow } = load('lib/kyc/flow.ts', { '@/lib/kyc/pure': pure });
const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => (resolve = res));
  return { promise, resolve };
};
const STATE = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345'; // 32 chars
const link = (query) => `homespace://kyc/result?${query}`;
const stateIn = (url) => /state=([^&]+)/.exec(url)[1];

// ---------- createKycState ----------
test('createKycState: 24 bytes -> 32 base64url chars without padding', () => {
  const state = pure.createKycState((size) => Array.from({ length: size }, (_, i) => i * 11));
  assert.equal(state.length, 32);
  assert.match(state, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(state.includes('='), false);
  assert.equal(pure.isValidKycState(state), true);
});

test('createKycState: fixed random gives the exact value and asks for 24 bytes', () => {
  let asked;
  const zeros = pure.createKycState((size) => ((asked = size), new Array(size).fill(0)));
  assert.equal(asked, 24);
  assert.equal(zeros, 'A'.repeat(32));
  assert.equal(
    pure.createKycState((size) => new Array(size).fill(255)),
    '_'.repeat(32)
  );
  const url = pure.createKycState(() => [0xfb, 0xff, 0xbf].concat(new Array(21).fill(0)));
  assert.equal(url.slice(0, 4), '-_-_');
});

test('createKycState: different randomness gives different states', () => {
  const make = (n) =>
    pure.createKycState((size) => Array.from({ length: size }, (_, i) => (i * 7 + n) % 256));
  assert.notEqual(make(0), make(1));
});

// ---------- buildKycUrl ----------
test('buildKycUrl: strips trailing slashes and adds only client + state', () => {
  assert.equal(
    pure.buildKycUrl('https://homespace.vn', STATE),
    `https://homespace.vn/kyc?client=app&state=${STATE}`
  );
  assert.equal(
    pure.buildKycUrl('  https://homespace.vn///  ', STATE),
    `https://homespace.vn/kyc?client=app&state=${STATE}`
  );
  assert.equal(
    pure.buildKycUrl('http://192.168.1.5:3000/', STATE),
    `http://192.168.1.5:3000/kyc?client=app&state=${STATE}`
  );
  assert.equal(
    pure.buildKycUrl('https://homespace.vn/app', STATE),
    `https://homespace.vn/app/kyc?client=app&state=${STATE}`
  );
  assert.equal(pure.buildKycUrl('https://x.vn', STATE).split('?')[1].split('&').length, 2);
  assert.equal(
    pure.buildKycUrl('https://x.vn', 'a-b_c-d_e-f_g-h_i'),
    'https://x.vn/kyc?client=app&state=a-b_c-d_e-f_g-h_i'
  );
});

test('buildKycUrl: empty/invalid web base URL or malformed state throws', () => {
  for (const base of [
    undefined,
    null,
    '',
    '   ',
    '/',
    'homespace.vn',
    'ftp://x.vn',
    'javascript:alert(1)',
    'https://',
    'https:///kyc',
    'https://x.vn?a=1',
    'https://x.vn#f',
    'https://x .vn',
    'exp://x',
  ])
    assert.throws(() => pure.buildKycUrl(base, STATE), /KYC_WEB_BASE_URL_INVALID/, String(base));
  for (const state of [
    '',
    'short',
    'a'.repeat(129),
    `${STATE}&x=1`,
    'a b'.padEnd(20, 'c'),
    undefined,
  ])
    assert.throws(
      () => pure.buildKycUrl('https://x.vn', state),
      /KYC_STATE_INVALID/,
      String(state)
    );
});

// ---------- parseKycResultUrl ----------
test('parseKycResultUrl: valid for every status, any param order, extras ignored', () => {
  for (const status of pure.KYC_HINTS)
    assert.deepEqual(plain(pure.parseKycResultUrl(link(`state=${STATE}&status=${status}`))), {
      state: STATE,
      status,
    });
  assert.deepEqual(plain(pure.parseKycResultUrl(link(`status=VERIFIED&x=1&state=${STATE}#frag`))), {
    state: STATE,
    status: 'VERIFIED',
  });
  assert.deepEqual(
    plain(pure.parseKycResultUrl(`HomeSpace://KYC/result?state=${STATE}&status=PENDING`)),
    {
      state: STATE,
      status: 'PENDING',
    }
  );
  assert.equal(pure.parseKycResultUrl(`  homespace://kyc/result?state=${STATE} `).state, STATE);
});

test('parseKycResultUrl: unknown / missing / lowercase / repeated status -> ERROR', () => {
  for (const q of [
    'status=HACKED',
    'status=',
    'status=verified',
    'status=VERIFIED&status=REJECTED',
    '',
  ])
    assert.equal(pure.parseKycResultUrl(link(`state=${STATE}&${q}`)).status, 'ERROR', q);
  assert.equal(pure.parseKycResultUrl(`homespace://kyc/result?state=${STATE}`).status, 'ERROR');
  assert.equal(pure.parseKycResultUrl(link(`state=${STATE}&status=%56ERIFIED`)).status, 'VERIFIED');
});

test('parseKycResultUrl: wrong scheme, host or path -> null', () => {
  const q = `state=${STATE}&status=VERIFIED`;
  for (const url of [
    `https://kyc/result?${q}`,
    `exp://kyc/result?${q}`,
    `exp://192.168.1.2:8081/--/kyc/result?${q}`,
    `javascript:alert(1)//homespace://kyc/result?${q}`,
    'javascript:alert(1)',
    'homespace://oauth2redirect?code=1',
    `homespace://other/result?${q}`,
    `homespace://kyc/other?${q}`,
    `homespace://kyc/result/extra?${q}`,
    `homespace://kyc/result/?${q}`,
    `homespace://kyc.evil.com/result?${q}`,
    `homespace://evil@kyc/result?${q}`,
    `homespace:///kyc/result?${q}`,
    `homespace:kyc/result?${q}`,
    `xhomespace://kyc/result?${q}`,
    `homespace://kyc/resultx?${q}`,
  ])
    assert.equal(pure.parseKycResultUrl(url), null, url);
});

test('parseKycResultUrl: missing, bad, repeated or oversized state -> null', () => {
  for (const q of [
    'status=VERIFIED',
    'state=&status=VERIFIED',
    'state=short&status=VERIFIED',
    `state=${'a'.repeat(129)}`,
    `state=${STATE}%00`,
    `state=${STATE}%20`,
    'state=%E0%A4%A',
    `state=${STATE}&state=${STATE}`,
    `state=${STATE}&state=otherotherotherother1234`,
    'state=<script>alert(1)</script>',
    `state=${STATE}%2F..`,
    'state',
  ])
    assert.equal(pure.parseKycResultUrl(link(q)), null, q);
  assert.equal(pure.parseKycResultUrl('homespace://kyc/result'), null);
  assert.equal(pure.parseKycResultUrl(`homespace://kyc/result?state=${'a'.repeat(3000)}`), null);
});

test('parseKycResultUrl: junk input never throws', () => {
  for (const value of [
    undefined,
    null,
    42,
    {},
    [],
    '',
    ' ',
    '%%%',
    'not a url',
    '\u0000',
    '//',
    'homespace://',
  ])
    assert.equal(pure.parseKycResultUrl(value), null);
});

// ---------- describeOutcome ----------
test('describeOutcome: browser says done but this account has no result -> warns about a different account', () => {
  for (const hint of ['VERIFIED', 'REVIEW_REQUIRED']) {
    for (const backend of ['NOT_VERIFIED', 'PENDING']) {
      const out = pure.describeOutcome(backend, hint);
      assert.equal(out.tone, 'danger');
      assert.match(out.message, /tài khoản khác/);
    }
  }
  // Backend always wins: a VERIFIED account is never downgraded by a hint, and plain cancel keeps its own text.
  assert.equal(pure.describeOutcome('VERIFIED', 'ERROR').tone, 'success');
  assert.equal(pure.describeOutcome('NOT_VERIFIED', 'CANCELLED').title, 'Đã hủy xác minh');
});

test('describeOutcome: every backend status', () => {
  const ok = pure.describeOutcome('VERIFIED', 'VERIFIED');
  assert.equal(ok.title, 'Danh tính đã được xác minh');
  assert.equal(ok.tone, 'success');
  const rejected = pure.describeOutcome('REJECTED', 'REJECTED', 'Ảnh mờ');
  assert.deepEqual(plain([rejected.title, rejected.message, rejected.tone]), [
    'Xác minh không thành công',
    'Ảnh mờ',
    'danger',
  ]);
  assert.notEqual(
    pure.describeOutcome('REJECTED', 'ERROR', '   ').message.trim(),
    '',
    'blank reason -> default text'
  );
  assert.equal(
    pure.describeOutcome('REVIEW_REQUIRED', 'REVIEW_REQUIRED').title,
    'Đang chờ xét duyệt'
  );
  assert.equal(pure.describeOutcome('REVIEW_REQUIRED', 'REVIEW_REQUIRED').tone, 'info');
  assert.equal(pure.describeOutcome('EXPIRED', 'EXPIRED').title, 'Phiên xác minh đã hết hạn');
  assert.equal(pure.describeOutcome('NOT_VERIFIED', 'CANCELLED').title, 'Đã hủy xác minh');
  assert.equal(pure.describeOutcome('PENDING', 'CANCELLED').title, 'Đã hủy xác minh');
  assert.equal(pure.describeOutcome('NOT_VERIFIED', 'EXPIRED').title, 'Phiên xác minh đã hết hạn');
  assert.equal(pure.describeOutcome('NOT_VERIFIED', 'ERROR').tone, 'danger');
  assert.equal(pure.describeOutcome('PENDING', 'PENDING').title, 'Xác minh chưa hoàn tất');
  assert.equal(pure.describeOutcome('NOT_VERIFIED', 'PENDING').title, 'Chưa xác minh danh tính');
});

test('describeOutcome: backend wins over a contradicting hint', () => {
  assert.equal(
    pure.describeOutcome('REJECTED', 'VERIFIED', 'x').title,
    'Xác minh không thành công'
  );
  assert.notEqual(pure.describeOutcome('NOT_VERIFIED', 'VERIFIED').tone, 'success');
  assert.notEqual(pure.describeOutcome('PENDING', 'VERIFIED').tone, 'success');
  assert.equal(pure.describeOutcome('VERIFIED', 'CANCELLED').tone, 'success');
  assert.equal(pure.describeOutcome('NOT_VERIFIED', 'REJECTED').tone, 'info');
});

test('describeOutcome: unknown backend status / no answer is never a success', () => {
  for (const status of [null, undefined, '', 'WHATEVER'])
    for (const hint of ['VERIFIED', 'CANCELLED', null]) {
      const outcome = pure.describeOutcome(status, hint);
      assert.equal(outcome.tone, 'danger');
      assert.equal(outcome.title, 'Chưa kiểm tra được kết quả');
    }
});

test('isPendingValid: TTL, future, malformed', () => {
  const now = 1_000_000_000;
  const rec = (createdAt, state = STATE) => ({ state, createdAt });
  assert.equal(pure.isPendingValid(rec(now), now), true);
  assert.equal(pure.isPendingValid(rec(now - pure.KYC_STATE_TTL_MS + 1), now), true);
  assert.equal(pure.isPendingValid(rec(now - pure.KYC_STATE_TTL_MS), now), false);
  assert.equal(pure.isPendingValid(rec(now + 1), now), false);
  for (const bad of [NaN, Infinity, '1', undefined])
    assert.equal(pure.isPendingValid(rec(bad), now), false);
  assert.equal(pure.isPendingValid(rec(now, 'short'), now), false);
  assert.equal(pure.isPendingValid(null, now), false);
  assert.equal(pure.isPendingValid({}, now), false);
  assert.equal(pure.KYC_STATE_TTL_MS, 30 * 60 * 1000);
});

// ---------- flow ----------
function harness() {
  return { clock: 10_000_000, store: null, reports: [], refreshes: 0, statusCalls: 0, seed: 0 };
}
// `over`: status, reason, getStatus, refresh, webBaseUrl, storage
function makeFlow(h, openBrowser, over = {}) {
  return createKycFlow({
    openBrowser,
    getStatus:
      over.getStatus ??
      (async () => (
        h.statusCalls++,
        { status: over.status ?? 'VERIFIED', rejectionReason: over.reason }
      )),
    storage: over.storage ?? {
      get: async () => h.store,
      set: async (v) => void (h.store = v),
      remove: async () => void (h.store = null),
    },
    now: () => h.clock,
    refresh: over.refresh ?? (async () => void h.refreshes++),
    randomBytes: (size) => Array.from({ length: size }, (_, i) => (i * 13 + ++h.seed) % 256),
    getWebBaseUrl: () => ('webBaseUrl' in over ? over.webBaseUrl : 'https://homespace.vn/'),
    report: (outcome) => h.reports.push(outcome),
  });
}
const returning = (status) => async (url) => ({
  type: 'success',
  url: link(`state=${stateIn(url)}&status=${status}`),
});

test('flow: opens the web /kyc URL with the app redirect', async () => {
  const h = harness();
  const opened = [];
  const flow = makeFlow(
    h,
    async (url, redirect) => (opened.push({ url, redirect }), { type: 'cancel' })
  );
  assert.equal(await flow.startKyc(), 'done');
  assert.equal(opened[0].redirect, 'homespace://kyc/result');
  assert.match(opened[0].url, /^https:\/\/homespace\.vn\/kyc\?client=app&state=[A-Za-z0-9_-]{32}$/);
});

test('flow: success -> backend VERIFIED, refresh, success outcome, state spent', async () => {
  const h = harness();
  const flow = makeFlow(h, returning('VERIFIED'));
  assert.equal(await flow.startKyc(), 'done');
  assert.equal(h.statusCalls, 1);
  assert.equal(h.refreshes, 1);
  assert.equal(h.reports.length, 1);
  assert.equal(h.reports[0].title, 'Danh tính đã được xác minh');
  assert.equal(h.reports[0].tone, 'success');
  assert.equal(h.store, null);
});

test('flow: REJECTED with reason is shown; hint VERIFIED is ignored', async () => {
  const h = harness();
  const flow = makeFlow(h, returning('VERIFIED'), { status: 'REJECTED', reason: 'Ảnh CCCD bị mờ' });
  await flow.startKyc();
  assert.equal(h.reports.length, 1);
  assert.equal(h.reports[0].title, 'Xác minh không thành công');
  assert.equal(h.reports[0].message, 'Ảnh CCCD bị mờ');
  assert.notEqual(h.reports[0].tone, 'success');
});

for (const type of ['cancel', 'dismiss', 'locked']) {
  test(`flow: browser closed by the user (${type}) -> still asks the backend`, async () => {
    const h = harness();
    const flow = makeFlow(h, async () => ({ type }));
    await flow.startKyc();
    assert.equal(h.statusCalls, 1);
    assert.equal(h.refreshes, 1);
    assert.equal(h.reports[0].title, 'Danh tính đã được xác minh', 'it may already be done');
    assert.equal(h.store, null);
  });
}

test('flow: cancelled with nothing done -> "Đã hủy xác minh"', async () => {
  const h = harness();
  await makeFlow(h, async () => ({ type: 'dismiss' }), { status: 'NOT_VERIFIED' }).startKyc();
  assert.equal(h.reports[0].title, 'Đã hủy xác minh');
});

test('flow: wrong / missing / garbage link -> silent, no success, live state kept', async () => {
  for (const url of [
    link(`state=${'Z'.repeat(32)}&status=VERIFIED`),
    link('status=VERIFIED'),
    'homespace://kyc/result',
    'https://evil.example/kyc/result?state=x',
    'garbage',
  ]) {
    const h = harness();
    const flow = makeFlow(h, async () => ({ type: 'success', url }));
    assert.equal(await flow.startKyc(), 'done');
    assert.equal(h.statusCalls, 0, url);
    assert.equal(h.reports.length, 0, url);
    assert.ok(h.store, 'a bad link must not burn the live state');
  }
});

test('flow: a used state cannot be replayed', async () => {
  const h = harness();
  let state;
  const flow = makeFlow(h, async (url) => ((state = stateIn(url)), returning('VERIFIED')(url)));
  await flow.startKyc();
  assert.equal(h.reports.length, 1);
  assert.equal(await flow.handleKycResultUrl(link(`state=${state}&status=VERIFIED`)), false);
  assert.equal(h.reports.length, 1);
  assert.equal(h.statusCalls, 1);
});

test('flow: expired state (30 min) is ignored, dropped and cannot be reused', async () => {
  const h = harness();
  let state;
  const flow = makeFlow(h, async (url) => {
    state = stateIn(url);
    h.clock += pure.KYC_STATE_TTL_MS;
    return returning('VERIFIED')(url);
  });
  await flow.startKyc();
  assert.equal(h.reports.length, 0);
  assert.equal(h.statusCalls, 0);
  assert.equal(h.store, null, 'expired record removed');
  assert.equal(await flow.handleKycResultUrl(link(`state=${state}&status=VERIFIED`)), false);
});

test('flow: just under the TTL is still accepted', async () => {
  const h = harness();
  const flow = makeFlow(h, async (url) => {
    h.clock += pure.KYC_STATE_TTL_MS - 1;
    return returning('VERIFIED')(url);
  });
  await flow.startKyc();
  assert.equal(h.reports.length, 1);
});

test('flow: getStatus network error -> gentle message, hint not trusted, no crash', async () => {
  const h = harness();
  const flow = makeFlow(h, returning('VERIFIED'), {
    getStatus: async () => Promise.reject(new Error('Network Error')),
  });
  assert.equal(await flow.startKyc(), 'done');
  assert.equal(h.reports.length, 1);
  assert.equal(h.reports[0].title, 'Chưa kiểm tra được kết quả');
  assert.notEqual(h.reports[0].tone, 'success');
  assert.equal(h.refreshes, 1);
  assert.equal(await flow.startKyc(), 'done', 'busy released after the failure');
});

test('flow: a failing refresh still shows the outcome', async () => {
  const h = harness();
  const flow = makeFlow(h, returning('VERIFIED'), {
    refresh: async () => Promise.reject(new Error('boom')),
  });
  await flow.startKyc();
  assert.equal(h.reports.length, 1);
});

test('flow: the same link from the auth session and from Linking is handled once (either order)', async () => {
  for (const linkFirst of [true, false]) {
    const h = harness();
    let flow;
    flow = makeFlow(h, async (url) => {
      const text = link(`state=${stateIn(url)}&status=VERIFIED`);
      if (linkFirst) await flow.handleKycResultUrl(text);
      else setImmediate(() => void flow.handleKycResultUrl(text));
      return { type: 'success', url: text };
    });
    await flow.startKyc();
    await tick();
    await tick();
    assert.equal(h.reports.length, 1, `linkFirst=${linkFirst}`);
    assert.equal(h.statusCalls, 1);
    assert.equal(h.refreshes, 1);
  }
});

test('flow: Linking delivers first, then the browser reports dismiss -> only one outcome', async () => {
  const h = harness();
  const flow = makeFlow(h, async (url) => {
    await flow.handleKycResultUrl(link(`state=${stateIn(url)}&status=VERIFIED`));
    return { type: 'dismiss' };
  });
  await flow.startKyc();
  assert.equal(h.reports.length, 1);
  assert.equal(h.statusCalls, 1);
});

test('flow: simultaneous duplicate deliveries settle once', async () => {
  const h = harness();
  const gate = deferred();
  let state;
  const flow = makeFlow(h, async (url) => {
    state = stateIn(url);
    await gate.promise;
    return { type: 'dismiss' };
  });
  const running = flow.startKyc();
  await tick();
  const text = link(`state=${state}&status=VERIFIED`);
  const results = await Promise.all([flow.handleKycResultUrl(text), flow.handleKycResultUrl(text)]);
  assert.deepEqual(results.sort(), [false, true]);
  gate.resolve();
  await running;
  assert.equal(h.reports.length, 1);
  assert.equal(h.statusCalls, 1);
});

test('flow: cold start reads the stored attempt once', async () => {
  const h = harness();
  const state = pure.createKycState(() => new Array(24).fill(7));
  h.store = JSON.stringify({ state, createdAt: h.clock - 60_000 });
  const text = link(`state=${state}&status=REVIEW_REQUIRED`);
  const flow = makeFlow(h, async () => ({ type: 'cancel' }), { status: 'REVIEW_REQUIRED' });
  const results = await Promise.all([flow.handleKycResultUrl(text), flow.handleKycResultUrl(text)]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(h.reports.length, 1);
  assert.equal(h.reports[0].title, 'Đang chờ xét duyệt');
  assert.equal(h.store, null);
});

test('flow: cold start with expired / future / corrupt / empty stored record is ignored', async () => {
  const state = 'S'.repeat(32);
  for (const stored of [
    JSON.stringify({ state, createdAt: 1 }),
    JSON.stringify({ state, createdAt: 20_000_000 }),
    '{not json',
    'null',
    '',
    JSON.stringify({ state: 'short', createdAt: 10_000_000 }),
    null,
  ]) {
    const h = harness();
    h.store = stored;
    const flow = makeFlow(h, async () => ({ type: 'cancel' }));
    assert.equal(
      await flow.handleKycResultUrl(link(`state=${state}&status=VERIFIED`)),
      false,
      String(stored)
    );
    assert.equal(h.reports.length, 0);
    assert.equal(h.statusCalls, 0);
  }
});

test('flow: no web base URL -> understandable error, nothing opened, nothing stored', async () => {
  for (const webBaseUrl of [undefined, '', '   ', 'not a url']) {
    const h = harness();
    let opened = 0;
    const flow = makeFlow(h, async () => (opened++, { type: 'cancel' }), { webBaseUrl });
    assert.equal(await flow.startKyc(), 'not-configured');
    assert.equal(opened, 0);
    assert.equal(h.store, null);
    assert.equal(h.statusCalls, 0);
    assert.equal(h.reports.length, 1);
    assert.equal(h.reports[0].title, 'Chưa cấu hình xác minh');
    assert.equal(flow.isBusy(), false);
  }
});

test('flow: every start makes a fresh state and the previous one is dead', async () => {
  const h = harness();
  const states = [];
  const flow = makeFlow(
    h,
    async (url) => (states.push(stateIn(url)), { type: 'success', url: 'homespace://kyc/result' })
  );
  await flow.startKyc();
  await flow.startKyc();
  assert.notEqual(states[0], states[1]);
  assert.equal(await flow.handleKycResultUrl(link(`state=${states[0]}&status=VERIFIED`)), false);
  assert.equal(h.reports.length, 0);
  assert.equal(await flow.handleKycResultUrl(link(`state=${states[1]}&status=VERIFIED`)), true);
  assert.equal(h.reports.length, 1);
});

test('flow: no double start while a session is open; released afterwards', async () => {
  const h = harness();
  const gate = deferred();
  let opened = 0;
  const flow = makeFlow(h, async () => (opened++, await gate.promise, { type: 'dismiss' }), {
    status: 'NOT_VERIFIED',
  });
  let notified = 0;
  flow.subscribeBusy(() => notified++);
  const first = flow.startKyc();
  assert.equal(flow.isBusy(), true);
  assert.equal(await flow.startKyc(), 'busy');
  assert.equal(await flow.startKyc(), 'busy');
  await tick();
  assert.equal(opened, 1, 'only one browser session');
  gate.resolve();
  assert.equal(await first, 'done');
  assert.equal(flow.isBusy(), false);
  assert.equal(notified, 2);
  assert.equal(await flow.startKyc(), 'done');
  assert.equal(opened, 2);
});

test('flow: browser fails to open -> error outcome, state spent, busy released', async () => {
  const h = harness();
  const flow = makeFlow(h, async () => Promise.reject(new Error('no browser')));
  assert.equal(await flow.startKyc(), 'open-failed');
  assert.equal(h.reports.length, 1);
  assert.equal(h.reports[0].title, 'Không mở được trang xác minh');
  assert.equal(h.store, null);
  assert.equal(flow.isBusy(), false);
});

test('flow: SecureStore failures do not crash; a used state stays dead', async () => {
  const h = harness();
  const down = async () => Promise.reject(new Error('down'));
  let state;
  const flow = makeFlow(h, async (url) => ((state = stateIn(url)), returning('VERIFIED')(url)), {
    storage: { get: down, set: down, remove: down },
  });
  assert.equal(await flow.startKyc(), 'done');
  assert.equal(h.reports[0].tone, 'success');
  assert.equal(await flow.handleKycResultUrl(link(`state=${state}&status=VERIFIED`)), false);
  assert.equal(h.reports.length, 1);
});

test('flow: finished listeners fire after each outcome and can be removed', async () => {
  const h = harness();
  const flow = makeFlow(h, async () => ({ type: 'dismiss' }));
  let n = 0;
  const off = flow.subscribeFinished(() => n++);
  await flow.startKyc();
  assert.equal(n, 1);
  off();
  await flow.startKyc();
  assert.equal(n, 1);
});

test('flow: outcomes never contain the state', async () => {
  const h = harness();
  let state;
  const flow = makeFlow(h, async (url) => ((state = stateIn(url)), returning('ERROR')(url)), {
    status: 'NOT_VERIFIED',
  });
  await flow.startKyc();
  assert.equal(JSON.stringify(h.reports).includes(state), false);
});
