import axiosClient from '@/lib/axios-client';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { ApiResponse, PageResponse } from '@/types/api';
import type { Payment } from '@/services/managementApi';

export type BillingContract = {
  id: string;
  contractNumber: string;
  status: string;
  createdAt?: string;
};
export type MonthlyInvoice = {
  id: string;
  contractId: string;
  periodIndex: number;
  periodStart: string;
  periodEndExclusive: string;
  status: string;
  totalAmount: number;
  dueAt?: string;
  paidAt?: string;
  lateFeeAmount?: number;
  electricityStart?: number;
  electricityEnd?: number;
  waterStart?: number;
  waterEnd?: number;
  workflowState?: string;
  paymentRequestId?: string;
  lines: { description: string; quantity: number; unitPrice: number; amount: number }[];
};
export type PaymentReceipt = {
  id: string;
  paymentId: string;
  receiptNumber: string;
  title: string;
  totalAmount: number;
  issuedAt: string;
  pdfStatus: string;
  payerName: string;
  payeeName: string;
};

export async function getBillingContracts(owner: boolean, page: number, status?: string) {
  const response = await axiosClient.get<PageResponse<BillingContract>>('/api/v1/contracts', {
    params: { role: owner ? 'LANDLORD' : 'TENANT', billableOnly: true, status, page, size: 12 },
  });
  return response.data;
}

export async function getMonthlyInvoices(contractId: string) {
  const response = await axiosClient.get<ApiResponse<MonthlyInvoice[]>>(
    `/api/v1/monthly-invoices/contracts/${encodeURIComponent(contractId)}`
  );
  return response.data.result ?? [];
}

export async function getContractPayments(contractId: string) {
  const response = await axiosClient.get<ApiResponse<Payment[]>>(
    `/api/v1/payment-requests/contracts/${encodeURIComponent(contractId)}`
  );
  return response.data.result ?? [];
}

export async function getPaymentReceipts(owner: boolean, contractId: string, page = 1) {
  const response = await axiosClient.get<PageResponse<PaymentReceipt>>('/api/v1/payment-receipts', {
    params: { role: owner ? 'LANDLORD' : 'TENANT', contractId, page, size: 12 },
  });
  return response.data;
}

export async function getPaymentReceipt(paymentId: string) {
  const response = await axiosClient.get<ApiResponse<PaymentReceipt>>(
    `/api/v1/payment-receipts/by-payment/${encodeURIComponent(paymentId)}`
  );
  return response.data.result;
}

export async function shareReceiptPdf(receiptId: string) {
  const response = await axiosClient.get<ApiResponse<string>>(
    `/api/v1/payment-receipts/${encodeURIComponent(receiptId)}/content`
  );
  const base64 = response.data.result;
  if (!base64?.startsWith('JVBERi0')) throw new Error('Máy chủ chưa trả về PDF hợp lệ.');
  if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync()))
    throw new Error('Thiết bị chưa hỗ trợ mở hoặc lưu PDF.');
  const uri = `${FileSystem.cacheDirectory}homespace-receipt-${encodeURIComponent(receiptId)}.pdf`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Mở hoặc lưu chứng từ',
  });
}

export async function retryReceiptPdf(receiptId: string) {
  await axiosClient.post(`/api/v1/payment-receipts/${encodeURIComponent(receiptId)}/retry`);
}

export async function getPayment(id: string) {
  const response = await axiosClient.get<ApiResponse<Payment>>(
    `/api/v1/payment-requests/${encodeURIComponent(id)}`
  );
  return response.data.result;
}
