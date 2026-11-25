// Port of hs-web-app lib/rental-contract-fallback.ts (AbortSignal method -> throwIfAborted helper, see contract-preview).
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';
import type {
  ContractResponse,
  ContractCompletenessResponse,
  ContractDocumentResponse,
} from '@/types/rental/contract.type';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import {
  generateContractPreview,
  isUncertainPreviewError,
  throwIfAborted,
} from '@/lib/rental/contract-preview';

export function canOfferContractFallback(
  request: RentalRequestResponse,
  mode: 'RECEIVED' | 'SENT',
  contract?: ContractResponse | null,
  view?: RentalOnboarding | null
): boolean {
  if (mode !== 'RECEIVED' || request.status !== 'ACCEPTED' || contract) return false;
  if (view)
    return (
      view.askerRole === 'LANDLORD' && view.canPrepareContract && !view.cancellationRequestedAt
    );
  // The list summary represents the current receipt; a paid deposit alone is never enough.
  return (
    request.initialPayment?.type === 'INITIAL' && request.initialPayment.status === 'CONFIRMED'
  );
}

interface FallbackTransport {
  refresh: () => Promise<RentalOnboarding>;
  create: () => Promise<ContractResponse>;
  find: () => Promise<ContractResponse | null>;
  completeness: (id: string) => Promise<ContractCompletenessResponse>;
  preview: (id: string, signal: AbortSignal) => Promise<ContractDocumentResponse>;
  previewStatus: (id: string, signal: AbortSignal) => Promise<ContractDocumentResponse | null>;
}

/** Explicit retry of the existing workflow. Never bypass a missing template or create a new payment. */
export async function createRentalContractFallback(
  transport: FallbackTransport,
  signal: AbortSignal,
  onReconciling: () => void
) {
  throwIfAborted(signal);
  const view = await transport.refresh();
  throwIfAborted(signal);
  if (
    view.askerRole !== 'LANDLORD' ||
    !view.canPrepareContract ||
    view.cancellationRequestedAt ||
    !Number.isFinite(Date.parse(view.serverNow)) ||
    !Number.isFinite(Date.parse(view.paymentOpensAt)) ||
    Date.parse(view.serverNow) < Date.parse(view.paymentOpensAt)
  ) {
    throw new Error(
      'Chưa đủ điều kiện tạo hợp đồng. Cần xác nhận đủ cọc, tiền thuê tháng đầu và đến ngày bắt đầu thuê; hồ sơ không đang hủy.'
    );
  }
  let contract: ContractResponse;
  try {
    contract = await transport.create();
  } catch (error) {
    throwIfAborted(signal);
    if (!isUncertainPreviewError(error)) throw error;
    // Timeout may mean the POST already committed, or automation won the race. Read; never POST twice.
    const existing = await transport.find().catch(() => null);
    throwIfAborted(signal);
    if (!existing)
      throw new Error(
        'Chưa xác định được kết quả tạo hợp đồng. Vui lòng làm mới để kiểm tra; không cần thanh toán thêm.'
      );
    contract = existing;
  }
  throwIfAborted(signal);
  if (contract.status !== 'DRAFT') return { contract, fileState: 'EXISTING' as const };
  try {
    const completeness = await transport.completeness(contract.id);
    throwIfAborted(signal);
    if (!completeness.complete) return { contract, fileState: 'INCOMPLETE' as const };
    if (!contract.currentRevisionId) throw new Error('Bản nháp chưa có phiên bản để kết xuất.');
    const document = await generateContractPreview(
      {
        trigger: (signal) => transport.preview(contract.id, signal),
        status: (signal) => transport.previewStatus(contract.id, signal),
      },
      contract.currentRevisionId,
      signal,
      onReconciling
    );
    return { contract, fileState: document ? ('READY' as const) : ('PENDING' as const) };
  } catch (error) {
    throwIfAborted(signal);
    // The draft is committed. A file error must not be presented as a failed draft creation.
    return { contract, fileState: 'UNAVAILABLE' as const, fileError: error };
  }
}
