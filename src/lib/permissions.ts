// Port of hs-web-app lib/permissions.ts and getGateLock from lib/profile-gate.ts (no React/RN).
import { missingLabels, type ProfileRequirement } from '@/lib/profile-gate';

export const FEATURE_LOCKED_MESSAGE = 'Tính năng này đang bị tạm khóa cho tài khoản của bạn';

export const PERMISSIONS = {
  LISTING_POST: 'LISTING_POST',
  APPOINTMENT_BOOK: 'APPOINTMENT_BOOK',
  APPOINTMENT_MANAGE: 'APPOINTMENT_MANAGE',
  RENTAL_REQUEST_CREATE: 'RENTAL_REQUEST_CREATE',
  RENTAL_REQUEST_MANAGE: 'RENTAL_REQUEST_MANAGE',
  CONTRACT_MANAGE: 'CONTRACT_MANAGE',
  CONTRACT_SIGN: 'CONTRACT_SIGN',
  COMPLAINT_CREATE: 'COMPLAINT_CREATE',
  MEMBERSHIP_PURCHASE: 'MEMBERSHIP_PURCHASE',
  FAVORITE_USE: 'FAVORITE_USE',
  KYC_SUBMIT: 'KYC_SUBMIT',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** UX only: when permissions are not loaded (null) nothing is hidden; the backend still enforces. */
export function hasPermission(
  permissions: readonly string[] | null | undefined,
  code: PermissionCode
): boolean {
  return !permissions || permissions.includes(code);
}

/** Notification types meaning the user's effective permissions may have changed. */
export function isPermissionChangeType(type: unknown): boolean {
  return type === 'ROLE_PERMISSIONS_CHANGED' || type === 'ACCOUNT_ROLE_CHANGED';
}

/** Backend 403 with ApiResponse code 1009; 1003 is an ownership denial and keeps its own message. */
export function isPermissionDenied(
  response: { status?: number; data?: unknown } | null | undefined
): boolean {
  const data = response?.data as { code?: unknown } | null | undefined;
  return (
    response?.status === 403 &&
    typeof data === 'object' &&
    data !== null &&
    Number(data.code) === 1009
  );
}

const PROFILE_GATE_EXEMPT: ReadonlySet<PermissionCode> = new Set([
  PERMISSIONS.FAVORITE_USE,
  PERMISSIONS.KYC_SUBMIT,
]);

/** Message for a locked action, or undefined when allowed. The permission lock keeps priority. */
export function getGateLock(
  code: PermissionCode,
  permissionAllowed: boolean,
  profile: { ready: boolean; missing: readonly ProfileRequirement[] }
): string | undefined {
  if (!permissionAllowed) return FEATURE_LOCKED_MESSAGE;
  if (profile.ready || PROFILE_GATE_EXEMPT.has(code)) return undefined;
  return `Cần cập nhật: ${missingLabels(profile.missing)}`;
}
