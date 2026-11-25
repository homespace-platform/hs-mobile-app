// Mobile port of hs-web-app/lib/backend-health-monitor.ts: polls a health probe, slower while ready and
// faster while unavailable. `env` supplies app-foreground state and timers so this file stays pure.
export type BackendHealthStatus = 'checking' | 'ready' | 'unavailable';

export type BackendHealthEnv = {
  isActive: () => boolean;
  subscribeActive: (listener: (active: boolean) => void) => () => void;
  now: () => number;
  setTimer: (callback: () => void, delayMs: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

export function createBackendHealthMonitor(
  probe: () => Promise<boolean>,
  pollIntervalMs: number,
  retryIntervalMs: number,
  env: BackendHealthEnv
) {
  let status: BackendHealthStatus = 'checking';
  let lastCheckAt = -Infinity;
  let timer: unknown;
  let inFlight: Promise<void> | undefined;
  let unsubscribeActive: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const publish = (next: BackendHealthStatus) => {
    if (status === next) return;
    status = next;
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
  const interval = () => (status === 'ready' ? pollIntervalMs : retryIntervalMs);

  function check() {
    clearTimer();
    if (!listeners.size || !env.isActive() || inFlight) return;
    const remaining = retryIntervalMs - (env.now() - lastCheckAt);
    if (remaining > 0) {
      schedule(remaining);
      return;
    }
    lastCheckAt = env.now();
    inFlight = Promise.resolve()
      .then(probe)
      .then((ready) => publish(ready ? 'ready' : 'unavailable'))
      .catch(() => publish('unavailable'))
      .finally(() => {
        inFlight = undefined;
        schedule(interval());
      });
  }

  const resume = (active: boolean) => {
    if (!active) {
      clearTimer();
      return;
    }
    const remaining = interval() - (env.now() - lastCheckAt);
    if (remaining > 0) schedule(remaining);
    else check();
  };

  return {
    getSnapshot: (): BackendHealthStatus => status,
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
