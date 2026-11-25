// Phase 2 owner D. Web: app/dashboard/payments/page.tsx (paymentLink only). Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type PaymentLinkScreenProps = RentalScreenNavProps & {
  /**
   * Find it in paymentRequestService.getMyPaymentRequests() (never send it to an endpoint), then
   * onNavigate(paymentLink(p, userId).href, { replace: true }).
   */
  paymentId: string;
};

export default function PaymentLinkScreen(props: PaymentLinkScreenProps) {
  return <ScreenPlaceholder title={'Yêu cầu chuyển khoản'} onBack={props.onBack} />;
}
