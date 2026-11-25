// Renter and landlord appointment management: components/appointment/manage/logic.ts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '../src');
const WEB = path.resolve(__dirname, '../../hs-web-app');

// Loads logic.ts with the real lib/appointment and services/appointmentApi over a fake client.
function loadLogic(client = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const source = ts.transpileModule(fs.readFileSync(path.join(SRC, `${relative}.ts`), 'utf8'), {
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
      setTimeout,
      clearTimeout,
      ...globals,
      require(name) {
        if (name === '@/lib/axios-client') return { __esModule: true, default: client };
        if (name.startsWith('date-fns')) return require(name);
        if (name.startsWith('@/')) return load(name.slice(2));
        assert.fail(`Unexpected dependency ${name} in ${relative}`);
      },
    });
    return module.exports;
  }
  return load('components/appointment/manage/logic');
}

const plain = (value) => JSON.parse(JSON.stringify(value));

/** Records calls; `reply(url, params)` gives each response body. */
function fakeClient(reply = () => ({ result: {} })) {
  const calls = [];
  const client = {
    get: async (url, config) => {
      calls.push(plain({ method: 'get', url, params: config?.params }));
      return { data: reply(url, config?.params) };
    },
    put: async (url, body) => {
      calls.push(plain({ method: 'put', url, body }));
      return { data: reply(url) };
    },
  };
  return { calls, client };
}

const BASE = '/api/v1/appointments';

test('list tabs send status, date, page and size 10 to the side of the role', async () => {
  for (const [role, side] of [
    ['OWNER', 'owner'],
    ['RENTER', 'my-bookings'],
  ]) {
    const { client, calls } = fakeClient(() => ({
      result: [{ id: 'a' }],
      totalElements: 25,
      totalPages: 3,
    }));
    const logic = loadLogic(client);
    const list = await logic.fetchAppointmentList(role, {
      tab: 'CANCELLED',
      date: '2026-11-26',
      page: 2,
    });
    assert.deepEqual(plain(list), { rows: [{ id: 'a' }], total: 25, totalPages: 3 });
    assert.equal(calls[0].url, `${BASE}/${side}`);
    assert.deepEqual(calls[0].params, {
      status: 'CANCELLED',
      date: '2026-11-26',
      page: 2,
      size: 10,
    });
  }
});

test('calendar tab loads every confirmed then completed page, with no date or paging', async () => {
  const { client, calls } = fakeClient((url, { status, page }) => ({
    result: [{ id: `${status}-${page}` }],
    totalPages: status === 'CONFIRMED' ? 2 : 1,
  }));
  const logic = loadLogic(client);
  const list = await logic.fetchAppointmentList('OWNER', {
    tab: 'CALENDAR',
    date: '2026-11-26',
    page: 3,
  });
  assert.deepEqual(plain(list.rows.map((row) => row.id)), [
    'CONFIRMED-1',
    'CONFIRMED-2',
    'COMPLETED-1',
  ]);
  assert.equal(list.total, 3);
  assert.equal(list.totalPages, 1);
  assert.ok(calls.every((call) => call.params.size === 50 && call.params.date === undefined));

  const broken = loadLogic({
    get: async (url, { params }) => {
      if (params.page === 2) throw new Error('offline');
      return { data: { result: [{ id: 'x' }], totalPages: 2 } };
    },
  });
  await assert.rejects(broken.fetchAppointmentList('RENTER', { tab: 'CALENDAR', page: 1 }));
});

test('row key ignores date and page on the calendar tab only', () => {
  const { queryKey } = loadLogic();
  assert.equal(queryKey({ tab: 'CALENDAR', date: '2026-11-26', page: 4 }), 'CALENDAR');
  assert.notEqual(queryKey({ tab: 'PENDING', page: 1 }), queryKey({ tab: 'PENDING', page: 2 }));
  assert.notEqual(
    queryKey({ tab: 'PENDING', page: 1 }),
    queryKey({ tab: 'PENDING', date: '2026-11-26', page: 1 })
  );
});

test('counts: owner asks the server; renter reuses the pending tab total or asks for one row', async () => {
  const { client, calls } = fakeClient((url) =>
    url.endsWith('/counts') ? { result: { PENDING: 2 } } : { totalElements: 7 }
  );
  const logic = loadLogic(client);
  assert.deepEqual(plain(await logic.fetchStatusCounts('OWNER', 'CALENDAR', 0)), { PENDING: 2 });
  assert.equal(calls[0].url, `${BASE}/owner/counts`);
  assert.deepEqual(plain(await logic.fetchStatusCounts('RENTER', 'PENDING', 4)), { PENDING: 4 });
  assert.equal(calls.length, 1);
  assert.deepEqual(plain(await logic.fetchStatusCounts('RENTER', 'CANCELLED', 4)), {
    PENDING: 7,
  });
  assert.deepEqual(calls[1].params, { status: 'PENDING', page: 1, size: 1 });
});

test('every action calls the endpoint of its role with trimmed input', async () => {
  const { client, calls } = fakeClient();
  const logic = loadLogic(client);
  const cases = [
    ['OWNER', 'approve', '  ', `${BASE}/i/approve`, {}],
    ['OWNER', 'approve', ' Gọi trước ', `${BASE}/i/approve`, { ownerNote: 'Gọi trước' }],
    ['OWNER', 'reject', ' kín ', `${BASE}/i/reject`, { rejectReason: 'kín' }],
    ['OWNER', 'cancel', ' bận ', `${BASE}/i/owner-cancel`, { cancelReason: 'bận' }],
    ['RENTER', 'cancel', ' ', `${BASE}/i/cancel`, { cancelReason: 'Khách hàng tự hủy lịch hẹn' }],
    ['RENTER', 'cancel', ' bận ', `${BASE}/i/cancel`, { cancelReason: 'bận' }],
    ['OWNER', 'complete', '', `${BASE}/i/complete`, undefined],
    ['OWNER', 'approve-reschedule', '', `${BASE}/i/reschedule/approve`, undefined],
    ['OWNER', 'reject-reschedule', ' no ', `${BASE}/i/reschedule/reject`, { rejectReason: 'no' }],
  ];
  for (const [role, action, input, url, body] of cases) {
    await logic.runAppointmentAction(role, action, 'i', input);
    assert.equal(calls.at(-1).url, url, `${role} ${action}`);
    assert.deepEqual(calls.at(-1).body, body, `${role} ${action}`);
  }
});

test('page copy and action messages exist verbatim in the web sources', () => {
  const logic = loadLogic();
  const web = [
    'app/dashboard/viewing-schedules/page.tsx',
    'app/dashboard/viewing-schedules/my-bookings/page.tsx',
    'components/appointment/useAppointmentDeepLink.ts',
  ]
    .map((file) => fs.readFileSync(path.join(WEB, file), 'utf8'))
    .join('\n')
    .replace(/\s+/g, ' ');
  const actions = [
    'approve',
    'reject',
    'cancel',
    'complete',
    'approve-reschedule',
    'reject-reschedule',
  ];
  const strings = [
    ...Object.values(logic.PAGE_COPY).flatMap((copy) => Object.values(copy)),
    ...actions.flatMap((action) =>
      ['OWNER', 'RENTER'].flatMap((role) =>
        role === 'RENTER' && action !== 'cancel'
          ? []
          : Object.values(logic.getActionMessages(role, action))
      )
    ),
  ];
  for (const text of strings) assert.ok(web.includes(text), text);
  assert.notEqual(
    logic.getActionMessages('OWNER', 'cancel').success,
    logic.getActionMessages('RENTER', 'cancel').success
  );
});

test('server message wins over the fallback', () => {
  const { serverMessage } = loadLogic();
  assert.equal(serverMessage({ response: { data: { message: 'Server' } } }, 'Web'), 'Server');
  assert.equal(serverMessage(new Error('Network Error'), 'Web'), 'Web');
  assert.equal(serverMessage(undefined, 'Web'), 'Web');
});

test('deep link opens only the viewer side, with web messages on failure', async () => {
  const appointment = { id: 'i', ownerId: 'owner', renterId: 'renter', status: 'CONFIRMED' };
  const logic = loadLogic(fakeClient(() => ({ result: appointment })).client);
  const owner = async () => 'owner';
  assert.deepEqual(plain(await logic.resolveDeepLink('i', 'OWNER', owner)), {
    appointment,
    tab: 'CALENDAR',
  });
  assert.equal(
    (await logic.resolveDeepLink('i', 'RENTER', owner)).message,
    'Lịch hẹn không thuộc phía tài khoản bạn đang xem.'
  );
  for (const [status, message] of [
    [403, 'Lịch hẹn không còn tồn tại hoặc bạn không có quyền xem.'],
    [404, 'Lịch hẹn không còn tồn tại hoặc bạn không có quyền xem.'],
    [500, 'Không thể mở lịch hẹn lúc này. Vui lòng thử lại.'],
  ]) {
    const failing = loadLogic({
      get: async () => {
        throw { response: { status } };
      },
    });
    assert.equal((await failing.resolveDeepLink('i', 'OWNER', owner)).message, message);
  }
  const expired = loadLogic(
    fakeClient(() => ({ result: { ...appointment, status: 'EXPIRED' } })).client
  );
  assert.equal((await expired.resolveDeepLink('i', 'OWNER', owner)).tab, null);
});

test('only appointment notifications and recovery events refresh the pages', () => {
  const { isAppointmentChangeEvent } = loadLogic();
  assert.equal(isAppointmentChangeEvent('connect'), true);
  assert.equal(isAppointmentChangeEvent('notifications:changed'), true);
  assert.equal(isAppointmentChangeEvent('notification:new', { category: 'APPOINTMENT' }), true);
  assert.equal(isAppointmentChangeEvent('notification:new', { category: 'PAYMENT' }), false);
  assert.equal(isAppointmentChangeEvent('notification:new', null), false);
  assert.equal(isAppointmentChangeEvent('notification:read', { category: 'APPOINTMENT' }), false);
});

test('live refresh is debounced, never overlaps, and runs once more for events during a run', async () => {
  const timers = [];
  const logic = loadLogic(
    {},
    {
      setTimeout: (fn, delay) => {
        const timer = { fn, delay, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer) => {
        if (timer) timer.cleared = true;
      },
    }
  );
  const live = () => timers.filter((timer) => !timer.cleared);
  const fire = () => {
    const timer = live().at(-1);
    timer.cleared = true;
    timer.fn();
  };
  let runs = 0;
  let finish;
  const runner = logic.createCoalescedRunner(() => {
    runs++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  runner.schedule();
  runner.schedule();
  assert.equal(live().length, 1);
  assert.equal(live()[0].delay, 250);
  fire();
  assert.equal(runs, 1);
  runner.schedule();
  runner.schedule();
  assert.equal(live().length, 0, 'nothing is queued while running');
  finish();
  await new Promise(setImmediate);
  assert.equal(live().length, 1, 'one trailing run');
  fire();
  assert.equal(runs, 2);
  finish();
  await new Promise(setImmediate);
  assert.equal(live().length, 0);
  runner.schedule();
  runner.dispose();
  assert.equal(live().length, 0);
  runner.schedule();
  assert.equal(live().length, 0, 'a disposed runner stays quiet');
});
