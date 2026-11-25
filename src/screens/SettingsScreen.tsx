import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ionicons from '@/components/Icon';
import { ScreenHeader } from '@/components/Screen';
import AccountSecurityScreen from '@/screens/AccountSecurityScreen';
import AppearanceSettingsScreen from '@/screens/AppearanceSettingsScreen';
import NotificationSettingsScreen from '@/screens/NotificationSettingsScreen';
import PaymentSettingsScreen from '@/screens/PaymentSettingsScreen';
import ProfileEditScreen from '@/screens/ProfileEditScreen';
import type { UserProfileResponse } from '@/types/api';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Same five sections, labels and order as the web settings menu (components/settings/settings-nav.ts).
// KYC is intentionally absent: it is switched off for now.
export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'person-outline' },
  { id: 'account-security', label: 'Tài khoản và bảo mật', icon: 'shield-outline' },
  { id: 'bank-accounts', label: 'Tài khoản ngân hàng', icon: 'business-outline' },
  { id: 'appearance', label: 'Giao diện', icon: 'color-palette-outline' },
  { id: 'notifications', label: 'Thông báo', icon: 'notifications-outline' },
];

export type SettingsSection =
  'profile' | 'account-security' | 'bank-accounts' | 'appearance' | 'notifications';

export default function SettingsScreen({
  profile,
  initialSection = null,
  onBack,
  onProfileChanged,
}: {
  profile: UserProfileResponse | null;
  /** Open a section straight away (e.g. the "Chỉnh sửa" button on the profile header). */
  initialSection?: SettingsSection | null;
  onBack: () => void;
  /** Ask the parent to reload the profile after something that may have changed it. */
  onProfileChanged: () => void;
}) {
  const [section, setSection] = useState<SettingsSection | null>(initialSection);
  // Opened on a specific section (profile header shortcut): Back goes straight to the profile tab.
  const backToList = () => (initialSection ? onBack() : setSection(null));

  if (section === 'profile' && profile)
    return (
      <ProfileEditScreen
        profile={profile}
        onBack={backToList}
        onSaved={() => {
          backToList();
          onProfileChanged();
        }}
      />
    );
  if (section === 'account-security')
    return (
      <AccountSecurityScreen
        onBack={() => {
          backToList();
          onProfileChanged();
        }}
      />
    );
  if (section === 'bank-accounts') return <PaymentSettingsScreen onBack={backToList} />;
  if (section === 'appearance') return <AppearanceSettingsScreen onBack={backToList} />;
  if (section === 'notifications') return <NotificationSettingsScreen onBack={backToList} />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Cài đặt" onBack={onBack} />
      <ScrollView contentContainerClassName="px-5 pb-10 pt-4">
        <View className="overflow-hidden rounded-3xl border border-border bg-surface">
          {SETTINGS_SECTIONS.map((item, index) => (
            <Pressable
              key={item.id}
              // The profile section needs the loaded profile; a failed load keeps the row inert.
              disabled={item.id === 'profile' && !profile}
              onPress={() => setSection(item.id)}
              accessibilityRole="button"
              className={`min-h-14 flex-row items-center px-4 py-4 ${index ? 'border-t border-border' : ''} ${item.id === 'profile' && !profile ? 'opacity-50' : ''}`}>
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
                <Ionicons name={item.icon} size={20} className="text-primary" />
              </View>
              <Text className="ml-3 flex-1 text-sm font-semibold text-foreground">
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} className="text-subtle" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
