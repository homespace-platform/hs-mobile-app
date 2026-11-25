// Phase 2 owner C. Web: components/contract/ContractDetailView.tsx. Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { ContractRouteQuery } from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type ContractDetailScreenProps = RentalScreenNavProps &
  ContractRouteQuery & {
    perspective: DashboardRole;
    contractId: string;
  };

export default function ContractDetailScreen(props: ContractDetailScreenProps) {
  return <ScreenPlaceholder title={'Chi tiết hợp đồng'} onBack={props.onBack} />;
}
