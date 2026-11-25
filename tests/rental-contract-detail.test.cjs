/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Decisions of src/components/rental/contract/contractDetailLogic.ts. The web keeps them inside
// .tsx components: where a block can be cut out by its text, the web code itself is run next to the
// port (a web change turns this red); the rest is checked by hand against the web lines.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const SRC = path.resolve(__dirname, '../src');
const web = (file) => fs.readFileSync(path.join(WEB, file), 'utf8').replace(/\r\n/g, '\n');

const transpile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  vm.runInNewContext(transpile(fs.readFileSync(file, 'utf8')), {
    AbortController,
    Error,
    setTimeout,
    clearTimeout,
    module,
    exports: module.exports,
    require: (request) => {
      if (request.startsWith('@/')) return load(`${path.join(SRC, request.slice(2))}.ts`);
      if (request.startsWith('.')) return load(`${path.resolve(path.dirname(file), request)}.ts`);
      return require(request);
    },
  });
  return module.exports;
}
const logic = load(path.join(SRC, 'components/rental/contract/contractDetailLogic.ts'));
const { deriveNextStep, primaryLabel } = load(path.join(SRC, 'lib/rental/nextStep.ts'));
const { describeNextAction } = load(path.join(SRC, 'lib/rental/rental-labels.ts'));
// Objects made inside the vm have another Object prototype.
const plain = (value) => JSON.parse(JSON.stringify(value));
const same = (actual, expected, message) =>
  assert.deepEqual(plain(actual), plain(expected), message);

function cut(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `web source changed around: ${from}`);
  return source.slice(start, end);
}

const STATUSES = [
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
const TABS = ['overview', 'sign', 'payment', 'end', 'content', 'history'];

test('next-step card buttons match web ContractPage for status x role x open tab', () => {
  const block = cut(
    web('components/contract/page/ContractPage.tsx'),
    '  let primary: CardAction | undefined;',
    '  const card = preActive'
  );
  const runWeb = vm.runInNewContext(
    transpile(
      `(view, step, active, primaryLabel, setTab, linkHref) => {\n${block}\nreturn { primary, secondary };\n}`
    )
  );
  const lifecycle = (closure, bills) => ({
    billing: { bills },
    closure,
    renewals: [],
    canProposeClosure: true,
  });
  const bill = (status, paymentStatus) => ({
    id: 'b1',
    status,
    paymentStatus,
    periodIndex: 2,
    paymentPeriodNumber: 2,
    totalAmount: 10,
    canResolveOverdue: true,
  });
  const lifecycles = [
    null,
    lifecycle(null, []),
    lifecycle(null, [bill('UNPAID')]),
    lifecycle(null, [bill('OVERDUE')]),
    lifecycle(null, [bill('DRAFT')]),
    lifecycle(null, [bill('UNPAID', 'TRANSFER_REPORTED')]),
    lifecycle({ status: 'PROPOSED' }, []),
    lifecycle({ status: 'REFUND_PENDING' }, []),
    lifecycle({ status: 'BALANCE_PENDING' }, []),
  ];
  const nextActions = [
    null,
    { code: 'PAY_DEPOSIT', actor: 'TENANT' },
    { code: 'SIGN_LEASE_LANDLORD', actor: 'LANDLORD' },
    { code: 'NONE', actor: 'NONE' },
  ];
  let checked = 0;
  for (const role of ['LANDLORD', 'TENANT'])
    for (const active of TABS) {
      const cases = [
        ...nextActions.map((next) => ({ view: describeNextAction(next, role), step: null })),
        ...STATUSES.flatMap((status) =>
          [null, 'root'].flatMap((parentContractId) =>
            lifecycles.map((data) => ({
              view: null,
              step: deriveNextStep({
                role,
                actorId: 'me',
                contract: { status, parentContractId },
                lifecycle: data,
                proposals: [],
              }),
            }))
          )
        ),
      ];
      for (const { view, step } of cases) {
        const clicks = [];
        const theirs = runWeb(
          view,
          step,
          active,
          primaryLabel,
          (tab) => clicks.push(tab),
          (link) => link
        );
        const normalize = (action) => {
          if (!action) return undefined;
          clicks.length = 0;
          action.onClick?.();
          return {
            label: action.label,
            ...(clicks.length ? { tab: clicks[0] } : { link: action.href }),
          };
        };
        const ours = logic.stepButtons({ view, step, active });
        same(
          { primary: ours.primary, secondary: ours.secondary },
          { primary: normalize(theirs.primary), secondary: theirs.secondary.map(normalize) }
        );
        checked++;
      }
    }
  assert.equal(checked, 2 * TABS.length * (4 + STATUSES.length * 2 * 9));
  assert.equal(logic.pageStep(true, true, true, false), 'server');
  assert.equal(logic.pageStep(true, false, true, false), 'error');
  assert.equal(logic.pageStep(true, false, false, false), 'loading');
  assert.equal(logic.pageStep(false, false, false, true), 'derived');
  assert.equal(logic.pageStep(false, true, false, false), null);
});

test('draft bar visibility matches the web expression', () => {
  const expression = cut(
    web('components/contract/detail/ContractHeader.tsx'),
    'isLandlord && contract.status === "DRAFT"',
    ' && (\n        <div role="region"'
  );
  const runWeb = vm.runInNewContext(
    `(isLandlord, contract, cancellationRefundPending, workspace, hasReadyDoc, smartCaMode, listingSyncAction) => Boolean(${expression})`
  );
  const flags = [false, true];
  for (const status of STATUSES)
    for (let bits = 0; bits < 64; bits++) {
      const [isLandlord, refund, editing, ready, smartCa, sync] = [0, 1, 2, 3, 4, 5].map(
        (i) => flags[(bits >> i) & 1]
      );
      assert.equal(
        logic.showDraftBar({
          isLandlord,
          status,
          cancellationRefundPending: refund,
          amendmentEditing: editing,
          hasReadyDoc: ready,
          smartCaMode: smartCa,
          hasListingSync: sync,
        }),
        runWeb(isLandlord, { status }, refund, { editing }, ready, smartCa, sync)
      );
    }
});

test('header document buttons: labels and visibility (HD:105-106, :180-201)', () => {
  const doc = (extra) => ({
    id: 'd',
    contractId: 'c',
    documentType: 'PDF',
    purpose: 'PREVIEW',
    status: 'READY',
    viewUrl: 'v',
    downloadUrl: 'u',
    ...extra,
  });
  const lease = (status, extra) => ({ status, ...extra });
  const active = logic.documentButtons(lease('ACTIVE'), null);
  assert.equal(active.view, 'Xem hợp đồng đang áp dụng');
  assert.equal(active.download, 'Tải PDF đang áp dụng');
  assert.equal(
    logic.documentButtons(lease('ACTIVE', { agreedEarlyEndExclusive: '2027-01-01' }), null).view,
    'Xem phụ lục chấm dứt đang áp dụng'
  );
  assert.equal(logic.documentButtons(lease('DRAFT'), doc()).view, 'Xem bản soạn thảo');
  assert.equal(logic.documentButtons(lease('DRAFT'), doc()).download, 'Tải bản PDF');
  assert.equal(
    logic.documentButtons(lease('TENANT_SIGNATURE_PENDING'), doc({ purpose: 'SIGNED_LANDLORD' }))
      .view,
    'Xem bản đang ký'
  );
  // The deposit page and a dirty draft pass no document.
  same(
    [
      logic.documentButtons(lease('DRAFT'), null).view,
      logic.documentButtons(lease('CLOSED'), null).download,
    ],
    [null, null]
  );
  // A signed final PDF without links is still offered (verified content endpoint).
  const signed = logic.documentButtons(
    lease('EXPIRED'),
    doc({ purpose: 'SIGNED_FINAL', storageObjectId: 's', viewUrl: null, downloadUrl: null })
  );
  assert.equal(signed.view, 'Xem bản đã ký');
  assert.equal(signed.download, 'Tải PDF đã ký');
  // A pending addendum is not "effective"; a signed one also offers its own copy.
  const child = { parentContractId: 'root', agreementKind: 'AMENDMENT' };
  assert.equal(logic.documentButtons(lease('DRAFT', child), doc()).effective, false);
  assert.equal(logic.documentButtons(lease('ACTIVE', child), doc()).ownAppendix, true);
  assert.equal(
    logic.documentButtons(lease('ACTIVE', { ...child, agreementKind: null }), doc()).effective,
    false
  );
});

test('opening a document re-reads it and never falls back to an older file (HD:107-124)', async () => {
  const latest = { id: 'd', contractId: 'c' };
  const read = (fresh, effective, download = false) =>
    logic.readFreshDocument(
      { contractId: 'c', effective, latest, download },
      { getEffectiveDocument: async () => fresh, getDocument: async () => fresh }
    );
  const ready = { ...latest, status: 'READY', documentType: 'PDF', purpose: 'PREVIEW' };
  assert.equal((await read({ ...ready, viewUrl: 'v' }, false)).viewUrl, 'v');
  await assert.rejects(read({ ...ready, viewUrl: 'v' }, false, true), {
    message: logic.DOCUMENT_OPEN_FAILED,
  });
  await assert.rejects(read({ ...ready, contractId: 'other', viewUrl: 'v' }, false), {
    message: logic.DOCUMENT_OPEN_FAILED,
  });
  await assert.rejects(read(null, true), { message: logic.EFFECTIVE_OPEN_FAILED });
  await assert.rejects(read({ ...ready, viewUrl: 'v' }, true), {
    message: logic.EFFECTIVE_OPEN_FAILED,
  });
  assert.ok(await read({ ...ready, purpose: 'SIGNED_FINAL', storageObjectId: 's' }, true));
});

test('render, send buttons and bar text; every label exists in the web header', () => {
  const idle = { rendering: false, reconciling: false, sending: false };
  const review = { saving: false, retry: false, locked: false };
  const labels = [
    logic.renderButton({ ...idle, gateAllowed: true }).label,
    logic.renderButton({ ...idle, review, gateAllowed: true }).label,
    logic.renderButton({ ...idle, review: { ...review, retry: true }, gateAllowed: true }).label,
    logic.renderButton({ ...idle, review: { ...review, saving: true }, gateAllowed: true }).label,
    logic.renderButton({ ...idle, reconciling: true, gateAllowed: true }).label,
    logic.renderButton({ ...idle, rendering: true, gateAllowed: true }).label,
    logic.sendButton({ ...idle, complete: false, hasReadyDoc: false }).reason,
    logic.sendButton({ ...idle, complete: true, hasReadyDoc: false }).reason,
    logic.draftBarText(true),
    logic.draftBarText(false),
    logic.draftBarText(false, review),
    logic.draftBarText(false, { retry: true }),
    logic.DOCUMENT_OPEN_FAILED,
    logic.EFFECTIVE_OPEN_FAILED,
    logic.paymentLine({ agreementKind: 'AMENDMENT' }).text,
    logic.paymentLine({ paymentStatus: 'PAID_MOCK' }).text,
    logic.paymentLine({ paymentStatus: 'UNPAID' }).text,
    logic.headerPill({ status: 'ACTIVE', agreementKind: 'AMENDMENT' }, 'x'),
    logic.headerPill({ status: 'ACTIVE' }, 'x', true),
  ];
  const header = web('components/contract/detail/ContractHeader.tsx');
  for (const label of labels) assert.ok(header.includes(label), `not in the web header: ${label}`);
  assert.equal(
    logic.renderButton({ ...idle, review: { ...review, locked: true }, gateAllowed: true })
      .disabled,
    true
  );
  assert.equal(logic.renderButton({ ...idle, gateAllowed: false }).disabled, true);
  assert.equal(logic.sendButton({ ...idle, complete: true, hasReadyDoc: true }).disabled, false);
  assert.equal(
    logic.sendButton({ ...idle, complete: true, hasReadyDoc: true, gateTitle: 'lock' }).reason,
    'lock'
  );
});

test('tabs, viewer side and end-tab blocks', () => {
  same(logic.availableTabs({ agreementKind: 'DEPOSIT' }), [
    'overview',
    'sign',
    'payment',
    'end',
    'history',
  ]);
  same(logic.availableTabs({}), TABS);
  same(logic.availableTabs({ parentContractId: 'r' }), ['overview', 'sign', 'content']);
  const parties = { landlordId: 'l', tenantId: 't' };
  same(logic.viewerSide('landlord', 'l', parties), { isLandlord: true, isTenant: false });
  // The right account on the wrong side is not a party.
  same(logic.viewerSide('tenant', 'l', parties), { isLandlord: false, isTenant: false });
  same(logic.viewerSide('tenant', undefined, parties), { isLandlord: false, isTenant: false });
  const blocks = (status, preActive = false, parentContractId = null) =>
    Object.entries(logic.endBlocks({ status, parentContractId }, preActive))
      .filter(([, on]) => on)
      .map(([name]) => name);
  same(blocks('ACTIVE'), ['earlyExit', 'renewal', 'amendments', 'complaint']);
  same(blocks('EXPIRED'), ['earlyExit', 'amendments']);
  same(blocks('CLOSED'), ['earlyExit', 'amendments']);
  same(blocks('TERMINATED'), ['earlyExit']);
  same(blocks('DRAFT', true), []);
  same(blocks('ACTIVE', false, 'root'), []);
});

test('landing routing (LD:19-60)', async () => {
  const base = { id: 'c1', landlordId: 'l', tenantId: 't', rentalRequestId: 'r1' };
  const resolve = (contract, { userId = 't', documents = [], query = {}, fail } = {}) =>
    logic.resolveLanding(
      { userId, contractId: 'c1', query },
      {
        getContract: async () => {
          if (fail !== undefined) throw fail ? { response: { status: fail } } : new Error('net');
          return contract;
        },
        earlyExitDocuments: async () => documents,
      }
    );
  same(await resolve(base, { query: { tab: 'sign' } }), {
    kind: 'redirect',
    target: { screen: 'contract-detail', side: 'tenant', contractId: 'c1', tab: 'sign' },
  });
  same(
    await resolve(
      { ...base, depositAgreementContractId: 'dep' },
      { userId: 'l', query: { section: 'deposit' } }
    ),
    {
      kind: 'redirect',
      target: { screen: 'contract-detail', side: 'landlord', contractId: 'dep', tab: 'payment' },
    }
  );
  assert.equal((await resolve(base, { userId: 'stranger' })).kind, 'missing');
  assert.equal((await resolve({ ...base, id: 'other' })).kind, 'missing');
  for (const status of [400, 403, 404])
    assert.equal((await resolve(base, { fail: status })).kind, 'missing');
  assert.equal((await resolve(base, { fail: 500 })).kind, 'retry');
  assert.equal((await resolve(base, { fail: 0 })).kind, 'retry');
  const workflow = { ...base, agreementKind: 'WORKFLOW', parentContractId: 'root' };
  assert.equal((await resolve({ ...workflow, parentContractId: null })).kind, 'missing');
  same(await resolve(workflow, { documents: [{ signingContractId: 'c1' }] }), {
    kind: 'workflow',
    rootId: 'root',
    side: 'tenant',
    earlyExitRentalRequestId: 'r1',
  });
  same(await resolve(workflow, { documents: [{ signingContractId: 'x' }] }), {
    kind: 'workflow',
    rootId: 'root',
    side: 'tenant',
  });
});

// ---------------------------------------------------------------- save + render flow

const ready = (revisionId, extra) => ({
  id: `doc-${revisionId}`,
  revisionId,
  status: 'READY',
  storageObjectId: 's',
  documentType: 'PDF',
  ...extra,
});
const httpError = (status, code, message) =>
  Object.assign(new Error(message ?? 'x'), {
    isAxiosError: true,
    response: { status, data: { code, message } },
  });

async function flow(overrides = {}, { payload = {}, reviewDraft = true, abortOn } = {}) {
  const calls = [];
  const io = {
    updateRevision: async () => ({ id: 'r2' }),
    triggerPreview: async (_id, _signal, expected) => {
      calls.push(`trigger:${expected}`);
      return ready('r2');
    },
    getPreviewStatus: async () => ready('r2'),
    getCompleteness: async () => ({ revisionId: 'r2', complete: true }),
    getDocuments: async () => [ready('r2')],
    ...overrides,
  };
  for (const name of Object.keys(io)) {
    const original = io[name];
    io[name] = (...args) => {
      calls.push(name);
      return original(...args);
    };
  }
  const events = [];
  const controller = new AbortController();
  await logic.runDraftRender(
    io,
    { contractId: 'c', revision: { id: 'r1' }, payload, reviewDraft },
    controller.signal,
    () => true,
    (event) => {
      events.push(event);
      if (event.type === abortOn) controller.abort();
    },
    { wait: async () => {} }
  );
  return {
    calls,
    events,
    types: events.map((e) => e.type),
    find: (type) => events.find((e) => e.type === type),
  };
}

test('save then render: new revision id is expected and the lists are re-read', async () => {
  const run = await flow();
  same(run.types, ['saving', 'saved', 'rendering', 'preview', 'refreshed']);
  assert.ok(run.calls.includes('trigger:r2'));
  assert.equal(
    run.find('preview').message,
    'Đã lưu và kết xuất PDF. Bạn có thể xem lại trước khi ký.'
  );
  assert.equal(run.find('refreshed').completeness.complete, true);
  // A locally known document of the new revision survives a lagging list.
  same(
    run
      .find('refreshed')
      .documents([ready('r2', { id: 'new' }), ready('r1')])
      .map((d) => d.id),
    ['doc-r2', 'new']
  );
});

test('a saved draft moves the contract to the new revision, so its file can be signed', async () => {
  const { signingSource } = load(path.join(SRC, 'components/rental/contract/signingLogic.ts'));
  const contract = { id: 'c', status: 'DRAFT', currentRevisionId: 'r1' };
  const documents = [ready('r2', { contractId: 'c', purpose: 'PREVIEW' })];
  const source = (c) => signingSource(documents, c, 'INTERNAL', 'u');
  assert.equal(source(contract), null, 'the stale contract finds no file');
  // The save is announced even when the render then fails or the screen aborts it.
  const failing = async () => {
    throw httpError(400, 1, 'x');
  };
  for (const [overrides, options] of [
    [{}, {}],
    [{ triggerPreview: failing }, {}],
    [{}, { abortOn: 'saved' }],
  ]) {
    const save = { updateRevision: async () => ({ id: 'r2', contractId: 'c' }) };
    const run = await flow({ ...save, ...overrides }, options);
    const patched = logic.withSavedRevision(contract, run.find('saved').revision);
    assert.equal(source(patched), 'u|c|r2|doc-r2');
  }
  const other = { id: 'other', currentRevisionId: 'r1' };
  assert.equal(logic.withSavedRevision(other, { id: 'r2', contractId: 'c' }), other);
  assert.equal(logic.withSavedRevision(null, { id: 'r2', contractId: 'c' }), null);
  // The wiring (no component render here).
  const read = (file) => fs.readFileSync(path.join(SRC, file), 'utf8');
  assert.match(
    read('components/rental/contract/useLeaseDraft.ts'),
    /input\.onSaved\(event\.revision\)/
  );
  assert.match(
    read('screens/rental/ContractDetailScreen.tsx'),
    /withSavedRevision\(previous, saved\)/
  );
});

test('error 6072 on save: conflict, no preview, no retry', async () => {
  const run = await flow({
    updateRevision: async () => {
      throw httpError(409, 6072, 'Bản nháp đã cũ');
    },
  });
  same(run.types, ['saving', 'failed']);
  same(run.find('failed'), {
    type: 'failed',
    conflict: true,
    retry: false,
    message: 'Bản nháp đã cũ',
  });
  assert.ok(!run.calls.includes('triggerPreview'));
});

test('render error after a save keeps the save, offers retry and prefixes the message', async () => {
  const run = await flow({
    triggerPreview: async () => {
      throw httpError(400, 1, 'Thiếu mẫu');
    },
  });
  same(run.find('failed'), {
    type: 'failed',
    conflict: false,
    retry: true,
    message: 'Đã lưu bản nháp. Thiếu mẫu',
  });
  assert.equal(run.types.at(-1), 'refreshed');
});

test('uncertain render result: one POST, then polling only', async () => {
  let polls = 0;
  const found = await flow({
    triggerPreview: async () => {
      throw httpError(504);
    },
    getPreviewStatus: async () => (++polls < 3 ? ready('r1') : ready('r2')),
  });
  assert.equal(polls, 3);
  assert.equal(found.calls.filter((c) => c === 'triggerPreview').length, 1);
  assert.ok(found.types.includes('reconciling'));
  assert.equal(found.find('preview').doc.revisionId, 'r2');

  // 20 reads without the right PDF: unknown, not failed.
  const unknown = await flow(
    {
      triggerPreview: async () => {
        throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
      },
      getPreviewStatus: async () => ready('r2', { documentType: 'DOCX' }),
    },
    { payload: null }
  );
  assert.equal(unknown.calls.filter((c) => c === 'getPreviewStatus').length, 20);
  assert.equal(unknown.find('preview').doc, null);
  assert.equal(
    unknown.find('preview').message,
    'Chưa xác nhận được kết quả kết xuất. Bạn có thể thử kết xuất lại.'
  );
  assert.ok(!unknown.types.includes('failed') && !unknown.types.includes('refreshed'));
});

test('a child document renders without an expected revision; abort stops every event', async () => {
  const child = await flow(
    {
      triggerPreview: async (_id, _signal, expected) => {
        assert.equal(expected, undefined);
        return ready('r1', { documentType: 'DOCX' });
      },
      getCompleteness: async () => ({ revisionId: 'older' }),
    },
    { payload: null, reviewDraft: false }
  );
  same(child.types, ['rendering', 'preview', 'refreshed']);
  assert.equal(child.find('preview').message, 'Đã tạo bản xem trước hợp đồng.');
  assert.equal(child.find('refreshed').completeness, undefined);

  const left = await flow({}, { abortOn: 'rendering' });
  same(left.types, ['saving', 'saved', 'rendering']);
  assert.ok(!left.calls.includes('getDocuments') || left.types.length === 3);
});

test('draft input checks that stand in for reportValidity', () => {
  const base = {
    landlord: { bankAccountNumber: 'abc', email: 'a@b' },
    tenant: { occupantCount: 1, motorbikeCount: 0, carCount: 0 },
  };
  same(logic.draftFieldErrors(base, base), {});
  const bad = logic.draftFieldErrors(base, {
    landlord: { bankAccountNumber: '12a', email: 'x' },
    tenant: { occupantCount: '0', motorbikeCount: '', carCount: '101' },
  });
  same(Object.keys(bad).sort(), [
    'landlord.bankAccountNumber',
    'landlord.email',
    'tenant.carCount',
    'tenant.motorbikeCount',
    'tenant.occupantCount',
  ]);
});

test('missing fields, invoices summary, summary facts and invoice inputs', () => {
  const completeness = {
    complete: false,
    totalFields: 20,
    missingFields: [
      { key: 'meters.electricityInitial', label: 'a' },
      { key: 'landlord.phone', label: 'b' },
      { key: 'landlord.idNumber', label: 'c' },
    ],
  };
  const summary = logic.missingFieldsSummary({
    completeness,
    isLandlord: true,
    meterFields: ['electricity'],
    hasLandlordPhone: true,
  });
  assert.equal(summary.count, 2);
  assert.equal(summary.filled, 18);
  assert.equal(summary.kycLink, true);
  assert.equal(logic.missingFieldsSummary({ completeness: null, isLandlord: false }).count, 0);

  assert.equal(logic.invoiceSummary(null, 'TENANT').title, 'Đang tải tình trạng hóa đơn…');
  assert.equal(
    logic.invoiceSummary([{ status: 'PAID', totalAmount: 1 }], 'TENANT').title,
    'Không có hóa đơn nào đang chờ xử lý'
  );
  same(
    logic.invoiceSummary(
      [
        { status: 'DRAFT', totalAmount: 500 },
        { status: 'OVERDUE', totalAmount: 1000 },
      ],
      'LANDLORD'
    ),
    { title: '2 hóa đơn chưa hoàn tất · 1.000 đ', detail: '1 hóa đơn đã quá hạn' }
  );

  const { facts, cards } = logic.leaseSummary({
    contract: { agreedEarlyEndExclusive: '2027-03-01' },
    isLandlord: false,
    landlord: { fullName: 'Chủ' },
    tenant: {},
    property: { fullAddress: '1 Đường A', propertyType: 'Căn hộ' },
    lease: { startDateText: '01/01/2027', endDateText: '31/12/2027' },
    financial: { amountNumber: '5.000.000', depositAmountValue: 0 },
  });
  assert.equal(facts[0].label, 'Chủ nhà');
  assert.equal(facts[2].sub, 'Cọc: không đặt cọc');
  assert.equal(facts[3].value, '01/01/2027 – 28/02/2027');
  same(cards[2].rows[2], ['Thời hạn', 'Rút ngắn theo phụ lục chấm dứt sớm']);
  assert.equal(logic.depositFacts(null)[1].value, undefined);

  same(
    logic.monthlyInvoiceInputs({
      charges: [
        { chargeType: 'ELECTRICITY', billingMethod: 'PER_KWH' },
        { chargeType: 'WATER', billingMethod: 'STATE_WATER_RATE' },
      ],
      meters: { electricityInitial: 0 },
    }),
    {
      electricityRequired: true,
      waterRequired: false,
      unsupportedWaterRate: true,
      initialElectricity: '0',
    }
  );
});
