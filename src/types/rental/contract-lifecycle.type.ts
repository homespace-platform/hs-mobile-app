import type { ContractStatus } from './contract.type';
import type { DepositLedger } from './deposit-ledger.type';
import type { PaymentRequest } from './payment-request.type';
import type { PaymentStatus } from './payment-request.type';
import type { BillingPeriodView, MonthlyInvoiceStatus } from './monthly-invoice.type';
export interface ContractRenewal {
  id: string;
  months: number;
  status: 'REQUESTED' | 'APPROVED' | 'APPLIED' | 'REJECTED' | 'EXPIRED';
  startsOn: string;
  endExclusive: string;
  requestedAt: string;
  respondBy: string;
  signBy: string;
  agreementContractId?: string;
  agreementStatus?: ContractStatus;
  note: string;
  decidedAt?: string;
  appliedAt?: string;
}
export interface ClosureDeduction {
  description: string;
  amount: number;
  evidenceIds: string[];
}
export interface ClosureEvent {
  type: string;
  proposalVersion: number;
  at: string;
  actorId?: string;
  note?: string;
  deductions: ClosureDeduction[];
  refundAmount?: number;
  balanceAmount?: number;
  evidenceIds: string[];
}
export interface ContractClosure {
  complaintCaseId?: string;
  complaintOwnerApprovedAt?: string;
  status:
    'WAITING_HANDOVER' | 'PROPOSED' | 'DISPUTED' | 'REFUND_PENDING' | 'BALANCE_PENDING' | 'CLOSED';
  proposalVersion: number;
  electricityFinal?: number;
  waterFinal?: number;
  utilityAdjustment?: number;
  otherDeduction?: number;
  refundAmount?: number;
  balanceAmount?: number;
  note?: string;
  acceptedAt?: string;
  refundDueAt?: string;
  closedAt?: string;
  respondBy?: string;
  responseOverdueAt?: string;
  deductions?: ClosureDeduction[];
  history?: ClosureEvent[];
}
export interface ContractLifecycle {
  rentalRequestId?: string;
  deposit?: DepositLedger | null;
  serverNow: string;
  endExclusive: string;
  renewalOpensAt: string;
  renewalSignBy: string;
  canRequestRenewal: boolean;
  renewals: ContractRenewal[];
  closure?: ContractClosure;
  heldDeposit: number | null;
  canProposeClosure: boolean;
  refundPayment?: PaymentRequest;
  balancePayment?: PaymentRequest;
  earlyReturnPending?: boolean;
  billing: {
    allPaid: boolean;
    canIssueSupplement: boolean;
    bills: {
      id: string;
      periodIndex: number;
      finalCostSupplement: boolean;
      status: MonthlyInvoiceStatus;
      billingPeriod?: BillingPeriodView;
      paymentStatus?: PaymentStatus;
      /** Server verdict that the landlord may pick an overdue option now; absent on older backends. */ canResolveOverdue?: boolean;
      totalAmount: number;
      electricityEnd?: number;
      waterEnd?: number;
    }[];
  };
}
export interface ClosurePayload {
  electricityFinal?: number;
  waterFinal?: number;
  otherDeduction: number;
  note: string;
  vacantPossessionConfirmed: boolean;
  deductions: ClosureDeduction[];
  expectedProposalVersion: number;
}
export interface FinalCostsPayload {
  requestId: string;
  electricityEnd?: number;
  waterEnd?: number;
  extraCharges: { description: string; amount: number }[];
}
