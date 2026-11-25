// Phase 2 owner D. Web: components/payment/DepositLedgerSummary.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { DepositLedger } from '@/types/rental/deposit-ledger.type';

export type DepositLedgerSummaryProps = {
  ledger?: DepositLedger | null;
};

export default function DepositLedgerSummary(_props: DepositLedgerSummaryProps) {
  return <BlockPlaceholder title="Sổ cọc" />;
}
