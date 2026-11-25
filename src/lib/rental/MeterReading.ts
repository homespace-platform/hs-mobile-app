// Port of the pure parts of hs-web-app components/contract/detail/MeterReading.tsx:3-9, :19-20.
// Readings are parsed with Number(): a Vietnamese keyboard's decimal comma must be turned into "." by the input.
import { numberVi } from '@/lib/rental/format';

export type Reading = string | number | undefined;

export const readingNumber = (value: Reading) =>
  value == null || String(value).trim() === ''
    ? undefined
    : Number.isFinite(Number(value))
      ? Number(value)
      : undefined;

export const format = (value: Reading) => {
  const number = readingNumber(value);
  return number == null ? 'Chưa có' : numberVi(number);
};

/** end - start rounded to 3 decimals; undefined until both readings are numbers. */
export function consumption(start: Reading, end: Reading) {
  const startNumber = readingNumber(start);
  const endNumber = readingNumber(end);
  return startNumber != null && endNumber != null
    ? Math.round((endNumber - startNumber) * 1000) / 1000
    : undefined;
}
