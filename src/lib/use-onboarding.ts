import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import { createThrottle, onboardingStore, refreshOnboarding } from '@/lib/onboarding-store';
import { firstGateSection } from '@/lib/profile-gate';
import { openSettings, setProfileGateDeniedHandler } from '@/lib/profile-gate-signal';

export const useOnboarding = () =>
  useSyncExternalStore(onboardingStore.subscribe, onboardingStore.get, onboardingStore.get);

/** Mount once while signed in: loads on sign-in, refreshes on foreground / 1010, clears on sign-out (unmount). */
export function useOnboardingSync() {
  const showDialog = useDialog();

  useEffect(() => {
    void refreshOnboarding();
    const allowForeground = createThrottle(30_000);
    allowForeground(); // the load above counts as the first run
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && allowForeground()) void refreshOnboarding();
    });
    return () => {
      subscription.remove();
      onboardingStore.clear();
    };
  }, []);

  useEffect(() => {
    const allowDialog = createThrottle(5_000);
    setProfileGateDeniedHandler(({ message, missing }) => {
      void refreshOnboarding();
      if (!allowDialog()) return;
      showDialog('Cần hoàn thiện hồ sơ', message?.trim() || 'Vui lòng cập nhật đầy đủ hồ sơ.', [
        { text: 'Đóng', style: 'cancel' },
        {
          text: 'Cập nhật hồ sơ',
          onPress: () => openSettings(firstGateSection(missing) ?? 'profile'),
        },
      ]);
    });
    return () => setProfileGateDeniedHandler(undefined);
  }, [showDialog]);
}
