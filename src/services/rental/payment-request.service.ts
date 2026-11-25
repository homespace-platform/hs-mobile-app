import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type {
  PaymentRequest,
  ReportTransferPayload,
  RejectReceiptPayload,
} from '@/types/rental/payment-request.type';

function normalizePaymentRequest(data: unknown): PaymentRequest {
  if (!data || typeof data !== 'object') return data as unknown as PaymentRequest;
  const raw = data as Record<string, unknown>;
  const payeeAccount = (raw.payeeBankAccountSnapshot ||
    raw.payeeAccount) as PaymentRequest['payeeBankAccountSnapshot'];
  const payerAccount = (raw.payerBankAccountSnapshot ||
    raw.payerAccount) as PaymentRequest['payerBankAccountSnapshot'];
  const evidenceList = (raw.evidences || raw.evidenceList || []) as PaymentRequest['evidences'];
  return {
    ...(raw as unknown as PaymentRequest),
    payeeBankAccountSnapshot: payeeAccount,
    payerBankAccountSnapshot: payerAccount,
    payeeAccount,
    payerAccount,
    evidences: evidenceList,
    evidenceList,
  };
}

export const paymentRequestService = {
  /**
   * Lấy thông tin chi tiết của một PaymentRequest
   */
  async getPaymentRequest(id: string): Promise<PaymentRequest> {
    const response = await axiosClient.get<ApiResponse<PaymentRequest>>(
      `/api/v1/payment-requests/${id}`
    );
    return normalizePaymentRequest(response.data.result);
  },

  /**
   * Lấy thông tin thanh toán ban đầu gắn với yêu cầu thuê (RentalRequest)
   */
  async getInitialPaymentByRentalRequestId(rentalRequestId: string): Promise<PaymentRequest> {
    const response = await axiosClient.get<ApiResponse<PaymentRequest>>(
      `/api/v1/rental-requests/${rentalRequestId}/initial-payment`
    );
    return normalizePaymentRequest(response.data.result);
  },

  /**
   * Lấy danh sách các yêu cầu thanh toán liên quan đến tài khoản hiện tại
   */
  async getMyPaymentRequests(): Promise<PaymentRequest[]> {
    const response = await axiosClient.get<ApiResponse<PaymentRequest[]>>(
      '/api/v1/payment-requests/mine'
    );
    const list = response.data.result || [];
    return list.map(normalizePaymentRequest);
  },

  async getContractPayments(contractId: string): Promise<PaymentRequest[]> {
    const response = await axiosClient.get<ApiResponse<PaymentRequest[]>>(
      `/api/v1/payment-requests/contracts/${contractId}`
    );
    return (response.data.result || []).map(normalizePaymentRequest);
  },

  /**
   * Người thuê khai báo đã chuyển khoản trực tiếp
   */
  async reportTransfer(id: string, payload: ReportTransferPayload): Promise<PaymentRequest> {
    const response = await axiosClient.post<ApiResponse<PaymentRequest>>(
      `/api/v1/payment-requests/${id}/report-transfer`,
      payload
    );
    return normalizePaymentRequest(response.data.result);
  },

  /**
   * Chủ nhà xác nhận đã nhận đủ tiền vào tài khoản ngân hàng
   */
  async confirmReceipt(id: string): Promise<PaymentRequest> {
    const response = await axiosClient.post<ApiResponse<PaymentRequest>>(
      `/api/v1/payment-requests/${id}/confirm-receipt`
    );
    return normalizePaymentRequest(response.data.result);
  },

  /**
   * Chủ nhà từ chối xác nhận (chưa nhận được hoặc số tiền không khớp)
   */
  async rejectReceipt(id: string, payload: RejectReceiptPayload): Promise<PaymentRequest> {
    const response = await axiosClient.post<ApiResponse<PaymentRequest>>(
      `/api/v1/payment-requests/${id}/reject-receipt`,
      payload
    );
    return normalizePaymentRequest(response.data.result);
  },

  /**
   * Tạo phiên tải chứng từ từ điện thoại (Mobile QR handoff)
   */
  async createProofUploadSession(
    paymentRequestId: string
  ): Promise<import('@/types/rental/payment-request.type').ProofUploadSessionCreateResponse> {
    const response = await axiosClient.post<
      ApiResponse<import('@/types/rental/payment-request.type').ProofUploadSessionCreateResponse>
    >(`/api/v1/payment-requests/${paymentRequestId}/proof-upload-sessions`);
    return response.data.result;
  },

  /**
   * Kiểm tra trạng thái của phiên tải chứng từ mobile
   */
  async getProofUploadSessionStatus(
    paymentRequestId: string,
    sessionId: string
  ): Promise<import('@/types/rental/payment-request.type').ProofUploadSessionStatusResponse> {
    const response = await axiosClient.get<
      ApiResponse<import('@/types/rental/payment-request.type').ProofUploadSessionStatusResponse>
    >(`/api/v1/payment-requests/${paymentRequestId}/proof-upload-sessions/${sessionId}`);
    return response.data.result;
  },
};

export default paymentRequestService;
