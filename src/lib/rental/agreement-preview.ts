// Port of hs-web-app lib/agreement-preview.ts (verbatim; only import paths changed).
import type { ContractDocumentResponse, ContractResponse } from '@/types/rental/contract.type';
import { primaryDocument } from '@/lib/rental/contract-document-history';

interface PreviewApi {
  getContract(id: string): Promise<ContractResponse>;
  getDocuments(id: string): Promise<ContractDocumentResponse[]>;
  getDocument(id: string): Promise<ContractDocumentResponse>;
}

/** Only fall back when a successful read confirms that the lease PDF is not ready. */
export async function loadAgreementPreview(
  contractId: string,
  api: PreviewApi
): Promise<{ document: ContractDocumentResponse; depositFallback: boolean }> {
  const contract = await api.getContract(contractId);
  const signed =
    Boolean(contract.signedAt) ||
    ['ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED'].includes(contract.status);
  const documents = await api.getDocuments(contract.id);
  const selected = primaryDocument(documents, signed, contract.currentRevisionId);
  if (selected) return { document: await api.getDocument(selected.id), depositFallback: false };
  if (contract.agreementKind !== 'DEPOSIT' && !signed && contract.depositAgreementContractId) {
    const fallback = await loadAgreementPreview(contract.depositAgreementContractId, api);
    return { ...fallback, depositFallback: true };
  }
  throw new Error(
    signed
      ? 'Bản PDF đã ký chưa sẵn sàng. Vui lòng tải lại sau.'
      : 'PDF chưa sẵn sàng. Mở hồ sơ hợp đồng để kiểm tra tiến trình.'
  );
}
