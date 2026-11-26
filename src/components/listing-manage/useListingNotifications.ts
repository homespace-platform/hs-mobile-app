// Web useListingNotifications on the mobile notification socket: coalesced, one call in flight.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { isListingChangeSignal } from '@/lib/listing-manage';
import { subscribeNotificationEvents } from '@/lib/realtime/connections';
import { createRentalRequestSync } from '@/lib/rental/useRentalRequestSync';
import { isAppVisible } from '@/lib/rental-sync/hooks';

/** `refresh` must be silent: no loading state. */
export function useListingNotifications(
  refresh: () => Promise<unknown> | void,
  { listingId, enabled = true }: { listingId?: string; enabled?: boolean } = {}
) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useEffect(() => {
    if (!enabled) return;
    const sync = createRentalRequestSync({
      refresh: () => latest.current(),
      isVisible: isAppVisible,
    });
    const unsubscribe = subscribeNotificationEvents((event, payload) => {
      if (isListingChangeSignal(event, payload, listingId)) sync.schedule();
    });
    const appState = AppState.addEventListener('change', () => sync.onVisible());
    return () => {
      unsubscribe();
      appState.remove();
      sync.dispose();
    };
  }, [listingId, enabled]);
}
