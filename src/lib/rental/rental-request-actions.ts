// Port of hs-web-app lib/rental-request-actions.ts (verbatim; only import paths changed).
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';
import type { ContractResponse } from '@/types/rental/contract.type';

/**
 * Display hint only. The server locks and rechecks both payments before cancelling.
 * A landlord answers a PENDING request with "Từ chối", so only the tenant gets "Hủy yêu cầu" there.
 */
export function canCancelRentalRequest(
  request: Pick<RentalRequestResponse, 'status' | 'initialPayment'>,
  contract?: Pick<ContractResponse, 'status'> | null,
  livePaymentStatus?: string,
  role: 'LANDLORD' | 'TENANT' = 'TENANT'
) {
  if (contract && contract.status !== 'DRAFT') return false;
  if (request.status === 'PENDING') return role === 'TENANT';
  if (request.status !== 'ACCEPTED' || request.initialPayment?.canCancelImmediately !== true)
    return false;
  const status = livePaymentStatus || request.initialPayment.status;
  return (
    ['AWAITING_TRANSFER', 'EXPIRED', 'CANCELLED', 'OVERDUE'].includes(status) ||
    (status === 'CONFIRMED' && request.initialPayment.totalAmount === 0)
  );
}
