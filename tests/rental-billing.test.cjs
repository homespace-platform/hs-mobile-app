/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Money and decision rules of src/components/rental/billing/logic.ts. The web keeps most of them inside
// .tsx components: they are cut out of the web source by text markers and run side by side, so a web change
// to them fails here too.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const SRC = path.resolve(__dirname, '../src');

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
    vm.runInNewContext(transpile(fs.readFileSync(file, 'utf8')), {
      Error,
      module,
      exports: module.exports,
      require: (request) => {
        if (request.startsWith('@/')) return load(`${path.join(root, request.slice(2))}.ts`);
        if (request.startsWith('.')) return load(`${path.resolve(path.dirname(file), request)}.ts`);
        return require(request);
      },
    });
    return module.exports;
  }
  return (request) => load(`${path.join(root, request)}.ts`);
}
const logic = loader(SRC)('components/rental/billing/logic');
const mis = loader(SRC)('lib/rental/MonthlyInvoicesSection');
const split = loader(WEB)('lib/split-sentences');

const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8').replace(/\r\n/g, '\n');
function cut(rel, from, to) {
  const source = read(rel);
  const a = source.indexOf(from);
  assert.ok(a >= 0, `${rel}: marker not found: ${from}`);
  const b = source.indexOf(to, a + from.length);
  assert.ok(b >= 0, `${rel}: marker not found: ${to}`);
  return source.slice(a, b);
}
/** Runs `body` (web TypeScript statements ending in `return`) with the given variables in scope. */
function webFn(body) {
  const module = { exports: {} };
  const code = transpile(`module.exports = function (scope: any) { with (scope) { ${body} } };`);
  // `with` needs sloppy mode: drop the "use strict" the transpiler adds.
  vm.runInNewContext(code.replace(/^"use strict";/, ''), { module, exports: module.exports });
  return (scope) => plain(module.exports(scope));
}
/** A JSX `{condition && <x>` guard as a boolean function. */
const webCondition = (rel, from, to) => {
  const fn = webFn(`return !!(${cut(rel, from, to)});`);
  return (scope) => fn(scope);
};
const plain = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value ?? null));
const product = (axes) =>
  Object.entries(axes).reduce(
    (rows, [key, values]) => rows.flatMap((row) => values.map((v) => ({ ...row, [key]: v }))),
    [{}]
  );
const deferred = () => {
  let resolve;
  const promise = new Promise((ok) => (resolve = ok));
  return { promise, resolve };
};

const D = 'components/contract/detail/';
const MIS = `${D}MonthlyInvoicesSection.tsx`;
const OAP = `${D}OverdueActionsPanel.tsx`;
const PEP = `${D}PaymentExtensionPanel.tsx`;
const SPP = `${D}SettlementPaymentPanel.tsx`;
const CLP = `${D}ContractLifecyclePanel.tsx`;
const CP = 'components/complaint/ComplaintPanel.tsx';

const INVOICE_STATUSES = ['DRAFT', 'UNPAID', 'OVERDUE', 'PAID', 'ROLLED_OVER', 'CANCELLED'];
const PAYMENT_STATUSES = [
  'AWAITING_TRANSFER',
  'TRANSFER_REPORTED',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'OVERDUE',
  'EXPIRED',
];
const WORKFLOWS = [
  'CANCELLED',
  'UPCOMING',
  'METER_REQUIRED',
  'READY_FOR_ISSUE',
  'METER_DEADLINE_MISSED',
  'UNPAID',
  'PAYMENT_REMINDER',
  'OVERDUE',
  'OVERDUE_ACTION_REQUIRED',
  'UNDER_REVIEW',
  'PAID',
  'DEFERRED',
  'ROLLED_OVER',
  'EXTENSION_PENDING',
  'PAYMENT_EXTENDED',
];

const invoice = (patch = {}) => ({
  id: 'i1',
  contractId: 'c1',
  periodIndex: 1,
  status: 'UNPAID',
  workflowState: 'UNPAID',
  lines: [],
  totalAmount: 1000,
  lateFeeAmount: 0,
  serverNow: '2026-03-10T00:00:00Z',
  dueAt: '2026-03-12T00:00:00Z',
  periodEndExclusive: '2026-03-15',
  meterDeadlineAt: '2026-03-15T17:00:00Z',
  overdueActions: [],
  paymentExtensions: [],
  ...patch,
});
const payment = (patch = {}) => ({
  id: 'p1',
  payerId: 't',
  payeeId: 'l',
  direction: 'TENANT_TO_LANDLORD',
  type: 'MONTHLY_RENT',
  status: 'AWAITING_TRANSFER',
  totalAmount: 5_500_000,
  qrImageUrl: 'https://qr',
  evidences: [],
  ...patch,
});

test('invoice status messages match the web table for every workflow state', () => {
  const table = webFn(
    `${cut(MIS, 'const workflowMessage: Record', 'const countdown =')} const msg = String(${cut(
      MIS,
      'firstRent ? invoice.status === "PAID"',
      ');\n            const warn'
    )}); return { msg };`
  );
  const rows = product({
    workflowState: WORKFLOWS,
    status: ['UNPAID', 'PAID', 'CANCELLED'],
    firstRent: [true, false],
    lateFeeExempt: [true, false],
    notice: [undefined, 'ENDED', 'NOTICE', 'REVIEW_REQUESTED'],
    paymentStatus: [undefined, 'TRANSFER_REPORTED'],
    rollover: [true, false],
  });
  for (const row of rows) {
    const bill = invoice({
      workflowState: row.workflowState,
      status: row.status,
      lateFeeExempt: row.lateFeeExempt,
      billingPeriod: row.firstRent ? { kind: 'INITIAL_RENT' } : undefined,
      unilateralTermination: row.notice ? { status: row.notice } : undefined,
      overdueActions: row.rollover ? [{ type: 'AUTOMATIC_ROLLOVER' }] : [],
    });
    const web = table({
      invoice: bill,
      firstRent: row.firstRent,
      payment: row.paymentStatus ? { status: row.paymentStatus } : undefined,
      dateTime: mis.dateTime,
      String,
    }).msg;
    const mine = logic.invoiceMessage(bill, row.paymentStatus);
    assert.equal(mine.text, web, JSON.stringify(row));
    const sentences = split.splitSentences(web);
    assert.equal(mine.summary, sentences.length > 1 || web.length > 120 ? sentences[0] : null);
  }
});

test('payment block, QR, report and decision visibility match the web per status and role', () => {
  const block = webCondition(
    MIS,
    'payment && !["PAID","ROLLED_OVER","CANCELLED"].includes(invoice.status)',
    '&& <div className="space-y-3'
  );
  const qr = webCondition(
    MIS,
    'isTenant && ["AWAITING_TRANSFER", "OVERDUE", "REJECTED"].includes(payment.status) && payment.qrImageUrl',
    '&& <Image'
  );
  const report = webCondition(
    MIS,
    'isTenant && ["AWAITING_TRANSFER", "OVERDUE", "REJECTED"].includes(payment.status) && (!firstRent',
    '&& <div className="space-y-2 rounded-xl bg-muted/40'
  );
  const decide = webCondition(
    MIS,
    'isLandlord && payment.status === "TRANSFER_REPORTED"',
    '&& <div'
  );
  const receipt = webCondition(
    MIS,
    'payment?.status==="CONFIRMED" && payment.totalAmount>0',
    '&& <PaymentReceiptActions'
  );
  for (const row of product({
    status: INVOICE_STATUSES,
    paymentStatus: PAYMENT_STATUSES,
    isLandlord: [true, false],
    firstRent: [true, false],
    dueAt: [undefined, '2026-03-09T00:00:00Z', '2026-03-11T00:00:00Z'],
  })) {
    const isTenant = !row.isLandlord;
    const bill = invoice({
      status: row.status,
      billingPeriod: row.firstRent ? { kind: 'INITIAL_RENT' } : undefined,
    });
    const pay = payment({ status: row.paymentStatus, dueAt: row.dueAt });
    const scope = {
      invoice: bill,
      payment: pay,
      isTenant,
      isLandlord: row.isLandlord,
      firstRent: row.firstRent,
      Date,
    };
    const state = logic.invoiceCardState(bill, pay, { isLandlord: row.isLandlord, isTenant });
    const issued = row.status !== 'DRAFT';
    const shown = issued && block(scope);
    const label = JSON.stringify(row);
    assert.equal(state.showTransfer, shown, label);
    assert.equal(state.showQr, shown && qr(scope), label);
    assert.equal(state.showReport, shown && report(scope), label);
    assert.equal(state.showDecision, shown && decide(scope), label);
    assert.equal(state.showReceipt, receipt(scope), label);
    assert.equal(state.showDraftForm, row.status === 'DRAFT' && row.isLandlord, label);
  }
});

test('"Chốt và phát hành" opens at 00:00 +07 of the last day, as web', () => {
  const web = webFn(`${cut(MIS, 'const canIssue =', 'const workflowMessage')} return canIssue;`);
  for (const serverNow of [
    '2026-03-13T16:59:59Z',
    '2026-03-13T17:00:00Z',
    '2026-03-14T00:00:00+07:00',
    '2026-03-20T00:00:00Z',
  ]) {
    const bill = invoice({ serverNow });
    assert.equal(logic.canIssueNow(bill), web({ invoice: bill, Date }), serverNow);
  }
});

test('draft validation and payload match the web; a vi-VN comma is a decimal point', () => {
  const body = cut(MIS, 'function previousEnd', 'async function prepare');
  const web = webFn(`let message; const toast = { error: (m) => { message = m; } };
    ${body} const result = payload(invoice); return result ? { payload: result } : { error: message };`);
  for (const row of product({
    electricity: [undefined, '', '99', '100', '100.5'],
    water: [undefined, '', '10'],
    electricityRequired: [true, false],
    waterRequired: [true, false],
    unsupportedWaterRate: [true, false],
    extras: [
      [],
      [{ description: ' Sửa khóa ', amount: '50000' }],
      [{ description: '', amount: '1' }],
      [{ description: 'x', amount: '0' }],
    ],
  })) {
    const bill = invoice({ periodIndex: 0 });
    const expected = web({
      invoice: bill,
      invoices: [],
      initialElectricity: '100',
      initialWater: 5,
      electricity: { i1: row.electricity },
      water: { i1: row.water },
      extras: { i1: row.extras },
      electricityRequired: row.electricityRequired,
      waterRequired: row.waterRequired,
      unsupportedWaterRate: row.unsupportedWaterRate,
      Number,
    });
    const mine = plain(
      logic.draftPayload({
        electricityText: row.electricity,
        waterText: row.water,
        electricityRequired: row.electricityRequired,
        waterRequired: row.waterRequired,
        unsupportedWaterRate: row.unsupportedWaterRate,
        previousElectricity: '100',
        previousWater: 5,
        extras: row.extras,
      })
    );
    assert.deepEqual(mine, expected, JSON.stringify(row));
  }
  assert.equal(logic.readingText('100,25'), '100.25');
  assert.equal(logic.readingText('12.'), '12');
  assert.equal(logic.readingText('.'), '');
  const base = {
    electricityRequired: true,
    waterRequired: false,
    unsupportedWaterRate: false,
    previousElectricity: 100,
  };
  assert.equal(
    logic.draftPayload({ ...base, electricityText: '100,5' }).payload.electricityEnd,
    100.5
  );
  assert.ok(logic.draftPayload({ ...base, electricityText: '.' }).error);
});

test('a tenant never sees drafts and an unknown ?invoice= opens nothing', () => {
  const bills = [
    invoice({ id: 'a', periodIndex: 0, status: 'PAID' }),
    invoice({ id: 'b', periodIndex: 1, status: 'DRAFT' }),
  ];
  const base = { invoices: bills, payments: [], isLandlord: false, selectedInvoiceId: null };
  assert.deepEqual(plain(logic.invoiceSelection(base).shown.map((b) => b.id)), ['a']);
  for (const patch of [{ requestedInvoiceId: 'b' }, { invalidInvoiceRequest: '../x' }]) {
    const result = logic.invoiceSelection({ ...base, ...patch });
    assert.equal(result.requestMissing, true);
    assert.equal(result.selected, undefined);
  }
  assert.equal(
    logic.invoiceSelection({ ...base, requestedInvoiceId: 'zz', selectedInvoiceId: 'a' }).selected,
    'a'
  );
  assert.equal(
    logic.outstandingTotal([
      invoice({ status: 'UNPAID', totalAmount: 1 }),
      invoice({ status: 'OVERDUE', totalAmount: 2 }),
      invoice({ status: 'ROLLED_OVER', totalAmount: 4 }),
      invoice({ status: 'DRAFT', totalAmount: 8 }),
    ]),
    3
  );
});

test('overdue and legacy-termination rules match the web', () => {
  const web = webFn(
    `${cut(OAP, 'const history = invoice.overdueActions || [];', 'if (!canRecord && history.length')}
     return { canRecord: !!canRecord, isTerminationInvoice, canPropose: !!canPropose };`
  );
  for (const row of product({
    contractActive: [true, false],
    isLandlord: [true, false],
    canResolveOverdue: [true, false],
    deferredAt: [undefined, 'x'],
    proposed: [undefined, 'x'],
    accepted: [undefined, 'x'],
    declined: [undefined, 'x'],
    cancelled: [undefined, 'x'],
    own: [true, false],
    unilateral: [undefined, { status: 'NOTICE' }],
  })) {
    const bill = invoice({
      canResolveOverdue: row.canResolveOverdue,
      canDeferToNextPeriod: true,
      deferredAt: row.deferredAt,
      terminationProposedAt: row.proposed,
      terminationAcceptedAt: row.accepted,
      terminationDeclinedAt: row.declined,
      terminationCancelledAt: row.cancelled,
      terminationProposalInvoiceId: row.own ? 'i1' : 'other',
      unilateralTermination: row.unilateral,
    });
    const role = { isLandlord: row.isLandlord, isTenant: !row.isLandlord };
    const expected = web({
      invoice: bill,
      contractActive: row.contractActive,
      isLandlord: row.isLandlord,
    });
    const state = logic.overdueState(bill, { contractActive: row.contractActive, ...role });
    assert.equal(state.canPropose, expected.canPropose);
    assert.equal(state.canDefer, expected.canRecord);
    assert.equal(
      state.visible,
      expected.canRecord || expected.isTerminationInvoice || !!row.unilateral
    );
    // Legacy actions exist only for a record the server already has.
    const { legacy } = state;
    if (!(row.own && row.proposed && !row.unilateral)) assert.equal(legacy.open, false);
    assert.equal(
      legacy.tenantRespond,
      legacy.open &&
        row.contractActive &&
        role.isTenant &&
        !row.accepted &&
        !row.declined &&
        !row.cancelled
    );
    assert.equal(
      !!legacy.complete,
      !!(legacy.open && row.contractActive && row.isLandlord && row.accepted && !row.cancelled)
    );
  }
});

test('payment-extension rules match the web', () => {
  const web = webFn(
    `${cut(PEP, 'const history = invoice.paymentExtensions || [];', 'if (!canRequest && !canDirect')}
     return { pending: pending?.id, approved: approved?.id, resumedFees, canRequest: !!canRequest, canDirect: !!canDirect };`
  );
  for (const row of product({
    isLandlord: [true, false],
    canRequestExtension: [true, false],
    canResolveOverdue: [true, false],
    history: [
      [],
      [{ id: 'a', status: 'PENDING' }],
      [{ id: 'b', status: 'APPROVED', lateFeeResumesAfterDue: true, newDueAt: 'd' }],
    ],
  })) {
    const bill = invoice({
      dueAt: 'd',
      paymentExtensions: row.history,
      canRequestExtension: row.canRequestExtension,
      canResolveOverdue: row.canResolveOverdue,
    });
    const expected = web({ invoice: bill, isLandlord: row.isLandlord, isTenant: !row.isLandlord });
    const state = logic.extensionState(bill, row.isLandlord, !row.isLandlord);
    assert.equal(state.pending?.id, expected.pending);
    assert.equal(state.approved?.id, expected.approved);
    assert.equal(!!state.resumedFees, expected.resumedFees);
    assert.equal(state.canRequest, expected.canRequest);
    assert.equal(state.canDirect, expected.canDirect);
  }
  assert.deepEqual([0, 1, 30, 31, 1.5].map(logic.daysValid), [false, true, true, false, false]);
});

test('unilateral termination: actions per notice status and role', () => {
  for (const status of [
    undefined,
    'NOTICE',
    'REVIEW_REQUESTED',
    'REPLACED',
    'WITHDRAWN',
    'CANCELLED_PAID',
    'ENDED',
  ]) {
    for (const isLandlord of [true, false]) {
      const bill = invoice({
        unilateralTermination: status ? { status } : undefined,
        canRequestTerminationReview: true,
        canDecideTerminationReview: true,
        canCompleteTerminationHandover: true,
      });
      const state = logic.unilateralState(bill, {
        isLandlord,
        isTenant: !isLandlord,
        canIssue: false,
      });
      const waiting = status === 'NOTICE' || status === 'REVIEW_REQUESTED';
      assert.equal(state.visible, !!status);
      assert.equal(state.withdraw, isLandlord && waiting);
      assert.equal(state.reviewForm, !isLandlord && !!status);
      assert.equal(state.decisionForm, isLandlord && !!status);
      assert.equal(state.handover, isLandlord && !!status);
      assert.equal(state.issueForm, false);
      assert.equal(state.poll, waiting);
    }
  }
  assert.equal(logic.effectiveOption('ROLLOVER', false), 'PAYMENT_EXTENSION');
  assert.equal(logic.effectiveOption('ROLLOVER', true), 'ROLLOVER');
});

test('settlement payment: payer, actions and title match the web per type, direction, status, role', () => {
  const web = webFn(
    `${cut(SPP, 'const refund = payment.direction', 'async function perform')}
     ${cut(SPP, 'const canTransfer = payer', 'async function receive')}
     return { payer, canTransfer, title };`
  );
  for (const row of product({
    type: ['INITIAL_PAYMENT_REFUND', 'DEPOSIT_ADJUSTMENT', 'DEPOSIT_REFUND', 'OTHER_CHARGE'],
    direction: ['LANDLORD_TO_TENANT', 'TENANT_TO_LANDLORD'],
    status: PAYMENT_STATUSES,
    isLandlord: [true, false],
  })) {
    const pay = payment({ type: row.type, direction: row.direction, status: row.status });
    const expected = web({ payment: pay, isLandlord: row.isLandlord });
    const state = logic.settlementState(pay, row.isLandlord);
    assert.deepEqual(
      [state.payer, state.canTransfer, state.title],
      [expected.payer, expected.canTransfer, expected.title]
    );
    assert.equal(state.canReceive, !expected.payer && row.status === 'TRANSFER_REPORTED');
    assert.equal(state.showReceipt, row.status === 'CONFIRMED');
  }
});

function proofDeps(current, log, alive = { value: true }) {
  return {
    read: async () => current,
    upload: async (id) => {
      log.push(['upload', id]);
      return 's1';
    },
    report: async (id, body) => {
      log.push(['report', id, plain(body)]);
      return { evidences: [{ storageObjectId: body.proofStorageId }] };
    },
    isAlive: () => alive.value,
  };
}

test('the reported amount is exactly the displayed amount, and a changed payment is not reported', async () => {
  const shown = payment();
  const log = [];
  await logic.sendSettlementProof(shown, proofDeps(shown, log));
  assert.deepEqual(log, [
    ['upload', 'p1'],
    ['report', 'p1', { proofStorageId: 's1', expectedAmount: 5_500_000 }],
  ]);
  for (const patch of [
    { totalAmount: 5_600_000 },
    { status: 'TRANSFER_REPORTED' },
    { id: 'p2' },
    { payeeId: 'other' },
    { direction: 'LANDLORD_TO_TENANT' },
  ]) {
    const none = [];
    await assert.rejects(
      logic.sendSettlementProof(shown, proofDeps(payment(patch), none)),
      /đã thay đổi/
    );
    assert.equal(none.length, 0);
  }
  // Leaving during the upload sends no report.
  const alive = { value: true };
  const left = [];
  const deps = proofDeps(shown, left, alive);
  deps.upload = async () => {
    alive.value = false;
    return 's1';
  };
  assert.equal(await logic.sendTransferProof(shown, deps), false);
  assert.equal(left.length, 0);
});

test('RD-03: a proof is usable only for the transfer data it was picked for', async () => {
  const bank = { bankBin: '970436', bankCode: 'VCB', accountNumber: '1', accountHolderName: 'A' };
  const shown = payment({ transferReference: 'HS1', payeeBankAccountSnapshot: bank });
  const file = { uri: 'file:///p.jpg', sizeBytes: 1 };
  const proof = logic.bindProof(file, shown);
  assert.equal(logic.proofFor(proof, { ...shown, status: 'REJECTED' }), file);
  assert.equal(logic.proofFor(undefined, shown), undefined);
  // A cleared or refused selection leaves nothing to send.
  assert.equal(logic.bindProof(undefined, shown), undefined);
  for (const patch of [
    { id: 'p2' },
    { totalAmount: 5_550_000 },
    { payeeId: 'other' },
    { transferReference: 'HS2' },
    { payeeBankAccountSnapshot: { ...bank, accountNumber: '2' } },
    { payeeBankAccountSnapshot: { ...bank, bankBin: '970415' } },
    { payeeBankAccountSnapshot: { ...bank, accountHolderName: 'B' } },
  ]) {
    const next = { ...shown, ...patch };
    assert.equal(logic.proofFor(proof, next), undefined, JSON.stringify(patch));
    // The same change seen only by the read before the upload also sends nothing.
    const log = [];
    await assert.rejects(logic.sendSettlementProof(shown, proofDeps(next, log)), /đã thay đổi/);
    assert.equal(log.length, 0);
    assert.ok(await logic.invoiceReportBlock(shown, file, async () => next));
  }
});

test('RD-11: success only when the answer holds the proof this submit uploaded', async () => {
  const shown = payment();
  for (const evidences of [[{ storageObjectId: 'other-device' }], [], undefined]) {
    const deps = proofDeps(shown, []);
    deps.report = async () => ({ status: 'TRANSFER_REPORTED', evidences });
    await assert.rejects(logic.sendTransferProof(shown, deps), {
      message: logic.PROOF_NOT_RECORDED,
    });
    await assert.rejects(logic.sendSettlementProof(shown, deps), {
      message: logic.PROOF_NOT_RECORDED,
    });
  }
  const deps = proofDeps(shown, []);
  // Earlier rejected proofs stay in the list.
  deps.report = async () => ({
    evidences: [{ storageObjectId: 's1' }, { storageObjectId: 'old' }],
  });
  assert.equal(await logic.sendTransferProof(shown, deps), true);
});

test('RD-07: the days text is never turned into another number', () => {
  const valid = (text) => logic.daysValid(logic.parseDays(text));
  // D-087 / D-113: what a web type=number field accepts, read with Number().
  for (const text of ['1', '7', '07', '30', '7.0', '1e1', '3E1', '300e-1', '.7e1'])
    assert.equal(valid(text), true, text);
  assert.equal(logic.parseDays('07'), 7);
  assert.equal(logic.parseDays('7.0'), 7);
  assert.equal(logic.parseDays('1e1'), 10);
  // The browser reports '' for these (or Number() gives something outside 1..30).
  const bad = ['', '0', '31', '100', '0015x', '1.5', '1,5', '-5', '+5', ' 7', '7 ', '0x10', '7.'];
  for (const text of [...bad, '.', 'e1', '1e', '1e2', 'Infinity', '0b11', '-0'])
    assert.equal(valid(text), false, text);
});

test('D-180: no follow-up read starts while hidden, and the next call reads again', async () => {
  const gates = [deferred(), deferred()];
  let reads = 0;
  let visible = true;
  const refresh = logic.createSingleFlight(
    () => gates[reads++].promise,
    () => true,
    () => visible
  );
  const first = refresh();
  refresh(); // marked dirty while visible
  visible = false; // backgrounded before the read answers
  gates[0].resolve();
  await first;
  assert.equal(reads, 1);
  visible = true;
  const again = refresh();
  gates[1].resolve();
  await again;
  assert.equal(reads, 2);
});

test('D-117, D-180: returning to the app signals the invoices to read again', () => {
  const { rentalSyncEvents } = loader(SRC)('lib/rental-sync/events');
  assert.ok(
    rentalSyncEvents('notifications:changed').some(
      (event) => event.type === 'invoice-changed' && !event.contractId
    )
  );
  const source = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r\n/g, '\n');
  assert.match(
    source('lib/realtime/connections.ts'),
    /state === 'active'\) \{\s+start\(\);\s+notifyNotificationsChanged\(\);/
  );
  assert.match(
    source('components/rental/billing/MonthlyInvoicesSection.tsx'),
    /isAlive,\s+isAppVisible/
  );
});

test('RD-09: a complaint draft is locked when its record, revision or action changes', () => {
  const draft = { caseId: 'b', revision: 3, action: 'CLOSE' };
  const stale = (current, action) => logic.complaintDraftStale(draft, current, action);
  assert.equal(stale({ id: 'b', revision: 3 }, 'CLOSE'), false);
  assert.equal(stale({ id: 'b', revision: 4 }, 'CLOSE'), true);
  assert.equal(stale({ id: 'b', revision: 4 }, 'REOPEN'), true);
  assert.equal(stale({ id: 'b', revision: 3 }, 'COMMENT'), true);
  assert.equal(stale({ id: 'c', revision: 3 }, 'CLOSE'), true);
  assert.equal(stale(undefined, undefined), true);
  assert.equal(logic.complaintDraftStale(null, { id: 'b', revision: 9 }, 'REOPEN'), false);
  const input = {
    busy: false,
    picking: false,
    reason: 'đủ mười ký tự nhé',
    creating: false,
    canCreate: true,
    activeAction: 'REOPEN',
    fileCount: 0,
  };
  assert.equal(logic.complaintSendDisabled(input), false);
  assert.equal(logic.complaintSendDisabled({ ...input, stale: true }), true);
});

test('invoice proof checks: missing, too large, amount changed, read failure', async () => {
  const shown = payment();
  const ok = async () => shown;
  const block = (file, readPayment = ok) => logic.invoiceReportBlock(shown, file, readPayment);
  assert.equal((await block(undefined)).message, 'Vui lòng chọn chứng từ chuyển khoản.');
  assert.equal(
    (await block({ sizeBytes: 15 * 1024 * 1024 + 1 })).message,
    'Chứng từ tối đa 15 MB.'
  );
  assert.equal(await block({ sizeBytes: 15 * 1024 * 1024 }), null);
  const changed = await block({ sizeBytes: 1 }, async () => payment({ totalAmount: 1 }));
  assert.equal(changed.refresh, true);
  assert.ok(read(MIS).includes(changed.message));
  const failed = await block({ sizeBytes: 1 }, async () => {
    throw new Error('mất mạng');
  });
  assert.deepEqual([failed.message, failed.refresh], ['mất mạng', false]);
});

test('confirm/reject is dropped when the report is no longer the one reviewed', async () => {
  const reviewed = payment({
    status: 'TRANSFER_REPORTED',
    payerReportedAt: 't1',
    evidences: [{ id: 'e1' }],
  });
  await logic.assertSameReview(reviewed, async () => ({ ...reviewed }));
  for (const patch of [
    { evidences: [{ id: 'e1' }, { id: 'e2' }] },
    { payerReportedAt: 't2' },
    { status: 'REJECTED' },
    { totalAmount: 1 },
  ])
    await assert.rejects(
      logic.assertSameReview(reviewed, async () => ({ ...reviewed, ...patch })),
      /đã thay đổi/
    );
});

test('double submit: one action at a time; reads are single-flight with one follow-up', async () => {
  const lock = logic.createActionLock();
  const gate = deferred();
  let runs = 0;
  const first = lock.run(async () => {
    runs++;
    await gate.promise;
  });
  assert.equal(await lock.run(async () => runs++), false);
  gate.resolve();
  assert.equal(await first, true);
  assert.equal(runs, 1);
  await assert.rejects(
    lock.run(async () => {
      throw new Error('x');
    })
  );
  assert.equal(lock.held, false);

  const gates = [deferred(), deferred(), deferred()];
  let reads = 0;
  const refresh = logic.createSingleFlight(
    () => gates[reads++].promise,
    () => true
  );
  const a = refresh();
  refresh();
  const c = refresh();
  assert.equal(reads, 1);
  gates[0].resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 2);
  gates[1].resolve();
  await Promise.all([a, c]);
  assert.equal(reads, 2);
});

test('lifecycle: bill status, accept gate, proposal and supplement validation match the web', () => {
  const billWeb = webFn(
    `return ${cut(CLP, 'bill.status === "PAID" ? "Đã xác nhận thanh toán"', '}</strong>')};`
  );
  for (const row of product({
    status: INVOICE_STATUSES,
    paymentStatus: [undefined, ...PAYMENT_STATUSES],
  }))
    assert.equal(logic.billStatusText(row), billWeb({ bill: row }));

  const acceptWeb = webCondition(
    CLP,
    'busy || consent !== proposalKey || !data.billing.allPaid',
    '} onClick'
  );
  for (const row of product({
    consent: ['c:2', 'c:1', null],
    allPaid: [true, false],
    utilityAdjustment: [undefined, 0, 5],
    complaintCaseId: [undefined, 'k'],
    approved: [undefined, 'x'],
  })) {
    const data = {
      billing: { allPaid: row.allPaid },
      closure: {
        utilityAdjustment: row.utilityAdjustment,
        complaintCaseId: row.complaintCaseId,
        complaintOwnerApprovedAt: row.approved,
      },
    };
    assert.equal(
      logic.acceptBlocked(data, row.consent, logic.proposalKey('c', 2)),
      acceptWeb({ busy: false, consent: row.consent, proposalKey: 'c:2', data, Boolean })
    );
  }

  const proposeWeb = webFn(
    `let message; const toast = { error: (m) => { message = m; } };
     (() => { ${cut(CLP, 'if (!handover || closureNote.trim().length < 10', 'void perform')} })();
     return message ?? null;`
  );
  const row = (description, amount) => ({ description, amount });
  for (const input of product({
    handover: [true, false],
    note: ['ngắn', 'đủ mười ký tự nhé'],
    rows: [
      [],
      [row('Kính cửa', 1000)],
      [row('ab', 1000)],
      [row('Kính cửa', 0)],
      [row('Kính cửa', 1), row(' kính CỬA ', 2)],
      [row('Kính cửa', 1_000_000_001)],
    ],
  })) {
    const deduction = logic.deductionTotal(input.rows);
    assert.equal(
      logic.proposalError(input.handover, input.note, input.rows),
      proposeWeb({
        handover: input.handover,
        closureNote: input.note,
        deductions: input.rows,
        deduction,
        Number,
        Set,
      })
    );
  }

  const supplementWeb = webFn(
    `let message; const toast = { error: (m) => { message = m; } };
     const result = (() => { ${cut(CLP, 'const values = [electricity, water, extraAmount]', 'const body = JSON.stringify(payload)')} return payload; })();
     return result ? { payload: result } : { error: message };`
  );
  for (const input of product({
    electricity: ['', '90', '100', '120.5', '-1'],
    water: ['', '7'],
    description: ['', ' Vệ sinh '],
    amount: ['', '0', '200000'],
    lastBilled: [undefined, { electricityEnd: 100, waterEnd: 5 }],
  })) {
    const expected = supplementWeb({
      electricity: input.electricity,
      water: input.water,
      extraDescription: input.description,
      extraAmount: input.amount,
      lastBilled: input.lastBilled,
      Number,
    });
    assert.deepEqual(
      plain(logic.supplementPayload(input, input.lastBilled)),
      expected,
      JSON.stringify(input)
    );
  }
  const comma = logic.supplementPayload(
    { electricity: '120,5', water: '', description: '', amount: '' },
    { electricityEnd: 100 }
  );
  assert.equal(comma.payload.electricityEnd, 120.5);
  assert.ok(
    logic.supplementPayload({ electricity: '.', water: '', description: '', amount: '' }, {}).error
  );

  let n = 0;
  const retry = logic.createRetryId(() => `id${++n}`);
  assert.equal(retry.idFor({ a: 1 }), 'id1');
  assert.equal(retry.idFor({ a: 1 }), 'id1');
  assert.equal(retry.idFor({ a: 2 }), 'id2');
  retry.clear();
  assert.equal(retry.idFor({ a: 2 }), 'id3');
});

test('complaint scope, current record and actions match the web; uploads are cached', async () => {
  const web = webFn(
    `${cut(CP, 'const scoped=rows.filter', 'const resetDraft')}
     return { ids: scoped.map(c => c.id), current: current?.id, actions, activeAction, valid };`
  );
  const record = (patch) => ({
    id: 'a',
    rentalRequestId: 'r',
    tenantId: 'me',
    landlordId: 'l',
    status: 'OPEN',
    finalClosed: false,
    allowedActions: ['COMMENT', 'ESCALATE', 'CLOSE', 'DECIDE'],
    ...patch,
  });
  const rows = [
    record({ id: 'a', status: 'RESOLVED', allowedActions: ['REOPEN'] }),
    record({ id: 'b' }),
    record({ id: 'c', finalClosed: true }),
    record({ id: 'x', tenantId: 'other' }),
    record({ id: 'y', rentalRequestId: 'other' }),
  ];
  for (const selected of ['', 'a', 'b', 'c', 'x', 'zz'])
    for (const chosenAction of ['', 'CLOSE', 'DECIDE']) {
      const expected = web({
        rows,
        rentalRequestId: 'r',
        profile: { id: 'me' },
        selected,
        chosenAction,
        reason: '',
      });
      const mine = logic.complaintView(rows, 'r', 'me', selected, chosenAction);
      assert.deepEqual(plain(mine.scoped.map((c) => c.id)), expected.ids);
      assert.equal(mine.current?.id, expected.current);
      assert.deepEqual(plain(mine.actions), expected.actions);
      assert.equal(mine.activeAction, expected.activeAction);
    }
  const base = {
    busy: false,
    picking: false,
    reason: 'đủ mười ký tự nhé',
    creating: false,
    canCreate: true,
    activeAction: 'COMMENT',
    fileCount: 1,
  };
  assert.equal(logic.complaintSendDisabled(base), false);
  for (const patch of [
    { busy: true },
    { picking: true },
    { reason: 'ngắn' },
    { reason: 'x'.repeat(501) },
    { activeAction: 'CLOSE' },
    { creating: true, canCreate: false },
  ])
    assert.equal(logic.complaintSendDisabled({ ...base, ...patch }), true, JSON.stringify(patch));

  const cache = new Map();
  let uploads = 0;
  const upload = async (file) => {
    if (file.uri === 'b' && uploads === 1) {
      uploads++;
      throw new Error('x');
    }
    uploads++;
    return `id-${file.uri}`;
  };
  await assert.rejects(logic.uploadAll([{ uri: 'a' }, { uri: 'b' }], cache, upload));
  assert.deepEqual(plain(await logic.uploadAll([{ uri: 'a' }, { uri: 'b' }], cache, upload)), [
    'id-a',
    'id-b',
  ]);
  assert.equal(uploads, 3);
});

test('payment history: query, filter, money, row line; payment lookup stays in the own list', () => {
  assert.deepEqual(plain(logic.receiptQuery('landlord', undefined, 1)), {
    role: 'LANDLORD',
    page: 1,
    size: 10,
  });
  assert.deepEqual(plain(logic.receiptQuery('tenant', 'c9', 3)), {
    role: 'TENANT',
    contractId: 'c9',
    page: 3,
    size: 10,
  });
  const intlMoney = (totalAmount, currency) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(totalAmount);
  for (const totalAmount of [14_000_000, 0])
    assert.equal(
      logic.receiptMoney({ totalAmount, currency: 'VND' }),
      intlMoney(totalAmount, 'VND')
    );
  // Hermes has no currency data: other currencies print their code, with the web's fraction digits.
  for (const currency of ['USD', 'EUR', 'SGD', 'JPY', 'KRW', 'IDR', 'HUF', 'KWD', 'BHD'])
    for (const totalAmount of [0, 1234.5, 1234.567, 1000000, -2.25]) {
      const intl = intlMoney(totalAmount, currency);
      const number = intl.slice(0, intl.lastIndexOf('\u00a0'));
      assert.equal(
        logic.receiptMoney({ totalAmount, currency }),
        `${number}\u00a0${currency}`,
        `${currency} ${totalAmount}`
      );
    }
  assert.equal(
    logic.receiptSubtitle({
      propertyAddress: 'Q1',
      day: '5/1/2026',
      payerName: 'A',
      payeeName: 'B',
    }),
    'Q1 · 5/1/2026 · A → B'
  );
  assert.equal(logic.receiptFileName('BL/2026 01'), 'BL-2026-01.pdf');
  const prp = read('components/dashboard/invoices/PaymentReceiptsPanel.tsx');
  assert.ok(prp.includes('size: PAGE_SIZE'));
  assert.equal(logic.RECEIPT_PAGE_SIZE, 10);

  const list = [payment(), payment({ id: 'p2', payerId: 'x', payeeId: 'y' })];
  assert.equal(logic.findOwnPayment(list, ' p1 ', 't').id, 'p1');
  assert.equal(logic.findOwnPayment(list, 'p2', 't'), undefined);
  assert.equal(logic.findOwnPayment(list, '../p1', 't'), undefined);
});

// Every Vietnamese sentence of the ported web files must exist in the mobile sources (presence, not place).
test('web strings of the ported files are all present on mobile', () => {
  const files = [
    MIS,
    OAP,
    PEP,
    SPP,
    `${D}UnilateralTerminationPanel.tsx`,
    `${D}InvoiceLineCalculation.tsx`,
    `${D}MeterReading.tsx`,
    CLP,
    'components/contract/page/DepositSettlementPanel.tsx',
    'components/payment/DepositLedgerSummary.tsx',
    'components/payment/PaymentReceiptActions.tsx',
    'components/dashboard/invoices/PaymentReceiptsPanel.tsx',
    CP,
    'components/complaint/ComplaintHistory.tsx',
    'app/dashboard/complaints/page.tsx',
  ];
  const walk = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
      );
  const normalize = (text) => text.replace(/\s+/g, ' ').trim();
  const strings = (file, text) => {
    const found = [];
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (
        ts.isStringLiteralLike(node) ||
        ts.isJsxText(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      )
        found.push(normalize(node.text));
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  };
  const mobile = [
    ...walk(path.join(SRC, 'components/rental/billing')),
    ...walk(path.join(SRC, 'components/rental/shared')),
    ...walk(path.join(SRC, 'lib/rental')),
    ...walk(path.join(SRC, 'types/rental')),
    ...walk(path.join(SRC, 'services/rental')),
    ...['PaymentHistoryScreen', 'ComplaintScreen', 'PaymentLinkScreen'].map((name) =>
      path.join(SRC, `screens/rental/${name}.tsx`)
    ),
  ]
    .flatMap((file) => strings(file, fs.readFileSync(file, 'utf8')))
    .join(' ¦ ');
  const vietnamese = /[À-ỹĐđ]/;
  // Renewal branch of ContractLifecyclePanel belongs to the contract screens; the rest is browser-only.
  const renewalOnly = new Set(
    strings(
      'renewal.tsx',
      `<>${cut(CLP, '{mode !== "settlement" && <>', '{mode !== "renewal" && showLedger')
        .replace('{mode !== "settlement" && <>', '')
        .replace(/<\/>\s*\}\s*$/, '')}</>`
    )
  );
  const missing = files.flatMap((rel) =>
    strings(rel, read(rel))
      .filter((s) => vietnamese.test(s) && !mobile.includes(s) && !renewalOnly.has(s))
      .map((s) => `${path.basename(rel)}: ${s}`)
  );
  assert.deepEqual(plain(missing), [
    // The amount and its "đ" come from dong(); the label is an InfoRow.
    'OverdueActionsPanel.tsx: đ tại thời điểm này; hóa đơn sau cộng một dòng công nợ. QR cũ chỉ bị hủy khi hóa đơn mới phát hành.',
    'SettlementPaymentPanel.tsx: Số tiền:',
    // Renewal strings outside the cut JSX block (contract screens).
    'ContractLifecyclePanel.tsx: Chọn 1–36 tháng và nhập lý do ít nhất 10 ký tự.',
    'ContractLifecyclePanel.tsx: Gia hạn thời gian thuê & quyết toán',
    // No PDF toolbar and no pop-up blocker on a phone.
    'PaymentReceiptActions.tsx: · Có thể in bằng thanh công cụ PDF.',
    'ComplaintPanel.tsx: Vui lòng cho phép mở cửa sổ để xem chứng cứ.',
  ]);
});

test('RD-12: nothing opens when the screen or the sheet session ended during the wait', async () => {
  const source = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

  // Left while the device was still answering "can you share?".
  const shared = [];
  let alive = true;
  let available;
  const module = { exports: {} };
  vm.runInNewContext(transpile(source('services/rental/files.ts')), {
    Error,
    module,
    exports: module.exports,
    require: (request) =>
      request === 'expo-sharing'
        ? {
            isAvailableAsync: () => new Promise((resolve) => (available = resolve)),
            shareAsync: async (uri) => void shared.push(uri),
          }
        : {
            fileSessionGuard: () => () => {},
            withFileLease: (_uris, run) => run(),
            shareRentalFile: (_uri, share) => share(),
          },
  });
  for (const leave of [true, false]) {
    alive = true;
    const run = module.exports.sharePdf(`file:///${leave}.pdf`, () => alive);
    if (leave) alive = false;
    available(true);
    await run;
  }
  assert.deepEqual(shared, ['file:///false.pdf']);
  assert.ok(
    source('components/rental/billing/PaymentReceiptActions.tsx').includes(
      'await sharePdf(named, isAlive)'
    )
  );

  // The same record opened again is a new session.
  const panel = source('components/rental/billing/ComplaintPanel.tsx');
  assert.match(panel, /session\.current \+= 1;\s*\}, \[viewing\]\);/);
  const start = panel.indexOf('const openProof: OpenProof');
  const body = panel.slice(start, panel.indexOf('const openCount', start));
  for (const [reopened, expected] of [
    [false, ['u']],
    [true, []],
  ]) {
    const opened = [];
    const session = { current: 1 };
    let answer;
    const openProof = vm.runInNewContext(
      transpile(`${body}
openProof;`),
      {
        session,
        isAlive: () => true,
        storageService: { getViewUrl: () => new Promise((resolve) => (answer = resolve)) },
        openUrl: (url) => void opened.push(url),
        toast: { error: () => {} },
      }
    );
    openProof('a', 'A');
    if (reopened) session.current += 2;
    answer('u');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(opened, expected);
  }
});

// Both payment-history tabs share one row (Xem + Tải PDF) and one pager at 10 per page.
test('membership and rental tabs use the same receipt row and pager', () => {
  const src = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
  const tab = src('components/rental/billing/MembershipReceiptsTab.tsx');
  const rental = src('screens/rental/PaymentHistoryScreen.tsx');
  const row = src('components/rental/billing/ReceiptRow.tsx');
  for (const code of [tab, rental]) {
    assert.match(code, /<ReceiptRow/);
    assert.match(code, /<ReceiptPager/);
  }
  assert.match(tab, /size: PAGE_SIZE/);
  assert.match(tab, /\.get\(id\)/);
  assert.match(row, /label="Xem"/);
  assert.match(row, /label="Tải PDF"/);
  assert.match(row, /disabled=\{!ready\}/);
  for (const label of ['Trang đầu', 'Trang trước', 'Trang sau', 'Trang cuối'])
    assert.ok(row.includes(label), label);
  assert.match(row, /giao dịch/);
});
