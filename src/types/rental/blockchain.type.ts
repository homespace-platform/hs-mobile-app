export type BlockchainProofStatus =
  'NOT_AVAILABLE' | 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';

export interface DocumentIntegrityResponse {
  documentId: string;
  status: 'MATCH' | 'MISMATCH' | 'PENDING' | 'NOT_AVAILABLE' | 'UNAVAILABLE' | 'MISSING';
  documentHash?: string | null;
  onChainDocumentHash?: string | null;
  checkedAt: string;
  message?: string | null;
}

export interface ContractBlockchainProofResponse {
  documentId: string;
  contractId: string;
  revisionId: string;
  status: BlockchainProofStatus;
  documentHash?: string | null;
  onChainDocumentId?: string | null;
  chainId?: number | null;
  registryAddress?: string | null;
  transactionHash?: string | null;
  blockNumber?: number | null;
  blockHash?: string | null;
  registeredAt?: string | null;
  confirmedAt?: string | null;
  errorCode?: string | null;
  caseId?: string | null;
  documentKind?: number | null;
  message?: string | null;
}

export interface ContractBlockchainVerificationResponse {
  documentId: string;
  matches: boolean;
  registered: boolean;
  documentHash: string;
  registeredAt?: string | null;
  chainId: number;
  registryAddress: string;
  onChainDocumentId: string;
}
