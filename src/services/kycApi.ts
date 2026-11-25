import axiosClient from '@/lib/axios-client';
import type { KycBackendStatus } from '@/lib/kyc/pure';
import type { ApiResponse } from '@/types/api';

// Same shape as hs-web-app types/kyc.type.ts (KycStatusResponse).
export type KycStatusResponse = {
  status: KycBackendStatus;
  verifiedAt: string | null;
  provider: string;
  sessionId: string | null;
  sessionUrl: string | null;
  rejectionReason?: string | null;
};

export async function getKycStatus() {
  return (await axiosClient.get<ApiResponse<KycStatusResponse>>('/api/v1/users/me/kyc')).data
    .result;
}
