/* global __dirname */
// Editing side of the branch screens: room-linked listings, the local map draft and the tray writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, '../hs-web-app');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function loader(base) {
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
      const prefix = base === ROOT ? 'src/' : '';
      if (name.startsWith('@/')) {
        const target = prefix + name.slice(2);
        return name.endsWith('.json') ? require(path.join(base, target)) : load(`${target}.ts`);
      }
      if (name.startsWith('.'))
        return load(`${path.posix.join(path.posix.dirname(file), name)}.ts`);
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
const web = loader(WEB);

const roomLink = mobile('src/lib/listing-room-link.ts');
const webRoomLink = web('lib/listing-room-link.ts');
const editor = mobile('src/lib/listing-editor.ts');
const form = mobile('src/lib/listing-form.ts');
const payload = mobile('src/lib/listing-payload.ts');
const layoutLib = mobile('src/lib/branch-layout.ts');
const { createLayoutDraftStore } = mobile('src/lib/branch-layout-draft.ts');
const logic = mobile('src/components/branch/editing/logic.ts');

test('reload after a 409 must keep the draft if the new map cannot be downloaded', () => {
  const editorScreen = read('src/components/branch/editing/BranchMapEditor.tsx');
  const reload = editorScreen.slice(
    editorScreen.indexOf('  const reload ='),
    editorScreen.indexOf('  const acceptsLostRooms =')
  );
  assert.equal(
    /await session\.forget\(\);\s*await fetchLayout\(\);/.test(reload),
    false,
    'a failed GET after the confirmation must leave a recoverable draft on this phone'
  );
});

test('an assignment read failure cannot silently unlink a removed saved room', () => {
  const editorScreen = read('src/components/branch/editing/BranchMapEditor.tsx');
  assert.equal(
    /getAssignments\(branchId\)\.catch\(\(\) => null\);\s*if \(!links\) return true;/.test(
      editorScreen
    ),
    false,
    'the write may succeed and lose links to listings or past contracts without warning'
  );
});

const LAYOUT = {
  revision: 2,
  floors: [
    {
      id: 'f',
      label: 'Tầng 1',
      rows: [
        {
          id: 'r',
          label: 'Dãy 1',
          slots: [{ id: 's1', roomCode: '101' }, { id: 's2', roomCode: null }, { id: 's3' }],
        },
      ],
    },
  ],
};

test('only a plain create can carry a room, and it equals the web module', () => {
  assert.deepEqual(roomLink.listRooms(LAYOUT), webRoomLink.listRooms(LAYOUT));
  assert.deepEqual(roomLink.listRooms(LAYOUT), [{ id: 's1', label: '101 · Tầng 1 · Dãy 1' }]);
  const ids = { branchId: 'b', roomId: 's1' };
  assert.deepEqual(roomLink.readRoomLink(ids), ids);
  for (const extra of [{ listingId: 'x' }, { duplicateFromId: 'x' }])
    assert.equal(roomLink.readRoomLink({ ...ids, ...extra }), null);
  for (const missing of [{ branchId: 'b' }, { roomId: 's1' }, {}])
    assert.equal(roomLink.readRoomLink(missing), null);
  for (const [request, room] of [
    [{ id: null }, 's1'],
    [{ id: null }, null],
    [{ id: 'l' }, 's1'],
    [{ id: null, duplicateSourceListingId: 'l' }, 's1'],
  ]) {
    const result = roomLink.withRoomId(request, room);
    assert.deepEqual(result, webRoomLink.withRoomId(request, room));
    if (!result.roomId) assert.equal(result, request);
  }
});

function listing() {
  const state = form.createListingForm();
  Object.assign(state.basicInfo, {
    category: 'room',
    branchId: 'b',
    title: 'Tin cho thuê thử nghiệm',
    description: 'Mô tả đủ dài cho tin cho thuê thử nghiệm này.',
  });
  Object.assign(state.roomDetails, { areaM2: '25', roomCode: '101' });
  state.pricing.priceMonthly = '5000000';
  state.furnishingAssets = [{ ...form.emptyFurnishingRow(), assetName: 'Giường', quantity: '1' }];
  state.selectedAddress = { refId: 'ref' };
  state.addressMode = 'new';
  state.selectedViewingDays = ['MONDAY'];
  state.selectedViewingSlots = ['MORNING'];
  state.basicInfo.images = [
    {
      name: 'a',
      uri: 'a',
      file: { uri: 'a', fileName: 'a', contentType: 'image/jpeg', sizeBytes: 1 },
    },
  ];
  return state;
}

async function save({ session = editor.createListingSession(), hasRoom, ...input } = {}) {
  const calls = [];
  let sent;
  const result = await editor.saveListing(
    {
      state: listing(),
      session,
      catalog: null,
      catalogError: '',
      savedAddress: null,
      action: 'SAVE_DRAFT',
      profile: { kycVerified: true },
      ...input,
    },
    {
      onStart: () => calls.push('start'),
      upload: async () => (calls.push('upload'), 'stored'),
      upsert: async (body) => (calls.push('upsert'), (sent = body), { id: 'new' }),
      ...(hasRoom && { hasRoom: async (link) => (calls.push('check'), hasRoom(link)) }),
    }
  );
  return { result, calls, sent };
}

test('the room is checked before anything is uploaded; without it the request is unchanged', async () => {
  const link = { branchId: 'b', roomId: 's1' };
  const plain = await save();
  assert.equal(plain.result.status, 'saved', plain.result.message);
  const expected = payload.buildCreateListingPayload(
    editor.buildPayloadParams(listing(), editor.createListingSession(), null, null, 'SAVE_DRAFT', [
      { storageObjectId: 'stored', mediaType: 'IMAGE' },
    ])
  );
  assert.deepEqual(plain.sent, expected);
  assert.ok(!('roomId' in plain.sent));
  assert.deepEqual(plain.calls, ['start', 'upload', 'upsert']);

  const linked = await save({ roomLink: link, hasRoom: () => true });
  assert.deepEqual(linked.calls, ['start', 'check', 'upload', 'upsert']);
  assert.deepEqual(linked.sent, { ...expected, roomId: 's1' });

  // Gone, unreadable or unverifiable: nothing is uploaded and no unlinked listing is created.
  for (const hasRoom of [
    () => false,
    () => {
      throw { isAxiosError: true };
    },
    undefined,
  ]) {
    const refused = await save({ roomLink: link, hasRoom });
    assert.equal(refused.result.status, 'error');
    assert.equal(refused.result.maybeSaved, undefined);
    assert.ok(!refused.calls.includes('upload') && !refused.calls.includes('upsert'));
  }
  assert.equal(
    (await save({ roomLink: link, hasRoom: () => false })).result.message,
    roomLink.ROOM_GONE_MESSAGE
  );

  const other = await save({ roomLink: { ...link, branchId: 'other' }, hasRoom: () => true });
  assert.deepEqual([other.result.message, other.calls], [roomLink.ROOM_BRANCH_MESSAGE, []]);

  for (const mode of ['edit', 'duplicate']) {
    const session = {
      ...editor.createListingSession(),
      mode,
      listingId: 'x',
      status: 'DRAFT',
    };
    const copy = await save({ session, roomLink: link, hasRoom: () => false });
    assert.equal(copy.result.status, 'saved', mode);
    assert.ok(!('roomId' in copy.sent) && !copy.calls.includes('check'), mode);
  }
});

test('the editor wires the room link: branch change drops it, the map is read again', () => {
  const hook = read('src/components/listing-editor/useListingEditor.ts');
  assert.match(hook, /link && branchId !== link\.branchId[\s\S]{0,80}setRoomLink\(null\)/);
  assert.match(hook, /roomLink: now\.roomLink/);
  assert.match(
    read('src/services/listingEditorApi.ts'),
    /hasRoom: async[\s\S]{0,120}getLayout\(branchId\)/
  );
  const screen = read('src/components/branch/editing/NewRoomListingScreen.tsx');
  assert.match(screen, /branchId=\{branchId\}\s+roomId=\{roomId\}/);
});

function memory() {
  const data = new Map();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  };
}

test('a draft session offers, keeps and deletes only what the web rules allow', async () => {
  const storage = memory();
  const store = createLayoutDraftStore(storage);
  const session = () => logic.createDraftSession(store, 'u', 'b');
  const same = { revision: 2, draft: layoutLib.fromLayout(LAYOUT) };
  const edited = { revision: 2, draft: layoutLib.addFloor(same.draft) };

  assert.equal(await session().open(LAYOUT), null);
  // A copy of the loaded tree holds nothing unsaved and is removed.
  await store.write('u', 'b', same);
  assert.equal(await session().open(LAYOUT), null);
  assert.equal(storage.data.size, 0);
  // The same tree from another revision, or another tree, is offered and left alone.
  for (const stored of [{ ...same, revision: 1 }, edited]) {
    await store.write('u', 'b', stored);
    const reopened = session();
    assert.deepEqual(await reopened.open(LAYOUT), stored);
    await reopened.forget(); // owns nothing yet
    assert.deepEqual(await store.read('u', 'b'), stored);
  }
  // Another account or branch sees nothing.
  assert.equal(await logic.createDraftSession(store, 'v', 'b').open(LAYOUT), null);
  assert.equal(await logic.createDraftSession(store, 'u', 'c').open(LAYOUT), null);

  const owner = session();
  owner.takeOver(edited);
  await owner.forget();
  assert.equal(storage.data.size, 0);

  // Calls made without waiting stay in order: the last one wins.
  const quick = session();
  const writes = [quick.keep(same), quick.keep(edited), quick.forget()];
  await Promise.all(writes);
  assert.equal(storage.data.size, 0);

  // A newer revision is neither overwritten nor deleted.
  const newer = { revision: 3, draft: edited.draft };
  await store.write('u', 'b', newer);
  const old = session();
  await old.keep(edited);
  assert.deepEqual(await store.read('u', 'b'), newer);
  await old.forget();
  assert.deepEqual(await store.read('u', 'b'), newer);

  await session().drop(newer);
  assert.equal(storage.data.size, 0);
  // A broken structure is never offered.
  storage.data.set(
    'hs.branch-layout-draft.u.b',
    JSON.stringify({ revision: 2, draft: [{ key: 'a', label: 'x' }] })
  );
  assert.equal(await session().open(LAYOUT), null);
});

test('adding an old contract without a room never sends roomId null', async () => {
  const calls = [];
  const api = {
    putContract: async (...args) => void calls.push(['put', ...args]),
    addContractToTray: async (...args) => void calls.push(['tray', ...args]),
  };
  await logic.addOldContract(api, 'b', 'c', null);
  await logic.addOldContract(api, 'b', 'c', 'room');
  assert.deepEqual(calls, [
    ['tray', 'b', 'c'],
    ['put', 'b', 'c', 'room'],
  ]);
  assert.match(read('src/services/branchMonitorApi.ts'), /\{ addToTray: true \}/);
  const tray = read('src/components/branch/editing/UnplacedTray.tsx');
  assert.match(tray, /addOldContract\(/);
  assert.doesNotMatch(tray, /putContract\([^)]*null/);
});

test('the shown floor survives new ids and removals; room search ignores accents', () => {
  const draft = layoutLib.buildTemplate({ kind: 'multi', floors: 3, rooms: 1 });
  assert.equal(logic.pickFloor(draft, { key: draft[2].key, index: 0 }).index, 2);
  assert.equal(logic.pickFloor(draft, { key: 'gone', index: 1 }).floor, draft[1]);
  assert.equal(logic.pickFloor(draft, { key: 'gone', index: 9 }).index, 2);
  assert.deepEqual(logic.pickFloor([], { key: '', index: 4 }), { floor: null, index: 0 });
  assert.ok(logic.matchesText('101 · Tầng 1, Dãy 1', 'tang 1, day'));
  assert.ok(logic.matchesText('Khu Đông', 'dong'));
  assert.ok(!logic.matchesText('101', '102'));
});

// R-D: acknowledgedDetach and 409/4093.
const { saveWithLinks } = mobile('src/lib/branch-layout-save.ts');
const conflict = (code) =>
  Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { code } } });
const linksOf = (listing, contract) => ({
  rooms: [
    {
      roomId: 's1',
      manualStatus: 'NONE',
      listings: listing ? [{ id: listing }] : [],
      contracts: contract ? [{ id: contract, status: 'CLOSED' }] : [],
      holds: [],
    },
  ],
});
function rdHarness({ reads, saves }) {
  const sent = [];
  const asked = [];
  const api = {
    getLayout: async () => LAYOUT,
    saveLayout: async (_id, request) => {
      sent.push(request);
      const next = saves.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  };
  const readLinks = async () => reads.shift() ?? null;
  const ask = async (lost, links) => (asked.push({ lost, links }), true);
  return { api, readLinks, ask, sent, asked };
}
const baseDraft = layoutLib.fromLayout(LAYOUT);
const removed = layoutLib.fromLayout({
  ...LAYOUT,
  floors: [{ ...LAYOUT.floors[0], rows: [{ ...LAYOUT.floors[0].rows[0], slots: [{ id: 's1', roomCode: null }] }] }],
});

test('a save without a removed room sends empty acknowledgedDetach and reads nothing', async () => {
  const h = rdHarness({ reads: [], saves: [{ revision: 3, floors: [] }] });
  const out = await saveWithLinks(h.api, h.readLinks, h.ask, 'b', baseDraft, baseDraft, 2);
  assert.equal(out.kind, 'saved');
  assert.deepEqual(h.sent[0].acknowledgedDetach, { listingIds: [], contractIds: [] });
  assert.equal(h.asked.length, 0);
});

test('a removed room sends the listing and contract ids the owner confirmed', async () => {
  const h = rdHarness({ reads: [linksOf('L1', 'C1')], saves: [{ revision: 3, floors: [] }] });
  const out = await saveWithLinks(h.api, h.readLinks, h.ask, 'b', removed, baseDraft, 2);
  assert.equal(out.kind, 'saved');
  assert.deepEqual(h.sent[0].acknowledgedDetach, { listingIds: ['L1'], contractIds: ['C1'] });
});

test('4093 re-reads, asks again with the new links and resends only what was confirmed', async () => {
  const h = rdHarness({
    reads: [linksOf('L1', null), linksOf('L1', 'C2')],
    saves: [conflict(4093), { revision: 3, floors: [] }],
  });
  const out = await saveWithLinks(h.api, h.readLinks, h.ask, 'b', removed, baseDraft, 2);
  assert.equal(out.kind, 'saved');
  assert.equal(h.asked.length, 2);
  assert.deepEqual(h.sent.map((r) => r.acknowledgedDetach), [
    { listingIds: ['L1'], contractIds: [] },
    { listingIds: ['L1'], contractIds: ['C2'] },
  ]);
});

test('declining the second question after 4093 sends nothing more and keeps the draft', async () => {
  const h = rdHarness({ reads: [linksOf('L1', null), linksOf('L1', 'C2')], saves: [conflict(4093)] });
  let n = 0;
  const out = await saveWithLinks(h.api, h.readLinks, async () => ++n === 1, 'b', removed, baseDraft, 2);
  assert.equal(out.kind, 'cancelled');
  assert.equal(h.sent.length, 1);
});

test('4093 repeating with the same confirmation is not resent forever', async () => {
  const h = rdHarness({
    reads: [linksOf('L1', null), linksOf('L1', null)],
    saves: [conflict(4093), conflict(4093)],
  });
  const out = await saveWithLinks(h.api, h.readLinks, h.ask, 'b', removed, baseDraft, 2);
  assert.equal(out.kind, 'failed');
  assert.equal(h.sent.length, 1);
});

test('the editor saves through one guarded path (no double submit, draft kept by the dirty effect)', () => {
  const src = read('src/components/branch/editing/BranchMapEditor.tsx');
  assert.ok(src.includes('saveWithLinks('));
  assert.ok(/if \(savingRef\.current \|\| !dirty/.test(src));
  assert.equal(src.includes('acceptsLostRooms'), false);
});

test('the fee warning follows the server missingCharges, not NOT_APPLICABLE choices', () => {
  const screen = read('src/screens/BranchManagementScreen.tsx');
  assert.match(screen, /const missingFees = selected\?\.missingCharges \?\? \[\];/);
  assert.equal(/missingFees = \[\s*form\.category/.test(screen), false);
});
