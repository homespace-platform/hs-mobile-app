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
  };
}

export type PaidMembershipTier = 'STARTER' | 'PRO' | 'BUSINESS';
export type MembershipPaymentMethod = 'SEPAY' | 'ETH';

export type MembershipQuote = {
  tier: PaidMembershipTier;
  amountVnd: number;
  remainingUsesAfter: number;
  expiresAtAfter: string | null;
};

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
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REVIEW';
};

export type MembershipEthQuote = {
  paymentId: string;
  payer: string;
  recipient: string;
  amountVnd: number;
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

export async function getMembershipOrder(id: string) {
  const { data } = await axiosClient.get<ApiResponse<MembershipOrder>>(orderPath(id));
  return data.result;
}

export async function cancelMembershipOrder(id: string) {
  const { data } = await axiosClient.post<ApiResponse<MembershipOrder>>(`${orderPath(id)}/cancel`);
  return data.result;
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
  return data.result;
}
