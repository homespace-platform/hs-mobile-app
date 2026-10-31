import axiosClient from '@/lib/axios-client';
import type { ApiResponse, UserProfileResponse } from '@/types/api';

export const getUserProfileApi = async () => {
  const response = await axiosClient.get<ApiResponse<UserProfileResponse>>(
    '/api/v1/users/me/profile'
  );
  return response.data.result;
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
}
export async function updateUserAvatar(storageId: string) {
  await axiosClient.put('/api/v1/users/me/avatar', { storageId });
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
