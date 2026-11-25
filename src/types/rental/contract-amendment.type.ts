export type AmendmentStatus =
  | 'REQUESTED'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'APPLIED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'TENANT_REQUESTED'
  | 'TENANT_ACCEPTED'
  | 'TENANT_REJECTED'
  | 'TENANT_EXPIRED'
  | 'TENANT_FULFILLED';
export type TermRow = Record<string, unknown>;
export interface AmendmentTerms {
  billingRules?: TermRow;
  systemTerms?: string;
  financial: TermRow;
  tenant: TermRow;
  property: TermRow;
  charges: TermRow[];
  equipments: TermRow[];
  amenities: TermRow[];
  policies: TermRow;
  specialTerms: string;
  landlord?: TermRow;
  lease?: TermRow;
  meters?: TermRow;
  initialPayment?: TermRow;
}
export interface AmendmentComparison {
  field: string;
  label: string;
  before: string;
  after: string;
}
export interface AmendmentPayload {
  requestId: string;
  baseRevisionId: string;
  previousProposalId?: string;
  effectiveOn: string | null;
  reason: string;
  changes: TermRow;
  evidenceIds?: string[];
  tenantRequestId?: string;
}
export interface AmendmentProposal {
  id: string;
  previousProposalId?: string;
  proposerId: string;
  recipientId: string;
  status: AmendmentStatus;
  effectiveOn: string;
  immediateEffect: boolean;
  reason: string;
  responseNote?: string;
  submittedAt: string;
  respondBy: string;
  signBy: string;
  signedAt?: string;
  appliedAt?: string;
  decidedAt?: string;
  agreementContractId?: string;
  agreementStatus?: string;
  tenantRequestId?: string;
  comparison: AmendmentComparison[];
  changes: TermRow;
  evidenceIds: string[];
  canReplace?: boolean;
  replacementBlockedReason?: string;
}
export interface ContractAmendments {
  serverNow: string;
  canPropose: boolean;
  blockedReason?: string;
  currentTermsRevisionId: string;
  currentTerms: AmendmentTerms;
  availableDates: string[];
  proposals: AmendmentProposal[];
  draft?: AmendmentPayload | null;
}
export interface AmendmentOptions {
  listingId: string;
  category: string;
  amenities: TermRow[];
  equipments: TermRow[];
  furnishingCatalog: TermRow[];
  billingMethodsByChargeType: Record<string, string[]>;
}
