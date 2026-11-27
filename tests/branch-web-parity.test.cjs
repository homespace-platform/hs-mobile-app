/* global __dirname */
// Regressions found by running web and mobile side by side on the same fixtures (web is the reference).
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  const resolve = (name) => (name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name));
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(resolve, mod, mod.exports);
  return mod.exports;
}
const layout = load('src/lib/branch-layout.ts');
const assignment = load('src/lib/branch-assignment.ts');
const overview = load('src/lib/branch-overview.ts');
const view = load('src/lib/branch-view.ts');
const status = load('src/lib/branch-status.ts');
const form = load('src/lib/branch-form.ts');

test('validateDraft lists the whole-map slot limit last, like web (the first message is shown)', () => {
  const slots = (n, p) => Array.from({ length: n }, (_, i) => ({ key: `${p}${i}`, roomCode: `${p}${i}` }));
  const draft = [{ key: 'f', label: 'T', rows: Array.from({ length: 16 }, (_, r) => ({ key: `r${r}`, label: r === 0 ? ' ' : 'D', slots: slots(100, `r${r}s`) })) }];
  const errors = layout.validateDraft(draft);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /có quá 10 dãy/);
  assert.equal(errors[1], 'T có dãy chưa có tên.');
  assert.equal(errors[2], 'Sơ đồ có quá 1500 ô. Tối đa 1500 ô cho toàn sơ đồ.');
});

test('room codes compare like web: trimmed and upper-cased (not lower-cased)', () => {
  assert.equal(assignment.codeMismatch('SS', 'ß'), null);
  assert.equal(assignment.codeMismatch('i', 'ı'), null);
  assert.equal(assignment.codeMismatch('a1', ' A1 '), null);
});

test('legend order puts UNLINKED right after VACANT, like web', () => {
  assert.deepEqual(Object.keys(overview.ROOM_STATUS_LABEL), ['VACANT', 'UNLINKED', 'ADVERTISED', 'RESERVED', 'OCCUPIED', 'MOVING_IN', 'EXTERNAL_RENT', 'REPAIR']);
});

test('a vacant room shows its listing status whenever the server sent a string (even empty), nothing otherwise', () => {
  const room = (listingStatus) => ({ status: 'VACANT', listingStatus });
  assert.equal(view.roomLabel(room('')), 'Trống · Đang cập nhật');
  assert.equal(view.roomLabel(room(7)), 'Trống');
  assert.equal(view.roomLabel(room(null)), 'Trống');
});

test('the "Có hợp đồng" chip keeps the document icon with a neutral tone', () => {
  assert.deepEqual({ ...status.layerLook('contracts', 'HAS_LEASE') }, { icon: 'document-text-outline', tone: 'neutral' });
});

const charge = (chargeType, billingMethod, amount) => ({ chargeType, billingMethod, amount, currency: 'VND' });
const branch = (o) => ({ id: 'b', name: 'N', category: 'ROOM', refId: 'r', display: 'd', ...o });
const rows = (b) => Object.fromEntries(form.buildBranchInput({ ...form.branchForm(b), name: 'N', refId: 'r' }).defaultCharges.map((c) => [c.chargeType, c]));

test('branch form: units on included / free / not-applicable rows match web', () => {
  const r = rows(branch({ motorbikeParkingCapacity: 5, defaultCharges: [charge('MANAGEMENT', 'INCLUDED'), charge('SERVICE_OR_GARBAGE', 'INCLUDED'), charge('MOTORBIKE_PARKING', 'FREE'), charge('CAR_PARKING', 'NOT_APPLICABLE')] }));
  assert.equal(r.MANAGEMENT.unit, 'phòng/tháng');
  assert.equal(r.SERVICE_OR_GARBAGE.unit, 'phòng/tháng');
  assert.equal(r.MOTORBIKE_PARKING.unit, 'xe/tháng');
  assert.equal(r.CAR_PARKING.unit, 'xe/tháng');
  assert.equal(r.CAR_PARKING.amount, undefined);
});

test('branch form: editing a branch without saved rows follows web (apartment fee, car capacity, legacy CLEANING, capacity fallbacks)', () => {
  assert.equal(form.branchForm(branch({ category: 'APARTMENT' })).charges.MANAGEMENT.method, 'PER_MONTH');
  assert.equal(form.branchForm(branch({ category: 'HOUSE' })).charges.MANAGEMENT.method, 'NOT_APPLICABLE');
  const car = form.branchForm(branch({ carParkingCapacity: 3, defaultCharges: [] }));
  assert.deepEqual([car.charges.CAR_PARKING.method, car.carCapacity], ['PER_VEHICLE_MONTH', '3']);
  const legacy = form.branchForm(branch({ defaultCharges: [charge('CLEANING', 'PER_MONTH', 20000)] }));
  assert.deepEqual({ ...legacy.charges.SERVICE_OR_GARBAGE }, { method: 'PER_MONTH', amount: '20000' });
  const noCap = form.branchForm(branch({ defaultCharges: [charge('MOTORBIKE_PARKING', 'PER_VEHICLE_MONTH', 90000), charge('CAR_PARKING', 'PER_VEHICLE_MONTH', 900000)] }));
  assert.deepEqual([noCap.motorbikeCapacity, noCap.carCapacity], ['10', '2']);
  assert.equal(form.branchForm(branch({ defaultCharges: [charge('ELECTRICITY', '', 3000)] })).charges.ELECTRICITY.method, 'PER_KWH');
  assert.equal(form.branchForm(branch({ defaultCharges: [{ ...charge('OTHER', 'PER_MONTH', 5) }] })).customFees[0].name, 'Phí dịch vụ khác');
});
