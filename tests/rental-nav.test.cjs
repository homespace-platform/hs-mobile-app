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
    // Late binding, so node:test mock timers apply inside the sandbox.
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args),
    require: (request) => {
      assert.ok(request.startsWith('@/'), `unexpected dependency: ${request}`);
      return load(`${path.join(SRC, request.slice(2))}.ts`);
    },
  });
  return module.exports;
}
const M = (name) => load(`${path.join(SRC, name)}.ts`);

const { rentalRouteFromActionPath: link } = M('lib/rental-nav/deep-link');
const nav = M('lib/rental-nav/routes');
const { contractLandingTarget } = M('lib/rental/payment-module');
const { paymentLink } = M('lib/rental/payment-link');
const sync = M('lib/rental-sync/events');
const { createChangeSync } = M('lib/rental/useAgreementChangeSync');
const { createRentalRequestSync, matchesRentalRequestEvent } = M('lib/rental/useRentalRequestSync');
const { MANAGEMENT_TITLES } = M('lib/dashboard-navigation');

const UUID = '0a1b2c3d-1111-4222-8333-944455556666';
const plain = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const is = (actual, expected, label = 'route') => assert.deepEqual(plain(actual), expected, label);
const landing = (contractId, query = {}) => ({ screen: 'contract-landing', contractId, ...query });

test('every actionPath form maps to its route', () => {
  const cases = [
    // RENTAL_REQUEST_* (OWNER / RENTER); requestId must survive.
    [
      `/dashboard/rental-requests?requestId=${UUID}`,
      { screen: 'rental-requests', mode: 'RECEIVED', requestId: UUID },
    ],
    [
      `/dashboard/rental-requests/my-requests?requestId=${UUID}`,
      { screen: 'rental-requests', mode: 'SENT', requestId: UUID },
    ],
    ['/dashboard/rental-requests', { screen: 'rental-requests', mode: 'RECEIVED' }],
    ['/dashboard/rental-requests/my-requests/', { screen: 'rental-requests', mode: 'SENT' }],
    // AGREEMENT_*, AMENDMENT_*, RENEWAL_*, TERMINATION_*, LEASE_*
    ['/dashboard/contracts/c-1?tab=sign', landing('c-1', { tab: 'sign' })],
    ['/dashboard/contracts/c-1?tab=end', landing('c-1', { tab: 'end' })],
    ['/dashboard/contracts/c-1?tab=content', landing('c-1', { tab: 'content' })],
    ['/dashboard/contracts/c-1', landing('c-1')],
    [
      '/dashboard/contracts/c-1?tab=end#monthly-invoices',
      landing('c-1', { tab: 'payment', section: 'monthly' }),
    ],
    // Legacy invoices: INVOICE_*, unilateral termination, SETTLEMENT_* / LEASE_CLOSED
    [
      '/dashboard/invoices/c-1?section=monthly&invoice=inv-9',
      landing('c-1', { tab: 'payment', section: 'monthly', invoice: 'inv-9' }),
    ],
    [
      '/dashboard/invoices/c-1?section=monthly&invoice=first-rent%3Ap-1',
      landing('c-1', { tab: 'payment', section: 'monthly', invoice: 'first-rent:p-1' }),
    ],
    [
      '/dashboard/invoices/c-1?section=monthly',
      landing('c-1', { tab: 'payment', section: 'monthly' }),
    ],
    [
      '/dashboard/invoices/c-1?section=deposit',
      landing('c-1', { tab: 'payment', section: 'deposit' }),
    ],
    [
      '/dashboard/invoices/c-1?section=junk',
      landing('c-1', { tab: 'payment', section: 'monthly' }),
    ],
    ['/dashboard/invoices/c-1', landing('c-1', { tab: 'payment', section: 'monthly' })],
    // PAYMENT_*, COMPLAINT_*
    ['/dashboard/payments?paymentId=pay-1', { screen: 'payment-lookup', paymentId: 'pay-1' }],
    [
      `/dashboard/complaints?requestId=${UUID}&complaintId=case_1`,
      { screen: 'complaint', requestId: UUID, complaintId: 'case_1' },
    ],
    // History and its legacy URL
    ['/dashboard/invoices', { screen: 'payment-history', side: 'tenant' }],
    [
      '/dashboard/invoices?contract=c-1',
      { screen: 'payment-history', side: 'tenant', contractId: 'c-1' },
    ],
    [
      '/dashboard/invoices/receipts?contract=c-1',
      { screen: 'payment-history', side: 'tenant', contractId: 'c-1' },
    ],
    ['/dashboard/invoices/receipts', { screen: 'payment-history', side: 'tenant' }],
    // Contract pages
    ['/dashboard/contracts', { screen: 'contract-list', side: 'tenant' }],
    ['/dashboard/landlord/contracts', { screen: 'contract-list', side: 'landlord' }],
    [
      '/dashboard/tenant/contracts?kind=DEPOSIT',
      { screen: 'contract-list', side: 'tenant', kind: 'DEPOSIT' },
    ],
    [
      '/dashboard/landlord/contracts/c-1?tab=payment&section=monthly&invoice=i-1',
      {
        screen: 'contract-detail',
        side: 'landlord',
        contractId: 'c-1',
        tab: 'payment',
        section: 'monthly',
        invoice: 'i-1',
      },
    ],
    [
      '/dashboard/tenant/contracts/c-1',
      { screen: 'contract-detail', side: 'tenant', contractId: 'c-1' },
    ],
    [
      '/dashboard/tenant/contracts/reservations/r-1',
      { screen: 'reservation', side: 'tenant', rentalId: 'r-1' },
    ],
  ];
  for (const [actionPath, expected] of cases) is(link(actionPath), expected, actionPath);
  is(link('/dashboard/invoices', 'landlord'), { screen: 'payment-history', side: 'landlord' });
  is(link('/dashboard/contracts', 'landlord'), { screen: 'contract-list', side: 'landlord' });
});

test('every /dashboard actionPath the notification service can build is covered', () => {
  const file = path.resolve(
    __dirname,
    '../../hs-notification-service/src/modules/notification-events/notification-event.ts'
  );
  const literals = fs.readFileSync(file, 'utf8').match(/(['`])\/dashboard\/(?:(?!\1).)*\1/g);
  const notRental = /^\/dashboard\/(viewing-schedules|membership|properties)/;
  const paths = literals
    .map((literal) => literal.slice(1, -1).replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, UUID))
    .filter((actionPath) => !notRental.test(actionPath));
  assert.ok(paths.length >= 6, `only ${paths.length} paths found`);
  for (const actionPath of paths) {
    const route = link(actionPath);
    // The two bases get "?requestId=" appended by the service; /payments needs its paymentId.
    assert.ok(route && route.screen !== 'link-error', `unmapped: ${actionPath}`);
  }
});

test('section=deposit lands on the deposit agreement in two steps', () => {
  const route = link('/dashboard/invoices/lease-1?section=deposit');
  const query = nav.contractQueryOf(route);
  is(query, { tab: 'payment', section: 'deposit' });
  is(
    contractLandingTarget('tenant', { id: 'lease-1', depositAgreementContractId: 'dep-1' }, query),
    {
      screen: 'contract-detail',
      side: 'tenant',
      contractId: 'dep-1',
      tab: 'payment',
    }
  );
  is(contractLandingTarget('landlord', { id: 'lease-1' }, query), {
    screen: 'contract-detail',
    side: 'landlord',
    contractId: 'lease-1',
    tab: 'end',
  });
});

test('paymentLink results are navigable routes', () => {
  const base = { payerId: 't', payeeId: 'l', direction: 'TENANT_TO_LANDLORD', contractId: 'c-1' };
  const { href } = paymentLink({ ...base, type: 'DEPOSIT_REFUND', direction: 'x' }, 't');
  is(nav.navigateStack([], href), [landing('c-1', { tab: 'payment', section: 'deposit' })]);
});

test('hostile and foreign paths never become a resource route', () => {
  for (const value of [
    null,
    undefined,
    42,
    '',
    'dashboard/contracts/c-1',
    '//evil.example/dashboard/contracts/c-1',
    'https://evil.example/dashboard/contracts/c-1',
    'javascript:alert(1)',
    '/\\evil.example',
    '/dashboard/contracts/c 1',
    '/dashboard/contracts/<script>',
    '/dashboard/contracts/../payments?paymentId=p',
    `/dashboard/contracts/${'a'.repeat(500)}`,
    '/operations/complaints?caseId=1',
    '/notifications',
    '/dashboard',
    '/dashboard/payments',
    '/dashboard/membership',
    '/dashboard/contracts/c-1/extra',
    '/dashboard/complaints/x',
    '/dashboard/rental-requests/other',
    '/dashboard/landlord/contracts/reservations/r-1',
    '/dashboard/tenant/contracts/reservations/r-1/x',
    '/rent/some-listing',
  ])
    assert.equal(link(value), null, String(value));

  for (const id of [
    '%2e%2e',
    '%2F..%2Fadmin',
    'a%3Fb',
    'a%23b',
    'a%20b',
    '-a',
    '_a',
    '%zz',
    'a'.repeat(65),
    'a.b',
  ]) {
    for (const actionPath of [
      `/dashboard/contracts/${id}?tab=sign`,
      `/dashboard/invoices/${id}?section=deposit`,
      `/dashboard/landlord/contracts/${id}`,
      `/dashboard/tenant/contracts/reservations/${id}`,
      `/dashboard/payments?paymentId=${id}`,
    ])
      assert.equal(link(actionPath).screen, 'link-error', actionPath);
    is(link(`/dashboard/invoices?contract=${id}`), { screen: 'payment-history', side: 'tenant' });
  }
  for (const query of [
    '',
    `?requestId=${UUID}`,
    `?requestId=${UUID}&complaintId=..%2Fx`,
    `?requestId=${'a'.repeat(201)}&complaintId=b`,
  ])
    assert.equal(link(`/dashboard/complaints${query}`).screen, 'link-error', query);
  for (const id of ['abc', '..%2F1', `${UUID}%3Fa`, '%zz'])
    is(link(`/dashboard/rental-requests?requestId=${id}`), {
      screen: 'rental-requests',
      mode: 'RECEIVED',
      invalidLink: true,
    });
  // As on the web, a malformed ?invoice= is kept only as the (never fetched) selection.
  const forwarded = link('/dashboard/invoices/c-1?section=monthly&invoice=..%2Fx');
  assert.equal(forwarded.contractId, 'c-1');
  assert.equal(forwarded.invoice, '../x');
});

test('navigator stack: push, replace, back, legacy redirect, stable keys', () => {
  const list = { screen: 'contract-list', side: 'tenant' };
  const detail = { screen: 'contract-detail', side: 'tenant', contractId: 'c-1' };
  let stack = nav.navigateStack([list], detail);
  is(stack, [list, detail]);
  stack = nav.navigateStack(stack, { ...detail, tab: 'sign' }, { replace: true });
  is(stack, [list, { ...detail, tab: 'sign' }]);
  assert.equal(nav.routeKey(stack[1]), nav.routeKey(detail));
  assert.notEqual(nav.routeKey(detail), nav.routeKey({ ...detail, contractId: 'c-2' }));
  assert.equal(
    nav.routeKey({ screen: 'rental-requests', mode: 'SENT', requestId: UUID }),
    nav.routeKey({ screen: 'rental-requests', mode: 'SENT' })
  );
  is(nav.backStack(stack), [list]);
  is(nav.backStack([list]), []);
  is(nav.navigateStack([], { screen: 'invoice-landing', contractId: 'c-1' }), [
    landing('c-1', { tab: 'payment', section: 'monthly' }),
  ]);
  assert.equal(
    nav.normalizeRentalRoute({ screen: 'invoice-landing', contractId: '../x' }).screen,
    'link-error'
  );
});

test('Quản lý menu: only requests, contracts and payment history enter the rental flow', () => {
  const rental = Object.keys(MANAGEMENT_TITLES).filter((id) => nav.rentalRouteForDestination(id));
  assert.deepEqual(rental.sort(), [
    'landlord-contracts',
    'landlord-payments',
    'landlord-requests',
    'tenant-contracts',
    'tenant-payments',
    'tenant-requests',
  ]);
  is(nav.rentalRouteForDestination('tenant-requests'), { screen: 'rental-requests', mode: 'SENT' });
  is(nav.rentalRouteForDestination('landlord-payments'), {
    screen: 'payment-history',
    side: 'landlord',
  });
});

test('notification type lists equal the web ones', () => {
  const web = fs.readFileSync(
    path.resolve(__dirname, '../../hs-web-app/services/notification.service.ts'),
    'utf8'
  );
  const block = (name) => {
    const match = web.match(
      new RegExp(`const ${name}\\b[^=]*= (?:new Set\\(\\[|\\{)([\\s\\S]*?)(?:\\]\\)|\\});`)
    );
    assert.ok(match, name);
    // Object keys, or the quoted entries of the Set.
    return match[1].match(
      name === 'ROUTED_PAYMENT_TYPES' ? /[A-Z][A-Z_]{3,}/g : /\b[A-Z][A-Z_]{3,}(?=:)/g
    );
  };
  const equal = (set, ...names) =>
    assert.deepEqual([...set].sort(), names.flatMap(block).sort(), names.join());
  equal(sync.INVOICE_TYPES, 'INVOICE_TYPE_TAGS');
  equal(sync.ROUTED_PAYMENT_TYPES, 'ROUTED_PAYMENT_TYPES');
  equal(sync.AGREEMENT_TYPES, 'AGREEMENT_TYPE_TAGS');
  equal(
    sync.CONTRACT_CHANGE_TYPES,
    'AMENDMENT_TYPE_TAGS',
    'RENEWAL_TYPE_TAGS',
    'TERMINATION_TYPE_TAGS',
    'RETURN_SETTLEMENT_TYPE_TAGS'
  );
});

test('socket signals become the web sync events', () => {
  const event = (category, type, metadata) =>
    plain(sync.rentalSyncEvents('notification:new', { category, type, metadata }));
  assert.deepEqual(event('RENTAL_REQUEST', 'RENTAL_REQUEST_ACCEPTED', { requestId: 'r' }), [
    { type: 'rental-request-changed', requestId: 'r' },
  ]);
  assert.deepEqual(event('RENTAL_REQUEST', 'COMPLAINT_OPENED', { rentalRequestId: 'r' }), [
    { type: 'rental-request-changed', requestId: 'r' },
    { type: 'complaint-changed', requestId: 'r' },
  ]);
  assert.deepEqual(event('PAYMENT', 'PAYMENT_DUE_SOON', { paymentId: 'p' }), [
    { type: 'payment-changed', paymentId: 'p' },
  ]);
  assert.deepEqual(event('PAYMENT', 'INVOICE_ISSUED', { contractId: 'c', invoiceId: 'i' }), [
    { type: 'invoice-changed', contractId: 'c', invoiceId: 'i' },
  ]);
  assert.deepEqual(event('CONTRACT', 'AGREEMENT_SIGNING_TURN', { agreementId: 'a' }), [
    { type: 'agreement-changed', agreementId: 'a' },
  ]);
  assert.deepEqual(event('CONTRACT', 'LEASE_CLOSED', { contractId: 'c' }), [
    { type: 'agreement-changed', agreementId: 'c' },
  ]);
  assert.deepEqual(event('PAYMENT', 'MEMBERSHIP_EXPIRED', {}), []);
  assert.deepEqual(event('CHAT', 'X', null), []);
  assert.deepEqual(plain(sync.rentalSyncEvents('notification:new', null)), []);
  assert.deepEqual(plain(sync.rentalSyncEvents('notification:read', {})), []);
  for (const name of ['connect', 'notifications:changed'])
    assert.equal(sync.rentalSyncEvents(name).length, 4, name);
});

function harness(matches, makeSync) {
  const state = { visible: true, calls: 0, listeners: new Set(), active: new Set() };
  const add = (set) => (listener) => {
    set.add(listener);
    return () => set.delete(listener);
  };
  const stop = sync.startChangeSync({
    subscribe: add(state.listeners),
    onActive: add(state.active),
    matches,
    sync: makeSync({ refresh: () => void state.calls++, isVisible: () => state.visible }),
  });
  return {
    state,
    stop,
    send: (...args) => state.listeners.forEach((listener) => listener(...args)),
    activate() {
      state.visible = true;
      state.active.forEach((listener) => listener());
    },
  };
}

test('change sync coalesces, defers in the background, recovers once and stops', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const tick = async () => {
    t.mock.timers.tick(250);
    await new Promise((resolve) => setImmediate(resolve));
  };
  const h = harness(
    (event) =>
      event.type === 'agreement-changed' && (!event.agreementId || event.agreementId === 'a'),
    createChangeSync
  );
  const notice = (agreementId) =>
    h.send('notification:new', {
      category: 'CONTRACT',
      type: 'AGREEMENT_SIGNING_TURN',
      metadata: { agreementId },
    });
  notice('other');
  await tick();
  assert.equal(h.state.calls, 0);
  notice('a');
  notice('a');
  h.send('connect');
  await tick();
  assert.equal(h.state.calls, 1);
  h.state.visible = false;
  h.send('notifications:changed');
  await tick();
  assert.equal(h.state.calls, 1);
  h.activate();
  await tick();
  assert.equal(h.state.calls, 2);
  h.activate();
  await tick();
  assert.equal(h.state.calls, 2);
  notice('a');
  h.stop();
  await tick();
  assert.equal(h.state.calls, 2);
  assert.equal(h.state.listeners.size + h.state.active.size, 0);
});

test('rental request sync is scoped by requestId', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness((event) => matchesRentalRequestEvent(event, 'r-1'), createRentalRequestSync);
  const notice = (requestId) =>
    h.send('notification:new', {
      category: 'RENTAL_REQUEST',
      type: 'RENTAL_REQUEST_ACCEPTED',
      metadata: { requestId },
    });
  notice('r-2');
  t.mock.timers.tick(250);
  assert.equal(h.state.calls, 0);
  notice('r-1');
  t.mock.timers.tick(250);
  assert.equal(h.state.calls, 1);
  h.stop();
});
