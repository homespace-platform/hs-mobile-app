// Phase 2 owner A. Web: components/rental-request/RentalRequestsManagement.tsx. Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { RentalListMode, RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type RentalRequestsScreenProps = RentalScreenNavProps & {
  mode: RentalListMode;
  /** ?requestId= (already a UUID). Clear it with onNavigate({ screen, mode }, { replace: true }). */
  requestId?: string;
  /** ?requestId= was not a UUID: toast DEEP_LINK_INVALID once, then clear. */
  invalidLink?: boolean;
  /** Web link to the listing page. */
  onOpenListing: (listingId: string) => void;
  /** Web link /rent in the empty state. */
  onBrowseListings: () => void;
};

export default function RentalRequestsScreen(props: RentalRequestsScreenProps) {
  return (
    <ScreenPlaceholder
      title={props.mode === 'RECEIVED' ? 'Yêu cầu thuê' : 'Yêu cầu đã gửi'}
      onBack={props.onBack}
    />
  );
}
