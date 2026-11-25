// RentalRequestsManagement.tsx:57-123 — the landlord's "Tạo hợp đồng" chain (A-069…A-075).
import { useEffect, useRef, useState } from 'react';

import { useDialog } from '@/components/AppDialog';
import { hasProfileGateNotice } from '@/lib/profile-gate-signal';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { createRentalContractFallback } from '@/lib/rental/rental-contract-fallback';
import { contractService } from '@/services/rental/contract.service';
import { rentalOnboardingService } from '@/services/rental/rental-onboarding.service';
import type { ContractResponse } from '@/types/rental/contract.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { draftResultNotice, draftResultTone, type Mode } from './logic';

export function useContractDraft({
  mode,
  contractsByRequest,
  rememberContract,
  onCreated,
}: {
  mode: Mode;
  contractsByRequest: Record<string, ContractResponse | null>;
  rememberContract: (requestId: string, contract: ContractResponse) => void;
  onCreated: (contractId: string) => void;
}) {
  const showDialog = useDialog();
  const lock = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const [creatingContractFor, setCreatingContractFor] = useState<string | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const createDraft = async (request: RentalRequestResponse) => {
    if (
      lock.current ||
      mode !== 'RECEIVED' ||
      request.status !== 'ACCEPTED' ||
      contractsByRequest[request.id]
    )
      return;
    lock.current = true;
    setCreatingContractFor(request.id);
    const controller = new AbortController();
    pending.current = controller;
    try {
      const result = await createRentalContractFallback(
        {
          refresh: () => rentalOnboardingService.refresh(request.id),
          create: () =>
            contractService.createDraft({ rentalRequestId: request.id }, controller.signal),
          find: () => contractService.getByRentalRequest(request.id),
          completeness: (id) => contractService.getCompleteness(id),
          preview: (id, signal) => contractService.triggerPreview(id, signal),
          previewStatus: (id, signal) => contractService.getPreviewStatus(id, signal),
        },
        controller.signal,
        () => showDialog('Thông báo', 'Đang kiểm tra kết quả kết xuất; vui lòng không bấm tạo lại.')
      );
      if (controller.signal.aborted) return;
      rememberContract(request.id, result.contract);
      showDialog(
        'Thông báo',
        draftResultNotice(result.fileState),
        undefined,
        draftResultTone(result.fileState)
      );
      onCreated(result.contract.id);
    } catch (error) {
      if (!controller.signal.aborted && !hasProfileGateNotice(error))
        showDialog(
          'Thông báo',
          getApiErrorMessage(
            error,
            'Chưa thể tạo bản nháp hợp đồng. Vui lòng kiểm tra tiến trình nhận nhà và mẫu hợp đồng.'
          )
        );
    } finally {
      lock.current = false;
      pending.current = null;
      setCreatingContractFor(null);
    }
  };
  return { createDraft, creatingContractFor };
}
