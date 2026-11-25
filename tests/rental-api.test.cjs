/* global __dirname, Buffer */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Web and mobile rental services run side by side on a fake axios client, device and storage.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const SRC = path.resolve(__dirname, '../src');

const SERVICES = [
  'rental-request',
  'rental-request-review',
  'rental-onboarding',
  'rental-workflow',
  'deposit-agreement',
  'contract',
  'contract-amendment',
  'contract-blockchain',
  'contract-lifecycle',
  'monthly-invoice',
  'payment-request',
  'payment-receipt',
  'complaint',
  'storage',
  'bank-account',
];
// Imported by rental screens on web, but already covered by other mobile modules:
// appointment -> services/appointmentApi, notification -> notification API + lib/realtime.
const OUTSIDE = ['appointment', 'notification'];

const PDF = '%PDF-1.7 fake';
const PDF_BASE64 = Buffer.from(PDF).toString('base64');

class FakeFileReader {
  readAsText(blob) {
    this.finish(blob.text());
  }
  readAsDataURL(blob) {
    this.finish(
      blob
        .arrayBuffer()
        .then((bytes) => `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`)
    );
  }
  finish(promise) {
    promise.then(
      (result) => {
        this.result = result;
        this.onload();
      },
      (error) => {
        this.error = error;
        this.onerror();
      }
    );
  }
}

function loader(root, stubs, globals) {
  const cache = new Map();
  const context = vm.createContext({ Blob, atob, ...globals });
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const source = ts.transpileModule(fs.readFileSync(path.join(root, `${relative}.ts`), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const module = { exports: {} };
    cache.set(relative, module);
    const requireModule = (name) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith('@/')) return load(name.slice(2));
      if (name.startsWith('.'))
        return load(path.posix.join(path.posix.dirname(relative), name.replace(/\.ts$/, '')));
      assert.fail(`Unexpected dependency ${name} in ${relative}`);
    };
    vm.runInContext(`(function (exports, require) {${source}\n})`, context)(
      module.exports,
      requireModule
    );
    return module.exports;
  }
  return load;
}

const plain = (value) => (value === undefined ? null : JSON.parse(JSON.stringify(value)));

/** `respond(method, url)` returns the response body, or throws like axios would. */
function harness(side, options = {}) {
  const log = { calls: [], timeouts: [], puts: [], downloads: [], written: [], shared: [] };
  const state = {
    respond: options.respond ?? (() => ({ result: undefined, marker: 1 })),
    sizes: new Map(),
    putStatus: 200,
  };
  const client = {};
  for (const method of ['get', 'post', 'put', 'patch', 'delete'])
    client[method] = async (url, ...rest) => {
      const hasBody = ['post', 'put', 'patch'].includes(method);
      const data = hasBody ? rest[0] : undefined;
      const config = { ...(hasBody ? rest[1] : rest[0]) };
      log.timeouts.push({ url, timeout: config.timeout });
      // `timeout: 0` is how mobile spells the web client's "no timeout".
      if (config.timeout === 0) delete config.timeout;
      if (config.signal) config.signal = config.signal.aborted === false ? 'SIGNAL' : 'BAD';
      log.calls.push(plain({ method, url, data: data ?? null, config }));
      return { data: await state.respond(method, url) };
    };
  const stubs = { '@/lib/axios-client': { __esModule: true, default: client } };
  const globals = {};

  if (side === 'web') {
    globals.fetch = async (url, init) => {
      log.puts.push(plain({ url, method: init.method, headers: init.headers }));
      return { ok: state.putStatus < 300, status: state.putStatus };
    };
    globals.URL = {
      createObjectURL: (blob) => {
        log.downloads.push(blob);
        return 'blob:1';
      },
      revokeObjectURL() {},
    };
    globals.setTimeout = () => {};
    const link = { click() {}, remove() {} };
    globals.window = {
      document: { createElement: () => link, body: { appendChild() {} } },
    };
    log.link = link;
  } else {
    log.cleanupTimers = [];
    log.deleted = [];
    globals.setTimeout = (callback) => log.cleanupTimers.push(callback);
    globals.FileReader = FakeFileReader;
    let uuid = 0;
    stubs['expo-crypto'] = { randomUUID: () => `uuid-${++uuid}` };
    stubs['expo-file-system/legacy'] = {
      cacheDirectory: 'file:///cache/',
      EncodingType: { Base64: 'base64' },
      makeDirectoryAsync: async () => {},
      deleteAsync: async (uri) => log.deleted.push(uri),
      writeAsStringAsync: async (uri, content, writeOptions) =>
        log.written.push({ uri, content, encoding: writeOptions.encoding }),
      getInfoAsync: async (uri) => ({
        exists: state.sizes.has(uri),
        isDirectory: false,
        size: state.sizes.get(uri),
      }),
      uploadAsync: async (url, uri, init) => {
        log.puts.push(plain({ url, method: init.httpMethod, headers: init.headers }));
        log.uploadedUri = uri;
        return { status: state.putStatus };
      },
    };
    stubs['expo-sharing'] = {
      isAvailableAsync: async () => options.sharing ?? true,
      shareAsync: async (uri, shareOptions) => log.shared.push(plain({ uri, ...shareOptions })),
    };
  }
  return { log, state, load: loader(side === 'web' ? WEB : SRC, stubs, globals) };
}

function pair(options) {
  const web = harness('web', options);
  const mobile = harness('mobile', options);
  return {
    web,
    mobile,
    service(name) {
      return {
        web: web.load(`services/${name}.service`),
        mobile: mobile.load(`services/rental/${name}.service`),
      };
    },
  };
}

const settle = (promise) =>
  Promise.resolve(promise).then(
    (value) => ({ value }),
    (error) => ({ error: error.message })
  );

/** The object holding the functions: the default export, or the single named service object. */
const api = (module) => module.default ?? Object.values(module).find((v) => typeof v === 'object');

const covered = new Set();

/** Runs one function on both sides and compares every request, the result and the error. */
async function same(sides, service, name, args = [], { result = true } = {}) {
  covered.add(`${service}.${name}`);
  const modules = sides.service(service);
  const webFrom = sides.web.log.calls.length;
  const mobileFrom = sides.mobile.log.calls.length;
  const expected = await settle(api(modules.web)[name](...args));
  const actual = await settle(api(modules.mobile)[name](...args));
  const label = `${service}.${name}(${JSON.stringify(args)})`;
  assert.deepEqual(
    sides.mobile.log.calls.slice(mobileFrom),
    sides.web.log.calls.slice(webFrom),
    `${label} requests`
  );
  assert.equal(actual.error, expected.error, `${label} error`);
  if (result) assert.deepEqual(plain(actual.value), plain(expected.value), `${label} result`);
  return { expected, actual, calls: sides.web.log.calls.slice(webFrom) };
}

async function sameAll(sides, service, cases) {
  for (const [name, ...args] of cases) {
    const { expected } = await same(sides, service, name, args);
    assert.equal(expected.error, undefined, `${service}.${name} should succeed`);
  }
}

test('every web rental service has a mobile file with the same exports and functions', () => {
  const sides = pair();
  for (const name of SERVICES) {
    const { web, mobile } = sides.service(name);
    for (const [key, value] of Object.entries(web)) {
      assert.ok(key in mobile, `${name}: missing export ${key}`);
      if (typeof value !== 'object') continue;
      for (const fn of Object.keys(value))
        assert.equal(typeof mobile[key][fn], 'function', `${name}.${key}.${fn} is missing`);
    }
    assert.equal('default' in mobile, 'default' in web, `${name}: default export`);
  }
});

test('no rental screen on web imports a service that was not ported', () => {
  const imported = new Set();
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.tsx?$/.test(entry.name))
        for (const match of fs
          .readFileSync(full, 'utf8')
          .matchAll(/@\/services\/([\w-]+)\.service/g))
          imported.add(match[1]);
    }
  };
  for (const folder of [
    'rental-request',
    'contract',
    'complaint',
    'payment',
    'rental',
    'dashboard/invoices',
  ])
    visit(path.join(WEB, 'components', folder));
  assert.deepEqual(
    [...imported].filter((name) => !SERVICES.includes(name) && !OUTSIDE.includes(name)),
    []
  );
});

test('rental request, AI review, onboarding, workflow and deposit agreement requests', async () => {
  const sides = pair();
  await sameAll(sides, 'rental-request', [
    ['createRentalRequest', { listingId: 'l1', leaseMonths: 6 }],
    ['estimateRentalCost', { listingId: 'l1', occupantCount: 2 }],
    ['getMyRequests'],
    ['getMyRequests', { status: 'ALL' }],
    ['getMyRequests', { status: 'PENDING', page: 3, size: 8 }],
    ['getMyRequestByListing', 'l1'],
    ['getRequestById', 'r1'],
    ['cancelRentalRequest', 'r1'],
    ['getOwnerRequests'],
    ['getOwnerRequests', { listingId: '', status: 'ALL' }],
    ['getOwnerRequests', { listingId: 'l1', status: 'ACCEPTED', page: 2, size: 8 }],
    ['getOwnerConflicts'],
    ['acceptRentalRequest', 'r1'],
    ['rejectRentalRequest', 'r1'],
    ['rejectRentalRequest', 'r1', ''],
    ['rejectRentalRequest', 'r1', 'Lý do'],
    ['getPolicy'],
  ]);
  const history = Array.from({ length: 9 }, (_, i) => ({ role: 'user', content: `${i}` }));
  await sameAll(sides, 'rental-request-review', [
    ['review', 'l1'],
    ['ask', 'l1', 'Ai tốt hơn?', history],
  ]);
  assert.equal(sides.web.log.calls.at(-1).data.history.length, 6);
  await sameAll(sides, 'rental-onboarding', [
    ['notifyDefault', 'r1', 'lý do'],
    ['disputeDefault', 'r1', 'lý do'],
    ['completeDefault', 'r1', 'lý do'],
    ['get', 'r1'],
    ['refresh', 'r1'],
    ['request', 'r1', '2026-11-26', 'lý do'],
    ['decide', 'r1', 'c1', false],
    ['withdraw', 'r1', 'c1'],
    ['cancel', 'r1', 'lý do'],
    ['reopenSigning', 'r1', 'lý do'],
    ['decideCancel', 'r1', true],
    ['review', 'r1', 'p1', false, 'lý do'],
  ]);
  await sameAll(sides, 'rental-workflow', [
    ['calculate', 'r/1', '2026-12-01', 'DAILY_PRORATED'],
    ['documents', 'r/1', 'cancellation'],
    ['get', 'r/1', 'early-exit'],
    ['propose', 'r/1', 'cancellation', { expectedRevision: 0 }],
    ['act', 'r/1', 'early-exit', 'CONFIRM RETURN', { expectedRevision: 1, reason: 'lý do' }],
  ]);
  await sameAll(sides, 'deposit-agreement', [
    ['get', 'r/1'],
    ['prepare', 'r/1'],
    ['reopen', 'r/1'],
  ]);
});

test('reservation policy is the call RentalRequestModal makes directly', async () => {
  const mobile = harness('mobile', {
    respond: () => ({ result: { version: 'v1', text: 'điều kiện' } }),
  });
  const service = mobile.load('services/rental/rental-request.service').default;
  assert.equal((await service.getReservationPolicy()).version, 'v1');
  const url = '/api/v1/rental-requests/reservation-policy';
  assert.equal(mobile.log.calls[0].url, url);
  assert.ok(
    fs
      .readFileSync(path.join(WEB, 'components/rental-request/RentalRequestModal.tsx'), 'utf8')
      .includes(url)
  );
});

test('only getMyRequestByListing swallows errors; empty lists fall back like web', async () => {
  const offline = pair({
    respond() {
      throw new Error('offline');
    },
  });
  const swallowed = await same(offline, 'rental-request', 'getMyRequestByListing', ['l1']);
  assert.equal(swallowed.actual.value, null);
  const rejected = await same(offline, 'rental-request', 'getRequestById', ['r1']);
  assert.equal(rejected.actual.error, 'offline');
  const empty = pair({ respond: () => ({ result: null }) });
  for (const [service, name] of [
    ['rental-request', 'getMyRequestByListing'],
    ['rental-request', 'getOwnerConflicts'],
    ['contract', 'getSigningCertificates'],
    ['contract', 'getByRentalRequest'],
    ['contract', 'getPreviewStatus'],
    ['contract', 'getDocuments'],
    ['monthly-invoice', 'list'],
    ['complaint', 'list'],
    ['payment-request', 'getMyPaymentRequests'],
    ['payment-request', 'getContractPayments'],
    ['payment-request', 'getPaymentRequest'],
    ['bank-account', 'getBankAccounts'],
  ])
    await same(empty, service, name, ['x']);
});

test('contract requests, including signals and preview timeouts', async () => {
  const sides = pair();
  const signal = new AbortController().signal;
  await sameAll(sides, 'contract', [
    ['getSignatureState', 'c1'],
    ['getSigningCertificates', 'c1'],
    ['initiateSmartCaSignature', 'c1', 'serial'],
    ['refreshSmartCaSignature', 'c1', 's1'],
    ['getByRentalRequest', 'r1'],
    ['getByRentalRequest', 'r1', true],
    ['createDraft', { rentalRequestId: 'r1' }],
    ['createDraft', { rentalRequestId: 'r1' }, signal],
    ['listContracts'],
    ['listContracts', { role: 'TENANT', agreementKind: 'DEPOSIT', page: 1, size: 12 }],
    ['getContract', 'c1'],
    ['getRevision', 'c1'],
    ['previewListingSync', 'c1', signal],
    ['updateRevision', 'c1', { baseRevisionId: 'v1' }, signal],
    ['getCompleteness', 'c1'],
    ['triggerPreview', 'c1'],
    ['triggerPreview', 'c1', signal, 'v1'],
    ['getPreviewStatus', 'c1', signal],
    ['sendToTenant', 'c1'],
    ['sign', 'c1'],
    ['getDocument', 'd/1'],
    ['getDocuments', 'c1'],
  ]);
  const timeoutOf = (suffix) =>
    sides.mobile.log.timeouts.find((entry) => entry.url.endsWith(suffix)).timeout;
  assert.equal(timeoutOf('/previews'), 95_000);
  assert.equal(timeoutOf('/preview-status'), 10_000);
  assert.ok(
    sides.mobile.log.timeouts.every((entry) => typeof entry.timeout === 'number'),
    'no rental request falls back to the 15 s default'
  );
});

test('amendment, blockchain, lifecycle and monthly invoice requests', async () => {
  const sides = pair();
  const signal = new AbortController().signal;
  const payload = { requestId: 'u1', changes: {} };
  await sameAll(sides, 'contract-amendment', [
    ['get', 'c1'],
    ['options', 'c1'],
    ['draft', 'c1'],
    ['saveDraft', 'c1', payload],
    ['discardDraft', 'c1'],
    ['requestNegotiation', 'c1', { requestId: 'u1', message: 'm', evidenceIds: [] }],
    ['decideNegotiation', 'c1', 't1', 'ACCEPT'],
    ['decideNegotiation', 'c1', 't1', 'REJECT', 'ghi chú'],
    ['preview', 'c1', payload],
    ['propose', 'c1', payload],
    ['decide', 'c1', 'p1', 'APPROVE', ''],
    ['decide', 'c1', 'p1', 'WITHDRAW'],
  ]);
  await sameAll(sides, 'contract-blockchain', [
    ['checkIntegrity', 'd/1'],
    ['checkIntegrity', 'd/1', signal],
    ['getProof', 'd/1', signal],
    ['verify', 'd/1', '0xab', signal],
  ]);
  await sameAll(sides, 'contract-lifecycle', [
    ['get', 'c/1'],
    ['request', 'c1', 6, 'ghi chú'],
    ['decide', 'c1', 'n/1', true],
    ['decide', 'c1', 'n/1', false],
    ['propose', 'c1', { note: 'x' }],
    ['finalCosts', 'c1', { requestId: 'u1', extraCharges: [] }],
    ['accept', 'c1', 2],
    ['dispute', 'c1', 2, 'lý do', ['e1']],
  ]);
  await sameAll(sides, 'monthly-invoice', [
    ['issueUnilateralTermination', 'i1', 'lý do'],
    ['requestTerminationReview', 'i1', 'n1', { expectedVersion: 1, option: 'ROLLOVER' }],
    ['decideTerminationReview', 'i1', 'n1', 1, false, 'lý do'],
    ['withdrawUnilateralTermination', 'i1', 'n1', 1],
    ['completeUnilateralHandover', 'i1', 'n1', 1],
    ['requestPaymentExtension', 'i1', 5, 'ghi chú'],
    ['decidePaymentExtension', 'i1', 'q1', true],
    ['decidePaymentExtension', 'i1', 'q1', false],
    ['extendPaymentDirectly', 'i1', 5, 'ghi chú'],
    ['issue', 'i1', { extraCharges: [] }],
    ['prepare', 'i1', { extraCharges: [] }],
    ['acknowledgeOverdueAction', 'i1', 'a1', ''],
    ['deferToNextPeriod', 'i1'],
    ['acceptTermination', 'i1', { acceptEarlyTermination: true }],
    ['declineTermination', 'i1'],
    ['withdrawTermination', 'i1'],
    ['completeTermination', 'i1', { vacantPossessionConfirmed: true }],
    ['forceTerminationAfterDecline', 'i1', { tenantNotified: true }],
  ]);
  const lists = pair({ respond: () => ({ result: [{ id: 'm1' }] }) });
  await sameAll(lists, 'monthly-invoice', [['list', 'c1']]);
});

test('payment requests are normalized like web; receipts and complaints match', async () => {
  const aliases = pair({
    respond: (method, url) => {
      const raw = { id: 'p1', payeeAccount: { bankBin: '1' }, evidenceList: [{ id: 'e' }] };
      return { result: /\/(mine|contracts\/c1)$/.test(url) ? [raw, null] : raw };
    },
  });
  await sameAll(aliases, 'payment-request', [
    ['getPaymentRequest', 'p1'],
    ['getInitialPaymentByRentalRequestId', 'r1'],
    ['getMyPaymentRequests'],
    ['getContractPayments', 'c1'],
    ['reportTransfer', 'p1', { expectedAmount: 10, proofStorageId: 's1' }],
    ['confirmReceipt', 'p1'],
    ['rejectReceipt', 'p1', { reason: 'lý do' }],
    ['createProofUploadSession', 'p1'],
    ['getProofUploadSessionStatus', 'p1', 's1'],
  ]);
  const sides = pair();
  await sameAll(sides, 'payment-receipt', [
    ['list', { role: 'LANDLORD', contractId: 'c1', page: 1, size: 12 }],
    ['list', {}],
    ['byPayment', 'p/1'],
    ['retry', 'x/1'],
  ]);
  await sameAll(sides, 'complaint', [
    ['list', 'r/1'],
    ['open', 'r/1', { category: 'OTHER', reason: 'lý do', evidenceIds: [], urgent: false }],
    ['act', 'q/1', 'COMMENT', { expectedRevision: 1, reason: 'lý do' }],
  ]);
});

test('receipt PDF: same validation, but mobile resolves to a cached file', async () => {
  for (const result of [PDF_BASE64, Buffer.from('<html>').toString('base64'), '***', null, 42]) {
    const sides = pair({ respond: () => ({ result }) });
    const { expected, actual } = await same(sides, 'payment-receipt', 'pdf', ['x/1'], {
      result: false,
    });
    if (result !== PDF_BASE64) {
      assert.ok(expected.error);
      assert.equal(sides.mobile.log.written.length, 0);
      continue;
    }
    assert.equal(await expected.value.text(), PDF);
    assert.equal(actual.value, 'file:///cache/rental-files/uuid-1/1.pdf'); // path separators never reach the cache path
    assert.deepEqual(sides.mobile.log.written, [
      { uri: actual.value, content: PDF_BASE64, encoding: 'base64' },
    ]);
  }
});

const blobFailure = (body) => () => {
  throw Object.assign(new Error('Request failed'), {
    response: { data: body === undefined ? undefined : new Blob([body]) },
  });
};

test('verified PDF content and download: bytes, error messages and the share sheet', async () => {
  const signal = new AbortController().signal;
  const ok = pair({ respond: () => new Blob([PDF]) });
  for (const args of [['d/1'], ['d/1', true, signal]]) {
    const { expected, actual } = await same(ok, 'contract', 'getDocumentContent', args, {
      result: false,
    });
    assert.equal(actual.value.type, expected.value.type);
    assert.equal(await actual.value.text(), await expected.value.text());
  }
  await same(ok, 'contract', 'downloadDocument', [{ id: 'd1', fileName: 'Hợp đồng.pdf' }]);
  assert.equal(ok.web.log.link.download, 'Hợp đồng.pdf');
  assert.equal(ok.mobile.log.written[0].content, PDF_BASE64);
  assert.ok(ok.mobile.log.written[0].uri.endsWith(`/${encodeURIComponent('Hợp đồng.pdf')}`));
  assert.equal(ok.mobile.log.shared[0].uri, ok.mobile.log.written[0].uri);
  assert.equal(ok.mobile.log.shared[0].mimeType, 'application/pdf');
  assert.deepEqual(ok.mobile.log.deleted, []);
  ok.mobile.log.cleanupTimers[0]();
  assert.deepEqual(ok.mobile.log.deleted, ['file:///cache/rental-files/uuid-1/']);
  await same(ok, 'contract', 'downloadDocument', [{ id: 'd1' }]);
  assert.ok(ok.mobile.log.written[1].uri.endsWith('/hop-dong-da-ky.pdf'));
  await same(ok, 'contract', 'downloadDocument', [{ id: 'd1', fileName: '../..' }]);
  assert.ok(ok.mobile.log.written[2].uri.endsWith('rental-files/uuid-3/tai-lieu.pdf'));

  const noShare = pair({ respond: () => new Blob([PDF]), sharing: false });
  await assert.rejects(
    api(noShare.service('contract').mobile).downloadDocument({ id: 'd1' }),
    /chưa hỗ trợ/
  );
  assert.deepEqual(noShare.mobile.log.deleted, ['file:///cache/rental-files/uuid-1/']);

  for (const body of ['{"message":"Tài liệu bị sửa"}', '{}', '<html>', 'null', undefined]) {
    const failing = pair({ respond: blobFailure(body) });
    for (const [name, args] of [
      ['getDocumentContent', ['d1']],
      ['downloadDocument', [{ id: 'd1' }]],
    ]) {
      const { actual } = await same(failing, 'contract', name, args);
      assert.ok(actual.error, `${name} ${body}`);
    }
    assert.equal(failing.mobile.log.shared.length, 0);
  }
});

test('verified PDF stays scoped to the session that asked for it, including the share hand-off', async () => {
  let completeDownload;
  const old = harness('mobile', {
    respond: () =>
      new Promise((resolve) => {
        completeDownload = resolve;
      }),
  });
  const cache = old.load('services/rental/cache');
  const pending = api(old.load('services/rental/contract.service')).downloadDocument({ id: 'old' });
  await cache.purgeSensitiveCache();
  cache.openSensitiveCache();
  completeDownload(new Blob([PDF]));
  await assert.rejects(pending, /Phiên đăng nhập đã kết thúc/);
  assert.deepEqual([old.log.written, old.log.shared], [[], []]);

  let completeAvailability;
  const device = harness('mobile', {
    sharing: new Promise((resolve) => {
      completeAvailability = resolve;
    }),
  });
  const files = device.load('services/rental/files');
  const local = await files.saveBase64ToCache(PDF_BASE64, 'proof.pdf');
  const opening = files.sharePdf(local);
  const deviceCache = device.load('services/rental/cache');
  await deviceCache.purgeSensitiveCache();
  assert.deepEqual(device.log.deleted, []);
  completeAvailability(true);
  await assert.rejects(opening, /Phiên đăng nhập đã kết thúc/);
  assert.deepEqual(device.log.shared, []);
  assert.deepEqual(device.log.deleted, ['file:///cache/rental-files/uuid-1/']);
});

test('complaint source PDF: only the exact signed document, same errors', async () => {
  const source = { purpose: 'SIGNED_FINAL', signingContractId: 'c/1', storageObjectId: 's1' };
  const row = {
    id: 'd1',
    contractId: 'c/1',
    storageObjectId: 's1',
    purpose: 'SIGNED_FINAL',
    documentType: 'PDF',
    status: 'READY',
  };
  const documents = (rows, content) => ({
    respond: (method, url) => (method === 'get' ? { result: rows } : content()),
  });
  for (const bad of [
    { ...source, purpose: 'PREVIEW' },
    { ...source, signingContractId: '' },
    { ...source, storageObjectId: undefined },
  ]) {
    const { actual } = await same(pair(), 'complaint', 'sourcePdf', [bad]);
    assert.ok(actual.error);
  }
  for (const rows of [
    null,
    [],
    [row, row],
    [{ ...row, status: 'PENDING' }],
    [{ ...row, id: '' }],
  ]) {
    const sides = pair(documents(rows, () => new Blob([PDF])));
    const { actual } = await same(sides, 'complaint', 'sourcePdf', [source]);
    assert.ok(actual.error);
  }
  const good = pair(documents([row], () => new Blob([PDF])));
  const { actual, expected } = await same(good, 'complaint', 'sourcePdf', [source], {
    result: false,
  });
  assert.equal(await actual.value.text(), await expected.value.text());
  for (const body of ['{"message":"Sai chữ ký"}', '{"message":1}', '<html>', undefined]) {
    const sides = pair(documents([row], blobFailure(body)));
    const failed = await same(sides, 'complaint', 'sourcePdf', [source]);
    assert.ok(failed.actual.error);
  }
});

test('effective document resolves the same version through every branch', async () => {
  const doc = (id, contractId, revisionId, extra = {}) => ({
    id,
    contractId,
    revisionId,
    status: 'READY',
    purpose: 'SIGNED_FINAL',
    documentType: 'PDF',
    storageObjectId: `s-${id}`,
    ...extra,
  });
  const proposal = (agreementContractId, effectiveOn, extra = {}) => ({
    agreementContractId,
    effectiveOn,
    status: 'APPLIED',
    signedAt: '2026-11-01T00:00:00Z',
    ...extra,
  });
  async function run(world, requested = 'root') {
    const sides = pair({
      respond: (method, url) => {
        const [, , , kind, a, b] = url.split('/');
        if (kind !== 'contracts') assert.fail(url);
        if (a === 'documents') return { result: world.fresh?.[b] ?? world.docs[b] };
        if (b === 'effective-document') return { result: world.effective };
        if (b === 'amendments') return { result: world.amendments };
        if (b === 'documents')
          return { result: Object.values(world.docs).filter((d) => d.contractId === a) };
        return { result: world.contracts[a] };
      },
    });
    return same(sides, 'contract', 'getEffectiveDocument', [requested]);
  }
  const contracts = {
    root: { id: 'root', currentRevisionId: 'v1' },
    child: { id: 'child', parentContractId: 'root' },
  };
  const amendments = (extra) => ({
    serverNow: '2026-11-25T10:00:00Z',
    currentTermsRevisionId: 'v1',
    proposals: [],
    ...extra,
  });
  const docs = { d1: doc('d1', 'root', 'v1') };

  let out = await run({ contracts, docs, amendments: amendments() }, 'child');
  assert.equal(out.actual.value.id, 'd1');
  out = await run({ contracts, docs: {}, amendments: amendments() });
  assert.equal(out.actual.value, null);

  for (const world of [
    { contracts: { root: { id: 'other' } }, docs },
    { contracts: { root: { id: 'root', parentContractId: 'x' }, x: { id: '' } }, docs },
    { contracts, docs, amendments: null },
    { contracts, docs, amendments: amendments({ serverNow: 'nope' }) },
    { contracts, docs, amendments: amendments({ currentTermsRevisionId: '' }) },
    { contracts, docs, amendments: amendments(), fresh: { d1: doc('d1', 'root', 'v2') } },
  ])
    assert.ok((await run(world)).actual.error);

  // Candidates come from signed proposals, newest effective date first, judged on the Vietnam date.
  const proposals = [
    proposal('a1', '2026-11-01'),
    proposal('a2', '2026-11-26', { status: 'SCHEDULED' }),
    proposal('a3', '2026-11-27'),
    proposal('a4', '2026-11-20', { signedAt: null }),
    proposal('a5', '2026-11-20', { status: 'REJECTED' }),
    proposal('a1', '2026-11-01', { signedAt: '2026-11-02T00:00:00Z' }),
  ];
  const versions = {
    d1: doc('d1', 'a1', 'v9'),
    d2: doc('d2', 'a2', 'v9'),
  };
  for (const [serverNow, id] of [
    ['2026-11-25T16:59:59Z', 'd1'],
    ['2026-11-25T17:00:00Z', 'd2'],
    ['2026-11-26T06:59:00+07:00', 'd2'],
  ]) {
    out = await run({
      contracts,
      docs: versions,
      amendments: amendments({ serverNow, currentTermsRevisionId: 'v9', proposals }),
    });
    assert.equal(out.actual.value.id, id, serverNow);
  }

  // Agreed early end: the server picks the addendum, which is then cross-checked.
  const agreement = {
    id: 'wf',
    parentContractId: 'root',
    agreementKind: 'WORKFLOW',
    status: 'ACTIVE',
    signedAt: '2026-11-01T00:00:00Z',
    currentRevisionId: 'v5',
  };
  const early = (extra) => ({
    contracts: {
      root: { id: 'root', agreedEarlyEndExclusive: '2026-12-01' },
      wf: agreement,
    },
    docs: { d5: doc('d5', 'wf', 'v5') },
    effective: doc('d5', 'wf', 'v5'),
    ...extra,
  });
  assert.equal((await run(early())).actual.value.id, 'd5');
  assert.equal((await run(early({ effective: null }))).actual.value, null);
  const unsigned = early();
  unsigned.contracts.wf = { ...agreement, signedAt: null };
  assert.match((await run(unsigned)).actual.error, /Phụ lục chấm dứt không khớp/);
  const stale = early({ fresh: { d5: doc('d5', 'wf', 'v5', { storageObjectId: '' }) } });
  assert.match((await run(stale)).actual.error, /PDF đã ký không khớp/);
});

test('uploads send the same requests, type fallbacks, limits and error messages', async () => {
  const respond = (method, url) =>
    url.endsWith('/uploads')
      ? { result: { storageId: 'st1', uploadUrl: 'https://s3/put?sig=1' } }
      : { result: { url: 'https://s3/get' } };
  const MB = 1024 * 1024;
  const files = [
    ['a.jpg', 'image/jpeg', 10],
    ['a.PDF', '', 10],
    ['a.png', 'application/octet-stream', 10],
    ['a.webp', ' IMAGE/WEBP ', 15 * MB],
    ['a.pdf', 'application/pdf', 15 * MB + 1],
    ['a.pdf', 'application/pdf', 0],
    ['a.mp4', 'video/mp4', 10],
    ['noext', '', 10],
  ];
  const uploads = [
    'uploadComplaintEvidence',
    'uploadAmendmentEvidence',
    'uploadClosureEvidence',
    'uploadPaymentProof',
    'uploadUserAvatar',
    'uploadListingMedia',
    'uploadBranchCoverImage',
  ];
  async function upload(name, [fileName, type, size], target, putStatus = 200) {
    covered.add(`storage.${name}`);
    const sides = pair({ respond });
    sides.web.state.putStatus = sides.mobile.state.putStatus = putStatus;
    const uri = `file:///pick/${fileName}`;
    sides.mobile.state.sizes.set(uri, size);
    const modules = sides.service('storage');
    const extra = target === undefined ? [] : [target];
    const expected = await settle(
      modules.web.default[name]({ name: fileName, type, size }, ...extra)
    );
    // The picker's size is deliberately wrong: the real file size must win.
    const actual = await settle(
      modules.mobile.default[name](
        { uri, fileName, contentType: type, sizeBytes: 999_999_999 },
        ...extra
      )
    );
    const label = `${name} ${fileName} "${type}" ${size}`;
    assert.deepEqual(sides.mobile.log.calls, sides.web.log.calls, label);
    assert.deepEqual(sides.mobile.log.puts, sides.web.log.puts, `${label} PUT`);
    assert.deepEqual(actual, expected, label);
    if (sides.mobile.log.puts.length) assert.equal(sides.mobile.log.uploadedUri, uri);
    return actual;
  }
  for (const name of uploads) for (const file of files) await upload(name, file, 'ref1');
  await upload('uploadListingMedia', files[0]);
  await upload('uploadBranchCoverImage', files[0]);
  const failed = await upload('uploadPaymentProof', files[0], 'p1', 403);
  assert.equal(failed.error, 'Không thể tải tệp a.jpg lên kho lưu trữ (403).');
  assert.equal((await upload('uploadComplaintEvidence', files[3], 'r1')).value, 'st1');
  assert.match((await upload('uploadComplaintEvidence', files[4], 'r1')).error, /^Chứng cứ/);
  assert.match((await upload('uploadClosureEvidence', files[6], 'c1')).error, /^Minh chứng/);

  const sides = pair({ respond });
  await sameAll(sides, 'storage', [
    ['getPaymentProofViewUrl', 'st1'],
    ['getViewUrl', 'st1'],
  ]);
  const list = pair({ respond: () => ({ result: [{ id: 'o1' }] }) });
  await sameAll(list, 'storage', [
    ['listUserAvatars', 'u1'],
    ['listUserAvatars', 'u1', 2, 5],
  ]);
});

test('bank accounts keep the web requests and the once-per-session catalog', async () => {
  const sides = pair();
  const input = { bankBin: '970436', accountNumber: '123', accountHolderName: 'A' };
  await sameAll(sides, 'bank-account', [
    ['getBankAccounts'],
    ['createBankAccount', input],
    ['updateBankAccount', 'b1', input],
    ['revealBankAccount', 'b1'],
    ['updateDefaults', 'b1', { defaultForRefunds: true }],
    ['deleteBankAccount', 'b1'],
  ]);
  const first = await same(sides, 'bank-account', 'getBanks');
  assert.equal(first.calls.length, 1);
  const second = await same(sides, 'bank-account', 'getBanks');
  assert.equal(second.calls.length, 0);
  let fail = true;
  const flaky = pair({
    respond: () => {
      if (fail) throw new Error('offline');
      return { result: [] };
    },
  });
  assert.equal((await same(flaky, 'bank-account', 'getBanks')).actual.error, 'offline');
  fail = false;
  // The failure was not cached on either side.
  const retried = await same(flaky, 'bank-account', 'getBanks');
  assert.equal(retried.calls.length, 1);
  assert.equal(retried.actual.error, undefined);
});

// Must stay last: node:test runs the tests of one file in order.
test('every function of every web rental service was compared', () => {
  const sides = pair();
  const all = SERVICES.flatMap((name) =>
    Object.keys(api(sides.service(name).web)).map((fn) => `${name}.${fn}`)
  );
  assert.deepEqual(
    all.filter((key) => !covered.has(key)),
    []
  );
  console.log(`compared ${covered.size}/${all.length} web service functions`);
});
