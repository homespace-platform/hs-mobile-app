// Phase 2 owner D. Web: app/dashboard/complaints/page.tsx (ComplaintPanel). Keep the props; replace the body.
import { ScreenPlaceholder } from '@/screens/rental/placeholders';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';

export type ComplaintScreenProps = RentalScreenNavProps & {
  rentalRequestId: string;
  initialComplaintId: string;
};

export default function ComplaintScreen(props: ComplaintScreenProps) {
  return <ScreenPlaceholder title={'Khiếu nại'} onBack={props.onBack} />;
}
