// Phase 2 owner B. Web: components/rental-request/RentalWorkflowPanel.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import type { WorkflowKind } from '@/types/rental/rental-workflow.type';

export type RentalWorkflowPanelProps = {
  rentalRequestId: string;
  kind: WorkflowKind;
  contractId?: string;
  focusRequest?: boolean;
  agreementId?: string;
  onUpdated?: () => Promise<unknown> | void;
  /** Mobile only: web link to the invoices of the contract. */
  onNavigate: RentalNavigate;
};

export default function RentalWorkflowPanel(_props: RentalWorkflowPanelProps) {
  return <BlockPlaceholder title="Xử lý hồ sơ thuê" />;
}
