// OWNER: agent E. "Đăng tin cho phòng này": the existing ListingDraftScreen prefilled with the branch
// and linked to the room (web lib/listing-room-link.ts + RoomLinkBanner). The props are final.
import { useState } from 'react';

import type { MainTab } from '@/components/BottomTabBar';
import MembershipScreen from '@/components/membership/MembershipScreen';
import ListingDraftScreen from '@/screens/ListingDraftScreen';

export interface NewRoomListingScreenProps {
  /** A new listing for this room; without them, the editor opens `listingId`. */
  branchId?: string;
  roomId?: string;
  listingId?: string;
  /** Back to the branch, saved or not. */
  onClose: () => void;
  onSelectTab: (tab: MainTab) => void;
}

export default function NewRoomListingScreen({
  branchId,
  roomId,
  listingId,
  onClose,
}: NewRoomListingScreenProps) {
  // As in MyListingsScreen: leaving the editor for the membership screen replaces it.
  const [membership, setMembership] = useState<{ addon: boolean } | null>(null);
  if (membership)
    return (
      <MembershipScreen
        initialAddon={membership.addon}
        onBack={onClose}
        onManageListings={onClose}
      />
    );
  return (
    <ListingDraftScreen
      listingId={listingId}
      branchId={branchId}
      roomId={roomId}
      onBack={onClose}
      onSaved={onClose}
      // `=== true`: some buttons call this with their press event.
      onOpenMembership={(addon) => setMembership({ addon: addon === true })}
      onManageListings={onClose}
    />
  );
}
