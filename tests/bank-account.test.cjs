const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/bank-account.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;
const module_ = { exports: {} };
vm.runInNewContext(source, { exports: module_.exports });
const lib = module_.exports;

const banks = [
  {
    bin: '970436',
    code: 'VCB',
    name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
    shortName: 'Vietcombank',
  },
  { bin: '970418', code: 'BIDV', name: 'Ngân hàng Đầu tư và Phát triển', shortName: 'BIDV' },
];

test('bank search ignores accents/case and matches code, names and bin', () => {
  assert.equal(lib.filterBanks(banks, '').length, 2);
  assert.deepEqual(
    lib.filterBanks(banks, ' dau tu ').map((b) => b.code),
    ['BIDV']
  );
  assert.deepEqual(
    lib.filterBanks(banks, 'vcb').map((b) => b.code),
    ['VCB']
  );
  assert.deepEqual(
    lib.filterBanks(banks, '970436').map((b) => b.code),
    ['VCB']
  );
  assert.equal(lib.filterBanks(banks, 'zzz').length, 0);
});

test('edit mode prepends a bank missing from the catalog only', () => {
  const extra = { bin: '1', code: 'X', name: 'X', shortName: 'X', logo: null };
  assert.equal(lib.withExtraBank(banks, extra)[0], extra);
  assert.equal(lib.withExtraBank(banks, banks[0]), banks);
  assert.equal(lib.withExtraBank(banks, null), banks);
});

test('form inputs and validation match the web rules', () => {
  assert.equal(lib.cleanAccountNumber(' 0987 654\t321 '), '0987654321');
  assert.equal(lib.cleanHolderName('nguyen van a'), 'NGUYEN VAN A');
  assert.match(lib.bankFormError('', 'A', true), /điền đầy đủ/);
  assert.match(lib.bankFormError('123', '  ', true), /điền đầy đủ/);
  assert.equal(lib.bankFormError('123', 'A', false), 'Vui lòng chọn ngân hàng.');
  assert.equal(lib.bankFormError('123', 'A', true), null);
});
