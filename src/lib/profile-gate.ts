// Pure port of hs-web-app lib/profile-gate.ts (no React/RN). Mobile has no KYC screen, so KYC maps to no section.
export type ProfileRequirement = 'PROFILE' | 'ADDRESS' | 'BANK_ACCOUNT' | 'KYC';
/** Settings sections that can complete a requirement on mobile (a subset of SettingsSection). */
export type ProfileGateSection = 'profile' | 'bank-accounts';

/** Canonical display order, label and the mobile settings section for each requirement (null = none). */
export const PROFILE_REQUIREMENTS: readonly {
  code: ProfileRequirement;
  label: string;
  section: ProfileGateSection | null;
}[] = [
  { code: 'PROFILE', label: 'Thông tin cá nhân', section: 'profile' },
  // The profile screen already contains the address block.
  { code: 'ADDRESS', label: 'Địa chỉ', section: 'profile' },
  { code: 'BANK_ACCOUNT', label: 'Tài khoản ngân hàng', section: 'bank-accounts' },
  // KYC is switched off on mobile: wire its screen here (section id) when the in-app KYC flow exists.
  { code: 'KYC', label: 'Xác minh danh tính (KYC)', section: null },
];

export type OnboardingStatusInput = {
  completedSteps?: string[];
  requiredSteps?: string[];
  passwordSet?: boolean;
  missingRequirements?: string[];
  serviceReady?: boolean;
};

export type ProfileGateState = {
  passwordSet: boolean;
  missing: ProfileRequirement[];
  serviceReady: boolean;
};

const isRequirement = (value: unknown): value is ProfileRequirement =>
  PROFILE_REQUIREMENTS.some((item) => item.code === value);

/** Uses the new backend fields; falls back to the legacy steps (no KYC info, so KYC never blocks). */
export function normalizeOnboardingStatus(raw: OnboardingStatusInput): ProfileGateState {
  const completed = raw.completedSteps ?? [];
  const missing = Array.isArray(raw.missingRequirements)
    ? raw.missingRequirements.filter(isRequirement)
    : (raw.requiredSteps ?? []).filter(
        (step): step is ProfileRequirement =>
          isRequirement(step) && step !== 'KYC' && !completed.includes(step)
      );
  return {
    passwordSet:
      typeof raw.passwordSet === 'boolean' ? raw.passwordSet : completed.includes('PASSWORD'),
    missing: PROFILE_REQUIREMENTS.map((item) => item.code).filter((code) => missing.includes(code)),
    serviceReady: typeof raw.serviceReady === 'boolean' ? raw.serviceReady : missing.length === 0,
  };
}

export function missingItems(missing: readonly ProfileRequirement[]) {
  return PROFILE_REQUIREMENTS.filter((item) => missing.includes(item.code));
}

export function missingLabels(missing: readonly ProfileRequirement[]): string {
  return (
    missingItems(missing)
      .map((item) => item.label)
      .join(', ') || 'hồ sơ'
  );
}

/** Settings section of the first missing item that mobile can complete, or null (e.g. only KYC). */
export function firstGateSection(
  missing: readonly ProfileRequirement[]
): ProfileGateSection | null {
  return missingItems(missing).find((item) => item.section)?.section ?? null;
}

/** Backend 403 with ApiResponse code 1010 (profile incomplete); the server message is kept. */
export function isProfileIncomplete(
  response: { status?: number; data?: unknown } | null | undefined
): boolean {
  const data = response?.data as { code?: unknown } | null | undefined;
  return (
    response?.status === 403 &&
    typeof data === 'object' &&
    data !== null &&
    Number(data.code) === 1010
  );
}

/** `result.missing` of a 1010 response, filtered to known requirements. */
export function profileGateMissing(
  response: { data?: unknown } | null | undefined
): ProfileRequirement[] {
  const missing = (response?.data as { result?: { missing?: unknown } } | null | undefined)?.result
    ?.missing;
  return Array.isArray(missing) ? missing.filter(isRequirement) : [];
}
