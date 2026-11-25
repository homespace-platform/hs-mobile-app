// Port of hs-web-app lib/invoice-status.ts (mobile theme tokens; Hermes-safe formatters from ./format).
import { currencyVnd, vnDate } from '@/lib/rental/format';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';
import type { PaymentStatus } from '@/types/rental/payment-request.type';
import { paymentStatus as paymentLabel } from '@/lib/rental/rental-labels';

type InvoiceState = Pick<MonthlyInvoice, 'status' | 'workflowState'>;
type InvoicePeriod = Pick<MonthlyInvoice, 'periodIndex' | 'finalCostSupplement' | 'billingPeriod'> &
  Partial<Pick<MonthlyInvoice, 'status' | 'lines' | 'periodStart'>>;

const styles = {
  draft: 'border-border bg-muted text-muted-foreground',
  unpaid: 'border-warning bg-warning-soft text-warning',
  overdue: 'border-danger bg-danger-soft text-danger',
  paid: 'border-success bg-success-soft text-success',
  pending: 'border-primary-border bg-primary-soft text-primary',
  rolled: 'border-border bg-muted text-muted-foreground',
  unknown: 'border-border bg-muted text-muted-foreground',
};

export function invoicePeriodLabel(invoice: InvoicePeriod) {
  if (invoice.billingPeriod?.kind === 'INITIAL_RENT') return 'Tiền thuê tháng 1';
  if (invoice.billingPeriod?.kind === 'COSTS_ONLY')
    return `Chi phí tháng ${invoice.periodIndex + 1} · Tiền thuê đã thu trước`;
  if (invoice.finalCostSupplement || invoice.billingPeriod?.kind === 'SUPPLEMENT') {
    return 'Chi phí bổ sung kỳ cuối';
  }
  if (invoice.billingPeriod?.kind === 'FINAL_SETTLEMENT') {
    return 'Chi phí cuối hợp đồng';
  }
  if (invoice.billingPeriod?.kind === 'RECURRING') {
    const number = invoice.billingPeriod.paymentPeriodNumber;
    if (number === 1) return 'Tiền thuê tháng 1';
    return `Kỳ thanh toán ${number}`;
  }
  // Compatibility during rolling deployment: never guess the final month from a fixed lease length.
  if (invoice.status && invoice.status !== 'DRAFT' && invoice.lines?.length) {
    return invoice.lines.some((line) => line.type === 'RENT')
      ? `Kỳ thanh toán ${invoice.periodIndex + 2}`
      : 'Chi phí cuối hợp đồng';
  }
  return `Chi phí tháng ${invoice.periodIndex + 1} · Chờ thông tin kỳ thanh toán`;
}

/** Short supporting line for recurring periods; dates belong in an accessible details/tooltip. */
export function invoicePeriodSecondaryLabel(invoice: InvoicePeriod): string | null {
  if (invoice.billingPeriod?.kind !== 'RECURRING') return null;
  const rentMonth = invoice.billingPeriod.paymentPeriodNumber;
  if (!rentMonth || rentMonth < 2) return null;
  return `Tiền phòng theo khoảng ngày trên hóa đơn + chi phí tháng ${rentMonth - 1}`;
}

export function formatInvoiceDate(value?: string | null) {
  if (!value) return '—';
  const iso = value.includes('T') ? value : `${value}T00:00:00+07:00`;
  return vnDate(iso);
}

export function formatInvoiceMoney(value: number) {
  return currencyVnd(value);
}

/** Display-only: reported payment is not a confirmed receipt and never changes invoice accounting. */
export function invoiceStatusPresentation(
  invoice: InvoiceState,
  paymentStatus?: PaymentStatus | null,
  options?: { paymentLoadFailed?: boolean }
) {
  if (invoice.status === 'CANCELLED')
    return { label: 'Đã hủy / hết hạn', className: styles.rolled, kind: 'cancelled' as const };
  if (invoice.status === 'DRAFT') {
    return { label: 'Nháp / Chờ phát hành', className: styles.draft, kind: 'draft' as const };
  }
  if (invoice.status === 'ROLLED_OVER') {
    return { label: 'Đã chuyển nợ', className: styles.rolled, kind: 'rolled' as const };
  }
  if (invoice.status === 'PAID' || paymentStatus === 'CONFIRMED') {
    return { label: 'Đã thanh toán', className: styles.paid, kind: 'paid' as const };
  }
  if (paymentStatus === 'TRANSFER_REPORTED') {
    return {
      label: paymentLabel('TRANSFER_REPORTED').label,
      className: styles.pending,
      kind: 'awaiting_confirm' as const,
    };
  }
  if (paymentStatus === 'REJECTED') {
    return {
      label: paymentLabel('REJECTED').label,
      className: styles.overdue,
      kind: 'rejected' as const,
    };
  }
  if (!paymentStatus && invoice.workflowState === 'UNDER_REVIEW') {
    if (options?.paymentLoadFailed) {
      return {
        label: 'Chưa xác định trạng thái thanh toán',
        className: styles.unknown,
        kind: 'unknown' as const,
      };
    }
    return { label: 'Chờ xác nhận', className: styles.pending, kind: 'awaiting_confirm' as const };
  }
  if (invoice.status === 'OVERDUE') {
    return {
      label: paymentLabel('OVERDUE').label,
      className: styles.overdue,
      kind: 'overdue' as const,
    };
  }
  return {
    label: paymentLabel('AWAITING_TRANSFER').label,
    className: styles.unpaid,
    kind: 'unpaid' as const,
  };
}
