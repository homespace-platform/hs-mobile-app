const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { exports: module.exports, Array, Math });
  return module.exports;
}

const { getVisiblePages, pageRange } = load(path.join(__dirname, '../src/lib/pagination.ts'));
const plain = (value) => JSON.parse(JSON.stringify(value));

test('getVisiblePages: empty, single and short lists show every page', () => {
  assert.deepEqual(plain(getVisiblePages(1, 0)), []);
  assert.deepEqual(plain(getVisiblePages(1, -3)), []);
  assert.deepEqual(plain(getVisiblePages(1, 1)), [1]);
  assert.deepEqual(plain(getVisiblePages(3, 7)), [1, 2, 3, 4, 5, 6, 7]); // total <= siblings*2 + 5
});

test('getVisiblePages: long lists collapse with ellipses around the current page', () => {
  assert.deepEqual(plain(getVisiblePages(1, 30)), [1, 2, 'ellipsis', 30]);
  assert.deepEqual(plain(getVisiblePages(2, 30)), [1, 2, 3, 'ellipsis', 30]);
  assert.deepEqual(plain(getVisiblePages(5, 30)), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 30]);
  assert.deepEqual(plain(getVisiblePages(29, 30)), [1, 'ellipsis', 28, 29, 30]);
  assert.deepEqual(plain(getVisiblePages(30, 30)), [1, 'ellipsis', 29, 30]);
});

test('getVisiblePages: out-of-range current pages are clamped; always starts at 1 and ends at the last page', () => {
  assert.deepEqual(plain(getVisiblePages(0, 30)), plain(getVisiblePages(1, 30)));
  assert.deepEqual(plain(getVisiblePages(99, 30)), plain(getVisiblePages(30, 30)));
  for (let total = 2; total <= 40; total += 1) {
    for (let current = 1; current <= total; current += 1) {
      const pages = plain(getVisiblePages(current, total));
      assert.equal(pages[0], 1);
      assert.equal(pages[pages.length - 1], total);
      assert.ok(pages.includes(current), `${current}/${total} must be visible`);
      const numbers = pages.filter((item) => item !== 'ellipsis');
      assert.deepEqual(
        numbers,
        [...numbers].sort((a, b) => a - b),
        'ascending'
      );
      assert.equal(new Set(numbers).size, numbers.length, 'no duplicates');
      assert.ok(pages.length <= 7, `${current}/${total} stays compact`);
    }
  }
});

test('mobile pagination is identical to the web algorithm', () => {
  const webSource = fs.readFileSync(
    path.join(__dirname, '../../hs-web-app/lib/pagination.ts'),
    'utf8'
  );
  const web = load(path.join(__dirname, '../../hs-web-app/lib/pagination.ts'));
  assert.match(webSource, /export function getVisiblePages/);
  for (let total = 0; total <= 60; total += 1) {
    for (let current = -1; current <= total + 2; current += 1) {
      assert.deepEqual(
        plain(getVisiblePages(current, total)),
        plain(web.getVisiblePages(current, total)),
        `${current}/${total}`
      );
    }
  }
});

test('pageRange: "Hiển thị a - b trong tổng số n" for first, middle and last pages', () => {
  assert.deepEqual({ ...pageRange(1, 10, 10, 300) }, { from: 1, to: 10 });
  assert.deepEqual({ ...pageRange(2, 10, 10, 300) }, { from: 11, to: 20 });
  assert.deepEqual({ ...pageRange(30, 10, 10, 300) }, { from: 291, to: 300 });
  assert.deepEqual({ ...pageRange(4, 10, 3, 33) }, { from: 31, to: 33 }); // short last page
  assert.deepEqual({ ...pageRange(1, 10, 0, 0) }, { from: 0, to: 0 });
});

test('PAGE_SIZE is 10; pageCount rounds up; clampPage handles first/last and junk', () => {
  const { PAGE_SIZE, pageCount, clampPage } = load(path.join(__dirname, '../src/lib/pagination.ts'));
  assert.equal(PAGE_SIZE, 10);
  assert.deepEqual([0, 10, 11, 95].map((n) => pageCount(n)), [1, 1, 2, 10]);
  assert.deepEqual([clampPage(1, 5), clampPage(5, 5), clampPage(99, 5), clampPage(0, 5), clampPage(NaN, 5), clampPage(3, 0)], [1, 5, 5, 1, 1, 1]);
});
