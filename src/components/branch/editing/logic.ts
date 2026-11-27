// Pure rules of the editing screens (tests/branch-editing.test.cjs).
import { fromLayout, sameLayout } from '@/lib/branch-layout';
import type { createLayoutDraftStore, StoredDraft } from '@/lib/branch-layout-draft';
import type { BranchLayout, LayoutDraft } from '@/types/branch-layout';

type DraftStore = ReturnType<typeof createLayoutDraftStore>;

// Shared by every editor instance: "read, then write" must not interleave with another operation.
let turn: Promise<unknown> = Promise.resolve();
function inTurn<T>(task: () => Promise<T>): Promise<T> {
  const result = turn.then(task);
  turn = result.catch(() => undefined);
  return result;
}

/** The stored draft as one editor session may touch it (web BranchLayoutEditor, `owned`). */
export function createDraftSession(store: DraftStore, userId: string, branchId: string) {
  /** The stored version this session wrote or took over: the only one it may delete. */
  let owned: StoredDraft | null = null;
  return {
    /** After the map loaded: the draft to offer, or null. A copy of the loaded tree is removed. */
    open: (layout: BranchLayout) =>
      inTurn(async () => {
        const stored = await store.read(userId, branchId);
        const unchanged =
          stored?.revision === layout.revision && sameLayout(stored.draft, fromLayout(layout));
        if (stored && unchanged) await store.removeOwned(userId, branchId, stored);
        return unchanged ? null : stored;
      }),
    /** The owner restored the offered draft: it is now this session's. */
    takeOver(stored: StoredDraft) {
      owned = stored;
    },
    /** The current unsaved tree. A stored draft of a newer revision is never overwritten. */
    keep(value: StoredDraft) {
      owned = value;
      return inTurn(async () => {
        const stored = await store.read(userId, branchId);
        if (!stored || stored.revision <= value.revision)
          await store.write(userId, branchId, value);
      });
    },
    forget() {
      const version = owned;
      owned = null;
      return inTurn(async () => {
        if (version) await store.removeOwned(userId, branchId, version);
      });
    },
    /** The owner refused the offered draft. */
    drop: (offer: StoredDraft) => inTurn(() => store.removeOwned(userId, branchId, offer)),
  };
}

/** The floor on screen: by key, else (removed, or new ids after a save) the same position. */
export function pickFloor(draft: LayoutDraft, picked: { key: string; index: number }) {
  const found = draft.findIndex((floor) => floor.key === picked.key);
  const index = found >= 0 ? found : Math.max(0, Math.min(picked.index, draft.length - 1));
  return { floor: draft[index] ?? null, index };
}

/**
 * Puts an old contract into the branch. Without a room it asks for the tray with `addToTray`: sending
 * `roomId: null` would erase the room already saved for a contract the tray only shows for now.
 */
export function addOldContract(
  api: {
    putContract: (branchId: string, contractId: string, roomId: string | null) => Promise<void>;
    addContractToTray: (branchId: string, contractId: string) => Promise<void>;
  },
  branchId: string,
  contractId: string,
  roomId: string | null
) {
  return roomId
    ? api.putContract(branchId, contractId, roomId)
    : api.addContractToTray(branchId, contractId);
}

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/** Accent-insensitive filter of a long room list. */
export const matchesText = (label: string, query: string) =>
  plain(label).includes(plain(query.trim()));
