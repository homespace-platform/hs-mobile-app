/** Phase 1 contract of GET/PUT /api/v1/branches/{branchId}/layout. */
export interface BranchSlot {
  id: string;
  /** null = empty cell (stairs / aisle). */
  roomCode: string | null;
}

export interface BranchRow {
  id: string;
  label: string;
  slots: BranchSlot[];
}

export interface BranchFloor {
  id: string;
  label: string;
  rows: BranchRow[];
}

export interface BranchLayout {
  /** 0 = the map has not been set up yet. */
  revision: number;
  floors: BranchFloor[];
}

export interface SaveBranchLayoutRequest {
  expectedRevision: number;
  floors: {
    id?: string;
    label: string;
    rows: {
      id?: string;
      label: string;
      slots: { id?: string; roomCode: string | null }[];
    }[];
  }[];
}

/** Local draft: `key` is stable on screen, `id` exists only for nodes the server already saved. */
export interface DraftSlot {
  key: string;
  id?: string;
  roomCode: string | null;
}

export interface DraftRow {
  key: string;
  id?: string;
  label: string;
  slots: DraftSlot[];
}

export interface DraftFloor {
  key: string;
  id?: string;
  label: string;
  rows: DraftRow[];
}

export type LayoutDraft = DraftFloor[];
