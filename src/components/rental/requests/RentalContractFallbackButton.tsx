// hs-web-app components/rental-request/RentalContractFallbackButton.tsx (B-231).
import ActionButton from '@/components/rental/shared/ActionButton';
import { canOfferContractFallback } from '@/lib/rental/rental-contract-fallback';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';
import type { ContractResponse } from '@/types/rental/contract.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import type { Mode } from './logic';

/** Shows the automatic draft status while the contract is still missing. */
export default function RentalContractFallbackButton({
  request,
  mode,
  contract,
  view,
  onCreate,
  className,
}: {
  request: RentalRequestResponse;
  mode: Mode;
  contract?: ContractResponse | null;
  view?: RentalOnboarding | null;
  busy: boolean;
  disabled: boolean;
  onCreate?: (request: RentalRequestResponse) => void;
  className?: string;
}) {
  if (!onCreate || !canOfferContractFallback(request, mode, contract, view)) return null;
  return <ActionButton label="Đang tạo hợp đồng tự động" busy className={className} />;
}
