import axiosClient from '@/lib/axios-client';
import { normalizeOnboardingStatus, type OnboardingStatusInput } from '@/lib/profile-gate';
import type { ApiResponse } from '@/types/api';

// Same endpoint and normalisation as hs-web-app services/user.service.ts getOnboardingStatus.
export async function getOnboardingStatus() {
  const response = await axiosClient.get<ApiResponse<OnboardingStatusInput>>(
    '/api/v1/users/me/onboarding-status'
  );
  return normalizeOnboardingStatus(response.data.result);
}
