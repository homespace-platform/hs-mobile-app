import type { ProfileGateSection, ProfileRequirement } from '@/lib/profile-gate';

// Signals so axios-client (1010) and the banner can reach the app without importing screens/React (no import cycles).
export type ProfileGateDenial = { message?: string; missing: ProfileRequirement[] };

let denied: ((denial: ProfileGateDenial) => void) | undefined;
export const setProfileGateDeniedHandler = (next: typeof denied) => {
  denied = next;
};
export const notifyProfileGateDenied = (denial: ProfileGateDenial) => denied?.(denial);

let openSettingsHandler: ((section: ProfileGateSection) => void) | undefined;
export const setOpenSettingsHandler = (next: typeof openSettingsHandler) => {
  openSettingsHandler = next;
};
export const openSettings = (section: ProfileGateSection) => openSettingsHandler?.(section);
