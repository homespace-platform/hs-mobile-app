/**
 * Navigation out of the branch screens. Branch screens only watch and lead: every action opens an
 * existing mobile screen over the branch, and Back returns to the same branch tab, layer and month.
 * The shell (screens/BranchManagementScreen) provides BranchNav; lib/branch-target turns a server
 * href into a destination; components/branch/attention/BranchDestinationHost draws it.
 */
import type { OverviewLayer, OverviewTarget } from '@/lib/branch-overview';
import type { RentalRoute } from '@/lib/rental-nav/routes';

export type BranchDestination =
  /** Contracts, invoices, payments and rental requests: the existing RentalNavigator. */
  | { kind: 'rental'; route: RentalRoute }
  /** The owner's view of one of their listings. */
  | { kind: 'listing'; listingId: string }
  | { kind: 'appointment'; appointmentId: string }
  /** The existing listing editor, linked to a room of the map. */
  | { kind: 'new-listing'; branchId: string; roomId: string }
  /** The existing listing editor on one listing (the owner fixes its room code there). */
  | { kind: 'edit-listing'; listingId: string }
  /** Handled by the shell itself: the "Chưa xếp phòng" tray of the open branch. */
  | { kind: 'tray'; branchId: string };

export type HostedDestination = Exclude<BranchDestination, { kind: 'tray' }>;

/** What the map tab shows. The shell keeps it, so Back from another screen restores it. */
export interface BranchViewState {
  /** null or unknown = the first floor. */
  floorId: string | null;
  layer: OverviewLayer;
  /** "YYYY-MM"; "" = the server's current month. */
  month: string;
}

export interface BranchNav {
  /** For a resource the screen already knows (see the builders in lib/branch-assignment). */
  open: (destination: BranchDestination) => void;
  /** For an overview or attention target; tells the owner when the phone cannot open it. */
  openTarget: (target: OverviewTarget) => void;
}
