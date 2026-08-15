import axiosClient from '@/lib/axios-client';
import type { ApiResponse, UserProfileResponse } from '@/types/api';

export const getUserProfileApi = async () => {
  const response = await axiosClient.get<ApiResponse<UserProfileResponse>>(
    '/api/v1/users/me/profile'
  );
  return response.data.result;
};
