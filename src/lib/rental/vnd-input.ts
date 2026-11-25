// Port of hs-web-app lib/vnd-input.ts (verbatim; only import paths changed).
/** DTO amounts can be decimal strings such as "30000.00"; never strip those zeros as integer digits. */
export function canonicalVnd(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const source = String(value).trim();
  const integer = /^(\d+)(?:\.0+)?$/.exec(source);
  return integer ? integer[1].replace(/^0+(?=\d)/, '') : source;
}
export function formatVndInput(value: unknown): string {
  const digits = canonicalVnd(value);
  return /^\d+$/.test(digits) ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : digits;
}
export function vndSuggestions(value: unknown, max = 1_000_000_000): string[] {
  const digits = canonicalVnd(value),
    amount = Number(digits);
  if (!/^\d+$/.test(digits) || !Number.isSafeInteger(amount) || amount <= 0) return [];
  return [10, 100, 1000, 10000, 100000, 1000000]
    .map((scale) => amount * scale)
    .filter((candidate) => Number.isSafeInteger(candidate) && candidate <= max)
    .map(String);
}
/** Pasting permits grouped VND and exact zero decimals, but refuses real fractional/negative amounts. */
export function parsePastedVnd(value: string): string | null {
  let source = value.replace(/(?:VNĐ|VND|₫|đ)/gi, '').replace(/\s/g, '');
  if (!source || !/^[\d.,]+$/.test(source)) return null;
  if (/^[\d,]+\.0{1,2}$/.test(source)) source = source.replace(/\.0{1,2}$/, '');
  else if (/^[\d.]+,0{1,2}$/.test(source)) source = source.replace(/,0{1,2}$/, '');
  else if (/[.,]\d{1,2}$/.test(source)) return null;
  if (!/^\d+$/.test(source) && !/^\d{1,3}(?:[.,]\d{3})+$/.test(source)) return null;
  return source.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
}
