import type { ChatPresenceUpdate } from '@/lib/chat-presence';

export const PRESENCE_BATCH_SIZE = 200;
export const PRESENCE_MAX_ID_LENGTH = 128;
export const PRESENCE_ACK_TIMEOUT_MS = 5_000;

type AckResult = { ok: boolean; ack?: unknown };

// Keeps chat-service informed which users this socket wants presence for. The server forgets the
// subscriptions when the socket drops, so every (re)connect clears `subscribed` and sends everything again.
export function createPresenceSync(deps: {
  emitWithAck: (event: string, payload: unknown, timeoutMs: number) => Promise<AckResult>;
  isConnected: () => boolean;
  apply: (updates: ChatPresenceUpdate[]) => void;
}) {
  const wanted = new Map<string, number>(); // userId -> number of mounted users of it
  const subscribed = new Set<string>();
  let epoch = 0; // acks from before a reconnect/reset are stale and must not touch the store

  function flush() {
    if (!deps.isConnected()) return;
    const fresh = [...wanted.keys()].filter((id) => !subscribed.has(id));
    for (let i = 0; i < fresh.length; i += PRESENCE_BATCH_SIZE) {
      const userIds = fresh.slice(i, i + PRESENCE_BATCH_SIZE);
      userIds.forEach((id) => subscribed.add(id));
      const run = epoch;
      // A timeout/error is swallowed: unknown users stay "Ngoại tuyến" until a chat:presence event arrives.
      void deps
        .emitWithAck('chat:presence:subscribe', { userIds }, PRESENCE_ACK_TIMEOUT_MS)
        .then((result) => {
          const presences = (result.ack as { presences?: unknown } | undefined)?.presences;
          if (run === epoch && result.ok && Array.isArray(presences)) deps.apply(presences);
        })
        .catch(() => undefined);
    }
  }

  return {
    // Returns the matching release function; ids already known to the server are not sent again.
    watch(userIds: readonly string[]) {
      const ids = [
        ...new Set(
          userIds.filter(
            (id) => typeof id === 'string' && id && id.length <= PRESENCE_MAX_ID_LENGTH
          )
        ),
      ];
      ids.forEach((id) => wanted.set(id, (wanted.get(id) ?? 0) + 1));
      flush();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        ids.forEach((id) => {
          const count = (wanted.get(id) ?? 1) - 1;
          if (count > 0) wanted.set(id, count);
          else wanted.delete(id);
        });
      };
    },
    onConnect() {
      epoch++;
      subscribed.clear();
      flush();
    },
    // Sign-out / socket stopped: forget what the server knew; screens that are still mounted resubscribe on connect.
    reset() {
      epoch++;
      subscribed.clear();
    },
  };
}
