// Port of hs-web-app lib/rental-occupant-limit.ts (verbatim; only import paths changed).
export type RentalOccupantLimitSnapshot = { listingId: string; limit: number | null };

export function normalizeOccupantLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Capacity belongs to the listing, not to the currently displayed price quote. */
export function resolveOccupantLimit(
  listingId: string,
  listingLimit: unknown,
  snapshot: RentalOccupantLimitSnapshot | null
): number | null {
  return snapshot?.listingId === listingId ? snapshot.limit : normalizeOccupantLimit(listingLimit);
}

export function clampOccupants(value: number, limit: number | null): number {
  const maximum = limit ?? 20;
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.trunc(value))) : 1;
}
