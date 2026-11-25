import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type {
  ContractBlockchainProofResponse,
  ContractBlockchainVerificationResponse,
  DocumentIntegrityResponse,
} from '@/types/rental/blockchain.type';

const proofPath = (documentId: string) =>
  `/api/v1/contracts/documents/${encodeURIComponent(documentId)}/blockchain-proof`;

export const contractBlockchainService = {
  async checkIntegrity(
    documentId: string,
    signal?: AbortSignal
  ): Promise<DocumentIntegrityResponse> {
    const response = await axiosClient.post<ApiResponse<DocumentIntegrityResponse>>(
      `/api/v1/contracts/documents/${encodeURIComponent(documentId)}/integrity-check`,
      undefined,
      { signal }
    );
    return response.data.result;
  },

  async getProof(
    documentId: string,
    signal?: AbortSignal
  ): Promise<ContractBlockchainProofResponse> {
    const response = await axiosClient.get<ApiResponse<ContractBlockchainProofResponse>>(
      proofPath(documentId),
      { signal }
    );
    return response.data.result;
  },

  async verify(
    documentId: string,
    documentHash: string,
    signal?: AbortSignal
  ): Promise<ContractBlockchainVerificationResponse> {
    const response = await axiosClient.post<ApiResponse<ContractBlockchainVerificationResponse>>(
      `${proofPath(documentId)}/verify`,
      { documentHash },
      { signal }
    );
    return response.data.result;
  },
};
