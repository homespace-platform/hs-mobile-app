/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Pure rules of the shared rental UI (src/components/rental/shared/logic.ts).
const SRC = path.resolve(__dirname, '../src');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (request) =>
      load(
        `${request.startsWith('@/') ? path.join(SRC, request.slice(2)) : path.resolve(path.dirname(file), request)}.ts`
      ),
  });
  return module.exports;
}
const ui = load(path.join(SRC, 'components/rental/shared/logic.ts'));
// Objects made inside the VM have another prototype.
const plain = (value) => JSON.parse(JSON.stringify(value));

const webDialog = fs.readFileSync(
  path.resolve(__dirname, '../../hs-web-app/components/common/ActionDialog.tsx'),
  'utf8'
);

test('askReason counts the trimmed text and uses the web strings', () => {
  for (const text of ['Cần nhập thêm ${missing} ký tự', 'Đã đủ nội dung', 'Quay lại'])
    assert.ok(webDialog.includes(text), `web no longer says: ${text}`);
  assert.deepEqual(plain(ui.reasonState('   abc   ')), {
    trimmed: 'abc',
    valid: false,
    hint: 'Cần nhập thêm 7 ký tự',
    counter: '3/500',
  });
  assert.equal(ui.reasonState('  1234567890 ').hint, 'Đã đủ nội dung');
  assert.equal(ui.reasonState('          ').valid, false);
  assert.equal(ui.reasonState('', 0, 20).valid, true);
  assert.equal(ui.reasonState('abcd', 5, 20).counter, '4/20');
});

const money = ({ value, error }) => (error ? { error } : { value });
const at = (start, end = start) => ({ start, end });

test('money typing keeps plain digits', () => {
  assert.deepEqual(money(ui.editVndText('', '5', [at(0)])), { value: '5' });
  assert.deepEqual(money(ui.editVndText('1.000', '1.0000', [at(5)])), { value: '10000' });
  assert.deepEqual(money(ui.editVndText('10.000', '10.00', [at(6)])), { value: '1000' });
  assert.deepEqual(money(ui.editVndText('5', '', [at(1)])), { value: '' });
  assert.deepEqual(money(ui.editVndText('0', '07', [at(1)])), { value: '7' });
  // Deleting a grouping dot removes the digit before it.
  assert.deepEqual(money(ui.editVndText('12.345', '12345', [at(3)])), { value: '1345' });
  // A separator alone is indistinguishable from an invalid paste.
  assert.match(ui.editVndText('1.000', '1.000,', [at(5)]).error, /^Dán số tiền VNĐ nguyên/);
  for (const bad of ['-', '1.000-', '1e'])
    assert.match(
      ui.editVndText(bad.slice(0, -1), bad, [at(bad.length - 1)]).error,
      /^Chỉ nhập số tiền/
    );
});

test('pasted money is parsed, never silently multiplied', () => {
  assert.deepEqual(money(ui.editVndText('', '30000.00', [at(0)])), { value: '30000' });
  assert.deepEqual(money(ui.editVndText('3', '30000.00', [at(0, 1)])), { value: '30000' });
  assert.deepEqual(money(ui.editVndText('100.000', '5.00', [at(0, 7)])), { value: '5' });
  assert.deepEqual(money(ui.editVndText('', '1.500.000 đ', [at(0)])), { value: '1500000' });
  for (const bad of ['1,5', '-5000', '12.34', 'abc'])
    assert.match(ui.editVndText('', bad).error, /^Dán số tiền VNĐ nguyên/, bad);
});

test('a paste over selected text is read as a paste, backspace stays a deletion (C-177)', () => {
  const edit = (display, next, ...selections) => money(ui.editVndText(display, next, selections));
  const refused = (result) => assert.match(result.error ?? '', /^Dán số tiền VNĐ nguyên/);

  // Select all, paste "1.25": never 125. Selection reported before the text (Android)...
  refused(edit('1.250', '1.25', at(0, 5)));
  // ...or already replaced by the new caret (iOS), also when selected backwards.
  refused(edit('1.250', '1.25', at(0, 5), at(4)));
  refused(edit('1.250', '1.25', at(5, 0), at(4)));
  assert.deepEqual(edit('1.250', '2.000', at(0, 5)), { value: '2000' });
  assert.deepEqual(edit('1.250', '2.000', at(0, 5), at(5)), { value: '2000' });
  assert.deepEqual(edit('1.250', '30000.00', at(0, 5), at(8)), { value: '30000' });
  // A partial selection keeps the rest, as on web; only the pasted part is parsed.
  assert.deepEqual(edit('1.250', '1.99', at(2, 5)), { value: '199' });
  refused(edit('1.250', '1.2,5', at(2, 5)));
  // Typing or deleting over a selection.
  assert.deepEqual(edit('1.250', '5', at(0, 5)), { value: '5' });
  assert.deepEqual(edit('1.250', '', at(0, 5)), { value: '' });
  assert.deepEqual(edit('1.250', '', at(0, 5), at(0)), { value: '' });
  assert.match(edit('1.250', '-', at(0, 5)).error, /^Chỉ nhập số tiền/);
  // A selection that no longer fits the text is refused, not guessed.
  refused(edit('1.250', '1.25', at(1, 3)));

  // Plain backspace in either event order, also on the grouping dot.
  assert.deepEqual(edit('1.250', '1.25', at(5)), { value: '125' });
  assert.deepEqual(edit('1.250', '1.25', at(5), at(4)), { value: '125' });
  assert.deepEqual(edit('12.345', '12345', at(3)), { value: '1345' });
  assert.deepEqual(money(ui.editVndText('12.345', '12345', [at(3)], at(2))), { value: '1345' });
  refused(edit('12.345', '12345', at(3), at(2)));
  // Select all, tap the end again, then backspace.
  assert.deepEqual(edit('1.250', '1.25', at(0, 5), at(5)), { value: '125' });
  // Same events as an iOS paste of "10.00" (10 on web) and a backspace (1000): refused.
  refused(edit('10.000', '10.00', at(0, 6), at(5)));
  // Typing a digit.
  assert.deepEqual(edit('1.250', '1.2500', at(5)), { value: '12500' });
  assert.deepEqual(edit('1.250', '1.2500', at(5), at(6)), { value: '12500' });
});

test('money range error matches the web wording', () => {
  assert.equal(ui.vndRangeError(''), '');
  assert.equal(ui.vndRangeError('1000', 1, 5000), '');
  assert.equal(ui.vndRangeError('30000.00'), '');
  assert.equal(ui.vndRangeError('0', 1, 5000), 'Nhập số tiền VNĐ nguyên từ 1 đến 5.000 đ.');
  assert.notEqual(ui.vndRangeError('1.5'), '');
});

test('decimals accept the vi-VN comma and emit the web "." form', () => {
  assert.equal(ui.decimalDraft('12,5'), '12.5');
  assert.equal(ui.decimalDraft('12.'), '12.');
  assert.equal(ui.decimalDraft(''), '');
  for (const bad of ['1,2,3', '1.234,5', '-1', '1e3', '1,2345']) {
    assert.equal(ui.decimalDraft(bad), null, bad);
  }
  assert.equal(ui.parseDecimal(' 12,50 '), 12.5);
  assert.equal(ui.parseDecimal('7.'), 7);
  assert.equal(ui.parseDecimal(',5'), 0.5);
  for (const bad of ['', '.', '-1', 'abc', '1,2,3']) assert.equal(ui.parseDecimal(bad), null, bad);
});

test('date keys round-trip and reject impossible dates', () => {
  assert.equal(ui.toDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(ui.toDateKey(ui.fromDateKey('2028-02-29')), '2028-02-29');
  for (const bad of ['', '2026-02-29', '2026-13-01', '5/1/2026', null])
    assert.equal(ui.fromDateKey(bad), undefined, String(bad));
  assert.equal(ui.dateKeyLabel('2026-01-05'), '05/01/2026');
  assert.equal(ui.dateKeyLabel('x'), '');
  assert.equal(ui.isDateKeyInRange('2026-01-05', '2026-01-05', '2026-01-05'), true);
  assert.equal(ui.isDateKeyInRange('2026-01-04', '2026-01-05'), false);
  assert.equal(ui.isDateKeyInRange('2026-01-06', undefined, '2026-01-05'), false);
});

const file = (extra) => ui.normalizeFile({ uri: 'file:///c/a.jpg', ...extra });

test('picker results get a trustworthy MIME type and name', () => {
  // Android re-encodes HEIC to JPEG but reports the source MIME and name.
  assert.deepEqual(
    plain(
      ui.normalizeFile({
        uri: 'file:///cache/ImagePicker/x.jpeg',
        fileName: 'IMG_1.HEIC',
        mimeType: 'image/heic',
        sizeBytes: 10,
      })
    ),
    {
      uri: 'file:///cache/ImagePicker/x.jpeg',
      fileName: 'IMG_1.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 10,
    }
  );
  // A HEIC chosen as a document was not converted.
  assert.equal(
    file({ uri: 'file:///c/a.heic', fileName: 'a.heic', mimeType: 'image/heic' }).contentType,
    'image/heic'
  );
  assert.equal(
    file({ uri: 'file:///c/a.heic', mimeType: 'application/octet-stream' }).contentType,
    'image/heic'
  );
  assert.equal(file({ mimeType: 'image/jpg' }).contentType, 'image/jpeg');
  assert.equal(file({ fileName: 'Bill.PDF', mimeType: '' }).contentType, 'application/pdf');
  assert.equal(file({ uri: 'file:///c/H%C3%B3a.png' }).fileName, 'Hóa.png');
  assert.equal(file({ uri: 'content://x/42' }).contentType, 'application/octet-stream');
});

test('a picked batch is checked for count, type and size', () => {
  const rules = { types: ui.EVIDENCE_TYPES, maxBytes: ui.EVIDENCE_MAX_BYTES, maxCount: 5 };
  const messages = { type: 'T', size: 'S', count: 'C' };
  const ok = { contentType: 'image/png', sizeBytes: ui.EVIDENCE_MAX_BYTES };
  const check = (files, existing = 0, text = messages) =>
    ui.fileSelectionError(files, existing, rules, text);
  assert.equal(check([ok, ok]), null);
  assert.equal(check([ok, ok], 4), 'C');
  assert.equal(check([ok], 4), null);
  assert.equal(check([ok, { ...ok, contentType: 'image/heic' }]), 'T');
  assert.equal(check([{ ...ok, sizeBytes: ok.sizeBytes + 1 }]), 'S');
  assert.equal(check([{ ...ok, sizeBytes: 0 }]), 'S');
  assert.equal(check([{ ...ok, sizeBytes: Number.NaN }]), 'S');
  assert.equal(check([ok], 5, 'Tối đa 5 ảnh/PDF, 15 MB/tệp.'), 'Tối đa 5 ảnh/PDF, 15 MB/tệp.');
});

test('tone classes split into box and text classes', () => {
  assert.deepEqual(plain(ui.toneParts('danger')), {
    box: 'bg-danger-soft border-danger',
    text: 'text-danger',
  });
  assert.equal(ui.toneParts('neutral').text, 'text-muted-foreground');
});

test('B-209: a name pattern refuses by file name even when the MIME type passes', () => {
  const rules = {
    types: ui.EVIDENCE_TYPES,
    maxBytes: ui.EVIDENCE_MAX_BYTES,
    maxCount: 5,
    namePattern: /[.](jpe?g|png|webp|pdf)$/i,
  };
  const pdf = (fileName) => ({ fileName, contentType: 'application/pdf', sizeBytes: 1 });
  assert.equal(ui.fileSelectionError([pdf('chung-tu.PDF')], 0, rules, 'T'), null);
  assert.equal(ui.fileSelectionError([pdf('a.pdf'), pdf('chung-tu.bin')], 0, rules, 'T'), 'T');
  const without = { ...rules, namePattern: undefined };
  assert.equal(ui.fileSelectionError([pdf('chung-tu.bin')], 0, without, 'T'), null);
});

// AppCalendar.tsx run with a minimal hook runtime; the picker itself is not rendered.
function mountCalendar(props) {
  const slots = [];
  let hook = 0;
  const react = {
    useState(initial) {
      const at = hook++;
      if (!(at in slots)) slots[at] = typeof initial === 'function' ? initial() : initial;
      return [slots[at], (next) => (slots[at] = next)];
    },
    useRef: (current) => ({ current }),
    useMemo: (make) => make(),
    useCallback: (callback) => callback,
  };
  const element = (type, elementProps, key) => ({ type, key, props: elementProps });
  const modules = {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable' },
    'react-native-ui-datepicker': { __esModule: true, default: 'Picker' },
    'date-fns': require('date-fns'),
    'date-fns/locale/vi': require('date-fns/locale/vi'),
    '@/components/Icon': { __esModule: true, default: 'Icon' },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(SRC, 'components/appointment/AppCalendar.tsx'), 'utf8');
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    { module, exports: module.exports, require: (request) => modules[request] }
  );
  return (override = {}) => {
    hook = 0;
    const found = [];
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node?.props) return;
      found.push(node);
      walk(node.props.children);
    };
    walk(module.exports.default({ onSelect() {}, ...props, ...override }));
    const picker = found.find((node) => node.type === 'Picker');
    const arrow = (label) => found.find((node) => node.props.label === label)?.props;
    const caption = found.find((node) => node.props.accessibilityRole === 'header')?.props;
    const days = found.filter((node) =>
      /^\d{2}\/\d{2}\/\d{4}$/.test(node.props.accessibilityLabel ?? '')
    );
    return {
      picker,
      caption,
      days: days.map((day) => day.props),
      previous: arrow('Tháng trước'),
      next: arrow('Tháng sau'),
    };
  };
}

test('AppCalendar without range keeps the picker header, outside days and free navigation', () => {
  const { picker, previous, next } = mountCalendar({})();
  assert.equal(picker.props.showOutsideDays, true);
  assert.ok(!picker.props.hideHeader);
  for (const value of [picker.key, picker.props.month, picker.props.year])
    assert.equal(value, undefined);
  assert.equal(picker.props.components.Day, undefined);
  assert.deepEqual([previous, next], [undefined, undefined]);
});

test('B-210: range calendar renders the actual dates and selection when crossing into January', () => {
  const range = { start: new Date(2026, 10, 30), end: new Date(2027, 0, 31) };
  let picked;
  const render = mountCalendar({
    range,
    onSelect: (date) => {
      picked = date;
    },
  });
  const shown = (view) => view.days.map((day) => day.accessibilityLabel);
  let view = render();
  assert.equal(shown(view)[0], '01/11/2026');
  assert.equal(view.days[0].disabled, true);
  assert.equal(view.days.at(-1).disabled, false);
  assert.deepEqual([view.previous.disabled, view.next.disabled], [true, false]);
  view.next.onPress();
  view = render();
  assert.equal(shown(view)[0], '01/12/2026');
  view.next.onPress();
  view = render();
  assert.match(view.caption.children, /2027/);
  assert.deepEqual(
    shown(view),
    Array.from({ length: 31 }, (_, n) => `${String(n + 1).padStart(2, '0')}/01/2027`)
  );
  assert.ok(view.days.every((day) => !day.accessibilityState.selected));
  view.days[0].onPress();
  assert.deepEqual([picked.getFullYear(), picked.getMonth(), picked.getDate()], [2027, 0, 1]);
  assert.deepEqual([view.previous.disabled, view.next.disabled], [false, true]);
  // A reload that shortens the range pulls the shown month back inside it.
  assert.equal(shown(render({ range: { ...range, end: new Date(2026, 11, 5) } }))[0], '01/12/2026');
  const direct = mountCalendar({
    range: { start: new Date(2027, 0, 1), end: range.end },
  })();
  assert.equal(shown(direct)[0], '01/01/2027');
  const selected = new Date(2027, 0, 15);
  const selection = mountCalendar({ range, selected })();
  assert.equal(shown(selection)[0], '01/01/2027');
  assert.deepEqual(
    selection.days
      .filter((day) => day.accessibilityState.selected)
      .map((day) => day.accessibilityLabel),
    ['15/01/2027']
  );
});
