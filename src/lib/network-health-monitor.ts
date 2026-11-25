// Pure monitor for the user's own Internet connection (independent of the backend). `probe` resolves with the
// round-trip time in ms of the first successful third-party URL, or null when every URL failed. `env`
// supplies app-foreground state and timers so this file stays free of react-native.
import type { BackendHealthEnv } from '@/lib/backend-health-monitor';

export type NetworkHealthStatus = 'checking' | 'online' | 'offline';
export type NetworkHealthReason = 'offline' | 'weak';
export type NetworkHealthState = {
  status: NetworkHealthStatus;
  reason: NetworkHealthReason;
  goodStreak: number;
};
export type NetworkHealthEnv = BackendHealthEnv;

export const SLOW_RTT_MS = 2_500;
export const ONLINE_INTERVAL_MS = 15_000;
export const BLOCKED_INTERVAL_MS = 2_000;
export const MIN_GAP_MS = 1_000;
export const BAD_TO_BLOCK = 2;
export const GOOD_TO_UNBLOCK = 3;

export function createNetworkHealthMonitor(
  probe: () => Promise<number | null>,
  onUnblocked: () => void,
  env: NetworkHealthEnv
) {
  let state: NetworkHealthState = { status: 'checking', reason: 'offline', goodStreak: 0 };
  let badStreak = 0;
  let lastCheckAt = -Infinity;
  let timer: unknown;
  let inFlight = false;
  let unsubscribeActive: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const publish = (next: NetworkHealthState) => {
    if (
      next.status === state.status &&
      next.reason === state.reason &&
      next.goodStreak === state.goodStreak
    )
      return;
    state = next;
    listeners.forEach((listener) => listener());
  };
  const clearTimer = () => {
    if (timer !== undefined) env.clearTimer(timer);
    timer = undefined;
  };
  const schedule = (delay: number) => {
    clearTimer();
    if (listeners.size && env.isActive()) timer = env.setTimer(check, Math.max(0, delay));
  };
  // After a bad lap we re-probe quickly (as when blocked) so the second confirming lap is not 15s away.
  const interval = () =>
    state.status === 'offline' || badStreak > 0 ? BLOCKED_INTERVAL_MS : ONLINE_INTERVAL_MS;

  const apply = (rtt: number | null) => {
    if (rtt !== null && rtt <= SLOW_RTT_MS) {
      badStreak = 0;
      if (state.status !== 'offline') {
        publish({ status: 'online', reason: state.reason, goodStreak: 0 });
        return;
      }
      const goodStreak = state.goodStreak + 1;
      if (goodStreak < GOOD_TO_UNBLOCK) {
        // Back in contact but still confirming: not "no connection" any more (same as the web monitor).
        publish({ ...state, reason: 'weak', goodStreak });
        return;
      }
      publish({ status: 'online', reason: state.reason, goodStreak: 0 });
      onUnblocked();
      return;
    }
    badStreak += 1;
    if (state.status === 'offline' || badStreak >= BAD_TO_BLOCK) {
      publish({ status: 'offline', reason: rtt === null ? 'offline' : 'weak', goodStreak: 0 });
    }
  };

  function check() {
    clearTimer();
    if (!listeners.size || !env.isActive() || inFlight) return;
    const remaining = MIN_GAP_MS - (env.now() - lastCheckAt);
    if (remaining > 0) {
      schedule(remaining);
      return;
    }
    lastCheckAt = env.now();
    inFlight = true;
    Promise.resolve()
      .then(probe)
      .catch(() => null)
      .then(apply)
      .finally(() => {
        inFlight = false;
        schedule(interval());
      });
  }

  const resume = (active: boolean) => {
    if (active) check();
    else clearTimer();
  };

  return {
    getSnapshot: (): NetworkHealthState => state,
    recheck: check,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        unsubscribeActive = env.subscribeActive(resume);
        resume(env.isActive());
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearTimer();
          unsubscribeActive?.();
          unsubscribeActive = undefined;
        }
      };
    },
  };
}
