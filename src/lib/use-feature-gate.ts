// Port of hs-web-app hooks/usePermission.ts; the permission list lives here instead of Redux.
import { useSyncExternalStore } from 'react';

import { useDialog } from '@/components/AppDialog';
import { getGateLock, hasPermission, type PermissionCode } from '@/lib/permissions';
import { useOnboarding } from '@/lib/use-onboarding';
import { permissionStore } from '@/lib/permission-store';

/**
 * Locked when the permission is missing or the profile is incomplete. `title` is the reason (show it
 * next to the disabled control: mobile has no tooltip); `guard()` returns false and shows it.
 */
export function useFeatureGate(code: PermissionCode) {
  const showDialog = useDialog();
  const permissions = useSyncExternalStore(
    permissionStore.subscribe,
    permissionStore.get,
    permissionStore.get
  );
  const { onboarding } = useOnboarding();
  const title = getGateLock(code, hasPermission(permissions, code), {
    ready: onboarding?.serviceReady ?? true,
    missing: onboarding?.missing ?? [],
  });
  return {
    allowed: !title,
    title,
    guard: () => {
      if (!title) return true;
      showDialog('Thông báo', title);
      return false;
    },
  };
}
