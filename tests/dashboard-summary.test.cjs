/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    Date,
    Number,
    Intl,
    URL,
    AbortController,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return module.exports;
}
const values = load('lib/dashboard-summary.ts');

test('analytics month range rejects malformed, reversed and over-24-month ranges', () => {
  assert.equal(values.dashboardMonthRangeError('2026-01', '2026-01'), null);
  assert.equal(values.dashboardMonthRangeError('2025-01', '2026-12'), null);
  for (const [from, to] of [
    ['0000-01', '2026-01'],
    ['2026-13', '2027-01'],
    ['2026-02', '2026-01'],
    ['2024-12', '2026-12'],
    ['', '2026-11'],
  ]) {
    assert.equal(typeof values.dashboardMonthRangeError(from, to), 'string');
  }
});

test('dashboard JSON preserves exact decimal tokens without rewriting escaped text', () => {
  const text =
    '{"result":{"receivedVnd":9007199254740993.25,"heldTotal":100.05,"count":3,"title":"A \\\"vnd\\\": 123.4", "rate":1.25e-2}}';
  const data = values.parseDashboardResponse(text).result;
  assert.equal(data.receivedVnd, '9007199254740993.25');
  assert.equal(data.heldTotal, '100.05');
  assert.equal(data.count, 3);
  assert.equal(data.rate, '1.25e-2');
  assert.equal(data.title, 'A "vnd": 123.4');
});

test('financial display does not round large values, negative fractions or exponent amounts', () => {
  assert.equal(values.dashboardMoney('9007199254740993.2500'), '9.007.199.254.740.993,25 ₫');
  assert.equal(values.dashboardMoney('-0.0500'), '-0,05 ₫');
  assert.equal(values.dashboardMoney('1.25e3'), '1.250 ₫');
  assert.equal(values.dashboardMoney('1.25e-3'), '0,00125 ₫');
  assert.equal(values.dashboardMoney(null), '—');
  assert.equal(values.dashboardMoney('invalid'), '—');
});

test('web fallbacks stay on the configured origin and dates use Vietnam timezone', () => {
  assert.equal(
    values.dashboardWebUrl(undefined, '/support'),
    'https://www.homespace.id.vn/support'
  );
  assert.equal(
    values.dashboardWebUrl('https://homespace.example/app', '/dashboard/analytics?from=2026-01'),
    'https://homespace.example/dashboard/analytics?from=2026-01'
  );
  for (const unsafe of [
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    '/x\n',
  ])
    assert.equal(values.dashboardWebUrl(undefined, unsafe), null);
  assert.equal(values.dashboardWebUrl('javascript:alert(1)', '/support'), null);
  assert.equal(values.dashboardWebUrl('https://user:secret@homespace.example', '/support'), null);
  assert.equal(values.dashboardDate('2026-11-30T17:00:00Z'), '01/12/2026');
  assert.match(values.dashboardDate('2026-11-30T17:05:00Z', true), /00:05/);
  assert.equal(values.dashboardDate(null), 'Chưa xác định');
});

test('summary API uses verified caller endpoints, preserves signal and refuses missing results', async () => {
  const calls = [];
  let result = { result: { money: '9007199254740993.25' } };
  const api = load('services/dashboardApi.ts', {
    '@/lib/axios-client': {
      get: async (...args) => {
        calls.push(args);
        return { data: result };
      },
    },
    '@/lib/dashboard-summary': values,
  });
  const signal = new AbortController().signal;
  await api.getLandlordSummary(signal);
  await api.getTenantSummary(signal);
  await api.getLandlordAnalytics(signal, { from: '2026-01', to: '2026-11', listingPage: 2 });
  assert.deepEqual(
    calls.map((c) => c[0]),
    [
      '/api/v1/dashboard/landlord/summary',
      '/api/v1/dashboard/tenant/summary',
      '/api/v1/dashboard/analytics',
    ]
  );
  for (const [, config] of calls) {
    assert.equal(config.signal, signal);
    assert.equal(config.transformResponse[0], values.parseDashboardResponse);
  }
  assert.equal(calls[2][1].params.listingPage, 2);
  result = {};
  await assert.rejects(api.getTenantSummary(signal), /chưa trả dữ liệu/);
});

test('aborted or signed-out dashboard requests cannot repopulate account data', async () => {
  let generation = 0;
  let cleanupSession;
  let effect;
  const writes = [];
  let resolve;
  let signal;
  const hooks = {
    useState: () => [null, (value) => writes.push(value)],
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    useEffect: (fn) => {
      effect = fn;
    },
  };
  const ui = load('components/management/DashboardUi.tsx', {
    react: hooks,
    'react/jsx-runtime': {},
    'react-native': {},
    '@/components/Icon': {},
    '@/lib/api-error': { apiError: String },
    '@/lib/session-end': {
      sessionGeneration: () => generation,
      onSessionEnd: (fn) => {
        cleanupSession = fn;
        return () => {};
      },
    },
  });
  ui.useDashboardData((input) => {
    signal = input;
    return new Promise((done) => {
      resolve = done;
    });
  });
  const cleanup = effect();
  generation++;
  cleanupSession();
  resolve({ private: 'previous-account' });
  await new Promise((done) => setImmediate(done));
  assert.equal(signal.aborted, true);
  assert.equal(
    writes.some((value) => value?.private),
    false
  );
  cleanup();
});

test('native summaries render partial landlord data and an empty tenant without invented balances', () => {
  const element = (type, props) => ({ type, props });
  const runtime = { jsx: element, jsxs: element, Fragment: 'Fragment' };
  const ui = load('components/management/DashboardUi.tsx', {
    react: {},
    'react/jsx-runtime': runtime,
    'react-native': {
      Text: 'Text',
      View: 'View',
      Pressable: 'Pressable',
      ActivityIndicator: 'ActivityIndicator',
    },
    '@/components/Icon': () => null,
    '@/lib/api-error': {},
    '@/lib/session-end': {},
  });
  let state;
  const summary = load('components/management/DashboardSummary.tsx', {
    'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View' },
    '@/services/dashboardApi': {},
    '@/lib/dashboard-summary': values,
    '@/lib/branch-overview': { workLabel: () => ['Khác', 'Việc cần xem'] },
    './DashboardUi': { ...ui, useDashboardData: () => state },
  });
  function text(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    if (Array.isArray(node)) return node.map(text).join(' ');
    if (typeof node.type === 'function') return text(node.type(node.props));
    return text(node.props?.children);
  }
  state = {
    data: {
      billingNow: '2026-11-30T17:00:00Z',
      realNow: '2026-11-28T00:00:00Z',
      month: '2026-11',
      setup: null,
      todo: null,
      revenue: null,
      contracts: null,
      rooms: { total: 5, occupied: 3, vacant: 1, reserved: 1 },
      listings: {
        published: 1,
        pendingReview: 0,
        draft: 0,
        unplaced: { listings: 0, contracts: 0 },
        needsFix: { rejected: 0, violation: 0, hidden: 0, items: [] },
      },
      membership: null,
      appointments: [],
      holds: [],
      competing: [],
      complaints: null,
    },
    loading: false,
    reload() {},
    error: null,
  };
  const landlord = text(summary.LandlordSummaryView({ onAction() {} }));
  assert.match(landlord, /3 \/ 5/);
  assert.match(landlord, /Chưa tải được nhóm dữ liệu/);
  assert.doesNotMatch(landlord, /0 ₫/);
  state = {
    ...state,
    data: {
      billingNow: '2026-11-30T17:00:00Z',
      setup: { onboarded: true },
      tasks: { total: 0, urgentCount: 0, items: [] },
      leases: { activeCount: 0, items: [] },
      payables: {
        overdueCount: 0,
        overdueAmount: 0,
        dueSoonAmount: 0,
        items: [],
        awaiting: { count: 0, amount: 0, items: [] },
        refundsIncoming: { count: 0, amount: 0, items: [] },
      },
      deposits: { heldTotal: '9007199254740993.25', items: [] },
      holds: [],
      requests: { open: [] },
      waiting: { count: 0, items: [] },
      visits: { upcomingCount: 0, items: [] },
      spending: {
        total: 0,
        totalExcludingDeposit: 0,
        total12mExcludingDeposit: 0,
        months: [],
        receiptPdfIssues: 0,
      },
      complaints: { openCount: 0, dueFromMeCount: 0, items: [] },
      saved: { total: 0, available: 0, unavailable: 0 },
    },
  };
  const tenant = text(summary.TenantSummaryView({ onAction() {} }));
  assert.match(tenant, /9\.007\.199\.254\.740\.993,25 ₫/);
  assert.match(tenant, /Chưa có hợp đồng đi thuê/);
});
