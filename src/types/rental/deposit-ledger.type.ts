export interface DepositLedger {
  status: string;
  originalAmount?: number | null;
  heldAmount?: number | null;
  retainedAmount?: number | null;
  refundableAmount?: number | null;
  confirmedReceivedAmount?: number | null;
  confirmedRefundedAmount?: number | null;
  retainedAt?: string | null;
  retainedReason?: string | null;
}
