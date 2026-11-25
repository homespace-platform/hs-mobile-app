// Phase 2 owner B. Web: components/contract/AgreementDocumentActions.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import type { ContractResponse } from '@/types/rental/contract.type';

export type AgreementDocumentActionsProps = {
  contract: ContractResponse;
  perspective: DashboardRole;
  showPrimary?: boolean;
  showDetails?: boolean;
  /** Mobile only: web link to the contract page. */
  onNavigate: RentalNavigate;
};

export default function AgreementDocumentActions(_props: AgreementDocumentActionsProps) {
  return <BlockPlaceholder title="Tài liệu hợp đồng" />;
}
