// Web: components/contract/AgreementDocumentActions.tsx. Shared by request cards, the contract list
// and the lease detail page.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import ContractPdfViewerModal from '@/components/rental/contract/ContractPdfViewerModal';
import ActionButton from '@/components/rental/shared/ActionButton';
import { loadAgreementPreview } from '@/lib/rental/agreement-preview';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { requiresVerifiedContent } from '@/lib/rental/contract-document-history';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { contractService } from '@/services/rental/contract.service';
import type { ContractDocumentResponse, ContractResponse } from '@/types/rental/contract.type';

import { useToast } from './common';

export type AgreementDocumentActionsProps = {
  contract: ContractResponse;
  perspective: DashboardRole;
  showPrimary?: boolean;
  showDetails?: boolean;
  /** Mobile only: web link to the contract page. */
  onNavigate: RentalNavigate;
};

export default function AgreementDocumentActions({
  contract,
  perspective,
  showPrimary = true,
  showDetails = true,
  onNavigate,
}: AgreementDocumentActionsProps) {
  const toast = useToast();
  const [preview, setPreview] = useState<ContractDocumentResponse | null>(null);
  const [opening, setOpening] = useState(false);
  const request = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    const counter = request;
    return () => {
      ++counter.current;
    };
  }, [contract.id]);
  const deposit = contract.agreementKind === 'DEPOSIT';

  async function open(id: string) {
    if (lock.current) return;
    lock.current = true;
    setOpening(true);
    const sequence = ++request.current;
    try {
      const result = await loadAgreementPreview(id, contractService);
      if (sequence !== request.current) return;
      if (
        !requiresVerifiedContent(result.document) &&
        !result.document.viewUrl &&
        !result.document.downloadUrl
      )
        throw new Error('Tài liệu chưa có đường dẫn xem.');
      setPreview(result.document);
      if (result.depositFallback)
        toast.info('PDF hợp đồng thuê chưa sẵn sàng. Đang hiển thị hợp đồng cọc.');
    } catch (error) {
      if (sequence === request.current)
        toast.error(getApiErrorMessage(error, 'Không thể mở hợp đồng. Vui lòng thử lại.'));
    } finally {
      lock.current = false;
      // Unlike web, a switched contract also leaves the busy state.
      setOpening(false);
    }
  }

  const detailsLabel = deposit
    ? contract.status === 'ACTIVE' || contract.status === 'CANCELLED'
      ? 'Hồ sơ cọc'
      : 'Ký / theo dõi HĐ cọc'
    : [
          'DRAFT',
          'PENDING_REVIEW',
          'LANDLORD_SIGNATURE_PENDING',
          'TENANT_SIGNATURE_PENDING',
        ].includes(contract.status)
      ? 'Mở hồ sơ & ký HĐ thuê'
      : 'Mở hồ sơ HĐ thuê';

  return (
    <View accessibilityLabel="Tài liệu hợp đồng" className="flex-row flex-wrap gap-2">
      {showPrimary ? (
        <ActionButton
          label={opening ? 'Đang mở…' : deposit ? 'Xem HĐ cọc' : 'Xem HĐ thuê'}
          icon="eye-outline"
          variant="secondary"
          busy={opening}
          className="grow"
          onClick={() => void open(contract.id)}
        />
      ) : null}
      {!deposit && contract.depositAgreementContractId ? (
        <ActionButton
          label="Xem HĐ cọc"
          icon="document-text-outline"
          variant="secondary"
          disabled={opening}
          busy={opening && !showPrimary}
          className="grow"
          onClick={() => void open(contract.depositAgreementContractId!)}
        />
      ) : null}
      {showDetails ? (
        <ActionButton
          label={detailsLabel}
          variant="secondary"
          className="grow"
          onClick={() => onNavigate(contractDetailPath(perspective, contract.id))}
        />
      ) : null}
      <ContractPdfViewerModal
        isOpen={!!preview}
        document={preview}
        onClose={() => setPreview(null)}
      />
    </View>
  );
}
