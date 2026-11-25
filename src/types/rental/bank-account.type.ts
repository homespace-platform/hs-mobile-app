export type BankAccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type BankAccountVerificationMethod = 'USER_DECLARED' | 'NAME_MATCHED' | 'MANUAL_REVIEWED';

export interface BankAccount {
  id: string;
  userId: string;
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string; // Masked e.g. ******1234
  accountHolderName: string;
  defaultForIncomingPayments: boolean;
  defaultForRefunds: boolean;
  status: BankAccountStatus;
  verificationMethod: BankAccountVerificationMethod;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankAccountRequest {
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  defaultForIncomingPayments?: boolean;
  defaultForRefunds?: boolean;
}

export interface UpdateBankAccountDefaultsRequest {
  defaultForIncomingPayments?: boolean;
  defaultForRefunds?: boolean;
}

export interface Bank {
  bin: string;
  code: string;
  name: string;
  shortName: string;
  logo: string | null;
}
