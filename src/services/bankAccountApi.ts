import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export type Bank = {
  bin: string;
  code: string;
  name: string;
  shortName: string;
  logo: string | null;
};
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

let banksCache: Promise<Bank[]> | null = null;
/** Public bank catalog; one request per session, cache cleared on failure so it can be retried. */
export function getBanks() {
  banksCache ??= axiosClient
    .get<ApiResponse<Bank[]>>('/api/v1/public/banks')
    .then((response) => response.data.result ?? [])
    .catch((cause) => {
      banksCache = null;
      throw cause;
    });
  return banksCache;
}
export async function getBankAccounts() {
  return (
    (await axiosClient.get<ApiResponse<BankAccount[]>>('/api/v1/bank-accounts')).data.result ?? []
  );
}
export async function createBankAccount(input: BankAccountInput) {
  return (await axiosClient.post<ApiResponse<BankAccount>>('/api/v1/bank-accounts', input)).data
    .result;
}
export async function getBankAccount(id: string) {
  return (
    await axiosClient.get<ApiResponse<BankAccount>>(
      `/api/v1/bank-accounts/${encodeURIComponent(id)}/reveal`
    )
  ).data.result;
}
export async function updateBankAccount(id: string, input: BankAccountInput) {
  return (
    await axiosClient.put<ApiResponse<BankAccount>>(
      `/api/v1/bank-accounts/${encodeURIComponent(id)}`,
      input
    )
  ).data.result;
}
export async function deleteBankAccount(id: string) {
  await axiosClient.delete(`/api/v1/bank-accounts/${encodeURIComponent(id)}`);
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
