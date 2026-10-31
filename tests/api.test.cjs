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
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
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
const payment = {
  id: 'payment/1',
  listingId: 'listing1',
  rentalRequestId: 'request1',
  payerId: 'tenant',
  payeeId: 'owner',
  direction: 'TENANT_TO_LANDLORD',
  status: 'TRANSFER_REPORTED',
  type: 'MONTHLY_RENT',
  totalAmount: 3000000,
  transferReference: 'HS123',
  payeeBankAccountSnapshot: { bankName: 'Bank', accountNumber: '123', accountHolderName: 'Owner' },
};
const appointment = {
  id: 'a/1',
  listingId: 'l1',
  listingTitle: 'Tin thật',
  listingAddress: 'Địa chỉ',
  status: 'PENDING',
  appointmentDate: '2026-11-03',
  startTime: '09:00',
  endTime: '10:00',
  renterName: 'Người xem',
  renterPhone: '0900000000',
  rescheduleRequested: false,
};

test('each management menu calls its real endpoint and preserves pagination', async () => {
  const paths = {
    'tenant-appointments': '/api/v1/appointments/my-bookings',
    'landlord-appointments': '/api/v1/appointments/owner',
    'tenant-requests': '/api/v1/rental-requests/my-requests',
    'landlord-requests': '/api/v1/rental-requests/owner',
    'tenant-contracts': '/api/v1/contracts',
    'landlord-contracts': '/api/v1/contracts',
    'landlord-properties': '/api/v1/listings/me',
    'landlord-branches': '/api/v1/branches',
  };
  for (const [section, endpoint] of Object.entries(paths)) {
    const { client, calls } = mockApi({ result: [], hasMore: true, totalElements: 30 });
    const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
    const result = await api.getManagementPage(section, 2, 'tenant');
    assert.equal(calls[0].args[0], endpoint);
    if (section.endsWith('branches')) {
      assert.equal(result.hasMore, false);
      continue;
    }
    assert.equal(calls[0].args[1].params.page, 2);
    assert.equal(result.hasMore, true);
    assert.equal(result.total, 30);
    if (section.endsWith('contracts'))
      assert.equal(
        calls[0].args[1].params.role,
        section.startsWith('tenant') ? 'TENANT' : 'LANDLORD'
      );
  }
});

test('rental request tabs count each status and fetch only the selected status', async () => {
  for (const [section, endpoint] of [
    ['tenant-requests', '/api/v1/rental-requests/my-requests'],
    ['landlord-requests', '/api/v1/rental-requests/owner'],
  ]) {
    const calls = [];
    const client = {
      async get(path, options) {
        calls.push({ path, params: options.params });
        return {
          data: {
            result: [],
            hasMore: false,
            totalElements: options.params.status === 'ACCEPTED' ? 2 : 0,
          },
        };
      },
    };
    const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
    const counts = await api.getRentalRequestCounts(section.startsWith('landlord-'));
    assert.equal(calls.length, api.RENTAL_REQUEST_STATUSES.length);
    assert.ok(calls.every((call) => call.path === endpoint && call.params.size === 1));
    assert.deepEqual(
      Array.from(counts, (item) => item.status),
      Array.from(api.RENTAL_REQUEST_STATUSES)
    );
    assert.equal(counts.find((item) => item.status === 'PENDING').count, 0);
    assert.equal(counts.find((item) => item.count > 0).status, 'ACCEPTED');
    await api.getManagementPage(section, 2, 'user', 'ALL', 'ACCEPTED');
    assert.deepEqual({ ...calls.at(-1).params }, { page: 2, size: 12, status: 'ACCEPTED' });
  }
});

test('payment menus distinguish rent and refunds by actor and direction', async () => {
  const refund = {
    ...payment,
    id: 'refund',
    direction: 'LANDLORD_TO_TENANT',
    payerId: 'owner',
    payeeId: 'tenant',
  };
  const other = { ...payment, id: 'unrelated', payerId: 'stranger', payeeId: 'stranger2' };
  for (const [section, actor] of [
    ['tenant-payments', 'tenant'],
    ['landlord-payments', 'owner'],
  ]) {
    const { client } = mockApi({ result: [payment, refund, other] });
    const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
    const page = await api.getManagementPage(section, 1, actor);
    assert.deepEqual(
      Array.from(page.items, (row) => row.id),
      ['payment/1', 'refund']
    );
  }
});

test('only payee may confirm a reported transfer, including tenant refunds', () => {
  const api = load('services/managementApi.ts', { '@/lib/axios-client': {} });
  const actions = (actor) =>
    Array.from(api.paymentEntry(payment, actor).actions, (row) => row.action);
  assert.ok(actions('owner').includes('confirm-receipt'));
  assert.ok(!actions('tenant').includes('confirm-receipt'));
  assert.equal(actions('stranger').length, 0);
  assert.equal(api.paymentEntry({ ...payment, status: 'CONFIRMED' }, 'owner').actions.length, 0);
});

test('appointment transitions require reasons and use the correct owner/renter paths', async () => {
  const { client, calls } = mockApi();
  const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
  const row = api.appointmentEntry(appointment, false);
  assert.deepEqual(
    Array.from(row.actions, (action) => action.action),
    ['cancel']
  );
  await assert.rejects(api.performManagementAction('tenant-appointments', row, 'cancel', ' '));
  await assert.rejects(api.performManagementAction('tenant-appointments', row, 'approve', ''));
  assert.equal(calls.length, 0);
  await api.performManagementAction('tenant-appointments', row, 'cancel', 'Đổi kế hoạch');
  assert.equal(calls[0].args[0], '/api/v1/appointments/a%2F1/cancel');
  await api.performManagementAction(
    'landlord-appointments',
    api.appointmentEntry(appointment, true),
    'cancel',
    'Bận'
  );
  assert.equal(calls[1].args[0], '/api/v1/appointments/a%2F1/owner-cancel');
  const pendingChange = api.appointmentEntry({ ...appointment, rescheduleRequested: true }, true);
  await api.performManagementAction(
    'landlord-appointments',
    pendingChange,
    'approve-reschedule',
    ''
  );
  assert.equal(calls[2].args[0], '/api/v1/appointments/a%2F1/reschedule/approve');
  assert.equal(
    api.appointmentEntry({ ...appointment, status: 'CANCELLED' }, true).actions.length,
    0
  );
});

test('accepted rental requests with reported or confirmed money cannot be canceled in UI', () => {
  const api = load('services/managementApi.ts', { '@/lib/axios-client': {} });
  for (const status of ['TRANSFER_REPORTED', 'CONFIRMED', 'DISPUTED']) {
    const row = api.rentalEntry(
      { ...appointment, status: 'ACCEPTED', initialPayment: { status } },
      false
    );
    assert.ok(!row.actions.some((action) => action.action === 'cancel'));
  }
});

test('report transfer requires proof and sends the displayed server amount', async () => {
  const { client, calls } = mockApi();
  const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
  await assert.rejects(api.reportPaymentTransfer(payment, '', 'ref'));
  assert.equal(calls.length, 0);
  await api.reportPaymentTransfer(payment, 'proof-id', ' BANK001 ');
  assert.equal(calls[0].method, 'post');
  assert.equal(calls[0].args[0], '/api/v1/payment-requests/payment%2F1/report-transfer');
  assert.equal(calls[0].args[1].proofStorageId, 'proof-id');
  assert.equal(calls[0].args[1].expectedAmount, 3000000);
  assert.equal(calls[0].args[1].bankTransactionReference, 'BANK001');
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

test('rental policy and authoritative cost estimate go through the backend', async () => {
  const { client, calls } = mockApi({ result: { version: 'server-version', text: 'Policy' } });
  const api = load('services/bookingApi.ts', { '@/lib/axios-client': client });
  const policy = await api.getReservationPolicy();
  assert.equal(policy.version, 'server-version');
  await api.estimateRental({
    listingId: 'l',
    moveInDate: '2026-11-01',
    leaseMonths: 12,
    occupantCount: 1,
    motorbikeCount: 0,
    carCount: 0,
  });
  assert.equal(calls[1].args[0], '/api/v1/rental-requests/estimate');
});

test('listing rental action reads the existing request and returns the newly created status', async () => {
  const { client, calls } = mockApi({ result: { id: 'request1', status: 'PENDING' } });
  const api = load('services/bookingApi.ts', { '@/lib/axios-client': client });
  assert.equal((await api.getMyRentalRequestByListing('listing/1')).status, 'PENDING');
  assert.equal(calls[0].args[0], '/api/v1/rental-requests/by-listing/listing%2F1');
  const created = await api.createRentalRequest({
    listingId: 'listing/1',
    moveInDate: '2026-11-01',
    leaseMonths: 12,
    occupantCount: 1,
    motorbikeCount: 0,
    carCount: 0,
    renterName: 'Người thuê',
    renterPhone: '0900000000',
    renterEmail: '',
    renterNote: '',
    reservationPolicyAccepted: true,
    reservationPolicyVersion: 'server-version',
  });
  assert.equal(created.status, 'PENDING');
  assert.equal(calls[1].args[0], '/api/v1/rental-requests');
  const absent = mockApi({ result: null });
  const emptyApi = load('services/bookingApi.ts', { '@/lib/axios-client': absent.client });
  assert.equal(await emptyApi.getMyRentalRequestByListing('listing/2'), null);
});

test('dates and numeric form validation reject invalid calendar and count values', () => {
  const validate = load('lib/form-validation.ts');
  assert.equal(validate.validDate('2026-02-31'), false);
  assert.equal(validate.validDate('2028-02-29'), true);
  assert.equal(validate.validDate('2026-2-3'), false);
  assert.equal(validate.positiveInteger('11', 10), false);
  assert.equal(validate.positiveInteger('1.5'), false);
  assert.equal(validate.nonnegativeInteger('-1'), false);
  assert.equal(validate.nonnegativeInteger('0'), true);
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

test('appointment calendar fetches every confirmed/completed page for both roles without duplicate events', async () => {
  for (const owner of [false, true]) {
    const calls = [];
    const client = {
      get: async (url, { params }) => {
        calls.push({ url, params });
        const rows =
          params.status === 'COMPLETED'
            ? [{ ...appointment, status: 'COMPLETED' }]
            : [
                {
                  ...appointment,
                  id: params.page === 1 ? appointment.id : 'second',
                  status: 'CONFIRMED',
                },
              ];
        return {
          data: { result: rows, hasMore: params.status === 'CONFIRMED' && params.page === 1 },
        };
      },
    };
    const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
    const result = await api.getAppointmentCalendar(owner);
    assert.equal(calls.length, 3);
    assert.ok(
      calls.every((call) => call.url === `/api/v1/appointments/${owner ? 'owner' : 'my-bookings'}`)
    );
    assert.equal(calls[1].params.page, 2);
    assert.equal(calls[2].params.page, 1);
    assert.equal(calls[2].params.status, 'COMPLETED');
    assert.equal(calls[0].params.size, 50);
    assert.equal(result.length, 2);
    assert.equal(result.find((row) => row.id === appointment.id).status, 'COMPLETED');
  }
});

test('unviewed appointments include all pending/confirmed pages and sort both groups together for each role', async () => {
  for (const section of ['tenant-appointments', 'landlord-appointments']) {
    const calls = [];
    const client = {
      get: async (url, { params }) => {
        calls.push({ url, params });
        const row = {
          ...appointment,
          id: `${params.status}-${params.page}`,
          status: params.status,
          appointmentDate:
            params.status === 'CONFIRMED'
              ? '2026-11-05'
              : params.page === 1
                ? '2026-11-03'
                : '2026-11-01',
        };
        return {
          data: { result: [row], hasMore: params.status === 'PENDING' && params.page === 1 },
        };
      },
    };
    const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
    const result = await api.getManagementPage(section, 1, 'user', 'UNVIEWED');
    assert.equal(calls.length, 3);
    assert.ok(
      calls.every((call) =>
        call.url.endsWith(section.startsWith('landlord') ? '/owner' : '/my-bookings')
      )
    );
    assert.equal(calls[1].params.page, 2);
    assert.equal(calls[2].params.status, 'CONFIRMED');
    assert.equal(result.total, 3);
    assert.equal(result.hasMore, false);
    assert.deepEqual(
      Array.from(result.items, (row) => row.id),
      ['CONFIRMED-1', 'PENDING-1', 'PENDING-2']
    );
    assert.ok(result.items.every((row) => ['PENDING', 'CONFIRMED'].includes(row.status)));
  }
});

test('completed appointments filter on the server with correct totals/pagination and all clears the filter', async () => {
  for (const section of ['tenant-appointments', 'landlord-appointments']) {
    const { client, calls } = mockApi({
      result: [{ ...appointment, status: 'COMPLETED' }],
      hasMore: true,
      totalElements: 40,
    });
    const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
    const result = await api.getManagementPage(section, 2, 'user', 'COMPLETED');
    assert.equal(calls[0].args[1].params.status, 'COMPLETED');
    assert.equal(calls[0].args[1].params.page, 2);
    assert.equal(result.total, 40);
    assert.equal(result.hasMore, true);
    await api.getManagementPage(section, 1, 'user', 'ALL');
    assert.equal(calls[1].args[1].params.status, undefined);
    assert.equal(calls[1].args[1].params.page, 1);
  }
});

test('calendar loading rejects partial data if a later page fails', async () => {
  const client = {
    get: async (url, { params }) => {
      if (params.page === 2) throw new Error('Connection lost');
      return { data: { result: [appointment], hasMore: true } };
    },
  };
  const api = load('services/managementApi.ts', { '@/lib/axios-client': client });
  await assert.rejects(api.getAppointmentCalendar(false), /Connection lost/);
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

test('password login distinguishes network/timeouts from invalid credentials and clears its timeout', async () => {
  for (const scenario of ['network', 'timeout', 'credentials', 'success']) {
    let timeoutCallback;
    let cleared = false;
    let request;
    const api = load(
      'features/auth/session.ts',
      {
        'expo-auth-session': {
          TokenResponse: class {
            constructor(value) {
              Object.assign(this, value);
            }
          },
        },
        'expo-secure-store': { setItemAsync: async () => {} },
        'expo-web-browser': {},
        '@/config/env': { keycloakConfig: { clientId: 'mobile' } },
        '@/lib/auth/discovery': {
          discovery: { tokenEndpoint: 'http://10.0.2.2:9000/token' },
          authScopes: ['openid'],
          redirectUri: 'homespace://oauth2redirect',
        },
      },
      {
        AbortController,
        setTimeout: (callback, delay) => {
          assert.equal(delay, 15000);
          timeoutCallback = callback;
          return 123;
        },
        clearTimeout: (id) => {
          assert.equal(id, 123);
          cleared = true;
        },
        fetch: async (url, options) => {
          request = { url, options };
          if (scenario === 'timeout') timeoutCallback();
          if (scenario === 'network' || scenario === 'timeout')
            throw new TypeError('Network request failed');
          return {
            ok: scenario === 'success',
            json: async () =>
              scenario === 'success'
                ? { access_token: 'test-token', refresh_token: 'test-refresh' }
                : { error_description: 'Invalid user credentials' },
          };
        },
      }
    );
    const promise = api.loginWithPassword('test-user', 'test-password');
    if (scenario === 'success') {
      await promise;
      assert.equal(api.isSignedIn(), true);
    } else {
      await assert.rejects(
        promise,
        scenario === 'network'
          ? /Không kết nối/
          : scenario === 'timeout'
            ? /phản hồi quá lâu/
            : /Invalid user credentials/
      );
      assert.equal(api.isSignedIn(), false);
    }
    assert.equal(cleared, true);
    assert.equal(request.url, 'http://10.0.2.2:9000/token');
    assert.ok(request.options.signal);
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
  assert.equal(booking.viewingPeriod('08:00:00'), 'MORNING');
  assert.equal(booking.viewingPeriod('13:00:00'), 'AFTERNOON');
  assert.equal(booking.viewingPeriod('18:00:00'), 'EVENING');
});

test('booking only accepts a slot still available in the selected day and permits rescheduling an existing booking', () => {
  const booking = load('lib/booking.ts', {
    '@/lib/appointment-calendar': load('lib/appointment-calendar.ts'),
  });
  const slot = { startTime: '09:00:00', endTime: '10:00:00', status: 'AVAILABLE' };
  const data = { isDayAvailable: true, hasExistingActiveBooking: false, slots: [slot] };
  assert.equal(booking.canBookSlot(data, slot, false), true);
  assert.equal(booking.canBookSlot(null, slot, false), false);
  assert.equal(booking.canBookSlot({ ...data, isDayAvailable: false }, slot, false), false);
  assert.equal(booking.canBookSlot({ ...data, slots: [] }, slot, false), false);
  assert.equal(
    booking.canBookSlot({ ...data, slots: [{ ...slot, status: 'UNAVAILABLE' }] }, slot, false),
    false
  );
  assert.equal(
    booking.canBookSlot({ ...data, hasExistingActiveBooking: true }, slot, false),
    false
  );
  assert.equal(booking.canBookSlot({ ...data, hasExistingActiveBooking: true }, slot, true), true);
});

test('changing dates can cancel the previous availability request without changing the chosen API date', async () => {
  const { client, calls } = mockApi({ result: { slots: [] } });
  const api = load('services/bookingApi.ts', { '@/lib/axios-client': client });
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
