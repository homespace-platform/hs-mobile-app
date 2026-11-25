// Phase 2 owner B. Web: components/rental-request/RentalDepositQuickViewModal.tsx. Keep the props; replace the body.
import { BlockPlaceholder, ModalPlaceholder } from '@/screens/rental/placeholders';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

export function RentalReceiptNotice(_props: {
  request: RentalRequestResponse;
  onOpen: () => void;
}) {
  return <BlockPlaceholder title="Thông báo thanh toán" />;
}

export type RentalDepositQuickViewModalProps = {
  request: RentalRequestResponse;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
  onOpenDetail: () => void;
};

export default function RentalDepositQuickViewModal(props: RentalDepositQuickViewModalProps) {
  return <ModalPlaceholder visible={true} title="Xem nhanh thanh toán" onClose={props.onClose} />;
}
