import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import { createThrottle, onboardingStore, refreshOnboarding } from '@/lib/onboarding-store';
import { permissionStore } from '@/lib/permission-store';
import { isPermissionChangeType } from '@/lib/permissions';
import { startKyc } from '@/lib/kyc/client';
import { gateAction } from '@/lib/profile-gate';
import {
  openSettings,
  setPermissionDeniedHandler,
  setProfileGateDeniedHandler,
} from '@/lib/profile-gate-signal';
import { subscribeNotificationEvents } from '@/lib/realtime/connections';

export const useOnboarding = () =>
  useSyncExternalStore(onboardingStore.subscribe, onboardingStore.get, onboardingStore.get);

/** Mount once while signed in: loads on sign-in, refreshes on foreground / 1010, clears on sign-out (unmount). */
export function useOnboardingSync() {
  const showDialog = useDialog();

  useEffect(() => {
    void refreshOnboarding();
    void permissionStore.refresh();
    const allowForeground = createThrottle(30_000);
    allowForeground(); // the load above counts as the first run
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && allowForeground()) {
        void refreshOnboarding();
        void permissionStore.refresh();
      }
    });
    // Same triggers as web: a 1009 denial, a role/permission notification, a socket reconnect.
    const allowRefetch = createThrottle(5_000);
    const refetchPermissions = () => {
      if (allowRefetch()) void permissionStore.refresh();
    };
    setPermissionDeniedHandler(refetchPermissions);
    const unsubscribe = subscribeNotificationEvents((event, payload) => {
      if (event === 'connect') refetchPermissions();
      else if (isPermissionChangeType((payload as { type?: unknown } | undefined)?.type))
        void permissionStore.refresh();
    });
    return () => {
      subscription.remove();
      unsubscribe();
      setPermissionDeniedHandler(undefined);
      onboardingStore.clear();
      permissionStore.clear();
    };
  }, []);

  useEffect(() => {
    const allowDialog = createThrottle(5_000);
    setProfileGateDeniedHandler(({ message, missing }) => {
      void refreshOnboarding();
      if (!allowDialog()) return;
      const action = gateAction(missing);
      showDialog('Cần hoàn thiện hồ sơ', message?.trim() || 'Vui lòng cập nhật đầy đủ hồ sơ.', [
        { text: 'Đóng', style: 'cancel' },
        action?.kind === 'kyc'
          ? { text: 'Xác minh danh tính', onPress: () => void startKyc() }
          : {
              text: 'Cập nhật hồ sơ',
              onPress: () => openSettings(action?.kind === 'settings' ? action.section : 'profile'),
            },
      ]);
    });
    return () => setProfileGateDeniedHandler(undefined);
  }, [showDialog]);
}
