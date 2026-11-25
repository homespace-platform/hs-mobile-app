import {
  CanceledError,
  create,
  isCancel,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import { gatewayBaseUrl } from '@/config/env';
import { requestBackendHealthCheck } from '@/lib/backend-health-signal';
import { FEATURE_LOCKED_MESSAGE, isPermissionDenied } from '@/lib/permissions';
import { isProfileIncomplete, profileGateMissing } from '@/lib/profile-gate';
import { notifyPermissionDenied, notifyProfileGateDenied } from '@/lib/profile-gate-signal';
import { requestNetworkHealthCheck } from '@/lib/network-health-signal';
import { sessionGeneration } from '@/lib/session-end';
import { clearSession, getAccessToken } from '@/features/auth/session';

declare module 'axios' {
  export interface AxiosRequestConfig {
    backendHealthProbe?: boolean;
  }
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
    _sessionGeneration?: number;
  }
}

const axiosClient = create({
  baseURL: gatewayBaseUrl,
  timeout: 15000,
});

const isStale = (request?: InternalAxiosRequestConfig) =>
  request?._sessionGeneration !== undefined && request._sessionGeneration !== sessionGeneration();

axiosClient.interceptors.request.use(async (config) => {
  // The health probe is anonymous: no token lookup, no Authorization header.
  if (config.backendHealthProbe) {
    delete config.headers.Authorization;
    return config;
  }
  config._sessionGeneration ??= sessionGeneration();
  if (isStale(config)) throw new CanceledError('Phiên đăng nhập đã kết thúc.');
  const accessToken = await getAccessToken();
  if (isStale(config)) throw new CanceledError('Phiên đăng nhập đã kết thúc.');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    if (!response.config.backendHealthProbe && isStale(response.config))
      throw new CanceledError('Phiên đăng nhập đã kết thúc.');
    return response;
  },
  async (error: AxiosError) => {
    const request = error.config as InternalAxiosRequestConfig | undefined;
    if (request?.backendHealthProbe || isCancel(error) || isStale(request))
      return Promise.reject(error);
    if (!isCancel(error) && (!error.response || [502, 503, 504].includes(error.response.status))) {
      requestBackendHealthCheck();
    }
    if (!isCancel(error) && !error.response) requestNetworkHealthCheck();
    // Revoked feature permission (1009): callers read response.data.message, so give them the friendly text.
    if (isPermissionDenied(error.response)) {
      (error.response!.data as { message?: string }).message = FEATURE_LOCKED_MESSAGE;
      notifyPermissionDenied();
    }
    // Incomplete profile (1010): the app refreshes the status and offers to open Settings; the server message is kept.
    if (isProfileIncomplete(error.response)) {
      notifyProfileGateDenied(
        {
          message: (error.response?.data as { message?: string } | undefined)?.message,
          missing: profileGateMissing(error.response),
        },
        error
      );
    }

    if (error.response?.status !== 401 || !request || request._retry) {
      return Promise.reject(error);
    }

    request._retry = true;
    const accessToken = await getAccessToken(true);
    if (isStale(request)) return Promise.reject(error);

    if (!accessToken) {
      await clearSession();
      return Promise.reject(error);
    }

    request.headers.Authorization = `Bearer ${accessToken}`;
    return axiosClient(request);
  }
);

export default axiosClient;
