const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports,
    Date,
    Number,
    Infinity,
    Set,
    Promise,
    require(name) {
      if (name in dependencies) return dependencies[name];
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return module.exports;
}

const gate = load('lib/profile-gate.ts');
const { createOnboardingStore, createThrottle } = load('lib/onboarding-store.ts', {
  '@/services/onboardingApi': { getOnboardingStatus: async () => null },
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const state = (missing, passwordSet = true) => ({
  passwordSet,
  missing,
  serviceReady: !missing.length,
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('normalize uses the new backend fields, ordered canonically', () => {
  const result = gate.normalizeOnboardingStatus({
    passwordSet: false,
    missingRequirements: ['KYC', 'BANK_ACCOUNT', 'bogus', 'PROFILE'],
    serviceReady: false,
  });
  assert.deepEqual(plain(result), {
    passwordSet: false,
    missing: ['PROFILE', 'BANK_ACCOUNT', 'KYC'],
    serviceReady: false,
  });
  // An explicit empty list wins over legacy fields.
  assert.deepEqual(
    plain(gate.normalizeOnboardingStatus({ missingRequirements: [], requiredSteps: ['PROFILE'] })),
    { passwordSet: false, missing: [], serviceReady: true }
  );
});

test('normalize falls back to the legacy steps and never blocks on KYC', () => {
  const result = gate.normalizeOnboardingStatus({
    requiredSteps: ['PROFILE', 'ADDRESS', 'PASSWORD', 'BANK_ACCOUNT', 'KYC'],
    completedSteps: ['PASSWORD', 'ADDRESS'],
  });
  assert.deepEqual(plain(result), {
    passwordSet: true,
    missing: ['PROFILE', 'BANK_ACCOUNT'],
    serviceReady: false,
  });
  assert.equal(gate.normalizeOnboardingStatus({ requiredSteps: ['KYC'] }).serviceReady, true);
  assert.equal(gate.normalizeOnboardingStatus({}).passwordSet, false);
});

test('missing order and labels match the web', () => {
  assert.deepEqual(plain(gate.PROFILE_REQUIREMENTS.map((item) => item.label)), [
    'Thông tin cá nhân',
    'Địa chỉ',
    'Tài khoản ngân hàng',
    'Xác minh danh tính (KYC)',
  ]);
  assert.deepEqual(plain(gate.missingItems(['KYC', 'ADDRESS']).map((item) => item.code)), [
    'ADDRESS',
    'KYC',
  ]);
  assert.equal(
    gate.missingLabels(['KYC', 'PROFILE']),
    'Thông tin cá nhân, Xác minh danh tính (KYC)'
  );
  assert.equal(gate.missingLabels([]), 'hồ sơ');
});

test('isProfileIncomplete needs 403 and code 1010', () => {
  assert.equal(gate.isProfileIncomplete({ status: 403, data: { code: 1010 } }), true);
  assert.equal(gate.isProfileIncomplete({ status: 403, data: { code: '1010' } }), true);
  assert.equal(gate.isProfileIncomplete({ status: 403, data: { code: 1011 } }), false);
  assert.equal(gate.isProfileIncomplete({ status: 401, data: { code: 1010 } }), false);
  assert.equal(gate.isProfileIncomplete({ status: 403, data: null }), false);
  assert.equal(gate.isProfileIncomplete(undefined), false);
});

test('target section: profile, address -> profile; bank -> bank-accounts; KYC has no section', () => {
  const section = (code) => gate.PROFILE_REQUIREMENTS.find((item) => item.code === code).section;
  assert.equal(section('PROFILE'), 'profile');
  assert.equal(section('ADDRESS'), 'profile');
  assert.equal(section('BANK_ACCOUNT'), 'bank-accounts');
  assert.equal(section('KYC'), null);
  assert.equal(gate.firstGateSection(['KYC', 'BANK_ACCOUNT']), 'bank-accounts');
  assert.equal(gate.firstGateSection(['KYC']), null);
  assert.equal(gate.firstGateSection([]), null);
  const response = { data: { result: { missing: ['x', 'BANK_ACCOUNT', 'KYC'] } } };
  assert.deepEqual(plain(gate.profileGateMissing(response)), ['BANK_ACCOUNT', 'KYC']);
  assert.deepEqual(plain(gate.profileGateMissing({ data: {} })), []);
});

test('gateAction: first missing item decides; KYC starts the web flow', () => {
  assert.deepEqual(plain(gate.gateAction(['KYC'])), { kind: 'kyc' });
  assert.deepEqual(plain(gate.gateAction(['KYC', 'BANK_ACCOUNT'])), {
    kind: 'settings',
    section: 'bank-accounts',
  });
  assert.deepEqual(plain(gate.gateAction(['ADDRESS', 'KYC'])), {
    kind: 'settings',
    section: 'profile',
  });
  assert.deepEqual(plain(gate.gateAction(['BANK_ACCOUNT'])), {
    kind: 'settings',
    section: 'bank-accounts',
  });
  assert.equal(gate.gateAction([]), null);
  assert.equal(gate.gateAction(['bogus']), null);
});

test('store: loads, keeps old data on failure, serializes and re-runs after a concurrent refresh', async () => {
  const calls = [];
  const store = createOnboardingStore(() => {
    const call = deferred();
    calls.push(call);
    return call.promise;
  });
  assert.deepEqual(plain(store.get()), { loaded: false, onboarding: null });

  const first = store.refresh();
  const second = store.refresh();
  assert.equal(calls.length, 1, 'no parallel request');
  calls[0].resolve(state(['PROFILE']));
  await tick();
  assert.equal(calls.length, 2, 'the queued refresh re-runs once');
  assert.deepEqual(plain(store.get().onboarding.missing), ['PROFILE']);
  calls[1].resolve(state([]));
  await Promise.all([first, second]);
  assert.deepEqual(plain(store.get()), { loaded: true, onboarding: state([]) });

  const failing = store.refresh();
  await tick();
  calls[2].reject(new Error('offline'));
  await failing;
  assert.equal(store.get().onboarding.serviceReady, true, 'failure keeps the last known status');
});

test('store: clear on sign-out drops state and ignores a request still in flight', async () => {
  const calls = [];
  const store = createOnboardingStore(() => {
    const call = deferred();
    calls.push(call);
    return call.promise;
  });
  let notified = 0;
  store.subscribe(() => notified++);
  const old = store.refresh();
  store.clear();
  calls[0].resolve(state(['PROFILE']));
  await old;
  assert.deepEqual(plain(store.get()), { loaded: false, onboarding: null });
  assert.equal(notified, 0);

  // A new session is not served by the old request.
  const next = store.refresh();
  assert.equal(calls.length, 2);
  calls[1].resolve(state(['ADDRESS'], false));
  await next;
  assert.deepEqual(plain(store.get().onboarding.missing), ['ADDRESS']);
  store.clear();
  assert.deepEqual(plain(store.get()), { loaded: false, onboarding: null });
});

test('store: markPasswordSet closes the gate without a refresh', async () => {
  const store = createOnboardingStore(async () => state(['PROFILE'], false));
  store.markPasswordSet(); // unknown status: nothing to patch
  assert.equal(store.get().onboarding, null);
  await store.refresh();
  assert.equal(store.get().onboarding.passwordSet, false);
  store.markPasswordSet();
  assert.equal(store.get().onboarding.passwordSet, true);
  assert.deepEqual(plain(store.get().onboarding.missing), ['PROFILE']);
});

test('throttle allows one call per window', () => {
  let now = 1000;
  const allow = createThrottle(30_000, () => now);
  assert.equal(allow(), true);
  now += 29_999;
  assert.equal(allow(), false);
  now += 1;
  assert.equal(allow(), true);
});
