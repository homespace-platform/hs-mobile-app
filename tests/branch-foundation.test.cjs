/* global __dirname */
// Shared branch code: parity with the hs-web-app sources next to this app, and the save/draft rules.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, '../hs-web-app');

function loader(base, stubs = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = ts.transpileModule(fs.readFileSync(path.join(base, file), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const mod = { exports: {} };
    cache.set(file, mod);
    const resolve = (name) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith('@/')) return load(`${base === ROOT ? 'src/' : ''}${name.slice(2)}.ts`);
      return require(name);
    };
    // Same realm, so deepStrictEqual compares plain objects.
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(
      resolve,
      mod,
      mod.exports
    );
    return mod.exports;
  }
  return load;
}
const mobile = loader(ROOT);
const web = loader(WEB, { '@/lib/axios-client': {}, '@/lib/contract-routes': {} });

const layout = mobile('src/lib/branch-layout.ts');
const webLayout = web('lib/branch-layout.ts');
const overview = mobile('src/lib/branch-overview.ts');
const webOverview = web('services/branch-overview.service.ts');
const { createLayoutDraftStore } = mobile('src/lib/branch-layout-draft.ts');
const { saveLayoutDraft, loadBranchLayout } = mobile('src/lib/branch-layout-save.ts');
const assignment = mobile('src/lib/branch-assignment.ts');

const tree = (module, draft) => module.toSaveRequest(draft, 0).floors;
const server = (revision, codes) => ({
  revision,
  floors: [
    {
      id: 'f',
      label: 'Tầng 1',
      rows: [
        {
          id: 'r',
          label: 'Dãy 1',
          slots: codes.map((roomCode, i) => ({ id: `s${i}`, roomCode })),
        },
      ],
    },
  ],
});
const httpError = (status, message) =>
  Object.assign(new Error('http'), {
    isAxiosError: true,
    response: status ? { status, data: { message } } : undefined,
  });

test('map editing behaves like the web module', () => {
  for (const template of [
    { kind: 'single', rooms: 3 },
    { kind: 'double', rooms: 2 },
    { kind: 'multi', floors: 3, rooms: 4 },
    { kind: 'custom' },
    { kind: 'house' },
  ]) {
    const edit = (module) => {
      let draft = module.buildTemplate(template);
      draft = module.duplicateFloor(draft, draft[0].key);
      if (draft[0].rows[0]) draft = module.addRooms(draft, draft[0].rows[0].key, 2);
      draft = module.recodeRooms(draft, { prefix: 'P' });
      return { rooms: tree(module, draft), errors: module.validateDraft(draft) };
    };
    assert.deepEqual(edit(layout), edit(webLayout), template.kind);
  }
});

test('overview wording, time, search and strict parsing match the web service', () => {
  for (const value of ['2026-11-26T17:05:00Z', '2026-01-01T00:00:00Z', 'bad'])
    assert.equal(overview.formatInstant(value), webOverview.formatInstant(value), value);
  assert.equal(overview.foldText('  Đặng Thị ÁNH '), webOverview.foldText('  Đặng Thị ÁNH '));
  assert.deepEqual(overview.LAYER_STATUS_LABEL, webOverview.LAYER_STATUS_LABEL);
  assert.equal(overview.workLabel('toString')[1], 'Việc cần xem');
  const payment = { confirmationDueAt: '2026-11-28T00:00:00Z', clock: 'BILLING' };
  const clocks = { billingNow: '2026-11-27T00:00:00Z', realNow: '2026-01-01T00:00:00Z' };
  assert.equal(
    overview.confirmationCountdown(payment, clocks, 60_000),
    webOverview.confirmationCountdown(payment, clocks, 60_000)
  );
  const good = { branchId: 'b', month: '2026-11', ...clocks, rooms: [], unplacedPayments: [] };
  assert.equal(overview.parseOverview(good), good);
  for (const bad of ['<html>', { ...good, month: '2026-13' }, { ...good, rooms: [{}] }])
    assert.throws(() => overview.parseOverview(bad));
  assert.throws(() => overview.parseAttentionSummary({ branches: [{ branchId: 'b', count: -1 }] }));
  assert.deepEqual(
    overview.orderByAttention(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [{ branchId: 'c', count: 2 }]
    ),
    [{ id: 'c' }, { id: 'a' }, { id: 'b' }]
  );
});

test('the daily digest notification opens the branch list', () => {
  const { notificationTarget } = mobile('src/lib/notification.ts');
  assert.deepEqual(notificationTarget('/dashboard/branches'), {
    kind: 'management',
    section: 'landlord-branches',
  });
});

test('assignment links lead to existing mobile screens and writes stay locked without permission', () => {
  assert.deepEqual(assignment.itemDestination('CONTRACT', 'c').route, {
    screen: 'contract-detail',
    side: 'landlord',
    contractId: 'c',
  });
  assert.equal(assignment.itemDestination('LISTING', 'l').kind, 'listing');
  assert.equal(assignment.permissionBlock(false, 'khóa'), 'khóa');
  assert.throws(() => assignment.parseAssignments('<html>'));
});

test('a save is recognized, refused, reported as conflict or kept', async () => {
  const base = layout.fromLayout(server(1, ['101']));
  const next = layout.addRooms(base, 'r');
  const run = (error, latest) =>
    saveLayoutDraft(
      {
        saveLayout: async () => {
          throw error;
        },
        getLayout: async () => {
          if (!latest) throw httpError();
          return latest;
        },
      },
      'b',
      next,
      base,
      1
    );
  assert.equal((await run(httpError(), server(2, ['101', '102']))).kind, 'saved');
  assert.equal((await run(httpError(409), server(2, ['101', '102']))).kind, 'saved');
  assert.deepEqual(await run(httpError(409, 'Phòng còn hợp đồng'), server(1, ['101'])), {
    kind: 'refused',
    message: 'Phòng còn hợp đồng',
  });
  assert.equal((await run(httpError(409), server(3, ['101']))).kind, 'conflict');
  assert.equal((await run(httpError(409), null)).kind, 'conflict');
  assert.equal((await run(httpError(), server(1, ['101']))).kind, 'failed');
  assert.equal((await run(httpError(400, 'Sai'), null)).message, 'Sai');
});

test('only a whole house without a map gets the one-cell map', async () => {
  const sent = [];
  const api = (current) => ({
    getLayout: async () => current,
    saveLayout: async (_id, request) => {
      sent.push(request);
      return server(1, ['Nguyên căn']);
    },
  });
  const empty = { revision: 0, floors: [] };
  assert.equal((await loadBranchLayout(api(empty), 'b', false)).layout.revision, 0);
  await loadBranchLayout(api(server(4, ['1'])), 'b', true);
  assert.equal(sent.length, 0);
  assert.equal((await loadBranchLayout(api(empty), 'b', true)).layout.revision, 1);
  assert.equal(sent[0].expectedRevision, 0);
  assert.equal(sent[0].floors[0].rows[0].slots[0].roomCode, 'Nguyên căn');
  const refused = await loadBranchLayout(
    {
      getLayout: async () => empty,
      saveLayout: async () => {
        throw httpError(403, 'Không có quyền');
      },
    },
    'b',
    true
  );
  assert.deepEqual(refused, { layout: empty, houseError: 'Không có quyền' });
});

test('stored drafts are per user and branch, ordered, and a newer one survives', async () => {
  const values = new Map();
  let delay = 20;
  const store = createLayoutDraftStore({
    getItem: async (key) => values.get(key) ?? null,
    // The first write is the slowest: without the queue it would land last.
    setItem: (key, value) => {
      const wait = delay;
      delay = 0;
      return new Promise((done) => setTimeout(() => done(values.set(key, value)), wait));
    },
    removeItem: async (key) => values.delete(key),
  });
  const older = { revision: 1, draft: layout.buildTemplate({ kind: 'house' }) };
  const newer = { revision: 1, draft: layout.buildTemplate({ kind: 'single', rooms: 2 }) };
  void store.write('u', 'b', older);
  void store.write('u', 'b', newer);
  await store.removeOwned('u', 'b', older);
  assert.deepEqual(await store.read('u', 'b'), newer);
  assert.equal(await store.read('other', 'b'), null);
  assert.equal(await store.read(null, 'b'), null);
  await store.removeOwned('u', 'b', newer);
  assert.equal(await store.read('u', 'b'), null);
  values.set('hs.branch-layout-draft.u.b', '{"revision":1,"draft":[{"label":"x","rows":[]}]}');
  assert.equal(await store.read('u', 'b'), null, 'a node without a key is rejected');
  const broken = createLayoutDraftStore({
    getItem: async () => {
      throw new Error('full');
    },
    setItem: async () => {
      throw new Error('full');
    },
    removeItem: async () => undefined,
  });
  await broken.write('u', 'b', older);
  assert.equal(await broken.read('u', 'b'), null);
});
