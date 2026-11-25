/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Logic of the booking modal (components/appointment/booking/booking-flow.ts) with a fake API.
const SRC = path.resolve(__dirname, '../src');
const WEB = path.resolve(__dirname, '../../hs-web-app');

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
    AbortController,
    Error,
    require(name) {
      if (name === 'axios' || name.startsWith('date-fns')) return require(name);
      if (name.startsWith('@/')) return load(name.slice(2));
      assert.fail(`Unexpected dependency ${name} in ${relative}`);
    },
  });
  return module.exports;
}

const { createBookingFlow, checkKyc } = load('components/appointment/booking/booking-flow');
const plain = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const NOW = new Date(2026, 10, 25, 9); // Wednesday
const day = (date) => new Date(2026, 10, date);

const SLOT = {
  startTime: '09:00:00',
  endTime: '10:00:00',
  slotType: 'MORNING',
  status: 'AVAILABLE',
};
const BOOKING = { id: 'b1', status: 'PENDING' };
const available = (date, extra = {}) => ({
  date,
  isDayAvailable: true,
  allowedViewingDays: [],
  slots: [SLOT],
  ...extra,
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
};

function setup(overrides = {}, profile = { lastName: 'Nguyễn', firstName: 'An', phone: '0900' }) {
  const calls = [];
  const handlers = {
    getMyBookingByListing: async () => null,
    getAvailability: async (_id, date) => available(date),
    createAppointment: async () => ({}),
    requestReschedule: async () => ({}),
    cancelByRenter: async () => ({}),
    ...overrides,
  };
  const api = Object.fromEntries(
    Object.entries(handlers).map(([name, handler]) => [
      name,
      (...args) => {
        calls.push([name, ...args]);
        return handler(...args);
      },
    ])
  );
  const flow = createBookingFlow('l1', { api, getProfile: async () => profile, now: () => NOW });
  const named = (name) => calls.filter((call) => call[0] === name);
  return { flow, calls, named };
}

async function opened(overrides, profile) {
  const context = setup(overrides, profile);
  context.flow.open();
  await tick();
  return context;
}

test('open looks up the booking, then availability for today, and prefills the contact', async () => {
  const { flow, calls } = await opened();
  assert.deepEqual(
    calls.map((call) => call.slice(0, 3)),
    [
      ['getMyBookingByListing', 'l1'],
      ['getAvailability', 'l1', '2026-11-25'],
    ]
  );
  assert.equal(flow.get().loading, false);
  assert.equal(flow.get().renterName, 'Nguyễn An');
  assert.equal(flow.get().renterPhone, '0900');
});

test('prefill keeps what the user already typed', async () => {
  const { flow } = setup();
  flow.open();
  flow.setText('renterName', 'Người khác');
  await tick();
  assert.equal(flow.get().renterName, 'Người khác');
  assert.equal(flow.get().renterPhone, '0900');
});

test('changing the date clears the slot; tapping the same day does nothing', async () => {
  const { flow, named } = await opened();
  flow.selectSlot(SLOT);
  flow.selectDate(new Date(2026, 10, 25, 23));
  assert.equal(flow.get().slot, SLOT);
  assert.equal(named('getAvailability').length, 1);
  flow.selectDate(day(27));
  assert.equal(flow.get().slot, null);
  assert.equal(flow.get().loading, true);
  await tick();
  assert.equal(flow.get().availability.date, '2026-11-27');
});

test('slots that web disables cannot be selected', async () => {
  const { flow } = await opened();
  for (const status of ['UNAVAILABLE', 'PENDING_YOU', 'CONFIRMED_YOU'])
    flow.selectSlot({ ...SLOT, status });
  assert.equal(flow.get().slot, null);
});

test('stale availability responses and errors are ignored and aborted', async () => {
  const pending = {};
  const signals = {};
  const { flow } = await opened({
    getAvailability: (_id, date, signal) => {
      signals[date] = signal;
      pending[date] = deferred();
      return pending[date].promise;
    },
  });
  flow.selectDate(day(26));
  await tick();
  flow.selectDate(day(27));
  await tick();
  assert.equal(signals['2026-11-25'].aborted, true);
  assert.equal(signals['2026-11-26'].aborted, true);
  pending['2026-11-27'].resolve(available('2026-11-27'));
  await tick();
  pending['2026-11-26'].resolve(available('2026-11-26', { isDayAvailable: false }));
  pending['2026-11-25'].reject(new Error('late'));
  await tick();
  assert.equal(flow.get().availability.date, '2026-11-27');
  assert.equal(flow.get().loadError, null);
  assert.equal(flow.get().loading, false);
});

test('a stale booking lookup never overwrites the newer one', async () => {
  const lookups = [];
  const { flow, named } = await opened({
    getMyBookingByListing: () => {
      lookups.push(deferred());
      return lookups.at(-1).promise;
    },
  });
  flow.selectDate(day(26));
  lookups[1].resolve(null);
  await tick();
  lookups[0].resolve(BOOKING);
  await tick();
  assert.equal(flow.get().existing, null);
  assert.equal(named('getAvailability').length, 1);
});

test('a closed weekday jumps to the next open one and reloads it', async () => {
  const { flow, named } = await opened({
    getAvailability: async (_id, date) => available(date, { allowedViewingDays: ['SATURDAY'] }),
  });
  await tick();
  assert.equal(flow.get().date.getDate(), 28);
  assert.deepEqual(
    named('getAvailability').map((call) => call[2]),
    ['2026-11-25', '2026-11-28']
  );
  assert.equal(flow.get().loading, false);
});

test('unknown weekday values cannot loop the auto-jump', async () => {
  const { flow, named } = await opened({
    getAvailability: async (_id, date) => available(date, { allowedViewingDays: ['NOPE'] }),
  });
  assert.equal(named('getAvailability').length, 1);
  assert.equal(flow.get().loading, false);
});

test('a load failure is shown and can be retried', async () => {
  let fail = true;
  const { flow } = await opened({
    getAvailability: async (_id, date) => {
      if (fail) throw new Error('Mất mạng');
      return available(date);
    },
  });
  assert.equal(flow.get().loadError, 'Mất mạng');
  assert.equal(flow.get().loading, false);
  fail = false;
  flow.retry();
  await tick();
  assert.equal(flow.get().loadError, null);
  assert.equal(flow.get().availability.date, '2026-11-25');
});

test('submit validates in web order without calling the API', async () => {
  const { flow, named } = await opened({}, {});
  const message = async () => (await flow.submit()).message;
  assert.equal(await message(), 'Vui lòng chọn khung giờ xem nhà');
  flow.selectSlot(SLOT);
  assert.equal(await message(), 'Vui lòng nhập họ và tên của bạn');
  flow.setText('renterName', ' An ');
  assert.equal(await message(), 'Vui lòng nhập số điện thoại liên hệ');
  assert.equal(named('createAppointment').length, 0);
});

test('a second submit while sending is ignored, and the body matches web', async () => {
  const sending = deferred();
  const { flow, named } = await opened({ createAppointment: () => sending.promise });
  flow.selectSlot(SLOT);
  flow.stepVisitors(20);
  flow.setText('renterNote', '  chỗ để xe  ');
  const first = flow.submit();
  assert.equal(flow.get().submitting, true);
  assert.equal(await flow.submit(), null);
  sending.resolve({});
  assert.deepEqual(plain(await first), {
    ok: true,
    message: 'Gửi yêu cầu đặt lịch thành công! Vui lòng chờ chủ nhà xác nhận.',
  });
  assert.equal(flow.get().submitting, false);
  assert.equal(named('createAppointment').length, 1);
  assert.deepEqual(plain(named('createAppointment')[0][1]), {
    listingId: 'l1',
    appointmentDate: '2026-11-25',
    startTime: '09:00:00',
    endTime: '10:00:00',
    renterName: 'Nguyễn An',
    renterPhone: '0900',
    visitorCount: 10,
    renterNote: 'chỗ để xe',
  });
});

test('a failed submit shows the server message, else the web fallback, and can be resent', async () => {
  const errors = [{ response: { data: { message: 'Trùng lịch' } } }, new Error('x')];
  const { flow } = await opened({
    createAppointment: async () => {
      throw errors.shift();
    },
  });
  flow.selectSlot(SLOT);
  assert.deepEqual(plain(await flow.submit()), { ok: false, message: 'Trùng lịch' });
  assert.equal((await flow.submit()).message, 'Không thể đặt lịch. Vui lòng thử lại.');
  assert.equal(flow.get().slot, SLOT);
});

test('reschedule sends date, slot and reason; a failed lookup does not drop the booking', async () => {
  let booking = BOOKING;
  const { flow, named } = await opened({ getMyBookingByListing: async () => booking });
  flow.setRescheduling(true);
  assert.equal((await flow.submit()).message, 'Vui lòng chọn khung giờ mới bạn muốn đổi sang');
  booking = null; // getMyBookingByListing answers null when the request fails
  flow.selectDate(day(30));
  await tick();
  flow.selectSlot(SLOT);
  flow.setText('rescheduleReason', ' bận ');
  assert.equal((await flow.submit()).message, 'Đã gửi yêu cầu đổi lịch đến chủ nhà!');
  assert.deepEqual(plain(named('requestReschedule')[0].slice(1)), [
    'b1',
    {
      proposedDate: '2026-11-30',
      proposedStartTime: '09:00:00',
      proposedEndTime: '10:00:00',
      rescheduleReason: 'bận',
    },
  ]);
  assert.equal(named('createAppointment').length, 0);
});

test('leaving reschedule mode clears the slot', async () => {
  const { flow } = await opened({ getMyBookingByListing: async () => BOOKING });
  flow.setRescheduling(true);
  flow.selectSlot(SLOT);
  flow.setRescheduling(false);
  assert.equal(flow.get().slot, null);
});

test('cancel runs once, clears the booking and reloads availability only', async () => {
  const { flow, named } = await opened({ getMyBookingByListing: async () => BOOKING });
  flow.setConfirmingCancel(true);
  flow.setText('cancelReason', 'bận');
  const first = flow.cancel();
  assert.equal(await flow.cancel(), null);
  assert.deepEqual(plain(await first), { ok: true, message: 'Đã hủy lịch xem nhà thành công' });
  await tick();
  assert.equal(named('cancelByRenter').length, 1);
  assert.deepEqual(named('cancelByRenter')[0].slice(1), ['b1', 'bận']);
  assert.equal(flow.get().existing, null);
  assert.equal(flow.get().confirmingCancel, false);
  assert.equal(named('getAvailability').length, 2);
  assert.equal(named('getMyBookingByListing').length, 1);
});

test('a failed cancel keeps the booking and the confirmation', async () => {
  const { flow } = await opened({
    getMyBookingByListing: async () => BOOKING,
    cancelByRenter: async () => {
      throw new Error('x');
    },
  });
  flow.setConfirmingCancel(true);
  assert.equal((await flow.cancel()).message, 'Không thể hủy lịch. Vui lòng thử lại.');
  assert.equal(flow.get().existing, BOOKING);
  assert.equal(flow.get().confirmingCancel, true);
});

test('close resets mode, slot and cancel confirmation and drops late replies', async () => {
  const late = deferred();
  let hold = false;
  const { flow } = await opened({
    getMyBookingByListing: async () => BOOKING,
    getAvailability: async (_id, date) => (hold ? late.promise : available(date)),
  });
  flow.setRescheduling(true);
  flow.selectSlot(SLOT);
  flow.setConfirmingCancel(true);
  flow.setText('cancelReason', 'bận');
  flow.setText('renterNote', 'giữ lại');
  hold = true;
  flow.retry();
  await tick();
  flow.close();
  late.resolve(available('late'));
  await tick();
  const state = flow.get();
  assert.deepEqual(
    [state.rescheduling, state.slot, state.confirmingCancel, state.cancelReason, state.loading],
    [false, null, false, '', true]
  );
  assert.equal(state.renterNote, 'giữ lại');
  assert.notEqual(state.availability.date, 'late');
});

test('reopening does not keep a past date', async () => {
  const { flow, named } = await opened();
  flow.selectDate(day(20));
  flow.close();
  flow.open();
  await tick();
  assert.equal(named('getAvailability').at(-1)[2], '2026-11-25');
});

test('KYC re-reads a cached unverified profile before blocking', async () => {
  const run = async (...answers) => {
    const forced = [];
    const result = await checkKyc(async (force) => {
      forced.push(Boolean(force));
      const answer = answers.shift();
      if (answer instanceof Error) throw answer;
      return answer;
    });
    return [result, forced];
  };
  const yes = { kycVerified: true };
  const no = { kycVerified: false };
  assert.deepEqual(await run(yes), ['verified', [false]]);
  assert.deepEqual(await run(no, yes), ['verified', [false, true]]);
  assert.deepEqual(await run(no, no), ['unverified', [false, true]]);
  assert.deepEqual(await run(new Error()), ['unavailable', [false]]);
  assert.deepEqual(await run(no, new Error()), ['unavailable', [false, true]]);
});

test('every Vietnamese string of the mobile booking UI comes from web', () => {
  const web = [
    'components/appointment/BookingAppointmentModal.tsx',
    'components/rent/RentDetailView.tsx',
    'lib/kyc-gate.ts',
  ]
    .map((file) => fs.readFileSync(path.join(WEB, file), 'utf8'))
    .join('\n')
    .replace(/\s+/g, ' ');
  const booking = path.join(SRC, 'components/appointment/booking');
  // Quoted literals and one-line JSX text containing a Vietnamese letter.
  const found = fs.readdirSync(booking).flatMap((name) => {
    const source = fs
      .readFileSync(path.join(booking, name), 'utf8')
      .replace(/^\s*(\/\/|\/\*\*|\{\/\*).*$/gm, '');
    return [...source.matchAll(/'([^'\r\n]*)'|"([^"\r\n]*)"|^\s*([^<>{}'"=\r\n]+?)\r?$/gm)]
      .map((match) => (match[1] ?? match[2] ?? match[3]).trim())
      .filter((text) => /[À-ỹ]/.test(text));
  });
  // Mobile only: retry button (approved deviation) and screen reader labels.
  const mobileOnly = ['Tải lại khung giờ', 'Giảm số người', 'Tăng số người', 'Lý do hủy', 'Đóng'];
  assert.ok(found.length > 20, `only ${found.length} strings found`);
  for (const text of found)
    if (!mobileOnly.includes(text)) assert.ok(web.includes(text), `Not in web: ${text}`);
});
