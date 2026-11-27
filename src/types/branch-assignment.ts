/** Phase 2 contract under /api/v1/branches/{branchId} (design 01, section 3). */
export type RoomManualStatus = 'NONE' | 'EXTERNAL_RENT' | 'REPAIR';
export type AssignmentKind = 'LISTING' | 'CONTRACT';

export interface RoomListingLink {
  id: string;
  title: string;
  operationalStatus: string;
  /** Code the listing declares (room code / apartment unit); null for a whole house. Absent until the server sends it. */
  roomCode?: string | null;
}

export interface RoomContractLink {
  id: string;
  status: string;
  startDate: string | null;
  endDateExclusive: string | null;
  tenantName: string | null;
}

/** Accepted rental request that has no contract yet: read only. */
export interface RoomHold {
  rentalRequestId: string;
  moveInDate: string | null;
  tenantName: string | null;
}

export interface RoomAssignment {
  roomId: string;
  manualStatus: RoomManualStatus;
  listings: RoomListingLink[];
  contracts: RoomContractLink[];
  holds: RoomHold[];
}

export interface PageOf<T> {
  items: T[];
  /** 0-based. */
  page: number;
  size: number;
  totalElements: number;
}

export interface UnplacedItem {
  kind: AssignmentKind;
  id: string;
  label: string;
}

export interface BranchAssignments {
  rooms: RoomAssignment[];
  unplaced: PageOf<UnplacedItem>;
}

export interface AssignmentCandidate {
  id: string;
  label: string;
  /** Room it is linked to now; null = no room (in the tray, or not linked yet). */
  roomId: string | null;
  /** LISTING candidates only; same meaning as on RoomListingLink. */
  roomCode?: string | null;
}

/** A room of the saved map. */
export interface RoomOption {
  id: string;
  code: string;
  label: string;
}
