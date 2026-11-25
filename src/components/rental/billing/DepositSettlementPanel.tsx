// Phase 2 owner D. Web: components/contract/page/DepositSettlementPanel.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { RentalNavigate } from '@/lib/rental-nav/routes';

export type DepositSettlementPanelProps = {
  rentalRequestId: string;
  isLandlord: boolean;
  onUpdated: () => Promise<void>;
  /** Mobile only: web links to the lease contract. */
  onNavigate: RentalNavigate;
};

export default function DepositSettlementPanel(_props: DepositSettlementPanelProps) {
  return <BlockPlaceholder title="Quyết toán & hoàn cọc" />;
}
