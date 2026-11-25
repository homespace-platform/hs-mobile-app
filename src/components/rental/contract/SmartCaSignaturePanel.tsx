// Phase 2 owner C. Web: components/contract/detail/SmartCaSignaturePanel.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';
import type { ContractResponse, SignatureStateResponse } from '@/types/rental/contract.type';

export type SmartCaSignaturePanelProps = {
  contract: ContractResponse;
  state: SignatureStateResponse;
  isLandlord: boolean;
  isTenant: boolean;
  hasReadyPdf: boolean;
  signingAllowed?: boolean;
  blockedReason?: string;
  onUpdated: () => Promise<void>;
};

export default function SmartCaSignaturePanel(_props: SmartCaSignaturePanelProps) {
  return <BlockPlaceholder title="Ký số SmartCA" />;
}
