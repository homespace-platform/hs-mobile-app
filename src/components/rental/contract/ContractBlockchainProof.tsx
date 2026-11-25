// Phase 2 owner C. Web: components/contract/detail/ContractBlockchainProof.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { ContractDocumentResponse } from '@/types/rental/contract.type';

export type ContractBlockchainProofProps = {
  document: ContractDocumentResponse;
};

export default function ContractBlockchainProof(_props: ContractBlockchainProofProps) {
  return <BlockPlaceholder title="Bằng chứng blockchain" />;
}
