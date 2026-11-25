import axiosClient from './client';
import { saveBase64ToCache } from './files';
import type { ApiResponse, PageResponse } from '@/types/api';

export interface PaymentReceipt {
  id: string;
  paymentId: string;
  receiptNumber: string;
  title: string;
  kind: 'PAYMENT' | 'REFUND';
  totalAmount: number;
  currency: string;
  issuedAt: string;
  payerName: string;
  payeeName: string;
  contractNumber?: string;
  propertyAddress?: string;
  periodLabel?: string;
  transferReference: string;
  pdfStatus: 'PENDING' | 'READY' | 'FAILED';
  snapshotHash: string;
}
export const paymentReceiptService = {
  async list(params: {
    role?: 'LANDLORD' | 'TENANT';
    contractId?: string;
    rentalRequestId?: string;
    page?: number;
    size?: number;
  }) {
    return (
      await axiosClient.get<PageResponse<PaymentReceipt>>('/api/v1/payment-receipts', { params })
    ).data;
  },
  async byPayment(paymentId: string) {
    return (
      await axiosClient.get<ApiResponse<PaymentReceipt>>(
        `/api/v1/payment-receipts/by-payment/${encodeURIComponent(paymentId)}`
      )
    ).data.result;
  },
  async retry(id: string) {
    return (
      await axiosClient.post<ApiResponse<PaymentReceipt>>(
        `/api/v1/payment-receipts/${encodeURIComponent(id)}/retry`
      )
    ).data.result;
  },
  /** Unlike the web Blob (React Native cannot build one from bytes), resolves to a cached file URI. */
  async pdf(id: string): Promise<string> {
    const { data } = await axiosClient.get<ApiResponse<string>>(
      `/api/v1/payment-receipts/${encodeURIComponent(id)}/content`
    );
    let bytes = '';
    try {
      if (typeof data?.result === 'string') bytes = atob(data.result);
    } catch {
      /* Treat invalid content like an empty response. */
    }
    if (!bytes.startsWith('%PDF-')) {
      throw new Error('Không nhận được nội dung hóa đơn PDF. Vui lòng thử lại.');
    }
    return saveBase64ToCache(data.result, `hoa-don-${id}.pdf`);
  },
};
