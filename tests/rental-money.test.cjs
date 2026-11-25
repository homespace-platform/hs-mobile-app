const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '../src');
const webRoot = path.resolve(__dirname, '../../hs-web-app');

function loader(root, stubs = {}) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    new Function('module', 'exports', 'require', 'requestAnimationFrame', outputText)(
      module,
      module.exports,
      (request) => stubs[request] ?? load(path.join(root, request.slice(2) + '.ts')),
      () => {}
    );
    return module.exports;
  };
}

const web = loader(webRoot, {
  react: {
    useId: () => 'money',
    useRef: () => ({}),
    useState: (value) => [value, () => {}],
  },
  'react/jsx-runtime': {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
  },
  '@/lib/utils': { cn: () => '' },
});
const WebMoneyInput = web(path.join(webRoot, 'components/ui/vnd-money-input.tsx')).default;
const { formatVndInput } = web(path.join(webRoot, 'lib/vnd-input.ts'));
const { editVndText } = loader(mobileRoot)(
  path.join(mobileRoot, 'components/rental/shared/logic.ts')
);
const at = (start, end = start) => ({ start, end });

function findInput(node) {
  if (node?.type === 'input') return node.props;
  for (const child of [node?.props?.children].flat()) {
    const input = child && findInput(child);
    if (input) return input;
  }
}

function eventResult(value, start, end, kind, inserted) {
  let webValue = value;
  const input = findInput(WebMoneyInput({ value, onValueChange: (next) => (webValue = next) }));
  const display = formatVndInput(value);
  let from = start;
  let to = end;
  let prevented = false;
  const event = {
    key: kind,
    preventDefault: () => (prevented = true),
    clipboardData: { getData: () => inserted },
    currentTarget: { selectionStart: start, selectionEnd: end },
  };
  if (kind === 'paste') input.onPaste(event);
  if (kind === 'Backspace' || kind === 'Delete') {
    input.onKeyDown(event);
    if (start === end) {
      if (kind === 'Backspace') from = Math.max(0, start - 1);
      else to = Math.min(display.length, end + 1);
    }
  }
  const native = display.slice(0, from) + inserted + display.slice(to);
  const caret = from + inserted.length;
  if (!prevented && native !== display) {
    input.onChange({ target: { value: native, selectionStart: caret } });
  }
  return { display, native, caret, webValue };
}

for (const value of [
  '',
  '0',
  '7',
  '111',
  '1234',
  '1250',
  '10000',
  '12345',
  '1000000',
  '11111111',
]) {
  test(`money matches web for every replacement of "${formatVndInput(value)}"`, () => {
    const actions = [
      ...Array.from('0123456789', (digit) => ['digit', digit]),
      ['Backspace', ''],
      ['Delete', ''],
      ...['5.25', '5.00', '00', '1.25', '0', '123', '1.000.000', ' 12 ', '-5', '1e5'].map(
        (paste) => ['paste', paste]
      ),
    ];
    for (let start = 0; start <= formatVndInput(value).length; start++) {
      for (let end = start; end <= formatVndInput(value).length; end++) {
        for (const [kind, inserted] of actions) {
          const { display, native, caret, webValue } = eventResult(
            value,
            start,
            end,
            kind,
            inserted
          );
          // A native unchanged-text event cannot safely imply a different amount.
          const before = at(start, end);
          const after = at(caret);
          const scenarios = [
            [
              editVndText(display, native, [before], undefined, true),
              true,
              'tagged pre-edit, text first',
            ],
            [
              editVndText(display, native, [before], after, true),
              true,
              'tagged pre-edit, caret first',
            ],
            [editVndText(display, native, [before]), false, 'untagged pre-edit'],
            [editVndText(display, native, [before, after]), false, 'untagged caret first'],
            [editVndText(display, native), false, 'no selection'],
            [editVndText(display, native, [], after), false, 'only tagged post-selection'],
          ];
          for (const [result, trusted, order] of scenarios) {
            const context = JSON.stringify({ display, start, end, kind, inserted, order });
            if ('value' in result) {
              assert.equal(result.value, native === display ? value : webValue, context);
            } else {
              assert.match(result.error, /^Dán số tiền VNĐ nguyên/, context);
              assert.ok(!trusted || kind === 'paste' || native === display, context);
            }
          }
        }
      }
    }
  });
}

test('conflicting caret interpretations and incompatible stale selection are refused', () => {
  for (const result of [
    editVndText('10.000', '10.00', [at(0, 6), at(5)]),
    editVndText('12.345', '12345', [at(3), at(2)]),
    editVndText('1.234', '5.001.234', [at(3)]),
  ]) {
    assert.match(result.error, /^Dán số tiền VNĐ nguyên/);
  }
});

test('identical native text selected from a formatted amount cannot silently change that amount', () => {
  for (const after of [undefined, at(4)]) {
    const result = editVndText('5.000', '5.000', [at(0, 4)], after);
    assert.match(result.error, /^Dán số tiền VNĐ nguyên/);
  }
});

test('an untagged caret on the removed dot cannot turn Backspace into Delete', () => {
  const after = at(2);
  assert.match(editVndText('12.345', '12345', [after]).error, /^Dán số tiền VNĐ nguyên/);
  assert.equal(editVndText('12.345', '12345', [at(3)], after, true).value, '1345');
  assert.equal(editVndText('12.345', '12345', [at(2)], after, true).value, '1245');
});
