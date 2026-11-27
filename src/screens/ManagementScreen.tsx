import { useState } from 'react';

import type { MainTab } from '@/components/BottomTabBar';
import AppointmentsScreen from '@/components/appointment/manage/AppointmentsScreen';
import MyListingsScreen from '@/components/listing-manage/MyListingsScreen';
import MembershipScreen from '@/components/membership/MembershipScreen';
import BranchManagementScreen from '@/screens/BranchManagementScreen';
import type { ManagementSection } from '@/services/managementApi';

/** Own listings, membership, branches and appointments. Rental sections have their own screens (App). */
export default function ManagementScreen({
  onSelectTab,
  onOpenListing,
  initialSection: section,
  onExit,
  linkedAppointmentId,
  onLinkConsumed,
}: {
  onSelectTab: (tab: MainTab) => void;
  onOpenListing: (id: string, own?: boolean, section?: ManagementSection) => void;
  initialSection: ManagementSection;
  onExit: () => void;
  /** Id carried by a tapped notification: the appointment, or the membership order. */
  linkedAppointmentId?: string | null;
  onLinkConsumed?: () => void;
}) {
  // "Quản lý tin đăng" opened from the membership screen; Back returns to it.
  const [membershipListings, setMembershipListings] = useState(false);
  if (section === 'landlord-membership')
    return membershipListings ? (
      <MyListingsScreen onBack={() => setMembershipListings(false)} onSelectTab={onSelectTab} />
    ) : (
      <MembershipScreen
        initialOrderId={linkedAppointmentId ?? undefined}
        onBack={onExit}
        onManageListings={() => {
          onLinkConsumed?.();
          setMembershipListings(true);
        }}
      />
    );
  if (section === 'landlord-branches') return <BranchManagementScreen onBack={onExit} onSelectTab={onSelectTab} />;
  if (section === 'tenant-appointments' || section === 'landlord-appointments') {
    const owner = section === 'landlord-appointments';
    return (
      <AppointmentsScreen
        key={section}
        role={owner ? 'OWNER' : 'RENTER'}
        linkedAppointmentId={linkedAppointmentId}
        onLinkConsumed={onLinkConsumed}
        onBack={onExit}
        onSelectTab={onSelectTab}
        onOpenListing={(id) => onOpenListing(id, owner, section)}
      />
    );
  }
  return <MyListingsScreen onBack={onExit} onSelectTab={onSelectTab} />;
}
