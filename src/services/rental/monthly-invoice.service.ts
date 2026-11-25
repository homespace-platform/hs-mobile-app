import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type {
  IssueMonthlyInvoicePayload,
  MonthlyInvoice,
} from '@/types/rental/monthly-invoice.type';

export const monthlyInvoiceService = {
  async issueUnilateralTermination(id: string, reason: string): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/unilateral-termination`,
      { reason }
    );
    return data.result;
  },
  async requestTerminationReview(
    id: string,
    noticeId: string,
    payload: {
      expectedVersion: number;
      option: 'ROLLOVER' | 'PAYMENT_EXTENSION';
      days?: number;
      reason: string;
    }
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/unilateral-termination/${noticeId}/review`,
      payload
    );
    return data.result;
  },
  async decideTerminationReview(
    id: string,
    noticeId: string,
    expectedVersion: number,
    approve: boolean,
    reason: string
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/unilateral-termination/${noticeId}/decision`,
      { expectedVersion, approve, reason }
    );
    return data.result;
  },
  async withdrawUnilateralTermination(
    id: string,
    noticeId: string,
    expectedVersion: number
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/unilateral-termination/${noticeId}/withdraw`,
      { expectedVersion }
    );
    return data.result;
  },
  async completeUnilateralHandover(
    id: string,
    noticeId: string,
    expectedVersion: number
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/unilateral-termination/${noticeId}/handover`,
      { expectedVersion, vacantPossessionConfirmed: true, keysAndAssetsReturned: true }
    );
    return data.result;
  },
  async requestPaymentExtension(id: string, days: number, note: string): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/extension-requests`,
      { days, note }
    );
    return data.result;
  },
  async decidePaymentExtension(
    id: string,
    requestId: string,
    approve: boolean
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/extension-requests/${requestId}/${approve ? 'approve' : 'reject'}`
    );
    return data.result;
  },
  async extendPaymentDirectly(id: string, days: number, note: string): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/extend-payment`,
      { days, note }
    );
    return data.result;
  },
  async list(contractId: string): Promise<MonthlyInvoice[]> {
    const { data } = await axiosClient.get<ApiResponse<MonthlyInvoice[]>>(
      `/api/v1/monthly-invoices/contracts/${contractId}`
    );
    return data.result || [];
  },
  async issue(id: string, payload: IssueMonthlyInvoicePayload): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/issue`,
      payload
    );
    return data.result;
  },
  async prepare(id: string, payload: IssueMonthlyInvoicePayload): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/prepare`,
      payload
    );
    return data.result;
  },
  async acknowledgeOverdueAction(
    id: string,
    actionId: string,
    note: string
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/overdue-actions/${actionId}/acknowledge`,
      { note }
    );
    return data.result;
  },
  async deferToNextPeriod(id: string): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/defer-to-next-period`
    );
    return data.result;
  },
  async acceptTermination(
    id: string,
    payload: {
      acceptEarlyTermination: boolean;
      acceptDepositRetention: boolean;
      acknowledgeOutstandingDebt: boolean;
    }
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/termination/accept`,
      payload
    );
    return data.result;
  },
  async declineTermination(id: string): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/termination/decline`
    );
    return data.result;
  },
  async withdrawTermination(id: string): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/termination/withdraw`
    );
    return data.result;
  },
  async completeTermination(
    id: string,
    payload: { vacantPossessionConfirmed: boolean; keysAndAssetsReturned: boolean }
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/termination/complete`,
      payload
    );
    return data.result;
  },
  async forceTerminationAfterDecline(
    id: string,
    payload: {
      signedClauseAcknowledged: boolean;
      tenantNotified: boolean;
      vacantPossessionConfirmed: boolean;
      keysAndAssetsReturned: boolean;
    }
  ): Promise<MonthlyInvoice> {
    const { data } = await axiosClient.post<ApiResponse<MonthlyInvoice>>(
      `/api/v1/monthly-invoices/${id}/termination/force-after-decline`,
      payload
    );
    return data.result;
  },
};
