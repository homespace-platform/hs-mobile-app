// OWNER: agent E. "Đăng tin cho phòng này": the existing ListingDraftScreen prefilled with the branch
// and linked to the room (web lib/listing-room-link.ts + RoomLinkBanner). The props are final.
import { useState } from 'react';

import type { MainTab } from '@/components/BottomTabBar';
import MembershipScreen from '@/components/membership/MembershipScreen';
import ListingDraftScreen from '@/screens/ListingDraftScreen';

export interface NewRoomListingScreenProps {
  branchId: string;
  roomId: string;
  /** Back to the branch, saved or not. */
  onClose: () => void;
  onSelectTab: (tab: MainTab) => void;
}

export default function NewRoomListingScreen({
  branchId,
  roomId,
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
