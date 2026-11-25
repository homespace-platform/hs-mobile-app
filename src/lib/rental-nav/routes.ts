// The one route model of the rental flow (web URL -> route object). See docs/yeu-cau-thue/phase1-nav.md.
import type { ContractRoute, ContractRouteQuery } from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { paymentModulePath, paymentSection, safeResourceId } from '@/lib/rental/payment-module';
import type { ManagementDestination } from '@/lib/dashboard-navigation';

export type RentalListMode = 'RECEIVED' | 'SENT';

export type RentalRoute =
  /** contract-list, contract-detail, contract-landing, invoice-landing (query: tab, section, invoice). */
  | ContractRoute
  /** /dashboard/rental-requests[/my-requests][?requestId=]; `invalidLink` = the id was not a UUID. */
  | { screen: 'rental-requests'; mode: RentalListMode; requestId?: string; invalidLink?: boolean }
  /** /dashboard/<side>/contracts/reservations/<rentalId> */
  | { screen: 'reservation'; side: DashboardRole; rentalId: string }
  /** /dashboard/invoices[?contract=] */
  | { screen: 'payment-history'; side: DashboardRole; contractId?: string }
  /** /dashboard/complaints?requestId=&complaintId= */
  | { screen: 'complaint'; requestId: string; complaintId: string }
  /** /dashboard/payments?paymentId= : only compared with the caller's own /mine list, then paymentLink(). */
  | { screen: 'payment-lookup'; paymentId: string }
  /** A rental link the web answers with a message instead of a page. */
  | { screen: 'link-error'; message: string; contractListSide?: DashboardRole };

/** `replace` is the web's router.replace: tab/filter changes, clearing ?requestId=, landing redirects. */
export type RentalNavigate = (route: RentalRoute, options?: { replace?: boolean }) => void;

/** Props every rental screen receives on top of its web page props. */
export type RentalScreenNavProps = { onBack: () => void; onNavigate: RentalNavigate };

export const DOCUMENT_NOT_FOUND = 'Không tìm thấy văn bản hoặc bạn không có quyền xem.';
export const CONTRACT_NOT_FOUND = 'Không tìm thấy hợp đồng này hoặc bạn không có quyền xem.';

/** The web's legacy /dashboard/invoices/<contractId> page redirects before anything renders. */
export function normalizeRentalRoute(
  route: RentalRoute,
  side: DashboardRole = 'tenant'
): RentalRoute {
  if (route.screen !== 'invoice-landing') return route;
  const contractId = safeResourceId(route.contractId);
  return contractId
    ? paymentModulePath(contractId, paymentSection(route.section ?? null), route.invoice)
    : { screen: 'link-error', message: CONTRACT_NOT_FOUND, contractListSide: side };
}

/** Only the query part of a route: contractLandingTarget spreads whatever it is given. */
export function contractQueryOf({ tab, section, invoice }: ContractRouteQuery): ContractRouteQuery {
  return {
    ...(tab ? { tab } : {}),
    ...(section ? { section } : {}),
    ...(invoice ? { invoice } : {}),
  };
}

/** Back stack, bottom first. Empty = the rental flow is closed. */
export function navigateStack(
  stack: readonly RentalRoute[],
  route: RentalRoute,
  { replace = false }: { replace?: boolean } = {}
): RentalRoute[] {
  return [...(replace ? stack.slice(0, -1) : stack), normalizeRentalRoute(route)];
}

export const backStack = (stack: readonly RentalRoute[]): RentalRoute[] => stack.slice(0, -1);

/** Remount identity: changing only tab/section/invoice/kind/requestId keeps the mounted screen. */
export function routeKey(route: RentalRoute): string {
  const parts = (() => {
    switch (route.screen) {
      case 'rental-requests':
        return [route.mode];
      case 'contract-list':
        return [route.side];
      case 'contract-detail':
        return [route.side, route.contractId];
      case 'contract-landing':
      case 'invoice-landing':
        return [route.contractId];
      case 'reservation':
        return [route.side, route.rentalId];
      case 'payment-history':
        return [route.side, route.contractId];
      case 'complaint':
        return [route.requestId, route.complaintId];
      case 'payment-lookup':
        return [route.paymentId];
      case 'link-error':
        return [route.message];
    }
  })();
  return [route.screen, ...parts].filter(Boolean).join(':');
}

/** The Quản lý menu entries that belong to the rental flow. */
export function rentalRouteForDestination(destination: ManagementDestination): RentalRoute | null {
  const side: DashboardRole = destination.startsWith('landlord-') ? 'landlord' : 'tenant';
  switch (destination) {
    case 'landlord-requests':
      return { screen: 'rental-requests', mode: 'RECEIVED' };
    case 'tenant-requests':
      return { screen: 'rental-requests', mode: 'SENT' };
    case 'landlord-contracts':
    case 'tenant-contracts':
      return { screen: 'contract-list', side };
    case 'landlord-payments':
    case 'tenant-payments':
      return { screen: 'payment-history', side };
    default:
      return null;
  }
}
