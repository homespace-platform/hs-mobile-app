// Phase 2 owner B. Web: components/rental-request/RentalStartChangeQuickModal.tsx. Keep the props; replace the body.
import { BlockPlaceholder, ModalPlaceholder } from '@/screens/rental/placeholders';
import type { RentalListMode } from '@/lib/rental-nav/routes';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

export function StartChangeNotice(_props: {
  request: RentalRequestResponse;
  mode: RentalListMode;
  onOpen: () => void;
}) {
  return <BlockPlaceholder title="Đề nghị bắt đầu thuê sớm" />;
}

export type RentalStartChangeQuickModalProps = {
  request: RentalRequestResponse;
  mode: RentalListMode;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
};

export default function RentalStartChangeQuickModal(props: RentalStartChangeQuickModalProps) {
  return (
    <ModalPlaceholder visible={true} title="Đề nghị bắt đầu thuê sớm" onClose={props.onClose} />
  );
}
