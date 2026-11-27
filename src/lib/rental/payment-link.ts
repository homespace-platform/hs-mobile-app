// Port of paymentLink() in hs-web-app app/dashboard/payments/page.tsx:93-125 — where a PAYMENT_* notification
// leads. Same rules and labels; hrefs are mobile route descriptors.
import {
  contractDetailPath,
  invoiceDetailPath,
  type ContractRoute,
} from '@/lib/rental/contract-routes';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

const RENTAL_REQUEST_TYPES = new Set(['INITIAL', 'RESERVATION_DEPOSIT', 'INITIAL_PAYMENT_REFUND']);

/** Refunds and settlements: the transfers SettlementPaymentPanel handles. */
export const isSettlementTransfer = (p: Pick<PaymentRequest, 'type' | 'invoiceId'>) =>
  ['INITIAL_PAYMENT_REFUND', 'DEPOSIT_REFUND', 'DEPOSIT_ADJUSTMENT'].includes(p.type) ||
  (p.type === 'OTHER_CHARGE' && !p.invoiceId);

export type PaymentLinkRoute =
  ContractRoute | { screen: 'rental-requests'; mode: 'RECEIVED' | 'SENT'; requestId: string };

/**
 * The landlord is the persisted payee of a tenant→landlord payment and the persisted payer of a refund; never the
 * selected dashboard role or the query. No link unless the verified actor is a stored party.
 */
export function paymentLink(
  p: PaymentRequest,
  actorId: string
): { href: PaymentLinkRoute; label: string } | null {
  const refund = p.direction === 'LANDLORD_TO_TENANT';
  const landlordId = refund ? p.payerId : p.payeeId;
  const tenantId = refund ? p.payeeId : p.payerId;
  const owner = actorId === landlordId;
  if (!owner && actorId !== tenantId) return null;
  if (RENTAL_REQUEST_TYPES.has(p.type) && p.rentalRequestId) {
    return {
      href: {
        screen: 'rental-requests',
        mode: owner ? 'RECEIVED' : 'SENT',
        requestId: p.rentalRequestId,
      },
      label: 'Xem yêu cầu thuê',
    };
  }
  if (!p.contractId) return null;
  if (
    ['DEPOSIT_ADJUSTMENT', 'DEPOSIT_REFUND'].includes(p.type) ||
    (p.type === 'OTHER_CHARGE' && !p.invoiceId)
  ) {
    return {
      href: { ...invoiceDetailPath(p.contractId), section: 'deposit' },
      label: 'Xem quyết toán / cọc',
    };
  }
  if (p.type === 'MONTHLY_RENT' || p.invoiceId) {
    return { href: invoiceDetailPath(p.contractId), label: 'Xem hóa đơn' };
  }
  return {
    href: contractDetailPath(owner ? 'landlord' : 'tenant', p.contractId),
    label: 'Xem hợp đồng',
  };
}
