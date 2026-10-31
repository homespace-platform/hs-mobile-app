import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import Ionicons from '@/components/Icon';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import ThemeSelector from '@/components/ThemeSelector';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';

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

function Action({ icon, label, note }: { icon: IconName; label: string; note: string }) {
  return (
    <Pressable className="w-[48%] rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
        <Ionicons name={icon} size={22} className="text-primary" />
      </View>
      <Text className="mt-3 text-sm font-bold text-foreground">{label}</Text>
      <Text className="mt-1 text-xs leading-4 text-muted-foreground">{note}</Text>
    </Pressable>
  );
}

function MenuItem({ icon, label }: { icon: IconName; label: string }) {
  return (
    <Pressable className="flex-row items-center border-b border-border px-4 py-4 last:border-b-0">
      <Ionicons name={icon} size={20} className="text-muted-foreground" />
      <Text className="ml-3 flex-1 text-sm font-semibold text-foreground">{label}</Text>
      <Ionicons name="chevron-forward" size={18} className="text-subtle" />
    </Pressable>
  );
}

export default function ProfileScreen({ onSelectTab }: { onSelectTab: (tab: MainTab) => void }) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getUserProfileApi());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const name = displayName(profile);
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <View className="bg-brand px-5 pb-8 pt-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-widest text-on-brand-muted">
                HomeSpace
              </Text>
              <Text className="mt-1 text-2xl font-bold text-on-brand">Tài khoản</Text>
            </View>
            <Pressable className="flex-row items-center rounded-full bg-on-brand/15 px-4 py-2">
              <Ionicons name="create-outline" size={15} className="text-on-brand" />
              <Text className="ml-1.5 text-xs font-semibold text-on-brand">Chỉnh sửa</Text>
            </Pressable>
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
                      {profile?.emailVerified ? 'Đã xác thực' : 'Tài khoản hoạt động'}
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
            />
            <Action icon="heart-outline" label="Đã yêu thích" note="Các căn nhà bạn đã lưu" />
            <Action icon="calendar-outline" label="Lịch xem nhà" note="Lịch hẹn sắp tới" />
            <Action icon="document-text-outline" label="Hợp đồng" note="Theo dõi hợp đồng thuê" />
          </View>

          {profile ? (
            <View className="mt-6 rounded-3xl border border-border bg-surface p-3 shadow-sm">
              <View className="flex-row items-center justify-between px-2 pb-2 pt-1">
                <Text className="text-base font-bold text-foreground">Thông tin cá nhân</Text>
                <Text className="text-xs font-semibold text-primary">Cập nhật</Text>
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
            <MenuItem icon="shield-checkmark-outline" label="Bảo mật tài khoản" />
            <MenuItem icon="notifications-outline" label="Cài đặt thông báo" />
            <MenuItem icon="help-circle-outline" label="Trung tâm hỗ trợ" />
            <MenuItem icon="information-circle-outline" label="Điều khoản và chính sách" />
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
