// Port of hs-web-app lib/payment-transfer-presentation.ts (verbatim; only import paths changed).
import type { PaymentRequest } from '@/types/rental/payment-request.type';

/** The payment is the cash obligation; a rental quote is never a substitute for its allocation. */
export function paymentTransferPresentation(payment: PaymentRequest | null) {
  const refund = payment?.direction === 'LANDLORD_TO_TENANT';
  const total = payment?.totalAmount ?? 0;
  const titles: Partial<Record<PaymentRequest['type'], string>> = {
    RESERVATION_DEPOSIT: 'Tiền cọc giữ chỗ',
    INITIAL: 'Chi tiết tiền thuê tháng đầu / cọc',
    INITIAL_PAYMENT_REFUND: 'Chi tiết khoản hoàn',
    DEPOSIT_REFUND: 'Chi tiết hoàn tiền cọc',
    DEPOSIT_ADJUSTMENT: refund ? 'Hoàn chênh lệch cọc' : 'Nộp bổ sung cọc',
  };
  const fallbackName = refund
    ? payment?.type === 'DEPOSIT_REFUND' || payment?.type === 'DEPOSIT_ADJUSTMENT'
      ? 'Hoàn tiền cọc'
      : 'Hoàn khoản thanh toán đã nhận'
    : payment?.type === 'RESERVATION_DEPOSIT'
      ? 'Tiền cọc giữ chỗ'
      : 'Khoản thanh toán theo yêu cầu';
  const source = payment?.lineItems ?? [];
  const valid =
    source.length > 0 &&
    source.every((item) => Number.isFinite(item.amount) && item.amount >= 0) &&
    source.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) ===
      Math.round(total * 100);
  const rows = valid
    ? source
        .filter((item) => !refund || item.amount > 0)
        .map((item, index) => ({
          id: item.id || `line-${index}`,
          displayName: item.displayName,
          amount: item.amount,
        }))
    : [{ id: 'payment-total', displayName: fallbackName, amount: total }];
  return {
    refund,
    total,
    rows,
    detailed: valid,
    title: payment ? (titles[payment.type] ?? 'Chi tiết khoản chuyển') : 'Chi tiết khoản chuyển',
    recipient: refund ? 'người thuê' : 'chủ nhà',
    transferDescription: refund
      ? 'Chủ nhà hoàn trực tiếp cho người thuê'
      : 'Chuyển 100% trực tiếp cho chủ nhà',
  };
}
