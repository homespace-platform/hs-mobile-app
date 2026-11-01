import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import Ionicons from '@/components/Icon';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import TabHeader from '@/components/TabHeader';
import ThemeSelector from '@/components/ThemeSelector';
import { useDialog } from '@/components/AppDialog';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';
import type { ManagementSection } from '@/services/managementApi';
import ProfileEditScreen from '@/screens/ProfileEditScreen';
import AccountSecurityScreen from '@/screens/AccountSecurityScreen';
import { apiError } from '@/lib/api-error';
import { getReservationPolicy } from '@/services/bookingApi';

function displayName(profile: UserProfileResponse | null) {
  if (!profile) return 'Người dùng';
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return name || profile.username || profile.email;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 px-2 py-3">
      <Text className="text-xs text-subtle">{label}</Text>
      <Text className="mt-1 text-sm font-semibold text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function Action({
  icon,
  label,
  note,
  onPress,
}: {
  icon: IconName;
  label: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="w-[48%] rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
        <Ionicons name={icon} size={22} className="text-primary" />
      </View>
      <Text className="mt-3 text-sm font-bold text-foreground">{label}</Text>
      <Text className="mt-1 text-xs leading-4 text-muted-foreground">{note}</Text>
    </Pressable>
  );
}

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
  onOpenManagement,
  onOpenFavorites,
}: {
  onSelectTab: (tab: MainTab) => void;
  onOpenManagement: (section: ManagementSection) => void;
  onOpenFavorites: () => void;
}) {
  const { logout } = useAuth();
  const showDialog = useDialog();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [security, setSecurity] = useState(false);

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

  const name = displayName(profile);
  if (editing && profile)
    return (
      <ProfileEditScreen
        profile={profile}
        onBack={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void load();
        }}
      />
    );
  if (security)
    return (
      <AccountSecurityScreen
        onBack={() => {
          setSecurity(false);
          void load();
        }}
      />
    );
  const unavailable = (title: string) =>
    showDialog(
      title,
      'Backend hiện chưa cung cấp API cho chức năng này. Ứng dụng chưa hỗ trợ mục này.'
    );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <TabHeader
        title="Hồ sơ"
        right={
          <Pressable
            disabled={!profile}
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            className="flex-row items-center rounded-full bg-primary-soft px-4 py-2">
            <Ionicons name="create-outline" size={15} className="text-primary" />
            <Text className="ml-1.5 text-xs font-semibold text-primary">Chỉnh sửa</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <View className="bg-brand px-5 pb-8 pt-3">
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
          ) : (
            <View className="mt-7 flex-row items-center">
              <View className="rounded-full border-4 border-on-brand/30">
                <Avatar uri={profile?.avatarUrl} name={name} size={76} />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-xl font-bold text-on-brand">{name}</Text>
                <Text className="mt-1 text-sm text-on-brand-muted">{profile?.email}</Text>
                <View className="mt-2 self-start rounded-full bg-on-brand/20 px-3 py-1">
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={14} className="text-on-brand" />
                    <Text className="ml-1 text-xs font-semibold text-on-brand">
                      {profile?.kycVerified ? 'Đã xác minh danh tính' : 'Chưa xác minh danh tính'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <View className="-mt-4 px-5">
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <Action
              icon="business-outline"
              label="Tin đăng của tôi"
              note="Quản lý nhà đang cho thuê"
              onPress={() => onOpenManagement('landlord-properties')}
            />
            <Action
              icon="heart-outline"
              label="Đã yêu thích"
              note="Các căn nhà bạn đã lưu"
              onPress={onOpenFavorites}
            />
            <Action
              icon="calendar-outline"
              label="Lịch xem nhà"
              note="Lịch hẹn sắp tới"
              onPress={() => onOpenManagement('tenant-appointments')}
            />
            <Action
              icon="document-text-outline"
              label="Hợp đồng"
              note="Theo dõi hợp đồng thuê"
              onPress={() =>
                showDialog('Hợp đồng', 'Bạn muốn xem hợp đồng ở vai trò nào?', [
                  { text: 'Người thuê', onPress: () => onOpenManagement('tenant-contracts') },
                  { text: 'Chủ nhà', onPress: () => onOpenManagement('landlord-contracts') },
                  { text: 'Đóng', style: 'cancel' },
                ])
              }
            />
          </View>

          {profile ? (
            <View className="mt-6 rounded-3xl border border-border bg-surface p-3 shadow-sm">
              <View className="flex-row items-center justify-between px-2 pb-2 pt-1">
                <Text className="text-base font-bold text-foreground">Thông tin cá nhân</Text>
                <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
                  <Text className="text-xs font-semibold text-primary">Cập nhật</Text>
                </Pressable>
              </View>
              <View className="flex-row flex-wrap">
                <Field label="Tên đăng nhập" value={profile.username} />
                <Field label="Vai trò" value={profile.role || 'USER'} />
                <Field label="Số điện thoại" value={profile.phone || 'Chưa cập nhật'} />
                <Field label="Ngày sinh" value={profile.dob || 'Chưa cập nhật'} />
                <Field label="Giới tính" value={profile.gender || 'Chưa cập nhật'} />
                <Field label="Trạng thái" value={profile.active ? 'Đang hoạt động' : 'Tạm khóa'} />
              </View>
            </View>
          ) : null}

          <ThemeSelector />

          <View className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            <MenuItem
              icon="shield-checkmark-outline"
              label="Bảo mật & xác minh danh tính"
              onPress={() => setSecurity(true)}
            />
            <MenuItem
              icon="notifications-outline"
              label="Cài đặt thông báo (chưa hỗ trợ)"
              onPress={() => unavailable('Thông báo')}
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
                  showDialog(
                    `Chính sách giữ chỗ · ${policy.version}`,
                    policy.text.replace(/^./, (letter) => letter.toUpperCase())
                  );
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
    </SafeAreaView>
  );
}
