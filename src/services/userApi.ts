import axiosClient from '@/lib/axios-client';
import { getAccessToken } from '@/features/auth/session';
import type { ApiResponse, UserProfileResponse } from '@/types/api';

let profileRequest: Promise<UserProfileResponse> | null = null;
let profileRequestToken: string | null = null;
let profileCache: UserProfileResponse | null = null;
let profileCacheAt = 0;
export const getUserProfileApi = async (forceRefresh = false) => {
  const token = await getAccessToken();
  if (
    !forceRefresh &&
    token &&
    profileRequestToken === token &&
    profileCache &&
    Date.now() - profileCacheAt < 5_000
  )
    return profileCache;
  if (profileRequest && profileRequestToken === token) return profileRequest;
  profileRequestToken = token;
  const request = axiosClient
    .get<ApiResponse<UserProfileResponse>>('/api/v1/users/me/profile')
    .then((response) => {
      if (profileRequest === request) {
        profileCache = response.data.result;
        profileCacheAt = Date.now();
      }
      return response.data.result;
    })
    .finally(() => {
      if (profileRequest === request) profileRequest = null;
    });
  profileRequest = request;
  return request;
};

export type ProfileUpdate = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dob: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
};
export async function updateUserProfile(payload: ProfileUpdate) {
  await axiosClient.post('/api/v1/users/me/profile', payload);
  profileCache = null;
  profileRequest = null;
}
export async function updateUserAvatar(storageId: string) {
  await axiosClient.put('/api/v1/users/me/avatar', { storageId });
  profileCache = null;
  profileRequest = null;
}
export async function hasPassword() {
  return (await axiosClient.get<ApiResponse<boolean>>('/api/v1/users/me/password/status')).data
    .result;
}
export async function savePassword(newPassword: string, oldPassword?: string) {
  await axiosClient.post(
    oldPassword === undefined ? '/api/v1/users/me/password/initial' : '/api/v1/users/me/password',
    { newPassword, ...(oldPassword === undefined ? {} : { oldPassword }) }
  );
}
export type KycStatus = { status: string; sessionUrl?: string; rejectionReason?: string };
export async function getKycStatus() {
  return (await axiosClient.get<ApiResponse<KycStatus>>('/api/v1/users/me/kyc')).data.result;
}
export async function createKycSession() {
  return (await axiosClient.post<ApiResponse<{ url: string }>>('/api/v1/users/me/kyc/session')).data
    .result;
}
