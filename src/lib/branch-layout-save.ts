// The save and load rules of hs-web-app components/branch/BranchLayoutEditor.tsx, kept pure.
import { isAxiosError } from 'axios';

import { buildTemplate, fromLayout, isSavedCopy, toSaveRequest } from '@/lib/branch-layout';
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
  | { kind: 'failed'; message: string };

const NOT_SAVED = 'Chưa lưu được sơ đồ.';

/**
 * Call only after validateDraft() returned no problem. `base` is the saved tree `next` was edited from.
 * Never throws.
 */
export async function saveLayoutDraft(
  api: LayoutApi,
  branchId: string,
  next: LayoutDraft,
  base: LayoutDraft,
  expectedRevision: number
): Promise<SaveOutcome> {
  try {
    const request = toSaveRequest(next, expectedRevision);
    return { kind: 'saved', layout: await api.saveLayout(branchId, request) };
  } catch (error) {
    const response = isAxiosError(error) ? error.response : undefined;
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
  return { layout, houseError: outcome.message };
}
