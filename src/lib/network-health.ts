import { AppState } from 'react-native';

import { requestBackendHealthCheck } from '@/lib/backend-health-signal';
import { createNetworkHealthMonitor } from '@/lib/network-health-monitor';
import { setNetworkHealthCheckHandler } from '@/lib/network-health-signal';

// Third-party endpoints, deliberately not our backend, so this answers "does the user have Internet?".
const PROBE_URLS = [
  'https://www.gstatic.com/generate_204',
  'https://cp.cloudflare.com/generate_204',
];
const TIMEOUT_MS = 6_000;

// Any HTTP response counts as reachable; resolves with the RTT of the first URL that answers.
async function ping(url: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    await fetch(url, { cache: 'no-store', signal: controller.signal });
    return Date.now() - startedAt;
  } finally {
    clearTimeout(timeout);
  }
}

const probe = () =>
  new Promise<number | null>((resolve) => {
    let pending = PROBE_URLS.length;
    PROBE_URLS.forEach((url) =>
      ping(url).then(resolve, () => {
        pending -= 1;
        if (!pending) resolve(null);
      })
    );
  });

export const networkHealth = createNetworkHealthMonitor(
  probe,
  // Back online: let the backend monitor re-check right away instead of waiting for its next poll.
  requestBackendHealthCheck,
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

// API calls that fail with no response trigger an immediate (throttled) re-check.
setNetworkHealthCheckHandler(networkHealth.recheck);
