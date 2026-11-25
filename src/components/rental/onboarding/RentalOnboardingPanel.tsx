// Phase 2 owner B. Web: components/rental-request/RentalOnboardingPanel.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';

export type PanelSection = 'summary' | 'sign' | 'payments' | 'end' | 'history';

export type RentalOnboardingPanelProps = {
  rentalRequestId: string;
  isLandlord?: boolean;
  onUpdated?: (view: RentalOnboarding) => void | Promise<void>;
  onSnapshot?: (view: RentalOnboarding) => void;
  showDepositAgreement?: boolean;
  sections?: PanelSection[];
  /** Mobile only: stands in for the web links inside the panel. */
  onNavigate: RentalNavigate;
};

export default function RentalOnboardingPanel(_props: RentalOnboardingPanelProps) {
  return <BlockPlaceholder title="Đặt cọc & nhận nhà" />;
}
