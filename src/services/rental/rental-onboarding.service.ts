import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

export interface RentalStartChange {
  id: string;
  previousDate: string;
  requestedDate: string;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED';
  requestedAt: string;
  respondBy: string;
  decidedAt?: string;
  responseNote?: string;
}
/** Single next step of the pre-tenancy flow, computed by the server (`nextAction` on the onboarding view). */
export type NextActionCode =
  | 'PAY_DEPOSIT'
  | 'CONFIRM_DEPOSIT'
  | 'REVIEW_PAYMENT'
  | 'PREPARE_DEPOSIT_AGREEMENT'
  | 'SIGN_DEPOSIT_LANDLORD'
  | 'SIGN_DEPOSIT_TENANT'
  | 'WAIT_START'
  | 'PAY_FIRST_RENT'
  | 'FIRST_RENT_OVERDUE'
  | 'CONFIRM_FIRST_RENT'
  | 'PREPARE_LEASE'
  | 'LEASE_TEMPLATE_REQUIRED'
  | 'SIGN_LEASE_LANDLORD'
  | 'SIGN_LEASE_TENANT'
  | 'SIGNING_OVERDUE'
  | 'RESPOND_DEFAULT_NOTICE'
  | 'DECIDE_CANCELLATION'
  | 'RESOLUTION_IN_PROGRESS'
  | 'SEND_REFUND'
  | 'CONFIRM_REFUND'
  | 'NONE';
export interface NextAction {
  actor: 'LANDLORD' | 'TENANT' | 'SYSTEM' | 'NONE';
  code: NextActionCode;
  dueAt?: string | null;
}
export interface RentalOnboarding {
  /** Absent when the backend is older than the nextAction release. */
  nextAction?: NextAction | null;
  serverNow: string;
  timezone: string;
  stage: string;
  startsOn: string;
  endExclusive: string;
  originalEndExclusive?: string;
  leaseTermSource?: 'EARLY_EXIT' | 'SIGNED_ADJUSTMENT' | null;
  paymentOpensAt: string;
  paymentDueAt?: string;
  signingDueAt?: string;
  canPrepareContract: boolean;
  canSign: boolean;
  canRequestEarlierStart: boolean;
  holdMinutes: number;
  payments: PaymentRequest[];
  startChanges: RentalStartChange[];
  message: string;
  askerRole: 'LANDLORD' | 'TENANT';
  cancellationRequestedAt?: string;
  cancellationReason?: string;
  canRequestCancellation?: boolean;
  depositAgreementContractId?: string | null;
  depositAgreementStatus?: string | null;
  depositAgreementRequired?: boolean;
  depositAgreementTenantSigned?: boolean;
  deposit?: import('@/types/rental/deposit-ledger.type').DepositLedger | null;
  defaultCase?: {
    eligibleKind?: 'FIRST_RENT' | 'TENANT_SIGNING';
    notifiedAt?: string;
    respondBy?: string;
    reason?: string;
    disputedAt?: string;
    completedAt?: string;
    canComplete: boolean;
    policyVersion?: string;
    automatic?: boolean;
  };
  history: { id: string; occurredAt: string; action: string; note?: string }[];
}
const base = (id: string) => `/api/v1/rental-requests/${id}/onboarding`;
export const rentalOnboardingService = {
  async notifyDefault(id: string, reason: string) {
    return (
      await axiosClient.post<ApiResponse<RentalOnboarding>>(`${base(id)}/default-notice`, {
        reason,
      })
    ).data.result;
  },
  async disputeDefault(id: string, reason: string) {
    return (
      await axiosClient.post<ApiResponse<RentalOnboarding>>(`${base(id)}/default-dispute`, {
        reason,
      })
    ).data.result;
  },
  async completeDefault(id: string, reason: string) {
    return (
      await axiosClient.post<ApiResponse<RentalOnboarding>>(`${base(id)}/default-completion`, {
        reason,
        tenantNotified: true,
        vacantPossessionConfirmed: true,
      })
    ).data.result;
  },
  /** Read-only twin of refresh (no server-side sync or row lock): use it for polling and list views. */
  async get(id: string) {
    return (await axiosClient.get<ApiResponse<RentalOnboarding>>(base(id))).data.result;
  },
  async refresh(id: string) {
    return (await axiosClient.post<ApiResponse<RentalOnboarding>>(`${base(id)}/refresh`)).data
      .result;
  },
  async request(id: string, startsOn: string, reason: string) {
    return (
      await axiosClient.post<ApiResponse<RentalOnboarding>>(`${base(id)}/earlier-start`, {
        startsOn,
        reason,
      })
    ).data.result;
  },
  async decide(id: string, changeId: string, approve: boolean) {
    return (
      await axiosClient.put<ApiResponse<RentalOnboarding>>(
        `${base(id)}/earlier-start/${changeId}`,
        { approve }
      )
    ).data.result;
  },
  async withdraw(id: string, changeId: string) {
    return (
      await axiosClient.delete<ApiResponse<RentalOnboarding>>(
        `${base(id)}/earlier-start/${changeId}`
      )
    ).data.result;
  },
  async cancel(id: string, reason: string) {
    return (
      await axiosClient.post<ApiResponse<RentalOnboarding>>(`${base(id)}/cancellation`, { reason })
    ).data.result;
  },
  async reopenSigning(id: string, reason: string) {
    return (
      await axiosClient.post<ApiResponse<RentalOnboarding>>(`${base(id)}/reopen-signing`, {
        reason,
      })
    ).data.result;
  },
  async decideCancel(id: string, approve: boolean) {
    return (
      await axiosClient.put<ApiResponse<RentalOnboarding>>(`${base(id)}/cancellation`, { approve })
    ).data.result;
  },
  async review(id: string, paymentId: string, received: boolean, reason: string) {
    return (
      await axiosClient.put<ApiResponse<RentalOnboarding>>(
        `${base(id)}/payments/${paymentId}/review`,
        { received, reason }
      )
    ).data.result;
  },
};
