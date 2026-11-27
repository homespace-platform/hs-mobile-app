/* global __dirname */
// Room codes (the map is the standard), the main action of a room and the listing editor prefill.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const source = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  const resolve = (name) =>
    name.endsWith('.json') && name.startsWith('@/')
      ? require(path.join(ROOT, 'src', name.slice(2)))
      : name.startsWith('@/')
        ? load(`src/${name.slice(2)}.ts`)
        : require(name);
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(resolve, mod, mod.exports);
  return mod.exports;
}
const a = load('src/lib/branch-assignment.ts');
const layoutLib = load('src/lib/branch-layout.ts');
const save = load('src/lib/branch-layout-save.ts');
const roomLink = load('src/lib/listing-room-link.ts');
const form = load('src/lib/listing-form.ts');

const LAYOUT = {
  revision: 4,
  floors: [
    {
      id: 'f',
      label: 'Tầng 1',
      rows: [
        {
          id: 'r',
          label: 'Dãy 1',
          slots: [
            { id: 's1', roomCode: '101' },
            { id: 's2', roomCode: '102' },
            { id: 's3', roomCode: null },
          ],
        },
      ],
    },
  ],
};

test('a listing code warns only when it differs after trim and case', () => {
  assert.equal(a.codeMismatch('101', ' 101 '), null);
  assert.equal(a.codeMismatch('A1', 'a1'), null);
  assert.equal(a.codeMismatch('101', 'B7'), 'B7');
  // Absent, empty and a house (null) never warn.
  for (const none of [undefined, null, '', '  ']) assert.equal(a.codeMismatch('101', none), null);
  assert.equal(a.codeMismatch(null, 'B7'), null);
});

test('mismatched rooms come only from listings that declare another code', () => {
  const room = (roomId, ...codes) => ({
    roomId,
    manualStatus: 'NONE',
    contracts: [],
    holds: [],
    listings: codes.map((roomCode, i) => ({
      id: `${roomId}${i}`,
      title: 't',
      operationalStatus: 'PUBLISHED',
      roomCode,
    })),
  });
  const options = a.roomOptions(layoutLib.fromLayout(LAYOUT));
  const found = a.mismatchedRoomIds(
    [room('s1', '101'), room('s2', '102', 'X9'), room('s3', undefined)],
    options
  );
  assert.deepEqual([...found], ['s2']);
  assert.deepEqual([...a.mismatchedRoomIds([room('s1')], options)], []);
});

test('candidates: same code first, stable, codes spelled out, other cells block a rename', () => {
  const items = [
    { id: '1', roomCode: 'B7' },
    { id: '2', roomCode: null },
    { id: '3', roomCode: '101' },
    { id: '4', roomCode: ' 101' },
    { id: '5' },
  ];
  assert.deepEqual(
    a.sortCandidates(items, '101').map((i) => i.id),
    ['3', '4', '1', '2', '5']
  );
  assert.equal(a.sortCandidates(items, null), items);
  assert.equal(a.candidateCodeNote('101', null), '');
  const options = [
    { id: 's1', code: '101' },
    { id: 's2', code: '102' },
  ];
  assert.equal(a.codeTaken(options, 's1', ' 102'), true);
  assert.equal(a.codeTaken(options, 's1', '101'), false);
});

test('all candidate pages are read once each, capped, without duplicates', async () => {
  const pages = [];
  const get = async (page) => {
    pages.push(page);
    return {
      page,
      size: 2,
      totalElements: 5,
      items: [{ id: `a${page}` }, { id: page === 2 ? 'a1' : `b${page}` }],
    };
  };
  const all = await a.loadAllCandidates(get);
  assert.deepEqual(pages, [0, 1, 2]);
  assert.deepEqual(
    all.items.map((i) => i.id),
    ['a0', 'b0', 'a1', 'b1', 'a2']
  );
  assert.equal(all.total, 5);
  const many = [];
  await a.loadAllCandidates(
    async (page) => (many.push(page), { page, size: 1, totalElements: 999, items: [] })
  );
  assert.equal(many.length, a.MAX_CANDIDATE_PAGES);
});

test('the main action: running contract, hold, listing, else post', () => {
  const room = (over) => ({
    roomId: 'r',
    manualStatus: 'NONE',
    contracts: [],
    holds: [],
    listings: [],
    ...over,
  });
  const c = (id, status) => ({ id, status, startDate: null, endDateExclusive: null, tenantName: null });
  const hold = { rentalRequestId: 'h', moveInDate: null, tenantName: null };
  const listing = { id: 'l', title: 't', operationalStatus: 'PUBLISHED' };
  assert.deepEqual(
    a.primaryAction(
      room({ contracts: [c('old', 'CLOSED'), c('now', 'ACTIVE')], holds: [hold], listings: [listing] })
    ),
    { kind: 'contract', id: 'now', label: 'Mở hợp đồng' }
  );
  assert.equal(a.primaryAction(room({ contracts: [c('old', 'CLOSED')], holds: [hold] })).kind, 'hold');
  assert.equal(
    a.primaryAction(room({ contracts: [c('old', 'TERMINATED')], listings: [listing] })).kind,
    'listing'
  );
  assert.deepEqual(a.primaryAction(room({})), { kind: 'attach', label: 'Gắn tin' });
});

test('attach result: contractId and contractNote are optional, an older server sends neither', () => {
  const none = { contractId: null, contractNote: null };
  assert.deepEqual(a.parseListingLink(undefined), none);
  assert.deepEqual(a.parseListingLink({ listingId: 'l', roomId: 'r' }), none);
  assert.deepEqual(a.parseListingLink({ contractId: 'c1', contractNote: '  ' }), { contractId: 'c1', contractNote: null });
  assert.deepEqual(a.parseListingLink({ contractId: 5, contractNote: 'Trùng lịch.' }), { contractId: null, contractNote: 'Trùng lịch.' });
  assert.deepEqual(a.listingLinkOutcome(none, '101', null), { success: 'Đã gắn tin vào phòng 101.', note: null });
  assert.equal(
    a.listingLinkOutcome(none, '101', '102').success,
    'Đã gắn tin vào phòng 101. Mã trên tin (102) khác mã ô.'
  );
  assert.equal(
    a.listingLinkOutcome({ contractId: 'c', contractNote: null }, '101', null).success,
    'Đã gắn tin và hợp đồng đang hiệu lực vào phòng 101.'
  );
  assert.equal(a.listingLinkOutcome({ contractId: null, contractNote: 'Trùng lịch.' }, '101', null).note, 'Trùng lịch.');
});

function api(replies) {
  const sent = [];
  return {
    sent,
    getLayout: async () => LAYOUT,
    saveLayout: async (_id, request) => {
      sent.push(request);
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  };
}
const noDraft = async () => false;

test('renaming a cell saves the whole map at the loaded revision with empty acknowledgedDetach', async () => {
  const slots = [
    { id: 's1', roomCode: 'A1' },
    { id: 's2', roomCode: '102' },
    { id: 's3', roomCode: null },
  ];
  const saved = {
    revision: 5,
    floors: [{ ...LAYOUT.floors[0], rows: [{ ...LAYOUT.floors[0].rows[0], slots }] }],
  };
  const client = api([saved]);
  const out = await save.recodeSavedRoom(client, 'b', LAYOUT, 's1', ' A1 ', noDraft);
  assert.equal(out.kind, 'saved');
  assert.equal(client.sent.length, 1);
  assert.equal(client.sent[0].expectedRevision, 4);
  assert.deepEqual(client.sent[0].acknowledgedDetach, { listingIds: [], contractIds: [] });
  assert.deepEqual(
    client.sent[0].floors[0].rows[0].slots.map((s) => [s.id, s.roomCode]),
    [
      ['s1', 'A1'],
      ['s2', '102'],
      ['s3', null],
    ]
  );
});

test('renaming is refused without sending: taken code, unknown or empty cell, unsaved draft', async () => {
  const client = api([]);
  const run = (id, code, draft = noDraft) =>
    save.recodeSavedRoom(client, 'b', LAYOUT, id, code, draft);
  assert.equal((await run('s1', '102')).kind, 'blocked');
  assert.equal((await run('s1', '  ')).kind, 'blocked');
  assert.equal((await run('s3', 'X')).kind, 'blocked');
  assert.equal((await run('nope', 'X')).kind, 'blocked');
  const held = await run('s1', 'X', async () => true);
  assert.equal(held.kind, 'blocked');
  assert.match(held.message, /bản nháp/);
  assert.equal(client.sent.length, 0);
});

test('a failed rename reports failure and never claims it saved', async () => {
  const down = Object.assign(new Error('x'), { isAxiosError: true });
  const out = await save.recodeSavedRoom(api([down]), 'b', LAYOUT, 's1', 'A1', noDraft);
  assert.equal(out.kind, 'failed');
});

test('a new listing from a room gets the room code only into an empty code field', () => {
  const state = (category) => {
    const s = form.createListingForm();
    s.basicInfo.category = category;
    s.basicInfo.title = 'Tin';
    return s;
  };
  const room = roomLink.prefillRoomCode(state('room'), ' 101 ');
  assert.equal(room.roomDetails.roomCode, '101');
  assert.equal(room.basicInfo.title, 'Tin');
  const flat = roomLink.prefillRoomCode(state('apartment'), '101');
  assert.equal(flat.apartmentDetails.unitNumber, '101');
  assert.equal(flat.basicInfo.title, 'Tin');
  // Never over something typed, never for a house, never for an empty code.
  const typed = state('room');
  typed.roomDetails.roomCode = 'P2';
  assert.equal(roomLink.prefillRoomCode(typed, '101'), typed);
  const house = state('house');
  assert.equal(roomLink.prefillRoomCode(house, '101'), house);
  const empty = state('room');
  assert.equal(roomLink.prefillRoomCode(empty, '  '), empty);
  assert.deepEqual(roomLink.listRooms(LAYOUT).map((r) => r.code), ['101', '102']);
});

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('the room panel is ordered main action, Liên kết, Đánh dấu phòng', () => {
  const panel = read('src/components/branch/editing/RoomLinksPanel.tsx');
  const at = (text) => panel.lastIndexOf(text);
  assert.ok(at('label={primary.label}') < at('<Heading>Liên kết</Heading>'));
  assert.ok(at('<Heading>Liên kết</Heading>') < at('title="Đánh dấu phòng"'));
});

test('structural cell actions stay in the editor; the view only switches to it', () => {
  const map = read('src/components/branch/view/BranchMapView.tsx');
  assert.ok(map.includes('<ModeSwitch onEdit={onEditMap} />'));
  for (const file of ['BranchMapView', 'RoomSheet', 'FloorBoard'])
    assert.equal(/removeSlot|moveSlot|toggleEmptyCell/.test(read(`src/components/branch/view/${file}.tsx`)), false);
  assert.equal(/removeSlot|moveSlot|toggleEmptyCell/.test(read('src/components/branch/editing/RoomLinksPanel.tsx')), false);
});

test('the touched branch screens keep 44dp targets and the app dialog', () => {
  for (const file of [
    'src/components/branch/view/MapControls.tsx',
    'src/components/branch/view/FloorBoard.tsx',
    'src/components/branch/editing/RoomLinksPanel.tsx',
    'src/components/branch/editing/CandidatePicker.tsx',
  ]) {
    const text = read(file);
    assert.equal(/min-h-11\b|min-h-12\b|Alert\.alert/.test(text), false, file);
  }
});

test('audit 27/11: a room with only an ended contract opens that contract (like web)', () => {
  const ended = { id: 'old', status: 'CLOSED', startDate: null, endDateExclusive: null, tenantName: null };
  const room = (over) => ({ roomId: 'r', manualStatus: 'NONE', contracts: [], holds: [], listings: [], ...over });
  assert.deepEqual(a.primaryAction(room({ contracts: [ended] })), {
    kind: 'contract',
    id: 'old',
    label: 'Mở hợp đồng',
  });
});

test('audit 27/11: room-code wording is the web wording', () => {
  assert.equal(
    a.candidateCodeNote('101', 'B7'),
    'Mã trên tin: B7\nKhác mã ô 101. Vẫn gắn được, sau đó có thể đổi mã ô cho khớp.'
  );
  assert.equal(a.candidateCodeNote('101', '101'), 'Mã trên tin: 101 · trùng mã ô');
  assert.equal(a.candidateCodeNote('101', null), '');
  assert.equal(
    a.listingLinkOutcome({ contractId: null, contractNote: null }, '101', '102').success,
    'Đã gắn tin vào phòng 101. Mã trên tin (102) khác mã ô.'
  );
  assert.equal(a.codeMismatchText('102', '101'), 'Mã trên tin (102) khác mã ô (101). Sơ đồ là chuẩn.');
  assert.equal(a.codeTakenText('102'), 'Mã 102 đang dùng cho ô khác trên sơ đồ, nên chưa đổi mã ô được.');
});

test('audit 27/11: listing status labels are the listing management labels; unknown is Đang cập nhật', () => {
  assert.equal(a.listingStatusLabel('PUBLISHED'), 'Đang hiển thị');
  assert.equal(a.listingStatusLabel('DRAFT'), 'Tin nháp');
  assert.equal(a.listingStatusLabel('RENTED'), 'Đã cho thuê qua HomeSpace');
  assert.equal(a.listingStatusLabel('FUTURE'), 'Đang cập nhật');
  assert.equal(a.listingStatusLabel('toString'), 'Đang cập nhật');
});

test('audit 27/11: giving up on 4093 says what web says, and the link card names the last day', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/branch-layout-save.ts'), 'utf8');
  assert.ok(
    src.includes('Liên kết của phòng bị bỏ liên tục thay đổi nên chưa lưu được. Bản nháp vẫn còn, hãy thử lại sau.')
  );
  const panel = fs.readFileSync(path.join(ROOT, 'src/components/branch/editing/RoomLinksPanel.tsx'), 'utf8');
  assert.equal(panel.includes('đến trước'), false);
  assert.ok(panel.includes('đến hết'));
  assert.ok(panel.includes("operationalStatus === 'PUBLISHED'"));
});

test('audit 27/11: Q12 limits block saving (10 rows per floor, 100 slots per row, 1500 in total)', () => {
  const slots = (n, at) => Array.from({ length: n }, (_, i) => ({ key: `s${at}-${i}`, id: null, roomCode: `R${at}-${i}` }));
  const row = (n, at = 0) => ({ key: `r${at}`, id: null, label: `Dãy ${at}`, slots: slots(n, at) });
  const floor = (rows, at = 0) => ({ key: `f${at}`, id: null, label: `Tầng ${at}`, rows });
  const v = layoutLib.validateDraft;
  assert.deepEqual(v([floor(Array.from({ length: 10 }, (_, i) => row(1, i)))]), []);
  assert.deepEqual(v([floor([row(100)])]), []);
  assert.deepEqual(v([floor(Array.from({ length: 11 }, (_, i) => row(1, i)), 1)]), [
    'Tầng 1 có quá 10 dãy. Mỗi tầng tối đa 10 dãy.',
  ]);
  assert.deepEqual(v([floor([row(101)], 1)]), ['Tầng 1, Dãy 0 có quá 100 ô. Mỗi dãy tối đa 100 ô.']);
  const big = Array.from({ length: 16 }, (_, f) => floor([row(100, f)], f));
  assert.deepEqual(v(big), ['Sơ đồ có quá 1500 ô. Tối đa 1500 ô cho toàn sơ đồ.']);
});
