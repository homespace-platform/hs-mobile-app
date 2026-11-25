// Port of hs-web-app lib/invoice-list.ts: only findInvoicePayment and invoiceNeedsAction are reachable in the web
// (through payment-module chooseInvoice and MonthlyInvoicesSection). The list-tab/row helpers are dead code (WD-9).
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';
import type { PaymentRequest, PaymentStatus } from '@/types/rental/payment-request.type';

export function findInvoicePayment(
  invoice: MonthlyInvoice,
  payments: PaymentRequest[]
): PaymentRequest | undefined {
  return payments.find(
    (item) => item.invoiceId === invoice.id || item.id === invoice.paymentRequestId
  );
}

export function invoiceNeedsAction(
  role: DashboardRole,
  invoice: Pick<
    MonthlyInvoice,
    'status' | 'workflowState' | 'paymentExtensions' | 'activeResolution'
  >,
  paymentStatus?: PaymentStatus | null
): boolean {
  if (['ROLLED_OVER', 'PAID', 'CANCELLED'].includes(invoice.status)) return false;

  const hasPendingExtension =
    invoice.activeResolution === 'EXTENSION_REQUEST' ||
    (invoice.paymentExtensions || []).some((item) => item.status === 'PENDING');

  if (role === 'landlord') {
    if (invoice.status === 'DRAFT') return true;
    if (paymentStatus === 'TRANSFER_REPORTED') return true;
    if (hasPendingExtension) return true;
    if (!paymentStatus && invoice.workflowState === 'UNDER_REVIEW') return true;
    return false;
  }

  if (paymentStatus === 'TRANSFER_REPORTED') return false;
  if (paymentStatus === 'REJECTED') return true;
  if (invoice.status === 'UNPAID' || invoice.status === 'OVERDUE') return true;
  if (invoice.workflowState === 'EXTENSION_PENDING') return true;
  return false;
}
