// Phase 2 owner D. Web: components/payment/PaymentReceiptActions.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { PaymentReceipt } from '@/services/rental/payment-receipt.service';

export type PaymentReceiptActionsProps = {
  paymentId: string;
  receipt?: PaymentReceipt;
};

export default function PaymentReceiptActions(_props: PaymentReceiptActionsProps) {
  return <BlockPlaceholder title="Chứng từ thanh toán" />;
}
