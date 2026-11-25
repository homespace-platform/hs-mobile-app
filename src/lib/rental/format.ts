// Mobile-only: Hermes-safe equivalents of the vi-VN Intl calls the web uses inline. tests/rental-logic.test.cjs
// compares every one with Node's Intl. Vietnam has been a fixed UTC+7 since 1975, so no time-zone database is needed.
import { formatNumberVi } from '@/lib/rent-detail';

/** Rounds the way ICU does, on the shortest decimal text: 1.2345 -> 1.235 (toFixed alone gives 1.234). */
export function roundDecimal(value: number, digits: number) {
  const text = String(Math.abs(value));
  if (!Number.isFinite(value) || text.includes('e')) return value;
  return Math.sign(value) * Number(`${Math.round(Number(`${text}e${digits}`))}e-${digits}`);
}

/** `n.toLocaleString("vi-VN")` / `new Intl.NumberFormat("vi-VN").format(n)`. */
export const numberVi = (value: number) => formatNumberVi(roundDecimal(value, 3));

/** Intl vi-VN VND currency with no fraction digits: "14.000.000 ₫" (non-breaking space). */
export const currencyVnd = (value: number) => `${formatNumberVi(roundDecimal(value, 0), 0)}\u00a0₫`;

const two = (value: number) => String(value).padStart(2, '0');

/** Calendar fields in Vietnam time (`zone: "vn"`) or the device's own zone; null for an invalid date. */
function parts(value: string | number | Date, zone: 'vn' | 'device') {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const utc = zone === 'vn';
  const date = new Date(utc ? time + 7 * 3_600_000 : time);
  return {
    year: utc ? date.getUTCFullYear() : date.getFullYear(),
    month: (utc ? date.getUTCMonth() : date.getMonth()) + 1,
    day: utc ? date.getUTCDate() : date.getDate(),
    hour: two(utc ? date.getUTCHours() : date.getHours()),
    minute: two(utc ? date.getUTCMinutes() : date.getMinutes()),
    second: two(utc ? date.getUTCSeconds() : date.getSeconds()),
  };
}

type Parts = NonNullable<ReturnType<typeof parts>>;
const dateText = (p: Parts) => `${p.day}/${p.month}/${p.year}`;
const dateTimeText = (p: Parts) => `${p.hour}:${p.minute}:${p.second} ${dateText(p)}`;

/** `new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })`: "08:02:03 5/1/2026". */
export function vnDateTime(value: string | number | Date) {
  const p = parts(value, 'vn');
  return p ? dateTimeText(p) : 'Invalid Date';
}

/** `new Date(v).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })`: "5/1/2026". */
export function vnDate(value: string | number | Date) {
  const p = parts(value, 'vn');
  return p ? dateText(p) : 'Invalid Date';
}

/** Intl vi-VN `dateStyle: "short", timeStyle: "short"` in Vietnam time: "08:02 5/1/26". Valid dates only. */
export function vnShortDateTime(value: string | number | Date) {
  const p = parts(value, 'vn')!;
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${two(p.year % 100)}`;
}

/** Intl en-CA year/month/day in Vietnam time: "2026-01-05". Throws on an invalid date, like Intl. */
export function vnDateKey(value: string | number | Date) {
  const p = parts(value, 'vn');
  if (!p) throw new RangeError('Invalid time value');
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

/** `new Date(v).toLocaleString("vi-VN")` without a time zone (device zone). */
export function deviceDateTime(value: string | number | Date) {
  const p = parts(value, 'device');
  return p ? dateTimeText(p) : 'Invalid Date';
}

/** `new Date(v).toLocaleDateString("vi-VN")` without a time zone (device zone). */
export function deviceDate(value: string | number | Date) {
  const p = parts(value, 'device');
  return p ? dateText(p) : 'Invalid Date';
}
