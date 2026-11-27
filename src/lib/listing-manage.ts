// Pure rules of web "Quản lý tin đăng" (config/listing-status.config.ts and the properties pages).
import { formatVnDateTime } from '@/lib/membership';

type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';

const STATUSES: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Tin nháp', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Chờ duyệt', tone: 'warning' },
  PUBLISHED: { label: 'Đang hiển thị', tone: 'success' },
  RESERVED: { label: 'Đang giữ chỗ', tone: 'warning' },
  RENTED: { label: 'Đã cho thuê qua HomeSpace', tone: 'primary' },
  RENTED_EXTERNALLY: { label: 'Cho thuê ngoài hệ thống', tone: 'primary' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  HIDDEN: { label: 'Đã ẩn', tone: 'neutral' },
  VIOLATION: { label: 'Vi phạm', tone: 'danger' },
};

export const listingStatus = (status: string) => STATUSES[status] ?? STATUSES.DRAFT;

/** Label for the branch screens: an unknown status is "Đang cập nhật", never a draft. */
export const listingStatusLabel = (status: string) =>
  Object.prototype.hasOwnProperty.call(STATUSES, status) ? STATUSES[status].label : 'Đang cập nhật';

export const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PUBLISHED', label: 'Đang hiển thị' },
  { value: 'RESERVED', label: 'Đang giữ chỗ' },
  { value: 'RENTED', label: 'Đã cho thuê' },
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'DRAFT', label: 'Tin nháp' },
  { value: 'HIDDEN', label: 'Đã ẩn' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'RENTED_EXTERNALLY', label: 'Cho thuê ngoài' },
  { value: 'VIOLATION', label: 'Vi phạm' },
];

export type OwnerAction = {
  targetStatus: 'HIDDEN' | 'PUBLISHED' | 'RENTED_EXTERNALLY' | 'PENDING_REVIEW';
  label: string;
  /** Shown on the confirmation step. */
  title: string;
  description: string;
  icon: 'eye-off-outline' | 'eye-outline' | 'open-outline' | 'refresh-outline';
  tone: 'warning' | 'success' | 'primary';
  /** true: only while the publication window is open; false: only after it ended. */
  openWindow?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
};

const HIDE: OwnerAction = {
  targetStatus: 'HIDDEN',
  label: 'Ẩn tin',
  title: 'Ẩn tin đăng',
  description:
    'Tin sẽ không còn hiển thị với khách thuê nhưng vẫn được giữ lại. Bạn có thể hiện lại trong thời hạn hiển thị còn lại.',
  icon: 'eye-off-outline',
  tone: 'warning',
};

const RENTED_EXTERNALLY: OwnerAction = {
  targetStatus: 'RENTED_EXTERNALLY',
  label: 'Đã cho thuê ngoài hệ thống',
  title: 'Đánh dấu đã cho thuê ngoài hệ thống',
  description:
    'Dùng khi bạn tự tìm được khách thuê bên ngoài HomeSpace. Tin sẽ ngừng hiển thị công khai để tránh khách liên hệ thêm.',
  icon: 'open-outline',
  tone: 'primary',
  noteLabel: 'Ghi chú (không bắt buộc)',
  notePlaceholder: 'Ví dụ: Khách thuê tự liên hệ qua người quen, đã ký hợp đồng ngày 20/08...',
};

const AVAILABLE_AGAIN: OwnerAction = {
  targetStatus: 'PUBLISHED',
  label: 'Phòng trống, hiển thị lại',
  title: 'Hiển thị lại tin đăng',
  description:
    'Dùng khi phòng đã trống và bạn muốn cho thuê lại trên HomeSpace. Tin sẽ hiển thị ngay trong thời hạn còn lại.',
  icon: 'eye-outline',
  tone: 'success',
  openWindow: true,
};

const REPUBLISH: OwnerAction = {
  targetStatus: 'PUBLISHED',
  label: 'Hiển thị lại tin',
  title: 'Hiển thị lại tin đăng',
  description:
    'Tin sẽ hiển thị lại ngay với khách thuê, sử dụng thời hạn hiển thị còn lại mà không cần duyệt lại.',
  icon: 'eye-outline',
  tone: 'success',
  openWindow: true,
};

const RESUBMIT: OwnerAction = {
  targetStatus: 'PENDING_REVIEW',
  label: 'Gửi duyệt lại',
  title: 'Gửi tin đăng đi duyệt lại',
  description:
    'Tin sẽ được gửi tới quản trị viên. Sau khi được duyệt, thời hạn hiển thị sẽ được làm mới.',
  icon: 'refresh-outline',
  tone: 'warning',
};

/** Must stay in sync with web LISTING_OWNER_ACTIONS and the backend OWNER_TRANSITIONS. */
const OWNER_ACTIONS: Record<string, OwnerAction[]> = {
  PUBLISHED: [HIDE, RENTED_EXTERNALLY],
  HIDDEN: [
    REPUBLISH,
    RENTED_EXTERNALLY,
    {
      ...RESUBMIT,
      openWindow: false,
      description:
        'Thời hạn hiển thị đã hết. Gửi tin để quản trị viên duyệt lại và cấp thời hạn hiển thị mới.',
    },
  ],
  RENTED_EXTERNALLY: [
    AVAILABLE_AGAIN,
    {
      ...RESUBMIT,
      openWindow: false,
      description:
        'Xác nhận phòng đã trống và gửi quản trị viên duyệt lại để cấp thời hạn hiển thị mới.',
    },
  ],
  EXPIRED: [RESUBMIT],
  REJECTED: [RESUBMIT],
};

export function getListingOwnerActions(
  status: string,
  expiresAt?: string | null,
  now = Date.now()
) {
  const open = Boolean(expiresAt && new Date(expiresAt).getTime() > now);
  return (OWNER_ACTIONS[status] ?? []).filter(
    (action) => action.openWindow === undefined || action.openWindow === open
  );
}

// shortcut: the mobile editor only has forms for these; widen when it supports more categories.
const EDITOR_CATEGORIES = ['APARTMENT', 'HOUSE', 'ROOM'];

export const canDuplicateListing = (status: string, category: string) =>
  status !== 'VIOLATION' && EDITOR_CATEGORIES.includes(category);

export const canEditListing = (status: string, category: string) =>
  status !== 'RENTED_EXTERNALLY' && canDuplicateListing(status, category);

const CATEGORY_LABELS: Record<string, string> = {
  APARTMENT: 'Căn hộ',
  HOUSE: 'Nhà nguyên căn',
  OFFICE: 'Văn phòng',
  COMMERCIAL_SPACE: 'Mặt bằng',
  ROOM: 'Nhà trọ / Phòng',
};

export const listingCategoryLabel = (category: string) => CATEGORY_LABELS[category] ?? category;

export function formatListingAmount(amount: number) {
  if (!amount || amount <= 0) return 'Thỏa thuận';
  const short = (value: number) => value.toFixed(1).replace(/\.0$/, '');
  if (amount >= 1_000_000_000) return `${short(amount / 1_000_000_000)} tỷ`;
  if (amount >= 1_000_000) return `${short(amount / 1_000_000)} triệu`;
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

/** "dd/MM/yyyy" in Vietnam time, "—" when missing. */
export const formatListingDate = (iso?: string | null) =>
  formatVnDateTime(iso)?.split(' ')[1] ?? '—';

export function ownerDetailError(status?: number) {
  if (status === 404) return 'Tin đăng không tồn tại hoặc đã bị xóa.';
  if (status === 403) return 'Bạn không có quyền xem tin đăng này.';
  return 'Không thể tải thông tin bài đăng.';
}

/** For anyone else: a hidden listing (e.g. opened from an old appointment) answers 404. */
export function visitorDetailError(status?: number) {
  if (status === 404)
    return 'Tin đăng không còn hiển thị. Chủ tin có thể đã ẩn, gỡ hoặc đang chờ duyệt lại tin.';
  return 'Không tải được bài đăng. Vui lòng thử lại.';
}

/**
 * Whether a notification socket signal means listings may have changed: a (re)connect or push
 * (anything may have been missed) or a LISTING notice. `listingId` ignores other listings.
 */
export function isListingChangeSignal(socketEvent: string, payload?: unknown, listingId?: string) {
  if (socketEvent === 'connect' || socketEvent === 'notifications:changed') return true;
  if (socketEvent !== 'notification:new') return false;
  const item = payload as { category?: unknown; metadata?: { listingId?: unknown } } | undefined;
  if (item?.category !== 'LISTING') return false;
  const id = item.metadata?.listingId;
  return !listingId || typeof id !== 'string' || id === listingId;
}

/**
 * Which detail response may update the screen: one older than an applied one may not. A background
 * refresh that fails claims nothing, so the first load it overtook still counts.
 */
export function createApplyGate() {
  let issued = 0;
  let applied = 0;
  return {
    next: () => ++issued,
    /** Another listing is shown now: drop everything in flight. */
    reset: () => {
      applied = issued;
    },
    claim: (request: number) => {
      if (request <= applied) return false;
      applied = request;
      return true;
    },
  };
}
