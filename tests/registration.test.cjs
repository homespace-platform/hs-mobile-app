const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/features/auth/registration.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;

function setup({
  result = { type: 'success', params: { code: 'auth-code' } },
  missingVerifier = false,
  exchangeError,
  promptError,
} = {}) {
  const requests = [];
  const exchanges = [];
  const module = { exports: {} };
  class AuthRequest {
    constructor(config) {
      this.config = config;
      this.codeVerifier = missingVerifier ? undefined : `verifier-${requests.length}`;
      requests.push(this);
    }
    async promptAsync(discovery) {
      this.discovery = discovery;
      if (promptError) throw promptError;
      return result;
    }
  }
  const dependencies = {
    'expo-auth-session': { AuthRequest, CodeChallengeMethod: { S256: 'S256' } },
    '@/config/env': { keycloakConfig: { clientId: 'homespace-mobile' } },
    '@/features/auth/session': {
      exchangeAuthorizationCode: async (...args) => {
        exchanges.push(args);
        if (exchangeError) throw exchangeError;
      },
    },
    '@/lib/auth/discovery': {
      authScopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri: 'homespace://oauth2redirect',
      discovery: {
        tokenEndpoint: 'https://id.example/token',
        authorizationEndpoint: 'https://id.example/auth',
      },
      registrationEndpoint: 'https://id.example/registrations',
    },
  };
  vm.runInNewContext(source, {
    exports: module.exports,
    require: (name) => {
      assert.ok(dependencies[name], `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return { register: module.exports.registerWithKeycloak, requests, exchanges };
}

test('registration uses the mobile client, redirect and S256 PKCE and exchanges its code', async () => {
  const { register, requests, exchanges } = setup();
  await register();
  const request = requests[0];
  assert.equal(request.config.clientId, 'homespace-mobile');
  assert.equal(request.config.redirectUri, 'homespace://oauth2redirect');
  assert.equal(request.config.usePKCE, true);
  assert.equal(request.config.codeChallengeMethod, 'S256');
  assert.ok(request.config.scopes.includes('openid'));
  assert.equal(request.config.clientSecret, undefined);
  assert.equal(request.discovery.authorizationEndpoint, 'https://id.example/registrations');
  assert.equal(request.discovery.tokenEndpoint, 'https://id.example/token');
  assert.deepEqual(exchanges, [['auth-code', 'verifier-0']]);
  await register();
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0], requests[1]);
  assert.deepEqual(exchanges[1], ['auth-code', 'verifier-1']);
});

test('canceling or dismissing registration leaves the session untouched', async () => {
  for (const type of ['cancel', 'dismiss']) {
    const { register, exchanges } = setup({ result: { type } });
    await register();
    assert.equal(exchanges.length, 0);
  }
});

test('auth errors, missing callback data and a busy browser never exchange tokens', async () => {
  for (const options of [
    { result: { type: 'error', params: {}, error: { message: 'State mismatch' } } },
    { result: { type: 'success', params: {} } },
    { missingVerifier: true },
    { result: { type: 'locked' } },
    { promptError: new Error('Browser unavailable') },
  ]) {
    const { register, exchanges } = setup(options);
    await assert.rejects(register);
    assert.equal(exchanges.length, 0);
  }
});

test('token exchange failure reaches the registration screen', async () => {
  const { register } = setup({ exchangeError: new Error('Token endpoint unavailable') });
  await assert.rejects(register, /Token endpoint unavailable/);
});
