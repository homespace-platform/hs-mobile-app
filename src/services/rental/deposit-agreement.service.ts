import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type { ContractResponse, ContractDocumentResponse } from '@/types/rental/contract.type';

export interface DepositAgreementView {
  required: boolean;
  signingAllowed: boolean;
  blockedReason: string | null;
  agreement: ContractResponse | null;
  documents: ContractDocumentResponse[];
  leaseContractId?: string | null;
  obligation?: string | null;
}
const base = (id: string) => `/api/v1/rental-requests/${encodeURIComponent(id)}/deposit-agreement`;
export const depositAgreementService = {
  async get(id: string) {
    return (await axiosClient.get<ApiResponse<DepositAgreementView>>(base(id))).data.result;
  },
  async prepare(id: string) {
    return (await axiosClient.post<ApiResponse<DepositAgreementView>>(`${base(id)}/prepare`)).data
      .result;
  },
  async reopen(id: string) {
    return (await axiosClient.post<ApiResponse<DepositAgreementView>>(`${base(id)}/reopen-signing`))
      .data.result;
  },
};
