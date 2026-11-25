// Phase 2 owner D. Web: components/contract/detail/MonthlyInvoicesSection.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';

export type MonthlyInvoicesSectionProps = {
  contractId: string;
  rentalRequestId: string;
  contractActive: boolean;
  isLandlord: boolean;
  isTenant: boolean;
  electricityRequired: boolean;
  waterRequired: boolean;
  unsupportedWaterRate: boolean;
  initialElectricity?: string | number;
  initialWater?: string | number;
  requestedInvoiceId?: string | null;
  /** Raw ?invoice= rejected as malformed. Presence only: never sent to an API or used in a selector. */
  invalidInvoiceRequest?: string | null;
  onUpdated?: () => Promise<void>;
};

export default function MonthlyInvoicesSection(_props: MonthlyInvoicesSectionProps) {
  return <BlockPlaceholder title="Hóa đơn hàng tháng" />;
}
