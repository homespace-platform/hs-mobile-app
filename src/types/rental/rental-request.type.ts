export type RentalRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED_BY_SYSTEM'
  | 'CANCELLED_BY_RENTER'
  | 'CANCELLED_BY_OWNER'
  | 'EXPIRED'
  | 'COMPLETED';

export interface CreateRentalRequestPayload {
  listingId: string;
  moveInDate: string; // "YYYY-MM-DD"
  leaseMonths: number;
  occupantCount?: number;
  motorbikeCount?: number;
  carCount?: number;
  renterName: string;
  renterPhone: string;
  renterEmail?: string;
  depositAmount?: number | null;
  negotiatedDepositAmount?: number | null;
  renterNote?: string;
  reservationPolicyAccepted: boolean;
  reservationPolicyVersion: string;
}

export interface RentalRequestResponse {
  id: string;
  listingId: string;
  listingTitle: string;
  listingAddress: string;
  listingThumbnail: string | null;
  listingPrice: number | null;
  ownerId: string;
  renterId: string;
  renterName: string;
  renterPhone: string;
  renterEmail: string | null;
  moveInDate: string;
  leaseMonths: number;
  occupantCount: number;
  motorbikeCount: number;
  carCount: number;
  monthlyRentPrice: number;
  effectiveMonthlyRent?: number | null;
  estimatedMonthlyCharges?: number | null;
  estimatedMonthlyTotal?: number | null;
  depositAmount: number | null;
  estimatedInitialTotal?: number | null;
  estimatedLeaseTotal?: number | null;
  costBreakdownSnapshot?: string | null;
  excludedChargesSnapshot?: string | null;
  renterNote: string | null;
  status: RentalRequestStatus;
  cancellationRefundPending?: boolean;
  rejectReason: string | null;
  acceptedAt: string | null;
  holdExpiresAt: string | null;
  respondBy?: string | null;
  initialPayment?: import('./rental-payment.type').InitialPaymentSummary | null;
  latestStartChange?:
    import('@/services/rental/rental-onboarding.service').RentalStartChange | null;
  createdAt: string;
  updatedAt: string;
}

export interface PredictableChargeItem {
  chargeType: string;
  displayName: string;
  billingMethod: string;
  unitAmount: number;
  quantity: number;
  amount: number;
  includedInRent: boolean;
  note: string;
}

export interface ExcludedChargeItem {
  chargeType: string;
  displayName: string;
  billingMethod: string;
  unitAmount?: number | null;
  reason: string;
}

export interface VehicleSlotEstimate {
  allowed: boolean;
  requested: number;
  capacity: number;
  reserved: number;
  available: number;
  monthlyAmount: number;
  note: string;
}

export interface RentalEstimatePayload {
  listingId: string;
  moveInDate: string;
  leaseMonths: number;
  occupantCount: number;
  motorbikeCount: number;
  carCount: number;
  negotiatedDepositAmount?: number | null;
}

export interface RentalEstimateResponse {
  listingId: string;
  occupantCount: number;
  occupantLimit: number | null;
  motorbike: VehicleSlotEstimate;
  car: VehicleSlotEstimate;
  effectiveMonthlyRent: number;
  predictableCharges: PredictableChargeItem[];
  predictableMonthlyChargesTotal: number;
  estimatedMonthlyTotal: number;
  depositAmount: number;
  estimatedInitialTotal: number;
  estimatedLeaseTotal: number;
  excludedCharges: ExcludedChargeItem[];
  disclaimer: string;
  paymentPlan?: {
    calculatedAt: string;
    businessDate: string;
    moveInDate: string;
    depositOnly: boolean;
    amountAfterApproval: number;
    firstRentAmount: number;
    firstRentOpensOn: string;
  } | null;
}

/** Một bài đăng có từ 2 yêu cầu thuê đang chờ duyệt cạnh tranh nhau (chủ nhà). */
export interface RentalRequestConflict {
  listingId: string;
  listingTitle: string;
  listingAddress: string | null;
  pendingCount: number;
  requestIds: string[];
}

export interface RentalReviewRow {
  requestId: string;
  renterName: string;
  rank: number;
  /** 0–100, do hệ thống chấm theo trọng số cố định. */
  score: number;
  breakdown: Record<string, number>;
  facts: {
    leaseMonths: number | null;
    occupantCount: number | null;
    moveInDate: string | null;
    depositAmount: number | null;
    monthlyRent: number | null;
    estimatedLeaseTotal: number | null;
    createdAt: string | null;
  };
  strengths: string[];
  weaknesses: string[];
}

export interface RentalReview {
  listingId: string;
  listingTitle: string | null;
  count: number;
  weights: Record<string, number>;
  recommendedRequestId: string;
  margin: number;
  closeCall: boolean;
  ranking: RentalReviewRow[];
  decisiveCriteria: string[];
  summary: string;
}

export interface RentalReviewAnswer {
  answer: string;
  status: 'ANSWERED' | 'GENERATION_UNAVAILABLE';
  review: RentalReview;
}

export interface RentalReviewTurn {
  role: 'user' | 'assistant';
  content: string;
}
