export type PaymentStatus =
  | 'AWAITING_TRANSFER'
  | 'TRANSFER_REPORTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'EXPIRED';

export type PaymentType =
  | 'RESERVATION_DEPOSIT'
  | 'INITIAL'
  | 'MONTHLY_RENT'
  | 'UTILITY'
  | 'OTHER_CHARGE'
  | 'INITIAL_PAYMENT_REFUND'
  | 'DEPOSIT_REFUND'
  | 'DEPOSIT_ADJUSTMENT';

export type PaymentDirection = 'TENANT_TO_LANDLORD' | 'LANDLORD_TO_TENANT';

export interface BankAccountSnapshot {
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
}

export interface PaymentLineItem {
  id: string;
  type: string;
  displayName: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
}

export interface PaymentEvidence {
  id: string;
  uploadedBy: string;
  storageObjectId: string;
  declaredTransferTime?: string;
  bankTransactionReference?: string;
  payerAccountLast4?: string;
  note?: string;
  createdAt: string;
}

export interface PaymentEvent {
  id: string;
  eventType: string;
  fromStatus?: string;
  toStatus: string;
  actorId: string;
  actorRole: string;
  description?: string;
  metadataJson?: string;
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  rentalRequestId: string;
  contractId?: string;
  invoiceId?: string;
  listingId: string;
  payerId: string;
  payeeId: string;
  type: PaymentType;
  direction: PaymentDirection;
  status: PaymentStatus;
  currency: string;
  totalAmount: number;
  transferReference: string;
  payerBankAccountSnapshot?: BankAccountSnapshot;
  payeeBankAccountSnapshot: BankAccountSnapshot;
  payerAccount?: BankAccountSnapshot;
  payeeAccount?: BankAccountSnapshot;
  qrImageUrl: string;
  qrProvider: string;
  payerReportedAt?: string;
  payeeConfirmedAt?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  dueAt?: string;
  confirmationDueAt?: string;
  contractDueAt?: string;
  bankTransactionReference?: string;
  lineItems: PaymentLineItem[];
  evidences: PaymentEvidence[];
  evidenceList?: PaymentEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportTransferPayload {
  expectedAmount?: number;
  declaredTransferTime?: string;
  bankTransactionReference?: string;
  payerAccountLast4?: string;
  proofStorageId?: string;
  evidenceUploadSessionId?: string;
  note?: string;
}

export type UploadSessionStatus =
  'CREATED' | 'UPLOADING' | 'UPLOADED' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';

export interface ProofUploadSessionCreateResponse {
  sessionId: string;
  uploadPath: string;
  uploadPageUrl: string;
  expiresAt: string;
  status: UploadSessionStatus;
}

export interface ProofUploadSessionEvidence {
  storageId: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  previewUrl?: string;
}

export interface ProofUploadSessionStatusResponse {
  sessionId: string;
  status: UploadSessionStatus;
  expiresAt: string;
  evidence?: ProofUploadSessionEvidence;
}

export interface RejectReceiptPayload {
  reason: string;
}
