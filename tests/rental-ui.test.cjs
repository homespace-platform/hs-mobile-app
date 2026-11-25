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

test('money typing keeps plain digits', () => {
  assert.deepEqual(plain(ui.editVndText('', '5')), { value: '5' });
  assert.deepEqual(plain(ui.editVndText('1.000', '1.0000')), { value: '10000' });
  assert.deepEqual(plain(ui.editVndText('10.000', '10.00')), { value: '1000' });
  assert.deepEqual(plain(ui.editVndText('5', '')), { value: '' });
  assert.deepEqual(plain(ui.editVndText('0', '07')), { value: '7' });
  // Deleting a grouping dot removes the digit before it.
  assert.deepEqual(plain(ui.editVndText('12.345', '12345')), { value: '1345' });
  // A stray separator typed on the keypad changes nothing.
  assert.deepEqual(plain(ui.editVndText('1.000', '1.000,')), { value: '1000' });
  for (const bad of ['-', '1.000-', '1e'])
    assert.match(ui.editVndText(bad.slice(0, -1), bad).error, /^Chỉ nhập số tiền/);
});

test('pasted money is parsed, never silently multiplied', () => {
  assert.deepEqual(plain(ui.editVndText('', '30000.00')), { value: '30000' });
  assert.deepEqual(plain(ui.editVndText('3', '30000.00')), { value: '30000' });
  assert.deepEqual(plain(ui.editVndText('100.000', '5.00')), { value: '5' });
  assert.deepEqual(plain(ui.editVndText('', '1.500.000 đ')), { value: '1500000' });
  for (const bad of ['1,5', '-5000', '12.34', 'abc'])
    assert.match(ui.editVndText('', bad).error, /^Dán số tiền VNĐ nguyên/, bad);
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
