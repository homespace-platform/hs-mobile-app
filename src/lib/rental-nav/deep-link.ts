// Notification actionPath -> RentalRoute. Pure. The web navigates by actionPath only (NotificationDropdown /
// NotificationPopup); notification metadata only drives refreshes, see lib/rental-sync/events.ts.
import { getSafeActionPath } from '@/lib/notification';
import type { ContractRouteQuery } from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { safeInvoiceSelectionId, safeResourceId } from '@/lib/rental/payment-module';
import { isRentalRequestId } from '@/lib/rental/useRentalRequestDeepLink';
import {
  contractQueryOf,
  DOCUMENT_NOT_FOUND,
  normalizeRentalRoute,
  type RentalListMode,
  type RentalRoute,
} from '@/lib/rental-nav/routes';

// app/dashboard/complaints/page.tsx:13
const COMPLAINT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;
export const COMPLAINT_LINK_INVALID = 'Đường dẫn hồ sơ khiếu nại không hợp lệ.';
// app/dashboard/payments/page.tsx NOT_FOUND_MESSAGE
export const PAYMENT_NOT_FOUND =
  'Không tìm thấy yêu cầu chuyển khoản hoặc bạn không có quyền xem yêu cầu này.';

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // As URLSearchParams does: the bad text stays and then fails the id check.
  }
}

/** null = not a rental destination (or an unsafe path): the caller keeps its current behaviour. */
export function rentalRouteFromActionPath(
  actionPath: unknown,
  /** The role selected in Quản lý; only used where the web uses its stored dashboard role. */
  role: DashboardRole = 'tenant'
): RentalRoute | null {
  const safe = getSafeActionPath(actionPath);
  if (!safe) return null;
  const [beforeHash, hash] = safe.split('#');
  const [pathname, query = ''] = beforeHash.split('?');
  const params = query.split('&').map((part) => {
    const at = part.indexOf('=');
    return at < 0 ? [part, ''] : [part.slice(0, at), decode(part.slice(at + 1))];
  });
  const param = (name: string) => params.find(([key]) => key === name)?.[1] ?? '';
  const [root, area, a, b, c, extra] = pathname.split('/').filter(Boolean);
  if (root !== 'dashboard' || extra !== undefined) return null;

  const contractQuery = (): ContractRouteQuery =>
    contractQueryOf({
      tab: param('tab'),
      section: param('section'),
      // A malformed ?invoice= is forwarded so the list shows its neutral not-found, never "no request".
      invoice: safeInvoiceSelectionId(param('invoice')) ?? param('invoice').trim(),
    });
  const unavailable: RentalRoute = {
    screen: 'link-error',
    message: DOCUMENT_NOT_FOUND,
    contractListSide: role,
  };

  if (area === 'rental-requests') {
    if (b !== undefined || (a !== undefined && a !== 'my-requests')) return null;
    const mode: RentalListMode = a ? 'SENT' : 'RECEIVED';
    const requestId = param('requestId');
    if (!requestId) return { screen: 'rental-requests', mode };
    return isRentalRequestId(requestId)
      ? { screen: 'rental-requests', mode, requestId }
      : { screen: 'rental-requests', mode, invalidLink: true };
  }

  if (area === 'landlord' || area === 'tenant') {
    if (a !== 'contracts') return null;
    if (b === undefined)
      return {
        screen: 'contract-list',
        side: area,
        ...(param('kind') === 'DEPOSIT' ? { kind: 'DEPOSIT' as const } : {}),
      };
    if (b === 'reservations') {
      // The web has this page for tenants only.
      if (area !== 'tenant' || c === undefined) return null;
      const rentalId = safeResourceId(decode(c));
      return rentalId ? { screen: 'reservation', side: area, rentalId } : unavailable;
    }
    if (c !== undefined) return null;
    const contractId = safeResourceId(decode(b));
    return contractId
      ? { screen: 'contract-detail', side: area, contractId, ...contractQuery() }
      : unavailable;
  }

  // Every other rental page has at most one segment after its area.
  if (b !== undefined) return null;

  if (area === 'contracts') {
    if (a === undefined) return { screen: 'contract-list', side: role };
    const contractId = safeResourceId(decode(a));
    if (!contractId) return unavailable;
    return {
      screen: 'contract-landing',
      contractId,
      // The old #monthly-invoices anchor wins over the query (contractLandingTarget).
      ...(hash === 'monthly-invoices' ? { tab: 'payment', section: 'monthly' } : contractQuery()),
    };
  }

  if (area === 'invoices') {
    if (a === undefined || a === 'receipts') {
      const contractId = safeResourceId(param('contract'));
      return { screen: 'payment-history', side: role, ...(contractId ? { contractId } : {}) };
    }
    // Two steps, as on the web: legacy URL -> contract landing, which (section=deposit on a lease)
    // then moves on to the deposit agreement.
    return normalizeRentalRoute(
      { screen: 'invoice-landing', contractId: decode(a), ...contractQuery() },
      role
    );
  }

  if (a !== undefined) return null;

  if (area === 'complaints') {
    const requestId = param('requestId');
    const complaintId = param('complaintId');
    return COMPLAINT_ID.test(requestId) && COMPLAINT_ID.test(complaintId)
      ? { screen: 'complaint', requestId, complaintId }
      : { screen: 'link-error', message: COMPLAINT_LINK_INVALID };
  }

  if (area === 'payments') {
    const raw = param('paymentId').trim();
    // The web's bare /dashboard/payments list is outside the rental flow.
    if (!raw) return null;
    const paymentId = safeResourceId(raw);
    return paymentId
      ? { screen: 'payment-lookup', paymentId }
      : { screen: 'link-error', message: PAYMENT_NOT_FOUND };
  }

  return null;
}
