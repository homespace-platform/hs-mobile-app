// Port of hs-web-app lib/contract-routes.ts. Same function names; instead of a web path they return a route
// descriptor the mobile navigation maps to a screen. The web query string (?tab=&section=&invoice=) is a plain
// object spread into the descriptor: { ...contractDetailPath(role, id), tab: 'sign' }.
import type { DashboardRole } from '@/lib/rental/dashboard-role';

export interface ContractRouteQuery {
  tab?: string;
  section?: string;
  invoice?: string;
}

export type ContractRoute =
  /** `kind` is the web list's ?kind= (default LEASE). */
  | ({
      screen: 'contract-list';
      side: DashboardRole;
      kind?: 'LEASE' | 'DEPOSIT';
    } & ContractRouteQuery)
  | ({ screen: 'contract-detail'; side: DashboardRole; contractId: string } & ContractRouteQuery)
  /** Web /dashboard/contracts/<id>: the side comes from the contract parties (see contractLandingTarget). */
  | ({ screen: 'contract-landing'; contractId: string } & ContractRouteQuery)
  /** Web legacy /dashboard/invoices/<contractId>: redirects to the contract's payment tab. */
  | ({ screen: 'invoice-landing'; contractId: string } & ContractRouteQuery);

export function contractListPath(role: DashboardRole): ContractRoute {
  return { screen: 'contract-list', side: role };
}

export function contractDetailPath(role: DashboardRole, contractId: string): ContractRoute {
  return { screen: 'contract-detail', side: role, contractId };
}

/** Role-agnostic contract route: the landing page resolves the viewer's side and keeps the query. */
export function contractLandingPath(contractId: string): ContractRoute {
  return { screen: 'contract-landing', contractId };
}

/** Legacy payments URL: now only a redirect to the contract page's payment tab. */
export function invoiceDetailPath(contractId: string): ContractRoute {
  return { screen: 'invoice-landing', contractId };
}
