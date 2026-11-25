import type { AxiosRequestConfig } from 'axios';

import axiosClient from '@/lib/axios-client';

// The web client has no timeout; the mobile default (15 s) would cut off slow server work
// (AI review, PDF rendering, SmartCA). A per-request timeout still wins.
const web = (config?: AxiosRequestConfig): AxiosRequestConfig => ({ timeout: 0, ...config });

const client = {
  get: <T>(url: string, config?: AxiosRequestConfig) => axiosClient.get<T>(url, web(config)),
  delete: <T>(url: string, config?: AxiosRequestConfig) => axiosClient.delete<T>(url, web(config)),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosClient.post<T>(url, data, web(config)),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosClient.put<T>(url, data, web(config)),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosClient.patch<T>(url, data, web(config)),
};

export default client;
