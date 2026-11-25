const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Parity checks: where a web module can be loaded outside Next, run it beside the mobile port.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const SRC = path.resolve(__dirname, '../src');

function loader(root, stubs = {}) {
  const cache = new Map();
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
    vm.runInNewContext(source, {
      exports: module.exports,
      Date,
      Intl,
      URLSearchParams,
      require(name) {
        if (name in stubs) return stubs[name];
        if (name.startsWith('date-fns')) return require(name);
        if (name.startsWith('@/')) return load(name.slice(2));
        if (name.startsWith('.'))
          return load(path.posix.join(path.posix.dirname(relative), name.replace(/\.ts$/, '')));
        assert.fail(`Unexpected dependency ${name} in ${relative}`);
      },
    });
    return module.exports;
  }
  return load;
}

const mobile = loader(SRC);
const lib = mobile('lib/appointment');
const web = (file, stubs) => loader(WEB, stubs)(file);
const webSource = (...files) =>
  files.map((file) => fs.readFileSync(path.join(WEB, file), 'utf8')).join('\n');
const plain = (value) => JSON.parse(JSON.stringify(value));
const key = (date) => lib.toDateKey(date);

const slot = (extra = {}) => ({
  startTime: '09:00:00',
  endTime: '10:00:00',
  slotType: 'MORNING',
  status: 'AVAILABLE',
  ...extra,
});

test('appointmentApi sends exactly what the web service sends, for every function', async () => {
  const record = () => {
    const calls = [];
    const client = {};
    for (const method of ['get', 'post', 'put'])
      client[method] = async (...args) => {
        while (args.length && args.at(-1) === undefined) args.pop();
        calls.push(plain([method, ...args]));
        return { data: { result: undefined, marker: 1 } };
      };
    return { calls, stubs: { '@/lib/axios-client': { __esModule: true, default: client } } };
  };
  const a = record();
  const b = record();
  const webApi = web('services/appointment.service', a.stubs).default;
  const mobileApi = loader(SRC, b.stubs)('services/appointmentApi');
  const cases = [
    ['getAppointment', 'id1'],
    ['getAvailability', 'l1'],
    ['getAvailability', 'l1', '2026-11-26'],
    ['createAppointment', { listingId: 'l1' }],
    ['getMyBookings'],
    ['getMyBookings', { status: 'ALL', date: '', page: 2, size: 50 }],
    ['getMyBookingByListing', 'l1'],
    ['requestReschedule', 'id1', { proposedDate: '2026-11-26' }],
    ['cancelByRenter', 'id1'],
    ['cancelByRenter', 'id1', ''],
    ['cancelByRenter', 'id1', 'Bận'],
    ['getOwnerAppointments'],
    ['getOwnerAppointments', { listingId: 'l1', status: 'PENDING', date: '2026-11-26' }],
    ['getOwnerAppointmentCounts'],
    ['approveAppointment', 'id1'],
    ['approveAppointment', 'id1', 'Gọi trước'],
    ['rejectAppointment', 'id1', 'lý do'],
    ['approveReschedule', 'id1'],
    ['rejectReschedule', 'id1', 'lý do'],
    ['cancelByOwner', 'id1', 'lý do'],
    ['completeAppointment', 'id1'],
  ];
  assert.deepEqual(
    [...new Set(cases.map(([name]) => name))].sort(),
    Object.keys(webApi).sort(),
    'every web service function is covered'
  );
  for (const [name, ...args] of cases) {
    const expected = await webApi[name](...args);
    const actual = await mobileApi[name](...args);
    assert.deepEqual(b.calls.at(-1), a.calls.at(-1), name);
    assert.deepEqual(plain(actual ?? null), plain(expected ?? null), `${name} result`);
  }
});

test('only getMyBookingByListing swallows errors', async () => {
  const fail = async () => {
    throw new Error('offline');
  };
  const api = loader(SRC, {
    '@/lib/axios-client': { __esModule: true, default: { get: fail, post: fail, put: fail } },
  })('services/appointmentApi');
  assert.equal(await api.getMyBookingByListing('l1'), null);
  await assert.rejects(api.getOwnerAppointmentCounts(), /offline/);
  await assert.rejects(api.cancelByRenter('id1'), /offline/);
});

test('calendar grid matches web for both views across a leap year', () => {
  const webCalendar = web('lib/appointment-calendar');
  for (let day = 0; day < 366; day += 5) {
    const anchor = new Date(2028, 0, 1 + day);
    for (const view of ['month', 'week'])
      assert.deepEqual(
        Array.from(lib.getAppointmentCalendarDays(anchor, view), key),
        Array.from(webCalendar.getAppointmentCalendarDays(anchor, view), key)
      );
  }
  assert.equal(lib.getCalendarTitle(new Date(2026, 9, 15), 'month'), 'Tháng 10/2026');
  assert.equal(lib.getCalendarTitle(new Date(2026, 11, 31), 'week'), '28/12 – 03/01/2027');
  assert.equal(key(lib.shiftCalendar(new Date(2026, 0, 31), 'month', 1)), '2026-02-28');
});

test('deep link parsing and tab mapping match the web hook', () => {
  const hook = web('components/appointment/useAppointmentDeepLink', {
    react: {},
    'next/navigation': {},
    sonner: {},
    '@/services/appointment.service': {},
  });
  const id = '0F8FAD5B-D9CB-469F-A165-70867728950E';
  const searches = [
    `appointmentId=${id}`,
    `?appointmentId=${id}&status=EXPIRED`,
    `status=NOPE&appointmentId=${id}`,
    `appointmentId=${id}&appointmentId=bad`,
    'appointmentId=bad',
    'appointmentId=%E0%A4%A',
    'status=PENDING',
    '',
  ];
  for (const search of searches)
    assert.deepEqual(plain(lib.parseDeepLink(search)), plain(hook.parseDeepLink(search)), search);
  for (const status of [
    'PENDING',
    'CONFIRMED',
    'REJECTED',
    'CANCELLED',
    'COMPLETED',
    'EXPIRED',
    'X',
  ])
    assert.equal(lib.tabForStatus(status), hook.tabForStatus(status), status);
});

test('feature gate matches web getGateLock', () => {
  const webGate = web('lib/profile-gate');
  const gate = mobile('lib/permissions');
  for (const code of Object.values(gate.PERMISSIONS))
    for (const allowed of [true, false])
      for (const profile of [
        { ready: true, missing: [] },
        { ready: false, missing: ['KYC', 'BANK_ACCOUNT'] },
      ])
        assert.equal(
          gate.getGateLock(code, allowed, profile),
          webGate.getGateLock(code, allowed, profile)
        );
  assert.deepEqual(plain(gate.PERMISSIONS), plain(web('lib/permissions').PERMISSIONS));
});

test('every ported label and message exists verbatim in the web sources', () => {
  const source = webSource(
    'components/appointment/BookingAppointmentModal.tsx',
    'components/appointment/AppointmentDetailModal.tsx',
    'components/appointment/AppointmentCardCompact.tsx',
    'components/appointment/AppointmentDateFilter.tsx',
    'components/appointment/AppointmentCalendar.tsx',
    'app/dashboard/viewing-schedules/page.tsx'
  );
  const labels = [
    ...Object.values(lib.APPOINTMENT_STATUS_META).map((meta) => meta.label),
    ...Object.values(lib.CANCELLED_BY_LABELS),
    ...Object.values(lib.SLOT_TYPE_LABELS),
    ...Object.values(lib.DAY_OF_WEEK_LABELS),
    ...lib.SLOT_PERIODS.map((period) => period.label),
    ...lib.STATUS_TABS.map((tab) => tab.label),
    ...lib.CALENDAR_WEEKDAY_LABELS,
    ...Object.values(lib.OWNER_ACTION_DIALOGS).flatMap((copy) =>
      Object.values(copy).filter(Boolean)
    ),
    ...['OWNER', 'RENTER'].flatMap((role) =>
      lib
        .getAppointmentActions({ status: 'PENDING', rescheduleRequested: role === 'OWNER' }, role)
        .concat(
          lib.getAppointmentActions({ status: 'CONFIRMED', rescheduleRequested: false }, role)
        )
        .map((action) => action.label)
    ),
    lib.validateBookingForm({ slot: null, renterName: '', renterPhone: '' }),
    lib.validateBookingForm({ slot: slot(), renterName: ' ', renterPhone: '' }),
    lib.validateBookingForm({ slot: slot(), renterName: 'A', renterPhone: ' ' }),
    lib.validateRescheduleForm(null),
  ];
  for (const label of labels) assert.ok(source.includes(label), `Not in web: ${label}`);
});

test('actions per status and role follow the web detail modal', () => {
  const names = (status, rescheduleRequested, role) =>
    Array.from(
      lib.getAppointmentActions({ status, rescheduleRequested }, role),
      (item) => item.action
    );
  const table = {
    PENDING: { OWNER: ['reject', 'approve'], RENTER: ['cancel', 'request-reschedule'] },
    CONFIRMED: { OWNER: ['cancel', 'complete'], RENTER: ['cancel', 'request-reschedule'] },
    REJECTED: { OWNER: [], RENTER: [] },
    CANCELLED: { OWNER: [], RENTER: [] },
    COMPLETED: { OWNER: [], RENTER: [] },
    EXPIRED: { OWNER: [], RENTER: [] },
  };
  for (const [status, roles] of Object.entries(table))
    for (const [role, expected] of Object.entries(roles))
      assert.deepEqual(names(status, false, role), expected, `${role} ${status}`);
  assert.deepEqual(names('PENDING', true, 'OWNER'), [
    'approve-reschedule',
    'reject-reschedule',
    'reject',
    'approve',
  ]);
  assert.deepEqual(names('CONFIRMED', true, 'RENTER'), ['cancel']);
  const gates = (role) =>
    Object.fromEntries(
      lib
        .getAppointmentActions({ status: 'PENDING', rescheduleRequested: false }, role)
        .map((item) => [item.action, item.permission])
    );
  assert.deepEqual(gates('RENTER'), { cancel: null, 'request-reschedule': 'APPOINTMENT_BOOK' });
  assert.deepEqual(gates('OWNER'), { reject: 'APPOINTMENT_MANAGE', approve: 'APPOINTMENT_MANAGE' });
  assert.equal(lib.canQuickApprove({ status: 'PENDING' }, 'OWNER'), true);
  assert.equal(lib.canQuickApprove({ status: 'PENDING' }, 'RENTER'), false);
  assert.equal(lib.canQuickApprove({ status: 'CONFIRMED' }, 'OWNER'), false);
  assert.equal(lib.validateOwnerDialog('approve', ''), null);
  for (const type of ['reject', 'cancel', 'reject-reschedule']) {
    assert.ok(lib.validateOwnerDialog(type, '  '));
    assert.equal(lib.validateOwnerDialog(type, 'x'), null);
  }
});

test('booking validation, request bodies and default contact name', () => {
  const form = { slot: slot(), renterName: 'A', renterPhone: 'abc' };
  assert.equal(lib.validateBookingForm(form), null, 'web does not validate the phone format');
  const request = lib.toCreateRequest({
    ...form,
    listingId: 'l1',
    date: new Date(2026, 10, 26, 0, 5),
    renterName: ' A ',
    visitorCount: 2,
    renterNote: '   ',
  });
  assert.equal(request.appointmentDate, '2026-11-26');
  assert.equal(request.renterName, 'A');
  assert.equal(request.renterNote, undefined);
  assert.equal(
    lib.toRescheduleRequest({ date: new Date(2026, 10, 26), slot: slot(), reason: ' ' })
      .rescheduleReason,
    undefined
  );
  assert.deepEqual([0, 5, 11].map(lib.clampVisitors), [1, 5, 10]);
  assert.equal(
    lib.getRenterDefaultName({ firstName: 'An', lastName: 'Lê', username: 'u' }),
    'Lê An'
  );
  assert.equal(lib.getRenterDefaultName({ username: 'u' }), 'u');
});

test('slot captions, grouping and viewing-day rules', () => {
  assert.deepEqual(plain(lib.getSlotView(slot())), {
    label: 'Còn trống',
    tone: 'success',
    disabled: false,
  });
  assert.equal(lib.getSlotView(slot({ bookingCount: 2 })).label, '2 lượt đặt xem');
  assert.equal(lib.getSlotView(slot({ bookingCount: 2 })).disabled, false);
  for (const status of ['UNAVAILABLE', 'PENDING_YOU', 'CONFIRMED_YOU'])
    assert.equal(lib.getSlotView(slot({ status })).disabled, true, status);
  assert.deepEqual(
    Array.from(lib.groupSlots([slot({ slotType: 'EVENING' }), slot()]), (period) => period.key),
    ['MORNING', 'EVENING']
  );
  const wednesday = new Date(2026, 10, 25, 15, 0);
  assert.equal(lib.isViewingDayDisabled(new Date(2026, 10, 24), [], wednesday), true);
  assert.equal(lib.isViewingDayDisabled(new Date(2026, 10, 25), undefined, wednesday), false);
  assert.equal(lib.isViewingDayDisabled(new Date(2026, 10, 26), ['MONDAY'], wednesday), true);
  assert.equal(lib.isViewingDayDisabled(new Date(2026, 10, 30), ['MONDAY'], wednesday), false);
  assert.equal(lib.nextAllowedViewingDate(wednesday, [], wednesday), null);
  assert.equal(lib.nextAllowedViewingDate(wednesday, ['WEDNESDAY'], wednesday), null);
  assert.equal(key(lib.nextAllowedViewingDate(wednesday, ['MONDAY'], wednesday)), '2026-11-30');
  assert.equal(lib.formatAllowedDays([]), 'Tất cả các ngày');
  assert.equal(lib.formatAllowedDays(['MONDAY', 'SUNDAY']), 'Thứ 2, Chủ nhật');
});

test('date labels, filter chips and grouping', () => {
  assert.equal(lib.formatDateLabel('2026-11-25'), 'Thứ Tư, 25/11/2026');
  assert.equal(lib.formatDateLabel('oops'), 'oops');
  assert.equal(lib.formatDateLabel(null), '');
  assert.equal(lib.formatTimeRange('09:00:00', '10:00:00'), '09:00 – 10:00');
  const now = new Date(2026, 10, 25, 23, 30);
  const today = lib.getDateFilterState('2026-11-25', now);
  assert.equal(today.summary, 'Hôm nay (Thứ Tư, 25/11/2026)');
  assert.equal(today.customButtonLabel, 'Chọn ngày khác');
  assert.equal(lib.getDateFilterState('2026-11-26', now).isTomorrow, true);
  const custom = lib.getDateFilterState('2026-11-29', now);
  assert.equal(custom.customButtonLabel, 'Chủ Nhật, 29/11/2026');
  assert.equal(lib.getDateFilterState(undefined, now).isAll, true);
  assert.equal(lib.getDateFilterState(undefined, now).summary, '');
  const grouped = lib.groupAppointmentsByDate([
    { appointmentDate: 'd', startTime: '14:00' },
    { appointmentDate: 'd', startTime: '08:00' },
  ]);
  assert.deepEqual(
    Array.from(grouped.get('d'), (item) => item.startTime),
    ['08:00', '14:00']
  );
});

test('calendar tab loads every confirmed then completed page, and rejects partial data', async () => {
  const calls = [];
  const result = await lib.loadCalendarAppointments(async (params) => {
    calls.push(`${params.status}:${params.page}:${params.size}`);
    return {
      result: [{ id: calls.length }],
      totalPages: params.status === 'CONFIRMED' ? 2 : 0,
    };
  });
  assert.deepEqual(calls, ['CONFIRMED:1:50', 'CONFIRMED:2:50', 'COMPLETED:1:50']);
  assert.equal(result.length, 3);
  await assert.rejects(
    lib.loadCalendarAppointments(async ({ page }) => {
      if (page === 2) throw new Error('lost');
      return { result: [], totalPages: 2 };
    }),
    /lost/
  );
});
