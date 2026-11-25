export type ComplaintCategory =
  | 'DEPOSIT_SETTLEMENT'
  | 'HANDOVER'
  | 'CONDITION'
  | 'REPAIR'
  | 'TERMS'
  | 'TERMINATION'
  | 'SAFETY'
  | 'OTHER';
export interface ComplaintCase {
  id: string;
  rentalRequestId: string;
  contractId?: string;
  tenantId: string;
  landlordId: string;
  category: ComplaintCategory;
  reason: string;
  openedBy: string;
  openedAt: string;
  status: 'OPEN' | 'ESCALATED' | 'RESOLVED';
  stage: string;
  revision: number;
  respondBy?: string;
  responseDueFor?: string;
  overdue: boolean;
  assignedTo?: string;
  outcome?: 'RECORD_FINDING' | 'REVISE_SETTLEMENT';
  decision?: string;
  proposedBy?: string;
  proposalReason?: string;
  adminReviewCount: number;
  adminReviewLimit: number;
  finalClosed: boolean;
  sourceVersion?: number;
  tenantCompleted: boolean;
  landlordCompleted: boolean;
  allowedActions: string[];
  events: {
    revision: number;
    action: string;
    actorId: string;
    actorRole: string;
    reason: string;
    metadataJson?: string;
    occurredAt: string;
  }[];
  evidenceIds: string[];
  closingReason?: string;
  sources?: ComplaintWorkflowSource[];
  settlement?: {
    version: number;
    status: string;
    deduction: number | null;
    refund: number | null;
    balance: number | null;
    note: string;
    ownerApproved: boolean;
    accepted: boolean;
  };
}
export interface ComplaintAction {
  expectedRevision: number;
  reason: string;
  evidenceIds?: string[];
  outcome?: 'RECORD_FINDING';
  requestedFrom?: string;
}
export const complaintCategories: Record<ComplaintCategory, string> = {
  DEPOSIT_SETTLEMENT: 'Khấu trừ / quyết toán cọc',
  HANDOVER: 'Bàn giao nhà',
  CONDITION: 'Hiện trạng phòng',
  REPAIR: 'Sửa chữa',
  TERMS: 'Điều khoản hợp đồng',
  TERMINATION: 'Chấm dứt thuê',
  SAFETY: 'An toàn',
  OTHER: 'Vấn đề khác',
};
export const complaintStages: Record<string, string> = {
  WAITING_RESPONSE: 'Chờ bên còn lại phản hồi',
  DISCUSSING: 'Hai bên đang trao đổi',
  PROPOSAL_PENDING: 'Chờ phản hồi đề xuất',
  WAITING_ADMIN: 'Đã chuyển HomeSpace',
  UNDER_REVIEW: 'Admin đang xem xét',
  WAITING_INFO: 'Chờ bổ sung thông tin',
  FOLLOW_UP: 'Đã kết luận lần 1 · Hai bên tiếp tục trao đổi',
  AGREED: 'Hai bên đã thống nhất',
  WITHDRAWN: 'Người gửi đã đóng',
  CLOSED: 'Đã đóng hồ sơ',
};
export const complaintActions: Record<string, string> = {
  OPENED: 'Mở khiếu nại',
  COMMENT: 'Phản hồi / bổ sung chứng cứ',
  PROPOSE: 'Đề xuất thỏa thuận',
  ACCEPT: 'Đồng ý thỏa thuận',
  DECLINE: 'Chưa đồng ý',
  ESCALATE: 'Chuyển HomeSpace',
  WITHDRAW: 'Đóng khiếu nại',
  REOPEN: 'Mở lại có lý do',
  CLAIM: 'Tiếp nhận xử lý',
  REQUEST_INFO: 'Yêu cầu bổ sung',
  DECIDE: 'Ghi kết luận',
  CLOSE: 'Đã giải quyết · Đóng hồ sơ',
  CONFIRM_COMPLETE: 'Xác nhận đã thực hiện',
  REJECT_DECISION: 'Đề nghị admin xem xét lại',
  APPROVE_SETTLEMENT: 'Đồng ý đề xuất quyết toán của admin',
  FOLLOW_UP_PAYMENT: 'Theo dõi nghĩa vụ thanh toán',
  COMPLETED: 'Hoàn tất nghĩa vụ theo kết luận',
  FINALIZED: 'Đóng hồ sơ sau hai kết luận admin',
  SOURCE_DISPUTED: 'Phản đối phiên bản quyết toán mới',
  SOURCE_ATTACHED: 'Gắn biên bản / thỏa thuận làm căn cứ',
};
export function complaintEventContext(metadata?: string): {
  agreement?: string;
  deduction?: number;
  version?: number;
  evidenceIds: string[];
} {
  try {
    const value: unknown = JSON.parse(metadata ?? '{}');
    if (!value || typeof value !== 'object') return { evidenceIds: [] };
    const data = value as Record<string, unknown>,
      settlement = data.settlement as Record<string, unknown> | undefined;
    return {
      agreement: typeof data.agreement === 'string' ? data.agreement : undefined,
      deduction:
        typeof settlement?.otherDeduction === 'number' && Number.isFinite(settlement.otherDeduction)
          ? settlement.otherDeduction
          : undefined,
      version: typeof data.proposalVersion === 'number' ? data.proposalVersion : undefined,
      evidenceIds: Array.isArray(data.evidenceIds)
        ? data.evidenceIds.filter((id): id is string => typeof id === 'string' && id.length <= 36)
        : [],
    };
  } catch {
    return { evidenceIds: [] };
  }
}

export interface ComplaintWorkflowSource {
  workflowId: string;
  kind: string;
  revision: number;
  contractId?: string;
  sourceRevisionId?: string;
  status: string;
  capturedAt: string;
  contentHash?: string;
  ownerConfirmedAt?: string;
  tenantConfirmedAt?: string;
  proposal: Record<string, unknown>;
  evidenceIds: string[];
  rentCalculation?: {
    policy: string;
    usedDays: number;
    periodDays: number;
    monthlyRent: number;
    agreedFinalRent: number;
    requiredRefund: number;
  };
  documents?: {
    storageObjectId: string;
    signingContractId: string;
    purpose: string;
    sourceRevision: number;
    signedAt?: string;
  }[];
  history: {
    revision: number;
    action: string;
    actorId: string;
    role: string;
    at: string;
    reason: string;
    evidenceIds: string[];
  }[];
}
