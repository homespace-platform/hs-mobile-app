import type { MembershipPlan, MembershipView } from '@/services/membershipApi';

/** Display metadata ported from the web `DEFAULT_MEMBERSHIP_PLANS`. Numbers come from the API. */
export type MembershipPlanInfo = MembershipPlan & {
  name: string;
  shortName: string;
  tagline: string;
  /** Placeholders {uses} {days} {perUse} are filled from the plan numbers. */
  features: string[];
  badge?: string;
  isPopular?: boolean;
};

const SAVE_DRAFT = 'Lưu tin nháp và chỉnh sửa bài đăng miễn phí không giới hạn';
const KEEP_VISIBLE = 'Tin đã duyệt vẫn hiển thị đủ thời hạn riêng ngay cả khi gói hết hạn';

const METADATA: Record<string, Omit<MembershipPlanInfo, keyof MembershipPlan>> = {
  FREE: {
    name: 'Gói Miễn Phí (Free)',
    shortName: 'Free',
    tagline: 'Dành cho chủ nhà mới bắt đầu trải nghiệm đăng tin trên HomeSpace',
    features: [
      '{uses} lượt đăng tin dùng một lần (không giới hạn thời hạn kích hoạt)',
      'Tạo và lưu tin nháp, chỉnh sửa nội dung hoàn toàn miễn phí',
      'Tin đã hiển thị được giữ nguyên tới khi hết hạn riêng của bài đăng',
    ],
  },
  STARTER: {
    name: 'Gói Khởi Đầu (Starter)',
    shortName: 'Starter',
    tagline: 'Phù hợp cho chủ nhà cá nhân có ít phòng hoặc căn hộ cho thuê',
    features: [
      '{uses} lượt đăng mới hoặc đăng lại tin trong {days} ngày',
      SAVE_DRAFT,
      'Hỗ trợ nâng cấp lên Pro / Business chỉ tính chênh lệch giá trong 24h đầu',
      KEEP_VISIBLE,
    ],
  },
  PRO: {
    name: 'Gói Chuyên Nghiệp (Pro)',
    shortName: 'Pro',
    tagline: 'Tối ưu cho chủ nhà quản lý khu trọ, dãy phòng hoặc nhiều căn hộ',
    badge: 'Phổ biến nhất',
    isPopular: true,
    features: [
      '{uses} lượt đăng mới hoặc đăng lại tin trong {days} ngày',
      'Tiết kiệm chi phí trên mỗi lượt đăng tin (~{perUse} ₫/lượt)',
      SAVE_DRAFT,
      'Hỗ trợ nâng cấp lên Business chỉ tính chênh lệch giá trong 24h đầu',
      KEEP_VISIBLE,
    ],
  },
  BUSINESS: {
    name: 'Gói Doanh Nghiệp (Business)',
    shortName: 'Business',
    tagline: 'Dành cho hệ thống tòa nhà, chuỗi căn hộ dịch vụ và đơn vị vận hành',
    badge: 'Quy mô lớn',
    features: [
      '{uses} lượt đăng mới hoặc đăng lại tin trong {days} ngày',
      'Mức phí tốt nhất chỉ {perUse} ₫ cho mỗi lượt đăng tin',
      SAVE_DRAFT,
      'Đáp ứng nhu cầu xoay vòng phòng trống và đăng lại tin liên tục',
      KEEP_VISIBLE,
    ],
  },
};

const ORDER = ['FREE', 'STARTER', 'PRO', 'BUSINESS'];

// Only used when GET /membership/plans fails (values copied from the web defaults).
const FALLBACK_NUMBERS: MembershipPlan[] = [
  { code: 'FREE', publicationUses: 3, durationDays: 0, priceVnd: 0 },
  { code: 'STARTER', publicationUses: 10, durationDays: 30, priceVnd: 49_000 },
  { code: 'PRO', publicationUses: 30, durationDays: 30, priceVnd: 129_000 },
  { code: 'BUSINESS', publicationUses: 100, durationDays: 30, priceVnd: 349_000 },
];

/** Merge API numbers with display metadata by `code`; null/empty API result => web defaults. */
export function mergeMembershipPlans(apiPlans: MembershipPlan[] | null): MembershipPlanInfo[] {
  const source = apiPlans?.length ? apiPlans : FALLBACK_NUMBERS;
  return ORDER.flatMap((code) => {
    const plan = source.find((item) => item.code === code);
    return plan ? [{ ...plan, ...METADATA[code] }] : [];
  });
}

export function planFeatures(plan: MembershipPlanInfo) {
  const perUse = plan.publicationUses
    ? Math.round(plan.priceVnd / plan.publicationUses).toLocaleString('vi-VN')
    : '0';
  return plan.features.map((feature) =>
    feature
      .replace('{uses}', String(plan.publicationUses))
      .replace('{days}', String(plan.durationDays))
      .replace('{perUse}', perUse)
  );
}

export function formatVndPrice(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 'Miễn phí';
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

const TIER_RANK: Record<string, number> = { FREE: 0, STARTER: 1, PRO: 2, BUSINESS: 3, ADMIN: 99 };

export function isUnlimitedMembership(me: MembershipView | null, role?: string | null) {
  return Boolean(me?.unlimited) || me?.tier === 'ADMIN' || role?.trim().toUpperCase() === 'ADMIN';
}

export type PlanCardStatus = {
  /** Highlight the card as the plan in use. */
  current: boolean;
  kind: 'info' | 'unlimited' | 'purchase';
  label: string;
};

/** Mirrors the web `getCardState` + `MembershipPlanCard` footer (no server quotes on mobile). */
export function planCardStatus(
  plan: MembershipPlanInfo,
  me: MembershipView | null,
  unlimited: boolean
): PlanCardStatus {
  const free = plan.code === 'FREE';
  const tier = me?.tier ?? 'FREE';
  const expired = Boolean(me?.expiresAt) && new Date(me!.expiresAt!).getTime() <= Date.now();
  const current = !unlimited && tier === plan.code && (free || !expired);
  if (free) {
    return {
      current,
      kind: 'info',
      label:
        tier === 'FREE' && !unlimited
          ? `Đang áp dụng (Còn ${me?.remainingUses ?? 3} lượt)`
          : 'Gói khởi đầu mặc định',
    };
  }
  if (unlimited) return { current, kind: 'unlimited', label: 'ADMIN: Đã có lượt không giới hạn' };
  if (!expired && tier !== 'FREE' && TIER_RANK[plan.code] < TIER_RANK[tier])
    return { current, kind: 'info', label: 'Đang sử dụng gói cao hơn' };
  const action = current
    ? `Mua lại / Gia hạn ${plan.shortName}`
    : TIER_RANK[plan.code] > TIER_RANK[tier] && tier !== 'FREE'
      ? `Nâng cấp lên ${plan.shortName}`
      : `Mua gói ${plan.shortName}`;
  return { current, kind: 'purchase', label: action };
}
