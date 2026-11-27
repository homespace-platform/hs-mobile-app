/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '../src');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (request) => {
      assert.ok(request.startsWith('@/'), `unexpected dependency: ${request}`);
      return load(`${path.join(SRC, request.slice(2))}.ts`);
    },
  });
  return module.exports;
}
const M = (name) => load(`${path.join(SRC, name)}.ts`);
const read = (name) => fs.readFileSync(path.join(SRC, name), 'utf8');

const { branchDestination, targetNote } = M('lib/branch-target');
const { contractLandingTarget } = M('lib/rental/payment-module');
const { isSettlementTransfer, paymentLink } = M('lib/rental/payment-link');
const { workDeadline, orderByAttention, targetHref } = M('lib/branch-overview');

const UUID = '0a1b2c3d-1111-4222-8333-944455556666';
const plain = (value) => JSON.parse(JSON.stringify(value));
const is = (href, expected) => assert.deepEqual(plain(branchDestination(href)), expected, href);
const rental = (route) => ({ kind: 'rental', route });
const detail = (query) =>
  rental({ screen: 'contract-detail', side: 'landlord', contractId: UUID, ...query });
const H = `/dashboard/landlord/contracts/${UUID}`;

// Every form built by core BranchOverviewService / BranchAttentionService / BranchMonitoringService.
test('contract hrefs keep tab, section and the selected invoice', () => {
  is(`${H}?tab=overview`, detail({ tab: 'overview' }));
  is(`${H}?tab=payment`, detail({ tab: 'payment' }));
  is(`${H}?tab=sign`, detail({ tab: 'sign' }));
  is(`${H}?tab=end`, detail({ tab: 'end' }));
  const monthly = { tab: 'payment', section: 'monthly' };
  is(`${H}?tab=payment&section=monthly`, detail(monthly));
  is(`${H}?tab=payment&section=monthly&invoice=${UUID}`, detail({ ...monthly, invoice: UUID }));
  // First rent: the virtual id survives the server's encoding.
  for (const invoice of [`first-rent%3A${UUID}`, `first-rent:${UUID}`])
    is(
      `${H}?tab=payment&section=monthly&invoice=${invoice}`,
      detail({ ...monthly, invoice: `first-rent:${UUID}` })
    );
  // Amendment and early exit open the end tab.
  is(`${H}?tab=end&amendmentId=${UUID}`, detail({ tab: 'end' }));
  is(`${H}?tab=end&focus=early-exit`, detail({ tab: 'end' }));
  is(`/dashboard/contracts/${UUID}`, rental({ screen: 'contract-landing', contractId: UUID }));
  is(
    `/dashboard/contracts/${UUID}?tab=sign`,
    rental({ screen: 'contract-landing', contractId: UUID, tab: 'sign' })
  );
});

test('rental request, payment, appointment, listing, new listing and tray', () => {
  is(
    `/dashboard/rental-requests?requestId=${UUID}`,
    rental({ screen: 'rental-requests', mode: 'RECEIVED', requestId: UUID })
  );
  is(
    `/dashboard/payments?paymentId=${UUID}`,
    rental({ screen: 'payment-lookup', paymentId: UUID, actHere: true })
  );
  is(`/dashboard/viewing-schedules?appointmentId=${UUID}`, {
    kind: 'appointment',
    appointmentId: UUID,
  });
  is(`/dashboard/properties/view?id=${UUID}`, { kind: 'listing', listingId: UUID });
  is(`/dashboard/properties/new?branchId=b-1&roomId=r-1`, {
    kind: 'new-listing',
    branchId: 'b-1',
    roomId: 'r-1',
  });
  is('/dashboard/branches/b-1?tab=map#unplaced', { kind: 'tray', branchId: 'b-1' });
});

test('the same settlement in the map and attention opens the transfer actions', () => {
  const { cellLines, layerEntries } = M('lib/branch-view');
  const { layerLook } = M('lib/branch-status');
  const { parseOverview, parseAttention, roomLayerStatus } = M('lib/branch-overview');
  const times = { billingNow: '2026-11-27T02:00:00Z', realNow: '2026-11-27T01:00:00Z' };
  const target = { kind: 'PAYMENT', id: UUID, href: '/dashboard/payments?paymentId=' + UUID };
  const dueAt = '2026-11-27T04:00:00Z';
  const payment = {
    id: UUID, kind: 'DEPOSIT_ADJUSTMENT', contractId: 'c-1', status: 'PENDING_CONFIRMATION',
    dueAt, confirmationDueAt: dueAt, clock: 'REAL', target,
  };
  const overview = parseOverview({
    ...times, branchId: 'b-1', month: '2026-11', unplacedPayments: [],
    rooms: [{
      roomId: 'r-1', status: 'OCCUPIED', tenantName: 'Lan', target: null, nextStay: null,
      payments: { status: payment.status, count: 2, items: [payment, {
        ...payment, id: 'paid-1', status: 'PAID', confirmationDueAt: null,
      }] },
    }],
  });
  const attention = parseAttention({
    ...times, branchId: 'b-1', page: 0, size: 20, totalElements: 1,
    items: [{
      key: 'PAYMENT_CONFIRM:' + UUID, type: 'PAYMENT_CONFIRM', roomId: 'r-1', roomCode: '101',
      contextLabel: 'HĐ-1', periodIndex: null, dueAt, clock: 'REAL', priority: 'URGENT', target,
    }],
  });
  const room = overview.rooms[0];
  assert.equal(layerLook('payments', roomLayerStatus(room, 'payments')).tone, 'pending');
  assert.equal(cellLines(room, 'payments', times, 0)[0], '2 khoản');
  const entry = layerEntries(room, 'payments', times, 0)[0];
  const work = attention.items[0];
  assert.equal(targetHref(entry.target), targetHref(work.target));
  is(targetHref(entry.target), rental({ screen: 'payment-lookup', paymentId: UUID, actHere: true }));
  const { rentalRouteFromActionPath } = M('lib/rental-nav/deep-link');
  assert.deepEqual(plain(rentalRouteFromActionPath(target.href, 'landlord')), {
    screen: 'payment-lookup',
    paymentId: UUID,
  });
});

test('attention vacancy routes the saved room ID into creation; an aisle or edit cannot reuse it', () => {
  const { listRooms, readRoomLink, withRoomId } = M('lib/listing-room-link');
  const destination = branchDestination('/dashboard/properties/new?branchId=b-1&roomId=r-1');
  const layout = (roomCode) => ({ floors: [{ label: 'Tầng 1', rows: [{
    label: 'Dãy 1', slots: [{ id: 'r-1', roomCode }],
  }] }] });
  const link = readRoomLink(destination);
  assert.equal(listRooms(layout('101'))[0].id, link.roomId);
  assert.equal(listRooms(layout(null)).some((room) => room.id === link.roomId), false);
  assert.deepEqual(plain(withRoomId({ branchId: link.branchId }, link.roomId)), {
    branchId: 'b-1', roomId: 'r-1',
  });
  const legacyEdit = { id: 'l-1', branchId: link.branchId };
  assert.equal(withRoomId(legacyEdit, link.roomId), legacyEdit);
});

test('a fresh summary can clear the badge after leaving the attention tab', () => {
  const shell = read('screens/BranchManagementScreen.tsx');
  assert.equal(
    /attentionTotal\?\.id === selected\.id\s*\? attentionTotal\.count\s*:/.test(shell),
    false,
    'an old attention page count still outranks a newer summary after moving to the map'
  );
});

test('closing a linked viewing appointment should return to the branch attention tab', () => {
  const host = read('components/branch/attention/BranchDestinationHost.tsx');
  const appointments = read('components/appointment/manage/AppointmentsScreen.tsx');
  const closesToAppointments =
    /onLinkConsumed=\{\(\) => setLinked\(null\)\}/.test(host) &&
    /const closeDetail = \(\) => \{\s*setDetail\(null\);\s*onLinkConsumed\?\.\(\);/.test(appointments);
  assert.equal(closesToAppointments, false, 'Back currently reveals the general appointment list');
});

test('anything else has no mobile screen, and the card says to use the web', () => {
  for (const href of [
    '',
    '/dashboard',
    '/dashboard/unknown?id=1',
    '/dashboard/branches',
    '/dashboard/branches/b-1',
    '/dashboard/branches/b-1?tab=map',
    '/dashboard/properties',
    '/dashboard/properties/view',
    '/dashboard/properties/view?id=..%2Fadmin',
    '/dashboard/properties/new?branchId=b-1',
    '/dashboard/properties/new?roomId=r-1',
    '/dashboard/viewing-schedules',
    '/dashboard/viewing-schedules/x?appointmentId=a',
    '/settings/bank-accounts',
    'https://evil.example/dashboard/payments?paymentId=1',
    '//evil.example/dashboard/properties/view?id=1',
    '/dashboard/../operations/x',
  ]) {
    assert.equal(branchDestination(href), null, href);
    assert.deepEqual(plain(targetNote(href)), {
      opens: false,
      note: 'Chưa mở được trên điện thoại. Hãy xử lý trên web.',
    });
  }
  assert.equal(targetNote(null).opens, false);
  assert.equal(targetHref({ href: 'https://evil.example' }), null);
});

test('the two links mobile cannot focus say where to look', () => {
  assert.match(targetNote(`${H}?tab=end&amendmentId=${UUID}`).note, /Phụ lục \/ điều chỉnh/);
  assert.match(targetNote(`${H}?tab=end&focus=early-exit`).note, /Kết thúc sớm \/ trả nhà/);
  assert.deepEqual(plain(targetNote(`${H}?tab=end`)), { opens: true, note: null });
  // The named blocks exist under these titles.
  const endTab = read('components/rental/contract/EndTab.tsx');
  assert.match(endTab, /title="Phụ lục \/ điều chỉnh"/);
  assert.match(endTab, /title="Kết thúc sớm \/ trả nhà"/);
});

const payment = (over) => ({
  id: UUID,
  type: 'INITIAL_PAYMENT_REFUND',
  direction: 'LANDLORD_TO_TENANT',
  payerId: 'owner',
  payeeId: 'tenant',
  rentalRequestId: UUID,
  contractId: 'c-1',
  invoiceId: null,
  ...over,
});

test('refunds and settlements are acted on where the branch link lands', () => {
  for (const type of ['INITIAL_PAYMENT_REFUND', 'DEPOSIT_REFUND', 'OTHER_CHARGE'])
    assert.equal(isSettlementTransfer(payment({ type })), true, type);
  // The deposit delta carries the amendment id as its invoiceId.
  assert.equal(isSettlementTransfer(payment({ type: 'DEPOSIT_ADJUSTMENT', invoiceId: 'a' })), true);
  for (const type of ['INITIAL', 'RESERVATION_DEPOSIT', 'MONTHLY_RENT', 'UTILITY'])
    assert.equal(isSettlementTransfer(payment({ type })), false, type);
  assert.equal(isSettlementTransfer(payment({ type: 'OTHER_CHARGE', invoiceId: 'i' })), false);
  // Why: the rental request is where the notification link goes, and a lease without a deposit
  // agreement has no deposit payment page (its landing falls back to the end tab, which has no panel).
  assert.equal(paymentLink(payment(), 'owner').href.screen, 'rental-requests');
  assert.equal(
    contractLandingTarget('landlord', { id: 'c-1' }, { tab: 'payment', section: 'deposit' }).tab,
    'end'
  );

  const screen = read('screens/rental/PaymentLinkScreen.tsx');
  assert.match(screen, /actHere && found && isSettlementTransfer\(found\)/);
  assert.match(screen, /<SettlementPaymentPanel/);
  assert.match(read('screens/rental/RentalNavigator.tsx'), /actHere=\{route\.actHere\}/);
});

test('the shared panel lets the landlord pay an overdue refund and confirm money received', () => {
  const logic = read('components/rental/billing/logic.ts');
  assert.match(logic, /TRANSFERABLE = \['AWAITING_TRANSFER', 'OVERDUE', 'REJECTED'\]/);
  assert.match(logic, /canTransfer: payer && TRANSFERABLE\.includes\(payment\.status\)/);
  assert.match(logic, /canReceive: !payer && payment\.status === 'TRANSFER_REPORTED'/);
});

test('countdown uses the clock the server names, plus time since the answer', () => {
  const clocks = { billingNow: '2026-11-27T00:00:00Z', realNow: '2026-11-20T00:00:00Z' };
  const work = { type: 'OWNER_REFUND', dueAt: '2026-11-28T00:00:00Z', clock: 'BILLING' };
  assert.match(workDeadline(work, clocks, 0), /^Còn 1 ngày 0 giờ/);
  assert.match(workDeadline({ ...work, clock: 'REAL' }, clocks, 0), /^Còn 8 ngày 0 giờ/);
  assert.match(workDeadline(work, clocks, 90_000_000), /^Đã qua mốc/);
  assert.match(
    workDeadline({ ...work, type: 'PAYMENT_CONFIRM' }, clocks, 0),
    /^Tự xác nhận sớm nhất sau/
  );
});

test('cards go most urgent first and survive a missing summary', () => {
  const branches = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(plain(orderByAttention(branches, null)), branches);
  const summary = [
    { branchId: 'c', count: 2 },
    { branchId: 'a', count: 0 },
  ];
  assert.deepEqual(plain(orderByAttention(branches, summary).map((b) => b.id)), ['c', 'a', 'b']);
});

test('the list keeps server order, pages, and reads again on return', () => {
  const tab = read('components/branch/attention/BranchAttentionTab.tsx');
  assert.match(tab, /getAttention\(branchId, page\)/);
  assert.match(tab, /useBranchRead\(load, describe\)/);
  assert.doesNotMatch(tab, /\.sort\(|\.filter\(/);
  assert.match(tab, /page >= pages\) setPage\(pages - 1\)/);
  assert.match(tab, /<RefreshControl/);
  assert.match(tab, /onCountChange\(data\.totalElements\)/);
  const hook = read('components/branch/attention/useBranchAttentionSummary.ts');
  assert.match(hook, /useBranchRead\(\s*branchOverviewApi\.getAttentionSummary/);
});

test('the work count row is a sibling of the card button', () => {
  const card = read('components/branch/attention/BranchCard.tsx');
  const row = card.indexOf('onPress={onOpenAttention}');
  assert.ok(row > card.indexOf('</Pressable>'));
  assert.match(card, /count === undefined \? null/);
});

test('the host draws every destination over the branch and never leaves through App', () => {
  const host = read('components/branch/attention/BranchDestinationHost.tsx');
  for (const kind of ['new-listing', 'rental', 'listing', 'appointment'])
    assert.ok(host.includes(`case '${kind}':`), kind);
  assert.match(host, /onExit=\{onClose\}/);
  assert.doesNotMatch(host, /openRental|openListing\(/);
});
