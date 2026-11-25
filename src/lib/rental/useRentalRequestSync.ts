// Port of the pipe inside hs-web-app components/rental-request/useRentalRequestSync.ts (:37-90):
// 250 ms debounce, one in-flight call, at most one follow-up. `document.visibilityState` is injected as
// `isVisible` (AppState "active" plus screen focus); call `onVisible()` when it becomes visible again.
// The screen hook subscribes to notifications / polls and calls `schedule()`, then `dispose()` on cleanup.
export const SYNC_DEBOUNCE_MS = 250;

export function createRentalRequestSync(options: {
  refresh: () => Promise<unknown> | void;
  isVisible: () => boolean;
}) {
  let disposed = false;
  let running = false;
  let queued = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async () => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      do {
        queued = false;
        // Re-check right before the API call: the app may have gone to the background since it was queued.
        if (!options.isVisible()) {
          dirty = true;
          break;
        }
        try {
          await options.refresh();
        } catch {
          // The refresh owner surfaces its own errors; keep the pipe alive.
        }
      } while (queued && !disposed);
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    if (disposed) return;
    if (!options.isVisible()) {
      dirty = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!disposed) void run();
    }, SYNC_DEBOUNCE_MS);
  };

  return {
    schedule,
    onVisible() {
      if (options.isVisible() && dirty) {
        dirty = false;
        schedule();
      }
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}

/** :70-71 — which notification events refresh a view; omit `requestId` for lists. */
export function matchesRentalRequestEvent(
  event: { type: string; requestId?: string | null },
  requestId?: string | null
): boolean {
  if (event.type !== 'rental-request-changed') return false;
  return !(requestId && event.requestId && event.requestId !== requestId);
}
