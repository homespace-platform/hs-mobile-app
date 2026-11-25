import type { AxiosRequestConfig } from 'axios';

import axiosClient from './client';
import { blobText, blobToCacheFile, sharePdf } from './files';
import { discardRentalFile, fileSessionGuard } from './cache';
import { primaryDocument } from '@/lib/rental/contract-document-history';
import { vnDateKey } from '@/lib/rental/format';
import type { ContractAmendments } from '@/types/rental/contract-amendment.type';
import type { ApiResponse, PageResponse } from '@/types/api';
import type {
  ContractCompletenessResponse,
  ContractListingSyncPreview,
  ContractDocumentResponse,
  ContractResponse,
  ContractRevisionResponse,
  ContractStatus,
  CreateContractDraftRequest,
  UpdateContractRevisionRequest,
  SignatureStateResponse,
  SignatureRequestResponse,
  CertificateOptionResponse,
} from '@/types/rental/contract.type';

export const contractService = {
  async getDocumentContent(
    documentId: string,
    download = false,
    signal?: AbortSignal
  ): Promise<Blob> {
    try {
      // The app endpoint sends opaque bytes so download managers do not capture the PDF response.
      const response = await axiosClient.post<Blob>(
        `/api/v1/contracts/documents/${encodeURIComponent(documentId)}/content`,
        null,
        { params: { download }, responseType: 'blob', signal }
      );
      return new Blob([response.data], { type: 'application/pdf' });
    } catch (error) {
      const failure = error as { response?: { data?: unknown } };
      if (failure.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await blobText(failure.response.data));
          throw new Error(
            typeof body.message === 'string'
              ? body.message
              : 'Chưa xác thực được tài liệu. Vui lòng thử lại.'
          );
        } catch (parsed) {
          if (parsed instanceof Error && !(parsed instanceof SyntaxError)) throw parsed;
        }
      }
      throw new Error(
        'Chưa tải được PDF đã kiểm tra. Hãy thử lại; lỗi kết nối không có nghĩa tài liệu bị sửa.'
      );
    }
  },

  async downloadDocument(document: ContractDocumentResponse): Promise<void> {
    const checkSession = fileSessionGuard();
    const bytes = await contractService.getDocumentContent(document.id, true);
    checkSession();
    const uri = await blobToCacheFile(bytes, document.fileName || 'hop-dong-da-ky.pdf');
    try {
      checkSession();
      await sharePdf(uri);
    } finally {
      await discardRentalFile(uri);
    }
  },

  async getSignatureState(contractId: string): Promise<SignatureStateResponse> {
    const response = await axiosClient.get<ApiResponse<SignatureStateResponse>>(
      `/api/v1/contracts/${contractId}/signatures/state`
    );
    return response.data.result;
  },

  async getSigningCertificates(contractId: string): Promise<CertificateOptionResponse[]> {
    const response = await axiosClient.get<ApiResponse<CertificateOptionResponse[]>>(
      `/api/v1/contracts/${contractId}/signatures/certificates`
    );
    return response.data.result || [];
  },

  async initiateSmartCaSignature(
    contractId: string,
    certificateSerial: string
  ): Promise<SignatureRequestResponse> {
    const response = await axiosClient.post<ApiResponse<SignatureRequestResponse>>(
      `/api/v1/contracts/${contractId}/signatures/initiate`,
      { certificateSerial, consent: true }
    );
    return response.data.result;
  },

  async refreshSmartCaSignature(
    contractId: string,
    requestId: string,
    options?: Pick<AxiosRequestConfig, 'signal' | 'timeout'>
  ): Promise<SignatureRequestResponse> {
    const response = await axiosClient.post<ApiResponse<SignatureRequestResponse>>(
      `/api/v1/contracts/${contractId}/signatures/${requestId}/refresh`,
      undefined,
      options
    );
    return response.data.result;
  },
  // --- Hợp đồng ---

  async getByRentalRequest(
    rentalRequestId: string,
    includeDepositFallback = false
  ): Promise<ContractResponse | null> {
    const response = await axiosClient.get<ApiResponse<ContractResponse | null>>(
      `/api/v1/contracts/by-rental-request/${rentalRequestId}`,
      { params: includeDepositFallback ? { includeDepositFallback: true } : undefined }
    );
    return response.data.result ?? null;
  },

  async createDraft(
    request: CreateContractDraftRequest,
    signal?: AbortSignal
  ): Promise<ContractResponse> {
    const response = await axiosClient.post<ApiResponse<ContractResponse>>(
      '/api/v1/contracts',
      request,
      { signal }
    );
    return response.data.result;
  },

  async listContracts(params?: {
    status?: ContractStatus;
    role?: 'LANDLORD' | 'TENANT';
    billableOnly?: boolean;
    includeDepositFallback?: boolean;
    agreementKind?: 'LEASE' | 'DEPOSIT';
    page?: number;
    size?: number;
  }): Promise<PageResponse<ContractResponse>> {
    const response = await axiosClient.get<PageResponse<ContractResponse>>('/api/v1/contracts', {
      params,
    });
    return response.data;
  },

  async getContract(contractId: string): Promise<ContractResponse> {
    const response = await axiosClient.get<ApiResponse<ContractResponse>>(
      `/api/v1/contracts/${contractId}`
    );
    return response.data.result;
  },

  async getRevision(contractId: string): Promise<ContractRevisionResponse> {
    const response = await axiosClient.get<ApiResponse<ContractRevisionResponse>>(
      `/api/v1/contracts/${contractId}/revision`
    );
    return response.data.result;
  },

  async previewListingSync(
    contractId: string,
    signal?: AbortSignal
  ): Promise<ContractListingSyncPreview> {
    const response = await axiosClient.get<ApiResponse<ContractListingSyncPreview>>(
      `/api/v1/contracts/${contractId}/listing-sync`,
      { signal }
    );
    return response.data.result;
  },

  async updateRevision(
    contractId: string,
    request: UpdateContractRevisionRequest,
    signal?: AbortSignal
  ): Promise<ContractRevisionResponse> {
    const response = await axiosClient.patch<ApiResponse<ContractRevisionResponse>>(
      `/api/v1/contracts/${contractId}/revision`,
      request,
      { signal }
    );
    return response.data.result;
  },

  async getCompleteness(contractId: string): Promise<ContractCompletenessResponse> {
    const response = await axiosClient.get<ApiResponse<ContractCompletenessResponse>>(
      `/api/v1/contracts/${contractId}/completeness`
    );
    return response.data.result;
  },

  /** Kết xuất bản nháp ra file. Trả về PDF nếu Gotenberg bật, ngược lại là DOCX. */
  async triggerPreview(
    contractId: string,
    signal?: AbortSignal,
    expectedRevisionId?: string
  ): Promise<ContractDocumentResponse> {
    const response = await axiosClient.post<ApiResponse<ContractDocumentResponse>>(
      `/api/v1/contracts/${contractId}/previews`,
      undefined,
      { timeout: 95_000, signal, params: { expectedRevisionId } }
    );
    return response.data.result;
  },

  async getPreviewStatus(
    contractId: string,
    signal?: AbortSignal
  ): Promise<ContractDocumentResponse | null> {
    const response = await axiosClient.get<ApiResponse<ContractDocumentResponse | null>>(
      `/api/v1/contracts/${contractId}/preview-status`,
      { timeout: 10_000, signal }
    );
    return response.data.result ?? null;
  },

  async sendToTenant(contractId: string): Promise<ContractResponse> {
    const response = await axiosClient.post<ApiResponse<ContractResponse>>(
      `/api/v1/contracts/${contractId}/send`
    );
    return response.data.result;
  },

  async sign(contractId: string): Promise<ContractResponse> {
    const response = await axiosClient.post<ApiResponse<ContractResponse>>(
      `/api/v1/contracts/${contractId}/sign`
    );
    return response.data.result;
  },

  async getDocument(documentId: string): Promise<ContractDocumentResponse> {
    const response = await axiosClient.get<ApiResponse<ContractDocumentResponse>>(
      `/api/v1/contracts/documents/${encodeURIComponent(documentId)}`
    );
    return response.data.result;
  },

  async getDocuments(contractId: string): Promise<ContractDocumentResponse[]> {
    const response = await axiosClient.get<ApiResponse<ContractDocumentResponse[]>>(
      `/api/v1/contracts/${contractId}/documents`
    );
    return response.data.result || [];
  },

  async getEffectiveDocument(contractId: string): Promise<ContractDocumentResponse | null> {
    // Use the existing server-resolved terms API, including on Core versions that
    // predate /effective-document. Never infer effectiveness from newest PDF/signature.
    const requested = await contractService.getContract(contractId);
    const root = requested.parentContractId
      ? await contractService.getContract(requested.parentContractId)
      : requested;
    if (requested.id !== contractId || !root.id || root.parentContractId)
      throw new Error('Không xác định được hợp đồng gốc để đối chiếu văn bản đang áp dụng.');
    if (root.agreedEarlyEndExclusive) {
      const response = await axiosClient.get<ApiResponse<ContractDocumentResponse | null>>(
        `/api/v1/contracts/${encodeURIComponent(root.id)}/effective-document`
      );
      const selected = response.data.result;
      if (!selected) return null;
      const agreement = await contractService.getContract(selected.contractId);
      if (
        agreement.parentContractId !== root.id ||
        agreement.agreementKind !== 'WORKFLOW' ||
        agreement.status !== 'ACTIVE' ||
        !agreement.signedAt ||
        agreement.currentRevisionId !== selected.revisionId
      )
        throw new Error('Phụ lục chấm dứt không khớp hợp đồng đang áp dụng.');
      const fresh = await contractService.getDocument(selected.id);
      if (
        fresh.id !== selected.id ||
        fresh.contractId !== agreement.id ||
        fresh.revisionId !== agreement.currentRevisionId ||
        fresh.status !== 'READY' ||
        fresh.purpose !== 'SIGNED_FINAL' ||
        fresh.documentType !== 'PDF' ||
        !fresh.storageObjectId
      )
        throw new Error('PDF đã ký không khớp phụ lục chấm dứt đang áp dụng.');
      return fresh;
    }
    const response = await axiosClient.get<ApiResponse<ContractAmendments>>(
      `/api/v1/contracts/${encodeURIComponent(root.id)}/amendments`
    );
    const state = response.data.result;
    if (!state?.currentTermsRevisionId || !Number.isFinite(Date.parse(state.serverNow)))
      throw new Error('Chưa xác định được phiên bản hợp đồng đang áp dụng từ hệ thống.');
    const today = vnDateKey(state.serverNow);
    const candidates =
      state.currentTermsRevisionId === root.currentRevisionId
        ? [root.id]
        : [...state.proposals]
            .filter(
              (p) =>
                p.signedAt &&
                ['APPLIED', 'SCHEDULED'].includes(p.status) &&
                p.agreementContractId &&
                p.effectiveOn <= today
            )
            .sort(
              (a, b) =>
                b.effectiveOn.localeCompare(a.effectiveOn) ||
                Date.parse(b.signedAt!) - Date.parse(a.signedAt!)
            )
            .map((p) => p.agreementContractId!);
    for (const ownerId of new Set(candidates)) {
      const rows = await contractService.getDocuments(ownerId);
      const match = primaryDocument(
        rows.filter((d) => d.contractId === ownerId && Boolean(d.storageObjectId)),
        true,
        state.currentTermsRevisionId
      );
      if (!match) continue;
      const fresh = await contractService.getDocument(match.id);
      if (
        fresh.id !== match.id ||
        fresh.contractId !== ownerId ||
        fresh.revisionId !== state.currentTermsRevisionId ||
        fresh.status !== 'READY' ||
        fresh.purpose !== 'SIGNED_FINAL' ||
        fresh.documentType !== 'PDF'
      )
        throw new Error(
          'Tệp nhận được không khớp phiên bản hợp đồng đang áp dụng. Vui lòng tải lại hồ sơ.'
        );
      return fresh;
    }
    return null;
  },
};
