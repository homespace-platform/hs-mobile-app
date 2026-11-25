export type RentalPaymentType = 'INITIAL_PAYMENT';

export type RentalPaymentStatus =
  | 'PENDING'
  | 'AWAITING_TRANSFER'
  | 'TRANSFER_REPORTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'PAID_MOCK'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface InitialPaymentSummary {
  id: string;
  type?: 'RESERVATION_DEPOSIT' | 'INITIAL';
  displayName?: string;
  confirmationDueAt?: string | null;
  status: RentalPaymentStatus;
  totalAmount: number;
  transferReference?: string | null;
  payerReportedAt?: string | null;
  bankTransactionReference?: string | null;
  dueAt?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  confirmedAt?: string | null;
  contractDueAt?: string | null;
  canCancelImmediately?: boolean;
}

export interface RentalPaymentResponse {
  id: string;
  rentalRequestId: string;
  listingId: string;
  renterId: string;
  ownerId: string;
  type: RentalPaymentType;
  status: RentalPaymentStatus;
  currency: string;
  monthlyRent: number;
  monthlyCharges: number;
  depositAmount: number;
  totalAmount: number;
  costBreakdownSnapshot?: string | null;
  excludedChargesSnapshot?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  contractDueAt?: string | null;
  provider?: string | null;
  providerTransactionId?: string | null;
  refundedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
