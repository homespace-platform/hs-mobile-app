// Port of hs-web-app lib/rental-deposit-quick-view.ts (verbatim; only import paths changed).
import { paymentStatus } from '@/lib/rental/rental-labels';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

/** Current actionable receipt, not always the already-confirmed reservation deposit. */
export function selectOnboardingPayment(
  payments: PaymentRequest[],
  rentalRequestId: string,
  paymentId?: string | null
) {
  const incoming = payments.filter(
    (p) =>
      p.rentalRequestId === rentalRequestId &&
      p.direction === 'TENANT_TO_LANDLORD' &&
      ['RESERVATION_DEPOSIT', 'INITIAL'].includes(p.type)
  );
  if (paymentId) return incoming.find((p) => p.id === paymentId) ?? null;
  return (
    incoming.find((p) => p.type === 'INITIAL' && p.status === 'TRANSFER_REPORTED') ??
    incoming.find((p) => p.status === 'TRANSFER_REPORTED') ??
    incoming.find((p) => p.type === 'INITIAL') ??
    incoming[0] ??
    null
  );
}

export function paymentSummaryTitle(payment: RentalRequestResponse['initialPayment']) {
  if (payment?.displayName) return payment.displayName;
  return payment?.type === 'RESERVATION_DEPOSIT' ? 'Tiền cọc giữ chỗ' : 'Khoản thanh toán';
}

export function canReviewReservationReceipt(
  payment: PaymentRequest,
  actorId: string | null,
  isLandlord: boolean
) {
  return (
    isLandlord &&
    !!actorId &&
    actorId === payment.payeeId &&
    payment.direction === 'TENANT_TO_LANDLORD' &&
    ['RESERVATION_DEPOSIT', 'INITIAL'].includes(payment.type) &&
    payment.status === 'TRANSFER_REPORTED'
  );
}

export function reservationPaymentTitle(payment: PaymentRequest) {
  if (payment.type === 'INITIAL_PAYMENT_REFUND') return 'Khoản hoàn từ chủ nhà';
  if (payment.type === 'RESERVATION_DEPOSIT') return 'Tiền cọc giữ chỗ';
  return payment.lineItems?.some((line) => line.type === 'DEPOSIT')
    ? 'Cọc + tiền thuê tháng đầu'
    : 'Tiền thuê tháng đầu';
}

export function reservationPaymentStatus(payment: PaymentRequest) {
  if (
    payment.type === 'RESERVATION_DEPOSIT' &&
    payment.totalAmount === 0 &&
    payment.status === 'CONFIRMED'
  )
    return 'Miễn cọc · Không cần chuyển khoản';
  return paymentStatus(payment.status).label;
}
