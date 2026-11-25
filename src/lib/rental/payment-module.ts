// Port of hs-web-app lib/payment-module.ts (web path/query strings replaced by route descriptors, see contract-routes).
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { invoiceNeedsAction, findInvoicePayment } from '@/lib/rental/invoice-list';
import {
  contractDetailPath,
  contractLandingPath,
  type ContractRoute,
  type ContractRouteQuery,
} from '@/lib/rental/contract-routes';
export type PaymentSection = 'monthly' | 'deposit';
export function paymentSection(value: string | null): PaymentSection {
  return value === 'deposit' ? value : 'monthly';
}
// Untrusted path/query ids are only compared with the caller's own authorized list or sent as one path segment.
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export function safeResourceId(value: string | null | undefined): string | null {
  const id = value?.trim();
  return id && RESOURCE_ID_PATTERN.test(id) ? id : null;
}
// ?invoice= is only compared with the authorized list: a persisted id, or the exact synthetic month-1 id
// "first-rent:<payment id>" that Core lists for INITIAL_RENT. Never a path/ID-lookup validator; contract paths stay on safeResourceId.
const FIRST_RENT_PREFIX = 'first-rent:';
export function safeInvoiceSelectionId(value: string | null | undefined): string | null {
  const id = value?.trim();
  if (!id) return null;
  if (id.startsWith(FIRST_RENT_PREFIX))
    return safeResourceId(id.slice(FIRST_RENT_PREFIX.length)) ? id : null;
  return safeResourceId(id);
}
// Payments live in the contract page's "Thanh toán & cọc" tab. Rent invoices (section=monthly&invoice=<id>) are on the lease (HĐ thuê);
// deposit payments, adjustments and refund (section=deposit) are on the deposit agreement (HĐ cọc), which the landing resolves from the lease.
export function paymentQuery(section: PaymentSection, invoiceId?: string): ContractRouteQuery {
  return { tab: 'payment', section, ...(invoiceId ? { invoice: invoiceId } : {}) };
}
export function paymentModulePath(
  id: string,
  section: PaymentSection,
  invoiceId?: string
): ContractRoute {
  return { ...contractLandingPath(id), ...paymentQuery(section, invoiceId) };
}
export function chooseInvoice(
  bills: MonthlyInvoice[],
  payments: PaymentRequest[],
  role: DashboardRole,
  requested?: string | null
) {
  if (requested && bills.some((bill) => bill.id === requested)) return requested;
  return [...bills].sort((a, b) => {
    const priority = (bill: MonthlyInvoice) =>
      invoiceNeedsAction(role, bill, findInvoicePayment(bill, payments)?.status)
        ? 0
        : !['PAID', 'ROLLED_OVER', 'CANCELLED'].includes(bill.status)
          ? 1
          : 2;
    return priority(a) - priority(b) || b.periodIndex - a.periodIndex || a.id.localeCompare(b.id);
  })[0]?.id;
}

/** Where /dashboard/contracts/<id> sends the viewer: the role page of that contract, or of its deposit agreement for ?section=deposit on a lease. */
export function contractLandingTarget(
  side: DashboardRole,
  contract: {
    id: string;
    agreementKind?: string | null;
    parentContractId?: string | null;
    depositAgreementContractId?: string | null;
  },
  query: ContractRouteQuery = {},
  hash = ''
): ContractRoute {
  const own = contractDetailPath(side, contract.id);
  if (hash === '#monthly-invoices') return { ...own, ...paymentQuery('monthly') };
  const lease = !contract.agreementKind && !contract.parentContractId;
  if (lease && query.section === 'deposit') {
    const depositId = safeResourceId(contract.depositAgreementContractId);
    // No deposit agreement to open: the lease's end tab is the closest place for settlement.
    return depositId
      ? { ...contractDetailPath(side, depositId), tab: 'payment' }
      : { ...own, tab: 'end' };
  }
  return { ...own, ...query };
}
