export type MonthlyInvoiceStatus =
  'DRAFT' | 'UNPAID' | 'OVERDUE' | 'PAID' | 'ROLLED_OVER' | 'CANCELLED';

export interface InvoiceLine {
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  quantityUnit?: 'ngày' | 'lần' | null;
}

export type OverdueActionType =
  | 'PAYMENT_REQUEST'
  | 'EXTENSION_PROPOSAL'
  | 'MUTUAL_TERMINATION_PROPOSAL'
  | 'LEGAL_REVIEW'
  | 'AUTOMATIC_ROLLOVER'
  | 'UNILATERAL_TERMINATION_NOTICE'
  | 'TERMINATION_REVIEW_REQUESTED'
  | 'TERMINATION_REVIEW_DECIDED'
  | 'TERMINATION_ENDED'
  | 'TERMINATION_HANDOVER';

export interface OverdueAction {
  id: string;
  type: OverdueActionType;
  note: string;
  proposedDate?: string;
  createdAt: string;
  createdBy: string;
  tenantAcknowledgment?: string;
  acknowledgedAt?: string;
}

export interface BillingPeriodView {
  kind: 'INITIAL_RENT' | 'RECURRING' | 'FINAL_SETTLEMENT' | 'SUPPLEMENT' | 'COSTS_ONLY';
  paymentPeriodNumber: number | null;
  rentPeriodStart: string | null;
  rentPeriodEndExclusive: string | null;
}

export interface MonthlyInvoice {
  billingPeriod?: BillingPeriodView;
  id: string;
  contractId: string;
  periodIndex: number;
  finalCostSupplement?: boolean;
  sourceInvoiceId?: string;
  periodStart: string;
  periodEndExclusive: string;
  status: MonthlyInvoiceStatus;
  electricityStart?: number;
  electricityEnd?: number;
  waterStart?: number;
  waterEnd?: number;
  lines: InvoiceLine[];
  totalAmount: number;
  paymentRequestId?: string;
  issuedAt?: string;
  dueAt?: string;
  paidAt?: string;
  lateFeeAmount: number;
  serverNow: string;
  meterDeadlineAt: string;
  workflowState:
    | 'CANCELLED'
    | 'UPCOMING'
    | 'METER_REQUIRED'
    | 'READY_FOR_ISSUE'
    | 'METER_DEADLINE_MISSED'
    | 'UNPAID'
    | 'PAYMENT_REMINDER'
    | 'OVERDUE'
    | 'OVERDUE_ACTION_REQUIRED'
    | 'UNDER_REVIEW'
    | 'PAID'
    | 'DEFERRED'
    | 'ROLLED_OVER'
    | 'EXTENSION_PENDING'
    | 'PAYMENT_EXTENDED';
  draftExtraCharges: { description: string; amount: number }[];
  overdueActions: OverdueAction[];
  deferredAt?: string;
  rolledToInvoiceId?: string;
  terminationProposedAt?: string;
  terminationProposalInvoiceId?: string;
  terminationAcceptedAt?: string;
  terminationDeclinedAt?: string;
  terminationCancelledAt?: string;
  terminationCompletedAt?: string;
  terminationForcedAt?: string;
  landlordTerminationClauseSigned: boolean;
  retainedDepositAmount?: number;
  originalDepositAmount?: number;
  canDeferToNextPeriod: boolean;
  originalDueAt?: string;
  lateFeeExempt: boolean;
  electricityAutoFilled: boolean;
  waterAutoFilled: boolean;
  paymentExtensions: PaymentExtension[];
  activeResolution: 'NONE' | 'EXTENSION_REQUEST' | 'PAYMENT_EXTENSION' | 'ROLLOVER' | 'TERMINATION';
  canRequestExtension: boolean;
  canResolveOverdue: boolean;
  unilateralTermination?: UnilateralTerminationNotice | null;
  canRequestTerminationReview?: boolean;
  canDecideTerminationReview?: boolean;
  canCompleteTerminationHandover?: boolean;
}

export interface UnilateralTerminationNotice {
  id: string;
  invoiceId: string;
  version: number;
  status: 'NOTICE' | 'REVIEW_REQUESTED' | 'REPLACED' | 'WITHDRAWN' | 'CANCELLED_PAID' | 'ENDED';
  reason: string;
  notifiedAt: string;
  respondBy: string;
  requestedOption?: 'ROLLOVER' | 'PAYMENT_EXTENSION';
  requestedDays?: number;
  requestReason?: string;
  requestedAt?: string;
  decidedAt?: string;
  decisionReason?: string;
  endedAt?: string;
  handoverAt?: string;
}

export interface PaymentExtension {
  id: string;
  days: number;
  note: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CLOSED';
  requestedAt: string;
  respondBy: string;
  requestedBy: string;
  baseDueAt: string;
  frozenLateFee: number;
  decidedAt?: string;
  decidedBy?: string;
  newDueAt?: string;
  lateFeeResumesAfterDue?: boolean | null;
}

export interface IssueMonthlyInvoicePayload {
  electricityEnd?: number;
  waterEnd?: number;
  extraCharges: { description: string; amount: number }[];
}
