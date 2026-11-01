import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export type BankAccount = {
  id: string;
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  defaultForIncomingPayments: boolean;
  defaultForRefunds: boolean;
  status: string;
};
export type BankAccountInput = Pick<
  BankAccount,
  'bankBin' | 'bankCode' | 'bankName' | 'accountNumber' | 'accountHolderName'
> & {
  defaultForIncomingPayments: boolean;
  defaultForRefunds: boolean;
};

export async function getBankAccounts() {
  return (
    (await axiosClient.get<ApiResponse<BankAccount[]>>('/api/v1/bank-accounts')).data.result ?? []
  );
}
export async function createBankAccount(input: BankAccountInput) {
  return (await axiosClient.post<ApiResponse<BankAccount>>('/api/v1/bank-accounts', input)).data
    .result;
}
export async function setBankAccountDefaults(
  id: string,
  input: { defaultForIncomingPayments?: boolean; defaultForRefunds?: boolean }
) {
  return (
    await axiosClient.put<ApiResponse<BankAccount>>(
      `/api/v1/bank-accounts/${encodeURIComponent(id)}/defaults`,
      input
    )
  ).data.result;
}
