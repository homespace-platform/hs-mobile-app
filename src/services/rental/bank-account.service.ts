import * as api from '@/services/bankAccountApi';
import type {
  BankAccount,
  BankAccountRequest,
  UpdateBankAccountDefaultsRequest,
} from '@/types/rental/bank-account.type';

// Same endpoints as the mobile bankAccountApi (and one shared bank catalog cache); only the
// web names and types are restored here.
export const bankAccountService = {
  getBanks: () => api.getBanks(),

  getBankAccounts(): Promise<BankAccount[]> {
    return api.getBankAccounts() as Promise<BankAccount[]>;
  },

  createBankAccount(data: BankAccountRequest): Promise<BankAccount> {
    return api.createBankAccount(data as api.BankAccountInput) as Promise<BankAccount>;
  },

  updateBankAccount(id: string, data: BankAccountRequest): Promise<BankAccount> {
    return api.updateBankAccount(id, data as api.BankAccountInput) as Promise<BankAccount>;
  },

  /** Owner-only: returns the full (unmasked) account number. Never cache or log the result. */
  revealBankAccount(id: string): Promise<BankAccount> {
    return api.getBankAccount(id) as Promise<BankAccount>;
  },

  updateDefaults(id: string, data: UpdateBankAccountDefaultsRequest): Promise<BankAccount> {
    return api.setBankAccountDefaults(id, data) as Promise<BankAccount>;
  },

  deleteBankAccount: (id: string) => api.deleteBankAccount(id),
};

export default bankAccountService;
