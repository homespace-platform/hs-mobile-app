// Phase 2 owner B. Web: components/contract/RentalReservationWorkspace.tsx. Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type ReservationWorkspaceScreenProps = RentalScreenNavProps & {
  perspective: DashboardRole;
  rentalId: string;
};

export default function ReservationWorkspaceScreen(props: ReservationWorkspaceScreenProps) {
  return <ScreenPlaceholder title={'Hồ sơ cọc & nhận nhà'} onBack={props.onBack} />;
}
