/**
 * Port of hs-web-app lib/branch-layout-draft.ts: an unsaved floor-map draft kept on this device, per
 * user and branch, with the same safety rules. localStorage is replaced by an async store (AsyncStorage,
 * see services/branchDraftStore). Operations run one after another, so a slow write cannot overtake a
 * later remove. Storage failures are ignored. No runtime imports: tests load this file on its own.
 */
import type { LayoutDraft } from '@/types/branch-layout';

export interface StoredDraft {
  /** Server revision the draft was edited from. */
  revision: number;
  draft: LayoutDraft;
}

export interface DraftStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
}

const storageKey = (userId: string, branchId: string) =>
  `hs.branch-layout-draft.${userId}.${branchId}`;

type Node = {
  key?: unknown;
  id?: unknown;
  label?: unknown;
  roomCode?: unknown;
  rows?: unknown;
  slots?: unknown;
} | null;

/** The whole tree the editor relies on: every node has its own key, since edits find nodes by key. */
function isDraft(value: unknown): value is LayoutDraft {
  const keys = new Set<string>();
  const all = (nodes: unknown, check: (node: NonNullable<Node>) => boolean) =>
    Array.isArray(nodes) &&
    nodes.every((node: Node) => {
      if (!node || typeof node.key !== 'string' || !node.key || keys.has(node.key)) return false;
      keys.add(node.key);
      return (node.id === undefined || typeof node.id === 'string') && check(node);
    });
  return all(
    value,
    (floor) =>
      typeof floor.label === 'string' &&
      all(
        floor.rows,
        (row) =>
          typeof row.label === 'string' &&
          all(row.slots, (slot) => slot.roomCode === null || typeof slot.roomCode === 'string')
      )
  );
}

export function createLayoutDraftStore(storage: DraftStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(task: () => Promise<T>, fallback: T): Promise<T> => {
    const result = queue.then(task).catch(() => fallback);
    queue = result;
    return result;
  };

  return {
    read(userId: string | null | undefined, branchId: string): Promise<StoredDraft | null> {
      if (!userId) return Promise.resolve(null);
      return inOrder<StoredDraft | null>(async () => {
        const text = await storage.getItem(storageKey(userId, branchId));
        const value = JSON.parse(text ?? 'null') as StoredDraft | null;
        return value && Number.isInteger(value.revision) && isDraft(value.draft) ? value : null;
      }, null);
    },

    /** `null` removes the stored draft. */
    write(
      userId: string | null | undefined,
      branchId: string,
      value: StoredDraft | null
    ): Promise<void> {
      if (!userId) return Promise.resolve();
      // Serialized now: the caller may keep editing before the queue reaches this write.
      const text = value ? JSON.stringify(value) : null;
      return inOrder<void>(async () => {
        const key = storageKey(userId, branchId);
        if (text !== null) await storage.setItem(key, text);
        else await storage.removeItem(key);
      }, undefined);
    },

    /** Removes the stored draft only while it is still exactly `owned`; a newer one is kept. */
    removeOwned(
      userId: string | null | undefined,
      branchId: string,
      owned: StoredDraft
    ): Promise<void> {
      if (!userId) return Promise.resolve();
      const text = JSON.stringify(owned);
      return inOrder<void>(async () => {
        const key = storageKey(userId, branchId);
        if ((await storage.getItem(key)) === text) await storage.removeItem(key);
      }, undefined);
    },
  };
}
