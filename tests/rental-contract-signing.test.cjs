/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Signing decisions of src/components/rental/contract/signingLogic.ts. The web keeps them inside
// .tsx components, so the whole web component is run with a stub React and its drawn text is
// compared: a web change to a branch fails here too.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const SRC = path.resolve(__dirname, '../src');

const transpile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  vm.runInNewContext(transpile(fs.readFileSync(file, 'utf8')), {
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
const logic = load(path.join(SRC, 'components/rental/contract/signingLogic.ts'));

const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
const hooks = {
  useState: (initial) => [initial, () => {}],
  useRef: (current) => ({ current }),
  useCallback: (fn) => fn,
  useEffect: () => {},
};
const anything = new Proxy({}, { get: (_, name) => String(name) });
function webComponent(name) {
  const module = { exports: {} };
  const stubs = {
    react: { __esModule: true, default: React, ...hooks },
    'lucide-react': anything,
    sonner: { toast: {} },
    './utils': { str: (value) => String(value) },
    '@/components/common/PolicyDialog': { PolicyNotice: 'PolicyNotice' },
    '@/services/contract.service': { contractService: {} },
    '@/utils/apiError': { getApiErrorMessage: () => '' },
    '@/hooks/usePermission': { useFeatureGate: () => ({ allowed: true }) },
    '@/lib/permissions': { PERMISSIONS: {} },
  };
  const source = fs.readFileSync(path.join(WEB, `components/contract/detail/${name}.tsx`), 'utf8');
  vm.runInNewContext(transpile(source), {
    React,
    module,
    exports: module.exports,
    require: (request) => {
      assert.ok(request in stubs, `new web import in ${name}: ${request}`);
      return stubs[request];
    },
  });
  return module.exports.default;
}
const text = (node) =>
  node == null || typeof node === 'boolean'
    ? ''
    : Array.isArray(node)
      ? node.map(text).join('')
      : typeof node === 'object'
        ? text(node.children)
        : String(node);

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
const REQUEST_STATUSES = [
  null,
  'CREATED',
  'PENDING_USER_CONFIRMATION',
  'PROVIDER_SIGNED',
  'EMBEDDING',
  'SIGNED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
];
const ROLES = [
  { isLandlord: true, isTenant: false },
  { isLandlord: false, isTenant: true },
  { isLandlord: false, isTenant: false },
];
const product = (axes) =>
  Object.entries(axes).reduce(
    (rows, [key, values]) => rows.flatMap((row) => values.map((v) => ({ ...row, [key]: v }))),
    [{}]
  );

test('SmartCA: same branch and same signer as the web panel for every status and role', () => {
  const Web = webComponent('SmartCaSignaturePanel');
  const SEND = 'Gửi yêu cầu ký tới SmartCA';
  const CHECK = 'Kiểm tra ngay';
  const cases = product({
    status: CONTRACT_STATUSES,
    role: ROLES,
    requestStatus: REQUEST_STATUSES,
    failureCode: [undefined, 'PROVIDER_STATE_UNKNOWN'],
    failureReason: [undefined, 'Lý do từ máy chủ.'],
    smartCaEnabled: [true, false],
    signingAllowed: [true, false],
    agreementKind: ['LEASE', 'DEPOSIT', 'AMENDMENT'],
  });
  const signers = new Set();
  for (const row of cases) {
    const contract = { id: 'c', status: row.status, agreementKind: row.agreementKind };
    const request = row.requestStatus && {
      id: 'r',
      status: row.requestStatus,
      failureCode: row.failureCode,
      failureReason: row.failureReason,
    };
    const state = { smartCaEnabled: row.smartCaEnabled, activeRequest: request };
    const drawn = text(
      Web({ contract, state, ...row.role, hasReadyPdf: true, signingAllowed: row.signingAllowed })
    );
    const view = logic.smartCaView({
      contract,
      smartCaEnabled: row.smartCaEnabled,
      request,
      ...row.role,
      signingAllowed: row.signingAllowed,
    });
    const where = JSON.stringify(row);
    if (view.kind === 'sign') {
      assert.equal(drawn.includes(CHECK), view.pending, where);
      assert.equal(drawn.includes(SEND), !view.pending, where);
      if (!view.pending)
        signers.add(`${row.status}:${row.role.isLandlord ? 'L' : row.role.isTenant ? 'T' : '-'}`);
    } else {
      assert.ok(drawn.includes(view.message), `${where}\n${drawn}\n${view.message}`);
      assert.ok(!drawn.includes(SEND) && !drawn.includes(CHECK), where);
    }
  }
  // WC-1 follows the web: the landlord only gets the signing form on DRAFT.
  assert.deepEqual([...signers].sort(), ['DRAFT:L', 'TENANT_SIGNATURE_PENDING:T']);
});

test('SmartCA: blocked reason and fresh server state win', () => {
  assert.equal(
    logic.smartCaView({
      contract: { status: 'DRAFT' },
      smartCaEnabled: true,
      request: null,
      isLandlord: true,
      isTenant: false,
      signingAllowed: false,
      blockedReason: 'Chờ tiền cọc.',
    }).message,
    'Chờ tiền cọc.'
  );
  const source = { id: 'r', status: 'PENDING_USER_CONFIRMATION' };
  const request = { id: 'r', status: 'SIGNED' };
  const local = { contractId: 'c', source, request };
  assert.equal(logic.currentSignatureRequest(local, 'c', { activeRequest: source }), request);
  const reread = { ...source };
  assert.equal(logic.currentSignatureRequest(local, 'c', { activeRequest: reread }), reread);
  assert.equal(logic.currentSignatureRequest(local, 'other', { activeRequest: source }), source);
  assert.equal(logic.currentSignatureRequest(null, 'c', { activeRequest: undefined }), null);
});

test('certificate selection: one is preselected, a vanished serial is dropped', () => {
  const rows = [{ serialNumber: 'a' }, { serialNumber: 'b' }];
  assert.equal(logic.selectedSerial([rows[0]], ''), 'a');
  assert.equal(logic.selectedSerial(rows, ''), '');
  assert.equal(logic.selectedSerial(rows, 'b'), 'b');
  assert.equal(logic.selectedSerial(rows, 'gone'), '');
  assert.equal(logic.selectedSerial([], 'a'), '');
});

test('INTERNAL panel: same branch as the web for every status and role', () => {
  const Web = webComponent('ContractSignaturePanel');
  const heading = {
    active: 'Hợp đồng giao kết thành công và đang có hiệu lực',
    blocked: 'Chưa đủ điều kiện ký.',
    'landlord-draft': 'Xác nhận gửi bản hợp đồng cho người thuê',
    'tenant-pending': 'Xác nhận ký hợp đồng thuê',
    'landlord-pending': 'Đã gửi hợp đồng cho người thuê',
  };
  for (const row of product({
    status: CONTRACT_STATUSES,
    role: ROLES,
    signingAllowed: [true, false],
  })) {
    const props = { ...row.role, signingAllowed: row.signingAllowed };
    // The web component is a plain function of its props with stubbed hooks.
    const drawn = text(Web({ contract: { status: row.status }, canSend: true, ...props }));
    const view = logic.internalSignView({ status: row.status, ...props });
    if (view === null) assert.equal(drawn, '', JSON.stringify(row));
    else assert.ok(drawn.includes(heading[view]), `${JSON.stringify(row)} ${view} ${drawn}`);
  }
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('single flight drops a second tap and unlocks after a failure', async () => {
  const flight = logic.createSingleFlight();
  const first = deferred();
  let calls = 0;
  const task = () => {
    calls++;
    return first.promise;
  };
  const running = flight(task);
  await flight(task);
  assert.equal(calls, 1);
  first.reject(new Error('x'));
  await assert.rejects(running);
  await flight(async () => void calls++);
  assert.equal(calls, 2);
});

test('the footer send and the panel send share the re-read guard and one lock', async () => {
  const run = async (over) => {
    const log = [];
    await logic.submitIfCurrent({
      stillCurrent: async () => true,
      isAlive: () => true,
      refuse: (reason) => log.push(reason),
      action: async () => void log.push('sent'),
      ...over,
    });
    return log;
  };
  assert.deepEqual(await run({}), ['sent']);
  assert.deepEqual(await run({ stillCurrent: async () => false }), ['changed']);
  const unreadable = async () => {
    throw new Error('offline');
  };
  assert.deepEqual(await run({ stillCurrent: unreadable }), ['unreadable']);
  for (const stillCurrent of [async () => true, async () => false, unreadable])
    assert.deepEqual(await run({ stillCurrent, isAlive: () => false }), []);

  const screen = fs.readFileSync(path.join(SRC, 'screens/rental/ContractDetailScreen.tsx'), 'utf8');
  assert.ok(screen.includes('onSend={sendFromFooter}'));
  assert.ok(screen.includes('flight={sendFlight}'));
  assert.ok(!screen.includes('void handleSendToTenant()'));
  const footer = screen.slice(screen.indexOf('function sendFromFooter'));
  assert.ok(footer.indexOf('submitIfCurrent') < footer.indexOf('action: handleSendToTenant'));
  const panel = fs.readFileSync(
    path.join(SRC, 'components/rental/contract/ContractSignaturePanel.tsx'),
    'utf8'
  );
  assert.ok(panel.includes('submitIfCurrent') && !panel.includes('createSingleFlight)'));
});

test('signed state: one read at a time, one follow-up, late results dropped', async () => {
  const reads = [];
  const applied = [];
  const gate = logic.createSignedStateRefresh(
    () => {
      const next = deferred();
      reads.push(next);
      return next.promise;
    },
    (value) => applied.push(value)
  );
  const a = gate.refresh();
  assert.equal(gate.refresh(), a);
  assert.equal(gate.refresh(), a);
  assert.equal(reads.length, 1);
  reads[0].reject(new Error('offline'));
  await tick();
  assert.equal(reads.length, 2, 'a follow-up runs even after a failed read');
  reads[1].resolve('new');
  await a;
  assert.deepEqual(applied, ['new']);

  const failed = gate.refresh();
  reads[2].reject(new Error('offline'));
  await assert.rejects(failed, /offline/);

  const late = gate.refresh();
  gate.dispose();
  reads[3].resolve('stale');
  await late;
  assert.deepEqual(applied, ['new']);
  await gate.refresh();
  assert.equal(reads.length, 4);
});

test('a hung status check is ended by the HTTP client, not only unlocked on screen', async () => {
  const module = { exports: {} };
  const posts = [];
  const post = async (...args) => {
    posts.push(args);
    return { data: { result: 'r' } };
  };
  vm.runInNewContext(
    transpile(fs.readFileSync(path.join(SRC, 'services/rental/contract.service.ts'), 'utf8')),
    {
      module,
      exports: module.exports,
      require: (request) => (request === './client' ? { __esModule: true, default: { post } } : {}),
    }
  );
  await module.exports.contractService.refreshSmartCaSignature('c', 's', { timeout: 60_000 });
  assert.equal(posts[0][0], '/api/v1/contracts/c/signatures/s/refresh');
  assert.equal(posts[0][1], undefined);
  assert.equal(posts[0][2].timeout, 60_000);
  const panel = fs.readFileSync(
    path.join(SRC, 'components/rental/contract/SmartCaSignaturePanel.tsx'),
    'utf8'
  );
  assert.match(panel, /refreshSmartCaSignature\(contract\.id, current\.id, \{\s*timeout: 60_000/);
  assert.ok(!panel.includes('Promise.race'));
});

test('consent source: signer, revision and the file of this turn; unknown means no consent', () => {
  const contract = { id: 'c', status: 'DRAFT', currentRevisionId: 'r1' };
  const pdf = (id, extra = {}) => doc({ id, revisionId: 'r1', ...extra });
  const source = (rows, over = {}, mode = 'SMARTCA', signer = 'u1') =>
    logic.signingSource(rows, { ...contract, ...over }, mode, signer);
  const first = source([pdf('a')]);
  assert.ok(first);
  assert.equal(source([pdf('a')]), first);
  // A new render, a new revision or another signer ends the consent.
  assert.notEqual(source([pdf('b')]), first);
  assert.notEqual(source([pdf('a'), pdf('b', { purpose: 'OFFICIAL' })]), first);
  assert.notEqual(source([pdf('a', { revisionId: 'r2' })], { currentRevisionId: 'r2' }), first);
  assert.notEqual(source([pdf('a')], {}, 'SMARTCA', 'u2'), first);
  for (const wrong of [
    { contractId: 'x' },
    { revisionId: 'r0' },
    { status: 'STALE' },
    { documentType: 'DOCX' },
    { purpose: 'SIGNED_FINAL' },
  ])
    assert.equal(source([pdf('a', wrong)]), null, JSON.stringify(wrong));
  assert.equal(source([pdf('a')], { currentRevisionId: null }), null);
  // The tenant signs the landlord-signed PDF only.
  const tenant = { status: 'TENANT_SIGNATURE_PENDING' };
  assert.equal(source([pdf('a')], tenant), null);
  assert.ok(source([pdf('l', { purpose: 'SIGNED_LANDLORD' })], tenant));
  // INTERNAL previews may be DOCX.
  assert.ok(source([pdf('a', { documentType: 'DOCX' })], {}, 'INTERNAL'));
});

test('requested agreement: only the exact row until the viewer picks another', () => {
  const rows = [
    { signingContractId: 'old', current: false },
    { signingContractId: 'a', current: true },
  ];
  // Loading, failed or stale list that has no "b" yet: nothing, not "a".
  assert.equal(logic.workflowRow(rows, 'b', 'b'), undefined);
  assert.equal(logic.workflowRow([], 'b', 'b'), undefined);
  assert.equal(logic.workflowRow(rows, 'old', 'old'), rows[0]);
  assert.equal(logic.workflowRow(rows, 'a', 'b'), rows[1], 'picked from the list');
  assert.equal(logic.workflowRow(rows, '', undefined), rows[1]);
});

test('workflow PDF: this agreement, current revision and the signing stage', () => {
  const contract = { id: 'c', status: 'DRAFT', currentRevisionId: 'r1' };
  const pdf = (id, purpose, extra = {}) => doc({ id, purpose, revisionId: 'r1', ...extra });
  const source = pdf('s', 'OFFICIAL');
  const landlord = pdf('l', 'SIGNED_LANDLORD');
  const final = pdf('f', 'SIGNED_FINAL');
  const pick = (rows, over = {}, rowSigned = false) =>
    logic.workflowPdf(rows, { ...contract, ...over }, rowSigned)?.id;
  assert.equal(pick([source]), 's');
  assert.equal(pick([source, landlord]), 'l');
  const tenant = { status: 'TENANT_SIGNATURE_PENDING' };
  assert.equal(pick([source], tenant), undefined);
  assert.equal(pick([source, landlord], tenant), 'l');
  // Fully signed according to any of the two reads: only the final PDF, never the source.
  for (const [over, rowSigned] of [
    [{ status: 'ACTIVE' }, false],
    [{ signedAt: '2026-01-01' }, false],
    [{}, true],
  ]) {
    assert.equal(pick([source, landlord], over, rowSigned), undefined);
    assert.equal(pick([source, landlord, final], over, rowSigned), 'f');
  }
  for (const wrong of [{ contractId: 'x' }, { revisionId: 'r0' }, { status: 'STALE' }])
    assert.equal(pick([pdf('s', 'OFFICIAL', wrong)]), undefined, JSON.stringify(wrong));
  assert.equal(pick([source], { currentRevisionId: null }), undefined);
});

test('a verified signature keeps the form closed until the contract catches up', () => {
  const contract = { currentRevisionId: 'r1' };
  const request = { status: 'SIGNED', signerRole: 'TENANT', revisionId: 'r1' };
  assert.equal(logic.signedAwaitingContract(request, contract, false), true);
  assert.equal(logic.signedAwaitingContract(request, contract, true), false);
  assert.equal(logic.signedAwaitingContract(request, { currentRevisionId: 'r2' }, false), false);
  assert.equal(
    logic.signedAwaitingContract({ ...request, status: 'REJECTED' }, contract, false),
    false
  );
  assert.equal(logic.signedAwaitingContract(null, contract, false), false);
});

const doc = (extra = {}) => ({
  id: 'd',
  contractId: 'c',
  documentType: 'PDF',
  purpose: 'PREVIEW',
  status: 'READY',
  viewUrl: 'https://s/view',
  downloadUrl: 'https://s/download',
  ...extra,
});

test('opening a document: verified bytes for a signed PDF, never a URL', () => {
  const signed = doc({ purpose: 'SIGNED_FINAL' });
  assert.equal(logic.documentOpenPlan(signed, signed, true).kind, 'verified-download');
  assert.equal(logic.documentOpenPlan(signed, signed, false).kind, 'preview');
  const noUrl = doc({ purpose: 'SIGNED_FINAL', viewUrl: null, downloadUrl: null });
  assert.equal(logic.documentOpenPlan(noUrl, noUrl, false).kind, 'preview');
  // Signed between the list and the tap: the download still goes through the verified path.
  assert.equal(logic.documentOpenPlan(doc(), signed, true).kind, 'verified-download');

  assert.equal(logic.documentOpenPlan(doc(), doc(), true).url, 'https://s/download');
  assert.equal(logic.documentOpenPlan(doc(), doc(), false).kind, 'preview');
  const word = doc({ documentType: 'DOCX', status: 'STALE' });
  assert.equal(logic.documentOpenPlan(word, word, false).url, 'https://s/view');
  assert.equal(logic.documentOpenPlan(word, word, true).url, 'https://s/download');

  for (const [fresh, download] of [
    [null, false],
    [doc({ id: 'x' }), false],
    [doc({ contractId: 'x' }), false],
    [doc({ status: 'GENERATING' }), false],
    [doc({ viewUrl: null, downloadUrl: null }), false],
    [doc({ downloadUrl: null }), true],
  ])
    assert.throws(() => logic.documentOpenPlan(doc(), fresh, download), /Không mở được tệp/);
});

test('an unsigned preview uses a URL read for this attempt, and only for the same file', () => {
  const asked = doc({ revisionId: 'r1', viewUrl: 'https://s/expired' });
  const fresh = { ...asked, viewUrl: 'https://s/new' };
  assert.equal(logic.freshPreviewUrl(asked, fresh), 'https://s/new');
  for (const wrong of [
    { id: 'x' },
    { contractId: 'x' },
    { revisionId: 'r2' },
    { status: 'STALE' },
    { status: 'FAILED' },
    { purpose: 'SIGNED_FINAL' },
    { viewUrl: null, downloadUrl: null },
  ])
    assert.throws(
      () => logic.freshPreviewUrl(asked, { ...fresh, ...wrong }),
      /Không mở được tệp/,
      JSON.stringify(wrong)
    );
  const old = { ...asked, status: 'STALE' };
  assert.equal(logic.freshPreviewUrl(old, { ...fresh, status: 'STALE' }), 'https://s/new');
});

test('temporary document copies: kept a while after a share, removed at once on failure', async () => {
  const deleted = [];
  const timers = [];
  let uuid = 0;
  let shareFails = false;
  let status = 200;
  const share = async () => {
    if (shareFails) throw new Error('cancelled');
  };
  const stubs = {
    'expo-crypto': { randomUUID: () => `u${++uuid}` },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///cache/',
      makeDirectoryAsync: async () => {},
      downloadAsync: async (_, target) => ({ status, uri: target }),
      deleteAsync: async (uri) => void deleted.push(uri),
    },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: share },
    '@/services/rental/contract.service': { contractService: {} },
    './signingLogic': logic,
  };
  const run = (rel) => {
    const loaded = { exports: {} };
    vm.runInNewContext(transpile(fs.readFileSync(path.join(SRC, rel), 'utf8')), {
      module: loaded,
      exports: loaded.exports,
      require: (request) => stubs[request],
      setTimeout: (callback) => timers.push(callback),
    });
    return loaded.exports;
  };
  const cache = run('services/rental/cache.ts');
  stubs['@/services/rental/cache'] = cache;
  const module = { exports: {} };
  vm.runInNewContext(
    transpile(
      fs.readFileSync(path.join(SRC, 'components/rental/contract/documentFiles.ts'), 'utf8')
    ),
    { module, exports: module.exports, require: (request) => stubs[request] }
  );
  const files = module.exports;
  const word = doc({ documentType: 'DOCX', fileName: 'a.docx' });
  const folder = /^file:\/\/\/cache\/rental-files\/u\d+\/$/;
  for (const fails of [false, true]) {
    shareFails = fails;
    const open = () => files.openWithDeviceApps('https://s/view', word);
    deleted.length = 0;
    timers.length = 0;
    if (fails) await assert.rejects(open(), /cancelled/);
    else {
      await open();
      // The receiving app may still be reading it.
      assert.deepEqual(deleted, []);
      timers.forEach((callback) => callback());
    }
    assert.equal(deleted.length, 1);
    assert.match(deleted[0], folder);
  }
  deleted.length = 0;
  status = 403;
  await assert.rejects(files.openWithDeviceApps('https://s/view', word), /HTTP 403/);
  assert.equal(deleted.length, 1);
  assert.match(deleted[0], folder);
  // The picker copy is noted before the mounted check, so leaving mid-pick still removes it.
  const proof = fs.readFileSync(
    path.join(SRC, 'components/rental/contract/ContractBlockchainProof.tsx'),
    'utf8'
  );
  assert.ok(proof.indexOf('uri = asset?.uri') > 0);
  assert.ok(proof.indexOf('uri = asset?.uri') < proof.indexOf('!asset || !alive.current'));
});

test('every signed download removes its temporary copy', () => {
  const header = fs.readFileSync(
    path.join(SRC, 'components/rental/contract/ContractHeader.tsx'),
    'utf8'
  );
  assert.ok(header.includes('await shareSignedDocument(fresh)'));
  assert.ok(!header.includes('downloadDocument'));
});

test('file size reads like the web vi-VN format', () => {
  const vi = (n) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  assert.equal(logic.fileSize(null), 'Chưa có dung lượng');
  assert.equal(logic.fileSize(0), '0 B');
  for (const bytes of [1023, 1024, 1536, 10240, 1048575, 1048576, 5452595, 2_000_000_000])
    assert.equal(
      logic.fileSize(bytes),
      bytes < 1024
        ? `${bytes} B`
        : bytes < 1048576
          ? `${vi(bytes / 1024)} KB`
          : `${vi(bytes / 1048576)} MB`
    );
});

test('blockchain verification only counts for the proof on screen', () => {
  const proof = { onChainDocumentId: '0x1', chainId: 11155111, registryAddress: '0xAbC' };
  const answer = {
    documentId: 'd',
    onChainDocumentId: '0x1',
    chainId: 11155111,
    registryAddress: '0xabc',
    registered: true,
    matches: true,
  };
  assert.equal(logic.checkVerification('d', proof, answer), 'match');
  assert.equal(logic.checkVerification('d', proof, { ...answer, matches: false }), 'mismatch');
  assert.equal(logic.checkVerification('d', proof, { ...answer, registered: false }), 'missing');
  for (const wrong of [
    { documentId: 'x' },
    { onChainDocumentId: '0x2' },
    { chainId: 1 },
    { registryAddress: '0xdef' },
  ])
    assert.throws(
      () => logic.checkVerification('d', proof, { ...answer, ...wrong }),
      /không thuộc bằng chứng/
    );
  assert.equal(logic.verificationFailureMessage(new Error('Tệp đang trống.')), 'Tệp đang trống.');
  const network = Object.assign(new Error('Network Error'), { isAxiosError: true });
  assert.match(logic.verificationFailureMessage(network), /Chưa đối chiếu được/);
});

test('hash failures never send a phone user to a browser', async () => {
  const module = { exports: {} };
  vm.runInNewContext(
    transpile(fs.readFileSync(path.join(SRC, 'lib/rental/contract-blockchain-proof.ts'), 'utf8')),
    {
      Error,
      Uint8Array,
      module,
      exports: module.exports,
      require: () => ({
        CryptoDigestAlgorithm: {},
        digest: async () => {
          throw new Error('native');
        },
      }),
    }
  );
  for (const size of [20 * 1024 * 1024 + 1, 3]) {
    const failure = await module.exports
      .hashPdfForProof({ size, arrayBuffer: async () => new ArrayBuffer(3) })
      .catch((error) => error);
    const message = logic.verificationFailureMessage(failure);
    assert.doesNotMatch(message, /trình duyệt|HTTPS|localhost/i);
    assert.match(message, size > 3 ? /20 MB/ : /hash/);
  }
});

test('only the PDF viewer imports the native renderer, and never at load time', () => {
  const walk = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)
      );
  const users = walk(SRC).filter((file) =>
    /(from|require\()\s*['"]react-native-pdf-renderer/.test(fs.readFileSync(file, 'utf8'))
  );
  assert.deepEqual(
    users.map((file) => path.basename(file)),
    ['PdfViewerModal.tsx']
  );
  const imports = fs
    .readFileSync(users[0], 'utf8')
    .split('\n')
    .filter((line) => /^import .*react-native-pdf-renderer/.test(line));
  assert.ok(imports.length && imports.every((line) => line.startsWith('import type ')));
});
