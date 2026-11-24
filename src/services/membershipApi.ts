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
