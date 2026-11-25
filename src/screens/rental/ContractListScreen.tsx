// Phase 2 owner C. Web: components/contract/ContractListView.tsx. Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type ContractListScreenProps = RentalScreenNavProps & {
  perspective: DashboardRole;
  /** ?kind=. Switching it: onNavigate({ screen: 'contract-list', side, kind }, { replace: true }). */
  kind: 'LEASE' | 'DEPOSIT';
};

export default function ContractListScreen(props: ContractListScreenProps) {
  return (
    <ScreenPlaceholder
      title={props.perspective === 'landlord' ? 'Hợp đồng cho thuê' : 'Hợp đồng đi thuê'}
      onBack={props.onBack}
    />
  );
}
