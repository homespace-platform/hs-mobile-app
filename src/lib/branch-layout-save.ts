// The save and load rules of hs-web-app components/branch/BranchLayoutEditor.tsx, kept pure.
import { isAxiosError } from 'axios';

import { lostAttachedRooms, roomOptions } from '@/lib/branch-assignment';
import type { BranchAssignments } from '@/types/branch-assignment';
import {
  buildTemplate,
  fromLayout,
  isSavedCopy,
  roomCodeError,
  setRoomCode,
  toSaveRequest,
  validateDraft,
} from '@/lib/branch-layout';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import type { BranchLayout, LayoutDraft, SaveBranchLayoutRequest } from '@/types/branch-layout';

export interface LayoutApi {
  getLayout: (branchId: string) => Promise<BranchLayout>;
  saveLayout: (branchId: string, request: SaveBranchLayoutRequest) => Promise<BranchLayout>;
}

export type SaveOutcome =
  /** Saved, possibly found out by reading the map back. Adopt `layout` and drop the stored draft. */
  | { kind: 'saved'; layout: BranchLayout }
  /** 409 while nobody changed the map: the server refused this save. Show its reason, keep the draft. */
  | { kind: 'refused'; message: string }
  /** The map changed elsewhere: keep the draft, block saving, offer to reload. */
  | { kind: 'conflict' }
  | { kind: 'failed'; message: string }
  /** 409/4093: the links on removed rooms changed since they were confirmed. Nothing was written. */
  | { kind: 'links-changed' }
  /** The owner declined the question about the links; the draft stays. */
  | { kind: 'cancelled' };

export interface AcknowledgedDetach {
  listingIds: string[];
  contractIds: string[];
}

const NOT_SAVED = 'Chưa lưu được sơ đồ.';
const LINKS_CHANGED = 4093;

/**
 * Call only after validateDraft() returned no problem. `base` is the saved tree `next` was edited from.
 * Never throws.
 */
export async function saveLayoutDraft(
  api: LayoutApi,
  branchId: string,
  next: LayoutDraft,
  base: LayoutDraft,
  expectedRevision: number,
  acknowledgedDetach: AcknowledgedDetach = { listingIds: [], contractIds: [] }
): Promise<SaveOutcome> {
  try {
    const request = { ...toSaveRequest(next, expectedRevision), acknowledgedDetach };
    return { kind: 'saved', layout: await api.saveLayout(branchId, request) };
  } catch (error) {
    const response = isAxiosError(error) ? error.response : undefined;
    if (response?.status === 409 && Number(response.data?.code) === LINKS_CHANGED)
      return { kind: 'links-changed' };
    // A lost response (or a 409 from resending it) may mean the save already went through.
    if (!response || response.status === 409) {
      const latest = await api.getLayout(branchId).catch(() => null);
      if (
        latest &&
        latest.revision === expectedRevision + 1 &&
        isSavedCopy(fromLayout(latest), next, base)
      )
        return { kind: 'saved', layout: latest };
      // Same revision after a 409: e.g. a removed room still has a contract.
      if (response && latest?.revision === expectedRevision)
        return { kind: 'refused', message: getApiErrorMessage(error, NOT_SAVED) };
    }
    if (response?.status === 409) return { kind: 'conflict' };
    return {
      kind: 'failed',
      message: response
        ? getApiErrorMessage(error, NOT_SAVED)
        : 'Không kết nối được máy chủ. Hãy thử lưu lại.',
    };
  }
}

export type LostRoom = ReturnType<typeof lostAttachedRooms>[number];

/**
 * Save with the owner's consent to detach links. Each round reads the assignments fresh, asks about
 * the rooms about to go (`links` null = unreadable) and sends exactly what was confirmed. On 4093 it
 * re-reads and asks again; a repeat of the same confirmation is not resent. Never throws.
 */
export async function saveWithLinks(
  api: LayoutApi,
  readLinks: () => Promise<BranchAssignments | null>,
  ask: (lost: LostRoom[], links: BranchAssignments | null) => Promise<boolean>,
  branchId: string,
  next: LayoutDraft,
  base: LayoutDraft,
  expectedRevision: number
): Promise<Exclude<SaveOutcome, { kind: 'links-changed' }>> {
  const kept = new Set(roomOptions(next).map((room) => room.id));
  const removes = roomOptions(base).some((room) => !kept.has(room.id));
  let sent = '';
  for (let round = 0; ; round++) {
    let ack: AcknowledgedDetach = { listingIds: [], contractIds: [] };
    // Without a removed room there is nothing to ask, unless the server says links changed anyway.
    if (removes || round > 0) {
      const links = await readLinks();
      const byId = new Map((links?.rooms ?? []).map((room) => [room.roomId, room]));
      const lost = lostAttachedRooms(base, next, byId);
      if (removes && (!links || lost.length > 0) && !(await ask(lost, links)))
        return { kind: 'cancelled' };
      const gone = lost.map((room) => byId.get(room.id)!);
      ack = {
        listingIds: gone.flatMap((room) => room.listings.map((item) => item.id)),
        contractIds: gone.flatMap((room) => room.contracts.map((item) => item.id)),
      };
    }
    const key = JSON.stringify(ack);
    if (round > 0 && key === sent)
      return { kind: 'failed', message: 'Liên kết của phòng bị bỏ liên tục thay đổi nên chưa lưu được. Bản nháp vẫn còn, hãy thử lại sau.' };
    sent = key;
    const outcome = await saveLayoutDraft(api, branchId, next, base, expectedRevision, ack);
    if (outcome.kind === 'links-changed') continue;
    return outcome;
  }
}

/**
 * The map of a branch. A whole house without a map gets the one-cell map here (concept §3), so the
 * editor must not create it again. If that save fails the empty map is returned with the reason.
 */
export async function loadBranchLayout(
  api: LayoutApi,
  branchId: string,
  createHouse: boolean
): Promise<{ layout: BranchLayout; houseError: string }> {
  const layout = await api.getLayout(branchId);
  if (!createHouse || layout.revision !== 0) return { layout, houseError: '' };
  const outcome = await saveLayoutDraft(api, branchId, buildTemplate({ kind: 'house' }), [], 0);
  if (outcome.kind === 'saved') return { layout: outcome.layout, houseError: '' };
  if (outcome.kind === 'conflict') return { layout: await api.getLayout(branchId), houseError: '' };
  return { layout, houseError: 'message' in outcome ? outcome.message : NOT_SAVED };
}

export type RecodeOutcome =
  | { kind: 'saved'; layout: BranchLayout }
  /** Nothing was sent; `message` says why. */
  | { kind: 'blocked'; message: string }
  /** The map changed elsewhere: read it again, then offer the action again. */
  | { kind: 'conflict' }
  | { kind: 'failed'; message: string };

/**
 * "Đổi mã ô thành <mã tin>": renames one saved room through the normal layout save (revision,
 * acknowledgedDetach, 409 handling). `hasDraft` answers whether this phone holds unsaved map edits:
 * the save would make that draft stale, so it is refused until the owner deals with the draft.
 * Never throws.
 */
export async function recodeSavedRoom(
  api: LayoutApi,
  branchId: string,
  layout: BranchLayout,
  roomId: string,
  code: string,
  hasDraft: () => Promise<boolean>
): Promise<RecodeOutcome> {
  const base = fromLayout(layout);
  const found = base.flatMap((floor) => floor.rows.flatMap((row) => row.slots)).find(
    (slot) => slot.id === roomId && slot.roomCode !== null
  );
  if (!found) return { kind: 'blocked', message: 'Ô này không còn trong sơ đồ. Hãy tải lại sơ đồ.' };
  const reason = roomCodeError(base, found.key, code);
  if (reason) return { kind: 'blocked', message: reason };
  const next = setRoomCode(base, found.key, code);
  const problem = validateDraft(next)[0];
  if (problem) return { kind: 'blocked', message: problem };
  if (await hasDraft())
    return {
      kind: 'blocked',
      message:
        'Bạn có bản nháp sơ đồ chưa lưu trên máy này. Hãy mở Sửa sơ đồ để lưu hoặc bỏ bản nháp, rồi đổi mã.',
    };
  const outcome = await saveLayoutDraft(api, branchId, next, base, layout.revision);
  if (outcome.kind === 'saved') return outcome;
  if (outcome.kind === 'conflict') return outcome;
  if (outcome.kind === 'failed' || outcome.kind === 'refused')
    return { kind: 'failed', message: outcome.message };
  return { kind: 'failed', message: NOT_SAVED };
}
