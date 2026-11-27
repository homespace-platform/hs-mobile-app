import type { ManagementSection } from '@/services/managementApi';

// Mirrors hs-web-app types/notification.type.ts + services/notification.service.ts.
export const NOTIFICATION_CATEGORIES = [
  'SYSTEM',
  'NEWS',
  'ACCOUNT',
  'LISTING',
  'APPOINTMENT',
  'RENTAL_REQUEST',
  'CONTRACT',
  'PAYMENT',
  'CHAT',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationFilterCategory = 'ALL' | NotificationCategory;

export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionPath: string | null;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: string;
  readAt: string | null;
};
export type NotificationFeedPage = {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

// Same tab list and order as the web notification center (CHAT is intentionally absent).
export const NOTIFICATION_FILTER_TABS: readonly {
  id: NotificationFilterCategory;
  label: string;
}[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'NEWS', label: 'Tin tức' },
  { id: 'LISTING', label: 'Tin đăng' },
  { id: 'CONTRACT', label: 'Hợp đồng' },
  { id: 'PAYMENT', label: 'Thanh toán' },
  { id: 'APPOINTMENT', label: 'Lịch hẹn' },
  { id: 'RENTAL_REQUEST', label: 'Yêu cầu thuê' },
  { id: 'ACCOUNT', label: 'Tài khoản' },
  { id: 'SYSTEM', label: 'Hệ thống' },
];

const CATEGORY_TAGS: Record<NotificationCategory, string> = {
  LISTING: 'Tin đăng',
  CONTRACT: 'Hợp đồng',
  PAYMENT: 'Thanh toán',
  APPOINTMENT: 'Lịch hẹn',
  RENTAL_REQUEST: 'Yêu cầu thuê',
  CHAT: 'Tin nhắn',
  ACCOUNT: 'Tài khoản',
  SYSTEM: 'Hệ thống',
  NEWS: 'Tin tức',
};

export type NotificationPreferenceItem = {
  category: NotificationCategory;
  push: boolean;
  email: boolean;
};

// Titles/descriptions mirror hs-web-app NOTIFICATION_CATEGORY_META (settingsTitle/settingsDescription).
export const NOTIFICATION_SETTINGS_META: Record<
  NotificationCategory,
  { title: string; description: string }
> = {
  LISTING: {
    title: 'Tin đăng cho thuê',
    description: 'Cập nhật trạng thái duyệt tin, hết hạn hiển thị và hoạt động tin đăng',
  },
  CONTRACT: {
    title: 'Hợp đồng thuê & Đặt cọc',
    description: 'Tiến độ tạo hợp đồng, ký số và phụ lục',
  },
  PAYMENT: {
    title: 'Thanh toán & Hóa đơn',
    description: 'Nhắc hạn tiền thuê, tiền cọc, hóa đơn hàng tháng và biên lai giao dịch',
  },
  APPOINTMENT: {
    title: 'Lịch hẹn xem nhà',
    description: 'Yêu cầu đặt lịch, xác nhận hoặc thay đổi lịch hẹn xem bất động sản',
  },
  RENTAL_REQUEST: {
    title: 'Yêu cầu thuê',
    description: 'Cập nhật yêu cầu thuê, giữ chỗ, hủy thuê, đổi ngày bắt đầu và tiếp tục thuê',
  },
  CHAT: {
    title: 'Tin nhắn trao đổi',
    description: 'Thông báo khi có tin nhắn mới từ chủ nhà hoặc khách thuê',
  },
  ACCOUNT: {
    title: 'Tài khoản & Bảo mật',
    description: 'Xác thực danh tính eKYC, bảo mật đăng nhập và cập nhật hồ sơ',
  },
  SYSTEM: {
    title: 'Hệ thống',
    description: 'Thông báo bảo trì, cập nhật tính năng và thông tin chung từ HomeSpace',
  },
  NEWS: { title: 'Tin tức', description: 'Bài viết và tin tức mới từ HomeSpace' },
};

// Same as web withDefaultPreferences: every category present (server order), missing channels default to enabled.
export function withDefaultPreferences(
  items: readonly Partial<NotificationPreferenceItem>[] | null | undefined
): NotificationPreferenceItem[] {
  const byCategory = new Map(
    Array.isArray(items) ? items.map((item) => [item.category, item]) : []
  );
  return NOTIFICATION_CATEGORIES.map((category) => {
    const existing = byCategory.get(category);
    return { category, push: existing?.push ?? true,
      // SYSTEM email is opt-in (default off); other categories' email is not offered yet.
      email: existing?.email ?? category !== 'SYSTEM',
    };
  });
}

// Product rule (web AGENTS.md): chat never shows in the bell/notification center. The service
// already omits it; this guards against a stray CHAT row reaching the list.
export const isVisibleNotification = (item: Pick<NotificationItem, 'category'>) =>
  item.category !== 'CHAT';

const ACTION_PATH_PATTERN = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/;

// Same-origin relative path only (blocks "//host", "/\host", "javascript:", whitespace, "..").
export function isSafeActionPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 500 &&
    ACTION_PATH_PATTERN.test(value) &&
    !value.includes('://') &&
    !/(^|\/)\.\.(\/|$|\?|#)/.test(value)
  );
}

export const getSafeActionPath = (value: unknown) =>
  isSafeActionPath(value) && !value.startsWith('/operations/') ? value : null;

export const isNotificationUnread = (item: Pick<NotificationItem, 'readAt'>) =>
  item.readAt === null || item.readAt === undefined;

// dd/MM/yyyy HH:mm
export function formatNotificationDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

const APPOINTMENT_TAGS: Record<string, string> = {
  BOOKING_REMINDER: 'Sắp đến lịch',
  BOOKING_REQUESTED: 'Đặt mới',
  BOOKING_CONFIRMED: 'Xác nhận',
  BOOKING_REJECTED: 'Từ chối',
  BOOKING_RESCHEDULE_REQUESTED: 'Đổi lịch',
  BOOKING_RESCHEDULE_APPROVED: 'Đổi lịch ✓',
  BOOKING_RESCHEDULE_REJECTED: 'Đổi lịch ×',
  BOOKING_CANCELLED: 'Đã hủy',
  BOOKING_COMPLETED: 'Hoàn tất',
  BOOKING_EXPIRED: 'Hết hạn',
};
const LISTING_TAGS: Record<string, string> = {
  LISTING_CREATED: 'Tạo tin',
  LISTING_UPDATED: 'Cập nhật',
  LISTING_APPROVED: 'Đã duyệt',
  LISTING_REJECTED: 'Từ chối',
  LISTING_EDIT_APPROVED: 'Sửa đã duyệt',
  LISTING_EDIT_REJECTED: 'Sửa bị từ chối',
  LISTING_EXPIRED: 'Hết hạn',
  SAVED_LISTING_UNAVAILABLE: 'Tin đã lưu ngừng hiển thị',
  SAVED_LISTING_UPDATED: 'Tin đã lưu có cập nhật',
};
const LISTING_STATUS_TAGS: Record<string, string> = {
  PENDING_REVIEW: 'Chờ duyệt',
  HIDDEN: 'Đã ẩn',
  VIOLATION: 'Vi phạm',
  RENTED_EXTERNALLY: 'Đã cho thuê',
};
const RENTAL_REQUEST_TAGS: Record<string, string> = {
  RENTAL_REQUEST_SUBMITTED: 'Yêu cầu mới',
  RENTAL_REQUEST_ACCEPTED: 'Chấp nhận',
  RENTAL_REQUEST_REJECTED: 'Từ chối',
  RENTAL_REQUEST_AUTO_REJECTED: 'Tự động từ chối',
  RENTAL_REQUEST_CANCELLED: 'Đã hủy',
  RENTAL_REQUEST_EXPIRED: 'Hết hạn',
  RENTAL_HOLD_EXPIRED: 'Hết hạn giữ chỗ',
  RENTAL_CANCELLATION_REQUESTED: 'Yêu cầu hủy',
  RENTAL_CANCELLATION_REFUND_PENDING: 'Chờ hoàn tiền',
  RENTAL_CANCELLATION_REJECTED: 'Từ chối hủy',
  RENTAL_CANCELLATION_WITHDRAWN: 'Rút yêu cầu hủy',
  RENTAL_CANCELLATION_DISPUTED: 'Tranh chấp hủy',
  RENTAL_START_CHANGE_REQUESTED: 'Đổi ngày',
  RENTAL_START_CHANGE_APPROVED: 'Đổi ngày ✓',
  RENTAL_START_CHANGE_REJECTED: 'Đổi ngày ×',
  RENTAL_START_CHANGE_WITHDRAWN: 'Rút đổi ngày',
  RENTAL_START_CHANGE_EXPIRED: 'Đổi ngày hết hạn',
  RENTAL_SIGNING_WINDOW_REOPENED: 'Mở lại ký',
  RENTAL_HOLD_EXTENDED: 'Gia hạn giữ chỗ',
  RENTAL_DEFAULT_NOTICE_ISSUED: 'Thông báo vi phạm',
  RENTAL_DEFAULT_DISPUTED: 'Tranh chấp vi phạm',
  RENTAL_REQUEST_CANCELLED_BY_SYSTEM: 'Hệ thống hủy',
  RENTAL_RESUME_REQUESTED: 'Yêu cầu tiếp tục',
  RENTAL_RESUMED: 'Đã tiếp tục',
  RENTAL_RESUME_REJECTED: 'Từ chối tiếp tục',
  RENTAL_RESUME_WITHDRAWN: 'Rút yêu cầu tiếp tục',
};
const ACCOUNT_TAGS: Record<string, string> = {
  KYC_VERIFIED: 'Đã xác minh',
  KYC_REJECTED: 'Cần xác minh lại',
  KYC_RETRY_REQUIRED: 'Thử lại xác minh',
  ACCOUNT_ROLE_CHANGED: 'Đổi vai trò',
  ACCOUNT_DISABLED: 'Đã vô hiệu hóa',
  ACCOUNT_ENABLED: 'Đã kích hoạt lại',
};
const PAYMENT_TAGS: Record<string, string> = {
  MEMBERSHIP_EXPIRING_SOON: 'Gói sắp hết hạn',
  MEMBERSHIP_EXPIRED: 'Gói hết hạn',
  PAYMENT_DUE_SOON: 'Sắp đến hạn',
  MEMBERSHIP_ACTIVATED: 'Kích hoạt gói',
  MEMBERSHIP_PAYMENT_REVIEW: 'Đang xử lý',
  PAYMENT_REQUEST_CREATED: 'Yêu cầu chuyển khoản',
  PAYMENT_OBLIGATION_OVERDUE: 'Khoản chuyển khoản quá hạn',
  PAYMENT_TRANSFER_REPORTED: 'Đã báo chuyển khoản',
  PAYMENT_RECEIPT_CONFIRMED: 'Đã xác nhận nhận',
  PAYMENT_RECEIPT_REJECTED: 'Chưa xác nhận',
  PAYMENT_REFUND_AUTO_CONFIRM_SOON: 'Sắp tự xác nhận hoàn tiền',
  PAYMENT_RECEIPT_AUTO_CONFIRM_SOON: 'Sắp tự xác nhận nhận tiền',
  PAYMENT_RECEIPT_AUTO_CONFIRMED: 'Đã tự xác nhận nhận tiền',
  INVOICE_METER_REMINDER: 'Nhắc chốt chỉ số',
  INVOICE_PAYMENT_REMINDER: 'Nhắc thanh toán',
  INVOICE_DRAFT_READY: 'Bản nháp hóa đơn',
  INVOICE_ISSUED: 'Đã phát hành',
  INVOICE_OVERDUE: 'Quá hạn',
  INVOICE_AMOUNT_UPDATED: 'Đổi số tiền',
  INVOICE_EXTENSION_REQUESTED: 'Xin gia hạn',
  INVOICE_EXTENSION_APPROVED: 'Gia hạn ✓',
  INVOICE_EXTENSION_REJECTED: 'Gia hạn ×',
  INVOICE_EXTENSION_EXPIRED: 'Gia hạn hết hạn',
  INVOICE_OVERDUE_ACTION_RECORDED: 'Xử lý quá hạn',
  INVOICE_OVERDUE_ACTION_ACKNOWLEDGED: 'Đã phản hồi quá hạn',
  INVOICE_DEFERRED: 'Cộng dồn nợ',
  INVOICE_ROLLED_OVER: 'Đã chuyển nợ',
  INVOICE_OVERDUE_ACTION_REQUIRED: 'Cần xử lý quá hạn',
};
const CONTRACT_TAGS: Record<string, string> = {
  AGREEMENT_REVIEW_READY: 'Văn bản để rà soát',
  AGREEMENT_SIGNING_TURN: 'Đến lượt ký',
  AGREEMENT_FULLY_SIGNED: 'Đủ chữ ký',
  AGREEMENT_SIGNATURE_NEEDS_REVIEW: 'Cần kiểm tra chữ ký',
  AGREEMENT_SIGNING_DUE_SOON: 'Sắp đến hạn ký',
  AMENDMENT_RESPONSE_NEEDED: 'Cần phản hồi phụ lục',
  AMENDMENT_DECIDED: 'Đã phản hồi phụ lục',
  AMENDMENT_WITHDRAWN: 'Đã rút đề nghị',
  AMENDMENT_EXPIRED: 'Đề nghị hết hạn',
  AMENDMENT_APPLIED: 'Phụ lục áp dụng',
  LEASE_RENEWAL_WINDOW_OPENED: 'Đến thời gian gia hạn',
  RENEWAL_REQUESTED: 'Yêu cầu gia hạn',
  RENEWAL_APPROVED: 'Gia hạn được duyệt',
  RENEWAL_REJECTED: 'Gia hạn bị từ chối',
  RENEWAL_EXPIRED: 'Gia hạn hết hạn',
  TERMINATION_APPROVED: 'Đồng ý · Chờ ký phụ lục',
  TERMINATION_RESPONSE_NEEDED: 'Cần phản hồi chấm dứt',
  TERMINATION_AGREED: 'Đã đồng ý chấm dứt',
  TERMINATION_DECLINED: 'Đã từ chối chấm dứt',
  TERMINATION_WITHDRAWN: 'Đã rút đề nghị',
  TERMINATION_NOTICE_ISSUED: 'Quyết định chấm dứt',
  TERMINATION_REVIEW_REQUESTED: 'Cần xem xét quyết định',
  TERMINATION_REVIEW_APPROVED: 'Đã đổi phương án',
  TERMINATION_NOTICE_CANCELLED: 'Đã rút quyết định',
  TERMINATION_ENDED: 'Hợp đồng chấm dứt',
  LEASE_EXPIRED: 'Hết thời hạn thuê',
  LEASE_RETURN_CONFIRMED: 'Xác nhận trả nhà',
  LEASE_RETURN_COMPLETED: 'Đã ghi nhận trả nhà',
  SETTLEMENT_RESPONSE_NEEDED: 'Cần phản hồi quyết toán',
  SETTLEMENT_DISPUTED: 'Cần đối soát quyết toán',
  SETTLEMENT_PROPOSAL_INVALIDATED: 'Cần lập lại quyết toán',
  SETTLEMENT_AGREED: 'Đã đồng ý quyết toán',
  SETTLEMENT_RESPONSE_OVERDUE: 'Quá hạn phản hồi quyết toán',
  SETTLEMENT_PAYMENT_OVERDUE: 'Cần kiểm tra khoản quyết toán',
  LEASE_CLOSED: 'Đã đóng hồ sơ quyết toán cọc',
};

const TYPE_TAGS: Partial<Record<NotificationCategory, Record<string, string>>> = {
  APPOINTMENT: APPOINTMENT_TAGS,
  RENTAL_REQUEST: RENTAL_REQUEST_TAGS,
  ACCOUNT: ACCOUNT_TAGS,
  PAYMENT: PAYMENT_TAGS,
  CONTRACT: CONTRACT_TAGS,
};

const has = (map: object, key: string) => Object.prototype.hasOwnProperty.call(map, key);

// Status badge text, same rules as web getNotificationTag.
export function getNotificationTag(
  item: Pick<NotificationItem, 'category' | 'type' | 'metadata'>
): string {
  const fallback = CATEGORY_TAGS[item.category] ?? CATEGORY_TAGS.SYSTEM;
  if (item.category === 'LISTING') {
    const status = item.metadata?.status;
    const tag =
      item.type === 'LISTING_STATUS_CHANGED'
        ? typeof status === 'string' && has(LISTING_STATUS_TAGS, status)
          ? LISTING_STATUS_TAGS[status]
          : undefined
        : has(LISTING_TAGS, item.type)
          ? LISTING_TAGS[item.type]
          : undefined;
    return tag ?? fallback;
  }
  const map = TYPE_TAGS[item.category];
  return map && has(map, item.type) ? map[item.type] : fallback;
}

export function getNotificationRecipientSideLabel(
  item: Pick<NotificationItem, 'category' | 'metadata'>
) {
  if (item.category !== 'APPOINTMENT' && item.category !== 'RENTAL_REQUEST') return null;
  if (item.metadata?.recipientSide === 'OWNER') return 'Vai trò chủ nhà';
  if (item.metadata?.recipientSide === 'RENTER') return 'Vai trò người thuê';
  return null;
}

export type NotificationTarget =
  | { kind: 'listing'; id: string; own: boolean }
  // `query` is kept for viewing schedules only: it names the appointment to open.
  | { kind: 'management'; section: ManagementSection; query?: string; orderId?: string }
  // Contracts/payments/invoices: the path does not say if the user is tenant or landlord.
  | { kind: 'management-choice'; tenant: ManagementSection; landlord: ManagementSection }
  | { kind: 'news' }
  | { kind: 'none' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONE: NotificationTarget = { kind: 'none' };

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

// Maps a web actionPath to an existing mobile screen; anything without a screen is { kind: 'none' }.
export function notificationTarget(actionPath: unknown): NotificationTarget {
  const safe = getSafeActionPath(actionPath);
  if (!safe) return NONE;
  const [beforeHash] = safe.split('#');
  const [pathname, query = ''] = beforeHash.split('?');
  const segments = pathname.split('/').filter(Boolean);
  const param = (name: string) => {
    const pair = query.split('&').find((part) => part.split('=')[0] === name);
    return pair ? decode(pair.slice(name.length + 1)) : '';
  };
  const [root, second, third] = segments;
  if (root === 'rent' && segments.length === 2) {
    const id = decode(second);
    return UUID.test(id) ? { kind: 'listing', id, own: false } : NONE;
  }
  if (root === 'news') return { kind: 'news' };
  if (root !== 'dashboard') return NONE;
  // The branch module's daily digest.
  if (second === 'branches' && segments.length === 2)
    return { kind: 'management', section: 'landlord-branches' };
  if (second === 'properties' && third === 'view' && segments.length === 3) {
    const id = param('id');
    return UUID.test(id) ? { kind: 'listing', id, own: true } : NONE;
  }
  // The membership page and its payment result; only a well-formed order id opens an order.
  if (
    second === 'membership' &&
    (segments.length === 2 || (segments.length === 3 && (third === 'return' || third === 'eth')))
  ) {
    const orderId = param('orderId');
    return {
      kind: 'management',
      section: 'landlord-membership',
      ...(/^[0-9a-f]{32}$/i.test(orderId) ? { orderId } : {}),
    };
  }
  if (second === 'viewing-schedules' && (segments.length === 2 || third === 'my-bookings'))
    return {
      kind: 'management',
      section: third ? 'tenant-appointments' : 'landlord-appointments',
      ...(query ? { query } : {}),
    };
  if (second === 'rental-requests' && (segments.length === 2 || third === 'my-requests'))
    return {
      kind: 'management',
      section: third ? 'tenant-requests' : 'landlord-requests',
    };
  if (second === 'contracts' && third)
    return {
      kind: 'management-choice',
      tenant: 'tenant-contracts',
      landlord: 'landlord-contracts',
    };
  if ((second === 'payments' && segments.length === 2) || (second === 'invoices' && third))
    return { kind: 'management-choice', tenant: 'tenant-payments', landlord: 'landlord-payments' };
  return NONE;
}
