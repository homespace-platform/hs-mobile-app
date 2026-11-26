import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export type MembershipPlan = {
  code: string;
  publicationUses: number;
  durationDays: number;
  priceVnd: number;
};

export async function getMembershipPlans() {
  const response = await axiosClient.get<ApiResponse<MembershipPlan[]>>('/api/v1/membership/plans');
  return response.data.result ?? [];
}

export type MembershipView = {
  tier: string;
  remainingUses: number;
  reservedUses: number;
  expiresAt: string | null;
  unlimited: boolean;
  // Absent when the server omits them; `remainingUses` above is the plan balance only.
  freeUsed?: number;
  /** Next FREE refill (ISO instant); only set while tier is FREE. */
  quotaResetsAt?: string | null;
  addonRemaining?: number;
  addonReserved?: number;
  /** Earliest expiry among extra uses still remaining. */
  addonExpiresAt?: string | null;
};

const TIERS = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ADMIN'];
const count = (value: unknown) => Math.max(0, Number(value) || 0);

/** Current user's plan and publication quota (same endpoint as the web `getMyMembership`). */
export async function getMyMembership(): Promise<MembershipView> {
  const response =
    await axiosClient.get<ApiResponse<Partial<MembershipView> | null>>('/api/v1/membership/me');
  const me = response.data.result ?? {};
  const tier = String(me.tier ?? '').toUpperCase();
  return {
    tier: TIERS.includes(tier) ? tier : 'FREE',
    remainingUses: count(me.remainingUses),
    reservedUses: count(me.reservedUses),
    expiresAt: me.expiresAt || null,
    unlimited: Boolean(me.unlimited) || tier === 'ADMIN',
    ...(me.freeUsed != null && { freeUsed: count(me.freeUsed) }),
    ...(me.quotaResetsAt && { quotaResetsAt: me.quotaResetsAt }),
    ...(me.addonRemaining != null && { addonRemaining: count(me.addonRemaining) }),
    ...(me.addonReserved != null && { addonReserved: count(me.addonReserved) }),
    ...(me.addonExpiresAt && { addonExpiresAt: me.addonExpiresAt }),
  };
}

export type PaidMembershipTier = 'STARTER' | 'PRO' | 'BUSINESS';
export type MembershipPaymentMethod = 'SEPAY' | 'ETH';

export type MembershipQuote = {
  tier: PaidMembershipTier;
  amountVnd: number;
  remainingUsesAfter: number;
  expiresAtAfter: string | null;
  mode?: 'UPGRADE' | 'NEW';
  upgrade?: boolean;
  upgradeDeadline?: string | null;
};

export type MembershipAddonOffer = { unitPriceVnd: number; validDays: number; maxQuantity: number };

export type MembershipCheckout = {
  orderId: string;
  paymentUrl: string;
  amountVnd: number;
  provider: string;
  formFields: Record<string, string>;
};

export type MembershipOrder = {
  id: string;
  provider: string;
  amountVnd: number;
  /** PENDING, PAID, REVIEW, FAILED, EXPIRED or CANCELLED. */
  status: string;
  kind?: 'PLAN' | 'ADDON';
  /** null for ADDON orders. */
  tier?: string | null;
  quantity?: number | null;
  createdAt?: string | null;
  paidAt?: string | null;
};

export type MembershipEthQuote = {
  paymentId: string;
  payer: string;
  recipient: string;
  amountVnd: number;
  ethVnd?: number;
  amountWei: string;
  expiresAt: string;
  chainId: number;
  contractAddress: string;
  signature: string;
};

const membershipPath = '/api/v1/membership';
const orderPath = (id: string) => `${membershipPath}/orders/${encodeURIComponent(id)}`;

export async function getMembershipQuote(tier: PaidMembershipTier) {
  const { data } = await axiosClient.get<ApiResponse<MembershipQuote>>(`${membershipPath}/quote`, {
    params: { tier },
  });
  return data.result;
}

export async function createMembershipCheckout(tier: PaidMembershipTier, provider: MembershipPaymentMethod = 'SEPAY') {
  const { data } = await axiosClient.post<ApiResponse<MembershipCheckout>>(`${membershipPath}/checkout`, {
    tier,
    provider,
  });
  return data.result;
}

/** Price, validity and largest quantity of one-off extra uses. No fallback price. */
export async function getMembershipAddonOffer(): Promise<MembershipAddonOffer> {
  const { data } = await axiosClient.get<ApiResponse<Partial<MembershipAddonOffer> | null>>(
    `${membershipPath}/addons`
  );
  const offer = {
    unitPriceVnd: count(data.result?.unitPriceVnd),
    validDays: count(data.result?.validDays),
    maxQuantity: Math.floor(count(data.result?.maxQuantity)),
  };
  if (!offer.unitPriceVnd || !offer.validDays || !offer.maxQuantity)
    throw new Error('Máy chủ chưa trả về giá lượt mua thêm.');
  return offer;
}

export async function createMembershipAddonCheckout(
  quantity: number,
  provider: MembershipPaymentMethod
) {
  const { data } = await axiosClient.post<ApiResponse<MembershipCheckout>>(
    `${membershipPath}/addons/checkout`,
    { quantity, provider }
  );
  return data.result;
}

const upper = (value: unknown) => String(value ?? '').trim().toUpperCase();

function toOrder(raw: MembershipOrder): MembershipOrder {
  return {
    ...raw,
    status: upper(raw?.status) || 'PENDING',
    provider: upper(raw?.provider),
    kind: upper(raw?.kind) === 'ADDON' ? 'ADDON' : 'PLAN',
  };
}

export async function getMembershipOrder(id: string) {
  const { data } = await axiosClient.get<ApiResponse<MembershipOrder>>(orderPath(id));
  return toOrder(data.result);
}

/** A finished order is returned unchanged, so read the status of the answer. */
export async function cancelMembershipOrder(id: string) {
  const { data } = await axiosClient.post<ApiResponse<MembershipOrder>>(`${orderPath(id)}/cancel`);
  return toOrder(data.result);
}

export async function getMembershipEthChallenge(id: string, wallet: string) {
  const { data } = await axiosClient.get<ApiResponse<{ challengeId: string; message: string }>>(
    `${orderPath(id)}/eth/challenge`, { params: { wallet } }
  );
  return data.result;
}

export async function getMembershipEthQuote(id: string, challengeId: string, signature: string) {
  const { data } = await axiosClient.post<ApiResponse<MembershipEthQuote>>(`${orderPath(id)}/eth/quote`, {
    challengeId,
    signature,
  });
  return data.result;
}

export async function settleMembershipEth(id: string, paymentId: string, txHash: string) {
  const { data } = await axiosClient.post<ApiResponse<MembershipOrder>>(`${orderPath(id)}/eth/settle`, {
    paymentId,
    txHash,
  });
  return toOrder(data.result);
}
