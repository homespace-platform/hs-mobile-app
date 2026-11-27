// OWNER: agent A. Draws the existing mobile screen of a destination over the branch. Closing it
// returns to the branch screen as it was. Kind "new-listing" renders agent E's NewRoomListingScreen.
// Design: docs/chi-nhanh/00-thiet-ke.md section 4. The props are final.
import { useState } from 'react';

import AppointmentsScreen from '@/components/appointment/manage/AppointmentsScreen';
import type { MainTab } from '@/components/BottomTabBar';
import NewRoomListingScreen from '@/components/branch/editing/NewRoomListingScreen';
import MyListingsScreen from '@/components/listing-manage/MyListingsScreen';
import type { HostedDestination } from '@/lib/branch-nav';
import type { RentalRoute } from '@/lib/rental-nav/routes';
import ListingDetailScreen from '@/screens/ListingDetailScreen';
import RentalNavigator from '@/screens/rental/RentalNavigator';

export interface BranchDestinationHostProps {
  destination: HostedDestination;
  onClose: () => void;
  onSelectTab: (tab: MainTab) => void;
}

type TabProps = { onSelectTab: (tab: MainTab) => void };

/**
 * The owner's view of a listing. Status actions ("Gửi duyệt lại", "Hiển thị lại") live in the list of
 * own listings, so "Quản lý tin đăng" opens it here; Back comes back to the listing.
 */
function OwnListing({
  listingId,
  onBack,
  onSelectTab,
}: TabProps & { listingId: string; onBack: () => void }) {
  const [shown, setShown] = useState(listingId);
  const [list, setList] = useState(false);
  if (list) return <MyListingsScreen onBack={() => setList(false)} onSelectTab={onSelectTab} />;
  return (
    <ListingDetailScreen
      key={shown}
      listingId={shown}
      own
      onBack={onBack}
      onOpenListing={setShown}
      // The owner view has no chat actions.
      onOpenMessages={() => undefined}
      onOpenManagement={(section) => (section === 'landlord-properties' ? setList(true) : onBack())}
      onSelectTab={onSelectTab}
    />
  );
}

function Rental({
  route,
  onClose,
  onSelectTab,
}: TabProps & { route: RentalRoute; onClose: () => void }) {
  const [stack, setStack] = useState<RentalRoute[]>(() => [route]);
  // A listing opened from a rental record covers the flow; the stack stays here.
  const [listingId, setListingId] = useState<string | null>(null);
  if (listingId)
    return (
      <OwnListing
        listingId={listingId}
        onBack={() => setListingId(null)}
        onSelectTab={onSelectTab}
      />
    );
  return (
    <RentalNavigator
      stack={stack}
      onStackChange={setStack}
      role="landlord"
      onExit={onClose}
      onOpenListing={setListingId}
      onBrowseListings={() => onSelectTab('search')}
    />
  );
}

function Appointment({
  appointmentId,
  onClose,
  onSelectTab,
}: TabProps & { appointmentId: string; onClose: () => void }) {
  const [listingId, setListingId] = useState<string | null>(null);
  // Cleared when the detail closes, so coming back from a listing does not open it again.
  const [linked, setLinked] = useState<string | null>(appointmentId);
  if (listingId)
    return (
      <OwnListing
        listingId={listingId}
        onBack={() => setListingId(null)}
        onSelectTab={onSelectTab}
      />
    );
  return (
    <AppointmentsScreen
      role="OWNER"
      linkedAppointmentId={linked}
      onLinkConsumed={() => setLinked(null)}
      onLinkedClose={onClose}
      onBack={onClose}
      onOpenListing={setListingId}
      onSelectTab={onSelectTab}
    />
  );
}

export default function BranchDestinationHost({
  destination,
  onClose,
  onSelectTab,
}: BranchDestinationHostProps) {
  switch (destination.kind) {
    case 'new-listing':
      return (
        <NewRoomListingScreen
          branchId={destination.branchId}
          roomId={destination.roomId}
          onClose={onClose}
          onSelectTab={onSelectTab}
        />
      );
    case 'edit-listing':
      return (
        <NewRoomListingScreen
          listingId={destination.listingId}
          onClose={onClose}
          onSelectTab={onSelectTab}
        />
      );
    case 'rental':
      return <Rental route={destination.route} onClose={onClose} onSelectTab={onSelectTab} />;
    case 'listing':
      return (
        <OwnListing listingId={destination.listingId} onBack={onClose} onSelectTab={onSelectTab} />
      );
    case 'appointment':
      return (
        <Appointment
          appointmentId={destination.appointmentId}
          onClose={onClose}
          onSelectTab={onSelectTab}
        />
      );
  }
}
