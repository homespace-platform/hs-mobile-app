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
