/* global __dirname */
// Status view of the floor map: cell lines, sheet items, legend counts, matches and column widths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const source = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  const resolve = (name) => {
    // Only used for contract wording and routes, not by the map view.
    if (name === '@/lib/rental/contract-routes' || name === '@/lib/rental/rental-labels') return {};
    return name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(resolve, mod, mod.exports);
  return mod.exports;
}
const view = load('src/lib/branch-view.ts');

test('pulling the map refreshes its assignments along with the layout and overview', () => {
  const map = fs.readFileSync(
    path.join(ROOT, 'src/components/branch/view/BranchMapView.tsx'), 'utf8'
  );
  const detail = fs.readFileSync(path.join(ROOT, 'src/screens/branch/BranchDetailScreen.tsx'), 'utf8');
  assert.deepEqual(
    {
      withFloors: /await Promise\.all\(\[reload\(\), onRefreshLayout\(\)\]\)/.test(map),
      withoutFloors: /onRefresh=\{\(\) => void reload\(\)\}/.test(detail),
    },
    { withFloors: false, withoutFloors: false },
    'pulling must refresh the mounted tray in either map state'
  );
});

test('the branch form choices meet the 44dp minimum target', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src/screens/BranchManagementScreen.tsx'), 'utf8');
  assert.equal(
    /min-h-11 justify-center rounded-xl border px-3 py-2/.test(shell),
    false,
    'a short label with min-h-11 and inlineRem 14 produces a 38.5dp target'
  );
});

function branchReadHarness() {
  const file = path.join(ROOT, 'src/lib/use-branch-read.ts');
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const state = [];
  const refs = [];
  let stateIndex, refIndex, effect, cleanup, previousEffect, callback, previousDeps;
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next) => {
        state[index] = typeof next === 'function' ? next(state[index]) : next;
      }];
    },
    useRef(initial) {
      return (refs[refIndex++] ??= { current: initial });
    },
    useCallback(fn, deps) {
      if (!previousDeps || deps.some((dep, index) => dep !== previousDeps[index])) callback = fn;
      previousDeps = deps;
      return callback;
    },
    useEffect(run, [dependency]) {
      if (dependency !== previousEffect) effect = run;
      previousEffect = dependency;
    },
  };
  const module = { exports: {} };
  const mocks = {
    react,
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(
    (name) => mocks[name] ?? require(name),
    module,
    module.exports
  );
  const describe = (error) => error.message;
  return (read) => {
    stateIndex = refIndex = 0;
    const result = module.exports.useBranchRead(read, describe);
    if (effect) {
      cleanup?.();
      cleanup = effect();
      effect = null;
    }
    return result;
  };
}

test('changing month drops an older in-flight map response', async () => {
  const render = branchReadHarness();
  let finish;
  const november = () => new Promise((resolve) => { finish = resolve; });
  const december = async () => 'December';
  render(november);
  render(december);
  await Promise.resolve();
  finish('November');
  await Promise.resolve();
  assert.equal(render(december).data, 'December');
});

test('a room write completing after month change cannot erase the current overview', async () => {
  const render = branchReadHarness();
  const november = async () => 'November';
  const december = async () => 'December';
  const { reload: afterRoomWrite } = render(november);
  render(december);
  await Promise.resolve();
  assert.equal(render(december).data, 'December');
  await afterRoomWrite();
  assert.equal(render(december).data, 'December');
});

const times = { billingNow: '2026-11-27T00:00:00Z', realNow: '2026-11-27T00:00:00Z' };
const target = (kind, href = `/dashboard/x/${kind}`) => ({ kind, id: kind, href });
const payment = (id, status, extra = {}) => ({
  id,
  kind: 'MONTHLY',
  contractId: 'c',
  status,
  dueAt: '2026-11-27T01:00:00Z',
  confirmationDueAt: null,
  clock: 'REAL',
  target: target('INVOICE'),
  ...extra,
});
const room = (roomId, extra = {}) => ({
  roomId,
  status: 'VACANT',
  tenantName: null,
  target: null,
  nextStay: null,
  payments: { status: 'NONE', count: 0, items: [] },
  meters: [],
  contracts: [],
  ...extra,
});

test('payment cell and sheet keep the server order and count down only a pending payment', () => {
  const items = [
    payment('b', 'PENDING_CONFIRMATION', { confirmationDueAt: '2026-11-27T02:00:00Z' }),
    payment('a', 'UNISSUED', { target: target('CONTRACT', 'https://elsewhere') }),
  ];
  const cell = room('r', { payments: { status: 'PENDING_CONFIRMATION', count: 2, items } });
  assert.deepEqual(view.cellLines(cell, 'payments', times, 3_600_000), [
    '2 khoản',
    'Hạn 08:00 27/11/2026',
    'Tự xác nhận sớm nhất sau 1 giờ 0 phút',
  ]);
  const entries = view.layerEntries(cell, 'payments', times, 0);
  assert.deepEqual(
    entries.map((e) => e.key),
    ['b', 'a']
  );
  assert.equal(entries[0].title, 'Chờ xác nhận · Hóa đơn tháng');
  assert.equal(view.openLabel(entries[0].target), 'Mở hóa đơn');
  assert.deepEqual(entries[1].lines, ['Hạn dự kiến 08:00 27/11/2026']);
  assert.equal(entries[1].target, null, 'a link outside the dashboard is not openable');
  assert.deepEqual(view.cellLines(room('empty'), 'payments', times, 0), []);
  assert.equal(view.unplacedEntries({ ...times, unplacedPayments: items }, 0).length, items.length);
});

test('room layer: current page and next stay; a ROOM target is not a page', () => {
  const cell = room('r', {
    status: 'OCCUPIED',
    tenantName: 'An',
    target: target('CONTRACT'),
    nextStay: { tenantName: null, moveInDate: '2026-12-01', target: target('RENTAL_REQUEST') },
  });
  assert.deepEqual(view.cellLines(cell, 'rooms', times, 0), [
    'An',
    'Sắp vào 01/12/2026: chưa có tên',
  ]);
  assert.deepEqual(
    view.layerEntries(cell, 'rooms', times, 0).map((e) => [e.key, e.title, e.lines]),
    [
      ['current', 'Đang thuê', ['An']],
      ['next', 'Sắp vào', ['Ngày vào 01/12/2026']],
    ]
  );
  assert.deepEqual(view.layerEntries(room('v', { target: target('ROOM') }), 'rooms', times, 0), []);
});

test('meter and contract layers word every item and count the extra ones in the cell', () => {
  const meter = (periodIndex, status) => ({
    contractId: 'c',
    periodIndex,
    status,
    meterDate: '2026-11-27',
    deadlineAt: '2026-11-27T17:00:00Z',
    target: target('INVOICE'),
  });
  const cell = room('r', {
    meters: [meter(0, 'TODAY'), meter(1, 'RECORDED')],
    contracts: [
      {
        contractId: 'c',
        status: 'WITHIN_30',
        endDateExclusive: '2026-12-10',
        daysRemaining: 13,
        target: target('CONTRACT'),
      },
    ],
  });
  assert.deepEqual(view.cellLines(cell, 'meters', times, 0), [
    'Ngày ghi 27/11/2026',
    'Hạn ghi 00:00 28/11/2026',
    '2 mục',
  ]);
  const meters = view.layerEntries(cell, 'meters', times, 0);
  assert.deepEqual(
    meters.map((e) => e.key),
    ['c:0', 'c:1']
  );
  assert.deepEqual(meters[1].lines, ['Ngày ghi 27/11/2026']);
  assert.equal(view.cellLabel(cell, 'contracts'), 'Còn 13 ngày · hết 09/12/2026');
  assert.deepEqual(view.cellLines(cell, 'contracts', times, 0), []);
  const entries = view.layerEntries(cell, 'contracts', times, 0);
  assert.equal(entries[0].title, 'Còn 13 ngày · hết 09/12/2026');
  assert.deepEqual(entries[0].lines, ['≤ 30 ngày']);
  assert.deepEqual(view.cellLines(room('none'), 'contracts', times, 0), []);
});

test('lease wording: last day is the day before the exclusive end, most urgent first, with a count', () => {
  const overview = load('src/lib/branch-overview.ts');
  const e = (endDateExclusive, daysRemaining) => ({ endDateExclusive, daysRemaining });
  assert.equal(overview.expiryText(e('2027-01-01', 5)), 'Còn 5 ngày · hết 31/12/2026');
  assert.equal(overview.expiryText(e('2028-03-01', 90)), 'Còn 90 ngày · hết 29/02/2028');
  assert.equal(overview.expiryText(e('2026-11-27', 0)), 'Hết hạn 26/11/2026 · chưa bàn giao');
  assert.equal(overview.expiryText(e('2026-11-20', -7)), 'Hết hạn 19/11/2026 · chưa bàn giao');
  const lease = (contractId, status, endDateExclusive, daysRemaining) => ({
    contractId, status, endDateExclusive, daysRemaining, target: target('CONTRACT'),
  });
  const cell = room('m', {
    status: 'OCCUPIED',
    contracts: [lease('x', 'LONG', '2027-06-01', 200), lease('y', 'WITHIN_30', '2026-11-25', -2)],
  });
  assert.equal(overview.roomLayerStatus(cell, 'contracts'), 'WITHIN_30');
  assert.equal(view.cellLabel(cell, 'contracts'), 'Hết hạn 24/11/2026 · chưa bàn giao');
  assert.deepEqual(view.cellLines(cell, 'contracts', times, 0), ['+1 hợp đồng khác']);
  assert.deepEqual(
    view.layerEntries(cell, 'contracts', times, 0).map((x) => x.key),
    ['y', 'x']
  );
  assert.equal(overview.layerReady({ rooms: [cell] }, 'contracts'), true);
  const bad = (patch) => overview.layerReady({ rooms: [room('b', { contracts: [{ ...lease('c', 'LONG', '2027-06-01', 9), ...patch }] })] }, 'contracts');
  assert.equal(bad({}), true);
  assert.equal(bad({ status: 'SOON' }), false);
  assert.equal(bad({ endDateExclusive: 'later' }), false);
});

const slot = (key, roomCode) => ({ key, id: key, roomCode });
const floors = [
  {
    key: 'f1',
    label: 'Tầng 1',
    rows: [{ key: 'a', label: 'Dãy 1', slots: [slot('1', '101'), slot('gap', null)] }],
  },
  {
    key: 'f2',
    label: 'Tầng 2',
    rows: [{ key: 'b', label: 'Dãy 1', slots: [slot('2', '201'), slot('3', '202')] }],
  },
];
const overdue = { payments: { status: 'OVERDUE', count: 1, items: [] } };
const rooms = new Map([
  ['1', room('1', { tenantName: 'Nguyễn Đức' })],
  ['2', room('2', overdue)],
]);

test('legend counts cells on every floor; highlight and search narrow the matches', () => {
  const idle = view.mapSummary(floors, rooms, 'payments', '  ', null);
  assert.equal(idle.filtering, false);
  assert.equal(idle.matched.size, 0);
  assert.deepEqual(view.legendItems('payments', idle.counts, null), [
    { status: 'OVERDUE', label: 'Quá hạn', count: 1 },
    { status: 'NONE', label: 'Không có khoản', count: 1 },
  ]);
  const late = view.mapSummary(floors, rooms, 'payments', '', 'OVERDUE');
  assert.deepEqual([...late.matched], ['2']);
  assert.deepEqual(
    [...late.perFloor],
    [
      ['f1', 0],
      ['f2', 1],
    ]
  );
  assert.deepEqual([...view.mapSummary(floors, rooms, 'payments', 'duc', null).matched], ['1']);
  assert.equal(view.mapSummary(floors, rooms, 'payments', 'duc', 'OVERDUE').matched.size, 0);
  // Without any status (loading or failed) the room code is still searchable.
  assert.deepEqual([...view.mapSummary(floors, new Map(), 'rooms', '202', null).matched], ['3']);
  assert.deepEqual(view.legendItems('payments', new Map(), 'PAID'), [
    { status: 'PAID', label: 'Đã thu', count: 0 },
  ]);
});

test('contracts layer: empty list is over 60 days when occupied, otherwise no lease', () => {
  const overview = load('src/lib/branch-overview.ts');
  const status = load('src/lib/branch-status.ts');
  const occupied = room('o', { status: 'OCCUPIED' });
  const vacant = room('v');
  assert.equal(overview.roomLayerStatus(occupied, 'contracts'), 'LONG');
  assert.equal(overview.roomLayerStatus(vacant, 'contracts'), 'NO_LEASE');
  assert.equal(view.cellLabel(occupied, 'contracts'), 'Còn hạn trên 60 ngày');
  assert.equal(overview.statusLabel('contracts', 'LONG'), 'Trên 60 ngày');
  assert.equal(view.cellLabel(vacant, 'contracts'), 'Không có hợp đồng');
  assert.equal(status.layerLook('contracts', 'LONG').tone, 'neutral');
  assert.equal(status.layerLook('contracts', 'NO_LEASE').tone, 'neutral');
  // Two filter groups; the urgency wording and colour stay on the cell and entries.
  assert.deepEqual(overview.LAYER_STATUS_LABEL.contracts, {
    HAS_LEASE: 'Có hợp đồng',
    NO_LEASE: 'Không có hợp đồng',
  });
  assert.equal(overview.roomLegendKey(occupied, 'contracts'), 'HAS_LEASE');
  assert.equal(overview.roomLegendKey(vacant, 'contracts'), 'NO_LEASE');
  assert.equal(overview.roomLegendKey(occupied, 'rooms'), 'OCCUPIED');
  const soon = room('s', {
    contracts: [{ contractId: 'c', status: 'WITHIN_30', endDateExclusive: '2026-12-10', daysRemaining: 13 }],
  });
  assert.equal(overview.roomLegendKey(soon, 'contracts'), 'HAS_LEASE');
  assert.equal(status.layerLook('contracts', 'WITHIN_30').tone, 'danger');
  const map = new Map([['1', occupied], ['2', vacant], ['3', room('w', { status: 'REPAIR' })]]);
  const fl = [{ key: 'f', label: 'T', rows: [{ key: 'a', label: 'D', slots: [slot('1', '1'), slot('2', '2'), slot('3', '3')] }] }];
  const summary = view.mapSummary(fl, map, 'contracts', '', 'NO_LEASE');
  assert.deepEqual(view.legendItems('contracts', summary.counts, null), [
    { status: 'HAS_LEASE', label: 'Có hợp đồng', count: 1 },
    { status: 'NO_LEASE', label: 'Không có hợp đồng', count: 2 },
  ]);
  assert.deepEqual([...summary.matched], ['2', '3']);
});

test('columns share a 320px screen up to two rows, then scroll with a fixed width', () => {
  const narrow = 320 - 58;
  assert.equal(view.columnWidth(1, 2, narrow), null);
  assert.equal(view.columnWidth(2, 1, narrow), null);
  assert.equal(view.columnWidth(3, 1, narrow), 136);
  assert.equal(view.columnWidth(2, 1.3, narrow), 177);
  assert.equal(view.columnWidth(2, 3, narrow), 218);
  assert.equal(view.columnWidth(2, 1.3, 700), null);
});

test('UNLINKED and VACANT with a listing status: parse, wording, look, legend and target', () => {
  const overview = load('src/lib/branch-overview.ts');
  const status = load('src/lib/branch-status.ts');
  const wire = (extra) => ({
    branchId: 'b',
    month: '2026-11',
    billingNow: times.billingNow,
    realNow: times.realNow,
    unplacedPayments: [],
    rooms: [room('r', extra)],
  });
  const listing = target('LISTING', '/dashboard/properties/view?id=7');
  for (const extra of [
    { status: 'UNLINKED' },
    { status: 'VACANT', target: listing, listingStatus: 'HIDDEN' },
    { status: 'VACANT', target: listing, listingStatus: null },
    { status: 'VACANT' }, // an older server sends no listingStatus
  ])
    assert.equal(overview.parseOverview(wire(extra)).rooms[0].status, extra.status);
  assert.throws(() => overview.parseOverview(wire({ listingStatus: 5 })));

  const vacant = room('v', { status: 'VACANT', target: listing, listingStatus: 'HIDDEN' });
  assert.equal(view.roomLabel(vacant), 'Trống · Đã ẩn');
  assert.equal(view.roomLabel(room('v', { listingStatus: null })), 'Trống');
  assert.equal(view.roomLabel(room('u', { status: 'UNLINKED' })), 'Chưa gắn tin');
  assert.equal(view.roomLabel(room('o', { status: 'OCCUPIED', listingStatus: 'HIDDEN' })), 'Đang thuê');
  assert.equal(view.cellLabel(vacant, 'rooms'), 'Trống · Đã ẩn');
  assert.equal(view.cellLabel(vacant, 'payments'), 'Không có khoản');

  // The sheet opens the room's target listing through the same entry as any other current page.
  const [entry] = view.layerEntries(vacant, 'rooms', times, 0);
  assert.deepEqual([entry.title, entry.target], ['Trống · Đã ẩn', listing]);
  assert.equal(view.openLabel(entry.target), 'Mở tin đăng');
  assert.deepEqual(view.layerEntries(room('u', { status: 'UNLINKED' }), 'rooms', times, 0), []);

  const look = status.layerLook('rooms', 'UNLINKED');
  assert.equal(look.tone, 'muted');
  assert.notDeepEqual(look, status.layerLook('rooms', 'VACANT'));
  assert.ok(status.BRANCH_TONES.muted.box && status.BRANCH_TONES.muted.text);

  const counts = new Map([['VACANT', 1], ['UNLINKED', 2]]);
  assert.deepEqual(view.legendItems('rooms', counts, null), [
    { status: 'VACANT', label: 'Trống', count: 1 },
    { status: 'UNLINKED', label: 'Chưa gắn tin', count: 2 },
  ]);
});
