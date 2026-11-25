import type { ProfileGateSection, ProfileRequirement } from '@/lib/profile-gate';

// Signals so axios-client (1010) and the banner can reach the app without importing screens/React (no import cycles).
export type ProfileGateDenial = { message?: string; missing: ProfileRequirement[] };

let denied: ((denial: ProfileGateDenial) => boolean | void) | undefined;
const shownDenials = new WeakSet<object>();
export const setProfileGateDeniedHandler = (next: typeof denied) => {
  denied = next;
};
export const notifyProfileGateDenied = (denial: ProfileGateDenial, error?: object) => {
  if (denied?.(denial) && error) shownDenials.add(error);
};
export const hasProfileGateNotice = (error: unknown) =>
  typeof error === 'object' && error !== null && shownDenials.has(error);

let permissionDenied: (() => void) | undefined;
export const setPermissionDeniedHandler = (next: typeof permissionDenied) => {
  permissionDenied = next;
};
export const notifyPermissionDenied = () => permissionDenied?.();

let openSettingsHandler: ((section: ProfileGateSection) => void) | undefined;
export const setOpenSettingsHandler = (next: typeof openSettingsHandler) => {
  openSettingsHandler = next;
};
export const openSettings = (section: ProfileGateSection) => openSettingsHandler?.(section);
