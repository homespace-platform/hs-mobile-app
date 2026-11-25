// Port of the rules in hs-web-app components/payment/DepositLedgerSummary.tsx:4-24.
import { numberVi } from '@/lib/rental/format';
import type { DepositLedger } from '@/types/rental/deposit-ledger.type';

export const money = (value?: number | null) =>
  value == null ? 'Chưa có dữ liệu' : numberVi(value) + ' đ';

export const labels: Record<string, string> = {
  PENDING: 'Chưa xác nhận nhận cọc',
  HELD: 'Đang giữ cọc',
  SETTLEMENT_PENDING: 'Chờ thống nhất quyết toán',
  RETAINED_BY_LANDLORD: 'Đã chốt giữ cọc',
  REFUND_DUE: 'Chờ hoàn cọc',
  REFUND_REPORTED: 'Đã báo hoàn · Chờ bên nhận xác nhận',
  REFUNDED: 'Đã xác nhận hoàn cọc',
};

/** "Không đặt cọc": nothing was ever received, so there is nothing to refund. */
export const isZeroDepositLedger = (ledger: DepositLedger) =>
  ledger.status === 'HELD' &&
  ledger.originalAmount === 0 &&
  ledger.confirmedReceivedAmount === 0 &&
  ledger.heldAmount === 0 &&
  (ledger.retainedAmount == null || ledger.retainedAmount === 0);

export const ledgerRows = (ledger: DepositLedger) =>
  [
    ['Cọc thực nhận đã xác nhận', ledger.confirmedReceivedAmount],
    ['Cọc còn đang giữ', ledger.heldAmount],
    ['Cọc đã chốt khấu trừ / giữ lại', ledger.retainedAmount],
    [
      ['REFUND_DUE', 'REFUND_REPORTED', 'REFUNDED'].includes(ledger.status)
        ? 'Cọc còn phải hoàn theo sổ'
        : 'Cọc có thể hoàn theo sổ (chưa chốt)',
      ledger.refundableAmount,
    ],
    ['Cọc đã hoàn, bên nhận đã xác nhận', ledger.confirmedRefundedAmount],
  ] as const;

/** Rendered after "Sổ cọc · ". */
export const ledgerStatusTitle = (ledger: DepositLedger) =>
  ledger.status === 'REFUNDED' && ledger.confirmedRefundedAmount == null
    ? 'Sổ ghi đã hoàn · Chưa đủ chứng từ'
    : (labels[ledger.status] ?? ledger.status);
