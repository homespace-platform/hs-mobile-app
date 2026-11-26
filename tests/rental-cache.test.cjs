/* global __dirname */
// Sensitive temp files of the rental flow (docs/yeu-cau-thue/phase3-cache.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const SRC = path.join(__dirname, '../src');
const CACHE = 'file:///data/app/cache/';

function load(rel, modules, globals = {}) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(SRC, rel), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  vm.runInNewContext(outputText, {
    ...globals,
    module,
    exports: module.exports,
    require: (name) => modules[name] ?? assert.fail(`Unexpected dependency ${name}`),
  });
  return module.exports;
}

const tick = () => new Promise(setImmediate);

function setup({ names = [], entries = {}, broken = false } = {}) {
  const deleted = [];
  const timers = [];
  let id = 0;
  const fileSystem = {
    cacheDirectory: CACHE,
    makeDirectoryAsync: async () => {},
    readDirectoryAsync: async (uri) => {
      if (broken) throw new Error('unreadable');
      return uri === CACHE ? names : (entries[uri.slice(CACHE.length)] ?? []);
    },
    deleteAsync: async (uri) => {
      deleted.push(uri);
      if (broken) throw new Error('busy');
    },
  };
  const cache = load(
    'services/rental/cache.ts',
    {
      'expo-crypto': { randomUUID: () => `id-${++id}` },
      'expo-file-system/legacy': fileSystem,
    },
    { setTimeout: (run, ms) => timers.push({ run, ms }) }
  );
  const write = (name = 'a.pdf') => cache.writeRentalFile(name, 'x.pdf', async (uri) => uri);
  return { cache, deleted, timers, fileSystem, write };
}

test('only copies inside the picker folders of the app cache are ever deleted', async () => {
  const { cache, deleted } = setup();
  for (const uri of [
    'file:///storage/emulated/0/Download/saoke.pdf',
    'content://media/external/images/1',
    'ph://ABC/L0/001',
    `${CACHE}other/a.pdf`,
    `${CACHE}a.pdf`,
    `${CACHE}chat-1/a.pdf`,
    `${CACHE}DocumentPicker/`,
    `${CACHE}DocumentPicker/..`,
    `${CACHE}DocumentPicker/../shared_prefs/x.xml`,
    `${CACHE}DocumentPicker/%2E%2E`,
    `${CACHE}DocumentPicker/..%2F..%2Ffiles%2Fsecret`,
    `${CACHE}ImagePicker/%5C..%5Csecret`,
    `${CACHE}ImagePicker/sub/a.jpg`,
    `${CACHE}ImagePicker/?a.jpg`,
    `${CACHE}ImagePicker/#a.jpg`,
    `${CACHE}ImagePicker/%00`,
    `${CACHE}ImagePicker/%E0%A4%A`,
    `${CACHE}ImagePickerX/a.jpg`,
  ])
    await cache.discardPickedCopy(uri);
  assert.deepEqual(deleted, []);
  const own = [`${CACHE}ImagePicker/u.jpg`, `${CACHE}DocumentPicker/u.pdf`];
  for (const uri of own) await cache.discardPickedCopy(uri);
  assert.deepEqual(deleted, own);
});

test('a rental file keeps its name in its own folder, and only that folder is removed', async () => {
  const { cache, deleted, write } = setup();
  const uri = await write('../../Hợp đồng.pdf');
  assert.equal(uri, `${CACHE}rental-files/id-1/${encodeURIComponent('Hợp đồng.pdf')}`);
  assert.equal(await write('..'), `${CACHE}rental-files/id-2/x.pdf`);
  for (const wrong of [
    `${CACHE}rental-files/`,
    `${CACHE}rental-files/a.pdf`,
    `${CACHE}rental-files/../a.pdf`,
    `${CACHE}rental-files/%2E%2E/a.pdf`,
    `${CACHE}DocumentPicker/a.pdf`,
    'file:///elsewhere/rental-files/id/a.pdf',
  ])
    await cache.discardRentalFile(wrong);
  assert.deepEqual(deleted, []);
  await cache.discardRentalFile(uri);
  assert.deepEqual(deleted, [`${CACHE}rental-files/id-1/`]);
});

test('a shared copy is removed later; one the share sheet never took is removed at once', async () => {
  const { cache, deleted, timers, write } = setup();
  const sent = await write();
  await cache.shareRentalFile(sent, async () => {});
  await cache.discardRentalFile(sent);
  assert.deepEqual(deleted, []);
  assert.equal(timers[0].ms, cache.SHARED_COPY_TTL_MS);
  timers[0].run();
  await tick();
  assert.deepEqual(deleted, [`${CACHE}rental-files/id-1/`]);

  const failing = async () => {
    throw new Error('no app');
  };
  const refused = await write();
  await assert.rejects(cache.shareRentalFile(refused, failing), /no app/);
  await cache.discardRentalFile(refused);
  assert.equal(deleted.at(-1), `${CACHE}rental-files/id-2/`);
  // A later failure does not forget that an earlier share took the file.
  const twice = await write();
  await cache.shareRentalFile(twice, async () => {});
  await assert.rejects(cache.shareRentalFile(twice, failing));
  await cache.discardRentalFile(twice);
  assert.equal(deleted.length, 2);
});

test('the purge takes every rental file and picker copy, and nothing of other features', async () => {
  const uuid = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const { cache, deleted } = setup({
    names: [
      `rental-${uuid}`,
      `contract-${uuid}`,
      'homespace-receipt-r1.pdf',
      'VietQR_HS123.png',
      `chat-${uuid}`,
      'rental-files',
      'http-cache',
    ],
    entries: {
      'DocumentPicker/': ['doc.pdf'],
      'ImagePicker/': ['photo.jpg'],
      'rental-files/': ['private-folder'],
    },
  });
  await cache.purgeSensitiveCache();
  assert.deepEqual(
    deleted.sort(),
    [
      'DocumentPicker/doc.pdf',
      'ImagePicker/photo.jpg',
      'VietQR_HS123.png',
      `contract-${uuid}`,
      'homespace-receipt-r1.pdf',
      `rental-${uuid}`,
      'rental-files/private-folder',
    ]
      .map((name) => CACHE + name)
      .sort()
  );
});

test('the purge never rejects, also when the file system fails or is missing', async () => {
  const failing = setup({ broken: true });
  await failing.cache.purgeSensitiveCache();
  assert.deepEqual(failing.deleted, []);
  const web = setup();
  web.fileSystem.cacheDirectory = null;
  await web.cache.purgeSensitiveCache();
  assert.deepEqual(web.deleted, []);
});

test('nothing written for a session survives its end', async () => {
  const { cache, deleted, write } = setup();
  let finish;
  const late = cache.writeRentalFile(
    'a.pdf',
    'x.pdf',
    (uri) => new Promise((resolve) => (finish = () => resolve(uri)))
  );
  await tick();
  await cache.purgeSensitiveCache();
  assert.deepEqual(deleted, []);
  // Another account signs in before the old download ends.
  cache.openSensitiveCache();
  deleted.length = 0;
  finish();
  await assert.rejects(late);
  assert.deepEqual(deleted, [`${CACHE}rental-files/id-1/`]);

  await cache.purgeSensitiveCache();
  await assert.rejects(write());
  cache.openSensitiveCache();
  await write();
});

function session({ storedToken = null, purge }) {
  const events = [];
  const exports = load('features/auth/session.ts', {
    'expo-auth-session': {
      refreshAsync: async () => {
        throw new Error('expired');
      },
      TokenTypeHint: {},
    },
    'expo-secure-store': {
      getItemAsync: async () => storedToken,
      deleteItemAsync: async () => {
        throw new Error('no store');
      },
    },
    'expo-web-browser': {},
    '@/config/env': { keycloakConfig: {} },
    '@/lib/auth/discovery': { discovery: {} },
    '@/lib/session-end': { runSessionEndCleanups: () => events.push('memory') },
    '@/services/rental/cache': {
      openSensitiveCache: () => events.push('open'),
      purgeSensitiveCache: () => {
        events.push('purge');
        return purge();
      },
    },
  });
  exports.subscribeSession(() => events.push('signed-out'));
  return { exports, events };
}

test('sign-out and a rejected refresh purge without waiting for the cleanup', async () => {
  const never = () => new Promise(() => {});
  const out = session({ purge: never });
  await out.exports.signOut();
  assert.deepEqual(out.events, ['purge', 'memory', 'signed-out']);

  const expired = session({ storedToken: 'old', purge: never });
  assert.equal(await expired.exports.restoreSession(), false);
  assert.deepEqual(expired.events, ['purge', 'memory', 'signed-out']);
});

test('a start without a session purges what a killed app left', async () => {
  const start = session({ purge: async () => {} });
  assert.equal(await start.exports.restoreSession(), false);
  assert.deepEqual(start.events, ['purge']);
});

test('one failing memory cleanup stops neither the others nor the sign-out', () => {
  const registry = load('lib/session-end.ts', {});
  const ran = [];
  registry.onSessionEnd(() => {
    throw new Error('boom');
  });
  registry.onSessionEnd(() => ran.push('second'));
  registry.runSessionEndCleanups();
  assert.deepEqual(ran, ['second']);
});

test('an unsettled POST still locks the same account and listing after sign-out', () => {
  const registry = load('lib/session-end.ts', {});
  const none = new Proxy({}, { get: () => () => {} });
  const source = fs.readFileSync(path.join(SRC, 'components/rental/requests/logic.ts'), 'utf8');
  const modules = Object.fromEntries(
    [...source.matchAll(/from '([^']+)'/g)].map(([, name]) => [name, none])
  );
  modules['@/lib/session-end'] = registry;
  const { submitLocks } = load('components/rental/requests/logic.ts', modules);
  const old = submitLocks.acquire('u:l');
  registry.runSessionEndCleanups();
  assert.equal(submitLocks.acquire('u:l'), null);
  assert.ok(submitLocks.acquire('another:l'));
  old();
  assert.ok(submitLocks.acquire('u:l'));
  old();
  assert.equal(submitLocks.has('u:l'), true);
});

/** The hook with a minimal effect runtime, on the real cache module (so the real lease rules). */
function mountDraft(cache = setup().cache) {
  const refs = [];
  const unmounts = [];
  let index = 0;
  let mounted = false;
  let effects = [];
  const { useDiscardDroppedFiles: useDraftFiles } = load(
    'components/rental/shared/useDiscardDroppedFiles.ts',
    {
      react: {
        useRef: (initial) => (refs[index++] ??= { current: initial }),
        useEffect: (effect, deps) => effects.push({ effect, once: !!deps }),
      },
      '@/services/rental/cache': cache,
    }
  );
  return {
    useRender(uris) {
      index = 0;
      effects = [];
      useDraftFiles(uris.map((uri) => ({ uri })));
      for (const { effect, once } of effects) {
        if (!once) effect();
        else if (!mounted) unmounts.push(effect());
      }
      mounted = true;
    },
    unmount: () => unmounts.forEach((cleanup) => cleanup()),
  };
}

const picked = (name) => `${CACHE}DocumentPicker/${name}`;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => ((resolve = yes), (reject = no)));
  return { promise, resolve, reject };
};

test('a draft keeps its files for a retry and lets go of removed, sent and closed ones', async () => {
  const { cache, deleted } = setup();
  const draft = mountDraft(cache);
  draft.useRender([]);
  draft.useRender([picked('a'), picked('b')]);
  // A failed send: the same files are still held.
  await assert.rejects(
    cache.withFileLease([picked('a'), picked('b')], async () => {
      throw new Error('offline');
    })
  );
  draft.useRender([picked('a'), picked('b')]);
  assert.deepEqual(deleted, []);
  draft.useRender([picked('b'), picked('c')]);
  await tick();
  assert.deepEqual(deleted, [picked('a')]);
  draft.useRender([]);
  await tick();
  assert.deepEqual(deleted, [picked('a'), picked('b'), picked('c')]);
});

test('replace, remove and close wait for the upload that reads the file, however it ends', async () => {
  for (const end of ['resolve', 'reject']) {
    const { cache, deleted, timers } = setup();
    const draft = mountDraft(cache);
    draft.useRender([picked('a')]);
    const upload = deferred();
    const running = cache.withFileLease([picked('a')], () => upload.promise).catch(() => {});
    // Replaced while uploading.
    draft.useRender([picked('b')]);
    await tick();
    assert.deepEqual(deleted, []);
    upload[end]();
    await running;
    await tick();
    assert.deepEqual(deleted, [picked('a')]);
    assert.equal(timers.length, 0);
  }

  // A batch: closed while the first file uploads, the one still waiting its turn stays too.
  const { cache, deleted } = setup();
  const draft = mountDraft(cache);
  draft.useRender([picked('a'), picked('b')]);
  const first = deferred();
  const batch = cache.withFileLease([picked('a'), picked('b')], async () => {
    await cache.withFileLease([picked('a')], () => first.promise);
    await tick();
    assert.deepEqual(deleted, []);
  });
  draft.unmount();
  await tick();
  first.resolve();
  await batch;
  await tick();
  assert.deepEqual(deleted.sort(), [picked('a'), picked('b')]);
});

test('the purge leaves what is in use until it is free, and takes everything else', async () => {
  const { cache, deleted, timers, fileSystem, write } = setup();
  const shared = await write('shared.pdf');
  await write('idle.pdf');
  await cache.shareRentalFile(shared, async () => {});
  fileSystem.readDirectoryAsync = async (uri) =>
    ({
      [`${CACHE}rental-files/`]: ['id-1', 'id-2'],
      [`${CACHE}DocumentPicker/`]: ['busy.pdf', 'stale.pdf'],
    })[uri] ?? [];
  const upload = deferred();
  const running = cache.withFileLease([picked('busy.pdf')], () => upload.promise);
  // Sign-out never waits for the upload.
  await cache.purgeSensitiveCache();
  assert.deepEqual(deleted.sort(), [picked('stale.pdf'), `${CACHE}rental-files/id-2`].sort());
  deleted.length = 0;
  // The grace period of the share ends.
  timers[0].run();
  upload.resolve();
  await running;
  await tick();
  assert.deepEqual(deleted.sort(), [picked('busy.pdf'), `${CACHE}rental-files/id-1/`]);
  // The next purge still works entry by entry when nothing is held.
  deleted.length = 0;
  await cache.purgeSensitiveCache();
  assert.ok(deleted.includes(picked('stale.pdf')));
  assert.ok(deleted.includes(`${CACHE}rental-files/id-2`));
  assert.ok(deleted.every((uri) => !uri.endsWith('/')));
});

test('a slow purge cannot delete picker copies created by a new session', async () => {
  const { cache, deleted, fileSystem } = setup();
  const listing = deferred();
  fileSystem.readDirectoryAsync = async (uri) =>
    uri === `${CACHE}DocumentPicker/` ? listing.promise : [];
  const purge = cache.purgeSensitiveCache();
  cache.openSensitiveCache();
  listing.resolve(['new.pdf']);
  await purge;
  assert.deepEqual(deleted, []);
});

test('every upload path leases its file before the first await', () => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
  for (const rel of [
    'services/storageApi.ts',
    'services/chatMediaApi.ts',
    'services/rental/storage.service.ts',
    // Batches: files still waiting their turn.
    'screens/MessagesScreen.tsx',
    'services/listingEditorApi.ts',
    'components/rental/billing/ClosureProposalForm.tsx',
    'components/rental/billing/ClosureProposalView.tsx',
    'components/rental/billing/ComplaintPanel.tsx',
    'components/rental/billing/MonthlyInvoicesSection.tsx',
    'components/rental/billing/SettlementPaymentPanel.tsx',
    'components/rental/contract/ContractAmendmentPanel.tsx',
    'components/rental/onboarding/RentalWorkflowPanel.tsx',
  ])
    assert.match(read(rel), /withFileLease\(/, rel);
});
