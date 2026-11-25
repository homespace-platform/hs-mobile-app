// Port of the helpers in hs-web-app components/rental-request/OnboardingPaymentCard.tsx:10-22.
import { numberVi, vnDateTime } from '@/lib/rental/format';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

export const money = (n: number) => numberVi(n) + ' đ';
export const instant = (s?: string | null) => (s ? vnDateTime(s) : '—');

export function span(ms: number) {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000),
    h = Math.floor((abs % 86_400_000) / 3_600_000),
    m = Math.floor((abs % 3_600_000) / 60_000);
  return d > 0 ? `${d} ngày ${h} giờ` : h > 0 ? `${h} giờ ${m} phút` : `${Math.max(m, 1)} phút`;
}

// Refunds have no per-payment confirmation deadline to show; the server auto-confirms after a silent period.
export const isRefundPayment = (p: Pick<PaymentRequest, 'type'>) =>
  p.type === 'INITIAL_PAYMENT_REFUND' || p.type === 'DEPOSIT_REFUND';
