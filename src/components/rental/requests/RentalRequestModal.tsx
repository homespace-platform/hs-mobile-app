// Phase 2 owner A. Web: components/rental-request/RentalRequestModal.tsx. Keep the props; replace the body.
import { ModalPlaceholder } from '@/screens/rental/placeholders';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

export type RentalRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  listingAddress?: string;
  listingPrice?: number;
  depositType?: 'NONE' | 'FIXED_AMOUNT' | 'MONTH_COUNT' | 'NEGOTIABLE';
  listingDepositAmount?: number | null;
  depositMonths?: number | null;
  listingThumbnail?: string | null;
  minimumLeaseMonths?: number;
  listingMaxOccupants?: number | null;
  onSuccess?: (request: RentalRequestResponse) => void;
};

export default function RentalRequestModal(props: RentalRequestModalProps) {
  return (
    <ModalPlaceholder visible={props.isOpen} title="Yêu cầu thuê nhà" onClose={props.onClose} />
  );
}
