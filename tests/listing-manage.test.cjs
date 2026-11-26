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

const membership = load('lib/membership.ts');
const lib = load('lib/listing-manage.ts', { '@/lib/membership': membership });
const web = (file) =>
  fs.readFileSync(path.join(__dirname, '../../hs-web-app', file), 'utf8').replace(/\r\n/g, '\n');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('status tabs and badge labels match the web', () => {
  const page = web('app/dashboard/properties/page.tsx');
  const tabs = page.slice(page.indexOf('const STATUS_TABS'), page.indexOf('function formatCurrency'));
  const expected = [...tabs.matchAll(/value: "(\w+)", label: "([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(
    plain(lib.STATUS_TABS.map((tab) => [tab.value, tab.label])),
    expected
  );
  const config = web('config/listing-status.config.ts');
  for (const [, status, label] of config.matchAll(/status: "(\w+)",\n\s+label: "([^"]+)"/g))
    assert.equal(lib.listingStatus(status).label, label, status);
});

test('owner actions follow the web transitions and the publication window', () => {
  const now = Date.parse('2026-06-01T00:00:00Z');
  const open = '2026-07-01T00:00:00Z';
  const closed = '2026-05-01T00:00:00Z';
  const targets = (status, expiresAt) =>
    plain(lib.getListingOwnerActions(status, expiresAt, now).map((a) => a.targetStatus));
  assert.deepEqual(targets('PUBLISHED', open), ['HIDDEN', 'RENTED_EXTERNALLY']);
  assert.deepEqual(targets('HIDDEN', open), ['PUBLISHED', 'RENTED_EXTERNALLY']);
  assert.deepEqual(targets('HIDDEN', closed), ['RENTED_EXTERNALLY', 'PENDING_REVIEW']);
  assert.deepEqual(targets('HIDDEN', null), ['RENTED_EXTERNALLY', 'PENDING_REVIEW']);
  assert.deepEqual(targets('RENTED_EXTERNALLY', open), ['PUBLISHED']);
  assert.deepEqual(targets('RENTED_EXTERNALLY', closed), ['PENDING_REVIEW']);
  assert.deepEqual(targets('EXPIRED', closed), ['PENDING_REVIEW']);
  assert.deepEqual(targets('REJECTED', null), ['PENDING_REVIEW']);
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'RESERVED', 'RENTED', 'VIOLATION', 'OTHER'])
    assert.deepEqual(targets(status, open), [], status);
  // Only "rented outside" asks for a note.
  const noted = lib.getListingOwnerActions('PUBLISHED', open, now).filter((a) => a.noteLabel);
  assert.deepEqual(plain(noted.map((a) => a.targetStatus)), ['RENTED_EXTERNALLY']);
  const config = web('config/listing-status.config.ts');
  for (const status of ['PUBLISHED', 'HIDDEN', 'RENTED_EXTERNALLY', 'EXPIRED', 'REJECTED'])
    for (const action of lib.getListingOwnerActions(status, open, now))
      assert.ok(config.includes(action.description), action.description);
});

test('edit and duplicate enablement', () => {
  assert.equal(lib.canEditListing('RENTED', 'ROOM'), true);
  assert.equal(lib.canEditListing('RENTED_EXTERNALLY', 'ROOM'), false);
  assert.equal(lib.canDuplicateListing('RENTED_EXTERNALLY', 'ROOM'), true);
  assert.equal(lib.canEditListing('VIOLATION', 'HOUSE'), false);
  assert.equal(lib.canDuplicateListing('VIOLATION', 'HOUSE'), false);
  assert.equal(lib.canEditListing('DRAFT', 'OFFICE'), false);
});

test('price and Vietnam-time date formatting', () => {
  assert.equal(lib.formatListingAmount(0), 'Thỏa thuận');
  assert.equal(lib.formatListingAmount(3_500_000), '3.5 triệu');
  assert.equal(lib.formatListingAmount(2_000_000_000), '2 tỷ');
  assert.equal(membership.formatVnDateTime('2026-01-31T18:05:00Z'), '01:05 01/02/2026');
  assert.equal(lib.formatListingDate('2026-01-31T18:05:00Z'), '01/02/2026');
  assert.equal(lib.formatListingDate(null), '—');
  assert.equal(lib.formatListingDate('bad'), '—');
});

test('only listing signals refresh, scoped to one listing when asked', () => {
  const signal = lib.isListingChangeSignal;
  const notice = (category, listingId) => ({ category, metadata: { listingId } });
  assert.equal(signal('connect'), true);
  assert.equal(signal('notifications:changed', undefined, 'a'), true);
  assert.equal(signal('notification:new', notice('LISTING', 'a'), 'a'), true);
  assert.equal(signal('notification:new', notice('LISTING', 'b'), 'a'), false);
  assert.equal(signal('notification:new', notice('LISTING'), 'a'), true);
  assert.equal(signal('notification:new', notice('PAYMENT', 'a')), false);
  assert.equal(signal('notification:new', null), false);
  assert.equal(signal('notification:read', notice('LISTING')), false);
});

test('membership keeps plan and extra uses apart', async () => {
  const api = load('services/membershipApi.ts', {
    '@/lib/axios-client': {
      default: {
        get: async () => ({
          data: {
            result: {
              tier: 'FREE',
              remainingUses: 0,
              freeUsed: 3,
              quotaResetsAt: '2026-02-01T00:00:00Z',
              addonRemaining: 2,
              addonReserved: 1,
              addonExpiresAt: '2026-03-01T00:00:00Z',
            },
          },
        }),
      },
    },
  });
  const me = await api.getMyMembership();
  assert.equal(me.freeUsed, 3);
  assert.equal(me.addonReserved, 1);
  assert.equal(membership.getPublishableUses(me), 2);
  assert.equal(
    membership.getAddonBalanceLabel(me),
    'Lượt mua thêm: 2 (hạn gần nhất 07:00 01/03/2026)'
  );
  assert.equal(membership.getQuotaResetLabel(me), 'Hồi lượt vào 07:00 01/02/2026');
  assert.equal(membership.getAddonBalanceLabel({ ...me, unlimited: true }), null);
  assert.equal(membership.getQuotaResetLabel({ ...me, tier: 'PRO' }), null);
  assert.equal(membership.getPublishableUses(null), 0);
});

test('quota refusal is recognised, other failures are not', () => {
  const failed = (status, data) => ({ response: { status, data } });
  const check = membership.isListingQuotaExhaustedError;
  assert.equal(check(failed(400, { code: 4013 })), true);
  assert.equal(check(failed(409, { message: 'Bạn đã hết lượt đăng' })), true);
  assert.equal(check(failed(409, { message: 'Trạng thái không hợp lệ' })), false);
  assert.equal(check(failed(403, { code: 1009 })), false);
  assert.equal(check(new Error('offline')), false);
});

test('list, counts and status change call the web endpoints', async () => {
  const calls = [];
  const client = {
    get: async (...args) => (calls.push(args), { data: { result: {} } }),
    patch: async (...args) => (calls.push(args), { data: {} }),
  };
  const api = load('services/myListingApi.ts', { '@/lib/axios-client': { default: client } });
  await api.getMyListings({ page: 2, status: undefined, keyword: '  ' });
  await api.getMyListings({ page: 1, status: 'HIDDEN', keyword: ' phòng ' });
  await api.getMyListingCounts();
  await api.changeListingStatus('a/b', 'HIDDEN', '  ');
  assert.equal(calls[0][0], '/api/v1/listings/me');
  assert.deepEqual(plain(calls[0][1].params), { page: 2 });
  assert.deepEqual(plain(calls[1][1].params), { page: 1, status: 'HIDDEN', keyword: 'phòng' });
  assert.equal(calls[2][0], '/api/v1/listings/me/counts');
  assert.equal(calls[3][0], '/api/v1/listings/a%2Fb/status');
  assert.deepEqual(plain(calls[3][1]), { status: 'HIDDEN' });
});

test('wiring: the dashboard menu opens the listing list', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.match(
    read('src/screens/ManagementDashboardScreen.tsx'),
    /next === 'landlord-properties' \|\|\s*next === 'landlord-membership'\s*\)\s*onOpenSection\(next\)/
  );
  assert.ok(read('App.tsx').includes('onOpenSection={openManagement}'));
  assert.ok(read('src/screens/ManagementScreen.tsx').includes('<MyListingsScreen onBack={onExit}'));
});

test('a failed background refresh does not discard the first detail load', () => {
  const gate = lib.createApplyGate();
  const first = gate.next();
  gate.next(); // background refresh: it fails, so it claims nothing
  assert.equal(gate.claim(first), true);
  const older = gate.next();
  const newer = gate.next();
  assert.equal(gate.claim(newer), true);
  assert.equal(gate.claim(older), false);
  const stale = gate.next();
  gate.reset(); // another listing is shown
  assert.equal(gate.claim(stale), false);
  assert.equal(gate.claim(gate.next()), true);
});

test('a hidden listing answers visitors with a clear message; the hold time comes from the API', () => {
  assert.match(lib.visitorDetailError(404), /không còn hiển thị/);
  assert.doesNotMatch(lib.visitorDetailError(500), /không còn hiển thị/);
  const banner = fs.readFileSync(
    path.join(__dirname, '../src/components/listing-detail/ListingStatusBanner.tsx'),
    'utf8'
  );
  assert.ok(banner.includes('useRentalHoldMinutes()'));
  assert.ok(!banner.includes('RENTAL_HOLD_DURATION_LABEL'));
});
