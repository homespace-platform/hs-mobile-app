const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports,
    Date,
    Number,
    URL,
    URLSearchParams,
    ...globals,
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === 'date-fns') return require('date-fns');
      if (name === 'expo-secure-store')
        return { getItemAsync: async () => null, setItemAsync: async () => {} };
      if (name === '@/services/userApi') return { getUserProfileApi: async () => ({ id: 'user' }) };
      if (name === '@/features/auth/session') return { getAccessToken: async () => 'token' };
      if (name === '@/lib/session-end') return { onSessionEnd: () => {} };
      if (name === '@/services/rental/cache')
        return { fileSessionGuard: () => () => {}, withFileLease: (_uris, run) => run() };
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return module.exports;
}
function mockApi(data = {}) {
  const calls = [];
  const client = Object.fromEntries(
    ['get', 'post', 'put', 'patch', 'delete'].map((method) => [
      method,
      async (...args) => {
        calls.push({ method, args });
        return { data };
      },
    ])
  );
  return { calls, client };
}

test('a delayed authenticated response or 401 cannot run in the next login session', async () => {
  const sessions = load('lib/session-end.ts');
  let prepare, accept, reject;
  let token = 'session-one';
  const replays = [];
  const client = (config) => {
    replays.push(config);
    return Promise.resolve(config);
  };
  client.interceptors = {
    request: {
      use: (handler) => {
        prepare = handler;
      },
    },
    response: {
      use: (ok, failed) => {
        accept = ok;
        reject = failed;
      },
    },
  };
  load('lib/axios-client.ts', {
    axios: { create: () => client, isCancel: () => false, CanceledError: Error },
    '@/config/env': {},
    '@/features/auth/session': { getAccessToken: async () => token },
    '@/lib/backend-health-signal': { requestBackendHealthCheck() {} },
    '@/lib/network-health-signal': { requestNetworkHealthCheck() {} },
    '@/lib/permissions': { isPermissionDenied: () => false },
    '@/lib/profile-gate': { isProfileIncomplete: () => false },
    '@/lib/profile-gate-signal': {},
    '@/lib/session-end': sessions,
  });
  const old = await prepare({ headers: {} });
  sessions.runSessionEndCleanups();
  token = 'session-two';
  assert.throws(() => accept({ config: old }), /Phiên đăng nhập đã kết thúc/);
  await assert.rejects(
    reject(Object.assign(new Error('401'), { config: old, response: { status: 401 } })),
    /401/
  );
  assert.deepEqual(replays, []);
  const current = await prepare({ headers: {} });
  assert.equal(current.headers.Authorization, 'Bearer session-two');
  await reject({ config: current, response: { status: 401 } });
  assert.equal(replays.length, 1);
});

test('management badges reuse fresh counts across tabs and reload for another account', async () => {
  let token = 'account-a';
  let userId = 'user-a';
  let profileCalls = 0;
  let attentionCalls = 0;
  const api = load('services/managementApi.ts', {
    '@/lib/axios-client': {
      async get() {
        attentionCalls++;
        return { data: { result: [], hasMore: false } };
      },
    },
    '@/features/auth/session': { getAccessToken: async () => token },
    '@/services/userApi': {
      getUserProfileApi: async () => {
        profileCalls++;
        return { id: userId };
      },
    },
  });
  await api.getManagementAttentionCounts();
  await api.getManagementAttentionCounts();
  assert.equal(profileCalls, 1);
  assert.equal(attentionCalls, 4);
  token = 'account-b';
  userId = 'user-b';
  await api.getManagementAttentionCounts();
  assert.equal(profileCalls, 2);
  assert.equal(attentionCalls, 8);
});

test('concurrent profile readers share one request and recent profile visits use cached data', async () => {
  let resolveProfile;
  let calls = 0;
  let token = 'account-a';
  const user = load('services/userApi.ts', {
    '@/features/auth/session': { getAccessToken: async () => token },
    '@/lib/axios-client': {
      get: () => {
        calls++;
        return new Promise((resolve) => {
          resolveProfile = resolve;
        });
      },
    },
  });
  const first = user.getUserProfileApi();
  const second = user.getUserProfileApi();
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  resolveProfile({ data: { result: { id: 'user' } } });
  assert.equal((await first).id, 'user');
  assert.equal((await second).id, 'user');
  assert.equal((await user.getUserProfileApi()).id, 'user');
  assert.equal(calls, 1);
  const third = user.getUserProfileApi(true);
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  resolveProfile({ data: { result: { id: 'user' } } });
  await third;
  token = 'account-b';
  const fourth = user.getUserProfileApi();
  await new Promise(setImmediate);
  assert.equal(calls, 3);
  resolveProfile({ data: { result: { id: 'other-user' } } });
  assert.equal((await fourth).id, 'other-user');
});

test('province search accepts names typed without Vietnamese accents', () => {
  const { matchesProvince } = load('lib/location-search.ts');
  assert.equal(matchesProvince('Thành phố Hồ Chí Minh', 'ho chi minh'), true);
  assert.equal(matchesProvince('Thành phố Đà Nẵng', 'DA NANG'), true);
  assert.equal(matchesProvince('Tỉnh Bình Dương', 'binh duong'), true);
  assert.equal(matchesProvince('Tỉnh An Giang', 'da nang'), false);
});

test('listing creation calls catalog and upsert endpoints', async () => {
  const { client, calls } = mockApi({ result: { id: 'listing-1' } });
  const api = load('services/listingCreateApi.ts', { '@/lib/axios-client': client });
  await api.getListingCatalog('room');
  await api.upsertListing({ submissionAction: 'SAVE_DRAFT' });
  assert.equal(calls[0].args[0], '/api/v1/public/listing-catalog');
  assert.equal(calls[0].args[1].params.category, 'ROOM');
  assert.equal(calls[1].args[0], '/api/v1/listings/upsert');
  assert.equal(calls[1].args[1].submissionAction, 'SAVE_DRAFT');
});

test('branch form preserves existing data and builds complete valid charges', () => {
  const { branchForm, buildBranchInput } = load('lib/branch-form.ts');
  const form = branchForm({
    id: 'branch/1',
    name: 'Dãy trọ A',
    code: 'CN-A',
    category: 'ROOM',
    refId: 'vm:123',
    display: '80 Dương Quảng Hàm',
    coverImageId: 'cover-1',
    motorbikeParkingCapacity: 5,
    carParkingCapacity: 0,
    buildingAmenityCodes: ['CAMERA'],
    defaultCharges: [
      { chargeType: 'ELECTRICITY', billingMethod: 'PER_KWH', amount: 4200 },
      {
        chargeType: 'OTHER',
        billingMethod: 'PER_MONTH',
        amount: 30000,
        customName: 'Vệ sinh riêng',
        unit: 'tháng',
      },
    ],
  });
  const payload = buildBranchInput(form);
  assert.equal(payload.refId, 'vm:123');
  assert.equal(payload.coverImageId, 'cover-1');
  assert.equal(
    payload.defaultCharges.find((charge) => charge.chargeType === 'ELECTRICITY').amount,
    4200
  );
  assert.equal(
    payload.defaultCharges.find((charge) => charge.chargeType === 'OTHER').customName,
    'Vệ sinh riêng'
  );
  // The server needs an explicit row per required type, even when the owner chose "not applicable".
  assert.equal(payload.defaultCharges.length, 8);
  const internet = payload.defaultCharges.find((charge) => charge.chargeType === 'INTERNET');
  assert.equal(internet.billingMethod, 'NOT_APPLICABLE');
  assert.equal(internet.amount, undefined);
  assert.equal(payload.buildingAmenityCodes[0], 'CAMERA');
  form.charges.MOTORBIKE_PARKING.method = 'PER_VEHICLE_MONTH';
  form.motorbikeCapacity = '0';
  assert.throws(() => buildBranchInput(form), /Sức chứa xe máy/);
});

test('branch management uses branch CRUD and Vietmap endpoints', async () => {
  const { client, calls } = mockApi({ result: [] });
  const api = load('services/branchApi.ts', { '@/lib/axios-client': client });
  await api.getBranches();
  await api.getBranch('a/b');
  await api.saveBranch({ name: 'A', category: 'ROOM', refId: 'vm:1', defaultCharges: [] });
  await api.saveBranch({ name: 'A', category: 'ROOM', refId: 'vm:1', defaultCharges: [] }, 'a/b');
  await api.deleteBranch('a/b');
  await api.searchBranchAddress('Dương Quảng Hàm');
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.args[0]}`),
    [
      'get /api/v1/branches',
      'get /api/v1/branches/a%2Fb',
      'post /api/v1/branches',
      'put /api/v1/branches/a%2Fb',
      'delete /api/v1/branches/a%2Fb',
      'get /api/v1/locations/autocomplete',
    ]
  );
  assert.equal(calls[5].args[1].params.text, 'Dương Quảng Hàm');
});

test('public search requires the current Vietmap city ID; favorites use server boolean', async () => {
  const { client, calls } = mockApi({ result: { isFavorite: false }, hasMore: false });
  const listing = load('services/listingApi.ts', { '@/lib/axios-client': client });
  await assert.rejects(listing.getPublicListingsPage({ page: 1 }));
  await listing.getPublicListingsPage({ cityId: '12', keyword: 'studio', page: 2 });
  assert.equal(calls[0].args[1].params.cityId, '12');
  const favorites = load('services/favoriteApi.ts', { '@/lib/axios-client': client });
  assert.equal(await favorites.toggleFavorite('id/1'), false);
  assert.equal(calls[1].args[0], '/api/v1/favorites/id%2F1/toggle');
});

test('saved listings use the same list, remove and clear endpoints as web', async () => {
  const { client, calls } = mockApi({ result: [] });
  const api = load('services/favoriteApi.ts', { '@/lib/axios-client': client });
  await api.getFavorites(1, 50);
  await api.getHistory(1, 40);
  await api.removeFavorite('id/1');
  await api.clearHistory();
  assert.deepEqual(
    calls.map((call) => [call.method, call.args[0]]),
    [
      ['get', '/api/v1/favorites'],
      ['get', '/api/v1/history'],
      ['delete', '/api/v1/favorites/id%2F1'],
      ['delete', '/api/v1/history'],
    ]
  );
  assert.deepEqual({ ...calls[0].args[1].params }, { page: 1, size: 50 });
  assert.deepEqual({ ...calls[1].args[1].params }, { page: 1, size: 40 });
});

test('saved listing filter, sort and paging match the web pages', () => {
  const saved = load('lib/saved-listings.ts');
  const row = (id, category, priceAmount, areaM2, title = id, fullAddress = '') => ({
    id,
    category,
    priceAmount,
    areaM2,
    title,
    fullAddress,
  });
  const rows = [
    row('a', 'HOUSE', 5, 30, 'Nhà Quận 1'),
    row('b', 'OFFICE', 3, 50, 'Văn phòng', 'Phường Bến Nghé'),
    row('c', 'APARTMENT', 9, 10),
  ];
  assert.deepEqual({ ...saved.categoryCounts(rows) }, { all: 3, HOUSE: 1, APARTMENT: 1, ROOM: 1 });
  const ids = (options) => saved.filterSavedListings(rows, options).map((item) => item.id);
  assert.deepEqual(ids({ sort: 'recent' }), ['a', 'b', 'c']);
  assert.deepEqual(ids({ sort: 'price_asc' }), ['b', 'a', 'c']);
  assert.deepEqual(ids({ sort: 'price_desc' }), ['c', 'a', 'b']);
  assert.deepEqual(ids({ sort: 'area_desc' }), ['b', 'a', 'c']);
  assert.deepEqual(ids({ category: 'ROOM', sort: 'recent' }), ['b']);
  assert.deepEqual(ids({ query: ' bến NGHÉ ', sort: 'recent' }), ['b']);
  assert.deepEqual({ ...saved.pageWindow(0, 1) }, { page: 1, totalPages: 1, start: 0, end: 0 });
  assert.deepEqual({ ...saved.pageWindow(17, 9) }, { page: 3, totalPages: 3, start: 16, end: 17 });
});

test('the reservation policy comes from the backend', async () => {
  const { client, calls } = mockApi({ result: { version: 'server-version', text: 'Policy' } });
  const api = load('services/bookingApi.ts', { '@/lib/axios-client': client });
  const policy = await api.getReservationPolicy();
  assert.equal(policy.version, 'server-version');
  assert.equal(calls[0].args[0], '/api/v1/rental-requests/reservation-policy');
});

test('proof uploads are private, bound to the payment, and are not completed if S3 fails', async () => {
  const calls = [];
  const client = {
    post: async (...args) => {
      calls.push(args);
      return {
        data: { result: { storageId: 'storage1', uploadUrl: 'https://s3.example/signed-upload' } },
      };
    },
  };
  const file = {
    uri: 'file:///proof.png',
    fileName: 'proof.png',
    contentType: 'image/png',
    sizeBytes: 42,
  };
  const metadata = {
    purpose: 'PAYMENT_PROOF',
    visibility: 'PRIVATE',
    referenceType: 'PAYMENT_REQUEST',
    referenceId: 'payment1',
  };
  const api = load(
    'services/storageApi.ts',
    { '@/lib/axios-client': client },
    { fetch: async (url) => (url.startsWith('file:') ? { blob: async () => ({}) } : { ok: false }) }
  );
  await assert.rejects(api.uploadFile(file, metadata), /kho lưu trữ/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].visibility, 'PRIVATE');
  assert.equal(calls[0][1].referenceId, 'payment1');
  await assert.rejects(api.uploadFile({ ...file, contentType: 'text/html' }, metadata));
  await assert.rejects(api.uploadFile({ ...file, sizeBytes: 16 * 1024 * 1024 }, metadata));
  assert.equal(calls.length, 1);
});

test('news search sends server filters and preserves pages beyond the first 12 articles', async () => {
  const { client, calls } = mockApi({ result: [], page: 2, hasMore: true, totalElements: 40 });
  const api = load('services/newsApi.ts', { '@/lib/axios-client': client });
  const result = await api.getPublicNews({ page: 2, category: 'LEGAL', keyword: 'hợp đồng' });
  assert.equal(calls[0].args[0], '/api/v1/public/news');
  assert.equal(calls[0].args[1].params.category, 'LEGAL');
  assert.equal(calls[0].args[1].params.keyword, 'hợp đồng');
  assert.equal(calls[0].args[1].params.page, 2);
  assert.equal(result.hasMore, true);
  assert.equal(result.totalElements, 40);
});

test('news overview and related articles keep their page sizes and views use the public endpoint', async () => {
  const { client, calls } = mockApi({ result: { views: 17 } });
  const api = load('services/newsApi.ts', { '@/lib/axios-client': client });
  await api.getPublicNews({ page: 1, size: 50 });
  await api.getPublicNews({ page: 1, size: 4, category: 'LEGAL' });
  assert.equal(calls[0].args[1].params.size, 50);
  assert.equal(calls[1].args[1].params.size, 4);
  assert.equal(calls[1].args[1].params.category, 'LEGAL');
  assert.equal((await api.recordNewsView('tin/1')).views, 17);
  assert.deepEqual(calls[2], { method: 'post', args: ['/api/v1/public/news/tin%2F1/view'] });
});

test('news content renders escaped spans, line breaks and nested formatting as native text', () => {
  const content = load('lib/news-content.ts');
  const value =
    '&lt;span style=&quot;font-weight: 700&quot;&gt;Thị trường <em>mới</em>&lt;/span&gt;<br>Giá &amp; thuê';
  assert.equal(content.newsPlainText(value), 'Thị trường mới\nGiá & thuê');
  const parts = content.newsTextParts(value);
  assert.equal(parts[0].style, 'font-bold');
  assert.equal(parts[1].style, 'font-bold italic');
  assert.equal(parts[parts.length - 1].style, '');
});

test('news pasted images only load HTTPS images from known publisher CDNs', () => {
  const { newsPlainText, readNewsInlineImage } = load('lib/news-content.ts');
  const input =
    '&lt;img src="https://cafefcdn.com/news.webp?w=640&amp;h=480" alt="Ảnh &quot;minh họa&quot;"&gt;';
  assert.equal(readNewsInlineImage(input)?.src, 'https://cafefcdn.com/news.webp?w=640&h=480');
  assert.equal(readNewsInlineImage(input)?.alt, 'Ảnh "minh họa"');
  assert.ok(readNewsInlineImage('<img src="https://vcnd1.vnecdn.net/news.webp">'));
  for (const src of [
    'http://cafefcdn.com/news.webp',
    'https://cafefcdn.com.evil.test/news.webp',
    'https://cafefcdn.com@evil.test/news.webp',
    'https://cafefcdn.com:8443/news.webp',
    'javascript:alert(1)',
  ]) {
    const image = `&lt;img src="${src}"&gt;`;
    assert.equal(readNewsInlineImage(image), null);
    assert.equal(newsPlainText(image), '');
  }
});

test('initial passwords omit old credentials and existing passwords use the update route', async () => {
  const { client, calls } = mockApi();
  const api = load('services/userApi.ts', { '@/lib/axios-client': client });
  await api.savePassword('NewPassword1!');
  await api.savePassword('NewPassword1!', 'OldPassword1!');
  assert.equal(calls[0].args[0], '/api/v1/users/me/password/initial');
  assert.equal('oldPassword' in calls[0].args[1], false);
  assert.equal(calls[1].args[0], '/api/v1/users/me/password');
  assert.equal(calls[1].args[1].oldPassword, 'OldPassword1!');
});

test('calendar starts Monday, includes leap day, and crosses month/year boundaries without date drift', () => {
  const api = load('lib/appointment-calendar.ts');
  const leap = api.calendarDays(new Date(2028, 1, 29), 'month');
  assert.equal(api.dateKey(leap[0]), '2028-01-31');
  assert.equal(api.dateKey(leap.at(-1)), '2028-03-05');
  assert.ok(leap.some((day) => api.dateKey(day) === '2028-02-29'));
  assert.equal(leap[0].getDay(), 1);
  assert.equal(leap.at(-1).getDay(), 0);
  assert.equal(leap.length % 7, 0);
  const week = api.calendarDays(new Date(2027, 0, 1), 'week');
  assert.equal(week.length, 7);
  assert.equal(api.dateKey(week[0]), '2026-12-28');
  assert.equal(api.dateKey(week[6]), '2027-01-03');
  assert.equal(api.dateKey(api.moveCalendar(new Date(2026, 0, 31), 'month', 1)), '2026-02-01');
  assert.equal(api.dateKey(api.moveCalendar(new Date(2026, 11, 30), 'week', 1)), '2027-01-06');
  assert.equal(api.dateKey(new Date(2026, 9, 31, 0, 5)), '2026-10-31');
});

test('emulator transport rewrites API/token loopback URLs only in Android development and keeps browser issuer URLs canonical', () => {
  const device = load('lib/device-url.ts');
  for (const [os, dev, host, expected] of [
    ['android', true, '10.0.2.2', '10.0.2.2'],
    ['android', false, '10.0.2.2', 'localhost'],
    ['ios', true, '10.0.2.2', 'localhost'],
    ['web', true, '10.0.2.2', 'localhost'],
    ['android', true, '', 'localhost'],
  ]) {
    const env = load(
      'config/env.ts',
      { 'react-native': { Platform: { OS: os } }, '@/lib/device-url': device },
      {
        __DEV__: dev,
        process: { env: { EXPO_PUBLIC_ANDROID_API_HOST: host } },
      }
    );
    const auth = load('lib/auth/discovery.ts', {
      '@/config/env': env,
      'expo-auth-session': { makeRedirectUri: () => 'homespace://oauth2redirect' },
    });
    assert.equal(env.gatewayBaseUrl, `http://${expected}:8080`);
    assert.ok(auth.discovery.tokenEndpoint.startsWith(`http://${expected}:9000/`));
    assert.ok(auth.discovery.revocationEndpoint.startsWith(`http://${expected}:9000/`));
    assert.ok(auth.discovery.authorizationEndpoint.startsWith('http://localhost:9000/'));
    assert.ok(auth.registrationEndpoint.startsWith('http://localhost:9000/'));
    assert.equal(env.keycloakConfig.baseUrl, 'http://localhost:9000');
  }
  assert.equal(
    device.deviceUrl('https://api.example.com/v1', '10.0.2.2'),
    'https://api.example.com/v1'
  );
  assert.equal(
    device.deviceUrl('http://127.0.0.1:8080/api', '10.0.2.2'),
    'http://10.0.2.2:8080/api'
  );
});

test('mobile auth never uses the password grant; credentials stay on the Keycloak page', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of [
    'features/auth/session.ts',
    'features/auth/AuthProvider.tsx',
    'screens/LoginScreen.tsx',
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
    assert.doesNotMatch(source, /grant_type['"]?\s*:\s*['"]password/, file);
    assert.doesNotMatch(source, /secureTextEntry/, file);
  }
});

test('viewing date selection blocks past dates and the owner closed weekdays', () => {
  const calendar = load('lib/appointment-calendar.ts');
  const booking = load('lib/booking.ts', { '@/lib/appointment-calendar': calendar });
  assert.equal(booking.canSelectViewingDay(new Date(2026, 9, 30), '2026-10-31'), false);
  assert.equal(
    booking.canSelectViewingDay(new Date(2026, 9, 31), '2026-10-31', ['SATURDAY']),
    true
  );
  assert.equal(booking.canSelectViewingDay(new Date(2026, 10, 1), '2026-10-31', ['MONDAY']), false);
  assert.equal(booking.canSelectViewingDay(new Date(2026, 10, 2), '2026-10-31', ['MONDAY']), true);
  assert.equal(booking.canSelectViewingDay(new Date(2026, 10, 2), '2026-10-31', []), false);
});

test('changing dates can cancel the previous availability request without changing the chosen API date', async () => {
  const { client, calls } = mockApi({ result: { slots: [] } });
  const api = load('services/appointmentApi.ts', { '@/lib/axios-client': client });
  const controller = new AbortController();
  await api.getAvailability('listing/1', '2026-11-02', controller.signal);
  assert.equal(calls[0].args[0], '/api/v1/appointments/availability/listing%2F1');
  assert.equal(calls[0].args[1].params.date, '2026-11-02');
  assert.equal(calls[0].args[1].signal, controller.signal);
  controller.abort();
  assert.equal(calls[0].args[1].signal.aborted, true);
});

test('avatar uploads reject files above the server limit of 5 MB', async () => {
  const { client, calls } = mockApi();
  const api = load('services/storageApi.ts', { '@/lib/axios-client': client });
  await assert.rejects(
    api.uploadFile(
      {
        uri: 'local',
        fileName: 'avatar.png',
        contentType: 'image/png',
        sizeBytes: 6 * 1024 * 1024,
      },
      { purpose: 'USER_AVATAR', visibility: 'PUBLIC', referenceType: 'USER', referenceId: 'u' }
    ),
    /5 MB/
  );
  assert.equal(calls.length, 0);
});

test('chat call token preserves the web Agora channel and signed string account', async () => {
  const callId = 'c76a3534-ccb4-4f8f-8eb2-959e5fe36254';
  const token = {
    appId: 'agora-app',
    channel: 'hs_c76a3534ccb44f8f8eb2959e5fe36254',
    token: 'signed-token',
    uid: 'user-id-string',
  };
  const { client, calls } = mockApi({ result: token });
  const api = load('services/chatCallApi.ts', { '@/lib/axios-client': client });
  assert.equal(await api.getChatCallToken('thread/id', callId), token);
  assert.equal(calls[0].method, 'post');
  assert.equal(calls[0].args[0], '/api/v1/chat/conversations/thread%2Fid/call-token');
  assert.equal(calls[0].args[1].callId, callId);

  for (const invalid of [
    { ...token, channel: 'other-room' },
    { ...token, uid: 123 },
    { ...token, token: '' },
  ]) {
    const { client: invalidClient } = mockApi({ result: invalid });
    const invalidApi = load('services/chatCallApi.ts', { '@/lib/axios-client': invalidClient });
    await assert.rejects(() => invalidApi.getChatCallToken('thread/id', callId), /không hợp lệ/);
  }
});

test('/membership/me is normalized and missing fields degrade safely', async () => {
  const { client, calls } = mockApi({ result: { tier: 'pro', remainingUses: 7, expiresAt: null } });
  const api = load('services/membershipApi.ts', { '@/lib/axios-client': client });
  const me = await api.getMyMembership();
  assert.equal(calls[0].args[0], '/api/v1/membership/me');
  assert.deepEqual(
    { ...me },
    {
      tier: 'PRO',
      remainingUses: 7,
      reservedUses: 0,
      expiresAt: null,
      unlimited: false,
    }
  );
});

test('membership checkout quotes, creates, checks and cancels through the authenticated API', async () => {
  const { client, calls } = mockApi({ result: {} });
  const api = load('services/membershipApi.ts', { '@/lib/axios-client': client });
  const id = 'abcd'.repeat(8);
  await api.getMembershipQuote('STARTER');
  await api.createMembershipCheckout('STARTER');
  await api.getMembershipOrder(id);
  await api.cancelMembershipOrder(id);
  assert.equal(calls[0].args[0], '/api/v1/membership/quote');
  assert.equal(calls[0].args[1].params.tier, 'STARTER');
  assert.equal(calls[1].args[0], '/api/v1/membership/checkout');
  assert.deepEqual({ ...calls[1].args[1] }, { tier: 'STARTER', provider: 'SEPAY' });
  assert.equal(calls[2].args[0], `/api/v1/membership/orders/${id}`);
  assert.equal(calls[3].args[0], `/api/v1/membership/orders/${id}/cancel`);
});

test('membership checkout submits only a matching signed SePay form', () => {
  const { buildSepayCheckout, isSepayPaymentPage, isMembershipQuote } = load(
    'lib/membership-checkout.ts',
    {}
  );
  const id = 'abcd'.repeat(8);
  const returnUrl = `https://homespace.example.com/dashboard/membership/return?orderId=${id}`;
  const checkout = {
    orderId: id,
    amountVnd: 49000,
    provider: 'SEPAY',
    paymentUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
    formFields: {
      signature: 'signed+/=',
      merchant: 'sandbox-merchant',
      order_amount: '49000',
      currency: 'VND',
      operation: 'PURCHASE',
      order_description: 'HomeSpace membership STARTER',
      order_invoice_number: id,
      success_url: `${returnUrl}&sepayReturn=success`,
      error_url: `${returnUrl}&sepayReturn=error`,
      cancel_url: `${returnUrl}&sepayReturn=cancel`,
    },
  };
  const quote = { tier: 'STARTER', amountVnd: 49000, remainingUsesAfter: 10 };
  assert.equal(isMembershipQuote(quote, 'STARTER'), true);
  assert.equal(isMembershipQuote({ ...quote, amountVnd: 0 }, 'STARTER'), false);
  assert.equal(isMembershipQuote(quote, 'PRO'), false);

  const hosted = buildSepayCheckout(checkout, 49000);
  const form = new URLSearchParams(hosted.source.body);
  assert.equal(hosted.source.method, 'POST');
  assert.equal(hosted.source.uri, checkout.paymentUrl);
  assert.equal(form.get('signature'), checkout.formFields.signature);
  assert.equal(form.get('success_url'), checkout.formFields.success_url);
  assert.deepEqual(
    [...form.keys()],
    [
      'order_amount',
      'merchant',
      'currency',
      'operation',
      'order_description',
      'order_invoice_number',
      'success_url',
      'error_url',
      'cancel_url',
      'signature',
    ]
  );
  assert.equal(isSepayPaymentPage(hosted.source.uri), true);
  assert.equal(isSepayPaymentPage(checkout.formFields.success_url), false);
  assert.equal(isSepayPaymentPage('https://pay-sandbox.sepay.vn.evil.example/'), false);
  assert.throws(() => buildSepayCheckout(checkout, 129000), /Số tiền đã thay đổi/);
  assert.throws(() => buildSepayCheckout({ ...checkout, provider: 'ETH' }, 49000), /SePay/);
  const live = 'https://pay.sepay.vn/v1/checkout/init';
  assert.equal(buildSepayCheckout({ ...checkout, paymentUrl: live }, 49000).source.uri, live);
  assert.throws(
    () =>
      buildSepayCheckout(
        { ...checkout, paymentUrl: 'https://pay.sepay.vn.evil.example/v1/checkout/init' },
        49000
      ),
    /SePay/
  );
  assert.throws(
    () =>
      buildSepayCheckout(
        {
          ...checkout,
          formFields: { ...checkout.formFields, order_amount: '129000' },
        },
        49000
      ),
    /biểu mẫu/
  );
  assert.throws(
    () =>
      buildSepayCheckout(
        {
          ...checkout,
          formFields: {
            ...checkout.formFields,
            success_url: returnUrl.replace(id, 'other') + '&sepayReturn=success',
          },
        },
        49000
      ),
    /trả kết quả/
  );
});

test('membership Sepolia uses the same signed quote and settlement endpoints as web', async () => {
  const { client, calls } = mockApi({ result: {} });
  const api = load('services/membershipApi.ts', { '@/lib/axios-client': client });
  const id = 'a'.repeat(32);
  const wallet = '0x' + '1'.repeat(40);
  const paymentId = '0x' + '2'.repeat(64);
  const hash = '0x' + '3'.repeat(64);
  await api.createMembershipCheckout('PRO', 'ETH');
  await api.getMembershipEthChallenge(id, wallet);
  await api.getMembershipEthQuote(id, 'challenge', 'signature');
  await api.settleMembershipEth(id, paymentId, hash);
  assert.equal(calls[0].args[1].provider, 'ETH');
  assert.equal(calls[1].args[0], `/api/v1/membership/orders/${id}/eth/challenge`);
  assert.equal(calls[1].args[1].params.wallet, wallet);
  assert.equal(calls[2].args[0], `/api/v1/membership/orders/${id}/eth/quote`);
  assert.deepEqual({ ...calls[2].args[1] }, { challengeId: 'challenge', signature: 'signature' });
  assert.equal(calls[3].args[0], `/api/v1/membership/orders/${id}/eth/settle`);
  assert.deepEqual({ ...calls[3].args[1] }, { paymentId, txHash: hash });
});

test('membership Sepolia signs exact contract calldata and guards against wrong chain, wallet or amount', () => {
  const eth = load('lib/membership-eth-payment.ts', {});
  const payer = '0x' + '1'.repeat(40);
  const recipient = '0x' + '2'.repeat(40);
  const contractAddress = '0x' + '3'.repeat(40);
  const paymentId = '0x' + 'a'.repeat(64);
  const quote = {
    payer,
    recipient,
    contractAddress,
    paymentId,
    chainId: 11155111,
    amountVnd: 49000,
    amountWei: '12345678900000000',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    signature: '0x' + 'b'.repeat(130),
  };
  const tx = eth.buildMembershipEthTransaction(quote, payer, 49000);
  assert.equal(tx.chainId, '0xaa36a7');
  assert.equal(tx.from, payer);
  assert.equal(tx.to, contractAddress);
  assert.equal(BigInt(tx.value), BigInt(quote.amountWei));
  assert.equal(tx.data.slice(0, 74), '0xfe908b7a' + paymentId.slice(2));
  assert.equal(tx.data.slice(74, 138), payer.slice(2).padStart(64, '0'));
  assert.equal(tx.data.slice(138, 202), recipient.slice(2).padStart(64, '0'));
  assert.equal(BigInt(`0x${tx.data.slice(202, 266)}`), BigInt(quote.amountWei));
  assert.equal(BigInt(`0x${tx.data.slice(330, 394)}`), 192n);
  assert.equal(BigInt(`0x${tx.data.slice(394, 458)}`), 65n);
  assert.equal(eth.formatSepoliaEth(quote.amountWei), '0.0123456789');
  assert.throws(
    () => eth.buildMembershipEthTransaction({ ...quote, chainId: 1 }, payer, 49000),
    /Sepolia/
  );
  assert.throws(() => eth.buildMembershipEthTransaction(quote, recipient, 49000), /Sepolia/);
  assert.throws(() => eth.buildMembershipEthTransaction(quote, payer, 129000), /Số tiền/);
  assert.throws(
    () => eth.buildMembershipEthTransaction({ ...quote, expiresAt: '2000-01-01' }, payer, 49000),
    /hết hạn/
  );
  assert.throws(
    () =>
      eth.buildMembershipEthTransaction(
        { ...quote, amountWei: (1n << 256n).toString() },
        payer,
        49000
      ),
    /giới hạn/
  );
  assert.throws(
    () =>
      eth.assertPayableEthOrder(
        { id: 'order', provider: 'ETH', status: 'PAID', amountVnd: 49000 },
        'order',
        49000
      ),
    /đã thay đổi/
  );
  assert.equal(eth.readEthSubmission(JSON.stringify({ paymentId })).paymentId, paymentId);
  assert.throws(
    () => eth.readEthSubmission(JSON.stringify({ paymentId, txHash: 'untrusted' })),
    /giao dịch/
  );
});

test('notification API uses the same endpoints and params as the web service', async () => {
  const { client, calls } = mockApi({
    result: { items: [{ id: 'n/1' }], nextCursor: 'c1', hasMore: true, count: 7 },
  });
  const api = load('services/notificationApi.ts', {
    '@/lib/axios-client': client,
    '@/lib/notification': load('lib/notification.ts'),
  });
  const page = await api.getNotificationFeed({
    limit: 500,
    cursor: ' c0 ',
    category: 'PAYMENT',
    unreadOnly: true,
  });
  assert.deepEqual(
    { ...calls[0].args[1].params },
    { limit: 50, cursor: 'c0', category: 'PAYMENT', unreadOnly: true }
  );
  assert.equal(calls[0].args[0], '/api/v1/notifications/feed');
  assert.equal(page.nextCursor, 'c1');
  assert.equal(await api.getUnreadNotificationCount(), 7);
  assert.equal(calls[1].args[0], '/api/v1/notifications/unread-count');
  await api.markNotificationRead('n/1');
  assert.deepEqual(
    { method: calls[2].method, url: calls[2].args[0] },
    { method: 'patch', url: '/api/v1/notifications/n%2F1/read' }
  );
  await api.markAllNotificationsRead();
  assert.deepEqual(
    { method: calls[3].method, url: calls[3].args[0] },
    { method: 'patch', url: '/api/v1/notifications/read-all' }
  );
  await api.getNotificationFeed({ category: 'ALL' });
  assert.equal('category' in calls[4].args[1].params, false);
});

test('notification preferences use the web endpoints and normalize to every category', async () => {
  const { client, calls } = mockApi({
    result: {
      items: [
        { category: 'PAYMENT', push: false },
        { category: 'BOGUS', push: false },
      ],
    },
  });
  const n = load('lib/notification.ts');
  const api = load('services/notificationSettingsApi.ts', {
    '@/lib/axios-client': client,
    '@/lib/notification': n,
  });
  const items = await api.getNotificationPreferences();
  assert.deepEqual(
    Array.from(items, (item) => item.category),
    [...n.NOTIFICATION_CATEGORIES]
  );
  assert.deepEqual(
    { ...items.find((item) => item.category === 'PAYMENT') },
    { category: 'PAYMENT', push: false, email: true }
  );
  assert.equal(items.find((item) => item.category === 'CHAT').push, true);
  assert.deepEqual(
    { method: calls[0].method, url: calls[0].args[0] },
    { method: 'get', url: '/api/v1/notifications/preferences' }
  );
  await api.patchNotificationPreference('CHAT', 'push', false);
  assert.equal(calls[1].method, 'patch');
  assert.equal(calls[1].args[0], '/api/v1/notifications/preferences');
  assert.deepEqual({ ...calls[1].args[1] }, { category: 'CHAT', channel: 'push', enabled: false });
  assert.equal(n.withDefaultPreferences(null).length, n.NOTIFICATION_CATEGORIES.length);
  assert.deepEqual(
    Array.from(n.withDefaultPreferences(null), (item) => item).filter((item) => !item.email).map((item) => item.category),
    ['SYSTEM']
  );
  for (const category of n.NOTIFICATION_CATEGORIES)
    assert.ok(n.NOTIFICATION_SETTINGS_META[category].title, category);
});

test('notification actionPath is validated and mapped only to existing mobile screens', () => {
  const n = load('lib/notification.ts');
  const id = '123e4567-e89b-12d3-a456-426614174000';
  for (const bad of [
    '//evil.example',
    '/\evil',
    'https://x.y',
    'javascript:alert(1)',
    '/a/../b',
    '/a b',
    'rel/path',
    '',
    null,
    '/operations/x',
  ])
    assert.equal(n.notificationTarget(bad).kind, 'none', String(bad));
  const target = (path) => ({ ...n.notificationTarget(path) });
  assert.deepEqual(target(`/rent/${id}`), { kind: 'listing', id, own: false });
  assert.deepEqual(target(`/dashboard/properties/view?id=${id}`), {
    kind: 'listing',
    id,
    own: true,
  });
  assert.equal(target('/rent/not-a-uuid').kind, 'none');
  assert.equal(target('/news/tin-moi').kind, 'news');
  assert.deepEqual(target('/dashboard/viewing-schedules?appointmentId=b1'), {
    kind: 'management',
    section: 'landlord-appointments',
    query: 'appointmentId=b1',
  });
  assert.deepEqual(target('/dashboard/viewing-schedules'), {
    kind: 'management',
    section: 'landlord-appointments',
  });
  assert.equal(
    target('/dashboard/viewing-schedules/my-bookings?appointmentId=b1').section,
    'tenant-appointments'
  );
  assert.equal(target('/dashboard/rental-requests?requestId=r1').section, 'landlord-requests');
  assert.equal(
    target('/dashboard/rental-requests/my-requests?requestId=r1').section,
    'tenant-requests'
  );
  assert.deepEqual(target('/dashboard/contracts/c1?tab=sign'), {
    kind: 'management-choice',
    tenant: 'tenant-contracts',
    landlord: 'landlord-contracts',
  });
  assert.equal(target('/dashboard/payments?paymentId=p1').tenant, 'tenant-payments');
  assert.equal(
    target('/dashboard/invoices/c1?section=monthly&invoice=i1').landlord,
    'landlord-payments'
  );
  for (const path of [
    '/dashboard/membership/other',
    '/settings/account-security',
    '/notifications',
    '/chat?conversationId=1',
    '/dashboard/contracts',
  ])
    assert.equal(target(path).kind, 'none', path);
  const membership = { kind: 'management', section: 'landlord-membership' };
  const orderId = 'ab'.repeat(16);
  assert.deepEqual(target('/dashboard/membership'), membership);
  assert.deepEqual(target(`/dashboard/membership/return?orderId=${orderId}`), {
    ...membership,
    orderId,
  });
  // A malformed order id opens the membership screen only.
  assert.deepEqual(target('/dashboard/membership/return?orderId=o'), membership);
});

test('notification badges, dates and chat exclusion follow the web rules', () => {
  const n = load('lib/notification.ts');
  const tag = (category, type, metadata = null) =>
    n.getNotificationTag({ category, type, metadata });
  assert.equal(tag('ACCOUNT', 'KYC_VERIFIED'), 'Đã xác minh');
  assert.equal(tag('ACCOUNT', 'KYC_REJECTED'), 'Cần xác minh lại');
  assert.equal(tag('PAYMENT', 'INVOICE_OVERDUE'), 'Quá hạn');
  assert.equal(tag('CONTRACT', 'LEASE_CLOSED'), 'Đã đóng hồ sơ quyết toán cọc');
  assert.equal(tag('LISTING', 'LISTING_STATUS_CHANGED', { status: 'HIDDEN' }), 'Đã ẩn');
  assert.equal(tag('LISTING', 'UNKNOWN'), 'Tin đăng');
  assert.equal(tag('PAYMENT', 'toString'), 'Thanh toán');
  assert.equal(n.formatNotificationDate('2026-11-03T09:05:00'), '03/11/2026 09:05');
  assert.equal(n.isNotificationUnread({ readAt: null }), true);
  assert.equal(n.isVisibleNotification({ category: 'CHAT' }), false);
  assert.equal(
    n.NOTIFICATION_FILTER_TABS.some((item) => item.id === 'CHAT'),
    false
  );
});

test('password change validation mirrors web schema', () => {
  const { validatePasswordChange: v } = load('lib/password.ts');
  assert.equal(v('', 'Abcdef1!', 'Abcdef1!'), 'Vui lòng nhập mật khẩu hiện tại');
  assert.equal(v('old', 'Ab1!', 'Ab1!'), 'Mật khẩu mới phải có ít nhất 8 ký tự');
  assert.equal(v('old', 'abcdefg1!', 'x'), 'Mật khẩu mới phải có ít nhất một chữ hoa');
  assert.equal(v('old', 'Abcdefgh!', 'x'), 'Mật khẩu mới phải có ít nhất một chữ số');
  assert.match(v('old', 'Abcdefg1', 'x'), /ký tự đặc biệt/);
  assert.equal(v('old', 'Abcdef1!', ''), 'Vui lòng xác nhận mật khẩu mới');
  assert.equal(v('old', 'Abcdef1!', 'Abcdef1?'), 'Mật khẩu xác nhận không trùng khớp');
  assert.equal(v('old', 'Abcdef1!', 'Abcdef1!'), null);
  assert.equal(v('', 'Abcdef1!', 'Abcdef1!', false), null);
});

test('profile form validation mirrors the web zod schema and detects real changes', () => {
  const p = load('lib/profile-form.ts');
  const base = {
    username: 'an.nguyen',
    email: 'an@example.com',
    firstName: 'An',
    lastName: 'Nguyen',
    phone: null,
    dob: null,
    gender: null,
  };
  assert.deepEqual({ ...p.validateProfileForm(base) }, {});
  assert.equal(p.validateProfileForm({ ...base, phone: '0353999798' }).phone, undefined);
  assert.ok(p.validateProfileForm({ ...base, phone: '123' }).phone);
  assert.equal(p.validateProfileForm({ ...base, phone: '  ' }).phone, undefined);
  assert.ok(p.validateProfileForm({ ...base, username: 'a b' }).username);
  assert.ok(p.validateProfileForm({ ...base, username: 'ab' }).username);
  assert.ok(p.validateProfileForm({ ...base, email: 'x@y' }).email);
  assert.ok(p.validateProfileForm({ ...base, firstName: ' A ' }).firstName);
  assert.ok(p.validateProfileForm({ ...base, lastName: 'N'.repeat(51) }).lastName);
  assert.equal(p.isProfileDirty({ ...base, firstName: ' An ' }, base), false);
  assert.equal(p.isProfileDirty({ ...base, phone: '0353999798' }, base), true);
  assert.equal(p.normalizeProfileForm({ ...base, phone: '  ' }).phone, null);
  assert.equal(p.profileFullName({ firstName: 'An', lastName: 'Nguyen' }), 'An Nguyen');
  assert.equal(p.profileFullName({ firstName: '', lastName: '', username: 'an' }), 'an');
  assert.equal(p.avatarFileError('image/gif', 10), 'Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.');
  assert.ok(p.avatarFileError('image/png', 21 * 1024 * 1024));
  assert.equal(p.avatarFileError('image/webp', 1024), null);
  assert.equal(p.avatarMimeType(null, 'a.PNG'), 'image/png');
  assert.equal(p.formatInstant(null), 'Chưa có dữ liệu');
  assert.equal(p.formatRole('ADMIN'), 'Quản trị viên');
  assert.ok(p.mapUrl(10.7, 106.6).includes('10.7%2C106.6'));
  assert.equal(p.mapUrl(91, 0), null);
  assert.equal(p.mapUrl(undefined, 0), null);
});

test('avatar history and address endpoints match the web services', async () => {
  const { client, calls } = mockApi({ result: [{ id: 'a1' }] });
  const storage = load('services/storageApi.ts', { '@/lib/axios-client': client });
  assert.equal((await storage.listUserAvatars('u1'))[0].id, 'a1');
  assert.equal(calls[0].args[0], '/api/v1/storage');
  assert.deepEqual(
    { ...calls[0].args[1].params },
    {
      referenceType: 'USER',
      referenceId: 'u1',
      purpose: 'USER_AVATAR',
      status: 'READY',
      page: 1,
      size: 20,
    }
  );
  const { client: userClient, calls: userCalls } = mockApi({ result: { refId: 'r1' } });
  const user = load('services/userApi.ts', {
    '@/features/auth/session': { getAccessToken: async () => 'token' },
    '@/lib/axios-client': userClient,
  });
  await user.getLocationPlace('r1');
  assert.equal(userCalls[0].args[0], '/api/v1/locations/place');
  assert.equal(userCalls[0].args[1].params.refId, 'r1');
  await user.saveUserAddress('r1', 'Tầng 3');
  assert.equal(userCalls[1].args[0], '/api/v1/users/me/address');
  assert.deepEqual({ ...userCalls[1].args[1] }, { refId: 'r1', addressNote: 'Tầng 3' });
});

test('profile join date is "tháng M năm YYYY" and share link follows web /u/{username}', () => {
  const { formatMonthYear, buildProfileLink } = load('lib/profile-format.ts');
  assert.equal(formatMonthYear('2026-11-15T10:00:00'), 'tháng 11 năm 2026');
  assert.equal(formatMonthYear(null), null);
  assert.equal(formatMonthYear('bad'), null);
  assert.equal(buildProfileLink('https://homespace.vn/', 'a b'), 'https://homespace.vn/u/a%20b');
  assert.equal(buildProfileLink('', 'a'), null);
  assert.equal(buildProfileLink(undefined, 'a'), null);
});
