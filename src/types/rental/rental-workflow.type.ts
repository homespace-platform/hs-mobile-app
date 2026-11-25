import type { PaymentRequest } from './payment-request.type';
export type WorkflowKind = 'cancellation' | 'early-exit';
export interface RentRefund {
  paymentId: string;
  amount: number;
}
export interface WorkflowProposal {
  reason?: string;
  endExclusive?: string;
  handoverTerms?: string;
  finalRentPolicy?: 'FULL_STARTED_PERIOD' | 'DAILY_PRORATED';
  rentRefunds?: RentRefund[];
  evidenceIds?: string[];
}
export interface RentalWorkflow {
  kind: string;
  status: string;
  revision: number;
  role: 'TENANT' | 'LANDLORD';
  contractId?: string;
  sourceRevisionId?: string;
  proposedBy?: string;
  serverNow: string;
  respondBy?: string;
  ownerConfirmedAt?: string;
  tenantConfirmedAt?: string;
  terminationOptions?: {
    currentEndExclusive: string;
    proposedLastOccupiedDay?: string;
    choices: { lastOccupiedDay: string; endExclusive: string }[];
  };
  proposal: WorkflowProposal;
  history: {
    revision: number;
    action: string;
    actorId: string;
    role: string;
    at: string;
    reason: string;
    proposal: WorkflowProposal;
    evidenceIds: string[];
  }[];
  allowedActions: string[];
  blockedReason?: string;
  complaintId?: string;
  depositObligation: string;
  refundPayments: PaymentRequest[];
  rentCalculation?: FinalRentCalculation;
}
export interface FinalRentCalculation {
  policy: string;
  periodStart: string;
  periodEndExclusive: string;
  agreedEndExclusive: string;
  usedDays: number;
  periodDays: number;
  monthlyRent: number;
  agreedFinalRent: number;
  requiredRefund: number;
  sourcePaymentId?: string;
  explanation: string;
}
export interface WorkflowDocument {
  signingContractId: string;
  sourceRevision: number;
  status: string;
  preparedAt: string;
  signedAt?: string;
  current: boolean;
}
export const workflowTitles: Record<WorkflowKind, string> = {
  cancellation: 'Xử lý cọc và ký trước khi thuê',
  'early-exit': 'Chấm dứt sớm theo thỏa thuận',
};
export const workflowStatuses: Record<string, string> = {
  EMPTY: 'Chưa lập',
  PROPOSED: 'Chờ phản hồi / xác nhận',
  APPROVED: 'Chủ nhà đã đồng ý · Chờ ký số phụ lục',
  AGREED: 'Đã áp dụng ngày kết thúc đã thống nhất',
  RETURNED: 'Hai bên đã xác nhận trả nhà',
  REFUND_PENDING: 'Đã đồng ý hủy · Chờ xác nhận hoàn tiền',
  COMPLETED: 'Đã hoàn tất ghi nhận',
  DISPUTED: 'Cần xử lý khiếu nại',
  REJECTED: 'Đề nghị chưa được đồng ý',
  WITHDRAWN: 'Đã rút đề nghị',
  RESUME_PROPOSED: 'Chờ bên còn lại đồng ý tiếp tục thuê',
  RESUMED: 'Hai bên đã đồng ý tiếp tục thuê',
};
export const workflowActions: Record<string, string> = {
  REQUEST_RESUME: 'Đề nghị tiếp tục thuê / ký',
  RESUME: 'Đồng ý tiếp tục thuê / ký',
  DECLINE_RESUME: 'Chưa đồng ý tiếp tục',
  WITHDRAW_RESUME: 'Rút đề nghị tiếp tục',
  PROPOSE: 'Lập / đề xuất bản mới',
  ACCEPT: 'Đồng ý nội dung đang xem',
  REJECT: 'Không đồng ý',
  WITHDRAW: 'Rút đề nghị',
  FULL_REFUND_EXIT: 'Kết thúc và hoàn toàn bộ tiền',
  REFUND_CONFIRMED: 'Đã xác nhận nhận đủ tiền hoàn',
  ESCALATE: 'Mở khiếu nại để xử lý',
  REPORT_ISSUE: 'Báo vấn đề / Mở khiếu nại',
  CONFIRM_RETURN: 'Xác nhận đã trả / nhận lại nhà',
};
export const workflowObligations: Record<string, string> = {
  COMPLETED: 'Đã hoàn tất quyết toán và nghĩa vụ tiền',
  DISPUTED: 'Khoản quyết toán đang được đối soát',
  RETURN_PENDING: 'Chờ hai bên xác nhận trả nhà',
  BILLS_PENDING: 'Cần hoàn tất hóa đơn cuối',
  RENT_REFUND_PENDING: 'Chờ thực nhận khoản hoàn tiền thuê',
  BALANCE_PENDING: 'Chờ nhận khoản quyết toán còn thiếu',
  REFUNDED: 'Đã xác nhận hoàn đủ tiền',
  REFUND_PENDING: 'Còn nghĩa vụ hoàn tiền',
  RESERVATION_PENDING: 'Giữ chỗ đang được theo dõi',
  TRANSFERRED_TO_LEASE: 'Nghĩa vụ giữ chỗ đã chuyển sang thuê',
  SETTLEMENT_PENDING: 'Cần hoàn tất hóa đơn và quyết toán cọc',
  LEASE_CONTINUES: 'Tiếp tục nghĩa vụ thuê đến khi đủ điều kiện kết thúc',
};
