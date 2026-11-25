// Port of hs-web-app types/nearby.type.ts, lib/nearby-directions.ts and lib/nearby-sync.ts.
// Pure (no React Native imports) so tests can compare it with the web modules.
export const NEARBY_RADIUS_METERS = 2000;
export const NEARBY_PAGE_SIZE = 5;
export type NearbyGroup =
  | 'EDUCATION'
  | 'HEALTHCARE'
  | 'SHOPPING'
  | 'FOOD_DRINK'
  | 'FINANCE'
  | 'TRANSPORT'
  | 'RECREATION'
  | 'SPORTS';
export const NEARBY_GROUPS: Record<NearbyGroup, string> = {
  EDUCATION: 'Giáo dục',
  HEALTHCARE: 'Y tế',
  SHOPPING: 'Mua sắm',
  FOOD_DRINK: 'Ăn uống',
  FINANCE: 'Ngân hàng',
  TRANSPORT: 'Đi lại',
  RECREATION: 'Giải trí',
  SPORTS: 'Thể thao',
};
export interface NearbyPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  distanceMeters: number;
  distanceType: 'STRAIGHT_LINE';
  groups: NearbyGroup[];
  attribution: string;
}
export interface NearbySummary {
  listingId: string;
  enabled: boolean;
  radiusRequestedMeters: number;
  limitation: string;
  groups: {
    code: NearbyGroup;
    knownCount: number;
    coverageStatus: string;
    dataAsOf?: string | null;
    radiusCoveredMeters?: number | null;
  }[];
}
export interface NearbyPage {
  enabled: boolean;
  items: NearbyPlace[];
  total: number;
  page: number;
  size: number;
  coverage: NearbySummary;
  syncStatus?: string;
}

type Coordinates = { latitude?: number | null; longitude?: number | null };

export function validCoordinates(
  value?: Coordinates | null
): value is { latitude: number; longitude: number } {
  return (
    typeof value?.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

// React Native's URL/URLSearchParams are incomplete, so the query is built by hand. The output
// equals the web `url.toString()` for numeric coordinates (the comma is encoded as %2C).
const point = (value: { latitude: number; longitude: number }) =>
  encodeURIComponent(`${value.latitude},${value.longitude}`);

export function nearbyDirectionsUrl(
  origin?: Coordinates | null,
  destination?: Coordinates | null
): string | null {
  if (!validCoordinates(origin) || !validCoordinates(destination)) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${point(origin)}&destination=${point(destination)}`;
}

export function currentLocationDirectionsUrl(destination?: Coordinates | null): string | null {
  if (!validCoordinates(destination)) return null;
  // Omitting origin lets Google Maps resolve the device's current location.
  return `https://www.google.com/maps/dir/?api=1&destination=${point(destination)}&dir_action=navigate`;
}

export function isNearbySyncPending(status?: string) {
  return status === 'PENDING' || status === 'RUNNING' || status === 'RETRY_WAIT';
}

/** Bounded reads of our database-backed endpoint; this never requests a provider rescan. */
export function watchNearbySync(
  load: () => Promise<NearbyPage>,
  receive: (data: NearbyPage, watching: boolean) => void,
  failed: () => void,
  signal: AbortSignal
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let remaining = 20;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
  };
  signal.addEventListener('abort', cancel, { once: true });
  async function read() {
    if (signal.aborted) return;
    try {
      const data = await load();
      if (signal.aborted) return;
      const watching = data.enabled && isNearbySyncPending(data.syncStatus) && remaining-- > 0;
      receive(data, watching);
      if (watching) timer = setTimeout(read, 3000);
      else signal.removeEventListener('abort', cancel);
    } catch {
      if (!signal.aborted) failed();
      signal.removeEventListener('abort', cancel);
    }
  }
  void read();
}
