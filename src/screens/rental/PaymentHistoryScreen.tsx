// Phase 2 owner D. Web: app/dashboard/invoices/page.tsx + PaymentReceiptsPanel.tsx. Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type PaymentHistoryScreenProps = RentalScreenNavProps & {
  role: DashboardRole;
  contractId?: string;
};

export default function PaymentHistoryScreen(props: PaymentHistoryScreenProps) {
  return <ScreenPlaceholder title={'Lịch sử thanh toán'} onBack={props.onBack} />;
}
