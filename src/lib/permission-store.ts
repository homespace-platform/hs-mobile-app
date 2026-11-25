// The signed-in user's effective feature permissions. null = unknown (not loaded or failed): never block.
import { getMyPermissions } from '@/services/userApi';

let permissions: readonly string[] | null = null;
let latest = 0;
const listeners = new Set<() => void>();

function set(next: readonly string[] | null) {
  permissions = next;
  listeners.forEach((listener) => listener());
}

export const permissionStore = {
  get: () => permissions,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Only the newest request may write, so a slow or pre-sign-out response is ignored. */
  async refresh() {
    const mine = ++latest;
    try {
      const next = await getMyPermissions();
      if (mine === latest) set(next);
    } catch {
      // Keep what we have.
    }
  },
  clear() {
    latest++;
    set(null);
  },
};
