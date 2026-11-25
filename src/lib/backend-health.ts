import { AppState } from 'react-native';

import axiosClient from '@/lib/axios-client';
import { createBackendHealthMonitor } from '@/lib/backend-health-monitor';
import { setBackendHealthCheckHandler } from '@/lib/backend-health-signal';

// Same timings and probe as the web app (hs-web-app/lib/backend-health.ts).
const POLL_INTERVAL_MS = 60_000;
const RETRY_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 5_000;

export const backendHealth = createBackendHealthMonitor(
  async () => {
    const response = await axiosClient.get('/api/v1/actuator/health', {
      backendHealthProbe: true,
      timeout: TIMEOUT_MS,
      params: { _healthCheck: Date.now() },
      validateStatus: () => true,
    });
    return response.status === 200 && response.data?.status === 'UP';
  },
  POLL_INTERVAL_MS,
  RETRY_INTERVAL_MS,
  {
    isActive: () => AppState.currentState === 'active',
    subscribeActive: (listener) => {
      const subscription = AppState.addEventListener('change', (state) =>
        listener(state === 'active')
      );
      return () => subscription.remove();
    },
    now: () => Date.now(),
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
);

// API calls that fail with no response or 502/503/504 trigger an immediate (throttled) re-check.
setBackendHealthCheckHandler(backendHealth.recheck);
