export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'LANDLORD_SIGNATURE_PENDING'
  | 'TENANT_SIGNATURE_PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CLOSED'
  | 'TERMINATED'
  | 'CANCELLED';

export type ContractPaymentStatus = 'UNPAID' | 'PAID_MOCK' | 'PAID' | 'REFUNDED' | 'FAILED';

export type ContractDocumentType = 'DOCX' | 'PDF';
export type DocumentPurpose = 'PREVIEW' | 'OFFICIAL' | 'SIGNED_LANDLORD' | 'SIGNED_FINAL';

export type SignatureRequestStatus =
  | 'CREATED'
  | 'PENDING_USER_CONFIRMATION'
  | 'PROVIDER_SIGNED'
  | 'EMBEDDING'
  | 'SIGNED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED';

export interface SignatureRequestResponse {
  id: string;
  contractId: string;
  revisionId: string;
  signerRole: 'LANDLORD' | 'TENANT';
  status: SignatureRequestStatus;
  docId?: string | null;
  signedDocumentId?: string | null;
  certificateSerial?: string | null;
  certificateSubject?: string | null;
  initiatedAt?: string | null;
  confirmedAt?: string | null;
  expiresAt?: string | null;
  failureReason?: string | null;
  failureCode?: string | null;
}

export interface SignatureStateResponse {
  signatureMode: 'INTERNAL' | 'SMARTCA';
  smartCaEnabled: boolean;
  activeRequest?: SignatureRequestResponse | null;
  allRequests: SignatureRequestResponse[];
}

export interface CertificateOptionResponse {
  serialNumber: string;
  subject: string;
  issuer?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
}
export type DocumentGenerationStatus = 'GENERATING' | 'READY' | 'FAILED' | 'STALE';

export interface CreateContractDraftRequest {
  rentalRequestId: string;
}

export interface InitialPaymentSnapshot {
  status?: string;
  paidAt?: string;
  provider?: string;
  transactionCode?: string;
  monthlyRent?: number;
  monthlyCharges?: number;
  depositAmount?: number;
  totalAmount?: number;
  currency?: string;
}

export interface AmenitySnapshot {
  index?: number;
  code?: string;
  name?: string;
  sourceType?: string;
}

export interface PolicySnapshot {
  listingPolicies?: import('./listing-policy.type').ListingPolicyValue[];
  paymentDueDay?: string;
  paymentCycle?: string;
  noticeDaysBeforeTermination?: number;
  noticeDaysBeforeMoveOut?: number;
  depositDeductionConditions?: string;
  subleasePolicy?: string;
  petPolicy?: string;
  smokingPolicy?: string;
  overnightGuestPolicy?: string;
  propertyInspectionNotice?: string;
  forceMajeure?: string;
  latePaymentFeeMode?: 'NONE' | 'FIXED_ONCE' | 'FIXED_PER_DAY';
  latePaymentFeeAmount?: number;
  latePaymentFeeGraceDays?: number;
  latePaymentFeeCap?: number | null;
  billingRules?: Record<string, unknown>;
  overdueLandlordTerminationAfterFiveDays?: boolean;
  overdueUnilateralTermination24h?: boolean;
  depositRefundDays?: number;
  sublettingAllowed?: boolean;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  disputeResolution?: string;
}

export interface UpdateContractRevisionRequest {
  baseRevisionId?: string;
  listingSourceVersion?: string;
  landlord?: Record<string, unknown>;
  landlordContact?: { phone?: string; email?: string };
  draftContent?: {
    landlord?: Record<string, unknown>;
    tenant?: Record<string, unknown>;
  };
  tenant?: Record<string, unknown>;
  property?: Record<string, unknown>;
  lease?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  initialPayment?: Record<string, unknown>;
  amenities?: Record<string, unknown>[];
  charges?: Record<string, unknown>[];
  equipments?: Record<string, unknown>[];
  policies?: Record<string, unknown>;
  meters?: Record<string, unknown>;
  specialTerms?: string | null;
  additionalTerms?: string;
  revisionNote?: string | null;
}

export interface ContractListingSyncPreview {
  sourceVersion: string;
  baseRevisionId: string;
  terms: Pick<
    import('./contract-amendment.type').AmendmentTerms,
    'property' | 'equipments' | 'amenities' | 'policies' | 'lease'
  > &
    Partial<
      Pick<import('./contract-amendment.type').AmendmentTerms, 'financial' | 'charges' | 'meters'>
    >;
  proposedMonths?: number | null;
  leaseMessage?: string | null;
  differences: import('./contract-amendment.type').AmendmentComparison[];
  financialDifferences: import('./contract-amendment.type').AmendmentComparison[];
}

export interface ContractResponse {
  id: string;
  contractNumber: string;
  signingCity?: string | null;
  rentalRequestId: string;
  listingId: string;
  landlordId: string;
  tenantId: string;
  templateId: string;
  templateVersionId: string;
  currentRevisionId?: string | null;
  parentContractId?: string | null;
  // Core sets WORKFLOW (early-exit signing documents); RENEWAL is kept for compatibility, Core leaves renewals null.
  agreementKind?: 'AMENDMENT' | 'RENEWAL' | 'DEPOSIT' | 'WORKFLOW' | null;
  depositAgreementContractId?: string | null;
  effectiveLeaseMonths?: number | null;
  agreedEarlyEndExclusive?: string | null;
  status: ContractStatus;
  paymentStatus: ContractPaymentStatus;
  rentalPaymentId?: string | null;
  paidAt?: string | null;
  landlordConfirmedAt?: string | null;
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractRevisionResponse {
  id: string;
  contractId: string;
  revisionNumber: number;
  templateVersionId: string;
  landlord: Record<string, unknown> | null;
  tenant: Record<string, unknown> | null;
  property: Record<string, unknown> | null;
  lease: Record<string, unknown> | null;
  financial: Record<string, unknown> | null;
  initialPayment?: Record<string, unknown> | null;
  amenities?: Record<string, unknown>[] | null;
  charges: Record<string, unknown>[] | null;
  equipments: Record<string, unknown>[] | null;
  policies?: Record<string, unknown> | null;
  meters: Record<string, unknown> | null;
  specialTerms?: string | null;
  systemTerms?: string | null;
  additionalTerms?: string | null;
  revisionNote?: string | null;
  schemaVersion?: number | null;
  createdAt: string;
}

export interface ContractDocumentResponse {
  id: string;
  contractId: string;
  revisionId: string;
  templateVersionId: string;
  documentType: ContractDocumentType;
  purpose: DocumentPurpose;
  storageObjectId?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  status: DocumentGenerationStatus;
  errorMessage?: string | null;
  generatedAt?: string | null;
  viewUrl?: string | null;
  downloadUrl?: string | null;
}

/** Trường bắt buộc của file mẫu Word mà bản nháp hiện tại còn để trống. */
export interface ContractMissingField {
  key: string;
  label: string;
  group: string;
  /** Nhóm snapshot cần sửa: landlord | tenant | property | lease | financial | meters | system */
  section: string;
}

export interface ContractCompletenessResponse {
  contractId: string;
  revisionId: string;
  complete: boolean;
  totalFields: number;
  filledFields: number;
  missingFields: ContractMissingField[];
  warnings: string[];
}
