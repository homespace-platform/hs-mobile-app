// Module-level, subscribable counters shared by the bell badge, the chat tab and realtime sources.
export type UnreadAction =
  | { type: 'set'; count: number }
  | { type: 'increment'; by?: number }
  | { type: 'decrement'; by?: number }
  | { type: 'reset' };

const clamp = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);

export function unreadReducer(state: number, action: UnreadAction): number {
  switch (action.type) {
    case 'set':
      return clamp(action.count);
    case 'increment':
      return clamp(state + (action.by ?? 1));
    case 'decrement':
      return clamp(state - (action.by ?? 1));
    case 'reset':
      return 0;
  }
}

export function createUnreadStore() {
  let count = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => count,
    dispatch(action: UnreadAction) {
      const next = unreadReducer(count, action);
      if (next === count) return;
      count = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type UnreadStore = ReturnType<typeof createUnreadStore>;
export const notificationUnreadStore = createUnreadStore();
export const chatUnreadStore = createUnreadStore();
