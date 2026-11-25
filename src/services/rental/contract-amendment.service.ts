import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type {
  AmendmentPayload,
  ContractAmendments,
  AmendmentComparison,
  AmendmentTerms,
  AmendmentOptions,
} from '@/types/rental/contract-amendment.type';

export const contractAmendmentService = {
  async get(id: string) {
    return (
      await axiosClient.get<ApiResponse<ContractAmendments>>(`/api/v1/contracts/${id}/amendments`)
    ).data.result;
  },
  async options(id: string) {
    return (
      await axiosClient.get<ApiResponse<AmendmentOptions>>(
        `/api/v1/contracts/${id}/amendments/options`
      )
    ).data.result;
  },
  async draft(id: string) {
    return (
      await axiosClient.get<ApiResponse<AmendmentPayload | null>>(
        `/api/v1/contracts/${id}/amendments/draft`
      )
    ).data.result;
  },
  async saveDraft(id: string, payload: AmendmentPayload) {
    return (
      await axiosClient.put<ApiResponse<AmendmentPayload>>(
        `/api/v1/contracts/${id}/amendments/draft`,
        payload
      )
    ).data.result;
  },
  async discardDraft(id: string) {
    await axiosClient.delete(`/api/v1/contracts/${id}/amendments/draft`);
  },
  async requestNegotiation(
    id: string,
    payload: { requestId: string; message: string; evidenceIds: string[] }
  ) {
    return (
      await axiosClient.post<ApiResponse<ContractAmendments>>(
        `/api/v1/contracts/${id}/amendments/tenant-requests`,
        payload
      )
    ).data.result;
  },
  async decideNegotiation(
    id: string,
    requestId: string,
    action: 'ACCEPT' | 'REJECT',
    note?: string
  ) {
    return (
      await axiosClient.post<ApiResponse<ContractAmendments>>(
        `/api/v1/contracts/${id}/amendments/tenant-requests/${requestId}/decision`,
        { action, note }
      )
    ).data.result;
  },
  async preview(id: string, payload: AmendmentPayload) {
    return (
      await axiosClient.post<
        ApiResponse<{ terms: AmendmentTerms; comparison: AmendmentComparison[] }>
      >(`/api/v1/contracts/${id}/amendments/preview`, payload)
    ).data.result;
  },
  async propose(id: string, payload: AmendmentPayload) {
    return (
      await axiosClient.post<ApiResponse<ContractAmendments>>(
        `/api/v1/contracts/${id}/amendments`,
        payload
      )
    ).data.result;
  },
  async decide(
    id: string,
    proposalId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'WITHDRAW' | 'CANCEL',
    note?: string
  ) {
    return (
      await axiosClient.post<ApiResponse<ContractAmendments>>(
        `/api/v1/contracts/${id}/amendments/${proposalId}/decision`,
        { action, note }
      )
    ).data.result;
  },
};
