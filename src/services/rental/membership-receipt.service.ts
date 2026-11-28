import axiosClient from './client';
import { saveBase64ToCache } from './files';
import type { ApiResponse, PageResponse } from '@/types/api';

// Web services/membership-receipt.service.ts. Buyer-only: the backend denies every other user.
export interface MembershipReceipt {
  id: string;
  orderId: string;
  receiptNumber: string;
  itemName: string;
  kind: 'PLAN' | 'ADDON';
  tier?: string | null;
  quantity: number;
  periodDays: number;
  totalAmount: number;
  currency: string;
  provider?: 'SEPAY' | 'ETH' | 'VNPAY' | null;
  transactionRef?: string | null;
  issuedAt: string;
  pdfStatus: 'PENDING' | 'READY' | 'FAILED';
  /** OVERPAYMENT: duplicate payment, not applied, refunded to the payer. Absent = normal receipt. */
  type?: 'PURCHASE' | 'OVERPAYMENT' | null;
  refundStatus?: 'REFUND_PENDING' | 'REFUNDED' | null;
  note?: string | null;
}

const base = '/api/v1/membership/receipts';

export const membershipReceiptService = {
  async list(params: { page?: number; size?: number }) {
    return (await axiosClient.get<PageResponse<MembershipReceipt>>(base, { params })).data;
  },
  async get(id: string) {
    return (
      await axiosClient.get<ApiResponse<MembershipReceipt>>(`${base}/${encodeURIComponent(id)}`)
    ).data.result;
  },
  async retry(id: string) {
    return (
      await axiosClient.post<ApiResponse<MembershipReceipt>>(
        `${base}/${encodeURIComponent(id)}/retry`
      )
    ).data.result;
  },
  /** Resolves to a cached file URI after checking the bytes really are a PDF. */
  async pdf(id: string): Promise<string> {
    const { data } = await axiosClient.get<ApiResponse<string>>(
      `${base}/${encodeURIComponent(id)}/content`
    );
    let bytes = '';
    try {
      if (typeof data?.result === 'string') bytes = atob(data.result);
    } catch {
      /* Treat invalid content like an empty response. */
    }
    if (!bytes.startsWith('%PDF-')) {
      throw new Error('Không nhận được nội dung biên nhận PDF. Vui lòng thử lại.');
    }
    return saveBase64ToCache(data.result, `bien-nhan-${id}.pdf`);
  },
};
