import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import Ionicons from '@/components/Icon';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileInfoCard from '@/components/profile/ProfileInfoCard';
import TabHeader from '@/components/TabHeader';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import { useDialog } from '@/components/AppDialog';
import { PolicyDialog } from '@/components/PolicyDialog';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';
import SettingsScreen, { type SettingsSection } from '@/screens/SettingsScreen';
import { apiError } from '@/lib/api-error';
import { webBaseUrl } from '@/config/env';
import { buildProfileLink } from '@/lib/profile-format';
import { getReservationPolicy } from '@/services/bookingApi';

function displayName(profile: UserProfileResponse | null) {
  if (!profile) return 'Người dùng';
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return name || profile.username || profile.email;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center border-b border-border px-4 py-4 last:border-b-0">
      <Ionicons name={icon} size={20} className="text-muted-foreground" />
      <Text className="ml-3 flex-1 text-sm font-semibold text-foreground">{label}</Text>
      <Ionicons name="chevron-forward" size={18} className="text-subtle" />
    </Pressable>
  );
}

export default function ProfileScreen({
  onSelectTab,
  pendingSettings = null,
  onSettingsOpened,
}: {
  onSelectTab: (tab: MainTab) => void;
  /** Settings section requested from another screen (profile-completion banner / 1010 dialog). */
  pendingSettings?: SettingsSection | null;
  onSettingsOpened?: () => void;
}) {
  const { logout } = useAuth();
  const showDialog = useDialog();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = profile tab; otherwise the settings hub, optionally opened on one section.
  const [settings, setSettings] = useState<{ section: SettingsSection | null } | null>(
    pendingSettings ? { section: pendingSettings } : null
  );
  const [reservationPolicy, setReservationPolicy] = useState<{
    version: string;
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getUserProfileApi());
    } catch (loadError) {
      setError(apiError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pendingSettings) return;
    setSettings({ section: pendingSettings });
    onSettingsOpened?.();
  }, [pendingSettings, onSettingsOpened]);

  const name = displayName(profile);
  if (settings)
    return (
      <SettingsScreen
        key={settings.section ?? 'hub'}
        profile={profile}
        initialSection={settings.section}
        onBack={() => setSettings(null)}
        onProfileChanged={() => void load()}
      />
    );
  const profileLink = buildProfileLink(webBaseUrl, profile?.username);
  const shareLink = async () => {
    if (!profileLink) return;
    try {
      await Share.share({ message: profileLink });
    } catch (e) {
      showDialog('Không thể chia sẻ liên kết', apiError(e));
    }
  };
  const unavailable = (title: string) =>
    showDialog(
      title,
      'Backend hiện chưa cung cấp API cho chức năng này. Ứng dụng chưa hỗ trợ mục này.'
    );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <TabHeader />
      <ProfileCompletionBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <View className="bg-brand px-5 pb-8 pt-3">
          <View className="flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-2xl font-bold text-on-brand">
              Hồ sơ
            </Text>
          </View>
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator className="text-on-brand" />
            </View>
          ) : error ? (
            <View className="mt-6 rounded-2xl bg-on-brand/15 p-4">
              <Text className="text-sm text-on-brand">Không tải được thông tin tài khoản.</Text>
              <Pressable onPress={load} className="mt-3 self-start rounded-lg bg-surface px-3 py-2">
                <Text className="text-xs font-bold text-primary">Thử lại</Text>
              </Pressable>
            </View>
          ) : profile ? (
            <ProfileHeader
              profile={profile}
              name={name}
              onEdit={() => setSettings({ section: 'profile' })}
              onShareLink={profileLink ? () => void shareLink() : undefined}
            />
          ) : null}
        </View>

        <View className="px-5">
          {profile ? <ProfileInfoCard profile={profile} /> : null}

          <View className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            <MenuItem
              icon="settings-outline"
              label="Cài đặt"
              onPress={() => setSettings({ section: null })}
            />
            <MenuItem
              icon="help-circle-outline"
              label="Trung tâm hỗ trợ (chưa hỗ trợ)"
              onPress={() => unavailable('Trung tâm hỗ trợ')}
            />
            <MenuItem
              icon="information-circle-outline"
              label="Điều khoản & chính sách giữ chỗ"
              onPress={async () => {
                try {
                  const policy = await getReservationPolicy();
                  setReservationPolicy({
                    version: policy.version,
                    text: policy.text.replace(/^./, (letter) => letter.toUpperCase()),
                  });
                } catch (e) {
                  showDialog('Không tải được chính sách', apiError(e));
                }
              }}
            />
          </View>

          <Pressable
            onPress={logout}
            className="mt-6 flex-row items-center justify-center rounded-2xl bg-danger-soft py-4">
            <Ionicons name="log-out-outline" size={20} className="text-danger" />
            <Text className="ml-2 font-bold text-danger">Đăng xuất</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomTabBar active="profile" onSelect={onSelectTab} />
      <PolicyDialog
        visible={Boolean(reservationPolicy)}
        onClose={() => setReservationPolicy(null)}
        title="Chính sách giữ chỗ"
        version={reservationPolicy ? `Phiên bản ${reservationPolicy.version}` : undefined}
        text={reservationPolicy?.text}
      />
    </SafeAreaView>
  );
}
