// Port of hs-web-app lib/dashboard-role.ts, pure parts only. The stored role (window.localStorage) and
// inferRoleFromPath (web URLs) are not ported: the mobile app already keeps `ManagementRole` in navigation state.
export type DashboardRole = 'landlord' | 'tenant';

export const DASHBOARD_ROLE_LABEL: Record<DashboardRole, string> = {
  landlord: 'Người cho thuê',
  tenant: 'Người đi thuê',
};

export function isDashboardRole(value: unknown): value is DashboardRole {
  return value === 'landlord' || value === 'tenant';
}
