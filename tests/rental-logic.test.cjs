/* global __dirname, Buffer */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodeCrypto = require('node:crypto');
const { test } = require('node:test');
const ts = require('typescript');

// Every comparison loads the real web source from ../../hs-web-app and the mobile port from ../src and
// diffs their output. Logic that lives inside a web .tsx component is cut out of the web source by text
// markers and evaluated, so a web change to it fails here too.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const MOBILE_SRC = path.resolve(__dirname, '../src');

const stubs = {
  'expo-crypto': {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: (algorithm, data) => {
      assert.ok(ArrayBuffer.isView(data), 'the Android digest needs a typed array');
      return nodeCrypto.webcrypto.subtle.digest(algorithm, data);
    },
  },
  '@/services/rental-onboarding.service': { rentalOnboardingService: {} },
  '@/services/rental/rental-onboarding.service': { rentalOnboardingService: {} },
};
const sandbox = (extra) => ({
  Buffer,
  URL,
  URLSearchParams,
  AbortController,
  setTimeout,
  clearTimeout,
  structuredClone,
  crypto: nodeCrypto.webcrypto,
  Uint8Array,
  ...extra,
});
const transpile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

function loader(root) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    vm.runInNewContext(
      transpile(fs.readFileSync(file, 'utf8')),
      sandbox({
        module,
        exports: module.exports,
        require: (request) => {
          if (stubs[request]) return stubs[request];
          if (request.startsWith('@/')) return load(`${path.join(root, request.slice(2))}.ts`);
          if (request.startsWith('.'))
            return load(`${path.resolve(path.dirname(file), request)}.ts`);
          return require(request);
        },
      })
    );
    return module.exports;
  }
  return (request) => load(`${path.join(root, request)}.ts`);
}

const web = loader(WEB);
const mob = loader(MOBILE_SRC);
const W = (name) => web(name);
const M = (name) => mob(`lib/rental/${name}`);

const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8').replace(/\r\n/g, '\n');
/** Web source from `from` up to (not including) `to`. */
function cut(rel, from, to) {
  const source = read(rel);
  const a = source.indexOf(from);
  assert.ok(a >= 0, `${rel}: marker not found: ${from}`);
  const b = source.indexOf(to, a + from.length);
  assert.ok(b >= 0, `${rel}: marker not found: ${to}`);
  return source.slice(a, b);
}
function evalWeb(code, result, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    transpile(`${code}\n;module.exports = (${result});`),
    sandbox({ module, exports: module.exports, require, ...globals })
  );
  return module.exports;
}

// Objects built inside a vm have other realms' prototypes. JSON text also pins the key order.
const json = (value) => JSON.stringify(value) ?? 'undefined';
const plain = (value) => JSON.parse(JSON.stringify(value));
function same(actual, expected, label) {
  const a = json(actual);
  const e = json(expected);
  if (a !== e) assert.equal(a, e, label);
}
function outcome(fn) {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: String(error.message) };
  }
}
function product(axes) {
  return Object.entries(axes).reduce(
    (rows, [key, values]) => rows.flatMap((row) => values.map((v) => ({ ...row, [key]: v }))),
    [{}]
  );
}

const ROLES = ['LANDLORD', 'TENANT'];
const REQUEST_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'COMPLETED',
  'CANCELLED_BY_RENTER',
  'CANCELLED_BY_OWNER',
  'CANCELLED_BY_SYSTEM',
];
const CONTRACT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'LANDLORD_SIGNATURE_PENDING',
  'TENANT_SIGNATURE_PENDING',
  'ACTIVE',
  'EXPIRED',
  'CLOSED',
  'TERMINATED',
  'CANCELLED',
];
const PAYMENT_STATUSES = [
  'AWAITING_TRANSFER',
  'TRANSFER_REPORTED',
  'CONFIRMED',
  'REJECTED',
  'OVERDUE',
  'EXPIRED',
  'CANCELLED',
];
const STAGES = [
  'PENDING',
  'AWAITING_DEPOSIT',
  'AWAITING_DEPOSIT_CONFIRMATION',
  'AWAITING_DEPOSIT_SIGNATURE',
  'WAITING_START',
  'AWAITING_FIRST_RENT',
  'AWAITING_RENT_CONFIRMATION',
  'PREPARING_CONTRACT',
  'CONTRACT_TEMPLATE_REQUIRED',
  'READY_TO_SIGN',
  'REQUIRES_REVIEW',
  'CANCELLATION_REQUESTED',
  'CANCELLATION_REFUND_PENDING',
  'RESOLUTION_PENDING',
  'COMPLETED',
  'CANCELLED_BY_SYSTEM',
  'CANCELLED_BY_RENTER',
  'CANCELLED_BY_OWNER',
  'EXPIRED',
  'REJECTED',
  'SOMETHING_NEW',
];
const NEXT_CODES = [
  'PAY_DEPOSIT',
  'CONFIRM_DEPOSIT',
  'REVIEW_PAYMENT',
  'PREPARE_DEPOSIT_AGREEMENT',
  'SIGN_DEPOSIT_LANDLORD',
  'SIGN_DEPOSIT_TENANT',
  'WAIT_START',
  'PAY_FIRST_RENT',
  'FIRST_RENT_OVERDUE',
  'CONFIRM_FIRST_RENT',
  'PREPARE_LEASE',
  'LEASE_TEMPLATE_REQUIRED',
  'SIGN_LEASE_LANDLORD',
  'SIGN_LEASE_TENANT',
  'SIGNING_OVERDUE',
  'RESPOND_DEFAULT_NOTICE',
  'DECIDE_CANCELLATION',
  'RESOLUTION_IN_PROGRESS',
  'SEND_REFUND',
  'CONFIRM_REFUND',
  'NONE',
  'FUTURE_CODE',
];
const INSTANTS = [
  '2026-01-05T01:02:03Z',
  '2026-11-25T23:59:59+07:00',
  '2026-12-31T17:00:00.123456Z',
  '2027-02-28T16:59:59.000+00:00',
];

// ---------------------------------------------------------------- formatting

test('Hermes-safe formatters equal Node Intl vi-VN', () => {
  const f = M('format');
  const zone = { timeZone: 'Asia/Ho_Chi_Minh' };
  for (const n of [
    0,
    1,
    999,
    1000,
    14_000_000,
    1234567.891,
    -25000,
    0.5,
    2.5,
    -2.5,
    1.25,
    1.2345,
    1.0005,
    1234.5675,
    0.1 + 0.2,
    NaN,
  ]) {
    assert.equal(f.numberVi(n), n.toLocaleString('vi-VN'), `number ${n}`);
    assert.equal(
      f.currencyVnd(n),
      new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(n),
      `currency ${n}`
    );
  }
  for (const value of INSTANTS) {
    const d = new Date(value);
    assert.equal(f.vnDateTime(value), d.toLocaleString('vi-VN', zone));
    assert.equal(f.vnDate(value), d.toLocaleDateString('vi-VN', zone));
    assert.equal(
      f.vnShortDateTime(value),
      new Intl.DateTimeFormat('vi-VN', { ...zone, dateStyle: 'short', timeStyle: 'short' }).format(
        d
      )
    );
    assert.equal(
      f.vnDateKey(value),
      new Intl.DateTimeFormat('en-CA', {
        ...zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    );
    assert.equal(f.deviceDateTime(value), d.toLocaleString('vi-VN'));
    assert.equal(f.deviceDate(value), d.toLocaleDateString('vi-VN'));
  }
  assert.equal(f.vnDateTime('x'), new Date('x').toLocaleString('vi-VN', zone));
  assert.throws(() => f.vnDateKey('x'), { name: 'RangeError' });
});

// ---------------------------------------------------------------- labels and presentation

test('status labels and next action: every status x role', () => {
  const w = W('lib/rental-labels');
  const m = M('rental-labels');
  for (const s of [...REQUEST_STATUSES, ...CONTRACT_STATUSES, ...PAYMENT_STATUSES, 'X', '', null]) {
    same(m.requestStatus(s), w.requestStatus(s), `request ${s}`);
    same(m.contractStatus(s), w.contractStatus(s), `contract ${s}`);
    same(m.contractStatus(s, 'DEPOSIT'), w.contractStatus(s, 'DEPOSIT'), `deposit ${s}`);
    same(m.paymentStatus(s), w.paymentStatus(s), `payment ${s}`);
  }
  same(m.DETAIL_TABS, w.DETAIL_TABS);
  same(Object.keys(m.toneClasses), Object.keys(w.toneClasses));
  for (const code of NEXT_CODES)
    for (const actor of [...ROLES, 'SYSTEM', 'NONE'])
      for (const role of ROLES)
        same(
          m.describeNextAction({ actor, code }, role),
          w.describeNextAction({ actor, code }, role),
          `${code}/${actor}/${role}`
        );
  same(m.describeNextAction(null, 'TENANT'), null);
  const tab = M('useDetailTab').resolveDetailTab;
  assert.equal(tab('sign'), 'sign');
  assert.equal(tab('nope', 'payment'), 'payment');
  assert.equal(tab(null), 'overview');
});

test('rental request presentation, card action and cancel rule: full matrix', () => {
  const w = W('lib/rental-request-presentation');
  const m = M('rental-request-presentation');
  const matrix = product({
    role: ROLES,
    status: REQUEST_STATUSES,
    contract: [null, ...CONTRACT_STATUSES],
    live: [undefined, 'TRANSFER_REPORTED', 'REJECTED', 'CONFIRMED', 'AWAITING_TRANSFER'],
    listPayment: [null, 'REJECTED', 'CONFIRMED'],
    stage: [null, 'AWAITING_RENT_CONFIRMATION', 'CANCELLATION_REFUND_PENDING', 'WAITING_START'],
    refund: [false, true],
    paymentLapsed: [false, true],
  });
  for (const c of matrix) {
    const input = {
      role: c.role,
      request: {
        status: c.status,
        cancellationRefundPending: c.refund,
        initialPayment: c.listPayment ? { status: c.listPayment } : null,
      },
      contract: c.contract ? { status: c.contract } : null,
      livePaymentStatus: c.live,
      stage: c.stage,
      paymentLapsed: c.paymentLapsed,
    };
    const expected = w.presentRentalRequest(input);
    const actual = m.presentRentalRequest(input);
    same(actual, expected, json(input));
    for (const canCreateContract of [false, true])
      same(
        m.primaryCardAction(c.role, actual, { canCreateContract }),
        w.primaryCardAction(c.role, expected, { canCreateContract })
      );
  }
  const wa = W('lib/rental-request-actions').canCancelRentalRequest;
  const ma = M('rental-request-actions').canCancelRentalRequest;
  for (const c of product({
    role: ROLES,
    status: REQUEST_STATUSES,
    contract: [undefined, ...CONTRACT_STATUSES],
    live: [undefined, ...PAYMENT_STATUSES],
    paid: [...PAYMENT_STATUSES, null],
    total: [0, 100],
    immediate: [true, false],
  })) {
    const request = {
      status: c.status,
      initialPayment: c.paid
        ? { status: c.paid, totalAmount: c.total, canCancelImmediately: c.immediate }
        : null,
    };
    const contract = c.contract ? { status: c.contract } : null;
    assert.equal(
      ma(request, contract, c.live, c.role),
      wa(request, contract, c.live, c.role),
      json(c)
    );
  }
});

test('transfer window, pre-tenancy steps and closed states', () => {
  const w = W('lib/rental-request-presentation');
  const m = M('rental-request-presentation');
  const now = Date.parse('2026-11-25T10:00:00+07:00');
  for (const c of product({
    type: [null, 'RESERVATION_DEPOSIT', 'INITIAL', 'MONTHLY_RENT'],
    status: PAYMENT_STATUSES,
    dueAt: [
      null,
      'bad',
      '2026-11-25T09:59:59+07:00',
      '2026-11-25T10:00:00+07:00',
      '2026-11-26T00:00:00Z',
    ],
  }))
    assert.equal(m.transferWindowClosed(c, now), w.transferWindowClosed(c, now), json(c));
  for (const c of product({
    stage: STAGES,
    depositAgreementRequired: [undefined, true, false],
    nextAction: [null, { code: 'SIGNING_OVERDUE' }, { code: 'REVIEW_PAYMENT' }],
    hasRentPayment: [false, true],
  }))
    same(m.preTenancySteps(c), w.preTenancySteps(c), json(c));
  for (const s of [...STAGES, ...REQUEST_STATUSES]) {
    assert.equal(m.isClosedOnboardingStage(s), w.isClosedOnboardingStage(s), s);
    assert.equal(m.isClosedRequest(s), w.isClosedRequest(s), s);
  }
});

// ---------------------------------------------------------------- next step and timeline

const bill = (id, status, paymentStatus, extra = {}) => ({
  id,
  periodIndex: Number(id.slice(1)),
  status,
  paymentStatus,
  finalCostSupplement: false,
  ...extra,
});
const BILL_SETS = [
  [],
  [bill('b1', 'DRAFT')],
  [bill('b1', 'UNPAID')],
  [bill('b1', 'UNPAID', 'TRANSFER_REPORTED')],
  [bill('b1', 'UNPAID', 'CONFIRMED')],
  [bill('b1', 'OVERDUE')],
  [bill('b1', 'OVERDUE', undefined, { canResolveOverdue: false })],
  [bill('b1', 'OVERDUE', 'TRANSFER_REPORTED'), bill('b2', 'DRAFT')],
  [bill('b1', 'OVERDUE'), bill('b2', 'OVERDUE', 'REJECTED')],
  [bill('b3', 'UNPAID', undefined, { billingPeriod: { paymentPeriodNumber: 4 } })],
  [bill('b1', 'PAID'), bill('b2', 'CANCELLED'), bill('b3', 'ROLLED_OVER')],
];

test('deriveNextStep: contract status x role x closure x bills x signing x requests', () => {
  const w = W('components/contract/page/nextStep');
  const m = M('nextStep');
  const check = (input) => same(m.deriveNextStep(input), w.deriveNextStep(input), json(input));
  const lifecycle = (extra) => ({
    renewals: [],
    billing: { bills: [], allPaid: true },
    canProposeClosure: false,
    ...extra,
  });
  for (const c of product({
    role: ROLES,
    status: CONTRACT_STATUSES,
    closure: [
      null,
      'WAITING_HANDOVER',
      'PROPOSED',
      'DISPUTED',
      'REFUND_PENDING',
      'BALANCE_PENDING',
      'CLOSED',
    ],
    pay: [null, 'AWAITING_TRANSFER', 'TRANSFER_REPORTED'],
    can: [false, true],
    allPaid: [false, true],
    which: ['refundPayment', 'balancePayment'],
  }))
    check({
      role: c.role,
      actorId: 'me',
      contract: { status: c.status },
      lifecycle: lifecycle({
        closure: c.closure ? { status: c.closure } : undefined,
        canProposeClosure: c.can,
        billing: { bills: [], allPaid: c.allPaid },
        [c.which]: c.pay ? { status: c.pay } : undefined,
      }),
    });
  for (const role of ROLES)
    for (const status of CONTRACT_STATUSES)
      for (const bills of BILL_SETS)
        check({
          role,
          actorId: 'me',
          contract: { status },
          lifecycle: lifecycle({ billing: { bills, allPaid: false } }),
        });
  const renewals = [
    [],
    [{ status: 'REQUESTED' }],
    [{ status: 'APPROVED', agreementStatus: 'DRAFT' }],
    ...CONTRACT_STATUSES.map((agreementStatus) => [
      { status: 'APPROVED', agreementStatus, agreementContractId: 'r1' },
    ]),
  ];
  const proposals = [
    [],
    [{ status: 'REQUESTED', recipientId: 'me' }],
    [{ status: 'TENANT_REQUESTED', recipientId: 'other' }],
    [{ status: 'CHANGES_REQUESTED', recipientId: 'me' }],
    [{ status: 'APPROVED' }],
    ...CONTRACT_STATUSES.map((agreementStatus) => [
      { status: 'APPROVED', agreementStatus, agreementContractId: 'a1' },
    ]),
  ];
  for (const role of ROLES)
    for (const r of renewals)
      for (const p of proposals)
        check({
          role,
          actorId: 'me',
          contract: { status: 'ACTIVE' },
          lifecycle: lifecycle({ renewals: r }),
          proposals: p,
        });
  for (const role of ROLES)
    for (const status of CONTRACT_STATUSES) {
      check({ role, actorId: 'me', contract: { status, parentContractId: 'root' } });
      check({ role, actorId: 'me', contract: { status }, lifecycle: null });
    }
  for (const tab of ['overview', 'sign', 'payment', 'end', 'content', 'history'])
    assert.equal(m.primaryLabel(tab), w.primaryLabel(tab));
});

test('leaseTimeline: every status x payment x timestamps x deposit', () => {
  const w = W('components/contract/page/timeline').leaseTimeline;
  const m = M('timeline').leaseTimeline;
  const at = [null, '2026-01-01T00:00:00Z'];
  for (const c of product({
    status: CONTRACT_STATUSES,
    paymentStatus: [null, 'PAID', 'PAID_MOCK', 'PENDING'],
    paidAt: at,
    landlordConfirmedAt: at,
    signedAt: at,
    createdAt: at,
  }))
    for (const deposit of [undefined, true, false]) same(m(c, deposit), w(c, deposit), json(c));
});

// ---------------------------------------------------------------- invoices and payment module

const INVOICE_STATUSES = ['DRAFT', 'UNPAID', 'OVERDUE', 'PAID', 'ROLLED_OVER', 'CANCELLED'];
const WORKFLOW_STATES = ['UNPAID', 'UNDER_REVIEW', 'EXTENSION_PENDING', 'PAID', 'DRAFT'];

test('invoice status presentation, labels and needs-action: full matrix', () => {
  const w = W('lib/invoice-status');
  const m = M('invoice-status');
  for (const c of product({
    status: INVOICE_STATUSES,
    workflowState: WORKFLOW_STATES,
    payment: [undefined, null, ...PAYMENT_STATUSES],
    failed: [false, true],
  })) {
    const options = { paymentLoadFailed: c.failed };
    const { className: _w, ...expected } = w.invoiceStatusPresentation(c, c.payment, options);
    const { className, ...actual } = m.invoiceStatusPresentation(c, c.payment, options);
    same(actual, expected, json(c));
    assert.ok(className);
  }
  for (const c of product({
    role: ['landlord', 'tenant'],
    status: INVOICE_STATUSES,
    workflowState: WORKFLOW_STATES,
    payment: [undefined, ...PAYMENT_STATUSES],
    activeResolution: [undefined, 'EXTENSION_REQUEST'],
    paymentExtensions: [[], [{ status: 'PENDING' }]],
  }))
    assert.equal(
      M('invoice-list').invoiceNeedsAction(c.role, c, c.payment),
      W('lib/invoice-list').invoiceNeedsAction(c.role, c, c.payment),
      json(c)
    );
  for (const c of product({
    periodIndex: [0, 3],
    finalCostSupplement: [false, true],
    billingPeriod: [
      undefined,
      ...['INITIAL_RENT', 'COSTS_ONLY', 'SUPPLEMENT', 'FINAL_SETTLEMENT'].map((kind) => ({ kind })),
      ...[1, 2, 5].map((paymentPeriodNumber) => ({ kind: 'RECURRING', paymentPeriodNumber })),
    ],
    status: [undefined, 'DRAFT', 'UNPAID'],
    lines: [undefined, [], [{ type: 'RENT' }], [{ type: 'LATE_FEE' }]],
  })) {
    assert.equal(m.invoicePeriodLabel(c), w.invoicePeriodLabel(c), json(c));
    assert.equal(m.invoicePeriodSecondaryLabel(c), w.invoicePeriodSecondaryLabel(c), json(c));
  }
  for (const value of [undefined, null, '', '2026-01-05', ...INSTANTS])
    assert.equal(m.formatInvoiceDate(value), w.formatInvoiceDate(value), String(value));
  for (const n of [0, 14_000_000, -5000, 1234.5])
    assert.equal(m.formatInvoiceMoney(n), w.formatInvoiceMoney(n));
});

const toWebPath = (route) => {
  const { screen, side, contractId, ...query } = route;
  const base = {
    'contract-list': `/dashboard/${side}/contracts`,
    'contract-detail': `/dashboard/${side}/contracts/${contractId}`,
    'contract-landing': `/dashboard/contracts/${contractId}`,
    'invoice-landing': `/dashboard/invoices/${contractId}`,
  }[screen];
  const search = new URLSearchParams(query).toString();
  return search ? `${base}?${search}` : base;
};

test('payment module and contract routes describe the same destinations', () => {
  const w = W('lib/payment-module');
  const m = M('payment-module');
  const wr = W('lib/contract-routes');
  const mr = M('contract-routes');
  for (const role of ['landlord', 'tenant']) {
    assert.equal(toWebPath(mr.contractListPath(role)), wr.contractListPath(role));
    assert.equal(toWebPath(mr.contractDetailPath(role, 'c1')), wr.contractDetailPath(role, 'c1'));
  }
  assert.equal(toWebPath(mr.contractLandingPath('c1')), wr.contractLandingPath('c1'));
  assert.equal(toWebPath(mr.invoiceDetailPath('c1')), wr.invoiceDetailPath('c1'));
  const ids = [
    null,
    undefined,
    '',
    ' c1 ',
    'a/b',
    '../x',
    'first-rent:p1',
    'first-rent:',
    'x'.repeat(65),
    'A_b-9',
  ];
  for (const id of ids) {
    assert.equal(m.safeResourceId(id), w.safeResourceId(id), String(id));
    assert.equal(m.safeInvoiceSelectionId(id), w.safeInvoiceSelectionId(id), String(id));
  }
  for (const s of [null, 'deposit', 'monthly', 'x'])
    assert.equal(m.paymentSection(s), w.paymentSection(s));
  for (const section of ['monthly', 'deposit'])
    for (const invoice of [undefined, 'i1']) {
      assert.equal(
        new URLSearchParams(m.paymentQuery(section, invoice)).toString(),
        w.paymentQuery(section, invoice)
      );
      assert.equal(
        toWebPath(m.paymentModulePath('c1', section, invoice)),
        w.paymentModulePath('c1', section, invoice)
      );
    }
  for (const c of product({
    side: ['landlord', 'tenant'],
    agreementKind: [null, 'DEPOSIT'],
    parentContractId: [null, 'p'],
    depositAgreementContractId: [null, 'dep1', 'bad/id'],
    query: [
      {},
      { section: 'deposit' },
      { tab: 'sign' },
      { tab: 'payment', section: 'monthly', invoice: 'i1' },
    ],
    hash: ['', '#monthly-invoices'],
  })) {
    const contract = { id: 'c1', ...c };
    const search = new URLSearchParams(c.query).toString();
    const expected = w.contractLandingTarget(c.side, contract, search ? `?${search}` : '', c.hash);
    assert.equal(
      toWebPath(m.contractLandingTarget(c.side, contract, c.query, c.hash)),
      expected.replace('#monthly-invoices', ''),
      json(c)
    );
  }
  const payments = [{ id: 'p1', invoiceId: 'b2', status: 'TRANSFER_REPORTED' }];
  for (const bills of BILL_SETS)
    for (const role of ['landlord', 'tenant'])
      for (const requested of [null, 'b2', 'zzz'])
        assert.equal(
          m.chooseInvoice(bills, payments, role, requested),
          w.chooseInvoice(bills, payments, role, requested)
        );
});

test('paymentLink (web payments page) leads to the same destinations', () => {
  const rel = 'app/dashboard/payments/page.tsx';
  const webLink = evalWeb(
    cut(rel, 'const RENTAL_REQUEST_TYPES', '// Same shape the notification consumer'),
    'paymentLink',
    {
      invoiceDetailPath: W('lib/contract-routes').invoiceDetailPath,
      contractDetailPath: W('lib/contract-routes').contractDetailPath,
    }
  );
  const link = M('payment-link').paymentLink;
  for (const c of product({
    type: [
      'INITIAL',
      'RESERVATION_DEPOSIT',
      'INITIAL_PAYMENT_REFUND',
      'DEPOSIT_ADJUSTMENT',
      'DEPOSIT_REFUND',
      'OTHER_CHARGE',
      'MONTHLY_RENT',
    ],
    direction: ['TENANT_TO_LANDLORD', 'LANDLORD_TO_TENANT'],
    rentalRequestId: ['', 'r1'],
    contractId: [undefined, 'c1'],
    invoiceId: [undefined, 'i1'],
    actor: ['payer', 'payee', 'stranger'],
  })) {
    const p = { ...c, payerId: 'payer', payeeId: 'payee' };
    const expected = webLink(p, c.actor);
    const actual = link(p, c.actor);
    if (!expected) {
      assert.equal(actual, null, json(c));
      continue;
    }
    assert.equal(actual.label, expected.label, json(c));
    const href =
      actual.href.screen === 'rental-requests'
        ? `/dashboard/rental-requests${actual.href.mode === 'RECEIVED' ? '' : '/my-requests'}?requestId=${actual.href.requestId}`
        : toWebPath(actual.href);
    assert.equal(href, expected.href, json(c));
  }
});

// ---------------------------------------------------------------- small shared libs

test('occupant limit, VND input, sentences, quick views and transfer presentation', async () => {
  const wo = W('lib/rental-occupant-limit');
  const mo = M('rental-occupant-limit');
  for (const v of [null, undefined, 0, -1, 1, 3.5, 25, NaN, '4', Infinity]) {
    assert.equal(mo.normalizeOccupantLimit(v), wo.normalizeOccupantLimit(v));
    for (const limit of [null, 1, 5])
      assert.equal(mo.clampOccupants(v, limit), wo.clampOccupants(v, limit));
    for (const snapshot of [null, { listingId: 'l1', limit: 2 }, { listingId: 'x', limit: 9 }])
      assert.equal(
        mo.resolveOccupantLimit('l1', v, snapshot),
        wo.resolveOccupantLimit('l1', v, snapshot)
      );
  }
  const wv = W('lib/vnd-input');
  const mv = M('vnd-input');
  for (const v of [
    null,
    '',
    0,
    5,
    '30000.00',
    '0012',
    '1.234.567',
    '1,234,567 VNĐ',
    '12,50',
    '12.000,00',
    '-5',
    'abc',
    '₫ 5.000',
    1.5,
    123456789,
  ]) {
    assert.equal(mv.canonicalVnd(v), wv.canonicalVnd(v), String(v));
    assert.equal(mv.formatVndInput(v), wv.formatVndInput(v), String(v));
    same(mv.vndSuggestions(v), wv.vndSuggestions(v), String(v));
    assert.equal(mv.parsePastedVnd(String(v)), wv.parsePastedVnd(String(v)), String(v));
  }
  const text = 'Một câu. Hai; vẫn hai.  Ba.\nBốn';
  same(M('split-sentences').splitSentences(text), W('lib/split-sentences').splitSentences(text));

  const lines = [
    [],
    [
      { id: 'a', type: 'DEPOSIT', displayName: 'Cọc', amount: 60 },
      { type: 'RENT', displayName: 'Thuê', amount: 40.1 },
    ],
    [
      { type: 'RENT', displayName: 'Thuê', amount: 100 },
      { type: 'X', displayName: '0', amount: 0 },
    ],
    [{ type: 'RENT', displayName: 'Âm', amount: -1 }],
  ];
  const wq = W('lib/rental-deposit-quick-view');
  const mq = M('rental-deposit-quick-view');
  const payments = [];
  for (const c of product({
    type: [
      'RESERVATION_DEPOSIT',
      'INITIAL',
      'INITIAL_PAYMENT_REFUND',
      'DEPOSIT_REFUND',
      'DEPOSIT_ADJUSTMENT',
      'MONTHLY_RENT',
    ],
    direction: ['TENANT_TO_LANDLORD', 'LANDLORD_TO_TENANT'],
    status: PAYMENT_STATUSES,
    totalAmount: [0, 100, 100.1],
    lineItems: lines,
  })) {
    const p = { ...c, id: `p${payments.length}`, rentalRequestId: 'r1', payeeId: 'me' };
    payments.push(p);
    same(
      M('payment-transfer-presentation').paymentTransferPresentation(p),
      W('lib/payment-transfer-presentation').paymentTransferPresentation(p),
      json(c)
    );
    assert.equal(mq.reservationPaymentTitle(p), wq.reservationPaymentTitle(p));
    assert.equal(mq.reservationPaymentStatus(p), wq.reservationPaymentStatus(p));
    for (const actor of ['me', 'x', null])
      for (const owner of [true, false])
        assert.equal(
          mq.canReviewReservationReceipt(p, actor, owner),
          wq.canReviewReservationReceipt(p, actor, owner)
        );
  }
  same(
    M('payment-transfer-presentation').paymentTransferPresentation(null),
    W('lib/payment-transfer-presentation').paymentTransferPresentation(null)
  );
  for (let start = 0; start < payments.length; start += 37) {
    const rows = payments.slice(start, start + 12).reverse();
    for (const id of [undefined, rows[2]?.id, 'none'])
      same(mq.selectOnboardingPayment(rows, 'r1', id), wq.selectOnboardingPayment(rows, 'r1', id));
  }
  for (const p of [
    null,
    undefined,
    { type: 'INITIAL' },
    { type: 'RESERVATION_DEPOSIT' },
    { displayName: 'Tên' },
  ])
    assert.equal(mq.paymentSummaryTitle(p), wq.paymentSummaryTitle(p));

  const ws = W('lib/rental-start-change-quick-view');
  const ms = M('rental-start-change-quick-view');
  same(ms.startChangeStatus, ws.startChangeStatus);
  for (const t of INSTANTS) {
    assert.equal(ms.vietnamTime(t), ws.vietnamTime(t));
    assert.equal(ms.calendarDate(t), ws.calendarDate(t));
  }
  for (const serverNow of INSTANTS) {
    const view = { serverNow, startsOn: '2027-03-01' };
    same(ms.earlierStartBounds(view), ws.earlierStartBounds(view));
    for (const date of ['', '2026-01-05', '2026-11-26', '2027-02-28', '2027-03-01'])
      for (const reason of ['ngắn', '  đủ mười ký tự  '])
        assert.equal(
          ms.isValidEarlierStart(date, reason, view),
          ws.isValidEarlierStart(date, reason, view)
        );
  }
  for (const c of product({
    stage: STAGES,
    status: ['REQUESTED', 'APPROVED'],
    askerRole: ROLES,
    mode: ['RECEIVED', 'SENT'],
    cancel: [undefined, 'x'],
    respondBy: ['2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'],
    actor: ['o', 'r'],
  })) {
    const view = {
      stage: c.stage,
      askerRole: c.askerRole,
      cancellationRequestedAt: c.cancel,
      serverNow: INSTANTS[1],
    };
    const change = { status: c.status, respondBy: c.respondBy };
    const request = { status: 'ACCEPTED', ownerId: 'o', renterId: 'r' };
    assert.equal(
      ms.canHandleStartChange(request, view, change, c.actor, c.mode),
      ws.canHandleStartChange(request, view, change, c.actor, c.mode)
    );
  }
});

test('rental request helpers and snapshot helpers', () => {
  const w = W('components/rental-request/rental-request.helper');
  const m = M('rental-request.helper');
  const ws = W('components/rental-request/rental-request-snapshot.helper');
  const ms = M('rental-request-snapshot.helper');
  const methods = [
    'FREE',
    'INCLUDED',
    'PER_KWH',
    'PER_M3',
    'STATE_WATER_RATE',
    'PER_HOUR',
    'PER_PERSON_MONTH',
    'PER_MONTH',
    'CUSTOM',
    undefined,
  ];
  const charges = methods.flatMap((billingMethod) =>
    [0, 3500, null].flatMap((unitAmount) =>
      [true, false].map((includedInRent) => ({
        billingMethod,
        unitAmount,
        includedInRent,
        reason: 'lý do',
      }))
    )
  );
  for (const input of [charges, [], null, undefined]) {
    same(m.partitionPredictableCharges(input), w.partitionPredictableCharges(input));
    same(m.partitionExcludedCharges(input), w.partitionExcludedCharges(input));
    same(
      m.hasPersonBasedCharges(input && { predictableCharges: input }),
      w.hasPersonBasedCharges(input && { predictableCharges: input })
    );
  }
  for (const c of charges)
    assert.equal(m.formatExcludedChargeValue(c), w.formatExcludedChargeValue(c));
  for (const n of [0, NaN, 14_000_000, -1]) assert.equal(m.formatVND(n), w.formatVND(n));
  for (const n of [NaN, -1, 3, 99]) assert.equal(m.clampValue(n, 1, 10), w.clampValue(n, 1, 10));
  for (const moto of [true, false])
    for (const car of [true, false]) {
      const e = { motorbike: { allowed: moto }, car: { allowed: car } };
      assert.equal(m.hasVehicleParkingAllowed(e), w.hasVehicleParkingAllowed(e));
    }
  for (const text of [
    null,
    '',
    '  ',
    '{',
    '{}',
    '[]',
    '[null,1,{}]',
    json([
      {
        chargeType: 'W',
        displayName: 'N',
        billingMethod: 'PER_M3',
        unitAmount: 1,
        quantity: 2,
        amount: 3,
        includedInRent: 1,
        note: 'x',
        reason: 'r',
      },
    ]),
  ]) {
    same(ms.parseCostBreakdownSnapshot(text), ws.parseCostBreakdownSnapshot(text));
    same(ms.parseExcludedChargesSnapshot(text), ws.parseExcludedChargesSnapshot(text));
  }
  for (const n of [null, undefined, 0, -1, 2]) {
    assert.equal(ms.formatOccupantCount(n), ws.formatOccupantCount(n));
    assert.equal(ms.formatMotorbikeCount(n), ws.formatMotorbikeCount(n));
    assert.equal(ms.formatCarCount(n), ws.formatCarCount(n));
  }
  for (const date of [null, '', 'bad', '2026-01-31', '2026-11-25T10:00:00+07:00'])
    for (const months of [null, 0, 1, 13])
      assert.equal(
        ms.calculateEstimatedEndDate(date, months),
        ws.calculateEstimatedEndDate(date, months)
      );
});

test('onboarding read, contract preview and contract fallback behave like the web', async () => {
  const axiosError = (status) =>
    Object.assign(new Error('x'), { isAxiosError: true, response: { status } });
  for (const [status, fallsBack] of [
    [404, true],
    [405, true],
    [500, false],
    [403, false],
  ]) {
    for (const [name, load] of [
      ['web', () => W('lib/rental-onboarding-read')],
      ['mobile', () => M('rental-onboarding-read')],
    ]) {
      const key =
        name === 'web'
          ? '@/services/rental-onboarding.service'
          : '@/services/rental/rental-onboarding.service';
      Object.assign(stubs[key].rentalOnboardingService, {
        get: () => Promise.reject(axiosError(status)),
        refresh: () => Promise.resolve('refreshed'),
      });
      const result = await load()
        .readOnboarding('r')
        .catch(() => 'threw');
      assert.equal(result, fallsBack ? 'refreshed' : 'threw', `${name} ${status}`);
    }
  }

  const wp = W('lib/contract-preview');
  const mp = M('contract-preview');
  const errors = [
    null,
    'x',
    {},
    { code: 'ERR_NETWORK' },
    { code: 'ECONNABORTED' },
    { code: 'ETIMEDOUT' },
    { code: 'ERR_CANCELED' },
    { response: { status: 502 } },
    { response: { status: 503 } },
    { response: { status: 504 } },
    { response: { status: 500 }, code: 'ERR_NETWORK' },
  ];
  for (const e of errors)
    assert.equal(mp.isUncertainPreviewError(e), wp.isUncertainPreviewError(e), json(e));

  const ready = {
    id: 'd',
    status: 'READY',
    revisionId: 'v',
    storageObjectId: 's',
    documentType: 'PDF',
  };
  const scenarios = {
    immediate: { trigger: [ready], status: [] },
    reconciled: {
      trigger: [{ code: 'ERR_NETWORK' }],
      status: [null, { response: { status: 503 } }, ready],
    },
    docxRejected: { trigger: [{ ...ready, documentType: 'DOCX' }], status: [ready] },
    pending: { trigger: [{ ...ready, status: 'PENDING' }], status: [null, null, null] },
    triggerFails: { trigger: [{ response: { status: 400 } }], status: [] },
    statusFails: { trigger: [{ code: 'ETIMEDOUT' }], status: [{ response: { status: 403 } }] },
  };
  for (const [name, scenario] of Object.entries(scenarios)) {
    const run = async (lib) => {
      const log = [];
      const queue = { trigger: [...scenario.trigger], status: [...scenario.status] };
      const step = (kind) => async () => {
        log.push(kind);
        const next = queue[kind].shift() ?? null;
        if (next && (next.response || next.code)) throw next;
        return next;
      };
      const result = await lib
        .generateContractPreview(
          { trigger: step('trigger'), status: step('status') },
          'v',
          new AbortController().signal,
          () => log.push('reconcile'),
          { attempts: 3, wait: async () => {}, requirePdf: true }
        )
        .then(
          (value) => ({ value }),
          (error) => ({ error })
        );
      return plain({ result, log });
    };
    same(await run(mp), await run(wp), name);
  }

  // React Native's AbortSignal has neither throwIfAborted nor reason.
  const rnSignal = { aborted: true, addEventListener() {}, removeEventListener() {} };
  await assert.rejects(
    mp.generateContractPreview(
      { trigger: async () => ready, status: async () => null },
      'v',
      rnSignal,
      () => {}
    ),
    (error) => error.name === 'AbortError'
  );

  const wf = W('lib/rental-contract-fallback');
  const mf = M('rental-contract-fallback');
  for (const c of product({
    mode: ['RECEIVED', 'SENT'],
    status: REQUEST_STATUSES,
    contract: [null, {}],
    view: [
      null,
      { askerRole: 'LANDLORD', canPrepareContract: true },
      { askerRole: 'TENANT', canPrepareContract: true },
      { askerRole: 'LANDLORD', canPrepareContract: false },
      { askerRole: 'LANDLORD', canPrepareContract: true, cancellationRequestedAt: 'x' },
    ],
    payment: [
      null,
      { type: 'INITIAL', status: 'CONFIRMED' },
      { type: 'RESERVATION_DEPOSIT', status: 'CONFIRMED' },
    ],
  })) {
    const request = { status: c.status, initialPayment: c.payment };
    assert.equal(
      mf.canOfferContractFallback(request, c.mode, c.contract, c.view),
      wf.canOfferContractFallback(request, c.mode, c.contract, c.view)
    );
  }
  const view = {
    askerRole: 'LANDLORD',
    canPrepareContract: true,
    serverNow: INSTANTS[1],
    paymentOpensAt: INSTANTS[0],
  };
  const draft = { id: 'c', status: 'DRAFT', currentRevisionId: 'v' };
  const base = {
    refresh: async () => view,
    create: async () => draft,
    find: async () => null,
    completeness: async () => ({ complete: true }),
    preview: async () => ready,
    previewStatus: async () => null,
  };
  const variants = {
    ready: {},
    notYet: { refresh: async () => ({ ...view, paymentOpensAt: '2030-01-01T00:00:00Z' }) },
    existing: { create: async () => ({ ...draft, status: 'ACTIVE' }) },
    raced: { create: async () => Promise.reject({ code: 'ETIMEDOUT' }), find: async () => draft },
    unknown: { create: async () => Promise.reject({ code: 'ETIMEDOUT' }) },
    refused: { create: async () => Promise.reject(new Error('refused')) },
    incomplete: { completeness: async () => ({ complete: false }) },
    noRevision: { create: async () => ({ id: 'c', status: 'DRAFT' }) },
  };
  for (const [name, override] of Object.entries(variants)) {
    const run = (lib) =>
      lib
        .createRentalContractFallback(
          { ...base, ...override },
          new AbortController().signal,
          () => {}
        )
        .then(
          (r) => plain({ ...r, fileError: r.fileError?.message }),
          (e) => ({ error: e.message })
        );
    same(await run(mf), await run(wf), name);
  }
});

// ---------------------------------------------------------------- contract libs

test('contract document history, previews and deposit agreement loader', async () => {
  const w = W('lib/contract-document-history');
  const m = M('contract-document-history');
  const docs = [];
  for (const c of product({
    status: ['READY', 'FAILED'],
    documentType: ['PDF', 'DOCX'],
    purpose: ['PREVIEW', 'OFFICIAL', 'SIGNED_LANDLORD', 'SIGNED_FINAL', 'OTHER'],
    revisionId: ['v1', 'v2'],
  }))
    docs.push({ ...c, id: `d${docs.length}`, generatedAt: INSTANTS[docs.length % 4] });
  for (let size = 0; size <= docs.length; size += 3)
    for (const rows of [
      docs.slice(0, size),
      docs.slice(size),
      docs.slice().reverse().slice(0, size),
    ]) {
      same(m.sortedDocuments(rows), w.sortedDocuments(rows));
      for (const signed of [true, false])
        for (const revision of [undefined, null, 'v1', 'v2']) {
          same(
            m.primaryDocument(rows, signed, revision),
            w.primaryDocument(rows, signed, revision)
          );
          same(
            m.visibleDocument(rows, signed, revision),
            w.visibleDocument(rows, signed, revision)
          );
        }
    }
  for (const doc of docs) {
    assert.equal(m.requiresVerifiedContent(doc), w.requiresVerifiedContent(doc));
    assert.equal(m.documentStage(doc), w.documentStage(doc));
  }
  for (const value of [null, undefined, '', 'bad', '2026-01-05', ...INSTANTS]) {
    assert.equal(m.documentTime(value), w.documentTime(value));
    assert.equal(m.documentDate(value), w.documentDate(value));
  }
  const proposals = product({
    status: [
      'REQUESTED',
      'CHANGES_REQUESTED',
      'APPROVED',
      'SCHEDULED',
      'APPLIED',
      'REJECTED',
      'WITHDRAWN',
      'EXPIRED',
      'SUPERSEDED',
      'TENANT_REQUESTED',
      'TENANT_ACCEPTED',
    ],
    signedAt: [undefined, INSTANTS[0]],
    effectiveOn: ['2026-01-05', '2027-01-01'],
    agreementStatus: [undefined, 'TENANT_SIGNATURE_PENDING'],
    comparison: [
      [],
      [
        { field: 'rentAmount', label: 'a' },
        { field: 'policies.latePaymentFeeMode', label: 'b' },
        { field: 'x', label: 'c' },
        { field: 'y', label: 'd' },
      ],
    ],
  });
  same(m.concreteProposals(proposals), w.concreteProposals(proposals));
  for (const p of proposals) {
    for (const now of [INSTANTS[0], INSTANTS[1], 'bad']) {
      assert.equal(m.appliedAmendment(p, now), w.appliedAmendment(p, now));
      assert.equal(m.amendmentDocumentStatus(p, now), w.amendmentDocumentStatus(p, now));
    }
    assert.equal(m.amendmentDocumentTitle(p), w.amendmentDocumentTitle(p));
  }
  const signatures = product({
    status: ['SIGNED', 'CREATED'],
    confirmedAt: [null, INSTANTS[0], INSTANTS[1]],
    revisionId: ['v1', 'v2'],
    signerRole: ROLES,
  });
  for (const revision of [undefined, 'v1'])
    same(
      m.verifiedSignatureTimes(signatures, revision),
      w.verifiedSignatureTimes(signatures, revision)
    );

  for (const status of CONTRACT_STATUSES)
    for (const hasDoc of [true, false])
      for (const kind of [null, 'DEPOSIT']) {
        const api = {
          getContract: async (id) => ({
            id,
            status: id === 'dep' ? 'ACTIVE' : status,
            agreementKind: id === 'dep' ? 'DEPOSIT' : kind,
            currentRevisionId: 'v1',
            depositAgreementContractId: id === 'dep' ? null : 'dep',
          }),
          getDocuments: async (id) =>
            id === 'dep' || hasDoc ? docs.filter((d) => d.revisionId === 'v1') : [],
          getDocument: async (id) => ({ id }),
        };
        const run = (lib) => lib.loadAgreementPreview('c', api).then(plain, (e) => e.message);
        same(
          await run(M('agreement-preview')),
          await run(W('lib/agreement-preview')),
          `${status} ${hasDoc} ${kind}`
        );
      }
  for (const view of [
    { required: false },
    { required: true, agreement: null },
    { required: true, agreement: { id: 'a' } },
  ])
    for (const fails of [true, false]) {
      const run = async (lib) => {
        const log = [];
        await lib.loadDepositAgreement(
          'r',
          {
            getAgreement: async () => view,
            getSignatureState: async () => {
              if (fails) throw new Error('sig');
              return { ok: 1 };
            },
          },
          {
            agreement: (v) => log.push(['agreement', v]),
            signature: (s) => log.push(['signature', s]),
            signatureError: (e) => log.push(['error', e.message]),
          }
        );
        return plain(log);
      };
      same(await run(M('deposit-agreement-loader')), await run(W('lib/deposit-agreement-loader')));
    }
});

test('contract field state, feature labels, inputs, comparison, meters and blockchain proof', async () => {
  const wf = W('lib/contract-field-state');
  const mf = M('contract-field-state');
  same(mf.fieldStateText, wf.fieldStateText);
  const values = [
    undefined,
    '',
    '1',
    '1.0',
    'Toàn bộ căn',
    '25 m²',
    '25 m2',
    '25,0 mét vuông',
    'PER_MONTH',
    'Theo tháng',
    'tháng',
    'Người / tháng',
    'miễn phí',
    'FREE',
    'một lần',
    'FIXED_ONCE',
    '007',
    '7',
  ];
  const keys = [
    'unitNumber',
    'areaText',
    'featureValue',
    'billingMethod',
    'latePaymentFeeMode',
    'amountValue',
    'accountNumber',
  ];
  const terms = (extra) => ({
    financial: {},
    tenant: {},
    property: {},
    charges: [],
    equipments: [],
    amenities: [],
    policies: {},
    specialTerms: '',
    ...extra,
  });
  for (const key of keys)
    for (const a of values)
      for (const b of values)
        assert.equal(
          mf.amendmentFieldChanged(
            terms({ tenant: { [key]: a } }),
            terms({ tenant: { [key]: b } }),
            'tenant',
            key
          ),
          wf.amendmentFieldChanged(
            terms({ tenant: { [key]: a } }),
            terms({ tenant: { [key]: b } }),
            'tenant',
            key
          ),
          `${key} ${a} ${b}`
        );
  const rows = [
    { code: 'A', quantity: 1 },
    { code: 'B', quantity: 2 },
  ];
  const edited = [
    rows,
    [rows[1], rows[0]],
    [{ code: 'C', quantity: 1 }, rows[1]],
    [rows[0], rows[0]],
    [rows[0], rows[1], { code: 'D' }],
    [],
  ];
  for (const after of edited)
    for (const index of [0, 1, 2])
      for (const group of ['charges', 'property', 'policies']) {
        const wrap = (list) =>
          terms(
            group === 'charges'
              ? { charges: list }
              : group === 'property'
                ? { property: { features: list } }
                : { policies: { listingPolicies: list } }
          );
        assert.equal(
          mf.amendmentFieldChanged(wrap(rows), wrap(after), group, 'quantity', index),
          wf.amendmentFieldChanged(wrap(rows), wrap(after), group, 'quantity', index)
        );
      }
  const money = terms({ financial: { depositAmountNumber: '10.000' } });
  assert.equal(
    mf.amendmentFieldChanged(
      money,
      terms({ financial: { depositAmountValue: '10000' } }),
      'financial',
      'depositAmountValue'
    ),
    false
  );

  const features = [
    'Tình trạng nội thất',
    'Lối đi',
    'Ban công',
    'Giờ giấc sinh hoạt',
    'Chính sách gửi xe',
    'Hướng ban công',
    'Pháp lý',
    'Diện tích phòng',
    'Số phòng ngủ',
    'Mặt tiền',
    'Khác',
  ];
  const raws = [
    null,
    'FULLY_FURNISHED',
    'private',
    'NONE',
    'FREE',
    'SOUTH_EAST',
    'RED_BOOK',
    '25 m²',
    '3,5 m',
    'constructor',
    'abc',
  ];
  for (const name of features)
    for (const raw of raws) {
      assert.equal(
        M('contract-property-feature-labels').contractPropertyFeatureValue(name, raw),
        W('lib/contract-property-feature-labels').contractPropertyFeatureValue(name, raw)
      );
      same(
        M('contract-amendment-input').numericPropertyFeature(name, raw),
        W('lib/contract-amendment-input').numericPropertyFeature(name, raw)
      );
    }
  const wi = W('lib/contract-amendment-input');
  const mi = M('contract-amendment-input');
  same(mi.amendmentNumbers, wi.amendmentNumbers);
  for (const start of ['', '31/01/2026', '2026-11-25'])
    for (const key of ['durationMonths', 'startDateText', 'endDateText', 'other'])
      for (const value of ['', '0', '1', '13', '121', '28/02/2027', '01/01/2020']) {
        const v = { startDateText: start, durationMonths: '12' };
        same(mi.amendmentLeasePatch(v, key, value), wi.amendmentLeasePatch(v, key, value));
        assert.equal(mi.amendmentDateInput(value), wi.amendmentDateInput(value));
      }
  for (const field of ['charges.1.billingMethod', 'rentAmount'])
    for (const text of [
      'Cách tính: PER_MONTH',
      'Giá: 5\nCách tính: UNKNOWN_CODE',
      'Cách tính: Theo tháng',
    ])
      assert.equal(
        M('contract-amendment-comparison').formatAmendmentComparisonText(field, text),
        W('lib/contract-amendment-comparison').formatAmendmentComparisonText(field, text)
      );
  const wm = W('lib/contract-initial-meters');
  const mm = M('contract-initial-meters');
  const readings = [
    '',
    ' ',
    '0',
    '1250.5',
    '1.2345',
    '1.23400',
    '-1',
    '1,5',
    'abc',
    '1000000000001',
    '9'.repeat(21),
  ];
  for (const r of readings)
    for (const required of [true, false])
      assert.equal(
        mm.validateInitialMeterReading(r, required, 'L'),
        wm.validateInitialMeterReading(r, required, 'L'),
        r
      );
  for (const meters of [
    null,
    {},
    { electricityInitial: 5 },
    { electricityInitial: 'x', waterInitial: '2' },
  ])
    for (const e of [true, false])
      for (const wat of [true, false])
        same(
          mm.missingRequiredInitialMeters(meters, e, wat),
          wm.missingRequiredInitialMeters(meters, e, wat)
        );

  const wb = W('lib/contract-blockchain-proof');
  const mb = M('contract-blockchain-proof');
  for (const status of [null, 'PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'])
    assert.equal(mb.blockchainProofPending(status), wb.blockchainProofPending(status));
  for (const parentContractId of [null, 'p'])
    for (const agreementKind of [
      null,
      'LEASE',
      'DEPOSIT',
      'AMENDMENT',
      'RENEWAL',
      'WORKFLOW',
      'X',
    ]) {
      const c = { parentContractId, agreementKind };
      assert.equal(mb.supportsContractProof(c), wb.supportsContractProof(c));
    }
  for (const hash of [null, '0x' + 'a'.repeat(64), '0x12'])
    for (const chain of [1, 11155111])
      assert.equal(
        mb.blockchainTransactionUrl(chain, hash),
        wb.blockchainTransactionUrl(chain, hash)
      );
  const file = (size, bytes = new Uint8Array([1, 2, 3])) => ({
    size,
    arrayBuffer: async () => bytes.buffer,
  });
  assert.equal(await mb.hashPdfForProof(file(3)), await wb.hashPdfForProof(file(3)));
  for (const size of [0, 20 * 1024 * 1024 + 1]) {
    const message = await wb.hashPdfForProof(file(size)).catch((e) => e.message);
    await assert.rejects(mb.hashPdfForProof(file(size)), { message });
  }
});

test('getApiErrorMessage priority equals the web', () => {
  const w = W('utils/apiError').getApiErrorMessage;
  const m = M('apiError').getApiErrorMessage;
  const http = (data) =>
    Object.assign(new Error('axios message'), { isAxiosError: true, response: { data } });
  for (const error of [
    null,
    'x',
    new Error('plain'),
    new Error(''),
    http(undefined),
    http({}),
    http({ errors: [{ field: 'a', message: 'b' }, { message: 'c' }], message: 'm' }),
    http({ errors: [], message: ' m ' }),
    http({ detail: ' d ' }),
    http({ detail: [{ msg: 'x' }, {}] }),
  ]) {
    assert.equal(m(error), w(error));
    assert.equal(m(error, 'fallback'), w(error, 'fallback'));
  }
});

// ---------------------------------------------------------------- logic cut out of web .tsx files

test('contract list rules (ContractListView.tsx)', () => {
  const w = evalWeb(
    cut(
      'components/contract/ContractListView.tsx',
      '/** Sign-state of the contract',
      'export default function ContractListView'
    ),
    '{ turnOf, primaryAction, hint, GROUPS, groupOf }',
    {
      contractDetailPath: W('lib/contract-routes').contractDetailPath,
      invoiceDetailPath: W('lib/contract-routes').invoiceDetailPath,
    }
  );
  const m = M('ContractListView');
  for (const c of product({
    status: CONTRACT_STATUSES,
    perspective: ['landlord', 'tenant'],
    agreementKind: [null, 'DEPOSIT'],
  })) {
    const contract = { id: 'c1', status: c.status, agreementKind: c.agreementKind };
    const turn = w.turnOf(contract, c.perspective);
    assert.equal(m.turnOf(contract, c.perspective), turn);
    assert.equal(m.groupOf(turn), w.groupOf(turn));
    assert.equal(m.hint(contract, c.perspective, turn), w.hint(contract, c.perspective, turn));
    const expected = w.primaryAction(contract, c.perspective, turn);
    const actual = m.primaryAction(contract, c.perspective, turn);
    same({ ...actual, href: toWebPath(actual.href) }, expected, json(c));
  }
  for (const kind of ['LEASE', 'DEPOSIT'])
    same(
      m.GROUPS.map((g) => [g.id, g.label(kind)]),
      w.GROUPS.map((g) => [g.id, g.label(kind)])
    );
});

const amendmentRel = 'components/contract/detail/ContractAmendmentWorkspace.tsx';
const webAmendment = () => {
  const top = evalWeb(
    cut(amendmentRel, 'const empty: AmendmentTerms', 'function useWorkspaceState').replace(
      'export const activeAmendment',
      'const activeAmendment'
    ),
    '{ activeAmendment, restoreTerms, scheduledSource, empty }'
  );
  const memoBody = cut(
    amendmentRel,
    '    if (!data || !editing) return {};',
    '  }, [data, editing, values, previousId, listingSourceVersion]);'
  );
  const changes = evalWeb(
    `function f(data, editing, values, previousId, listingSourceVersion) {\n${memoBody}\n}`,
    'f'
  );
  const derived = evalWeb(
    `function f(data, previousId, changes, values, initialValues, listingSourceVersion, listingSync, scheduledSource) {
      const useMemo = (fn) => fn();
      ${cut(amendmentRel, '  const replacement = scheduledSource', '  const payload = (validate = true)')}
      return { replacement, hasChanges, changedGroupCount, financial };
    }`,
    'f'
  );
  const payload = evalWeb(
    `function f(ctx, validate) {
      const { data, listingSourceVersion, listingSync, changes, changedFields, hasChanges, reason, effectiveOn, replacement,
        requestId, draftBase, previousId, tenantRequestId, evidenceIds, document } = ctx;
      ${cut(amendmentRel, '  const payload = (validate = true)', '  const stop = () =>')}
      return payload(validate);
    }`,
    'f'
  );
  return { ...top, changes, derived, payload };
};

const currentTerms = () => ({
  landlord: { fullName: 'A', phone: '0901234567' },
  tenant: { fullName: 'B', occupantCount: 2, motorbikeCount: 1 },
  property: {
    areaText: '25 mét vuông',
    features: [{ featureName: 'Ban công', featureValue: 'PRIVATE' }],
  },
  financial: {
    amountValue: 5000000,
    amountNumber: '5.000.000',
    depositAmountValue: 10000000,
    paymentDueDay: 5,
  },
  lease: { durationMonths: 12 },
  charges: [{ chargeType: 'ELECTRICITY', billingMethod: 'PER_KWH', unitAmount: 3500 }],
  equipments: [{ name: 'Giường', quantity: 1 }],
  amenities: [],
  policies: {
    latePaymentFeeMode: 'NONE',
    latePaymentFeeAmount: 0,
    latePaymentFeeGraceDays: 0,
    listingPolicies: [],
  },
  specialTerms: 'Gốc',
});

test('amendment restore/change detection is JSON-identical to the web, key order included', () => {
  const w = webAmendment();
  const m = M('ContractAmendmentWorkspace');
  same(m.empty, w.empty);
  same([...m.activeAmendment], [...w.activeAmendment]);
  const changeSets = [
    {},
    { rentAmount: '6000000', freeForm: true },
    { occupantCount: 3, carCount: 1 },
    { charges: [] },
    { equipments: [{ name: 'Tủ' }], amenities: [{ name: 'Wifi' }] },
    {
      fields: {
        financial: { paymentDueDay: 9, depositAmountValue: 1 },
        policies: { latePaymentFeeCap: 5, latePaymentFeeMode: 'FIXED_ONCE', billingRules: 'x' },
        tenant: { phone: '1' },
        lease: { durationMonths: 24 },
        property: { areaText: '30' },
        landlord: { phone: '2' },
        unknown: { a: 1 },
      },
    },
    {
      policies: { petPolicy: 'no', latePaymentFeeGraceDays: 9 },
      policyRows: [{ code: 'a', label: 'A', text: 't' }],
    },
    { specialTerms: 'Mới', additionalTerms: 'Thêm', featureRows: [{ featureName: 'X' }] },
    { listingSourceVersion: 'lv1' },
  ];
  // The edits a user can make, including a re-ordered key set, which JSON.stringify must see as a change.
  const edits = [
    (t) => t,
    (t) => {
      t.financial.amountValue = '5000000';
      return t;
    },
    (t) => {
      t.financial.amountValue = '6000000';
      return t;
    },
    (t) => {
      t.tenant.occupantCount = '2';
      t.tenant.carCount = 0;
      return t;
    },
    (t) => {
      t.tenant.carCount = 1;
      t.tenant.fullName = 'C';
      return t;
    },
    (t) => {
      t.charges = [{ billingMethod: 'PER_KWH', chargeType: 'ELECTRICITY', unitAmount: 3500 }];
      return t;
    },
    (t) => {
      t.policies = {
        ...t.policies,
        petPolicy: 'x',
        latePaymentFeeMode: 'FIXED_PER_DAY',
        latePaymentFeeAmount: 1000,
      };
      return t;
    },
    (t) => {
      t.policies = { ...t.policies, petPolicy: 'x' };
      return t;
    },
    (t) => {
      t.financial = { ...t.financial, paymentDueDay: 9, amountWords: 'x', depositAmountValue: 1 };
      return t;
    },
    (t) => {
      t.specialTerms = 'Khác';
      t.landlord = { ...t.landlord, email: 'a@b' };
      t.lease = { durationMonths: 6 };
      return t;
    },
    (t) => {
      t.equipments = [];
      t.property = { ...t.property, areaText: '31' };
      return t;
    },
  ];
  const scheduled = (changes) => [
    { id: 's1', status: 'SCHEDULED', effectiveOn: '2027-01-01', changes },
    { id: 'p2', status: 'REJECTED', previousProposalId: 's1', changes: {} },
    { id: 'loop', status: 'REJECTED', previousProposalId: 'loop', changes: {} },
  ];
  let compared = 0;
  for (const changeSet of changeSets) {
    const base = { ...currentTerms(), meters: undefined };
    const restored = m.restoreTerms(base, structuredClone(changeSet));
    same(restored, w.restoreTerms(base, structuredClone(changeSet)), json(changeSet));
    assert.deepEqual(
      Object.keys(restored),
      Object.keys(w.restoreTerms(base, structuredClone(changeSet)))
    );
    for (const previousId of [undefined, 's1', 'p2', 'loop', 'missing']) {
      const proposals = scheduled(changeSet);
      same(m.scheduledSource(proposals, previousId), w.scheduledSource(proposals, previousId));
      for (const edit of edits) {
        const data = { currentTerms: currentTerms(), proposals, availableDates: ['2027-01-01'] };
        const initialValues = JSON.stringify(w.restoreTerms(data.currentTerms, changeSet));
        for (const start of [
          () => currentTerms(),
          () => plain(w.restoreTerms(currentTerms(), changeSet)),
        ]) {
          const values = edit(start());
          for (const version of [undefined, 'lv1', 'lv2']) {
            const expected = w.changes(data, true, values, previousId, version);
            const actual = m.amendmentChanges(data, true, values, previousId, version);
            same(actual, expected, 'changes');
            const listingSync = version
              ? { differences: [{ field: version === 'lv1' ? 'charges.0' : 'amenities' }] }
              : null;
            const web = w.derived(
              data,
              previousId,
              expected,
              values,
              initialValues,
              version,
              listingSync,
              w.scheduledSource
            );
            const replacement = m.scheduledSource(proposals, previousId);
            same(replacement, web.replacement);
            assert.equal(
              m.amendmentHasChanges(actual, replacement, values, initialValues, version),
              web.hasChanges
            );
            assert.equal(
              m.amendmentChangedGroupCount(actual, replacement, values, initialValues),
              web.changedGroupCount
            );
            assert.equal(m.amendmentFinancial(actual, listingSync), web.financial);
            compared++;
          }
        }
      }
    }
  }
  assert.ok(compared > 2000);
  same(m.amendmentChanges({ currentTerms: currentTerms() }, false, currentTerms()), {});

  for (const c of product({
    data: [null, { availableDates: ['2027-01-01'] }],
    listingSourceVersion: [undefined, 'lv'],
    listingSync: [null, {}],
    changes: [{}, { rentAmount: '1' }, { charges: [] }, { fields: { financial: { a: 1 } } }],
    hasChanges: [true, false],
    reason: ['ngắn', '  lý do đủ mười ký tự  '],
    effectiveOn: ['', '2027-01-01'],
    replacement: [undefined, { effectiveOn: '2027-02-01' }],
    invalid: [false, true],
    validate: [true, false],
  })) {
    const shared = {
      requestId: 'req',
      previousId: 'prev',
      tenantRequestId: undefined,
      evidenceIds: ['e'],
    };
    const expected = outcome(() =>
      w.payload(
        {
          ...c,
          ...shared,
          changedFields: c.changes.fields,
          draftBase: { current: 'rev' },
          requestId: { current: 'req' },
          document: { querySelector: () => (c.invalid ? { reportValidity() {} } : null) },
        },
        c.validate
      )
    );
    const actual = outcome(() =>
      m.amendmentPayload(
        { ...c, ...shared, baseRevisionId: 'rev', hasInvalidInput: c.invalid },
        c.validate
      )
    );
    same(actual, expected, json(c));
  }
});

test('amendmentStart reproduces the web start()', () => {
  const w = webAmendment();
  const m = M('ContractAmendmentWorkspace');
  const startSource = cut(
    amendmentRel,
    '  const start = (previous?: AmendmentProposal',
    '  const changes = useMemo'
  );
  const webStart = evalWeb(
    `function f(data, previous, draft, source, restoreTerms, scheduledSource) {
      const out = {}; const perspective = "landlord";
      const toast = { error: (m) => { out.error = m; } };
      const set = (k) => (v) => { out[k] = v; };
      const setValues = set("values"), setListingSourceVersion = set("listingSourceVersion"), setListingSync = () => {},
        setEditingFinancial = set("editingFinancial"), setInitialValues = set("initialValues"), setReason = set("reason"),
        setEffectiveOn = set("effectiveOn"), setPreviousId = set("previousId"), setTenantRequestId = set("tenantRequestId"),
        setEvidenceIds = set("evidenceIds"), setFiles = () => {}, setEditing = () => {};
      const draftBase = {}, requestId = {}, editingRef = {}, document = { getElementById: () => null };
      const crypto = { randomUUID: () => "id" }; const contractService = { previewListingSync: () => new Promise(() => {}) };
      const contractId = "c";
      ${startSource}
      start(previous, draft, source);
      return out;
    }`,
    'f'
  );
  const proposals = [
    {
      id: 's1',
      status: 'SCHEDULED',
      effectiveOn: '2027-01-01',
      changes: { rentAmount: '1' },
      reason: 'cũ',
      evidenceIds: ['a'],
    },
    { id: 't1', status: 'TENANT_ACCEPTED', changes: {}, reason: 'khách' },
    {
      id: 'r1',
      status: 'REJECTED',
      effectiveOn: '2027-03-01',
      immediateEffect: true,
      previousProposalId: 's1',
      changes: { fields: { financial: {} }, listingSourceVersion: 'lv' },
      reason: 'r',
    },
  ];
  const data = {
    currentTerms: currentTerms(),
    currentTermsRevisionId: 'rev',
    availableDates: ['2027-05-01'],
    proposals,
  };
  const drafts = [
    undefined,
    { baseRevisionId: 'old', changes: {} },
    { baseRevisionId: 'rev', tenantRequestId: 'nope', changes: {} },
    {
      baseRevisionId: 'rev',
      tenantRequestId: 't1',
      previousProposalId: 's1',
      changes: { charges: [] },
      reason: 'nháp',
      effectiveOn: null,
      evidenceIds: [],
    },
  ];
  for (const previous of [undefined, ...proposals])
    for (const draft of drafts)
      for (const source of [undefined, proposals[1]]) {
        const expected = webStart(data, previous, draft, source, w.restoreTerms, w.scheduledSource);
        const actual = m.amendmentStart(data, previous, draft, source);
        if (expected.error) assert.equal(actual.error, expected.error);
        else
          for (const key of Object.keys(actual).filter((k) => k !== 'error'))
            same(actual[key], expected[key], key);
      }
});

test('amendment labels and comparison cells (ContractAmendmentPanel.tsx)', () => {
  const rel = 'components/contract/detail/ContractAmendmentPanel.tsx';
  const labels = evalWeb(
    cut(rel, 'const labels:', 'export function AmendmentComparisonTable'),
    'labels'
  );
  const value = evalWeb(
    cut(rel, '  const value = (r: AmendmentComparison', '  return <>'),
    'value',
    {
      money: (v) => Number(v || 0).toLocaleString('vi-VN') + ' đ',
      formatAmendmentComparisonText: W('lib/contract-amendment-comparison')
        .formatAmendmentComparisonText,
    }
  );
  const m = M('ContractAmendmentPanel');
  same(m.labels, labels);
  for (const field of [
    'rentAmount',
    'financial.depositAmountValue',
    'policies.latePaymentFeeAmount',
    'policies.latePaymentFeeCap',
    'policies.latePaymentFeeMode',
    'policies.latePaymentFeeGraceDays',
    'charges.a',
    'other',
  ])
    for (const v of ['0', '5000000', '12.5', 'abc', 'NONE', 'FIXED_ONCE', 'Cách tính: PER_KWH'])
      assert.equal(m.comparisonValue({ field }, v), value({ field }, v), `${field} ${v}`);
});

test('constant label tables equal the ones inside web .tsx files', () => {
  const table = (rel, from, to, name) => evalWeb(cut(rel, from, to), name);
  const detail = 'components/contract/detail/';
  const lifecycle = evalWeb(
    cut(`${detail}ContractLifecyclePanel.tsx`, 'const renewalLabels', 'type DeductionDraft'),
    '{ renewalLabels, closureLabels, eventLabels }'
  );
  const ml = M('ContractLifecyclePanel');
  for (const key of Object.keys(lifecycle)) same(ml[key], lifecycle[key], key);
  same(
    M('PaymentExtensionPanel').statuses,
    table(`${detail}PaymentExtensionPanel.tsx`, 'const statuses', 'const field', 'statuses')
  );
  same(
    M('OverdueActionsPanel').labels,
    table(`${detail}OverdueActionsPanel.tsx`, 'const labels', 'const dateTime', 'labels')
  );
  same(
    M('DepositLedgerSummary').labels,
    table('components/payment/DepositLedgerSummary.tsx', 'const labels', 'export default', 'labels')
  );
  same(
    M('DepositAgreementPanel').labels,
    table(
      'components/rental-request/DepositAgreementPanel.tsx',
      'const labels',
      'export default',
      'labels'
    )
  );
  const onboarding = 'components/rental-request/RentalOnboardingPanel.tsx';
  same(
    M('RentalOnboardingPanel').HISTORY_ACTIONS,
    table(onboarding, 'const HISTORY_ACTIONS', '/** Parts of the panel', 'HISTORY_ACTIONS')
  );
  for (const forfeit of [true, false]) {
    const rows = evalWeb(
      `const forfeit = ${forfeit};\n${cut(onboarding, '  const rows = [', '  return <section aria-label="Quy tắc hủy"')}`,
      'rows'
    );
    same(M('RentalOnboardingPanel').cancelRules(forfeit), rows);
  }
  const obligations = evalWeb(
    '',
    cut(
      'components/rental-request/DepositAgreementPanel.tsx',
      '({RESERVATION_PENDING',
      ' as Record<string,string>)'
    ) + ')'
  );
  for (const [code, label] of Object.entries(obligations))
    assert.equal(M('DepositAgreementPanel').obligationLabel(code), label);
  assert.equal(M('DepositAgreementPanel').obligationLabel('NEW'), 'Đang được theo dõi');
  const charges = evalWeb(
    cut(`${detail}ContractChargesSection.tsx`, 'const BILLING_METHOD_LABELS', 'export default'),
    '{ BILLING_METHOD_LABELS, formatBillingMethod }'
  );
  const mc = M('ContractChargesSection');
  same(mc.BILLING_METHOD_LABELS, charges.BILLING_METHOD_LABELS);
  for (const v of [undefined, '', 'per_kwh', ' FREE ', 'Khác'])
    assert.equal(mc.formatBillingMethod(v), charges.formatBillingMethod(v));
  const handover = evalWeb(
    cut(
      `${detail}ContractEquipmentSection.tsx`,
      'const HANDOVER_CONDITION_CONFIG',
      'export default'
    ),
    'formatHandoverCondition'
  );
  for (const v of [
    null,
    '',
    'BRAND_NEW',
    'good',
    'NORMAL — xước nhẹ',
    'MINOR_DAMAGE: nứt',
    'USED_ACCEPTABLE-ok',
    'Còn rất tốt',
    'Hư hỏng nặng',
    'khác',
  ])
    assert.equal(
      M('ContractEquipmentSection').formatHandoverCondition(v).label,
      handover(v).label,
      String(v)
    );
});

test('late fee preview (ContractPoliciesSection.tsx)', () => {
  const rel = 'components/contract/detail/ContractPoliciesSection.tsx';
  const body = cut(
    rel,
    '  const feeAfterDays = (lateDays: number) => {',
    '  const depositRefundDays'
  );
  const webFee = evalWeb(
    `function f(lateMode, savedFeeAmount, savedGraceDays, savedFeeCap, days) {\n${body}\nreturn feeAfterDays(days);\n}`,
    'f'
  );
  for (const c of product({
    mode: ['NONE', 'FIXED_ONCE', 'FIXED_PER_DAY'],
    amount: [0, 50000],
    grace: [0, 3],
    cap: [0, 120000],
    days: [0, 1, 3, 4, 8, 30],
  }))
    assert.equal(
      M('ContractPoliciesSection').feeAfterDays(
        {
          latePaymentFeeMode: c.mode,
          latePaymentFeeAmount: c.amount,
          latePaymentFeeGraceDays: c.grace,
          latePaymentFeeCap: c.cap,
        },
        c.days
      ),
      webFee(c.mode, c.amount, c.grace, c.cap, c.days),
      json(c)
    );
});

test('draft editor values, patch, document readiness, flags and PATCH body (ContractDetailView.tsx)', () => {
  const m = M('ContractDetailView');
  const draftWeb = evalWeb(
    cut(
      'components/contract/detail/ContractDraftEditor.tsx',
      'export function draftEditorValues',
      'export function draftContentPatch'
    ) +
      read('components/contract/detail/ContractDraftEditor.tsx').slice(
        read('components/contract/detail/ContractDraftEditor.tsx').indexOf(
          'export function draftContentPatch'
        )
      ),
    '{ draftEditorValues: exports.draftEditorValues, draftContentPatch: exports.draftContentPatch }'
  );
  const md = M('ContractDraftEditor');
  for (const revision of [
    null,
    {},
    { landlord: { phone: '1' }, tenant: { a: 1 }, additionalTerms: 'x', charges: [{}] },
  ]) {
    same(md.draftEditorValues(revision), draftWeb.draftEditorValues(revision));
    const base = draftWeb.draftEditorValues(revision);
    for (const edits of [
      {},
      { landlord: { phone: '1' } },
      { landlord: { phone: '2' }, tenant: { a: 1, b: 2 } },
      { charges: [] },
    ])
      same(md.draftContentPatch(base, edits), draftWeb.draftContentPatch(base, edits));
  }

  const rel = 'components/contract/ContractDetailView.tsx';
  const useMemo = (fn) => fn();
  const docsSource = cut(rel, '  const latestDoc = useMemo', '  const draftCharges = useMemo');
  const webDocs = evalWeb(
    `function f(contract, documents, currentPreview, revision, signatureState, useMemo) {\n${docsSource}\nreturn { latestDoc, hasReadyCurrentDocument };\n}`,
    'f'
  );
  for (const c of product({
    status: ['DRAFT', 'ACTIVE'],
    parent: [null, 'p'],
    mode: [undefined, 'SMARTCA', 'INTERNAL'],
    preview: [null, 'd1', 'd2'],
    type: ['PDF', 'DOCX'],
    purpose: ['SIGNED_FINAL', 'PREVIEW'],
    viewUrl: [undefined, 'u'],
  })) {
    const revision = { id: 'v' };
    const documents = [
      {
        id: 'd1',
        revisionId: 'v',
        status: 'READY',
        documentType: c.type,
        purpose: c.purpose,
        storageObjectId: 's',
        viewUrl: c.viewUrl,
      },
      {
        id: 'd2',
        revisionId: 'old',
        status: 'READY',
        documentType: 'PDF',
        purpose: 'OFFICIAL',
        viewUrl: 'u',
      },
    ];
    const contract = { status: c.status, parentContractId: c.parent };
    const currentPreview = c.preview
      ? { id: c.preview, revisionId: c.preview === 'd1' ? 'v' : 'old' }
      : null;
    const expected = webDocs(
      contract,
      structuredClone(documents),
      currentPreview,
      revision,
      { signatureMode: c.mode },
      useMemo
    );
    same(
      m.latestDoc(structuredClone(documents), c.status, currentPreview, 'v'),
      expected.latestDoc,
      json(c)
    );
    assert.equal(
      m.hasReadyCurrentDocument({
        documents,
        revision,
        contract,
        currentPreview,
        signatureMode: c.mode,
      }),
      expected.hasReadyCurrentDocument,
      json(c)
    );
  }

  const meterSource = cut(
    rel,
    '  const electricityRequired = useMemo',
    '  const metersDirty = Boolean'
  );
  const webMeters = evalWeb(
    `function f(draftCharges, useMemo) {\n${meterSource}\nreturn { electricityRequired, waterRequired, isWaterPerPerson };\n}`,
    'f'
  );
  const options = [
    { chargeType: 'ELECTRICITY', billingMethod: 'PER_KWH' },
    { chargeType: 'WATER', billingMethod: 'PER_M3' },
    { chargeType: 'WATER', billingMethod: 'STATE_WATER_RATE' },
    { chargeType: 'WATER', billingMethod: 'PER_PERSON_MONTH' },
    { chargeType: 'ELECTRICITY', billingMethod: 'PER_MONTH' },
  ];
  for (let mask = 0; mask < 32; mask++) {
    const charges = options.filter((_, i) => mask & (1 << i));
    same(m.draftMeterRules(charges), webMeters(charges, useMemo));
  }

  const stateSource = cut(
    rel,
    '  const metersDirty = Boolean',
    '  // Field errors are shown in the content tab'
  );
  const webState = evalWeb(
    `function f(revision, electricityInitial, waterInitial, isWaterPerPerson, draftPolicy, draftEdits, perspective, isLandlord, contract, signatureState, onboarding, draftConflict, listingSyncPreview, useMemo, draftEditorValues, draftContentPatch) {
      ${stateSource}
      return { metersDirty, draftFields, feeDirty, termsDirty, draftContent, draftDirty, signatureLocked, reviewLocked };
    }`,
    'f'
  );
  const payloadSource = cut(
    rel,
    '        const payload: UpdateContractRevisionRequest',
    '        targetRevision = await contractService.updateRevision'
  );
  const webPayload = evalWeb(
    `function f(revision, electricityInitial, waterInitial, isWaterPerPerson, s, source) {
      const { metersDirty, termsDirty, feeDirty, draftFields, draftContent } = s;
      ${payloadSource}
      return payload;
    }`,
    'f'
  );
  const validationSource = cut(
    rel,
    '      const errors = {\n        electricity: validateInitialMeterReading',
    '      const form = document.getElementById'
  );
  const webValidate = evalWeb(
    `function f(electricityInitial, waterInitial, electricityRequired, waterRequired, isWaterPerPerson, draftFields, draftContent, validateInitialMeterReading, VIETNAMESE_PHONE_REGEX) {
      let feeError; const setMeterErrors = () => {}; const setFeeError = (v) => { feeError = v; };
      ${validationSource}
      return { errors, feeError, invalidPhone, invalidFee };
    }`,
    'f'
  );
  const phone = /^0(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  for (const c of product({
    electricity: ['', '5', 'x'],
    water: ['', '7 '],
    perPerson: [true, false],
    policy: [
      {},
      { feeMode: 'NONE' },
      { feeMode: 'FIXED_ONCE', feeAmount: '0' },
      { feeMode: 'FIXED_PER_DAY', feeAmount: '5000' },
      { additionalTerms: ' mới ' },
    ],
    edits: [{}, { landlord: { phone: '0901234567' } }, { tenant: { phone: '123' } }],
    revision: [
      { id: 'v', meters: { electricityInitial: 5 }, policies: {} },
      {
        id: 'v',
        policies: { latePaymentFeeMode: 'FIXED_ONCE', latePaymentFeeAmount: 5000 },
        additionalTerms: 'cũ',
      },
    ],
  })) {
    const s = webState(
      c.revision,
      c.electricity,
      c.water,
      c.perPerson,
      c.policy,
      c.edits,
      'landlord',
      true,
      { status: 'DRAFT' },
      null,
      null,
      false,
      null,
      useMemo,
      draftWeb.draftEditorValues,
      draftWeb.draftContentPatch
    );
    const draftContent = md.draftContentPatch(md.draftEditorValues(c.revision), c.edits);
    same(draftContent, s.draftContent);
    const form = {
      revision: c.revision,
      electricityInitial: c.electricity,
      waterInitial: c.water,
      draftPolicy: c.policy,
      draftContent,
      isWaterPerPerson: c.perPerson,
    };
    const state = m.draftState(form);
    same(
      state,
      {
        metersDirty: s.metersDirty,
        draftFields: s.draftFields,
        feeDirty: s.feeDirty,
        termsDirty: s.termsDirty,
      },
      json(c)
    );
    assert.equal(m.isDraftDirty(true, state, draftContent, null), s.draftDirty);
    for (const source of [null, { sourceVersion: 'lv' }])
      same(
        m.draftRevisionPayload(form, source),
        webPayload(c.revision, c.electricity, c.water, c.perPerson, s, source),
        json(c)
      );
    for (const required of [true, false]) {
      const expected = webValidate(
        c.electricity,
        c.water,
        required,
        required,
        c.perPerson,
        s.draftFields,
        draftContent,
        W('lib/contract-initial-meters').validateInitialMeterReading,
        phone
      );
      const actual = m.validateDraft({
        electricityInitial: c.electricity,
        waterInitial: c.water,
        electricityRequired: required,
        waterRequired: required,
        isWaterPerPerson: c.perPerson,
        draftFields: s.draftFields,
        draftContent,
      });
      same(actual.errors, expected.errors);
      assert.equal(actual.feeError, expected.feeError);
      assert.equal(actual.invalidPhone, expected.invalidPhone);
      const failed =
        expected.errors.electricity ||
        expected.errors.water ||
        expected.invalidFee ||
        expected.invalidPhone;
      assert.equal(actual.section !== null, Boolean(failed));
    }
  }
  // :273-275
  assert.equal(m.isSignatureLocked({ landlordConfirmedAt: 'x' }, null), true);
  assert.equal(m.isSignatureLocked({}, { allRequests: [{ status: 'EXPIRED' }] }), false);
  assert.equal(m.isSignatureLocked({}, { allRequests: [{ status: 'EMBEDDING' }] }), true);
  assert.equal(m.isReviewLocked(false, false, 'CANCELLATION_REFUND_PENDING'), true);
  assert.equal(m.isDraftConflictError({ response: { data: { code: 6072 } } }), true);
  assert.equal(m.isPreActive({ status: 'ACTIVE', agreementKind: 'DEPOSIT' }), true);
  assert.equal(m.isPreActive({ status: 'ACTIVE' }), false);
});

test('rental request form (RentalRequestModal.tsx)', () => {
  const rel = 'components/rental-request/RentalRequestModal.tsx';
  const m = M('RentalRequestModal');
  const useMemo = (fn) => fn();
  const options = evalWeb(
    `function f(minimumLeaseMonths, useMemo) {\n${cut(rel, '  const quickLeaseOptions = useMemo', '  // Reset or initialize when modal opens')}\nreturn { quickLeaseOptions, formatLeaseLabel, formatDetailedDuration };\n}`,
    'f'
  );
  for (const min of [undefined, 0, 1, 6, 7, 12, 13, 18, 24, 25, 36, 60]) {
    const w = options(min, useMemo);
    same(m.quickLeaseOptions(min), w.quickLeaseOptions);
    for (let n = -1; n <= 61; n++) {
      assert.equal(m.formatLeaseLabel(n), w.formatLeaseLabel(n));
      assert.equal(m.formatDetailedDuration(n), w.formatDetailedDuration(n));
    }
  }
  const webDeposit = evalWeb(
    `function f(listingPrice, depositType, listingDepositAmount, depositMonths, customDepositInput, useMemo) {\n${cut(rel, '  const depositInfo = useMemo', '  // Backend Estimate Fetching')}\nreturn depositInfo;\n}`,
    'f'
  );
  for (const c of product({
    listingPrice: [undefined, 5_000_000],
    depositType: [undefined, 'NONE', 'MONTH_COUNT', 'FIXED_AMOUNT', 'NEGOTIABLE'],
    listingDepositAmount: [null, 0, 3000],
    depositMonths: [null, 0, 2],
    customDepositInput: ['', '1.500.000', 'abc'],
  }))
    same(
      m.depositInfo(c),
      webDeposit(
        c.listingPrice ?? 0,
        c.depositType,
        c.listingDepositAmount,
        c.depositMonths,
        c.customDepositInput,
        useMemo
      ),
      json(c)
    );

  const clampSource = cut(
    rel,
    '            // Tự động reset hoặc clamp',
    '          }\n        })\n        .catch'
  );
  const webClamp = evalWeb(
    `function f(res, occupantCount, motorbikeCount, carCount) {
      const out = { occupantCount, motorbikeCount, carCount };
      const apply = (key) => (v) => { out[key] = typeof v === "function" ? v(out[key]) : v; };
      const setOccupantCount = apply("occupantCount"), setMotorbikeCount = apply("motorbikeCount"), setCarCount = apply("carCount");
      ${clampSource}
      return out;
    }`,
    'f'
  );
  for (const c of product({
    allowed: [true, false],
    carAllowed: [true, false],
    available: [0, 1, 5],
    limit: [null, 2, 10],
    occupantCount: [1, 3, 6],
    motorbikeCount: [0, 2, 6],
    carCount: [0, 4],
  })) {
    const res = {
      motorbike: { allowed: c.allowed, available: c.available },
      car: { allowed: c.carAllowed, available: c.available },
      occupantLimit: c.limit,
    };
    same(
      m.clampAfterEstimate(res, c),
      webClamp(res, c.occupantCount, c.motorbikeCount, c.carCount),
      json(c)
    );
  }

  const validationSource = cut(
    rel,
    '    if(!reservationPolicyAccepted || !reservationPolicy) {',
    '    setIsSubmitting(true);'
  ).replace(
    /toast\.error\(([\s\S]*?)\);\n      return;/g,
    (_, message) => `return (${message.trim().replace(/,$/, '')});`
  );
  const { isBefore, startOfDay } = require('date-fns');
  const webValidate = evalWeb(
    `function f(ctx) {
      const { reservationPolicyAccepted, reservationPolicy, moveInDate, loadingEstimate, estimateError, estimate, leaseMonths,
        minimumLeaseMonths, occupantCount, occupantLimit, motorbikeCount, carCount, renterName, renterPhone } = ctx;
      ${validationSource}
      return null;
    }`,
    'f',
    { isBefore, startOfDay }
  );
  const estimate = {
    paymentPlan: {},
    motorbike: { allowed: true, available: 1 },
    car: { allowed: true, available: 1 },
  };
  const good = {
    reservationPolicyAccepted: true,
    reservationPolicy: { version: '1' },
    moveInDate: new Date(Date.now() + 86_400_000),
    loadingEstimate: false,
    estimateError: null,
    estimate,
    leaseMonths: 12,
    minimumLeaseMonths: 6,
    occupantCount: 2,
    occupantLimit: 4,
    motorbikeCount: 1,
    carCount: 0,
    renterName: 'A',
    renterPhone: '09',
  };
  const bad = {
    reservationPolicyAccepted: false,
    reservationPolicy: null,
    moveInDate: null,
    loadingEstimate: true,
    estimateError: 'e',
    estimate: { ...estimate, paymentPlan: null },
    leaseMonths: 0,
    occupantCount: 1.5,
    occupantLimit: 1,
    motorbikeCount: 2,
    carCount: 2,
    renterName: ' ',
    renterPhone: ' ',
  };
  const variants = [
    good,
    ...Object.entries(bad).map(([k, v]) => ({ ...good, [k]: v })),
    { ...good, moveInDate: new Date(2020, 0, 1) },
    { ...good, leaseMonths: 3 },
    { ...good, minimumLeaseMonths: 24 },
    { ...good, moveInDate: new Date() },
  ];
  // Pairs of failures pin the check order.
  for (const a of variants)
    for (const [key, value] of Object.entries(bad)) {
      const form = { ...a, [key]: value };
      assert.equal(m.validateRentalRequest(form), webValidate(form), key);
    }

  const input = {
    listingId: 'l',
    moveInDate: new Date(2026, 10, 26),
    leaseMonths: 12,
    occupantCount: 2,
    motorbikeCount: 5,
    carCount: -1,
    deposit: { isNegotiable: false, amount: 7 },
  };
  // :279-280 and :296-304
  assert.equal(m.estimateKey(input), '["l","2026-11-26",12,2,5,-1,false,7]');
  same(m.estimateRequest(input), {
    listingId: 'l',
    moveInDate: '2026-11-26',
    leaseMonths: 12,
    occupantCount: 2,
    motorbikeCount: 2,
    carCount: 0,
  });
  // :455-470
  same(
    m.createRentalRequestBody({
      ...input,
      renterName: ' A ',
      renterPhone: ' 09 ',
      renterEmail: ' ',
      renterNote: '',
      estimate: { depositAmount: 9 },
      deposit: { isNegotiable: true, amount: 7 },
      reservationPolicyAccepted: true,
      reservationPolicyVersion: 'v3',
    }),
    {
      listingId: 'l',
      moveInDate: '2026-11-26',
      leaseMonths: 12,
      occupantCount: 2,
      motorbikeCount: 2,
      carCount: -1,
      renterName: 'A',
      renterPhone: '09',
      depositAmount: 9,
      negotiatedDepositAmount: 9,
      reservationPolicyAccepted: true,
      reservationPolicyVersion: 'v3',
    }
  );
  assert.equal(m.defaultLeaseMonths(6), 12);
  assert.equal(m.defaultLeaseMonths(24), 24);
});

test('list loading merges the three cancelled statuses (useRentalRequestList.ts)', async () => {
  const rel = 'components/rental-request/useRentalRequestList.ts';
  const make = () => {
    const calls = [];
    const fetch = (who) => async (query) => {
      calls.push([who, query.status, query.page, query.size]);
      const rows = Array.from({ length: Math.min(query.size, 11) }, (_, i) => ({
        id: `${query.status}${i}`,
        createdAt: `2026-11-${String(28 - ((i * 2 + query.status.length) % 27)).padStart(2, '0')}`,
      }));
      return { result: rows, totalElements: 11, totalPages: 2 };
    };
    return { calls, api: { getMyRequests: fetch('my'), getOwnerRequests: fetch('owner') } };
  };
  for (const mode of ['RECEIVED', 'SENT'])
    for (const filter of ['ALL', 'PENDING', 'CANCELLED'])
      for (const page of [1, 2, 5]) {
        const a = make();
        const b = make();
        const webLoad = evalWeb(
          cut(rel, 'const CANCELLED_STATUSES', '/** List state of the rental-request page'),
          'loadPage',
          { rentalRequestService: a.api }
        );
        same(
          await M('useRentalRequestList').loadPage(b.api, mode, filter, page),
          await webLoad(mode, filter, page)
        );
        same(b.calls, a.calls);
      }

  // :43-65 — an old foreground result never overwrites a fresher silent one; a stale filter never applies.
  const tickets = M('useRentalRequestList').createListTickets();
  const first = tickets.start(false);
  const silent = tickets.start(true);
  assert.equal(silent.isCurrent(), true);
  silent.markApplied();
  assert.equal(first.isCurrent(), false);
  assert.equal(first.ownsSpinner(), true);
  const old = tickets.start(true);
  const next = tickets.start(false);
  assert.equal(old.isCurrent(), false);
  assert.equal(next.isCurrent(), true);
  assert.equal(first.ownsSpinner(), false);
});

test('refresh pipes: debounce, one in flight, one follow-up, dirty while hidden', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // The vm captured the real timers, so load a copy whose timers go through the mocked globals.
  const load = (name) => {
    const module = { exports: {} };
    vm.runInNewContext(
      transpile(fs.readFileSync(path.join(MOBILE_SRC, `lib/rental/${name}.ts`), 'utf8')),
      {
        module,
        exports: module.exports,
        setTimeout: (...args) => setTimeout(...args),
        clearTimeout: (id) => clearTimeout(id),
      }
    );
    return module.exports;
  };
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const sync = load('useRentalRequestSync');
  let visible = true;
  let calls = 0;
  let release;
  const pipe = sync.createRentalRequestSync({
    isVisible: () => visible,
    refresh: () => {
      calls++;
      return new Promise((resolve) => (release = resolve));
    },
  });
  pipe.schedule();
  pipe.schedule();
  t.mock.timers.tick(249);
  assert.equal(calls, 0);
  t.mock.timers.tick(1);
  assert.equal(calls, 1);
  for (let i = 0; i < 3; i++) {
    pipe.schedule();
    t.mock.timers.tick(250);
  }
  assert.equal(calls, 1);
  release();
  await flush();
  assert.equal(calls, 2);
  release();
  await flush();
  visible = false;
  pipe.schedule();
  t.mock.timers.tick(1000);
  pipe.onVisible();
  assert.equal(calls, 2);
  visible = true;
  pipe.onVisible();
  t.mock.timers.tick(250);
  assert.equal(calls, 3);
  pipe.dispose();
  pipe.schedule();
  t.mock.timers.tick(250);
  assert.equal(calls, 3);
  assert.equal(sync.matchesRentalRequestEvent({ type: 'rental-request-changed' }, 'a'), true);
  assert.equal(
    sync.matchesRentalRequestEvent({ type: 'rental-request-changed', requestId: 'b' }, 'a'),
    false
  );
  assert.equal(sync.matchesRentalRequestEvent({ type: 'invoice-changed' }), false);

  let changes = 0;
  const change = load('useAgreementChangeSync').createChangeSync({
    isVisible: () => visible,
    refresh: () => {
      changes++;
      throw new Error('ignored');
    },
  });
  change.schedule();
  visible = false;
  t.mock.timers.tick(250);
  await flush();
  assert.equal(changes, 0);
  visible = true;
  change.onVisible();
  t.mock.timers.tick(250);
  await flush();
  assert.equal(changes, 1);
  change.dispose();
});

test('deep link rules (useRentalRequestDeepLink.ts:10,60-82)', () => {
  const m = M('useRentalRequestDeepLink');
  const uuid = evalWeb(
    cut('components/rental-request/useRentalRequestDeepLink.ts', 'const UUID', '\n/** Remove only'),
    'UUID'
  );
  for (const id of [
    '',
    'abc',
    '123e4567-e89b-12d3-a456-426614174000',
    '123E4567-E89B-12D3-A456-426614174000x',
  ])
    assert.equal(m.isRentalRequestId(id), uuid.test(id));
  const request = { id: 'r', ownerId: 'o', renterId: 't' };
  assert.equal(m.isRequestOnSide(request, 'r', 'RECEIVED', 'o'), true);
  assert.equal(m.isRequestOnSide(request, 'r', 'SENT', 'o'), false);
  assert.equal(m.isRequestOnSide(request, 'other', 'RECEIVED', 'o'), false);
  assert.equal(m.deepLinkLoadError({ response: { status: 404 } }).type, 'info');
  assert.equal(m.deepLinkLoadError(new Error()).type, 'error');
});

test('rental, deposit and invoice component helpers', () => {
  const countdown = evalWeb(
    cut('components/rental/NextActionCard.tsx', 'function remaining', 'function ActionButton'),
    'remaining'
  );
  const spanWeb = evalWeb(
    cut(
      'components/rental-request/OnboardingPaymentCard.tsx',
      'function span',
      'export type PaymentCardAction'
    ),
    '{ span, isRefundPayment }'
  );
  const now = Date.parse(INSTANTS[1]);
  for (const ms of [0, 1, 59_000, 60_000, 3_600_000, 86_400_000, 90_061_000]) {
    for (const sign of [1, -1]) {
      const due = new Date(now + sign * ms).toISOString();
      same(M('NextActionCard').remaining(due, now), countdown(due, now));
      assert.equal(M('OnboardingPaymentCard').span(sign * ms), spanWeb.span(sign * ms));
    }
  }
  for (const due of [null, undefined, 'bad'])
    same(M('NextActionCard').remaining(due, now), countdown(due, now));
  for (const type of ['INITIAL_PAYMENT_REFUND', 'DEPOSIT_REFUND', 'INITIAL'])
    assert.equal(
      M('OnboardingPaymentCard').isRefundPayment({ type }),
      spanWeb.isRefundPayment({ type })
    );

  const modal = 'components/rental-request/RentalPaymentModal.tsx';
  const size = evalWeb(
    cut(modal, 'function formatFileSize', 'function formatCountdown'),
    'formatFileSize'
  );
  for (const n of [0, 1023, 1024, 1536, 1048575, 1048576, 15 * 1048576])
    assert.equal(M('RentalPaymentModal').formatFileSize(n), size(n));
  // RentalPaymentModal.tsx:312-338
  const proof = M('RentalPaymentModal').proofFileError;
  assert.equal(
    proof({ type: 'image/heic', size: 1 }),
    'Chỉ chấp nhận tệp định dạng ảnh (JPEG, PNG, WebP) hoặc PDF.'
  );
  assert.equal(
    proof({ type: 'application/pdf', size: 15 * 1024 * 1024 + 1 }),
    'Kích thước tệp chứng từ không được vượt quá 15MB.'
  );
  assert.equal(proof({ type: 'image/png', size: 15 * 1024 * 1024 }), null);

  const workflow = evalWeb(
    cut(
      'components/rental-request/RentalWorkflowPanel.tsx',
      'const date=',
      '// contractId (root lease)'
    ) + cut('components/rental-request/RentalWorkflowPanel.tsx', 'const keyOf', 'export default'),
    '{ date, money, calendarDate, dateKey, parseDate, keyOf }'
  );
  const mw = M('RentalWorkflowPanel');
  for (const v of [undefined, ...INSTANTS]) assert.equal(mw.date(v), workflow.date(v));
  for (const v of [null, undefined, 0, 1500000.5]) assert.equal(mw.money(v), workflow.money(v));
  assert.equal(mw.calendarDate('2026-11-25'), workflow.calendarDate('2026-11-25'));
  assert.equal(
    mw.dateKey(mw.parseDate('2026-01-05')),
    workflow.dateKey(workflow.parseDate('2026-01-05'))
  );
  assert.equal(
    mw.keyOf({ revision: 2, status: 'X' }),
    workflow.keyOf({ revision: 2, status: 'X' })
  );

  // RentalOnboardingPanel.tsx:84, :202-203
  const mo = M('RentalOnboardingPanel');
  for (const status of [null, ...CONTRACT_STATUSES])
    assert.equal(
      mo.depositForfeit({ depositAgreementStatus: status }),
      ['ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED'].includes(status)
    );
  const waived = { type: 'RESERVATION_DEPOSIT', totalAmount: 0, status: 'CONFIRMED' };
  const reported = { type: 'INITIAL', totalAmount: 5, status: 'TRANSFER_REPORTED' };
  assert.equal(mo.unreconciled({ payments: [waived] }), false);
  assert.equal(mo.unreconciled({ payments: [reported] }), true);
  same(mo.visiblePayments({ payments: [waived, reported] }), [reported]);
  same(mo.visiblePayments(null), []);
  // DepositLedgerSummary.tsx:13-24
  const ledger = M('DepositLedgerSummary');
  const zero = {
    status: 'HELD',
    originalAmount: 0,
    confirmedReceivedAmount: 0,
    heldAmount: 0,
    retainedAmount: null,
  };
  assert.equal(ledger.isZeroDepositLedger(zero), true);
  assert.equal(ledger.isZeroDepositLedger({ ...zero, heldAmount: 1 }), false);
  assert.equal(ledger.ledgerRows({ status: 'REFUND_DUE' })[3][0], 'Cọc còn phải hoàn theo sổ');
  assert.equal(ledger.ledgerRows({ status: 'HELD' })[3][0], 'Cọc có thể hoàn theo sổ (chưa chốt)');
  assert.equal(
    ledger.ledgerStatusTitle({ status: 'REFUNDED' }),
    'Sổ ghi đã hoàn · Chưa đủ chứng từ'
  );
  assert.equal(ledger.ledgerStatusTitle({ status: 'NEW' }), 'NEW');

  // contract/detail/utils.tsx
  const utils = evalWeb(
    cut('components/contract/detail/utils.tsx', 'export function str', 'export function FieldRow'),
    '{ str: exports.str, isZeroDeposit: exports.isZeroDeposit, formatMoney: exports.formatMoney }'
  );
  for (const v of [
    null,
    undefined,
    '',
    ' ',
    0,
    '0',
    '0.00',
    '0 VNĐ',
    '10',
    12500000,
    'abc',
    1.2345,
  ]) {
    assert.equal(M('utils').str(v), utils.str(v));
    assert.equal(M('utils').isZeroDeposit(v), utils.isZeroDeposit(v));
    assert.equal(M('utils').formatMoney(v), utils.formatMoney(v));
  }
});

test('monthly invoice drafts, countdown, meters and line calculation', () => {
  const rel = 'components/contract/detail/MonthlyInvoicesSection.tsx';
  const w = evalWeb(
    cut(rel, 'const money = ', 'export default function'),
    '{ money, seedDrafts, date, dueCountdown, dateTime, NOT_FOUND }'
  );
  const m = M('MonthlyInvoicesSection');
  assert.equal(m.NOT_FOUND, w.NOT_FOUND);
  for (const n of [0, 3500000, -1]) assert.equal(m.money(n), w.money(n));
  for (const v of [undefined, ...INSTANTS]) {
    assert.equal(m.date(v), w.date(v));
    assert.equal(m.dateTime(v), w.dateTime(v));
    for (const now of [undefined, 'bad', ...INSTANTS])
      same(m.dueCountdown(v, now), w.dueCountdown(v, now));
  }
  const bills = [
    { id: 'a', status: 'DRAFT', v: '1' },
    { id: 'b', status: 'DRAFT' },
    { id: 'c', status: 'UNPAID', v: '3' },
  ];
  for (const dirty of [[], ['a'], ['b']])
    for (const previous of [{}, { a: 'typed', b: 'typed', c: 'typed' }])
      same(
        m.seedDrafts(previous, bills, new Set(dirty), (b) => b.v),
        w.seedDrafts(previous, bills, new Set(dirty), (b) => b.v)
      );

  const payloadSource = cut(
    rel,
    '  function payload(invoice: MonthlyInvoice) {',
    '  async function prepare('
  );
  const webPayload = evalWeb(
    `function f(c) {
      const { electricity, water, extras, electricityRequired, waterRequired, unsupportedWaterRate, previousEnd } = c;
      let error; const toast = { error: (m) => { error = m; } };
      ${payloadSource}
      const result = payload({ id: "i" });
      return result ? { payload: result } : { error };
    }`,
    'f'
  );
  for (const c of product({
    electricityText: [undefined, '', ' 9 ', '15', 'x'],
    waterText: [undefined, '2', '20'],
    electricityRequired: [true, false],
    waterRequired: [true, false],
    unsupportedWaterRate: [false, true],
    extras: [
      undefined,
      [],
      [{ description: ' a ', amount: '5' }],
      [{ description: '', amount: '5' }],
      [{ description: 'a', amount: '0' }],
    ],
  })) {
    const expected = webPayload({
      ...c,
      electricity: { i: c.electricityText },
      water: { i: c.waterText },
      extras: { i: c.extras },
      previousEnd: () => 10,
    });
    const { error, payload } = m.invoiceDraftPayload({
      ...c,
      previousElectricity: 10,
      previousWater: 10,
    });
    same(error ? { error } : { payload }, expected, json(c));
  }
  const invoices = [{ periodIndex: 0, electricityEnd: 11, waterEnd: 22 }];
  assert.equal(m.previousEnd(invoices, { periodIndex: 0 }, 'water', { water: 3 }), 3);
  assert.equal(m.previousEnd(invoices, { periodIndex: 1 }, 'water', {}), 22);
  assert.equal(m.previousEnd(invoices, { periodIndex: 5 }, 'electricity', {}), undefined);

  const meterRel = 'components/contract/detail/MeterReading.tsx';
  const meter = evalWeb(
    cut(meterRel, 'const readingNumber', 'export function MeterReadingInput'),
    '{ readingNumber, format }'
  );
  const consumptionWeb = evalWeb(
    `function f(startNumber, endNumber) {\n${cut(meterRel, '  const consumption = ', '  const supplementary')}\nreturn consumption;\n}`,
    'f'
  );
  const mm = M('MeterReading');
  const readings = [undefined, '', ' ', 0, '0', '10.1234', 10.3, '1,5', 'x'];
  for (const a of readings) {
    assert.equal(mm.readingNumber(a), meter.readingNumber(a));
    assert.equal(mm.format(a), meter.format(a));
    for (const b of readings)
      assert.equal(
        mm.consumption(a, b),
        consumptionWeb(meter.readingNumber(a), meter.readingNumber(b))
      );
  }

  // InvoiceLineCalculation.tsx:7-22
  const line = M('InvoiceLineCalculation').invoiceLineCalculation;
  const vnd = (n) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(n);
  same(line({ type: 'RENT', quantity: 2, unitPrice: 1000 }), {
    formula: `(2 × ${vnd(1000)})`,
    capNote: null,
  });
  same(line({ type: 'LATE_FEE', quantity: 1, unitPrice: 5 }), {
    formula: '(Khoản phí đã chốt; hóa đơn cũ chưa lưu chi tiết số ngày)',
    capNote: null,
  });
  same(
    line({ type: 'LATE_FEE', quantity: 3, quantityUnit: 'ngày', unitPrice: 1000, amount: 3000 }),
    { formula: `(${vnd(1000)}/ngày × 3 ngày)`, capNote: null }
  );
  same(
    line({ type: 'LATE_FEE', quantity: 3, quantityUnit: 'lần', unitPrice: 1000, amount: 2000 }),
    {
      formula: `(${vnd(1000)} × 3 lần)`,
      capNote: `Phí tính theo đơn giá: ${vnd(3000)}; áp dụng mức trần còn ${vnd(2000)}.`,
    }
  );
});
