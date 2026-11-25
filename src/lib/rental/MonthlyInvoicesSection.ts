// Port of the pure parts of hs-web-app components/contract/detail/MonthlyInvoicesSection.tsx (line numbers
// refer to it).
import { currencyVnd, deviceDate, vnDateTime } from '@/lib/rental/format';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';

// :46-48, :59-60, :70
export const money = (n: number) => currencyVnd(n);
export const date = (s?: string) => (s ? deviceDate(s) : '—');
export const dateTime = (s?: string) => (s ? vnDateTime(s) : '—');
export const NOT_FOUND =
  'Không tìm thấy hóa đơn được yêu cầu hoặc bạn không có quyền xem hóa đơn này.';

// :49-58 — untouched fields follow the server; a field the user edited keeps its value across silent refreshes.
export function seedDrafts<T>(
  previous: Record<string, T>,
  bills: MonthlyInvoice[],
  dirty: Set<string>,
  value: (bill: MonthlyInvoice) => T | undefined
) {
  const next: Record<string, T> = {};
  for (const bill of bills) {
    if (bill.status !== 'DRAFT') continue;
    const seeded = dirty.has(bill.id) && bill.id in previous ? previous[bill.id] : value(bill);
    if (seeded !== undefined) next[bill.id] = seeded;
  }
  return next;
}

// :61-69 — "Còn 3 ngày" / "Quá hạn 2 ngày" from the server clock, never the device time.
export function dueCountdown(dueAt?: string, now?: string) {
  if (!dueAt || !now) return null;
  const ms = new Date(dueAt).getTime() - new Date(now).getTime();
  if (Number.isNaN(ms)) return null;
  const abs = Math.abs(ms),
    days = Math.floor(abs / 86_400_000),
    hours = Math.max(1, Math.floor(abs / 3_600_000));
  const span = days >= 1 ? `${days} ngày` : `${hours} giờ`;
  return { late: ms < 0, text: ms < 0 ? `Quá hạn ${span}` : `Còn ${span}` };
}

export type Extra = { description: string; amount: string };

// :193-197 — the opening reading of a period: the lease's initial reading, else the previous period's end.
export function previousEnd(
  invoices: MonthlyInvoice[],
  invoice: Pick<MonthlyInvoice, 'periodIndex'>,
  kind: 'electricity' | 'water',
  initial: { electricity?: string | number; water?: string | number }
) {
  if (invoice.periodIndex === 0) return initial[kind];
  const previous = invoices.find((i) => i.periodIndex === invoice.periodIndex - 1);
  return kind === 'electricity' ? previous?.electricityEnd : previous?.waterEnd;
}

// :199-225 — meter and extra-charge validation before "Lưu nháp" / "Phát hành". `error` is the web toast.
export function invoiceDraftPayload(input: {
  electricityText?: string;
  waterText?: string;
  electricityRequired: boolean;
  waterRequired: boolean;
  unsupportedWaterRate: boolean;
  previousElectricity?: string | number;
  previousWater?: string | number;
  extras?: Extra[];
}) {
  const electricText = input.electricityText?.trim();
  const waterText = input.waterText?.trim();
  if (
    input.electricityRequired &&
    (!electricText || Number(electricText) < Number(input.previousElectricity))
  )
    return { error: 'Vui lòng nhập chỉ số điện cuối kỳ không thấp hơn đầu kỳ.' } as const;
  if (input.waterRequired && (!waterText || Number(waterText) < Number(input.previousWater)))
    return { error: 'Vui lòng nhập chỉ số nước cuối kỳ không thấp hơn đầu kỳ.' } as const;
  if (input.unsupportedWaterRate)
    return {
      error:
        'Biểu phí nước theo giá nhà nước chưa có đơn giá số đã chốt; vui lòng liên hệ quản trị viên.',
    } as const;
  const extraCharges = (input.extras || []).map((x) => ({
    description: x.description.trim(),
    amount: Number(x.amount),
  }));
  if (extraCharges.some((x) => !x.description || !Number.isFinite(x.amount) || x.amount <= 0))
    return { error: 'Mỗi khoản phát sinh cần tên và số tiền dương.' } as const;
  return {
    error: undefined,
    payload: {
      electricityEnd: input.electricityRequired ? Number(electricText) : undefined,
      waterEnd: input.waterRequired ? Number(waterText) : undefined,
      extraCharges,
    },
  };
}
