// Phase 2 owner C. Web: components/contract/detail/ContractPdfViewerModal.tsx. Keep the props; replace the body.
import { ModalPlaceholder } from '@/screens/rental/placeholders';
import type { ContractDocumentResponse } from '@/types/rental/contract.type';

export type ContractPdfViewerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  document: ContractDocumentResponse | null;
};

export default function ContractPdfViewerModal(props: ContractPdfViewerModalProps) {
  return (
    <ModalPlaceholder
      visible={props.isOpen && props.document !== null}
      title="Xem hợp đồng"
      onClose={props.onClose}
    />
  );
}
