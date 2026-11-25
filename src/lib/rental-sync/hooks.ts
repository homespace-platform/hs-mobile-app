// React Native side of the web hooks useNotificationChangeSync / useAgreementChangeSync /
// useRentalRequestSync / useNowMs. Same signatures; "tab visible" is AppState "active".
// Only the top rental screen is mounted, so unmounting covers "screen not focused".
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createChangeSync } from '@/lib/rental/useAgreementChangeSync';
import {
  createRentalRequestSync,
  matchesRentalRequestEvent,
} from '@/lib/rental/useRentalRequestSync';
import { startChangeSync, type RentalSyncEvent } from '@/lib/rental-sync/events';
import { subscribeNotificationEvents } from '@/lib/realtime/connections';

export type { RentalSyncEvent };

export const isAppVisible = () => AppState.currentState === 'active';

function onAppActive(listener: () => void) {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') listener();
  });
  return () => subscription.remove();
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Re-reads when a matching signal arrives (250 ms coalesce; in the background it waits for return). */
export function useNotificationChangeSync(
  matches: (event: RentalSyncEvent) => boolean,
  refresh: () => unknown,
  enabled = true
): void {
  const latest = useLatest({ matches, refresh });
  useEffect(() => {
    if (!enabled) return;
    return startChangeSync({
      subscribe: subscribeNotificationEvents,
      onActive: onAppActive,
      matches: (event) => latest.current.matches(event),
      sync: createChangeSync({ refresh: () => latest.current.refresh(), isVisible: isAppVisible }),
    });
  }, [enabled, latest]);
}

/** `matches` gets the signal's agreement id; undefined = generic recovery. */
export function useAgreementChangeSync(
  matches: (agreementId?: string) => boolean,
  refresh: () => unknown,
  enabled = true
): void {
  useNotificationChangeSync(
    (event) => event.type === 'agreement-changed' && matches(event.agreementId),
    refresh,
    enabled
  );
}

/**
 * One in-flight call and at most one follow-up. `requestId` scopes to one request; omit it for lists.
 * `refresh` must be silent: no loading state and no reset of unsaved input.
 */
export function useRentalRequestSync(
  refresh: () => Promise<unknown> | void,
  options: { enabled?: boolean; requestId?: string | null; pollMs?: number } = {}
): void {
  const { enabled = true, requestId = null, pollMs = 0 } = options;
  const latest = useLatest(refresh);
  useEffect(() => {
    if (!enabled) return;
    const sync = createRentalRequestSync({
      refresh: () => latest.current(),
      isVisible: isAppVisible,
    });
    const stop = startChangeSync({
      subscribe: subscribeNotificationEvents,
      onActive: onAppActive,
      matches: (event) => matchesRentalRequestEvent(event, requestId),
      sync,
    });
    const poll = pollMs > 0 ? setInterval(sync.schedule, pollMs) : undefined;
    return () => {
      clearInterval(poll);
      stop();
    };
  }, [enabled, requestId, pollMs, latest]);
}

/** The web's `setInterval(() => document.visibilityState === "visible" && load(true), ms)`. */
export function useVisiblePoll(refresh: () => unknown, ms: number, enabled = true): void {
  const latest = useLatest(refresh);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (isAppVisible()) void latest.current();
    }, ms);
    return () => clearInterval(timer);
  }, [ms, enabled, latest]);
}

/** Device clock that re-renders every `intervalMs`; UX hint only, the server decides deadlines. */
export function useNowMs(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
