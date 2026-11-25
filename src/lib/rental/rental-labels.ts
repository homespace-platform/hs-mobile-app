// Port of hs-web-app lib/rental-labels.ts (toneClasses maps to the mobile theme tokens).
import type { NextAction, NextActionCode } from '@/services/rental/rental-onboarding.service';

/**
 * ONE place for the Vietnamese labels of the rental flow (request, contract, deposit agreement, next step).
 * Screens must use these instead of keeping their own maps, so the same state reads the same everywhere.
 */

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';
export type Role = 'LANDLORD' | 'TENANT';
export interface Labeled {
  label: string;
  tone: Tone;
}

const unknown = (status?: string | null): Labeled => ({
  label: status ? 'Đang cập nhật' : '—',
  tone: 'neutral',
});

const REQUEST: Record<string, Labeled> = {
  PENDING: { label: 'Chờ chủ nhà duyệt', tone: 'warning' },
  ACCEPTED: { label: 'Đã chấp thuận · đang giữ phòng', tone: 'info' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  COMPLETED: { label: 'Đã thuê thành công', tone: 'success' },
  CANCELLED_BY_RENTER: { label: 'Người thuê đã hủy', tone: 'neutral' },
  CANCELLED_BY_OWNER: { label: 'Chủ nhà đã hủy', tone: 'neutral' },
  CANCELLED_BY_SYSTEM: { label: 'Hệ thống đã hủy', tone: 'neutral' },
};
export const requestStatus = (status?: string | null): Labeled =>
  (status && REQUEST[status]) || unknown(status);

const CONTRACT: Record<string, Labeled> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Chờ xác nhận', tone: 'warning' },
  LANDLORD_SIGNATURE_PENDING: { label: 'Chờ chủ nhà ký', tone: 'warning' },
  TENANT_SIGNATURE_PENDING: { label: 'Chờ người thuê ký', tone: 'warning' },
  ACTIVE: { label: 'Đang hiệu lực', tone: 'success' },
  EXPIRED: { label: 'Hết thời hạn thuê', tone: 'info' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral' },
  TERMINATED: { label: 'Đã chấm dứt', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};
// A deposit agreement is generated already prepared, so DRAFT means "waiting for the landlord's signature".
const DEPOSIT: Record<string, Labeled> = {
  ...CONTRACT,
  DRAFT: { label: 'Chờ chủ nhà ký', tone: 'warning' },
  ACTIVE: { label: 'Đã ký đủ', tone: 'success' },
  EXPIRED: { label: 'Đã hết hiệu lực', tone: 'neutral' },
};
export const contractStatus = (
  status?: string | null,
  kind: 'LEASE' | 'DEPOSIT' = 'LEASE'
): Labeled => (status && (kind === 'DEPOSIT' ? DEPOSIT : CONTRACT)[status]) || unknown(status);

const PAYMENT: Record<string, Labeled> = {
  AWAITING_TRANSFER: { label: 'Chưa thanh toán', tone: 'warning' },
  TRANSFER_REPORTED: { label: 'Đã báo chuyển · chờ xác nhận', tone: 'info' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  REJECTED: { label: 'Chứng từ chưa được chấp nhận', tone: 'danger' },
  OVERDUE: { label: 'Đã quá hạn', tone: 'danger' },
  EXPIRED: { label: 'Đã hết hạn', tone: 'neutral' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};
/** Payment request status. Unknown/legacy values (e.g. the removed DISPUTED) read as a generic "Đang cập nhật". */
export const paymentStatus = (status?: string | null): Labeled =>
  (status && PAYMENT[status]) || unknown(status);

/** Theme-token classes for a tone (light and dark values come from global.css). */
export const toneClasses: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-primary-soft text-primary border-primary-border',
  warning: 'bg-warning-soft text-warning border-warning',
  success: 'bg-success-soft text-success border-success',
  danger: 'bg-danger-soft text-danger border-danger',
};

/** Sections of a rental / contract detail page. Every next step points at exactly one of them. */
export type DetailTab = 'overview' | 'sign' | 'payment' | 'end' | 'content' | 'history';
export const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'sign', label: 'Ký số & tài liệu' },
  { id: 'payment', label: 'Thanh toán & cọc' },
  { id: 'end', label: 'Hủy / kết thúc' },
  { id: 'content', label: 'Nội dung hợp đồng' },
  { id: 'history', label: 'Lịch sử' },
];

const TAB_OF: Record<NextActionCode, DetailTab> = {
  PAY_DEPOSIT: 'payment',
  CONFIRM_DEPOSIT: 'payment',
  REVIEW_PAYMENT: 'payment',
  PAY_FIRST_RENT: 'payment',
  FIRST_RENT_OVERDUE: 'payment',
  CONFIRM_FIRST_RENT: 'payment',
  SEND_REFUND: 'payment',
  CONFIRM_REFUND: 'payment',
  PREPARE_DEPOSIT_AGREEMENT: 'sign',
  SIGN_DEPOSIT_LANDLORD: 'sign',
  SIGN_DEPOSIT_TENANT: 'sign',
  PREPARE_LEASE: 'sign',
  LEASE_TEMPLATE_REQUIRED: 'sign',
  SIGN_LEASE_LANDLORD: 'sign',
  SIGN_LEASE_TENANT: 'sign',
  SIGNING_OVERDUE: 'sign',
  RESPOND_DEFAULT_NOTICE: 'end',
  DECIDE_CANCELLATION: 'end',
  RESOLUTION_IN_PROGRESS: 'end',
  WAIT_START: 'overview',
  NONE: 'overview',
};
const tabForNextAction = (code?: NextActionCode | null): DetailTab =>
  (code && TAB_OF[code]) || 'overview';

const COPY: Record<
  NextActionCode,
  Partial<Record<Role, string>> & { other?: string; hint?: string }
> = {
  PAY_DEPOSIT: {
    TENANT: 'Chuyển khoản tiền giữ chỗ',
    LANDLORD: 'Chờ người thuê chuyển khoản giữ chỗ',
    hint: 'Hoàn tất trước hạn để giữ phòng.',
  },
  CONFIRM_DEPOSIT: {
    LANDLORD: 'Xác nhận đã nhận tiền giữ chỗ',
    TENANT: 'Chờ chủ nhà xác nhận tiền giữ chỗ',
    hint: 'Chỉ xác nhận khi tiền đã vào tài khoản.',
  },
  REVIEW_PAYMENT: {
    LANDLORD: 'Kiểm tra khoản chuyển cần xử lý',
    TENANT: 'Chờ chủ nhà kiểm tra khoản chuyển',
    hint: 'Khoản chuyển bị từ chối hoặc quá hạn xác nhận.',
  },
  PREPARE_DEPOSIT_AGREEMENT: {
    other: 'Hệ thống đang chuẩn bị hợp đồng cọc',
    hint: 'Không cần chuyển thêm tiền. Trang sẽ tự cập nhật.',
  },
  SIGN_DEPOSIT_LANDLORD: {
    LANDLORD: 'Ký số hợp đồng cọc',
    TENANT: 'Chờ chủ nhà ký hợp đồng cọc',
    hint: 'Chủ nhà ký trước, người thuê ký sau.',
  },
  SIGN_DEPOSIT_TENANT: {
    TENANT: 'Ký số hợp đồng cọc',
    LANDLORD: 'Chờ người thuê ký hợp đồng cọc',
    hint: 'Quá hạn ký, chủ nhà có thể mở lại hạn.',
  },
  WAIT_START: {
    other: 'Chờ đến ngày bắt đầu thuê',
    hint: 'Tiền thuê tháng đầu và ký hợp đồng thuê sẽ mở vào ngày này.',
  },
  PAY_FIRST_RENT: {
    TENANT: 'Chuyển khoản tiền thuê tháng đầu',
    LANDLORD: 'Chờ người thuê chuyển tiền tháng đầu',
    hint: 'Không thu lại tiền cọc.',
  },
  FIRST_RENT_OVERDUE: {
    LANDLORD: 'Tiền tháng đầu đã quá hạn',
    TENANT: 'Tiền tháng đầu đã quá hạn',
    hint: 'Người thuê cần chuyển khoản sớm; chủ nhà có thể gửi thông báo xử lý.',
  },
  CONFIRM_FIRST_RENT: {
    LANDLORD: 'Xác nhận đã nhận tiền thuê tháng đầu',
    TENANT: 'Chờ chủ nhà xác nhận tiền tháng đầu',
  },
  PREPARE_LEASE: {
    other: 'Hệ thống đang soạn hợp đồng thuê',
    hint: 'Không cần chuyển tiền lần nữa. Hệ thống tự thử lại.',
  },
  LEASE_TEMPLATE_REQUIRED: {
    other: 'Chưa có mẫu hợp đồng phù hợp',
    hint: 'Vui lòng liên hệ hỗ trợ để được cấu hình mẫu.',
  },
  SIGN_LEASE_LANDLORD: {
    LANDLORD: 'Kiểm tra và ký số hợp đồng thuê',
    TENANT: 'Chờ chủ nhà ký hợp đồng thuê',
    hint: 'Chủ nhà ký trước, người thuê ký sau.',
  },
  SIGN_LEASE_TENANT: { TENANT: 'Ký số hợp đồng thuê', LANDLORD: 'Chờ người thuê ký hợp đồng thuê' },
  SIGNING_OVERDUE: {
    LANDLORD: 'Đã quá hạn ký hợp đồng',
    TENANT: 'Đã quá hạn ký — chờ chủ nhà xử lý',
    hint: 'Chủ nhà có thể mở lại hạn ký hoặc hủy hồ sơ.',
  },
  RESPOND_DEFAULT_NOTICE: {
    TENANT: 'Phản hồi thông báo quá hạn',
    LANDLORD: 'Chờ người thuê phản hồi thông báo',
    hint: 'Nếu hết hạn không hoàn tất, hệ thống hủy giữ phòng.',
  },
  DECIDE_CANCELLATION: {
    LANDLORD: 'Quyết định đề nghị hủy',
    TENANT: 'Chờ chủ nhà quyết định đề nghị hủy',
  },
  RESOLUTION_IN_PROGRESS: {
    other: 'Đang xử lý hồ sơ trước thuê',
    hint: 'Xem đề nghị và phản hồi ở mục Hủy / kết thúc.',
  },
  SEND_REFUND: {
    LANDLORD: 'Chuyển khoản hoàn tiền cho người thuê',
    TENANT: 'Chờ chủ nhà chuyển khoản hoàn tiền',
  },
  CONFIRM_REFUND: {
    TENANT: 'Xác nhận đã nhận tiền hoàn',
    LANDLORD: 'Chờ người thuê xác nhận nhận tiền hoàn',
    hint: 'Sau một khoảng thời gian không phản hồi, hệ thống sẽ tự xác nhận.',
  },
  NONE: {},
};

export interface NextActionView {
  title: string;
  hint?: string;
  /** True when the viewer must act now. */
  mine: boolean;
  tone: Tone;
  tab: DetailTab;
}
/** Wording of the server's next step for the person looking at the page. Returns null when nothing is pending. */
export function describeNextAction(
  next: NextAction | null | undefined,
  role: Role
): NextActionView | null {
  if (!next || next.code === 'NONE') return null;
  const copy = COPY[next.code] as (typeof COPY)[NextActionCode] | undefined; // an unknown code from a newer backend
  if (!copy) return null;
  const title = copy[role] ?? copy.other;
  if (!title) return null;
  const mine = next.actor === role;
  const waitingOnOther = next.actor !== role && next.actor !== 'SYSTEM' && next.actor !== 'NONE';
  return {
    title,
    hint: copy.hint,
    mine,
    tone: mine ? 'info' : waitingOnOther ? 'warning' : 'neutral',
    tab: tabForNextAction(next.code),
  };
}
