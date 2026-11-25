import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type {
  ClosurePayload,
  ContractLifecycle,
  FinalCostsPayload,
} from '@/types/rental/contract-lifecycle.type';
const route = (id: string) => `/api/v1/contracts/${encodeURIComponent(id)}/lifecycle`;
async function post(id: string, path: string, payload?: unknown) {
  const { data } = await axiosClient.post<ApiResponse<ContractLifecycle>>(
    route(id) + path,
    payload
  );
  return data.result;
}
export const contractLifecycleService = {
  async get(id: string) {
    const { data } = await axiosClient.get<ApiResponse<ContractLifecycle>>(route(id));
    return data.result;
  },
  request: (id: string, months: number, note: string) => post(id, '/renewals', { months, note }),
  decide: (id: string, request: string, approve: boolean) =>
    post(id, `/renewals/${encodeURIComponent(request)}/${approve ? 'approve' : 'reject'}`),
  propose: (id: string, payload: ClosurePayload) => post(id, '/closure/propose', payload),
  finalCosts: (id: string, payload: FinalCostsPayload) => post(id, '/final-costs', payload),
  accept: (id: string, proposalVersion: number) =>
    post(id, '/closure/accept', {
      proposalVersion,
      handoverConfirmed: true,
      deductionsAccepted: true,
    }),
  dispute: (id: string, proposalVersion: number, reason: string, evidenceIds: string[]) =>
    post(id, '/closure/dispute', { proposalVersion, reason, evidenceIds }),
};
