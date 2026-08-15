import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { gatewayBaseUrl } from '@/config/env';
import { clearSession, getAccessToken } from '@/features/auth/session';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

const axiosClient = axios.create({
  baseURL: gatewayBaseUrl,
});

axiosClient.interceptors.request.use(async (config) => {
  const accessToken = await getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as InternalAxiosRequestConfig | undefined;

    if (error.response?.status !== 401 || !request || request._retry) {
      return Promise.reject(error);
    }

    request._retry = true;
    const accessToken = await getAccessToken(true);

    if (!accessToken) {
      await clearSession();
      return Promise.reject(error);
    }

    request.headers.Authorization = `Bearer ${accessToken}`;
    return axiosClient(request);
  }
);

export default axiosClient;
