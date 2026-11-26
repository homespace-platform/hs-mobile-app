const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports,
    URL,
    require(name) {
      if (name in dependencies) return dependencies[name];
      assert.fail(`Unexpected dependency ${name}`);
    },
  });
  return module.exports;
}

const lib = load('../src/lib/membership.ts');
const checkoutLib = load('../src/lib/membership-checkout.ts');
const eth = load('../src/lib/membership-eth-payment.ts');
const loadFlow = (membership) =>
  load('../src/lib/membership-order.ts', {
    '@/lib/membership': membership,
    '@/lib/membership-checkout': checkoutLib,
    '@/lib/membership-eth-payment': eth,
  });
// As shipped, mobile Sepolia payment is off; the ETH flow tests turn it on so it stays covered.
const shipped = loadFlow(lib);
const flow = loadFlow({ ...lib, MOBILE_ETH_PAYMENT_ENABLED: true });
const web = load('../../hs-web-app/lib/membership.ts', { axios: require('axios') });
const webText = (file) =>
  fs.readFileSync(path.join(__dirname, '../../hs-web-app', file), 'utf8').replace(/\s+/g, ' ');
const plain = (value) => JSON.parse(JSON.stringify(value));

const ID = 'ab'.repeat(16);
const NEXT_ID = 'cd'.repeat(16);
const HASH = '0x' + '3'.repeat(64);
const ACCOUNT = '0x' + '1'.repeat(40);
const plans = lib.mergeMembershipPlans([
  { code: 'FREE', publicationUses: 3, durationDays: 30, priceVnd: 0 },
  { code: 'STARTER', publicationUses: 10, durationDays: 30, priceVnd: 49000 },
  { code: 'PRO', publicationUses: 30, durationDays: 30, priceVnd: 129000 },
  { code: 'BUSINESS', publicationUses: 100, durationDays: 30, priceVnd: 349000 },
]);
const plan = (code) => plans.find((item) => item.code === code);
const me = (tier, remainingUses = 5, extra = {}) => ({
  tier,
  remainingUses,
  reservedUses: 0,
  expiresAt: null,
  unlimited: false,
  ...extra,
});
const card = (code, membership, extra = {}) =>
  lib.getPlanCardState(plan(code), { membership, unlimited: false, ...extra });

test('purchase block reasons are the web ones for every tier pair', () => {
  for (const tier of ['FREE', 'STARTER', 'PRO', 'BUSINESS'])
    for (const target of ['FREE', 'STARTER', 'PRO', 'BUSINESS'])
      for (const uses of [0, 4])
        assert.equal(
          lib.getPlanBlockReason(target, me(tier, uses)),
          web.getPlanBlockReason(target, me(tier, uses)),
          `${tier} -> ${target} (${uses})`
        );
  assert.equal(lib.getPlanBlockReason('PRO', null), undefined);
});

test('plan buttons follow the web card', () => {
  const buy = (state) => [state.kind, state.label];
  assert.deepEqual(buy(card('STARTER', me('FREE'))), ['buy', 'Mua gói Starter']);
  assert.deepEqual(buy(card('STARTER', null)), ['buy', 'Mua gói Starter']);
  assert.deepEqual(buy(card('PRO', me('PRO', 0))), ['buy', 'Mua lại Pro']);
  assert.deepEqual(buy(card('PRO', me('PRO', 1))), [
    'blocked',
    'Mua lại được khi đã dùng hết lượt gói',
  ]);
  assert.deepEqual(buy(card('STARTER', me('PRO', 0))), ['blocked', 'Đang sử dụng gói cao hơn']);
  assert.deepEqual(buy(card('BUSINESS', me('PRO'))), ['buy', 'Nâng cấp lên Business']);
  assert.deepEqual(buy(card('BUSINESS', me('PRO'), { refusal: 'Máy chủ từ chối' })), [
    'blocked',
    'Máy chủ từ chối',
  ]);

  // The 24h offer is the server quote, shown only when it is cheaper than the list price.
  const quote = { tier: 'BUSINESS', amountVnd: 220000, upgrade: true, remainingUsesAfter: 99 };
  const upgrade = card('BUSINESS', me('PRO'), { quote });
  assert.equal(upgrade.label, `Nâng cấp chỉ ${lib.formatVndPrice(220000)}`);
  assert.equal(upgrade.upgrade, quote);
  assert.equal(
    card('BUSINESS', me('PRO'), { quote: { ...quote, amountVnd: 349000 } }).upgrade,
    undefined
  );
  assert.equal(
    card('BUSINESS', me('PRO'), { quote: { ...quote, upgrade: false, mode: 'NEW' } }).upgrade,
    undefined
  );

  const free = card('FREE', me('FREE', 2, { quotaResetsAt: '2026-02-01T00:00:00Z' }));
  assert.deepEqual(buy(free), ['static', 'Đang áp dụng (còn 2 lượt)']);
  assert.equal(free.note, 'Hồi lượt vào 07:00 01/02/2026');
  assert.deepEqual(buy(card('FREE', me('PRO'))), ['static', 'Gói mặc định trọn đời']);

  const admin = card('STARTER', me('ADMIN', 0, { unlimited: true }), { unlimited: true });
  assert.deepEqual(buy(admin), ['buy', 'Kiểm thử mua gói Starter']);
  assert.equal(admin.note, 'ADMIN: đã có lượt không giới hạn.');
  assert.equal(admin.isCurrent, false);

  const source = webText('components/membership/MembershipPlanCard.tsx');
  for (const text of [
    'Đang áp dụng (còn ',
    'Gói mặc định trọn đời',
    'ADMIN: đã có lượt không giới hạn.',
    'Kiểm thử mua gói ',
    '`Mua lại ',
    '`Nâng cấp chỉ ',
    '`Nâng cấp lên ',
    '`Mua gói ',
  ])
    assert.ok(source.includes(text), text);
});

test('rules, order statuses, cancel notices and error messages copy the web', () => {
  const source = webText('components/membership/MembershipRules.tsx');
  for (const rule of lib.membershipRules(plan('FREE')))
    for (const text of [rule.title, ...rule.items]) assert.ok(source.includes(text), text);
  assert.match(
    lib.membershipRules({ publicationUses: 5, durationDays: 15 })[4].items[0],
    /5 lượt miễn phí, hồi lại mỗi 15 ngày/
  );

  for (const status of ['PENDING', 'PAID', 'REVIEW', 'CANCELLED', 'EXPIRED', 'FAILED', 'NEW']) {
    for (const check of [
      'isOrderPaidStatus',
      'isOrderPendingStatus',
      'isOrderFailedStatus',
      'isOrderReviewStatus',
    ])
      assert.equal(lib[check](status), web[check](status), `${check} ${status}`);
    for (const provider of ['SEPAY', 'ETH']) {
      const order = { id: ID, status, provider, kind: 'PLAN' };
      assert.equal(
        lib.getCancelOutcomeNotice(order).message,
        web.resolveCancelOrderOutcome(order).noticeMessage,
        `${status} ${provider}`
      );
      const presented = lib.getOrderStatusPresentation(status, provider);
      const expected = web.getOrderStatusPresentation(status, provider);
      assert.equal(presented.label, expected.label);
      assert.equal(presented.tone, expected.tone);
      if (status !== 'PENDING' && status !== 'NEW')
        assert.equal(presented.description, expected.description);
    }
    assert.equal(
      lib.canCancelMembershipOrder({ id: ID, status }),
      web.canCancelMembershipOrder({ id: ID, status })
    );
  }
  for (const code of [4013, 4014, 4015, 4016, 4017, 4018, 4019]) {
    const error = { isAxiosError: true, response: { status: 409, data: { code } } };
    assert.equal(lib.getMembershipErrorMessage(error), web.getMembershipErrorMessage(error));
  }
  assert.match(
    lib.getMembershipErrorMessage({ isAxiosError: true, message: 'Network Error' }),
    /Không kết nối được/
  );
});

test('only membership notices about this order reload it', () => {
  const notice = (type, orderId) => ({ category: 'PAYMENT', type, metadata: { orderId } });
  const signal = (event, payload) => lib.isMembershipChangeSignal(event, payload, ID);
  assert.equal(signal('connect'), true);
  assert.equal(signal('notification:new', notice('MEMBERSHIP_ACTIVATED', ID)), true);
  assert.equal(signal('notification:new', notice('MEMBERSHIP_ACTIVATED', NEXT_ID)), false);
  assert.equal(signal('notification:new', notice('PAYMENT_DUE_SOON', ID)), false);
});

function deviceStore() {
  const values = new Map();
  const store = {
    values,
    failSet: () => false,
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      if (store.failSet(key, value)) throw new Error('disk full');
      values.set(key, value);
    },
    remove: async (key) => void values.delete(key),
  };
  return store;
}
const memoryOf = (store) => flow.createOrderMemory(store, 'homespace.membership.scope');

const sepayCheckout = (amountVnd = 49000, orderId = ID) => {
  const back = `https://homespace.example.com/dashboard/membership/return?orderId=${orderId}`;
  return {
    orderId,
    amountVnd,
    provider: 'SEPAY',
    paymentUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
    formFields: {
      order_amount: String(amountVnd),
      merchant: 'm',
      currency: 'VND',
      operation: 'PURCHASE',
      order_description: 'HomeSpace membership STARTER',
      order_invoice_number: orderId,
      success_url: `${back}&sepayReturn=success`,
      error_url: `${back}&sepayReturn=error`,
      cancel_url: `${back}&sepayReturn=cancel`,
      signature: 's',
    },
  };
};

async function place(checkout, { cancelStatus = 'CANCELLED', store = deviceStore() } = {}) {
  const cancelled = [];
  const memory = memoryOf(store);
  const result = await flow.placeMembershipOrder({
    create: async () => {
      if (checkout instanceof Error) throw checkout;
      return checkout;
    },
    cancel: async (id) => {
      cancelled.push(id);
      if (cancelStatus instanceof Error) throw cancelStatus;
      return { status: cancelStatus };
    },
    memory,
    provider: 'SEPAY',
    expectedAmount: 49000,
  });
  return { result, cancelled, pending: await memory.pending() };
}

test('a created order is remembered and a blocked checkout links to it', async () => {
  const store = deviceStore();
  const first = await place(sepayCheckout(), { store });
  assert.equal(first.result.kind, 'ok');
  assert.equal(first.result.hosted.source.method, 'POST');
  assert.equal(first.pending, ID);

  const refused = Object.assign(new Error('409'), {
    response: { status: 409, data: { code: 4018 } },
  });
  const second = await place(refused, { store });
  assert.equal(second.result.kind, 'error');
  assert.equal(second.result.pendingOrderId, ID);
  assert.match(second.result.message, /đơn thanh toán hội viên chờ xử lý/);
  assert.deepEqual(second.cancelled, []);

  // As web: without a stored id there is no link; the message then says where the order is.
  const unknown = await place(refused);
  assert.equal(unknown.result.pendingOrderId, null);
  assert.equal(unknown.result.message, flow.PENDING_ORDER_UNKNOWN_MESSAGE);
  assert.match(unknown.result.message, /nơi đã tạo|đã tạo đơn/);
  assert.equal((await place(new Error('offline'), { store })).result.pendingOrderId, null);
});

test('a late PENDING answer cannot replace a finished order', async () => {
  const answers = [];
  const feed = flow.createOrderFeed(
    () => new Promise((resolve, reject) => answers.push({ resolve, reject }))
  );
  const of = (status) => ({ id: ID, status });

  // Polling and the recheck button share the read in flight.
  const poll = feed.read();
  assert.equal(feed.read(), poll);
  assert.equal(answers.length, 1);

  // A foreground read starts only after it, so it cannot answer out of order.
  const foreground = feed.readFresh();
  assert.equal(answers.length, 1);
  answers[0].resolve(of('PAID'));
  assert.equal(feed.accept(await poll), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(answers.length, 2);
  answers[1].resolve(of('PENDING'));
  assert.equal(feed.accept(await foreground), false);
  assert.equal(feed.status(), 'PAID');

  // A read left over from before a cancel is not joined, and its answer is refused.
  const before = feed.read();
  feed.drop();
  const after = feed.read();
  assert.notEqual(after, before);
  assert.equal(feed.accept(of('REVIEW')), true);
  answers[2].resolve(of('PENDING'));
  assert.equal(feed.accept(await before), false);
  assert.equal(feed.status(), 'REVIEW');

  // A failed read does not stay in flight.
  answers[3].reject(new Error('offline'));
  await assert.rejects(after, /offline/);
  void feed.read();
  assert.equal(answers.length, 5);

  // The screen applies every answer through this gate.
  const screen = fs.readFileSync(
    path.join(__dirname, '../src/components/membership/MembershipOrderScreen.tsx'),
    'utf8'
  );
  assert.ok(screen.includes('if (!feed.accept(next)) return;'));
  assert.equal(screen.match(/getMembershipOrder\(/g).length, 1);
});

test('a SePay order under review can still be opened after a restart and a new order', async () => {
  const store = deviceStore();
  const memory = memoryOf(store);
  await memory.remember(ID);
  await flow.syncOrderMemory(memory, { id: ID, status: 'REVIEW', provider: 'SEPAY' });
  // It no longer counts as the pending order that blocks a checkout.
  assert.equal(await memory.pending(), null);
  await place(sepayCheckout(49000, NEXT_ID), { store });
  const restarted = memoryOf(store);
  assert.equal(await restarted.pending(), NEXT_ID);
  assert.equal(await restarted.review(), ID);

  // Another order finishing leaves it; being resolved clears it.
  await flow.syncOrderMemory(restarted, { id: NEXT_ID, status: 'PAID', provider: 'SEPAY' });
  assert.equal(await restarted.review(), ID);
  await flow.syncOrderMemory(restarted, { id: ID, status: 'PAID', provider: 'SEPAY' });
  assert.equal(await restarted.review(), null);

  const screen = fs.readFileSync(
    path.join(__dirname, '../src/components/membership/MembershipScreen.tsx'),
    'utf8'
  );
  assert.ok(screen.includes('onClick={() => setOrder({ orderId: reviewOrderId })}'));
});

test('a changed price or unusable checkout cancels the order like the web', async () => {
  for (const cancelStatus of ['CANCELLED', 'PAID', 'PENDING', new Error('offline')]) {
    const outcome = await place(sepayCheckout(59000), { cancelStatus });
    const expected = await web.cancelOrderOnQuoteChange(sepayCheckout(59000), 49000, async () => {
      if (cancelStatus instanceof Error) throw cancelStatus;
      return { status: cancelStatus };
    });
    assert.equal(outcome.result.kind, 'price-changed');
    assert.deepEqual(outcome.cancelled, [ID]);
    assert.equal(outcome.result.pendingOrderId, expected.preservedOrderId);
    assert.equal(outcome.pending, expected.preservedOrderId);
  }
  const wrongGateway = { ...sepayCheckout(), paymentUrl: 'https://evil.example/pay' };
  const invalid = await place(wrongGateway);
  assert.equal(invalid.result.kind, 'error');
  assert.deepEqual(invalid.cancelled, [ID]);
  assert.equal(invalid.pending, null);
  const stuck = await place(wrongGateway, { cancelStatus: new Error('offline') });
  assert.equal(stuck.result.pendingOrderId, ID);
  assert.equal(stuck.pending, ID);
});

test('the stored order is cleared only when nothing is left to do', async () => {
  const order = (status, provider = 'ETH') => ({ id: ID, status, provider });
  async function after(status, proof, provider) {
    const memory = memoryOf(deviceStore());
    await memory.remember(ID);
    if (proof) await memory.saveProof(ID, proof);
    await flow.syncOrderMemory(memory, order(status, provider));
    return [await memory.pending(), plain(await memory.proof(ID))];
  }
  const draft = { paymentId: HASH };
  const sent = { paymentId: HASH, txHash: HASH };
  assert.deepEqual(await after('PENDING', null, 'SEPAY'), [ID, null]);
  assert.deepEqual(await after('PENDING', draft), [ID, draft]);
  assert.deepEqual(await after('PAID', sent), [null, null]);
  assert.deepEqual(await after('REVIEW', sent), [null, sent]);
  assert.deepEqual(await after('CANCELLED', null, 'SEPAY'), [null, null]);
  assert.deepEqual(await after('CANCELLED', draft), [null, null]);
  // A hash is never dropped before the order is paid.
  assert.deepEqual(await after('EXPIRED', sent), [ID, sent]);

  // Finishing an old order leaves a newer pending one alone.
  const memory = memoryOf(deviceStore());
  await memory.remember(NEXT_ID);
  await flow.syncOrderMemory(memory, order('PAID'));
  assert.equal(await memory.pending(), NEXT_ID);
});

const quote = {
  paymentId: '0x' + 'a'.repeat(64),
  payer: ACCOUNT,
  recipient: '0x' + '2'.repeat(40),
  contractAddress: '0x' + '4'.repeat(40),
  chainId: 11155111,
  amountVnd: 49000,
  amountWei: '1000',
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  signature: '0x' + 'b'.repeat(130),
};
const ethOrder = { id: ID, status: 'PENDING', provider: 'ETH', amountVnd: 49000 };

function ethSetup({ store = deviceStore(), request, order = ethOrder } = {}) {
  const sent = [];
  const reported = [];
  const memory = memoryOf(store);
  const deps = {
    memory,
    getOrder: async () => order,
    getWallet: async () => ({
      account: ACCOUNT,
      provider: {
        request: async (args) => {
          // The draft must already be on disk when MetaMask opens.
          sent.push({ args, draft: plain(await memory.proof(ID)) });
          return request ? request() : HASH;
        },
      },
    }),
    onSubmission: (value) => reported.push(plain(value)),
  };
  return {
    store,
    memory,
    deps,
    sent,
    reported,
    send: () => flow.sendMembershipEth(ID, quote, deps),
  };
}

test('Sepolia is sent once and the hash survives a restart', async () => {
  const first = ethSetup();
  await first.send();
  assert.deepEqual(first.sent[0].draft, { paymentId: quote.paymentId });
  assert.equal(first.sent[0].args.method, 'eth_sendTransaction');
  // Same keys as earlier app versions wrote.
  assert.deepEqual(JSON.parse(first.store.values.get(`homespace.membership.scope.${ID}`)), {
    paymentId: quote.paymentId,
    txHash: HASH,
  });

  const restarted = ethSetup({ store: first.store });
  assert.equal(await restarted.memory.pending(), ID);
  await assert.rejects(restarted.send, /Không gửi thêm ETH/);
  assert.equal(restarted.sent.length, 0);

  const settled = [];
  const settle = (answer) =>
    flow.settleMembershipPayment(ID, {
      memory: restarted.memory,
      settle: async (...args) => {
        settled.push(args);
        if (answer instanceof Error) throw answer;
        return answer;
      },
    });
  await assert.rejects(() => settle(new Error('3 block')), /3 block/);
  assert.equal((await restarted.memory.proof(ID)).txHash, HASH);
  const paid = await settle({ ...ethOrder, status: 'PAID' });
  assert.deepEqual(settled[1], [ID, quote.paymentId, HASH]);
  await flow.syncOrderMemory(restarted.memory, paid);
  assert.equal(await restarted.memory.proof(ID), null);
  assert.equal(await restarted.memory.pending(), null);
});

test('a second tap while MetaMask is open does not send again', async () => {
  let answer;
  const waiting = new Promise((resolve) => (answer = resolve));
  const setup = ethSetup({ request: () => waiting });
  const first = setup.send();
  await assert.rejects(setup.send, /Không gửi thêm ETH/);
  answer(HASH);
  await first;
  assert.equal(setup.sent.length, 1);
});

test('only an explicit rejection allows another send', async () => {
  const rejected = ethSetup({
    request: () => Promise.reject(Object.assign(new Error('rejected'), { code: 4001 })),
  });
  await assert.rejects(rejected.send, /rejected/);
  assert.equal(await rejected.memory.proof(ID), null);
  assert.equal(rejected.reported.at(-1), null);

  for (const request of [() => Promise.reject(new Error('relay lost')), () => undefined]) {
    const unknown = ethSetup({ request });
    await assert.rejects(unknown.send);
    assert.deepEqual(plain(await unknown.memory.proof(ID)), { paymentId: quote.paymentId });
    await assert.rejects(unknown.send, /Không gửi thêm ETH/);
    assert.equal(unknown.sent.length, 1);
  }
});

test('storage failures never lose a hash or open MetaMask without a draft', async () => {
  const noDraft = ethSetup();
  noDraft.store.failSet = (key) => key.endsWith(ID);
  await assert.rejects(noDraft.send, /disk full/);
  assert.equal(noDraft.sent.length, 0);

  const noHash = ethSetup();
  noHash.store.failSet = (_key, value) => value.includes('txHash');
  await assert.rejects(noHash.send, new RegExp(HASH));
  assert.equal(noHash.reported.at(-1).txHash, HASH);
  noHash.store.failSet = () => false;
  await flow.settleMembershipPayment(ID, {
    memory: noHash.memory,
    knownHash: HASH,
    settle: async () => ethOrder,
  });
  assert.equal((await noHash.memory.proof(ID)).txHash, HASH);
});

test('a changed order or an expired quote stops before MetaMask', async () => {
  for (const order of [
    { ...ethOrder, status: 'EXPIRED' },
    { ...ethOrder, amountVnd: 59000 },
    { ...ethOrder, provider: 'SEPAY' },
  ]) {
    const setup = ethSetup({ order });
    await assert.rejects(setup.send);
    assert.equal(setup.sent.length, 0);
    assert.equal(await setup.memory.proof(ID), null);
  }
});

test('the wallet signs only the challenge of this order and wallet', async () => {
  const signed = [];
  const run = (message) =>
    flow.quoteMembershipEth(ID, 49000, {
      getWallet: async () => ({
        account: ACCOUNT,
        provider: {
          request: async (args) => {
            signed.push(args);
            return '0x' + 'c'.repeat(130);
          },
        },
      }),
      encodeMessage: (value) => value,
      getChallenge: async () => ({ challengeId: 'c1', message }),
      getQuote: async () => quote,
    });
  const header = 'HomeSpace Sepolia membership wallet ownership\n';
  await assert.rejects(() => run(`${header}Order: ${NEXT_ID}\nWallet: ${ACCOUNT}\n`));
  assert.equal(signed.length, 0);
  assert.equal(await run(`${header}Order: ${ID}\nOwner: u\nWallet: ${ACCOUNT}\nNonce: n`), quote);
  assert.equal(signed[0].method, 'personal_sign');
});

test('while mobile ETH is off nothing new starts and a saved hash still settles', async () => {
  assert.equal(lib.MOBILE_ETH_PAYMENT_ENABLED, false);
  const touched = [];
  const never = (name) => async () => {
    touched.push(name);
    throw new Error(name);
  };
  const store = deviceStore();
  const memory = memoryOf(store);
  const disabled = new RegExp(lib.MOBILE_ETH_DISABLED_MESSAGE);

  const placed = await shipped.placeMembershipOrder({
    create: never('create'),
    cancel: never('cancel'),
    memory,
    provider: 'ETH',
    expectedAmount: 49000,
  });
  assert.equal(placed.kind, 'error');
  assert.match(placed.message, disabled);
  await assert.rejects(
    () =>
      shipped.quoteMembershipEth(ID, 49000, {
        getWallet: never('wallet'),
        encodeMessage: (value) => value,
        getChallenge: never('challenge'),
        getQuote: never('quote'),
      }),
    disabled
  );
  await assert.rejects(
    () =>
      shipped.sendMembershipEth(ID, quote, {
        memory,
        getOrder: never('order'),
        getWallet: never('wallet'),
        onSubmission: never('submission'),
      }),
    disabled
  );
  assert.deepEqual(touched, []);
  assert.equal(store.values.size, 0);

  // SePay is unaffected.
  const sepay = await shipped.placeMembershipOrder({
    create: async () => sepayCheckout(),
    cancel: never('cancel'),
    memory,
    provider: 'SEPAY',
    expectedAmount: 49000,
  });
  assert.equal(sepay.kind, 'ok');

  // A payment sent before the switch-off is still reconciled.
  await memory.saveProof(ID, { paymentId: quote.paymentId, txHash: HASH });
  const paid = await shipped.settleMembershipPayment(ID, {
    memory,
    settle: async () => ({ ...ethOrder, status: 'PAID' }),
  });
  await shipped.syncOrderMemory(memory, paid);
  assert.equal(await memory.proof(ID), null);

  // Both checkouts start on SePay and share the picker that disables MetaMask.
  const read = (file) =>
    fs.readFileSync(path.join(__dirname, '../src/components/membership', file), 'utf8');
  for (const file of ['MembershipCheckoutModal.tsx', 'MembershipAddonModal.tsx']) {
    assert.match(read(file), /useState<MembershipPaymentMethod>\('SEPAY'\)/, file);
    assert.ok(read(file).includes('<PaymentProviderPicker'), file);
  }
  assert.ok(read('PaymentProviderPicker.tsx').includes('disabled={disabled || off}'));
});
