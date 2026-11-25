// Phase 2 owner B. Web: components/rental-request/DepositAgreementPanel.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { RentalNavigate } from '@/lib/rental-nav/routes';

export type DepositAgreementPanelProps = {
  rentalRequestId: string;
  isLandlord: boolean;
  onUpdated?: () => void | Promise<void>;
  /** Mobile only: web link to the lease contract. */
  onNavigate: RentalNavigate;
};

export default function DepositAgreementPanel(_props: DepositAgreementPanelProps) {
  return <BlockPlaceholder title="Hợp đồng đặt cọc" />;
}
