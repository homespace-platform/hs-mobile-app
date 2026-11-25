// Phase 2 owner C. Web: app/dashboard/contracts/[id]/page.tsx. Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { ContractRouteQuery } from '@/lib/rental/contract-routes';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type ContractLandingScreenProps = RentalScreenNavProps & {
  /** Already passed safeResourceId. */
  contractId: string;
  /** Hand to contractLandingTarget, then onNavigate(target, { replace: true }). */
  query: ContractRouteQuery;
};

export default function ContractLandingScreen(props: ContractLandingScreenProps) {
  return <ScreenPlaceholder title={'Chi tiết hợp đồng'} onBack={props.onBack} />;
}
