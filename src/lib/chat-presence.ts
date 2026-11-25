// Pure presence model, ported from the web app (hs-web-app/lib/chat-presence.ts) so both clients show the same labels.
export type ChatPresence = { online: boolean; lastSeenAt: string | null };
export type ChatPresenceMap = Record<string, ChatPresence>;
export type ChatPresenceUpdate = ChatPresence & { userId: string };

export const OFFLINE_LABEL = 'Ngoại tuyến';
export const ONLINE_LABEL = 'Đang hoạt động';

const pad = (value: number) => String(value).padStart(2, '0');

export function formatLastActive(lastSeenAt: string | null | undefined, now = Date.now()) {
  const seenAt = lastSeenAt ? new Date(lastSeenAt) : null;
  const seen = seenAt ? seenAt.getTime() : NaN;
  if (!seenAt || Number.isNaN(seen)) return OFFLINE_LABEL;
  // A future timestamp (clock skew) counts as just now.
  const minutes = Math.max(1, Math.floor((now - seen) / 60_000));
  if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
  if (minutes < 24 * 60) return `Hoạt động ${Math.floor(minutes / 60)} giờ trước`;
  // Hand-formatted dd/MM/yyyy: Hermes' Intl support differs per device.
  return `Hoạt động ${pad(seenAt.getDate())}/${pad(seenAt.getMonth() + 1)}/${seenAt.getFullYear()}`;
}

// No data yet counts as offline, like the web app.
export function presenceLabel(presence: ChatPresence | undefined, now = Date.now()) {
  if (!presence) return OFFLINE_LABEL;
  return presence.online ? ONLINE_LABEL : formatLastActive(presence.lastSeenAt, now);
}

// Returns the same object when nothing changed so React skips the re-render.
export function mergePresence(state: ChatPresenceMap, updates: ChatPresenceUpdate[]) {
  let next = state;
  for (const update of updates) {
    if (!update || typeof update !== 'object') continue;
    const { userId, online, lastSeenAt } = update;
    if (typeof userId !== 'string' || !userId || userId === '__proto__') continue;
    if (typeof online !== 'boolean') continue;
    const seen = typeof lastSeenAt === 'string' ? lastSeenAt : null;
    const prev = next[userId];
    if (prev && prev.online === online && prev.lastSeenAt === seen) continue;
    if (next === state) next = { ...state };
    next[userId] = { online, lastSeenAt: seen };
  }
  return next;
}

// Module-level subscribable store (same shape as unread-store.ts) read with useSyncExternalStore.
export function createPresenceStore() {
  const empty: ChatPresenceMap = {};
  let state = empty;
  const listeners = new Set<() => void>();
  const set = (next: ChatPresenceMap) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    get: () => state,
    apply: (updates: ChatPresenceUpdate[]) => set(mergePresence(state, updates)),
    clear: () => set(empty),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const chatPresenceStore = createPresenceStore();
