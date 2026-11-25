// Port of the labels and formatters in hs-web-app components/contract/detail/ContractLifecyclePanel.tsx:20-24.
import { numberVi, vnDateTime } from '@/lib/rental/format';

export const dt = (value?: string) => (value ? vnDateTime(value) : '—');
export const money = (value?: number | null) =>
  value == null ? 'Chưa có dữ liệu' : numberVi(value) + ' đ';
export const renewalLabels = {
  REQUESTED: 'Chờ chủ nhà duyệt',
  APPROVED: 'Chờ ký văn bản gia hạn',
  APPLIED: 'Đã ký đủ · Đã áp dụng',
  REJECTED: 'Chủ nhà từ chối',
  EXPIRED: 'Đã hết hạn duyệt/ký',
};
export const closureLabels = {
  WAITING_HANDOVER: 'Chờ bàn giao và lập đề xuất',
  PROPOSED: 'Chờ người thuê xác nhận',
  DISPUTED: 'Chưa thống nhất · Cần đối soát',
  REFUND_PENDING: 'Chờ hoàn cọc',
  BALANCE_PENDING: 'Chờ thanh toán khoản còn thiếu',
  CLOSED: 'Đã hoàn tất xử lý tiền cọc',
};
export const eventLabels: Record<string, string> = {
  PROPOSED: 'Gửi đề xuất quyết toán',
  OWNER_APPROVED: 'Chủ nhà đồng ý đề xuất admin',
  LEGACY_PROPOSAL: 'Đề xuất trước khi bổ sung lịch sử',
  DISPUTED: 'Người thuê yêu cầu đối soát',
  ACCEPTED: 'Người thuê đồng ý quyết toán',
  COSTS_ADDED: 'Phát hành chi phí bổ sung · cần đối chiếu lại',
  RESPONSE_OVERDUE: 'Quá hạn phản hồi · cần xử lý',
  PAYMENT_OVERDUE: 'Quá hạn chuyển tiền',
  CLOSED: 'Hoàn tất quyết toán',
};
