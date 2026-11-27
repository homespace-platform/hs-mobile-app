/* global __dirname */
// The work count of the "Cần chú ý" badge and the branch cards when the two reads answer out of order.
// Runs the real shell, attention tab, read hook, API module and parsers on a minimal hook runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const SRC = path.join(__dirname, '../src');
const REAL = [
  '@/components/branch/attention/BranchAttentionTab',
  '@/components/branch/attention/useBranchAttentionSummary',
  '@/services/branchMonitorApi',
];

function app(t) {
  let current;
  const changed = (old, deps) => !old || deps.some((dep, i) => dep !== old.deps[i]);
  const react = {
    useState(initial) {
      const { slots } = current;
      const i = current.next++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const set = (value) => {
        slots[i] = typeof value === 'function' ? value(slots[i]) : value;
      };
      return [slots[i], set];
    },
    useRef(initial) {
      return (current.slots[current.next++] ??= { current: initial });
    },
    useMemo(make, deps) {
      const i = current.next++;
      if (changed(current.slots[i], deps)) current.slots[i] = { deps, value: make() };
      return current.slots[i].value;
    },
    useCallback: (fn, deps) => react.useMemo(() => fn, deps),
    useEffect(run, deps) {
      const i = current.next++;
      if (changed(current.slots[i], deps)) current.effects.push({ i, run, deps });
    },
  };
  const mount = (Component) => {
    const own = { slots: [], effects: [] };
    return (props) => {
      current = own;
      own.next = 0;
      const tree = Component(props);
      for (const { i, run, deps } of own.effects.splice(0)) {
        own.slots[i]?.cleanup?.();
        own.slots[i] = { deps, cleanup: run() };
      }
      return tree;
    };
  };

  const listeners = new Set();
  const requests = [];
  const branches = ['b-1', 'b-2'].map((id) => ({ id, name: id, category: 'ROOM' }));
  // Any other import renders nothing: each export is just its own name.
  const names = (module) =>
    new Proxy({}, { get: (_, key) => (key === 'default' ? module.split('/').pop() : key) });
  const stubs = {
    react,
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: 'Fragment',
    },
    'react-native': new Proxy(
      {
        AppState: {
          addEventListener: (_, listener) => {
            listeners.add(listener);
            return { remove: () => listeners.delete(listener) };
          },
        },
      },
      { get: (target, key) => target[key] ?? key }
    ),
    '@/lib/axios-client': {
      default: {
        get: (url) =>
          new Promise((resolve, reject) =>
            requests.push({
              url,
              answer: (result) => resolve({ data: { result } }),
              fail: () => reject(new Error('offline')),
            })
          ),
      },
    },
    '@/lib/api-error': { apiError: String },
    '@/lib/branch-error': { branchError: (_, fallback) => fallback },
    '@/lib/use-feature-gate': { useFeatureGate: () => ({ allowed: true, title: '' }) },
    '@/components/AppDialog': { useDialog: () => () => {} },
    '@/screens/branch/BranchDetailScreen': {
      default: 'BranchDetailScreen',
      initialBranchDetail: (tab = 'map') => ({ tab }),
    },
    '@/services/branchApi': {
      getBranches: async () => branches,
      getBranch: async (id) => branches.find((branch) => branch.id === id),
    },
  };
  const cache = new Map();
  function load(name) {
    if (name in stubs) return stubs[name];
    if (!name.startsWith('@/lib/') && !name.startsWith('@/screens/') && !REAL.includes(name))
      return names(name);
    if (cache.has(name)) return cache.get(name).exports;
    const base = path.join(SRC, name.slice(2));
    const file = fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const mod = { exports: {} };
    cache.set(name, mod);
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(load, mod, mod.exports);
    return mod.exports;
  }

  // Each answer arrives at a later device time than the one before it.
  let device = 0;
  t.mock.method(Date, 'now', () => ++device);
  t.mock.method(globalThis, 'setInterval', () => 0);

  const find = (node, type) => {
    if (Array.isArray(node)) return node.flatMap((child) => find(child, type));
    if (!node?.props) return [];
    const below = Object.values(node.props).flatMap((value) => find(value, type));
    return node.type === type ? [node, ...below] : below;
  };
  const shell = mount(load('@/screens/BranchManagementScreen').default);
  const Tab = load('@/components/branch/attention/BranchAttentionTab').default;
  let tab = null;
  let tree;
  const render = () => (tree = shell({ onBack() {}, onSelectTab() {} }));
  const detail = () => (tree.type === 'BranchDetailScreen' ? tree.props : null);
  async function settle() {
    for (let round = 0; round < 3; round++) {
      await new Promise(setImmediate);
      render();
      if (tab && detail())
        tab({ branchId: 'b-1', nav: {}, onCountChange: detail().onAttentionCount });
    }
  }
  const last = (suffix) => requests.filter((request) => request.url.endsWith(suffix)).at(-1);
  const at = (second) => `2026-11-27T00:00:0${second}Z`;

  const self = {
    badge: () => detail().attentionCount,
    card: (id) => find(tree, 'BranchCard').find((card) => card.props.branch.id === id).props.count,
    async summary(second, count) {
      last('/attention-summary').answer({
        billingNow: at(second),
        realNow: at(second),
        branches: [{ branchId: 'b-1', count }],
      });
      await settle();
    },
    async page(second, totalElements) {
      last('/b-1/attention').answer({
        branchId: 'b-1',
        billingNow: at(second),
        realNow: at(second),
        items: [],
        page: 0,
        size: 20,
        totalElements,
      });
      await settle();
    },
    async summaryFails() {
      last('/attention-summary').fail();
      await settle();
    },
    async returnToApp() {
      for (const listener of [...listeners]) listener('active');
      await settle();
    },
    async open(id) {
      find(tree, 'BranchCard')
        .find((card) => card.props.branch.id === id)
        .props.onOpenAttention();
      await settle();
    },
    async back() {
      tab = null;
      detail().onBack();
      await settle();
    },
    /** Branch b-1 open on "Cần chú ý", both reads answered with `count` at second 0. */
    async start(count) {
      render();
      await settle();
      await self.summary(0, count);
      await self.open('b-1');
      await self.summary(0, count);
      tab = mount(Tab);
      await settle();
      await self.page(0, count);
    },
  };
  return self;
}

test('a summary of an older snapshot that arrives last cannot hide newer work', async (t) => {
  const screen = app(t);
  await screen.start(0);
  await screen.returnToApp();
  await screen.page(2, 1);
  await screen.summary(1, 0);
  assert.equal(screen.badge(), 1);
});

test('a newer summary wins over an older attention page that arrives last', async (t) => {
  const screen = app(t);
  await screen.start(1);
  await screen.returnToApp();
  await screen.summary(4, 0);
  await screen.page(3, 1);
  assert.equal(screen.badge(), 0);
});

test('a failed summary read keeps the newest known count, on the badge and on the card', async (t) => {
  const screen = app(t);
  await screen.start(0);
  await screen.returnToApp();
  await screen.page(2, 1);
  await screen.summaryFails();
  assert.equal(screen.badge(), 1);
  await screen.back();
  await screen.summaryFails();
  assert.equal(screen.card('b-1'), 1);
  await screen.open('b-2');
  await screen.back();
  assert.equal(screen.card('b-1'), 1, 'opening another branch must not bring the old count back');
  await screen.summary(5, 3);
  assert.equal(screen.card('b-1'), 3);
});
