import { create, isCancel, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { gatewayBaseUrl } from '@/config/env';
import { requestBackendHealthCheck } from '@/lib/backend-health-signal';
import { requestNetworkHealthCheck } from '@/lib/network-health-signal';
import { clearSession, getAccessToken } from '@/features/auth/session';

declare module 'axios' {
  export interface AxiosRequestConfig {
    backendHealthProbe?: boolean;
  }
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

const axiosClient = create({
  baseURL: gatewayBaseUrl,
  timeout: 15000,
});

axiosClient.interceptors.request.use(async (config) => {
  // The health probe is anonymous: no token lookup, no Authorization header.
  if (config.backendHealthProbe) {
    delete config.headers.Authorization;
    return config;
  }
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
    if (request?.backendHealthProbe) return Promise.reject(error);
    if (!isCancel(error) && (!error.response || [502, 503, 504].includes(error.response.status))) {
      requestBackendHealthCheck();
    }
    if (!isCancel(error) && !error.response) requestNetworkHealthCheck();

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
