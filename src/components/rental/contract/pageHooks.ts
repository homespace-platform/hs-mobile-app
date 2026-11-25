// Web: components/contract/page/usePolledRead.ts and useOnboardingNextAction.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Role } from '@/lib/rental/rental-labels';
import { readOnboarding } from '@/lib/rental/rental-onboarding-read';
import { useVisiblePoll } from '@/lib/rental-sync/hooks';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';

/**
 * Read-only fetch that refreshes itself (default 30 s) while the app is active and again when it
 * comes back. Failures keep the last good value; `error` is set while the latest read failed. `key`
 * identifies the resource: data of another key is never returned.
 */
export function usePolledRead<T>(
  read: () => Promise<T>,
  key: string,
  enabled = true,
  intervalMs = 30_000
) {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const readRef = useRef(read);
  /** Each reload takes the next number and only the newest one may apply. */
  const epoch = useRef(0);
  useEffect(() => {
    readRef.current = read;
  });

  const invalidate = useCallback(() => {
    epoch.current++;
  }, []);
  const reload = useCallback(async () => {
    const mine = ++epoch.current;
    try {
      const value = await readRef.current();
      if (epoch.current === mine) {
        setState({ key, value });
        setErrorKey(null);
      }
    } catch {
      if (epoch.current === mine) setErrorKey(key); // keep the last good value
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    invalidate();
    void reload();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void reload();
    });
    return () => {
      invalidate();
      subscription.remove();
    };
  }, [enabled, reload, invalidate]);
  useVisiblePoll(reload, intervalMs, enabled);

  // A newer snapshot supersedes any read still in flight.
  const accept = useCallback(
    (value: T) => {
      invalidate();
      setState({ key, value });
      setErrorKey(null);
    },
    [key, invalidate]
  );
  return {
    data: state?.key === key ? state.value : null,
    error: errorKey === key,
    reload,
    accept,
  };
}

/**
 * Pre-tenancy progress of a rental request: the server's `nextAction` plus the whole onboarding view.
 * `accept` lets a mounted RentalOnboardingPanel hand over its fresher snapshot.
 */
export function useOnboardingNextAction(
  rentalRequestId: string | undefined,
  role: Role,
  enabled = true
) {
  const read = useCallback(() => readOnboarding(rentalRequestId as string), [rentalRequestId]);
  const { data, error, reload, accept } = usePolledRead<RentalOnboarding>(
    read,
    `${rentalRequestId}:${role}`,
    enabled && Boolean(rentalRequestId)
  );
  return { view: data, nextAction: data?.nextAction ?? null, error, reload, accept };
}
