// Port of the rules in hs-web-app lib/membership.ts, hooks/useMembershipPricing.ts and
// components/membership/*. Pure (type imports only), so tests load it on its own.
import type {
  MembershipOrder,
  MembershipPlan,
  MembershipQuote,
  MembershipView,
  PaidMembershipTier,
} from '@/services/membershipApi';

/**
 * Temporary: no new Sepolia order, quote or wallet transaction starts on mobile (the web keeps
 * ETH). A hash already saved on the device is still reconciled.
 */
export const MOBILE_ETH_PAYMENT_ENABLED: boolean = false;
export const MOBILE_ETH_DISABLED_MESSAGE = 'Tạm tắt trên ứng dụng, vui lòng thanh toán trên web';

/** Display text from the web `DEFAULT_MEMBERSHIP_PLANS`. Prices and uses come from the API. */
export type MembershipPlanInfo = MembershipPlan & {
  name: string;
  shortName: string;
  tagline: string;
  badge?: string;
};

const METADATA: Record<string, Omit<MembershipPlanInfo, keyof MembershipPlan>> = {
  FREE: {
    name: 'Gói Miễn Phí (Free)',
    shortName: 'Free',
    tagline: 'Dành cho chủ nhà mới bắt đầu trải nghiệm đăng tin trên HomeSpace',
  },
  STARTER: {
    name: 'Gói Khởi Đầu (Starter)',
    shortName: 'Starter',
    tagline: 'Phù hợp cho chủ nhà cá nhân có ít phòng hoặc căn hộ cho thuê',
  },
  PRO: {
    name: 'Gói Chuyên Nghiệp (Pro)',
    shortName: 'Pro',
    badge: 'Phổ biến nhất',
    tagline: 'Tối ưu cho chủ nhà quản lý khu trọ, dãy phòng hoặc nhiều căn hộ',
  },
  BUSINESS: {
    name: 'Gói Doanh Nghiệp (Business)',
    shortName: 'Business',
    badge: 'Quy mô lớn',
    tagline: 'Dành cho hệ thống tòa nhà, chuỗi căn hộ dịch vụ và đơn vị vận hành',
  },
};

const ORDER = ['FREE', 'STARTER', 'PRO', 'BUSINESS'];

// Only for the listing editor's quota dialog (the web hardcodes the same list there). The
// membership screen and Home never show these: without an API answer they show a retry.
const FALLBACK_NUMBERS: MembershipPlan[] = [
  { code: 'FREE', publicationUses: 3, durationDays: 30, priceVnd: 0 },
  { code: 'STARTER', publicationUses: 10, durationDays: 30, priceVnd: 49_000 },
  { code: 'PRO', publicationUses: 30, durationDays: 30, priceVnd: 129_000 },
  { code: 'BUSINESS', publicationUses: 100, durationDays: 30, priceVnd: 349_000 },
];

/** API numbers with display text, in web order; `null` => the web defaults. */
export function mergeMembershipPlans(apiPlans: MembershipPlan[] | null): MembershipPlanInfo[] {
  const source = apiPlans ?? FALLBACK_NUMBERS;
  return ORDER.flatMap((code) => {
    const plan = source.find((item) => item.code === code);
    return plan ? [{ ...plan, ...METADATA[code] }] : [];
  });
}

const vnNumber = (amount: number) => Math.round(amount).toLocaleString('vi-VN');

export function formatVndPrice(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 'Miễn phí';
  return `${vnNumber(amount)} ₫`;
}

export function formatExactVnd(amount: number) {
  return `${vnNumber(Number.isFinite(amount) ? Math.max(0, amount) : 0)} VNĐ`;
}

const TIER_RANK: Record<string, number> = { FREE: 0, STARTER: 1, PRO: 2, BUSINESS: 3, ADMIN: 99 };

export function isPaidMembershipTier(tier: unknown): tier is PaidMembershipTier {
  return tier === 'STARTER' || tier === 'PRO' || tier === 'BUSINESS';
}

export function isUnlimitedMembership(me: MembershipView | null, role?: string | null) {
  return Boolean(me?.unlimited) || me?.tier === 'ADMIN' || role?.trim().toUpperCase() === 'ADMIN';
}

/** "HH:mm dd/MM/yyyy" in Vietnam time (UTC+7, no DST); null for a missing or invalid date. */
export function formatVnDateTime(iso?: string | null) {
  const time = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(time)) return null;
  const [date, clock] = new Date(time + 7 * 3_600_000).toISOString().split('T');
  return `${clock.slice(0, 5)} ${date.split('-').reverse().join('/')}`;
}

export function getTierShortLabel(tier?: string | null) {
  const code = String(tier ?? '').toUpperCase();
  if (code === 'ADMIN') return 'ADMIN Unlimited';
  return METADATA[code]?.shortName ?? 'Free';
}

/** "Pro (30 lượt / 30 ngày)"; the numbers are left out until the plans are loaded. */
export function getTierLabel(tier?: string | null, plans?: MembershipPlanInfo[] | null) {
  if (String(tier ?? '').toUpperCase() === 'ADMIN') return 'Quản trị viên (Không giới hạn)';
  const name = getTierShortLabel(tier);
  const plan = plans?.find((item) => item.shortName === name);
  return plan ? `${name} (${plan.publicationUses} lượt / ${plan.durationDays} ngày)` : name;
}

/** Plan balance plus one-off extra uses. */
export function getPublishableUses(me: MembershipView | null) {
  return (me?.remainingUses ?? 0) + (me?.addonRemaining ?? 0);
}

/** Extra-use balance line; null when there is nothing to show. */
export function getAddonBalanceLabel(me: MembershipView | null) {
  if (!me || me.unlimited || (!me.addonRemaining && !me.addonReserved)) return null;
  const expiry = me.addonRemaining ? formatVnDateTime(me.addonExpiresAt) : null;
  return `Lượt mua thêm: ${me.addonRemaining ?? 0}${expiry ? ` (hạn gần nhất ${expiry})` : ''}`;
}

/** "Hồi lượt vào ..." for FREE users; null when the server sends no valid reset time. */
export function getQuotaResetLabel(me: MembershipView | null) {
  if (!me || me.unlimited || me.tier !== 'FREE') return null;
  const formatted = formatVnDateTime(me.quotaResetsAt);
  return formatted ? `Hồi lượt vào ${formatted}` : null;
}

type ErrorResponse = { status?: number; data?: Record<string, unknown> };
const errorResponse = (error: unknown) =>
  (error as { response?: ErrorResponse } | null | undefined)?.response;

/** Same matching as web: the backend refused a publication because no use is left. */
export function isListingQuotaExhaustedError(error: unknown) {
  const response = errorResponse(error);
  if (!response) return false;
  const data = response.data ?? {};
  const code = String(data.code).toUpperCase();
  const errorCode = String(data.errorCode ?? data.error ?? '').toUpperCase();
  const message = String(data.message ?? data.detail ?? '').toUpperCase();
  return (
    code === '4013' ||
    code === 'LISTING_QUOTA_EXHAUSTED' ||
    /QUOTA_EXHAUSTED|INSUFFICIENT_QUOTA/.test(errorCode) ||
    /LISTING_QUOTA_EXHAUSTED|NO PUBLICATION USES REMAIN/.test(message) ||
    (response.status === 409 && /QUOTA|HẾT LƯỢT|KHÔNG ĐỦ LƯỢT|LƯỢT ĐĂNG/.test(message))
  );
}

const errorCode = (error: unknown) => Number(errorResponse(error)?.data?.code);
const errorText = (error: unknown) =>
  String(errorResponse(error)?.data?.message ?? '').toUpperCase();

/** The quote refusal for a downgrade (4016) or for a same tier that still has uses (4082). */
export function isMembershipDowngradeError(error: unknown) {
  const code = errorCode(error);
  return code === 4016 || code === 4082 || errorText(error).includes('DOWNGRADE');
}

export function isMembershipPendingOrderError(error: unknown) {
  return errorCode(error) === 4018 || errorText(error).includes('CHECKOUT IS ALREADY PENDING');
}

const ERROR_MESSAGES: Record<number, string> = {
  4013: 'Bạn đã hết lượt đăng tin. Vui lòng mua thêm lượt, mua hoặc nâng cấp gói hội viên.',
  4014: 'Không tìm thấy thông tin giữ chỗ lượt đăng tin cho bài đăng này.',
  4015: 'Gói hội viên đã chọn không hợp lệ.',
  4016: 'Không thể hạ cấp khi gói còn hạn; chỉ mua lại cùng gói khi đã dùng hết lượt.',
  4017: 'Đơn hàng hội viên không còn đủ điều kiện kích hoạt.',
  4018: 'Bạn đang có một đơn thanh toán hội viên chờ xử lý (trong khung 15 phút). Vui lòng hoàn tất đơn đó hoặc đợi đơn hết hạn trước khi tạo đơn mới.',
  4019: 'Không tìm thấy đơn hàng hội viên này hoặc bạn không có quyền xem.',
};

export function getMembershipErrorMessage(
  error: unknown,
  fallback = 'Không thể thực hiện thao tác với gói hội viên. Vui lòng thử lại.'
) {
  const known = ERROR_MESSAGES[errorCode(error)];
  if (known) return known;
  const message = errorResponse(error)?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const failed = error as { isAxiosError?: boolean; message?: unknown } | null | undefined;
  if (failed?.isAxiosError && !errorResponse(error))
    return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
  // MetaMask rejects with plain objects that carry a message.
  return typeof failed?.message === 'string' && failed.message.trim() ? failed.message : fallback;
}

/**
 * UX-only mirror of the purchase rules; the backend decides. The server reports a paid tier only
 * while it is active, so no device clock is involved.
 */
export function getPlanBlockReason(target: string, me: MembershipView | null) {
  if (!me || me.unlimited || target === 'FREE' || me.tier === 'FREE') return undefined;
  if (TIER_RANK[target] < TIER_RANK[me.tier]) return 'Đang sử dụng gói cao hơn';
  if (target === me.tier && me.remainingUses > 0) return 'Mua lại được khi đã dùng hết lượt gói';
  return undefined;
}

export type PlanCardState = {
  isCurrent: boolean;
  /** `upgrade` is the 24h price-difference offer quoted by the server. */
  upgrade?: MembershipQuote;
  perUseCost: number;
  /** Line above the button (FREE reset time, ADMIN note). */
  note?: string;
  /** `buy` is the only pressable kind; the others are a static box with the reason. */
  kind: 'static' | 'blocked' | 'buy';
  label: string;
};

export function getPlanCardState(
  plan: MembershipPlanInfo,
  {
    membership,
    unlimited,
    quote,
    refusal,
  }: {
    membership: MembershipView | null;
    unlimited: boolean;
    quote?: MembershipQuote;
    /** Server message of a refused quote. */
    refusal?: string;
  }
): PlanCardState {
  const currentTier = membership?.tier ?? 'FREE';
  const isCurrent = !unlimited && currentTier === plan.code;
  const upgrade =
    quote &&
    !isCurrent &&
    (quote.upgrade || quote.mode === 'UPGRADE') &&
    quote.amountVnd < plan.priceVnd
      ? quote
      : undefined;
  const base = {
    isCurrent,
    upgrade,
    perUseCost:
      plan.priceVnd > 0 && plan.publicationUses > 0
        ? Math.round(plan.priceVnd / plan.publicationUses)
        : 0,
  };
  if (plan.code === 'FREE')
    return {
      ...base,
      note: unlimited ? undefined : (getQuotaResetLabel(membership) ?? undefined),
      kind: 'static',
      label: isCurrent
        ? `Đang áp dụng (còn ${membership?.remainingUses ?? plan.publicationUses} lượt)`
        : 'Gói mặc định trọn đời',
    };
  if (unlimited)
    return {
      ...base,
      note: 'ADMIN: đã có lượt không giới hạn.',
      kind: 'buy',
      label: `Kiểm thử mua gói ${plan.shortName}`,
    };
  const blocked = getPlanBlockReason(plan.code, membership) ?? refusal;
  if (blocked) return { ...base, kind: 'blocked', label: blocked };
  const label = isCurrent
    ? `Mua lại ${plan.shortName}`
    : upgrade
      ? `Nâng cấp chỉ ${formatVndPrice(upgrade.amountVnd)}`
      : TIER_RANK[plan.code] > TIER_RANK[currentTier] && currentTier !== 'FREE'
        ? `Nâng cấp lên ${plan.shortName}`
        : `Mua gói ${plan.shortName}`;
  return { ...base, kind: 'buy', label };
}

/** Web MembershipRules; the FREE numbers come from the API plan when it is loaded. */
export function membershipRules(free?: MembershipPlan) {
  const uses = free?.publicationUses ?? 3;
  const days = free?.durationDays || 30;
  return [
    {
      title: 'Khi nào trừ lượt đăng tin?',
      items: [
        'Tạo, lưu tin nháp và chỉnh sửa nội dung hoàn toàn miễn phí.',
        'Chỉ khi gửi duyệt tin mới hoặc đăng lại, gửi duyệt lại tin mới cần 1 lượt đăng khả dụng.',
      ],
    },
    {
      title: 'Tin đã đăng có bị ẩn khi gói hết hạn?',
      items: [
        'Không. Tin đang hiển thị vẫn công khai cho đến khi hết thời hạn hiển thị riêng của tin đó, kể cả khi gói hội viên đã hết hạn.',
      ],
    },
    {
      title: 'Nâng cấp trong 24 giờ đầu',
      items: [
        'Trong 24 giờ kể từ lần mua gói trả phí đầu tiên, nâng cấp lên gói cao hơn chỉ thanh toán phần chênh lệch giá.',
        'Lượt được tính lại từ đầu theo định mức gói mới. Tin đang chờ duyệt vẫn giữ lượt.',
      ],
    },
    {
      title: 'Đổi gói và mua lại',
      items: [
        'Các gói thay thế nhau, không cộng dồn. Sau 24 giờ đầu, mua gói mới tính nguyên giá và kết thúc lượt gói cũ chưa dùng.',
        'Chỉ mua lại cùng gói khi đã dùng hết lượt gói. Không hạ xuống gói thấp hơn khi gói hiện tại còn hạn.',
      ],
    },
    {
      title: 'Gói Free và lượt mua thêm',
      items: [
        `Gói Free dùng trọn đời: ${uses} lượt miễn phí, hồi lại mỗi ${days} ngày tính từ ngày tạo tài khoản, không cộng dồn.`,
        'Lượt gói được dùng trước lượt mua thêm. Lượt mua thêm có hạn dùng riêng và được giữ nguyên khi đổi gói.',
      ],
    },
  ];
}

const status = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

export const isOrderPaidStatus = (value?: string | null) =>
  ['PAID', 'SUCCEEDED', 'COMPLETED', 'SUCCESS'].includes(status(value));
export const isOrderReviewStatus = (value?: string | null) => status(value) === 'REVIEW';
export const isOrderCancelledStatus = (value?: string | null) =>
  ['CANCELLED', 'CANCELED'].includes(status(value));
export const isOrderFailedStatus = (value?: string | null) =>
  isOrderCancelledStatus(value) ||
  ['FAILED', 'EXPIRED', 'ERROR', 'REJECTED'].includes(status(value));
export const isOrderPendingStatus = (value?: string | null) =>
  !isOrderPaidStatus(value) && !isOrderFailedStatus(value) && !isOrderReviewStatus(value);
export const canCancelMembershipOrder = (order?: { id: string; status: string } | null) =>
  Boolean(order?.id) && status(order?.status) === 'PENDING';

export function getPaymentProviderDisplayName(provider?: string | null) {
  const code = status(provider);
  return code === 'SEPAY' ? 'SePay' : code === 'ETH' ? 'Sepolia ETH' : 'Cổng thanh toán';
}

export function getOrderProductLabel(
  order: Pick<MembershipOrder, 'kind' | 'tier' | 'quantity'>,
  plans?: MembershipPlanInfo[] | null
) {
  if (order.kind !== 'ADDON') return getTierLabel(order.tier, plans);
  return order.quantity ? `Mua thêm ${order.quantity} lượt đăng tin` : 'Mua thêm lượt đăng tin';
}

export function getOrderStatusPresentation(
  value?: string | null,
  provider?: string | null
): { label: string; tone: 'success' | 'danger' | 'warning'; description: string } {
  const name = getPaymentProviderDisplayName(provider);
  if (isOrderPaidStatus(value))
    return {
      label: 'Đã thanh toán & Kích hoạt',
      tone: 'success',
      description: `Hệ thống HomeSpace đã xác nhận giao dịch thành công từ ${name} và cập nhật lượt đăng tin cho tài khoản của bạn.`,
    };
  if (isOrderReviewStatus(value))
    return {
      label: 'Đang xử lý',
      tone: 'warning',
      description: `Đơn hàng đang được xử lý.`,
    };
  if (isOrderFailedStatus(value)) {
    const cancelled = isOrderCancelledStatus(value);
    return {
      label: cancelled
        ? 'Đã hủy thanh toán'
        : status(value) === 'EXPIRED'
          ? 'Đơn thanh toán hết hạn'
          : 'Thanh toán không thành công',
      tone: 'danger',
      description: cancelled
        ? `Đơn hàng trên HomeSpace đã được hủy và gói hội viên hiện tại không bị thay đổi. Bạn có thể khởi tạo giao dịch mới ngay.`
        : 'Giao dịch chưa hoàn tất hoặc đã hết thời gian thanh toán (15 phút). Gói hội viên hiện tại của bạn không bị thay đổi. Bạn có thể khởi tạo lại giao dịch mới bất cứ lúc nào.',
    };
  }
  return {
    label: 'Đang chờ xác nhận từ hệ thống',
    tone: 'warning',
    description: `Hệ thống đang kiểm tra kết quả giao dịch trực tiếp với máy chủ ${name}. Trạng thái thanh toán chỉ được xác nhận từ máy chủ HomeSpace.`,
  };
}

/** What to tell the user after a cancel request; the order may have finished first. */
export function getCancelOutcomeNotice(
  order: Pick<MembershipOrder, 'status' | 'provider' | 'kind'>
): { tone: 'info' | 'success' | 'warning'; message: string } {
  const name = getPaymentProviderDisplayName(order.provider);
  if (isOrderCancelledStatus(order.status))
    return {
      tone: 'info',
      message: `Đơn hàng trên HomeSpace đã được hủy. Bạn có thể tạo đơn thanh toán mới ngay. Lưu ý: thao tác này không hủy giao dịch phía ${name}.`,
    };
  if (isOrderPaidStatus(order.status))
    return {
      tone: 'success',
      message: `Đơn hàng đã được xác nhận thanh toán (PAID) trước khi yêu cầu hủy hoàn tất. ${
        order.kind === 'ADDON'
          ? 'Lượt mua thêm đã được cộng vào tài khoản.'
          : 'Gói hội viên của bạn đã được kích hoạt.'
      }`,
    };
  if (isOrderReviewStatus(order.status))
    return {
      tone: 'warning',
      message:
        'Đơn hàng đang được xử lý nên chưa thể hủy.',
    };
  if (isOrderFailedStatus(order.status))
    return {
      tone: 'warning',
      message:
        status(order.status) === 'EXPIRED'
          ? 'Đơn hàng đã hết hạn (EXPIRED) trước khi yêu cầu hủy hoàn tất. Bạn có thể tạo giao dịch mới ngay.'
          : 'Đơn hàng đã kết thúc ở trạng thái không thành công (FAILED) trước khi yêu cầu hủy hoàn tất. Bạn có thể tạo giao dịch mới ngay.',
    };
  return { tone: 'warning', message: 'Đơn hàng vẫn đang ở trạng thái chờ xử lý trên máy chủ.' };
}

/** Notification socket events after which this order must be read again (web "membership-changed"). */
export function isMembershipChangeSignal(socketEvent: string, payload?: unknown, orderId?: string) {
  if (socketEvent === 'connect' || socketEvent === 'notifications:changed') return true;
  if (socketEvent !== 'notification:new') return false;
  const item = payload as
    { category?: unknown; type?: unknown; metadata?: { orderId?: unknown } } | undefined;
  if (item?.category !== 'PAYMENT' || !String(item.type).startsWith('MEMBERSHIP_')) return false;
  const id = item.metadata?.orderId;
  return !orderId || typeof id !== 'string' || id === orderId;
}
