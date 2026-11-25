/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
// The clone Expo installs on the device: key order must survive it.
const deviceClone = require('@ungap/structured-clone').default;

// The web's own useWorkspaceState and InlineAmendmentFields run next to the mobile ones: the same
// edits are fired into both rendered input trees and the payload strings must be identical.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const SRC = path.resolve(__dirname, '../src');
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const BANKS = [
  { bin: '970436', code: 'VCB', shortName: 'Vietcombank', name: 'Ngân hàng Ngoại thương' },
  { bin: '970422', code: 'MB', shortName: 'MBBank', name: 'Ngân hàng Quân đội' },
];

/** A hooks runtime small enough to read: one stateful component, every other one rendered once. */
function createReact() {
  const slots = [];
  let cursor = 0;
  let stateful = true;
  const slot = (make) => {
    if (!stateful) return make();
    const at = cursor++;
    if (!(at in slots)) slots[at] = make();
    return slots[at];
  };
  const React = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({
      type,
      props: {
        ...props,
        ...(children.length ? { children: children.length > 1 ? children : children[0] } : {}),
      },
    }),
    useState(initial) {
      const box = slot(() => ({ v: typeof initial === 'function' ? initial() : initial }));
      return [box.v, (next) => (box.v = typeof next === 'function' ? next(box.v) : next)];
    },
    useRef: (initial) => slot(() => ({ current: initial })),
    useMemo: (make) => make(),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useContext: (context) => context.value,
    createContext: (value) => ({ value, Provider: 'Provider' }),
  };
  const render = (hook) => {
    cursor = 0;
    stateful = true;
    return hook();
  };
  /** Calls every function component and returns the flat list of host elements. */
  const hosts = (element) => {
    const found = [];
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if (typeof node.type === 'function') {
        stateful = false;
        return walk(node.type(node.props));
      }
      found.push(node);
      walk(node.props.children);
    };
    walk(element);
    return found;
  };
  return { React, render, hosts };
}

function loadModule(file, { stubs, globals, cache = new Map(), expose = '' }) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(read(file) + expose, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    ...globals,
    module,
    exports: module.exports,
    require: (request) => {
      if (request in stubs) return stubs[request];
      const base = request.startsWith('@/')
        ? path.join(SRC, request.slice(2))
        : request.startsWith('.')
          ? path.resolve(path.dirname(file), request)
          : null;
      if (!base) return require(request);
      return loadModule(`${base}.ts`, { stubs, globals, cache });
    },
  });
  return module.exports;
}

const hostStub = (name) => {
  const Stub = (props) => ({ type: name, props });
  return Stub;
};
const passthrough = ({ children }) => children;
const idSequence = () => {
  let n = 0;
  return () => `uuid-${++n}`;
};

function webSide() {
  const runtime = createReact();
  const { React } = runtime;
  const toasts = [];
  const dom = { invalid: null };
  const globals = {
    React,
    structuredClone,
    crypto: { randomUUID: idSequence() },
    document: {
      getElementById: () => null,
      querySelector: () => dom.invalid,
      visibilityState: 'visible',
    },
    window: {},
    Intl,
  };
  const react = { __esModule: true, ...React, default: React };
  const api = {};
  const workspaceStubs = {
    react,
    '@/components/common/PolicyDialog': { PolicyNotice: hostStub('Notice') },
    sonner: { toast: { error: (m) => toasts.push(m), success: (m) => toasts.push(m) } },
    '@/services/contract-amendment.service': { contractAmendmentService: api },
    '@/services/contract.service': { contractService: {} },
    '@/hooks/useAgreementChangeSync': { useAgreementChangeSync: () => {} },
    '@/utils/apiError': { getApiErrorMessage: (e) => e.message },
  };
  const detail = path.join(WEB, 'components/contract/detail');
  const workspace = loadModule(path.join(detail, 'ContractAmendmentWorkspace.tsx'), {
    stubs: workspaceStubs,
    globals,
    expose: '\nexports.__state = useWorkspaceState;',
  });
  let current = null;
  const fieldStubs = {
    react,
    '@/components/common/PolicyDialog': { PolicyNotice: hostStub('Notice') },
    './ContractFieldState': { ContractEditField: passthrough },
    'lucide-react': { Plus: () => null, Minus: () => null, RotateCcw: () => null },
    './ContractAmendmentWorkspace': { useAmendmentWorkspace: () => current, amendmentInput: '' },
    '@/components/ui/vnd-money-input': { __esModule: true, default: 'Vnd' },
    '@/lib/contract-amendment-input': loadModule(
      path.join(WEB, 'lib/contract-amendment-input.ts'),
      {
        stubs: {},
        globals,
      }
    ),
    './ContractDraftEditor': { useContractDraftEditor: () => null },
    './utils': { FieldRow: hostStub('FieldRow') },
    '@/hooks/useBanks': {
      useBanks: () => ({ banks: BANKS, loading: false, error: false, retry: () => {} }),
    },
  };
  const fields = loadModule(path.join(detail, 'InlineAmendmentFields.tsx'), {
    stubs: fieldStubs,
    globals,
  });
  const state = () =>
    (current = runtime.render(() => workspace.__state('c1', 'owner', 'landlord', true)));
  const tree = (target) => {
    state();
    return runtime.hosts(
      target.fields
        ? React.createElement(fields.ContractTermFields, {
            group: target.group,
            fields: target.fields,
          })
        : React.createElement(fields.default, { group: target.group })
    );
  };
  const textOf = (node) =>
    [node.props.children]
      .flat(9)
      .filter((c) => typeof c === 'string')
      .join('');
  const control = (target, label) => {
    const found = tree(target).find(
      (n) =>
        n.props['aria-label'] === label ||
        n.props.ariaLabel === label ||
        (n.type === 'Vnd' && n.props.label === label) ||
        (n.type === 'button' && textOf(n) === label)
    );
    assert.ok(found, `web control not found: ${label}`);
    return found;
  };
  return {
    state,
    toasts,
    dom,
    api,
    type: (target, label, value) => control(target, label).props.onChange({ target: { value } }),
    date: (target, label, value) => control(target, label).props.onChange({ target: { value } }),
    money: (target, label, value) => control(target, label).props.onValueChange(value),
    press: (target, label) => control(target, label).props.onClick(),
    fee: (target, value) =>
      control(target, 'Cách tính phí chậm trả').props.onChange({ target: { value } }),
    bank: (target, bin) => control(target, 'Ngân hàng').props.onChange({ target: { value: bin } }),
  };
}

const primed = (state) => (initial) =>
  Array.isArray(initial) && initial.length === 0 ? [BANKS, () => {}] : state(initial);

function mobileSide({ api = {}, contracts = {}, hooks = {} } = {}) {
  const runtime = createReact();
  const { React } = runtime;
  const toasts = [];
  const globals = { React, structuredClone: (v) => deviceClone(v), Intl };
  let current = null;
  const react = { __esModule: true, ...React, default: React };
  const shared = {
    react,
    'expo-crypto': { randomUUID: idSequence() },
    '@/components/rental/shared/PolicyNotice': { PolicyNotice: hostStub('Notice') },
    '@/services/rental/contract-amendment.service': { contractAmendmentService: api },
    '@/services/rental/contract.service': { contractService: contracts },
  };
  const contract = path.join(SRC, 'components/rental/contract');
  const workspace = loadModule(path.join(contract, 'ContractAmendmentWorkspace.tsx'), {
    stubs: {
      ...shared,
      '@/components/rental/shared/useDiscardDroppedFiles': { useDiscardDroppedFiles: () => {} },
      '@/components/rental/onboarding/common': {
        useToast: () => ({ error: (m) => toasts.push(m), success: (m) => toasts.push(m) }),
      },
      '@/lib/rental/apiError': { getApiErrorMessage: (e) => e.message },
      '@/lib/rental-sync/hooks': {
        useVisiblePoll: (fn) => (hooks.poll = fn),
        useAgreementChangeSync: (matches, fn) => Object.assign(hooks, { matches, sync: fn }),
      },
    },
    globals,
    expose: '\nexports.__state = useWorkspaceState;',
  });
  const fields = loadModule(path.join(contract, 'InlineAmendmentFields.tsx'), {
    stubs: {
      ...shared,
      'react-native': {
        View: 'View',
        Text: 'Text',
        TextInput: 'TextInput',
        Pressable: 'Pressable',
      },
      '@/components/bank/BankPicker': { __esModule: true, default: 'BankPicker' },
      '@/components/Icon': { __esModule: true, default: 'Icon' },
      '@/components/rental/onboarding/common': { ChoiceButton: 'ChoiceButton' },
      '@/components/rental/shared/ActionButton': { __esModule: true, default: 'ActionButton' },
      '@/components/rental/shared/DateField': { __esModule: true, default: 'DateField' },
      '@/components/rental/shared/FieldFrame': {
        __esModule: true,
        default: passthrough,
        inputBoxClass: () => '',
        inputTextClass: () => '',
        FieldTextColor: { value: undefined },
      },
      '@/components/rental/shared/InfoRow': { __esModule: true, default: 'InfoRow' },
      '@/components/rental/shared/VndMoneyInput': { __esModule: true, default: 'Vnd' },
      '@/lib/rental/ContractDraftEditor': { useContractDraftEditor: () => null },
      '@/lib/rental/ContractPoliciesSection': { formatVnd: (v) => String(v) },
      '@/services/rental/bank-account.service': { bankAccountService: {} },
      './ContractAmendmentWorkspace': { useAmendmentWorkspace: () => current },
      './fields': {
        ContractEditField: passthrough,
        FieldRow: 'FieldRow',
        NoticeText: 'NoticeText',
      },
      // useBanks is local to the component: its state is primed by the first useState call.
      react: {
        ...react,
        useState: primed(React.useState),
      },
    },
    globals,
  });
  const state = () =>
    (current = runtime.render(() => workspace.__state('c1', 'owner', 'landlord', true)));
  const tree = (target) => {
    state();
    return runtime.hosts(
      target.fields
        ? React.createElement(fields.ContractTermFields, {
            group: target.group,
            fields: target.fields,
          })
        : React.createElement(fields.default, { group: target.group })
    );
  };
  const control = (target, label, type) => {
    const found = tree(target).find(
      (n) =>
        (!type || n.type === type) &&
        (n.props.accessibilityLabel === label ||
          n.props.ariaLabel === label ||
          n.props.label === label ||
          (n.type === 'Pressable' && JSON.stringify(n.props.children)?.includes(`"${label}"`)))
    );
    assert.ok(found, `mobile control not found: ${label}`);
    return found;
  };
  return {
    state,
    toasts,
    tree,
    type: (target, label, value) => control(target, label, 'TextInput').props.onChangeText(value),
    date: (target, label, value) => control(target, label, 'DateField').props.onChange(value),
    money: (target, label, value) => control(target, label, 'Vnd').props.onValueChange(value),
    press: (target, label) => {
      const node = control(target, label);
      (node.props.onPress ?? node.props.onClick)();
    },
    fee: (target, value) => {
      const names = { NONE: 'Không phạt', FIXED_ONCE: 'Một lần', FIXED_PER_DAY: 'Mỗi ngày' };
      control(target, names[value], 'ChoiceButton').props.onPress();
    },
    bank: (target, bin) => control(target, undefined, 'BankPicker').props.onChange(bin),
  };
}

const terms = () => ({
  landlord: {
    fullName: 'A',
    phone: '0901',
    email: 'a@x.vn',
    bankName: 'Vietcombank',
    bankAccountNumber: '0011',
    bankAccountHolder: 'A',
  },
  tenant: {
    fullName: 'B',
    phone: '0902',
    occupantCount: 2,
    motorbikeCount: '1',
    carCount: 0,
    email: 'b@x.vn',
  },
  property: { areaText: '40 m²', features: [] },
  lease: {
    startDateText: '05/01/2027',
    endDateText: '04/01/2028',
    durationMonths: 12,
    durationText: '12 tháng',
    handoverDateText: '2027-01-05',
  },
  meters: { electricityInitial: '10' },
  financial: {
    amountValue: 3000000,
    amountNumber: '3.000.000 VNĐ',
    amountWords: 'Ba triệu đồng',
    paymentCycle: 'Hàng tháng',
    paymentDueDay: 'Ngày 05',
    paymentDueOffsetDays: 5,
    paymentMethod: 'Chuyển khoản',
    depositAmountValue: '3000000',
    depositDescription: 'Hoàn sau 7 ngày',
  },
  charges: [
    {
      name: 'Điện',
      chargeType: 'ELECTRICITY',
      billingMethod: 'PER_KWH',
      unitAmount: '3500',
      includedInRent: false,
      note: '',
    },
    {
      name: 'Gửi ô tô',
      chargeType: 'CAR_PARKING',
      billingMethod: 'PER_VEHICLE_MONTH',
      unitAmount: '900000',
      includedInRent: false,
      note: 'Hầm B1',
    },
  ],
  equipments: [{ name: 'Tủ lạnh', quantity: 1, condition: 'GOOD', note: '' }],
  amenities: [{ code: 'WIFI', name: 'Wifi' }],
  policies: {
    latePaymentFeeMode: 'Một lần',
    latePaymentFeeAmount: '100000',
    latePaymentFeeGraceDays: 0,
    latePaymentFeeCap: 0,
    billingRules: { maximumPenaltyDays: 5, lateFeeGraceDays: 0 },
    listingPolicies: [{ code: 'pet', label: 'Thú cưng', displayValue: 'Được', value: 'yes' }],
  },
  specialTerms: 'Giữ yên tĩnh.',
  systemTerms: 'Quy trình hệ thống.',
});

const proposal = (id, status, extra = {}) => ({
  id,
  status,
  proposerId: 'owner',
  recipientId: 'tenant',
  effectiveOn: '2027-03-05',
  immediateEffect: false,
  reason: 'Lý do của đề xuất cũ',
  comparison: [],
  changes: {},
  evidenceIds: [],
  ...extra,
});

const amendments = (proposals = []) => ({
  serverNow: '2026-11-26T00:00:00Z',
  canPropose: true,
  currentTermsRevisionId: 'rev-7',
  currentTerms: terms(),
  availableDates: ['2027-02-05', '2027-03-05'],
  proposals,
});

const TENANT_COUNTS = { group: 'residents' };
const PARTY = {
  group: 'landlord',
  fields: [
    ['phone', 'Số điện thoại'],
    ['email', 'Email liên hệ'],
    ['bankName', 'Ngân hàng'],
    ['bankAccountNumber', 'Số tài khoản'],
  ],
};
const LEASE = {
  group: 'lease',
  fields: [
    ['startDateText', 'Ngày bắt đầu tính tiền thuê'],
    ['endDateText', 'Ngày kết thúc hợp đồng'],
    ['durationMonths', 'Số tháng thuê'],
    ['durationText', 'Thời hạn thuê'],
    ['handoverDateText', 'Ngày bàn giao tài sản'],
  ],
};
const MONEY_TERMS = {
  group: 'financial',
  fields: [
    ['paymentCycle', 'Kỳ hạn thanh toán'],
    ['depositDescription', 'Điều kiện hoàn cọc'],
  ],
};
const RENT = { group: 'rent' };
const RULES = { group: 'rules' };
const CHARGES = { group: 'charges' };

const attempt = (fn) => {
  try {
    return { ok: JSON.stringify(fn()) };
  } catch (error) {
    return { error: error.message };
  }
};

/** Runs one script on both sides and compares everything the web derives from it. */
function both({ data, startArgs = () => [], steps = [], reason = 'Hai bên đã thống nhất lại' }) {
  const sides = [webSide(), mobileSide()];
  const results = sides.map((side) => {
    side.state().setData(data());
    const w = side.state();
    w.start(...startArgs(w.data));
    for (const step of steps) step(side);
    if (reason !== null) side.state().setReason(reason);
    return side;
  });
  const [web, mobile] = results.map((side) => {
    const s = side.state();
    return {
      editing: s.editing,
      values: JSON.stringify(s.values),
      changes: JSON.stringify(s.changes),
      hasChanges: s.hasChanges,
      groups: s.changedGroupCount,
      financial: s.financial,
      effectiveOn: s.effectiveOn,
      draft: attempt(() => s.payload(false)),
      review: attempt(() => s.payload()),
      toasts: [...side.toasts],
    };
  });
  assert.deepEqual(mobile, web);
  return { ...mobile, sides: results };
}

test('opening the composer without edits matches web and refuses to review', () => {
  const result = both({ data: () => amendments() });
  assert.equal(result.review.error, 'Chưa có nội dung thay đổi.');
  assert.equal(result.changes, '{}');
});

test('rent, deposit and payment terms build the web payload', () => {
  const result = both({
    data: () => amendments(),
    steps: [
      (s) => s.state().setEditingFinancial(true),
      (s) => s.money(RENT, 'Tiền thuê hàng tháng (đ)', '3500000'),
      (s) => s.type(MONEY_TERMS, 'Kỳ hạn thanh toán', 'Mỗi 3 tháng'),
      (s) => s.type(MONEY_TERMS, 'Điều kiện hoàn cọc', 'Hoàn sau 14 ngày'),
    ],
  });
  assert.equal(
    result.changes,
    '{"rentAmount":"3500000","fields":{"financial":{"paymentCycle":"Mỗi 3 tháng","depositDescription":"Hoàn sau 14 ngày"}},"freeForm":true}'
  );
  assert.ok(result.review.ok);
  assert.equal(result.financial, true);
});

test('resident counts, contact, bank and lease cross-calculation keep the web key order', () => {
  const result = both({
    data: () => amendments(),
    steps: [
      (s) => s.type(TENANT_COUNTS, 'Xe máy đăng ký', '2'),
      (s) => s.type(TENANT_COUNTS, 'Số người cư trú', '3'),
      (s) => s.type(PARTY, 'Email liên hệ', 'moi@x.vn'),
      (s) => s.type(PARTY, 'Số tài khoản', '0099'),
      (s) => s.bank(PARTY, '970422'),
      (s) => s.date(LEASE, 'Ngày bắt đầu tính tiền thuê', '2027-02-05'),
      (s) => s.type(LEASE, 'Số tháng thuê', '6'),
      (s) => s.date(LEASE, 'Ngày kết thúc hợp đồng', '2028-02-04'),
    ],
  });
  assert.ok(result.review.ok);
  assert.match(result.changes, /"occupantCount":"3","motorbikeCount":"2"/);
  assert.match(result.changes, /"lease":\{"startDateText":"05\/02\/2027"/);
});

test('rules: fee mode, fee amount and agreed terms', () => {
  const result = both({
    data: () => amendments(),
    steps: [
      (s) => s.fee(RULES, 'FIXED_PER_DAY'),
      (s) => s.money(RULES, 'Mức phí chậm trả (đ)', '50000'),
      (s) => s.type(RULES, 'Điều khoản thỏa thuận khác', 'Không nuôi chó.'),
    ],
  });
  assert.equal(
    result.changes,
    '{"fields":{"policies":{"latePaymentFeeMode":"FIXED_PER_DAY","latePaymentFeeAmount":"50000"}},"specialTerms":"Không nuôi chó.","freeForm":true}'
  );
  const none = both({ data: () => amendments(), steps: [(s) => s.fee(RULES, 'NONE')] });
  assert.match(none.changes, /"latePaymentFeeMode":"NONE","latePaymentFeeAmount":"0"/);
});

test('C-182 charge table: edit, add and remove rows', () => {
  const result = both({
    data: () => amendments(),
    steps: [
      (s) => s.state().setEditingFinancial(true),
      (s) => s.money(CHARGES, 'Đơn giá Điện (đ)', '4000'),
      (s) => s.type(CHARGES, 'Cách tính 2', 'Bao gồm'),
      (s) => s.type(CHARGES, 'Ghi chú 2', 'Một chỗ'),
      (s) => s.press(CHARGES, 'Thêm dòng phí'),
      (s) => s.type(CHARGES, 'Khoản phí 3', 'Internet'),
      (s) => s.money(CHARGES, 'Đơn giá Internet (đ)', '200000'),
      (s) => s.press(CHARGES, 'Xóa dòng charges 1'),
    ],
  });
  assert.ok(result.review.ok);
  assert.match(result.changes, /^\{"charges":\[\{"name":"Gửi ô tô"/);
});

test('"Khôi phục mục này" removes the change, key order included', () => {
  for (const [target, step] of [
    [CHARGES, (s) => s.money(CHARGES, 'Đơn giá Điện (đ)', '9')],
    [RENT, (s) => s.money(RENT, 'Tiền thuê hàng tháng (đ)', '1')],
    [RULES, (s) => s.fee(RULES, 'NONE')],
  ]) {
    const result = both({
      data: () => amendments(),
      steps: [
        (s) => s.state().setEditingFinancial(true),
        step,
        (s) => s.press(target, 'Khôi phục mục này'),
      ],
    });
    assert.equal(result.changes, '{}');
  }
});

test('an invalid count is refused at review but still saved as a draft', () => {
  const sides = [webSide(), mobileSide()];
  const outcome = sides.map((side, i) => {
    side.state().setData(amendments());
    side.state().start();
    side.type(TENANT_COUNTS, 'Số người cư trú', '0');
    side.state().setReason('Hai bên đã thống nhất lại');
    // What the browser would report for <input type="number" min="1" value="0">.
    if (i === 0) side.dom.invalid = { reportValidity: () => {} };
    const s = side.state();
    return { draft: attempt(() => s.payload(false)), review: attempt(() => s.payload()) };
  });
  assert.deepEqual(outcome[1], outcome[0]);
  assert.equal(outcome[1].review.error, 'Kiểm tra lại giá trị số/ngày đang nhập.');
  assert.ok(outcome[1].draft.ok);
});

test('a saved draft is restored without its locked keys', () => {
  const draft = {
    requestId: 'old',
    baseRevisionId: 'rev-7',
    effectiveOn: '2027-03-05',
    reason: 'Bản nháp đã lưu từ trước',
    evidenceIds: ['e1'],
    changes: {
      rentAmount: '3200000',
      fields: {
        policies: { latePaymentFeeAmount: '70000', latePaymentFeeCap: 1, billingRules: {} },
        financial: { paymentMethod: 'Tiền mặt', paymentDueDay: 'x' },
      },
      additionalTerms: 'Thêm một ý',
      freeForm: true,
    },
  };
  const result = both({
    data: () => amendments(),
    startArgs: () => [undefined, draft],
    reason: null,
    steps: [(s) => s.type(MONEY_TERMS, 'Điều kiện hoàn cọc', 'Mới')],
  });
  assert.ok(result.review.ok);
  assert.equal(result.effectiveOn, '2027-03-05');

  const stale = both({
    data: () => amendments(),
    startArgs: () => [undefined, { ...draft, baseRevisionId: 'rev-6' }],
  });
  assert.equal(stale.editing, false);
  assert.equal(stale.toasts.length, 1);
  const closed = both({
    data: () => amendments(),
    startArgs: () => [undefined, { ...draft, tenantRequestId: 'gone' }],
  });
  assert.equal(closed.editing, false);
});

test('accepted tenant request and "Chỉnh lại trên hợp đồng" carry the web ids', () => {
  const request = proposal('t1', 'TENANT_ACCEPTED', { reason: 'Người thuê xin giảm giá thuê' });
  const fromRequest = both({
    data: () => amendments([request]),
    startArgs: (d) => [undefined, null, d.proposals[0]],
    reason: null,
    steps: [(s) => s.money(RENT, 'Tiền thuê hàng tháng (đ)', '2000000')],
  });
  assert.match(fromRequest.review.ok, /"tenantRequestId":"t1"/);
  const changesRequested = proposal('p1', 'CHANGES_REQUESTED', {
    changes: { rentAmount: '2500000', freeForm: true },
    evidenceIds: ['e9'],
  });
  const reopened = both({
    data: () => amendments([changesRequested]),
    startArgs: (d) => [d.proposals[0]],
    reason: null,
  });
  assert.match(reopened.review.ok, /"previousProposalId":"p1"/);
});

test('replacing a signed addendum: unchanged is not a change, and the date is fixed', () => {
  const signed = proposal('s1', 'SCHEDULED', {
    changes: { rentAmount: '2800000', freeForm: true },
  });
  const base = {
    data: () => amendments([signed]),
    startArgs: (d) => [d.proposals[0]],
    reason: 'Điều chỉnh lại phụ lục đã ký',
  };
  const untouched = both(base);
  assert.equal(untouched.hasChanges, false);
  const edited = both({
    ...base,
    steps: [(s) => s.money(RENT, 'Tiền thuê hàng tháng (đ)', '2700000')],
  });
  assert.ok(edited.review.ok);
  assert.equal(edited.groups, 1);
  const moved = both({
    ...base,
    steps: [
      (s) => s.money(RENT, 'Tiền thuê hàng tháng (đ)', '2700000'),
      (s) => s.state().setEffectiveOn('2027-02-05'),
    ],
  });
  assert.equal(
    moved.review.error,
    'Chọn đầu kỳ áp dụng hợp lệ; bản thay thế phải giữ ngày hiệu lực cũ.'
  );
});

test('listing snapshot: required, and never mixed with money changes', () => {
  const draft = {
    requestId: 'old',
    baseRevisionId: 'rev-7',
    effectiveOn: '2027-02-05',
    reason: 'Đồng bộ lại theo bài đăng',
    changes: { listingSourceVersion: 'v1', freeForm: true },
  };
  // No preview service: the re-read of the saved listing version fails on both sides.
  const run = (steps) => {
    const sides = [webSide(), mobileSide()];
    return sides.map((side) => {
      side.state().setData(amendments());
      const w = side.state();
      w.selectListingSync({ sourceVersion: 'v1', differences: [] });
      for (const step of steps) step(side);
      return side;
    });
  };
  const select = (preview) => (s) => s.state().selectListingSync(preview);
  const open = (s) => s.state().start(undefined, null);
  const preview = { sourceVersion: 'v2', differences: [{ field: 'charges.0' }] };
  for (const steps of [
    [open, select(preview)],
    [open, select(preview), (s) => s.money(RENT, 'Tiền thuê hàng tháng (đ)', '1000')],
    [open, select(preview), select(null)],
  ]) {
    const [web, mobile] = run(steps).map((side) => {
      side.state().setReason(draft.reason);
      const s = side.state();
      return {
        changes: JSON.stringify(s.changes),
        financial: s.financial,
        review: attempt(() => s.payload()),
      };
    });
    assert.deepEqual(mobile, web);
  }
});

test('phone-only: a dropped or re-picked listing source discards the read in flight', async () => {
  const draft = {
    requestId: 'old',
    baseRevisionId: 'rev-7',
    effectiveOn: '2027-02-05',
    reason: 'Đồng bộ lại theo bài đăng',
    changes: { listingSourceVersion: 'v1', freeForm: true },
  };
  const saved = { sourceVersion: 'v1', baseRevisionId: 'rev-7', differences: [] };
  const other = { sourceVersion: 'v2', baseRevisionId: 'rev-7', differences: [] };
  for (const [pick, shown] of [
    [undefined, 'v1'],
    [null, undefined],
    [other, 'v2'],
  ])
    for (const fails of [false, true]) {
      let settle;
      const side = mobileSide({
        contracts: {
          previewListingSync: () =>
            new Promise((resolve, reject) => {
              settle = () => (fails ? reject(new Error('mạng')) : resolve(saved));
            }),
        },
      });
      side.state().setData(amendments());
      side.state().start(undefined, draft);
      if (pick !== undefined) side.state().selectListingSync(pick);
      settle();
      await new Promise((resolve) => setImmediate(resolve));
      const s = side.state();
      const kept = fails && pick === undefined ? undefined : shown;
      assert.equal(s.listingSync?.sourceVersion, kept);
      assert.equal(s.listingSourceVersion, pick === undefined ? 'v1' : shown);
      assert.equal(side.toasts.length, fails && pick === undefined ? 1 : 0);
    }
});

test('phone-only guard: re-picking the shown option is not an edit', () => {
  const side = mobileSide();
  side.state().setData(amendments());
  side.state().start();
  side.fee(RULES, 'FIXED_ONCE'); // stored as "Một lần"
  side.bank(PARTY, '970436'); // stored as the short name
  side.date(LEASE, 'Ngày bắt đầu tính tiền thuê', '2027-01-05');
  side.date(LEASE, 'Ngày bàn giao tài sản', '2027-01-05'); // stored as yyyy-MM-dd
  assert.equal(JSON.stringify(side.state().changes), '{}');
});

test('no poll or signal re-reads while composing or saving', async () => {
  let reads = 0;
  const hooks = {};
  const side = mobileSide({ hooks, api: { get: async () => (reads++, amendments()) } });
  side.state().setData(amendments([proposal('p', 'APPROVED', { agreementContractId: 'child' })]));
  side.state();
  assert.ok(hooks.matches('c1') && hooks.matches('child'));
  assert.ok(!hooks.matches(undefined) && !hooks.matches('other'));
  await hooks.poll();
  assert.equal(reads, 1);
  side.state().start();
  side.state();
  await hooks.poll();
  await hooks.sync();
  assert.equal(reads, 1);
  side.state().stop();
  let release;
  const saving = side.state().run(() => new Promise((resolve) => (release = resolve)));
  side.state();
  await hooks.poll();
  assert.equal(reads, 1);
  release();
  await saving;
});

test('single flight, and a slow read cannot overwrite a newer answer', async () => {
  const pending = [];
  const side = mobileSide({
    api: { get: () => new Promise((resolve) => pending.push(resolve)) },
  });
  const slow = side.state().load();
  side.state().setData({ ...amendments(), currentTermsRevisionId: 'after-propose' });
  pending[0]({ ...amendments(), currentTermsRevisionId: 'before-propose' });
  await slow;
  assert.equal(side.state().data.currentTermsRevisionId, 'after-propose');
  const first = side.state().load();
  const second = side.state().load();
  pending[2]({ ...amendments(), currentTermsRevisionId: 'newest' });
  pending[1]({ ...amendments(), currentTermsRevisionId: 'older' });
  await Promise.all([first, second]);
  assert.equal(side.state().data.currentTermsRevisionId, 'newest');

  let calls = 0;
  let release;
  const w = side.state();
  const one = w.run(() => (calls++, new Promise((resolve) => (release = resolve))));
  await w.run(async () => calls++);
  release();
  await one;
  assert.equal(calls, 1);
  await side.state().run(async () => {
    throw new Error('Lỗi máy chủ');
  });
  assert.deepEqual(side.toasts, ['Lỗi máy chủ']);
});

const logicSide = () =>
  loadModule(path.join(SRC, 'components/rental/contract/amendmentLogic.ts'), {
    stubs: {},
    globals: { structuredClone },
  });

function cut(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `web source changed around: ${from}`);
  return source.slice(start, end);
}

test('panel rules match the web panel source', () => {
  const logic = logicSide();
  const panel = read(path.join(WEB, 'components/contract/detail/ContractAmendmentPanel.tsx'));
  const replaces = vm.runInNewContext(
    ts.transpile(
      `(data) => { ${cut(panel, 'const replacesSigned', 'const replacementView')} return replacesSigned; }`
    )
  );
  const chain = [
    proposal('a', 'SUPERSEDED', { signedAt: 'x' }),
    proposal('b', 'SUPERSEDED', { previousProposalId: 'a' }),
    proposal('c', 'REQUESTED', { previousProposalId: 'b' }),
    proposal('d', 'REQUESTED', { previousProposalId: 'd' }),
  ];
  for (const id of ['a', 'b', 'c', 'd', 'zz', undefined])
    assert.equal(logic.replacesSigned(chain, id), replaces({ proposals: chain })(id), String(id));

  const turnSource = cut(panel, '<p>{p.agreementStatus', '</p><p className="mt-1 text-xs">Hạn ký');
  for (const status of ['TENANT_SIGNATURE_PENDING', 'DRAFT'])
    for (const isOwner of [true, false])
      assert.equal(
        logic.signingTurn(status, isOwner).message,
        vm.runInNewContext(turnSource.slice('<p>{'.length, -1), {
          p: { agreementStatus: status },
          isOwner,
        })
      );

  const resume = vm.runInNewContext(
    `(w, current) => Boolean(${cut(panel, '(!current || current.status', ' && <button type="button" onClick={() => w.start(undefined,w.savedDraft)}')})`
  );
  for (const status of [undefined, 'REQUESTED', 'TENANT_ACCEPTED', 'SCHEDULED', 'APPROVED'])
    for (const previousProposalId of ['x', 'y']) {
      const current = status ? proposal('x', status) : undefined;
      const savedDraft = { previousProposalId };
      assert.equal(logic.canResumeDraft(savedDraft, current), resume({ savedDraft }, current));
    }
});

test('a decision is only offered for the exact proposal that was opened', () => {
  const { canAnswerProposal } = logicSide();
  const opened = proposal('p', 'REQUESTED', { comparison: [{ field: 'rentAmount', after: '1' }] });
  assert.ok(canAnswerProposal(opened, [{ ...opened }], 'tenant'));
  assert.ok(!canAnswerProposal(opened, [{ ...opened }], 'owner'));
  assert.ok(!canAnswerProposal(opened, [{ ...opened, status: 'WITHDRAWN' }], 'tenant'));
  assert.ok(!canAnswerProposal(opened, [{ ...opened, comparison: [] }], 'tenant'));
  assert.ok(!canAnswerProposal(opened, [proposal('other', 'REQUESTED')], 'tenant'));
  assert.ok(!canAnswerProposal(null, [opened], 'tenant'));
});

test('evidence: five at most, and a retry uploads nothing twice', async () => {
  const { collectEvidence } = logicSide();
  const cache = new Map();
  const [a, b] = [{}, {}];
  let uploads = 0;
  let fail = true;
  const upload = async (file) => {
    if (file === b && fail) throw new Error('mạng');
    return `id-${++uploads}`;
  };
  await assert.rejects(collectEvidence([a, b], ['old'], cache, upload), /mạng/);
  fail = false;
  assert.deepEqual(
    [...(await collectEvidence([a, b], ['old'], cache, upload))],
    ['old', 'id-1', 'id-2']
  );
  await assert.rejects(
    collectEvidence([a], ['1', '2', '3', '4', '5'], cache, upload),
    /Tối đa 5 minh chứng\./
  );
});

test('renewal months: the whole typed value is checked, with the web error text', () => {
  const panel = read(path.join(SRC, 'components/rental/contract/ContractRenewalPanel.tsx'));
  const field = cut(panel, 'label="Số tháng thêm"', '</FieldFrame>');
  assert.ok(!field.includes('maxLength='));
  const webPanel = read(path.join(WEB, 'components/contract/detail/ContractLifecyclePanel.tsx'));
  const message = 'Chọn 1–36 tháng và nhập lý do ít nhất 10 ký tự.';
  assert.ok(webPanel.includes(message) && panel.includes(message));
  const check = cut(panel, '  function requestRenewal() {', '  async function approve');
  const { parseDays } = loadModule(path.join(SRC, 'components/rental/billing/logic.ts'), {
    stubs: { '@/lib/rental/apiError': {}, '@/lib/rental/format': {} },
    globals: {},
  });
  for (const [months, sent] of [
    ['1', 1],
    ['36', 36],
    ['3.0', 3],
    ['3.', null],
    ['100', null],
    ['37', null],
    ['0', null],
    ['', null],
    ['1.5', null],
    ['-5', null],
    ['0x10', null],
  ]) {
    const log = [];
    vm.runInNewContext(
      `${ts.transpile(check)}
requestRenewal();`,
      {
        months,
        note: 'Tiếp tục thuê thêm',
        contractId: 'c',
        parseDays,
        toast: { error: (m) => log.push(m) },
        perform: (action) => action(),
        api: { request: (_, count) => log.push(count) },
      }
    );
    assert.deepEqual(log, [sent ?? message], months);
  }
});

test('addendum evidence opens through the guarded billing opener', () => {
  const panel = read(path.join(SRC, 'components/rental/contract/ContractAmendmentPanel.tsx'));
  const evidence = cut(panel, 'function Evidence(', 'function Banner(');
  assert.ok(evidence.includes('useOpenStorage()'));
  assert.ok(evidence.includes('shown.current.includes(id)'));
  assert.ok(!panel.includes('openUrl'));
});
