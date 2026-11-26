/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Pure decisions of src/components/rental/requests/logic.ts, run on top of the ported web libs.
const SRC = path.resolve(__dirname, '../src');
const WEB = path.resolve(__dirname, '../../hs-web-app');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    Date,
    atob,
    require: (request) => {
      if (request.startsWith('@/')) return load(`${path.join(SRC, request.slice(2))}.ts`);
      if (request.startsWith('.')) return load(`${path.resolve(path.dirname(file), request)}.ts`);
      return require(request);
    },
  });
  return module.exports;
}
const L = load(path.join(SRC, 'components/rental/requests/logic.ts'));
const { createListTickets } = load(path.join(SRC, 'lib/rental/useRentalRequestList.ts'));
const { validateRentalRequest } = load(path.join(SRC, 'lib/rental/RentalRequestModal.ts'));
// Objects made inside the VM have another prototype.
const plain = (value) => JSON.parse(JSON.stringify(value));

const UUID = '0a1b2c3d-1111-4222-8333-944455556666';
const request = (over = {}) => ({
  id: UUID,
  listingId: 'listing-1',
  listingTitle: 'Căn hộ A',
  listingAddress: 'Quận 1',
  ownerId: 'owner',
  renterId: 'renter',
  renterName: 'An',
  status: 'PENDING',
  leaseMonths: 12,
  occupantCount: 2,
  motorbikeCount: 0,
  carCount: 1,
  monthlyRentPrice: 5_000_000,
  effectiveMonthlyRent: null,
  depositAmount: 10_000_000,
  initialPayment: null,
  latestStartChange: null,
  cancellationRefundPending: false,
  ...over,
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

function listSink() {
  const log = [];
  return {
    log,
    sink: {
      rows: (value) => log.push(['rows', value]),
      failed: () => log.push(['failed']),
      settled: () => log.push(['settled']),
    },
  };
}

test('race: an old foreground page cannot overwrite a newer silent result', async () => {
  const tickets = createListTickets();
  const { log, sink } = listSink();
  const old = deferred();
  const first = L.runListLoad(tickets.start(false), false, () => old.promise, sink);
  await L.runListLoad(tickets.start(true), true, async () => 'fresh', sink);
  old.resolve('stale');
  await first;
  // The foreground spinner still ends although its data was superseded.
  assert.deepEqual(log, [['rows', 'fresh'], ['settled']]);
});

test('race: a filter change drops the earlier page and its error', async () => {
  const tickets = createListTickets();
  const { log, sink } = listSink();
  const old = deferred();
  const first = L.runListLoad(tickets.start(false), false, () => old.promise, sink);
  await L.runListLoad(tickets.start(false), false, async () => 'page-2', sink);
  old.reject(new Error('late'));
  await first;
  assert.deepEqual(log, [['rows', 'page-2'], ['settled']]);
});

test('only a foreground failure is announced', async () => {
  const tickets = createListTickets();
  const { log, sink } = listSink();
  const fail = async () => {
    throw new Error('down');
  };
  await L.runListLoad(tickets.start(true), true, fail, sink);
  assert.deepEqual(log, []);
  await L.runListLoad(tickets.start(false), false, fail, sink);
  assert.deepEqual(log, [['failed'], ['settled']]);
});

test('an unchanged page keeps the same array', () => {
  const rows = [{ id: 1 }];
  assert.equal(L.keepIfSame(rows, [{ id: 1 }]), rows);
  assert.notEqual(L.keepIfSame(rows, [{ id: 2 }]), rows);
});

test('race: detail tickets apply only newer results, and reopening drops old ones', () => {
  const tickets = L.createDetailTickets();
  const initial = tickets.open();
  const silent = tickets.next();
  assert.ok(tickets.isNewer(silent));
  tickets.apply(silent);
  assert.ok(!tickets.isNewer(initial), 'the older GET is dropped');
  const stale = tickets.next();
  tickets.open();
  assert.ok(!tickets.isNewer(stale), 'a refresh of the previous open is dropped');
});

test('one decision at a time, and the lock is released after a failure', async () => {
  const busy = [];
  const single = L.createSingleFlight((value) => busy.push(value));
  const gate = deferred();
  let runs = 0;
  const first = single(async () => {
    runs++;
    await gate.promise;
    throw new Error('boom');
  });
  await single(async () => runs++);
  gate.resolve();
  await assert.rejects(first, /boom/);
  await single(async () => runs++);
  assert.equal(runs, 2);
  assert.deepEqual(busy, [true, false, true, false]);
});

const card = (mode, over, extra = {}) =>
  L.cardState({ mode, request: request(over), nowMs: Date.parse('2026-11-25'), ...extra });
const paid = { type: 'INITIAL', status: 'CONFIRMED', totalAmount: 1 };

test('card actions per status and role', () => {
  const unpaid = {
    status: 'ACCEPTED',
    initialPayment: { status: 'AWAITING_TRANSFER', canCancelImmediately: true },
  };
  const matrix = [
    // [mode, request, kind, showCancel, showDetailSecondary]
    ['RECEIVED', {}, 'respond', false, true],
    ['SENT', {}, 'open', true, false],
    ['RECEIVED', unpaid, 'open', true, false],
    ['SENT', unpaid, 'pay', true, true],
    [
      'RECEIVED',
      { status: 'ACCEPTED', initialPayment: { status: 'TRANSFER_REPORTED' } },
      'review',
      false,
      true,
    ],
    ['RECEIVED', { status: 'ACCEPTED', initialPayment: paid }, 'createContract', false, true],
    ['SENT', { status: 'ACCEPTED', initialPayment: paid }, 'open', false, false],
    ['SENT', { status: 'REJECTED' }, 'open', false, false],
    ['RECEIVED', { status: 'EXPIRED' }, 'open', false, false],
    ['SENT', { status: 'COMPLETED' }, 'open', false, false],
    ['RECEIVED', { status: 'CANCELLED_BY_SYSTEM' }, 'open', false, false],
  ];
  for (const [mode, over, kind, showCancel, secondary] of matrix) {
    const state = card(mode, over);
    assert.deepEqual(
      [state.kind, state.showCancel, state.showDetailSecondary],
      [kind, showCancel, secondary],
      `${mode} ${JSON.stringify(over)}`
    );
  }
});

test('card labels: resend, open contract, AI review and earlier start', () => {
  const rejected = { status: 'ACCEPTED', initialPayment: { status: 'REJECTED' } };
  assert.equal(card('SENT', rejected).payLabel, 'Gửi lại chứng từ');
  const lapsed = card('SENT', {
    status: 'ACCEPTED',
    initialPayment: { type: 'INITIAL', status: 'REJECTED', dueAt: '2026-11-01T00:00:00Z' },
  });
  assert.equal(lapsed.kind, 'open');

  const active = card('SENT', { status: 'COMPLETED' }, { contract: { status: 'ACTIVE' } });
  assert.deepEqual(
    [active.opensContract, active.openLabel, active.showDetailSecondary],
    [true, 'Xem hợp đồng hiệu lực', true]
  );
  assert.equal(
    card('SENT', { status: 'ACCEPTED' }, { contract: { status: 'DRAFT' } }).openLabel,
    'Mở hợp đồng'
  );
  assert.equal(card('SENT', { status: 'REJECTED' }).openLabel, 'Mở hồ sơ');

  const conflict = { pendingCount: 2 };
  assert.ok(card('RECEIVED', {}, { conflict }).showAskAi);
  assert.ok(!card('SENT', {}, { conflict }).showAskAi);
  assert.ok(!card('RECEIVED', { status: 'ACCEPTED' }, { conflict }).showAskAi);

  const early = { status: 'ACCEPTED', initialPayment: paid };
  assert.ok(card('SENT', early).showStartChange);
  assert.ok(!card('RECEIVED', early).showStartChange);
  assert.ok(!card('SENT', { ...early, latestStartChange: {} }).showStartChange);
  assert.ok(!card('SENT', { ...early, cancellationRefundPending: true }).showStartChange);
});

test('detail next-step button per role, status and tab', () => {
  const base = { mode: 'SENT', tab: 'overview', hasOnboarding: false };
  const act = (over) => plain(L.detailPrimaryAction({ ...base, ...over }));
  assert.deepEqual(act({ status: 'PENDING', mode: 'RECEIVED' }), { kind: 'respond' });
  assert.equal(act({ status: 'PENDING' }), null);
  assert.deepEqual(act({ status: 'ACCEPTED', phase: 'unpaid' }), { kind: 'pay' });
  assert.equal(act({ status: 'ACCEPTED', phase: 'unpaid', hasOnboarding: true }), null);
  assert.equal(act({ status: 'ACCEPTED', phase: 'unpaid', mode: 'RECEIVED' }), null);
  const nextAction = { code: 'PAY_DEPOSIT', actor: 'TENANT' };
  assert.deepEqual(act({ status: 'ACCEPTED', nextAction }), { kind: 'goto', tab: 'payment' });
  assert.equal(act({ status: 'ACCEPTED', nextAction, tab: 'payment', hasOnboarding: true }), null);
});

test('a detail is shown only to the side the viewer is on', () => {
  assert.ok(L.isOwnSide(request(), 'RECEIVED', 'owner'));
  assert.ok(L.isOwnSide(request(), 'SENT', 'renter'));
  assert.ok(!L.isOwnSide(request(), 'SENT', 'owner'));
  assert.ok(!L.isOwnSide(request(), 'RECEIVED', null));
});

test('deep link: invalid id, wrong side, 403/404 and other errors', async () => {
  let reads = 0;
  const found = async () => {
    reads++;
    return request();
  };
  const run = async (...args) => plain(await L.resolveDeepLink(...args));
  assert.deepEqual(await run('abc', 'SENT', 'renter', found), {
    type: 'info',
    notice: 'Liên kết yêu cầu thuê không hợp lệ.',
  });
  assert.equal(reads, 0);
  assert.deepEqual(await run(UUID, 'RECEIVED', 'renter', found), {
    type: 'info',
    notice: 'Yêu cầu thuê không thuộc phía tài khoản bạn đang xem.',
  });
  assert.equal((await run(UUID, 'SENT', 'renter', found)).request.id, UUID);
  const failing = (status) => async () => {
    throw Object.assign(new Error('x'), { response: { status } });
  };
  assert.equal((await run(UUID, 'SENT', 'renter', failing(404))).type, 'info');
  assert.equal((await run(UUID, 'SENT', 'renter', failing(500))).type, 'error');
});

test('contract lookup keys and the deposit agreement is never the lease', () => {
  const keys = L.contractLookupKeys(
    ['PENDING', 'ACCEPTED', 'COMPLETED', 'REJECTED', 'EXPIRED'].map((status) => ({
      id: status,
      status,
    }))
  );
  assert.deepEqual(plain(keys), { all: 'ACCEPTED,COMPLETED,EXPIRED', active: 'ACCEPTED' });
  const previous = { agreements: { kept: { id: 1 } }, contracts: { kept: { id: 1 } } };
  const merged = L.mergeContractLookup(previous, [
    ['deposit', { agreementKind: 'DEPOSIT' }],
    ['lease', { agreementKind: 'LEASE' }],
    ['none', null],
    ['kept', undefined],
  ]);
  assert.equal(merged.contracts.deposit, null);
  assert.equal(merged.agreements.deposit.agreementKind, 'DEPOSIT');
  assert.equal(merged.contracts.lease.agreementKind, 'LEASE');
  assert.equal(merged.contracts.none, null);
  assert.deepEqual(plain(merged.contracts.kept), { id: 1 });
});

test('fallback conflicts need two pending requests of one listing', () => {
  const rows = [
    request({ id: 'a' }),
    request({ id: 'b' }),
    request({ id: 'c', status: 'ACCEPTED' }),
    request({ id: 'd', listingId: 'listing-2' }),
  ];
  const conflicts = plain(L.localConflicts(rows));
  assert.deepEqual(Object.keys(conflicts), ['listing-1']);
  assert.deepEqual(conflicts['listing-1'].requestIds, ['a', 'b']);
  assert.equal(conflicts['listing-1'].pendingCount, 2);
  assert.ok(L.needsDeadlinePolling(rows));
  assert.ok(!L.needsDeadlinePolling([{ status: 'COMPLETED' }]));
});

test('accept summary, totals, payee-account error and draft notices', () => {
  const summary = plain(L.acceptSummary(request()));
  assert.equal(summary.vehicles, 'Không xe máy · 1 ô tô');
  assert.equal(summary.total, '15.000.000 ₫');
  const totals = L.paymentTotals(request({ effectiveMonthlyRent: 0 }), {
    lineItems: [
      { type: 'RENT', amount: 1 },
      { type: 'DEPOSIT', amount: 2 },
      { type: 'SERVICE', amount: 7 },
    ],
  });
  assert.deepEqual(plain(totals), {
    rentPrice: 5_000_000,
    prepaidFees: 7,
    upfrontTotal: 15_000_007,
  });
  const error = (data) => ({ response: { data } });
  for (const data of [
    { code: 7009 },
    { message: 'defaultIncoming missing' },
    { message: 'Chưa có Tài khoản nhận tiền' },
    { message: 'Thiếu ngân hàng' },
  ])
    assert.ok(L.isMissingPayeeAccount(error(data)), JSON.stringify(data));
  assert.ok(!L.isMissingPayeeAccount(error({ code: 1, message: 'other' })));
  assert.ok(!L.isMissingPayeeAccount(new Error('x')));
  assert.equal(L.draftResultNotice('PENDING'), L.draftResultNotice('UNAVAILABLE'));
  assert.equal(L.draftResultNotice('READY'), 'Bản nháp hợp đồng đã sẵn sàng để kiểm tra.');
});

test('listing CTA state, and gates run in the web order', async () => {
  assert.equal(L.ctaState('PENDING', 'RESERVED'), 'pending');
  assert.equal(L.ctaState('ACCEPTED', 'PUBLISHED'), 'accepted');
  assert.equal(L.ctaState(undefined, 'RESERVED'), 'reserved');
  assert.equal(L.ctaState(undefined, 'PUBLISHED'), 'request');
  assert.equal(L.ctaState(undefined, 'HIDDEN'), 'closed');
  // Another status of an old request does not hide the button.
  assert.equal(L.ctaState('REJECTED', 'PUBLISHED'), 'request');

  const run = async (isOwner, allowed, kyc) => {
    const calls = [];
    const outcome = await L.runRentalCta({
      isOwner,
      guard: () => (calls.push('guard'), allowed),
      checkKyc: async () => (calls.push('kyc'), kyc),
    });
    return [outcome, calls];
  };
  assert.deepEqual(await run(true, true, 'verified'), ['owner', []]);
  assert.deepEqual(await run(false, false, 'verified'), ['locked', ['guard']]);
  for (const kyc of ['verified', 'unverified', 'unavailable'])
    assert.deepEqual(await run(false, true, kyc), [kyc, ['guard', 'kyc']]);
});

test('listing props sent to the request form', () => {
  const property = {
    id: 'l',
    title: 't',
    location: 'x',
    priceMillion: 4.5,
    depositType: undefined,
    depositAmount: null,
    depositMonths: null,
    images: ['https://a/1.jpg'],
    details: { pricing: { depositType: 'MONTH_COUNT', depositMonths: 2 }, maxOccupants: '3' },
  };
  assert.deepEqual(plain(L.rentalModalProps(property)), {
    listingId: 'l',
    listingTitle: 't',
    listingAddress: 'x',
    listingPrice: 4_500_000,
    depositType: 'MONTH_COUNT',
    depositMonths: 2,
    listingThumbnail: 'https://a/1.jpg',
    minimumLeaseMonths: 6,
    listingMaxOccupants: null,
  });
});

test('form validation stops at the first failing check, in the web order', () => {
  const form = {
    reservationPolicyAccepted: false,
    reservationPolicy: null,
    moveInDate: null,
    loadingEstimate: true,
    estimateError: null,
    estimate: null,
    leaseMonths: 0,
    minimumLeaseMonths: 6,
    occupantCount: 0,
    occupantLimit: 2,
    motorbikeCount: 3,
    carCount: 3,
    renterName: ' ',
    renterPhone: ' ',
  };
  const slot = { allowed: true, available: 1 };
  const fixes = [
    { reservationPolicyAccepted: true, reservationPolicy: { version: 'v1' } },
    { moveInDate: new Date('2020-01-01') },
    { loadingEstimate: false, estimate: { paymentPlan: {}, motorbike: slot, car: slot } },
    { moveInDate: new Date('2030-01-01') },
    { leaseMonths: 3 },
    { leaseMonths: 6 },
    { occupantCount: 3 },
    { occupantCount: 2 },
    { motorbikeCount: 1 },
    { carCount: 1 },
    { renterName: 'An' },
    { renterPhone: '0912345678' },
  ];
  const source = fs.readFileSync(
    path.join(WEB, 'components/rental-request/RentalRequestModal.tsx'),
    'utf8'
  );
  const submit = source.slice(
    source.indexOf('const handleSubmit'),
    source.indexOf('setIsSubmitting(true)')
  );
  let lastIndex = -1;
  for (const fix of fixes) {
    const message = validateRentalRequest(form, new Date('2026-11-25'));
    assert.ok(message, JSON.stringify(fix));
    // The fixed (non-interpolated) start of each message appears in this order in the web source.
    const index = submit.indexOf(message.split(/\d/)[0]);
    assert.ok(index >= lastIndex, `out of web order: ${message}`);
    lastIndex = index;
    Object.assign(form, fix);
  }
  assert.equal(validateRentalRequest(form, new Date('2026-11-25')), null);
});

test('lease input, status line, submit lock and error message', () => {
  assert.equal(L.typedLeaseMonths('18'), 18);
  assert.equal(L.typedLeaseMonths(''), null);
  assert.equal(L.typedLeaseMonths('0'), null);
  assert.equal(L.blurredLeaseInput('', 6, 12), '12');
  assert.equal(L.blurredLeaseInput('3', 6, 3), '3');
  assert.equal(L.blurredLeaseInput('300', 6, 300), '300');

  const line = {
    accepted: false,
    estimateError: 'x',
    hasEstimate: false,
    loadingEstimate: true,
  };
  assert.match(L.formStatusLine(line).text, /^Vui lòng đọc và tích đồng ý/);
  assert.ok(L.formStatusLine({ ...line, accepted: true }).error);
  assert.equal(
    L.formStatusLine({ ...line, accepted: true, estimateError: null }).text,
    'Đang tính toán dự toán thanh toán...'
  );
  assert.equal(
    L.formStatusLine({
      accepted: true,
      estimateError: null,
      hasEstimate: true,
      loadingEstimate: false,
    }),
    null
  );

  const ready = {
    isSubmitting: false,
    hasPolicy: true,
    accepted: true,
    loadingEstimate: false,
    estimateError: null,
    hasPaymentPlan: true,
  };
  assert.equal(L.submitDisabled(ready), false);
  for (const over of [
    { isSubmitting: true },
    { hasPolicy: false },
    { accepted: false },
    { loadingEstimate: true },
    { estimateError: 'x' },
    { hasPaymentPlan: false },
  ])
    assert.equal(L.submitDisabled({ ...ready, ...over }), true, JSON.stringify(over));

  assert.equal(
    L.submitErrorMessage({ response: { data: { message: 'server', errors: [] } } }),
    'server'
  );
  assert.equal(L.submitErrorMessage({ message: 'network' }), 'network');
  assert.match(L.submitErrorMessage({}), /^Không thể gửi yêu cầu thuê nhà/);
  assert.deepEqual(plain(L.profilePrefill({ username: 'u', phone: '', email: 'e@x' })), {
    renterName: 'u',
    renterEmail: 'e@x',
  });
});

test('form: the browser constraints of the web inputs are enforced before submit', () => {
  const ok = {
    monthsInput: '12',
    leaseMonths: 12,
    minimumLeaseMonths: 6,
    occupantCount: 1,
    occupantLimit: null,
    renterName: 'An',
    renterPhone: '0912345678',
    renterEmail: '',
  };
  const check = (over) => L.inputConstraintError({ ...ok, ...over });
  assert.equal(check({}), null);
  for (const renterEmail of ['  ', 'a@b', ' an.x+1@mail.example.vn ']) {
    assert.equal(check({ renterEmail }), null, renterEmail);
  }
  for (const renterEmail of ['abc', 'a@', '@b.vn', 'a b@c.vn', 'a@b..vn', 'a@-b.vn', 'a@@b.vn']) {
    assert.equal(check({ renterEmail }), 'Địa chỉ email không hợp lệ', renterEmail);
  }
  assert.equal(check({ monthsInput: '240', leaseMonths: 240 }), null);
  assert.match(check({ monthsInput: '241', leaseMonths: 241 }), /tối đa là 240 tháng$/);
  assert.match(check({ monthsInput: '12.5' }), /hợp lệ$/);
  // As on web, "24e1" is the number 240 to the input (A-139).
  assert.equal(check({ monthsInput: '24e1' }), null);
  for (const monthsInput of ['12.0', '12.00']) {
    assert.equal(check({ monthsInput }), null, monthsInput);
    assert.equal(L.typedLeaseMonths(monthsInput), 12);
  }
  for (const monthsInput of ['12.', '12.05', '.0'])
    assert.match(check({ monthsInput, leaseMonths: 12 }), /hợp lệ$|tối thiểu/, monthsInput);
  assert.match(check({ monthsInput: '241.0', leaseMonths: 241 }), /tối đa là 240 tháng$/);
  assert.match(check({ monthsInput: '3', leaseMonths: 3 }), /tối thiểu cho căn này là 6 tháng$/);
  // An empty or too small box is restored on blur, so it is the lease length that counts.
  assert.equal(check({ monthsInput: '' }), null);
  assert.equal(check({ monthsInput: '0' }), null);
  assert.match(check({ occupantCount: 21 }), /tối đa 20 người/);
  assert.equal(check({ occupantCount: 0 }), null);
  // First invalid field in page order.
  assert.match(check({ renterName: '', renterEmail: 'abc' }), /họ và tên/);
  assert.match(check({ renterPhone: '', renterEmail: 'abc' }), /số điện thoại/);
  assert.equal(check({ renterName: ' ' }), null);

  const web = fs.readFileSync(
    path.join(WEB, 'components/rental-request/RentalRequestModal.tsx'),
    'utf8'
  );
  for (const attribute of ['max={240}', 'type="email"']) assert.ok(web.includes(attribute));
});

test('AI facts, score bar and markdown lines', () => {
  const facts = {
    leaseMonths: null,
    occupantCount: 2,
    moveInDate: '2026-12-01T00:00:00',
    depositAmount: null,
  };
  assert.deepEqual(plain(L.aiFacts({ facts })), ['2 người', 'Dọn vào 01/12/2026', 'Cọc Chưa rõ']);
  assert.equal(L.aiFacts({ facts: { ...facts, depositAmount: 1500000 } })[2], 'Cọc 1.500.000 đ');
  assert.equal(L.scorePercent(140), 100);
  assert.equal(L.scorePercent(-1), 0);
  const [heading, bullet, numbered] = L.markdownLines('## Tóm tắt\n\n- **An** [tin](/x)\n2. b');
  assert.ok(heading.heading);
  assert.deepEqual(plain(bullet), {
    marker: '•',
    heading: false,
    parts: [
      { text: 'An', bold: true },
      { text: ' ', bold: false },
      { text: 'tin', bold: false },
    ],
  });
  assert.equal(numbered.marker, '2.');
});

test('filters and empty states use the web strings', () => {
  const read = (name) => fs.readFileSync(path.join(WEB, 'components/rental-request', name), 'utf8');
  const filters = read('RentalRequestFilters.tsx');
  for (const { key, label } of L.STATUS_FILTERS)
    assert.ok(filters.includes(`{ key: "${key}", label: "${label}" }`), label);
  const management = read('RentalRequestsManagement.tsx');
  for (const copy of Object.values(L.LIST_COPY))
    for (const text of [copy.title, copy.description]) assert.ok(management.includes(text), text);
  for (const filter of ['ALL', 'PENDING'])
    for (const mode of ['RECEIVED', 'SENT']) {
      const empty = L.emptyState(filter, mode);
      assert.ok(management.includes(empty.title) && management.includes(empty.message));
    }
  assert.equal(L.emptyState('PENDING', 'SENT').action, 'all');
  assert.equal(L.emptyState('ALL', 'SENT').action, 'browse');
  assert.equal(L.emptyState('ALL', 'RECEIVED').action, null);
});

test('form: one submit per listing until it settles, whichever form asks', () => {
  const locks = L.createSubmitLocks();
  let changes = 0;
  const unsubscribe = locks.subscribe(() => changes++);
  const release = locks.acquire('a');
  assert.ok(release && locks.has('a'));
  assert.equal(locks.acquire('a'), null); // the reopened form
  assert.ok(locks.acquire('b'));
  release();
  assert.ok(!locks.has('a') && locks.acquire('a'));
  assert.equal(changes, 4);
  unsubscribe();

  // Account B is not locked by account A's unsettled POST for the same listing.
  const shared = L.createSubmitLocks();
  assert.ok(shared.acquire(L.submitKey('a', 'listing-1')));
  assert.equal(shared.acquire(L.submitKey('a', 'listing-1')), null);
  assert.ok(!shared.has(L.submitKey('b', 'listing-1')));
  assert.ok(shared.acquire(L.submitKey('b', 'listing-1')));
  const form = fs.readFileSync(
    path.join(SRC, 'components/rental/requests/useRentalRequestForm.ts'),
    'utf8'
  );
  assert.ok(form.includes('submitLocks.acquire(submitKey(renter, listingId))'));
  assert.ok(!/submitLocks\.(has|acquire)\(listingId\)/.test(form));
});

test('form: reopening keeps the contact fields, the profile only fills what is missing', () => {
  const profile = { firstName: 'An', lastName: 'Le', phone: '09', email: 'a@x.vn' };
  assert.deepEqual(plain(L.prefillContact({}, profile)), {
    renterName: 'An Le',
    renterPhone: '09',
    renterEmail: 'a@x.vn',
  });
  // Edited and cleared values both survive.
  assert.deepEqual(plain(L.prefillContact({ renterPhone: '08', renterEmail: '' }, profile)), {
    renterName: 'An Le',
    renterPhone: '08',
    renterEmail: '',
  });
});

test('viewer id comes from the token subject, without any API', () => {
  const token = (payload) =>
    `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  assert.equal(L.tokenSubject(token({ sub: UUID, name: 'Nguyễn Văn Ân' })), UUID);
  for (const bad of [null, '', 'abc', 'a.%%%.c', token({}), token({ sub: 5 })])
    assert.equal(L.tokenSubject(bad), null, String(bad));
  const source = fs.readFileSync(path.join(SRC, 'components/rental/requests/useViewer.ts'), 'utf8');
  assert.ok(!source.includes('userApi'));
});

test('a listing opened from a rental record: viewer access, no owner UI, Back to the list', () => {
  const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const screen = read('src/screens/ListingDetailScreen.tsx');
  // Every signed-in viewer reads with their identity, as web lib/listing-detail-access.ts.
  assert.ok(screen.includes('await getAccessibleListing(listingId)'));
  assert.ok(!screen.includes('getPublicListing(listingId)'));
  // Ownership still comes from `own` or the signed-in id only.
  assert.ok(
    screen.includes('const isOwnerView = own || (Boolean(userId) && userId === property.ownerId);')
  );
  // Nested list: the listing sits on top of it and the list stack is kept.
  assert.ok(screen.includes('onBack={() => setRecordListingId(null)}'));
  assert.ok(screen.includes('onOpenListing={setRecordListingId}'));
  // Management tab: App keeps rentalStack under the listing.
  const app = read('App.tsx');
  assert.ok(app.includes('onOpenListing={(id) => openListing(id)}'));
  // "Quản lý tin đăng" on that listing keeps the stack and draws its section above it.
  assert.ok(app.includes("if (screen !== 'detail') setRentalStack([]);"));
  assert.ok(app.includes("if (rentalStack.length && managementOrigin !== 'detail')"));
});

test('automatic draft loading and the AI close label match the web', () => {
  const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const web = (name) => fs.readFileSync(path.join(WEB, 'components/rental-request', name), 'utf8');
  const button = read('src/components/rental/requests/RentalContractFallbackButton.tsx');
  const draftLabel = 'Đang tạo hợp đồng tự động';
  assert.ok(web('RentalContractFallbackButton.tsx').includes(draftLabel));
  assert.ok(button.includes(`label="${draftLabel}"`));
  assert.match(button, /<ActionButton[^>]+\bbusy\s/);
  assert.doesNotMatch(button, /onClick=/);
  const label = 'Đóng đánh giá AI';
  assert.ok(web('RentalRequestAiReviewModal.tsx').includes(`aria-label="${label}"`));
  assert.ok(
    read('src/components/rental/requests/RentalRequestAiReviewModal.tsx').includes(
      `closeLabel="${label}"`
    )
  );
  assert.ok(read('src/components/rental/shared/ModalShell.tsx').includes("closeLabel = 'Đóng'"));
});

test('AI markdown: GFM tables and safe link targets', () => {
  const texts = (line) => line.table.map((row) => row.map((c) => c.map((p) => p.text).join('')));
  const [before, table, after] = L.markdownLines(
    'So sánh\n| Người | Cọc |\n|:---|---:|\n| **An** | 1<br>2 |\n| a \\| b |\n\nKết luận'
  );
  assert.equal(before.table, undefined);
  assert.deepEqual(plain(texts(table)), [
    ['Người', 'Cọc'],
    ['An', '1\n2'],
    ['a | b', ''],
  ]);
  assert.ok(table.table[1][0][0].bold);
  assert.equal(after.parts[0].text, 'Kết luận');
  // No delimiter row, a wrong column count or a code fence: not a table.
  for (const text of ['a | b\nc | d', '| a | b |\n|---|', '```\n| a |\n|---|\n```'])
    assert.ok(!L.markdownLines(text).some((line) => line.table), text);

  const listing = `/rent/${UUID}`;
  const link = (md, base) => L.markdownLines(md, base)[0].parts;
  assert.equal(link('[a](https://x.vn/p_(1))')[0].href, 'https://x.vn/p_(1)');
  assert.deepEqual(plain(link('xem **[tin](http://x.vn)** nhé')[1]), {
    text: 'tin',
    bold: true,
    href: 'http://x.vn',
  });
  assert.equal(link(`[a](${listing})`, 'https://web.vn/')[0].href, `https://web.vn${listing}`);
  assert.equal(
    link(`[![ảnh](https://x.vn/a.jpg)](${listing})`, 'https://web.vn')[0].href,
    `https://web.vn${listing}`
  );
  for (const target of [listing, 'javascript:alert(1)', 'tel:0912', 'file:///a', '//x.vn', '/x']) {
    const [part] = link(`[a](${target})`);
    assert.equal(part.text, 'a', target);
    assert.equal(part.href, undefined, target);
  }
  assert.equal(L.safeLinkTarget(listing, 'ftp://web.vn'), undefined);
});

test('AI markdown: a link inside inline or fenced code stays plain text', () => {
  const md = '[a](https://x.vn)';
  const all = (text) => L.markdownLines(text).flatMap((line) => line.parts);
  const shown = (text) =>
    L.markdownLines(text).map((line) => line.parts.map((p) => p.text).join(''));
  for (const text of [`\`${md}\``, `\`\` \` ${md} \`\``, `gõ \`**x** ${md}\` nhé`]) {
    assert.ok(!all(text).some((part) => part.href || part.bold), text);
    assert.ok(shown(text)[0].includes(md), text);
  }
  for (const text of [
    `\`\`\`\n${md}\n\`\`\``,
    `~~~md\n- ${md}\n~~~`,
    // A shorter or different fence does not close the block.
    `\`\`\`\`\n\`\`\`\n${md}\n\`\`\`\``,
    `\`\`\`\n~~~\n${md}`,
  ]) {
    assert.ok(!all(text).some((part) => part.href), text);
    assert.ok(
      shown(text).some((line) => line.includes(md)),
      text
    );
  }
  // Links around or after code are still links, and the fence lines are not drawn.
  assert.equal(all('[`x`](https://x.vn)')[0].href, 'https://x.vn');
  assert.equal(all('[`x`](https://x.vn)')[0].text, 'x');
  assert.equal(all(`\`\`\`js\ncode\n\`\`\`\n${md}`)[1].href, 'https://x.vn');
  assert.equal(all(`\`\`\`a\`\`\` ${md}`).at(-1).href, 'https://x.vn');
  const [table] = L.markdownLines(`| x |\n|---|\n| \`${md}\` |`);
  assert.equal(table.table[1][0][0].href, undefined);
});

// --- Fixes after the cross-check (audit-A-codex.md) ---

test('AI markdown: italic and quotes, without touching words, links or code', () => {
  const runs = (text) =>
    L.markdownLines(text)[0].parts.map((p) => `${p.italic ? '/' : ''}${p.text}`);
  assert.deepEqual(plain(runs('*a* và _b_ và ***c***')), ['/a', ' và ', '/b', ' và ', '/c']);
  for (const text of ['snake_case_name', '2 * 3 * 4', 'https://x.vn/_next_/a_'])
    assert.deepEqual(plain(runs(text)), [text]);
  assert.equal(L.markdownLines('[a](https://x.vn/_b_)')[0].parts[0].href, 'https://x.vn/_b_');
  assert.deepEqual(plain(runs('`*a*`')), ['*a*']);
  const [quote, empty] = L.markdownLines('> - *a*\n>');
  assert.equal(quote.quote, true);
  assert.equal(quote.marker, '•');
  assert.deepEqual(plain(quote.parts), [{ text: 'a', bold: false, italic: true }]);
  assert.equal(empty, undefined);
});

test('lease box: any whole HTML number passes, as in the web number input', () => {
  const check = (monthsInput) =>
    L.inputConstraintError({
      monthsInput,
      leaseMonths: 12,
      minimumLeaseMonths: 6,
      occupantCount: 1,
      occupantLimit: null,
      renterName: 'An',
      renterPhone: '0912345678',
      renterEmail: '',
    });
  for (const ok of ['12', '12.0', '12e0', '120e-1']) assert.equal(check(ok), null, ok);
  for (const bad of ['12.5', '12e-1', '+12', '12.', 'Infinity'])
    assert.equal(check(bad), 'Vui lòng chọn thời hạn thuê hợp lệ', bad);
  assert.equal(check('25e1'), 'Thời hạn thuê tối đa là 240 tháng');
});

test('contract draft notice uses the web toast level', () => {
  const tones = ['UNAVAILABLE', 'PENDING', 'INCOMPLETE', 'EXISTING', 'READY'].map(
    L.draftResultTone
  );
  assert.deepEqual(plain(tones), ['warning', 'warning', 'info', 'info', 'success']);
});

test('a 1010 mentioning the bank account is not the missing-payee dialog', () => {
  const error = (status, code) => ({
    response: { status, data: { code, message: 'Cần cập nhật tài khoản ngân hàng' } },
  });
  assert.equal(L.isMissingPayeeAccount(error(403, 1010)), false);
  assert.equal(L.isMissingPayeeAccount(error(400, 7009)), true);
});

/** DialogProvider with a stub React; returns its host and the dialogs it set. */
function dialogHost() {
  const shown = [];
  let states = 0;
  let host;
  const element = (type, props) => {
    if (props?.value?.show) host = props.value;
    return { type, props };
  };
  const modules = {
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useContext: () => null,
      useEffect: () => {},
      useMemo: (make) => make(),
      useRef: (current) => ({ current }),
      // The first state of the provider is the message dialog.
      useState: (value) => [value, states++ ? () => {} : (next) => shown.push(next)],
    },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': { Modal: 'Modal' },
    '@/components/Icon': { default: 'Icon' },
  };
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(
    fs.readFileSync(path.join(SRC, 'components/AppDialog.tsx'), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }
  );
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (request) => modules[request],
  });
  const model = module.exports.DialogProvider({ children: null });
  const close = model.props.children.find((node) => node?.type === 'Modal').props.onRequestClose;
  return { host, shown, close };
}

test('the 1010 dialog preserves unrelated notices and shows them in order after it closes', () => {
  const { host, shown, close } = dialogHost();
  host.show('Thông báo', 'cũ');
  host.show('Cần hoàn thiện hồ sơ', 'thiếu', [{ text: 'Cập nhật hồ sơ' }], 'info', true);
  host.show('Kết xuất A', 'Đang kiểm tra');
  assert.deepEqual(
    shown.map((d) => d.title),
    ['Thông báo', 'Cần hoàn thiện hồ sơ']
  );
  close();
  host.show('Kết xuất B', 'Đã tạo');
  assert.equal(shown.at(-1).title, 'Kết xuất A');
  close();
  assert.deepEqual(
    shown.slice(-2).map((d) => d.title),
    ['Kết xuất A', 'Kết xuất B']
  );
  // Without `keep`, the latest dialog still wins, as before.
  const other = dialogHost();
  other.host.show('A', 'a', [{ text: 'Đi' }]);
  other.host.show('B', 'b');
  assert.equal(other.shown.at(-1).title, 'B');
  const gate = fs.readFileSync(path.join(SRC, 'lib/use-onboarding.ts'), 'utf8');
  assert.match(gate, /'info',\s+true/);
});

test('listing detail: own thumbnail in the rental form, request lookup also for own listings', () => {
  const screen = fs.readFileSync(path.join(SRC, 'screens/ListingDetailScreen.tsx'), 'utf8');
  const modal = screen.slice(screen.indexOf('<RentalRequestModal'));
  assert.ok(!modal.slice(0, modal.indexOf('/>')).includes('listingThumbnail'));
  const mock = 'https://x.vn/homespace-dev-files/1.jpg';
  const props = L.rentalModalProps({
    id: UUID,
    title: 'A',
    location: 'B',
    priceMillion: 1,
    depositAmount: null,
    depositMonths: null,
    images: [mock],
    details: {},
  });
  assert.equal(props.listingThumbnail, mock);
  assert.ok(screen.includes('if (rentalFormOpen || viewingRequests) return;'));
});
