/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Money and decision rules of src/components/rental/onboarding/logic.ts. Where the web keeps the rule
// inside a .tsx component, it is cut out of the web source by text markers and run side by side, so a
// web change to it fails here too.
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
      Error, // so `instanceof Error` sees the errors the tests throw
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
const logic = loader(SRC)('components/rental/onboarding/logic');
const web = loader(WEB);

const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8').replace(/\r\n/g, '\n');
function cut(rel, from, to) {
  const source = read(rel);
  const a = source.indexOf(from);
  assert.ok(a >= 0, `${rel}: marker not found: ${from}`);
  const b = source.indexOf(to, a + from.length);
  assert.ok(b >= 0, `${rel}: marker not found: ${to}`);
  return source.slice(a, b);
}
function evalWeb(code, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(transpile(code), { module, exports: module.exports, ...globals });
  return module.exports;
}
// Objects made inside a vm have another realm's prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value));
const product = (axes) =>
  Object.entries(axes).reduce(
    (rows, [key, values]) => rows.flatMap((row) => values.map((v) => ({ ...row, [key]: v }))),
    [{}]
  );
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

const CARD = 'components/rental-request/OnboardingPaymentCard.tsx';
const MODAL = 'components/rental-request/RentalPaymentModal.tsx';
const WORKFLOW = 'components/rental-request/RentalWorkflowPanel.tsx';
const PANEL = 'components/rental-request/RentalOnboardingPanel.tsx';

const NOW = '2026-11-25T10:00:00.000Z';
const STATUSES = [
  'AWAITING_TRANSFER',
  'TRANSFER_REPORTED',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'OVERDUE',
  'EXPIRED',
];
const TYPES = ['RESERVATION_DEPOSIT', 'INITIAL', 'INITIAL_PAYMENT_REFUND', 'DEPOSIT_REFUND'];
const DIRECTIONS = ['TENANT_TO_LANDLORD', 'LANDLORD_TO_TENANT'];

test('pay / confirm / review buttons equal the web for every role, direction and status', () => {
  const webCard = evalWeb(
    cut(CARD, 'function span(ms: number)', '// Refunds have no') +
      'module.exports = (p, view, isOwner) => {\n' +
      cut(CARD, '  const now = new Date(view.serverNow)', '  return (\n    <article') +
      'return { overdue, statusKey: status, canPay, canReceive, canReview, countdown }; };',
    { paymentStatus: (value) => value }
  );
  const cases = product({
    isOwner: [true, false],
    direction: DIRECTIONS,
    status: STATUSES,
    type: TYPES,
    totalAmount: [0, 1500000],
    dueAt: [
      undefined,
      '2026-11-20T00:00:00Z',
      NOW,
      '2026-11-25T10:00:00.001Z',
      '2026-11-27T11:05:00Z',
    ],
    cancellationRequestedAt: [undefined, '2026-11-24T00:00:00Z'],
  });
  assert.equal(cases.length, 2240);
  for (const c of cases) {
    const view = { serverNow: NOW, cancellationRequestedAt: c.cancellationRequestedAt };
    assert.deepEqual(
      plain(logic.paymentCardState(c, view, c.isOwner)),
      plain(webCard(c, view, c.isOwner)),
      JSON.stringify(c)
    );
  }
});

test('only the right side may move money', () => {
  const view = { serverNow: NOW };
  const buttons = (direction, status, isOwner) => {
    const s = logic.paymentCardState(
      { direction, status, type: 'INITIAL', totalAmount: 5, dueAt: '2026-11-26T00:00:00Z' },
      view,
      isOwner
    );
    return ['canPay', 'canReceive', 'canReview'].filter((key) => s[key]).join();
  };
  assert.equal(buttons('TENANT_TO_LANDLORD', 'AWAITING_TRANSFER', false), 'canPay');
  assert.equal(buttons('TENANT_TO_LANDLORD', 'AWAITING_TRANSFER', true), '');
  assert.equal(buttons('TENANT_TO_LANDLORD', 'TRANSFER_REPORTED', true), 'canReceive');
  assert.equal(buttons('TENANT_TO_LANDLORD', 'TRANSFER_REPORTED', false), '');
  assert.equal(buttons('LANDLORD_TO_TENANT', 'AWAITING_TRANSFER', true), 'canPay');
  assert.equal(buttons('LANDLORD_TO_TENANT', 'TRANSFER_REPORTED', false), 'canReceive');
  assert.equal(buttons('LANDLORD_TO_TENANT', 'TRANSFER_REPORTED', true), '');
  assert.equal(buttons('TENANT_TO_LANDLORD', 'REJECTED', true), 'canReview');
});

test('payment modal: who may report a transfer equals the web', () => {
  const { transferWindowClosed } = web('lib/rental-request-presentation');
  const webRule = evalWeb(
    'module.exports = (payment, profile, nowMs) => {\n' +
      cut(MODAL, '  const windowClosed = transferWindowClosed', '  function copyToClipboard') +
      'return { windowClosed, canReport }; };',
    { transferWindowClosed }
  );
  for (const c of product({
    status: STATUSES,
    type: TYPES,
    userId: ['payer', 'payee', null],
    dueAt: [undefined, '2026-11-20T00:00:00Z', '2026-11-30T00:00:00Z'],
  })) {
    const payment = {
      status: c.status,
      type: c.type,
      dueAt: c.dueAt,
      payerId: 'payer',
      payeeId: 'payee',
    };
    const nowMs = Date.parse(NOW);
    assert.deepEqual(
      plain(logic.transferReportState(payment, c.userId, nowMs)),
      plain(webRule(payment, c.userId ? { id: c.userId } : null, nowMs)),
      JSON.stringify(c)
    );
  }
  assert.equal(logic.transferReportState(null, 'payer', 0).canReport, false);
});

test('a payment is shown only to a party, for the asked request and id', () => {
  const payment = { id: 'p1', rentalRequestId: 'r1', payerId: 'a', payeeId: 'b' };
  const ok = { paymentId: 'p1', requestId: 'r1', userId: 'a' };
  assert.equal(logic.assertViewerPayment(payment, ok), payment);
  assert.equal(logic.assertViewerPayment(payment, { requestId: 'r1', userId: 'b' }), payment);
  for (const bad of [{ paymentId: 'p2' }, { requestId: 'r2' }, { userId: 'c' }, { userId: '' }])
    assert.throws(
      () => logic.assertViewerPayment(payment, { ...ok, ...bad }),
      /bạn không có quyền xem/
    );
  assert.ok(read(MODAL).includes(logic.PAYMENT_NOT_VISIBLE));
});

const file = (name, contentType = 'image/jpeg', sizeBytes = 1000) => ({
  uri: `file://${name}`,
  fileName: name,
  contentType,
  sizeBytes,
});
function proofFlow(overrides = {}) {
  const calls = { uploads: [], reports: [], errors: [], reloads: 0 };
  let alive = true;
  let state = logic.EMPTY_PROOF;
  const flow = logic.createProofFlow({
    upload: (f, id) => {
      const d = deferred();
      calls.uploads.push({ file: f.fileName, id, ...d });
      return d.promise;
    },
    report: (id, payload) => {
      const d = deferred();
      calls.reports.push({ id, payload: plain(payload), ...d });
      return d.promise;
    },
    onChange: (next) => {
      state = next;
    },
    onError: (message) => calls.errors.push(message),
    reload: () => calls.reloads++,
    isAlive: () => alive,
    ...overrides,
  });
  return {
    flow,
    calls,
    state: () => state,
    close: () => {
      alive = false;
    },
  };
}
const PAYMENT = { id: 'pay-1', totalAmount: 14000000 };

test('proof strings are the web strings', () => {
  const source = read(MODAL);
  for (const text of [
    logic.PROOF_UPLOAD_FAILED,
    logic.PROOF_STILL_UPLOADING,
    logic.PROOF_REQUIRED,
    logic.PROOF_REPORT_FAILED,
  ])
    assert.ok(source.includes(text), text);
});

test('proof type and size are refused before any upload and drop the previous file', async () => {
  const { flow, calls, state } = proofFlow();
  void flow.select(file('a.jpg'), PAYMENT.id);
  calls.uploads[0].resolve('storage-a');
  await tick();
  assert.equal(state().storageId, 'storage-a');

  await flow.select(file('b.heic', 'image/heic'), PAYMENT.id);
  assert.equal(state().error, 'Chỉ chấp nhận tệp định dạng ảnh (JPEG, PNG, WebP) hoặc PDF.');
  assert.deepEqual([state().file, state().storageId], [null, null]);
  await flow.select(file('c.pdf', 'application/pdf', 15 * 1024 * 1024 + 1), PAYMENT.id);
  assert.equal(state().error, 'Kích thước tệp chứng từ không được vượt quá 15MB.');
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.errors.at(-1), 'Chứng từ chưa được gửi vì tệp không hợp lệ.');
  assert.equal(await flow.submit(PAYMENT, true), null);
  assert.equal(calls.errors.at(-1), logic.PROOF_REQUIRED);
  assert.equal(calls.reports.length, 0);

  void flow.select(file('d.pdf', 'application/pdf', 15 * 1024 * 1024), PAYMENT.id);
  assert.equal(calls.uploads.length, 2);
});

test('a late answer of an older or removed pick never becomes the proof', async () => {
  const { flow, calls, state } = proofFlow();
  void flow.select(file('slow.jpg'), PAYMENT.id);
  void flow.select(file('new.jpg'), PAYMENT.id);
  calls.uploads[1].resolve('storage-new');
  await tick();
  calls.uploads[0].resolve('storage-old');
  await tick();
  assert.deepEqual([state().file.fileName, state().storageId], ['new.jpg', 'storage-new']);

  // A newer file whose upload fails must not fall back to the older stored proof.
  void flow.select(file('broken.jpg'), PAYMENT.id);
  assert.equal(state().storageId, null);
  calls.uploads[2].reject(new Error('offline'));
  await tick();
  assert.deepEqual([state().status, state().storageId, state().error], ['ERROR', null, 'offline']);
  assert.equal(calls.errors.at(-1), logic.PROOF_UPLOAD_FAILED);

  void flow.select(file('removed.jpg'), PAYMENT.id);
  flow.remove();
  calls.uploads[3].resolve('storage-removed');
  await tick();
  assert.deepEqual([state().file, state().storageId, state().status], [null, null, 'IDLE']);
});

test('submit retries a failed upload, then reports once with expectedAmount', async () => {
  const { flow, calls, state } = proofFlow();
  void flow.select(file('a.jpg'), PAYMENT.id);
  assert.equal(await flow.submit(PAYMENT, true), null);
  assert.equal(calls.errors.at(-1), logic.PROOF_STILL_UPLOADING);
  calls.uploads[0].reject(new Error('offline'));
  await tick();

  // Retry fails: nothing is reported.
  const failed = flow.submit(PAYMENT, true);
  calls.uploads[1].reject(new Error('offline'));
  assert.equal(await failed, null);
  assert.equal(calls.reports.length, 0);
  assert.equal(state().submitting, false);

  const first = flow.submit(PAYMENT, true);
  // Double tap while uploading or reporting, and edits meanwhile, do nothing.
  assert.equal(await flow.submit(PAYMENT, true), null);
  calls.uploads[2].resolve('storage-a');
  await tick();
  assert.equal(await flow.submit(PAYMENT, true), null);
  flow.remove();
  await flow.select(file('other.jpg'), PAYMENT.id);
  assert.equal(calls.uploads.length, 3);
  assert.equal(calls.reports.length, 1);
  assert.deepEqual(calls.reports[0].payload, {
    expectedAmount: 14000000,
    proofStorageId: 'storage-a',
  });

  // Report error: the stored proof is reused, not uploaded again.
  calls.reports[0].reject(new Error('Đã hết hạn chuyển khoản'));
  assert.equal(await first, null);
  assert.equal(calls.errors.at(-1), 'Đã hết hạn chuyển khoản');
  const second = flow.submit(PAYMENT, true);
  calls.reports[1].resolve({
    id: 'pay-1',
    status: 'TRANSFER_REPORTED',
    evidences: [{ storageObjectId: 'storage-a' }],
  });
  assert.equal((await second).status, 'TRANSFER_REPORTED');
  assert.equal(calls.uploads.length, 3);
});

test('success only when the answer holds the proof this submit sent', async () => {
  const billing = loader(SRC)('components/rental/billing/logic');
  for (const evidences of [[{ storageObjectId: 'other-device' }], [], undefined]) {
    const { flow, calls, state } = proofFlow();
    void flow.select(file('a.jpg'), PAYMENT.id);
    calls.uploads[0].resolve('storage-a');
    await tick();
    const sent = flow.submit(PAYMENT, true);
    await tick();
    calls.reports[0].resolve({ id: 'pay-1', status: 'TRANSFER_REPORTED', evidences });
    assert.equal(await sent, null);
    assert.deepEqual(calls.errors, [billing.PROOF_NOT_RECORDED]);
    assert.equal(calls.reloads, 1);
    assert.deepEqual(
      [state().file.fileName, state().storageId, state().submitting],
      ['a.jpg', 'storage-a', false]
    );
  }
});

test('nothing is sent without permission or after the modal closed', async () => {
  const { flow, calls, close } = proofFlow();
  void flow.select(file('a.jpg'), PAYMENT.id);
  calls.uploads[0].reject(new Error('offline'));
  await tick();
  assert.equal(await flow.submit(PAYMENT, false), null);
  assert.equal(calls.uploads.length, 1);
  const pending = flow.submit(PAYMENT, true);
  close();
  calls.uploads[1].resolve('storage-a');
  assert.equal(await pending, null);
  assert.equal(calls.reports.length, 0);
});

test('coalesced read: one in flight, one follow-up, also after a failure', async () => {
  const reads = [];
  const superseded = [];
  const refresh = logic.createCoalesced(
    async (isSuperseded) => {
      const d = deferred();
      reads.push(d);
      await d.promise.catch(() => {});
      superseded.push(isSuperseded());
    },
    () => true
  );
  const a = refresh();
  await tick();
  const b = refresh();
  refresh();
  assert.equal(a, b);
  assert.equal(reads.length, 1);
  reads[0].reject(new Error('x'));
  await tick();
  assert.equal(reads.length, 2);
  reads[1].resolve();
  await a;
  assert.deepEqual(superseded, [true, false]);
  const c = refresh();
  await tick();
  assert.equal(reads.length, 3);
  reads[2].resolve();
  await c;
});

function panelSteps(log, reload) {
  return {
    setBusy: (busy) => log.push(`busy:${busy}`),
    waitInflight: async () => {},
    reload,
    onUpdated: () => log.push('updated'),
    closeForm: () => log.push('close'),
    notify: {
      success: (m) => log.push(m),
      info: (m) => log.push(m),
      error: (m) => log.push(m),
    },
  };
}

test('panel actions are single flight and tell a saved action from a failed one', async () => {
  const lock = { current: false };
  const log = [];
  const d = deferred();
  let runs = 0;
  const task = () => {
    runs++;
    return d.promise;
  };
  const first = logic.runPanelAction(
    lock,
    task,
    panelSteps(log, async () => ({}))
  );
  await logic.runPanelAction(
    lock,
    task,
    panelSteps(log, async () => ({}))
  );
  d.resolve();
  await first;
  assert.equal(runs, 1);
  assert.deepEqual(log, ['busy:true', 'updated', 'close', 'Đã cập nhật hồ sơ.', 'busy:false']);

  const stale = [];
  await logic.runPanelAction(
    lock,
    async () => {},
    panelSteps(stale, async () => undefined)
  );
  assert.deepEqual(stale, [
    'busy:true',
    'close',
    'Đã cập nhật, chưa tải lại được dữ liệu.',
    'busy:false',
  ]);

  const failed = [];
  await logic.runPanelAction(
    lock,
    async () => {
      throw {};
    },
    panelSteps(failed, async () => ({}))
  );
  assert.deepEqual(failed, ['busy:true', 'Không thể thực hiện thao tác.', 'busy:false']);
  assert.equal(lock.current, false);
});

test('default-notice title equals the web', () => {
  const line = cut(PANEL, '<p className="font-semibold">{view.defaultCase.completedAt ?', '</p>');
  const expression = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'));
  const webTitle = evalWeb(`module.exports = (view, noticeOpen) => (${expression});`);
  for (const c of product({
    completedAt: [undefined, 'x'],
    disputedAt: [undefined, 'x'],
    stage: ['AWAITING_FIRST_RENT', 'CANCELLATION_REFUND_PENDING', 'COMPLETED'],
    noticeOpen: [true, false],
  })) {
    const defaultCase = { completedAt: c.completedAt, disputedAt: c.disputedAt };
    assert.equal(
      logic.defaultCaseTitle(defaultCase, c.stage, c.noticeOpen),
      webTitle({ defaultCase, stage: c.stage }, c.noticeOpen),
      JSON.stringify(c)
    );
  }
});

test('quick view only opens a transfer the landlord receives', async () => {
  const payment = {
    id: 'p1',
    rentalRequestId: 'r1',
    type: 'INITIAL',
    direction: 'TENANT_TO_LANDLORD',
    status: 'TRANSFER_REPORTED',
    payeeId: 'owner',
  };
  const load = (view = {}, detail = {}, userId = 'owner', paymentId = null) =>
    logic.loadQuickView(
      {
        readView: async () => ({ askerRole: 'LANDLORD', payments: [payment], ...view }),
        getPayment: async () => ({ ...payment, ...detail }),
      },
      { requestId: 'r1', userId, paymentId }
    );
  assert.equal((await load()).payment.id, 'p1');
  await assert.rejects(load({ askerRole: 'TENANT' }), /vai trò chủ nhà/);
  await assert.rejects(load({}, {}, 'owner', 'other'), /Không tìm thấy khoản thanh toán/);
  for (const detail of [
    { id: 'p2' },
    { rentalRequestId: 'r2' },
    { direction: 'LANDLORD_TO_TENANT' },
    { payeeId: 'someone' },
  ])
    await assert.rejects(load({}, detail), /không có quyền nhận tiền/, JSON.stringify(detail));
  await assert.rejects(load({}, { payeeId: '' }, ''), /không có quyền nhận tiền/);
});

const ACTIONS = [
  'PROPOSE',
  'ACCEPT',
  'REJECT',
  'WITHDRAW',
  'CANCEL',
  'CONFIRM_RETURN',
  'FULL_REFUND_EXIT',
  'REQUEST_RESUME',
  'RESUME',
  'DECLINE_RESUME',
];

test('workflow button disabled state equals the web', () => {
  const expression = cut(
    WORKFLOW,
    'busy||needsReview||!valid||',
    '} onClick={()=>void perform(action)}'
  );
  const webDisabled = evalWeb(
    `module.exports = ({busy, needsReview, valid, creating, proposalValid, action, earlyExit, ack, contacted}) => Boolean(${expression});`
  );
  for (const c of product({
    action: ACTIONS,
    creating: [true, false],
    earlyExit: [true, false],
    needsReview: [true, false],
    reason: ['ngắn', 'lý do đủ mười ký tự'],
    proposalValid: [true, false],
    ack: [true, false],
    contacted: [true, false],
  })) {
    const valid = c.reason.length >= 10;
    assert.equal(
      logic.workflowActionBlocked(c.action, c.creating, c),
      webDisabled({ ...c, valid, busy: false }),
      JSON.stringify(c)
    );
  }
  assert.equal(logic.workflowReasonValid(`  ${'a'.repeat(1000)}  `), true);
  assert.equal(logic.workflowReasonValid('a'.repeat(1001)), false);
  assert.equal(logic.workflowReasonValid(`   ${'a'.repeat(9)}   `), false);
});

test('workflow consent sentence equals the web', () => {
  const expression = cut(
    WORKFLOW,
    '(data.status==="RESUME_PROPOSED"||data.allowedActions',
    '} Việc này không thay bước xác nhận nhận tiền.'
  );
  const webText = evalWeb(
    `module.exports = (data, kind, creating, selectedAction) => (${expression}) + " Việc này không thay bước xác nhận nhận tiền.";`
  );
  for (const c of product({
    status: ['PROPOSED', 'RESUME_PROPOSED'],
    allowed: [[], ['REQUEST_RESUME']],
    kind: ['cancellation', 'early-exit'],
    creating: [true, false],
    selected: [null, 'ACCEPT', 'CONFIRM_RETURN'],
  })) {
    const data = { status: c.status, allowedActions: c.allowed };
    assert.equal(
      logic.workflowAckText(data, c.kind, c.creating, c.selected),
      webText(data, c.kind, c.creating, c.selected)
    );
  }
});

function workflowRun(overrides = {}, input = {}) {
  const calls = { uploads: [], proposals: [], acts: [], notes: [], saved: 0, refreshed: 0 };
  let alive = true;
  const deps = {
    lock: { current: false },
    uploaded: new Map(),
    isAlive: () => alive,
    setBusy: () => {},
    upload: async (f) => {
      calls.uploads.push(f.uri);
      return `id:${f.uri}`;
    },
    propose: async (payload) => {
      calls.proposals.push(plain(payload));
      return { revision: 2, status: 'PROPOSED' };
    },
    act: async (action, payload) => {
      calls.acts.push([action, plain(payload)]);
      return { revision: 2, status: 'AGREED' };
    },
    onSaved: () => calls.saved++,
    refresh: async () => {
      calls.refreshed++;
    },
    accept: () => {},
    notify: { success: (m) => calls.notes.push(m), error: (m) => calls.notes.push(m) },
    ...overrides,
  };
  const base = {
    earlyExit: false,
    needsReview: false,
    reason: '  đủ mười ký tự  ',
    ack: true,
    contacted: false,
    proposalValid: true,
    data: { revision: 1, allowedActions: ['PROPOSE', 'ACCEPT', 'FULL_REFUND_EXIT'] },
    endExclusive: '2027-01-01',
    files: [],
    ...input,
  };
  return {
    calls,
    close: () => {
      alive = false;
    },
    run: (action, extra = {}) => logic.performWorkflowAction(action, { ...base, ...extra }, deps),
  };
}

test('workflow submit: guards, single flight and evidence reuse on retry', async () => {
  const blocked = workflowRun();
  await blocked.run('PROPOSE', { ack: false });
  await blocked.run('PROPOSE', { needsReview: true });
  await blocked.run('PROPOSE', { reason: 'ngắn' });
  await blocked.run('PROPOSE', { data: null });
  await blocked.run('WITHDRAW');
  await blocked.run('FULL_REFUND_EXIT', { contacted: false });
  await blocked.run('PROPOSE', { earlyExit: true, proposalValid: false });
  await blocked.run('ACCEPT', { files: [file('x.jpg')] });
  assert.equal(blocked.calls.proposals.length + blocked.calls.acts.length, 0);
  assert.deepEqual(blocked.calls.notes, [
    'Bằng chứng cần được gắn vào đề xuất mới trước khi thao tác.',
  ]);

  const gate = deferred();
  let attempts = 0;
  const posted = [];
  const retry = workflowRun({
    propose: async (payload) => {
      posted.push(plain(payload));
      if (++attempts === 1) await gate.promise;
      return { revision: 2, status: 'PROPOSED' };
    },
  });
  const files = [file('a.jpg'), file('b.pdf', 'application/pdf')];
  const first = retry.run('PROPOSE', { files });
  await retry.run('PROPOSE', { files });
  gate.reject(new Error('xung đột phiên bản'));
  await first;
  await retry.run('PROPOSE', { files });
  assert.equal(posted.length, 2);
  assert.equal(retry.calls.uploads.length, 2);
  assert.deepEqual(posted[1], {
    expectedRevision: 1,
    reason: 'đủ mười ký tự',
    evidenceIds: ['id:file://a.jpg', 'id:file://b.pdf'],
  });
  assert.equal(retry.calls.notes[0], 'xung đột phiên bản');

  const early = workflowRun();
  await early.run('PROPOSE', { earlyExit: true, ack: false });
  assert.equal(early.calls.proposals[0].endExclusive, '2027-01-01');
  await early.run('ACCEPT');
  assert.deepEqual(early.calls.acts[0][1], {
    expectedRevision: 1,
    reason: 'đủ mười ký tự',
    acknowledged: true,
    tenantContacted: false,
  });
});

test('workflow submit: saved-but-not-reloaded and closed-while-uploading', async () => {
  const saved = workflowRun({
    onUpdated: async () => {
      throw new Error('reload');
    },
  });
  await saved.run('ACCEPT');
  assert.match(saved.calls.notes.at(-1), /^Thao tác đã được ghi nhận, nhưng chưa làm mới/);
  assert.equal(saved.calls.refreshed, 1);

  const gate = deferred();
  const closed = workflowRun({ upload: () => gate.promise });
  const pending = closed.run('PROPOSE', { files: [file('a.jpg')] });
  closed.close();
  gate.resolve('id');
  await pending;
  assert.equal(closed.calls.proposals.length, 0);
});

test('early-exit action labels and prefilled reasons come from the web', () => {
  const source = read(WORKFLOW);
  for (const action of ['ACCEPT', 'CONFIRM_RETURN'])
    assert.ok(source.includes(logic.workflowPrefilledReason(action)));
  assert.equal(logic.workflowActionLabel('ACCEPT', true), 'Đồng ý và tạo phụ lục');
  assert.equal(logic.workflowActionLabel('ACCEPT', false), 'Đồng ý nội dung đang xem');
  assert.equal(logic.workflowActionLabel('CANCEL', false), 'Hủy đề nghị chờ ký');
  assert.equal(logic.workflowActionLabel('NEW', false), 'NEW');
});

// --- Fixes after review B (RB-01, RB-02, RB-09, RB-12, RB-13): mobile guards without a web twin ---

test('RB-01: no report while a picker is busy, no upload after the modal closed', async () => {
  const { flow, calls, state, close } = proofFlow();
  void flow.select(file('a.jpg'), PAYMENT.id);
  calls.uploads[0].resolve('storage-a');
  await tick();
  flow.setPicking(true);
  assert.equal(state().picking, true);
  assert.equal(await flow.submit(PAYMENT, true), null);
  assert.equal(calls.reports.length, 0);
  // The new selection is handed over before the lock opens: the old proof is never sent again.
  void flow.select(file('b.jpg'), PAYMENT.id);
  flow.setPicking(false);
  assert.equal(await flow.submit(PAYMENT, true), null);
  assert.equal(calls.errors.at(-1), logic.PROOF_STILL_UPLOADING);
  assert.equal(calls.reports.length, 0);

  close();
  await flow.select(file('late.jpg'), PAYMENT.id);
  assert.equal(calls.uploads.length, 2);
});

test('RB-02: a draft never moves to another payment', async () => {
  const OTHER = { id: 'pay-2', totalAmount: 9000000 };
  const { flow, calls, state } = proofFlow();
  assert.equal(flow.bind(PAYMENT.id), false);
  assert.equal(flow.bind(PAYMENT.id), false);
  void flow.select(file('deposit.jpg'), PAYMENT.id);
  calls.uploads[0].reject(new Error('offline'));
  await tick();
  // Even without a rebind the file is not sent for another id.
  assert.equal(await flow.submit(OTHER, true), null);
  assert.equal(calls.uploads.length, 1);
  assert.equal(flow.bind(OTHER.id), true);
  assert.deepEqual(plain(state()), plain(logic.EMPTY_PROOF));
  assert.equal(await flow.submit(OTHER, true), null);
  assert.equal(calls.errors.at(-1), logic.PROOF_REQUIRED);
  // A pick started for the old payment is ignored.
  await flow.select(file('stale.jpg'), PAYMENT.id);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.reports.length, 0);
});

test('RB-02: in-flight results of the previous payment are dropped', async () => {
  const picked = proofFlow();
  picked.flow.bind('pay-1');
  void picked.flow.select(file('a.jpg'), 'pay-1');
  picked.flow.bind('pay-2');
  picked.calls.uploads[0].resolve('storage-old');
  await tick();
  assert.deepEqual([picked.state().file, picked.state().storageId], [null, null]);

  // The retry upload inside submit: nothing is reported, and the new draft is not locked.
  const { flow, calls, state } = proofFlow();
  flow.bind('pay-1');
  void flow.select(file('a.jpg'), 'pay-1');
  calls.uploads[0].reject(new Error('offline'));
  await tick();
  const pending = flow.submit(PAYMENT, true);
  flow.bind('pay-2');
  assert.equal(state().submitting, false);
  void flow.select(file('b.jpg'), 'pay-2');
  calls.uploads[1].resolve('storage-old');
  assert.equal(await pending, null);
  assert.equal(calls.reports.length, 0);
  assert.deepEqual([state().file.fileName, state().storageId], ['b.jpg', null]);
  calls.uploads[2].resolve('storage-b');
  await tick();

  // A report already sent: its answer must not replace the newly loaded payment.
  const report = flow.submit({ id: 'pay-2', totalAmount: 1 }, true);
  assert.deepEqual(
    [calls.reports[0].id, calls.reports[0].payload.proofStorageId],
    ['pay-2', 'storage-b']
  );
  flow.bind('pay-3');
  calls.reports[0].resolve({ id: 'pay-2' });
  assert.equal(await report, null);
});

test('RB-01: a workflow action waits for the evidence selection', async () => {
  const input = {
    earlyExit: false,
    needsReview: false,
    reason: 'lý do đủ mười ký tự',
    ack: true,
    contacted: false,
    proposalValid: true,
  };
  assert.equal(logic.workflowActionBlocked('PROPOSE', true, input), false);
  assert.equal(logic.workflowActionBlocked('PROPOSE', true, { ...input, picking: true }), true);
  const { run, calls } = workflowRun();
  await run('PROPOSE', { picking: true, files: [file('old.jpg')] });
  assert.equal(calls.uploads.length + calls.proposals.length, 0);
});

// EvidencePicker.tsx run with a minimal hook runtime and a fake device picker.
function mountPicker(props) {
  const slots = [];
  const cleanups = [];
  const changes = [];
  const locks = [];
  const errors = [];
  const picks = [];
  const sizes = [];
  let hook = 0;
  let mounted = false;
  let writes = 0;
  const imagePicker = { UIImagePickerPreferredAssetRepresentationMode: {} };
  const discarded = [];
  const react = {
    useState(initial) {
      const at = hook++;
      if (!(at in slots)) slots[at] = initial;
      return [
        slots[at],
        (next) => {
          writes++;
          slots[at] = next;
        },
      ];
    },
    useRef(initial) {
      const at = hook++;
      if (!(at in slots)) slots[at] = { current: initial };
      return slots[at];
    },
    useEffect(effect) {
      if (!mounted) cleanups.push(effect());
    },
  };
  const element = (type, elementProps) => ({ type, props: elementProps });
  const component = (name) => ({ __esModule: true, default: name });
  const later = (queue) => () => {
    const d = deferred();
    queue.push(d);
    return d.promise;
  };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': {},
    'expo-document-picker': { getDocumentAsync: later(picks) },
    'expo-file-system/legacy': { getInfoAsync: later(sizes) },
    'expo-image-picker': imagePicker,
    '@/services/rental/cache': { discardPickedCopy: async (uri) => void discarded.push(uri) },
    '@/components/AppDialog': { useDialog: () => () => {} },
    '@/components/Icon': component('Icon'),
    './ActionButton': component('ActionButton'),
    './FieldFrame': component('FieldFrame'),
    './logic': loader(SRC)('components/rental/shared/logic'),
  };
  const module = { exports: {} };
  const source = fs.readFileSync(
    path.join(SRC, 'components/rental/shared/EvidencePicker.tsx'),
    'utf8'
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    { Error, module, exports: module.exports, require: (request) => modules[request] }
  );
  const find = (node, match) => {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = find(child, match);
        if (found) return found;
      }
      return undefined;
    }
    if (!node?.props) return undefined;
    return match(node) ? node : find(node.props.children, match);
  };
  /** Renders and returns the props of one picker button (the document one by default). */
  const button = (label = 'Chọn tệp') => {
    hook = 0;
    const tree = module.exports.default({
      value: [],
      messages: 'refused',
      onChange: (files) => changes.push(files.map((f) => f.fileName)),
      onPickingChange: (picking) => locks.push(picking),
      onError: (message) => errors.push(message),
      ...props,
    });
    mounted = true;
    return find(tree, (node) => node.props.label === label).props;
  };
  const assets = (...names) => ({
    canceled: false,
    assets: names.map((name) => ({ uri: `file://${name}`, name, mimeType: 'application/pdf' })),
  });
  return {
    button,
    assets,
    imagePicker,
    writes: () => writes,
    changes,
    locks,
    errors,
    discarded,
    picks,
    sizes,
    measure: () =>
      sizes.splice(0).forEach((d) => d.resolve({ exists: true, isDirectory: false, size: 10 })),
    unmount: () => cleanups.forEach((cleanup) => cleanup?.()),
  };
}

test('RB-01: the picker lock covers the whole selection and also ends on cancel', async () => {
  const picker = mountPicker({});
  picker.button().onClick();
  assert.deepEqual(picker.locks, [true]);
  picker.picks[0].resolve(picker.assets('a.pdf'));
  await tick();
  // The system picker is gone but the file is still being read.
  assert.deepEqual([picker.locks, picker.changes], [[true], []]);
  picker.measure();
  await tick();
  assert.deepEqual(plain(picker.changes), [['a.pdf']]);
  assert.deepEqual(picker.locks, [true, false]);

  picker.button().onClick();
  picker.picks[1].resolve({ canceled: true });
  await tick();
  assert.deepEqual(picker.locks, [true, false, true, false]);
  assert.equal(picker.changes.length, 1);
});

test('RB-01: a field that went away hands over nothing and releases the lock once', async () => {
  for (const outcome of ['files', 'failure']) {
    const picker = mountPicker({});
    picker.button().onClick();
    picker.picks[0].resolve(picker.assets('late.pdf'));
    await tick();
    picker.unmount();
    assert.deepEqual(picker.locks, [true, false]);
    if (outcome === 'files') picker.measure();
    else picker.sizes[0].reject(new Error('gone'));
    await tick();
    assert.deepEqual([picker.changes, picker.errors, picker.locks], [[], [], [true, false]]);
    // RD-13: the copy of a selection nobody receives is removed.
    assert.deepEqual(picker.discarded, ['file://late.pdf']);
  }
});

test('RB-09: replace swaps the list and allows five new files; the default still appends', async () => {
  const value = ['1', '2', '3', '4'].map((n) => file(`${n}.pdf`, 'application/pdf'));
  const choose = async (picker, ...names) => {
    picker.button().onClick();
    picker.picks.at(-1).resolve(picker.assets(...names));
    await tick();
    picker.measure();
    await tick();
  };
  const five = ['a', 'b', 'c', 'd', 'e'].map((n) => `${n}.pdf`);
  const replacing = mountPicker({ value, maxCount: 5, replace: true });
  await choose(replacing, 'b.pdf');
  await choose(replacing, ...five);
  await choose(replacing, ...five, 'f.pdf');
  assert.deepEqual(plain(replacing.changes), [['b.pdf'], five]);
  assert.deepEqual(replacing.errors, ['refused']);
  // Only the refused selection of six is dropped here; accepted files belong to the caller.
  assert.equal(replacing.discarded.length, 6);

  const appending = mountPicker({ value, maxCount: 5 });
  await choose(appending, 'b.pdf');
  await choose(appending, 'b.pdf', 'c.pdf');
  assert.deepEqual(plain(appending.changes), [['1.pdf', '2.pdf', '3.pdf', '4.pdf', 'b.pdf']]);
  assert.deepEqual(appending.errors, ['refused']);
});

const mobile = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r\n/g, '\n');

test('RB-02, RB-09, RB-12, RB-13: screen wiring', () => {
  const modal = mobile('components/rental/onboarding/RentalPaymentModal.tsx');
  assert.ok(modal.includes('if (flow.bind(next.id)) setShowReportForm(false);'));
  assert.match(modal, /onPickingChange=\{flow\.setPicking\}/);
  assert.match(
    mobile('components/rental/onboarding/RentalWorkflowPanel.tsx'),
    /maxCount=\{5\}\s+replace\s+onPickingChange=\{setPicking\}[\s\S]*?setFiles\(next\);\s+setAck\(false\);/
  );
  // Remounting on a change re-applies defaultOpen; the accordion stays uncontrolled (closable).
  assert.match(
    mobile('components/rental/onboarding/RentalOnboardingPanel.tsx'),
    /key=\{String\(startRequested\)\}\s+title=\{`Đề nghị bắt đầu sớm[^\n]+\s+defaultOpen=\{startRequested\}>/
  );
  const share = modal.slice(
    modal.indexOf('async function downloadQr'),
    modal.indexOf('const showQr')
  );
  assert.ok(share.includes('Sharing.shareAsync'));
  assert.ok(!share.includes('toast.'));
  assert.ok(modal.includes('label="Tải mã QR"'));
});

test('B-203: a deferred follow-up read does not start; a later call reads again', async () => {
  const reads = [];
  let hidden = false;
  let kept = 0;
  const refresh = logic.createCoalesced(
    async () => {
      const d = deferred();
      reads.push(d);
      await d.promise;
    },
    () => true,
    () => {
      if (!hidden) return false;
      kept++;
      return true;
    }
  );
  const first = refresh();
  await tick();
  refresh();
  hidden = true;
  reads[0].resolve();
  await first;
  assert.deepEqual([reads.length, kept], [1, 1]);
  hidden = false;
  const again = refresh();
  await tick();
  reads[1].resolve();
  await again;
  assert.deepEqual([reads.length, kept], [2, 1]);
});

test('B-142: a closed field does not open the camera after the permission answer', async () => {
  const picker = mountPicker({ camera: true, types: ['image/png'] });
  const permission = deferred();
  let opened = 0;
  Object.assign(picker.imagePicker, {
    requestCameraPermissionsAsync: () => permission.promise,
    launchCameraAsync: async () => {
      opened++;
      return { canceled: true };
    },
  });
  picker.button('Chụp ảnh').onClick();
  picker.unmount();
  const writes = picker.writes();
  permission.resolve({ granted: true });
  await tick();
  assert.deepEqual([opened, picker.writes(), plain(picker.locks)], [0, writes, [true, false]]);
});

test('web comparison fixes: screen wiring', () => {
  const rental = (name) => mobile(`components/rental/${name}`);
  const modal = rental('onboarding/RentalPaymentModal.tsx');
  // B-110: no sheet before the viewer id; the id is part of the key.
  assert.match(modal, /if \(!viewerId\) return null;/);
  assert.ok(modal.includes('key={`${viewerId}:${props.request.id}:'));
  // B-122
  const title = 'Sao chép toàn bộ thông tin chuyển khoản';
  assert.ok(read(MODAL).includes(`title="${title}"`));
  assert.ok(modal.includes(`hint="${title}"`));
  // B-142: every system UI of the QR download waits for a mounted sheet.
  const share = modal.slice(
    modal.indexOf('async function downloadQr'),
    modal.indexOf('const showQr')
  );
  assert.match(share, /if \(mounted\.current\)\s+await shareRentalFile/);
  assert.match(share, /if \(mounted\.current\) await openUrl/);
  assert.match(share, /if \(mounted\.current\) setSaving\(false\)/);
  // B-013, B-014
  assert.ok(rental('shared/NextActionCard.tsx').includes('{system && !view?.mine ? ('));
  assert.ok(rental('shared/ActionButton.tsx').includes("link && !off ? 'link' : 'button'"));
  assert.ok(rental('contract/ContractPage.tsx').includes('link: Boolean(button.link),'));
  // B-026
  assert.match(
    rental('onboarding/RentalOnboardingPanel.tsx'),
    /accessibilityRole="progressbar"\s+accessibilityLabel="Đang tải tiến trình"/
  );
  // B-200, B-203, B-209, B-210
  const workflow = rental('onboarding/RentalWorkflowPanel.tsx');
  const close = 'Đóng cửa sổ chấm dứt sớm';
  assert.ok(read(WORKFLOW).includes(`aria-label="${close}"`));
  assert.ok(workflow.includes(`closeLabel="${close}"`));
  assert.match(workflow, /plusMinus/);
  assert.match(workflow, /hiddenDirty\.current = false;\s+void refresh\(\);/);
  const namePattern = '/[.](jpe?g|png|webp|pdf)$/i';
  assert.ok(read(WORKFLOW).includes(namePattern));
  assert.ok(workflow.includes(`const FILE_NAME = ${namePattern};`));
  assert.ok(workflow.includes('namePattern={FILE_NAME}'));
  assert.match(workflow, /onlyAvailable\s/);
});
