import axiosClient from '@/lib/axios-client';
import { getAccessToken } from '@/features/auth/session';
import { onSessionEnd } from '@/lib/session-end';
import type { ApiResponse, UserAddress, UserProfileResponse, VietmapAddress } from '@/types/api';

let profileRequest: Promise<UserProfileResponse> | null = null;
let profileRequestToken: string | null = null;
let profileCache: UserProfileResponse | null = null;
let profileCacheAt = 0;
onSessionEnd(() => {
  profileRequest = null;
  profileRequestToken = null;
  profileCache = null;
});
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

export async function getMyPermissions() {
  const response = await axiosClient.get<ApiResponse<{ permissions?: string[] }>>(
    '/api/v1/users/me/permissions'
  );
  return response.data.result?.permissions ?? [];
}

export type ProfileUpdate = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
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
export async function getLocationPlace(refId: string, signal?: AbortSignal) {
  return (
    await axiosClient.get<ApiResponse<VietmapAddress>>('/api/v1/locations/place', {
      params: { refId },
      signal,
      timeout: 12000,
    })
  ).data.result;
}
export async function saveUserAddress(refId: string, addressNote?: string) {
  const response = await axiosClient.put<ApiResponse<UserAddress>>('/api/v1/users/me/address', {
    refId,
    addressNote,
  });
  profileCache = null;
  profileRequest = null;
  return response.data.result;
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
