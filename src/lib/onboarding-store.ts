import { getOnboardingStatus } from '@/services/onboardingApi';
import type { ProfileGateState } from '@/lib/profile-gate';

// Shared, subscribable onboarding status. `onboarding: null` = unknown (not loaded or failed): never block the user,
// the backend still enforces with code 1010.
export type OnboardingState = { loaded: boolean; onboarding: ProfileGateState | null };
const EMPTY: OnboardingState = { loaded: false, onboarding: null };

/** Returns true at most once per `ms` window. */
export function createThrottle(ms: number, now: () => number = Date.now) {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < ms) return false;
    last = t;
    return true;
  };
}

export function createOnboardingStore(fetchStatus: () => Promise<ProfileGateState>) {
  let state = EMPTY;
  let generation = 0;
  let inflight: Promise<void> | null = null;
  let queued = false;
  const listeners = new Set<() => void>();
  const set = (next: OnboardingState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** One request at a time; a call during a request re-runs once afterwards so it never reads older data. */
    refresh(): Promise<void> {
      if (inflight) {
        queued = true;
        return inflight;
      }
      const mine = generation;
      const run: Promise<void> = (async () => {
        do {
          queued = false;
          try {
            const next = await fetchStatus();
            if (mine === generation) set({ loaded: true, onboarding: next });
          } catch {
            // Unknown status: keep what we have.
          }
        } while (queued && mine === generation);
      })().finally(() => {
        if (inflight === run) inflight = null;
      });
      inflight = run;
      return run;
    },
    /** The server accepted the initial password: close the gate even if the follow-up refresh fails. */
    markPasswordSet() {
      if (state.onboarding)
        set({ ...state, onboarding: { ...state.onboarding, passwordSet: true } });
    },
    /** Sign-out / account switch: drop the data and ignore any request still in flight. */
    clear() {
      generation++;
      inflight = null;
      queued = false;
      if (state !== EMPTY) set(EMPTY);
    },
  };
}

export const onboardingStore = createOnboardingStore(getOnboardingStatus);
export const refreshOnboarding = () => onboardingStore.refresh();
