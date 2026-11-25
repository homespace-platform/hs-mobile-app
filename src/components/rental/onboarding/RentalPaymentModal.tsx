// Phase 2 owner B. Web: components/rental-request/RentalPaymentModal.tsx. Keep the props; replace the body.
import { ModalPlaceholder } from '@/screens/rental/placeholders';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

export type RentalPaymentModalProps = {
  request: Pick<RentalRequestResponse, 'id'> & Partial<RentalRequestResponse>;
  paymentId?: string;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (payment: PaymentRequest) => void;
};

export default function RentalPaymentModal(props: RentalPaymentModalProps) {
  return (
    <ModalPlaceholder
      visible={props.isOpen}
      title="Phiếu hướng dẫn chuyển khoản trực tiếp"
      onClose={props.onClose}
    />
  );
}
