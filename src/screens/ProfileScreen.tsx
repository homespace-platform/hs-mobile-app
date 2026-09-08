import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
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
      <Text className="text-xs text-slate-400">{label}</Text>
      <Text className="mt-1 text-sm font-semibold text-slate-800" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function Action({ icon, label, note }: { icon: IconName; label: string; note: string }) {
  return (
    <Pressable className="w-[48%] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
        <Ionicons name={icon} size={22} color="#2563eb" />
      </View>
      <Text className="mt-3 text-sm font-bold text-slate-900">{label}</Text>
      <Text className="mt-1 text-xs leading-4 text-slate-500">{note}</Text>
    </Pressable>
  );
}

function MenuItem({ icon, label }: { icon: IconName; label: string }) {
  return (
    <Pressable className="flex-row items-center border-b border-slate-100 px-4 py-4 last:border-b-0">
      <Ionicons name={icon} size={20} color="#64748b" />
      <Text className="ml-3 flex-1 text-sm font-semibold text-slate-800">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
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
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <View className="bg-blue-600 px-5 pb-8 pt-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-widest text-blue-100">
                HomeSpace
              </Text>
              <Text className="mt-1 text-2xl font-bold text-white">Tài khoản</Text>
            </View>
            <Pressable className="flex-row items-center rounded-full bg-white/15 px-4 py-2">
              <Ionicons name="create-outline" size={15} color="white" />
              <Text className="ml-1.5 text-xs font-semibold text-white">Chỉnh sửa</Text>
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="white" />
            </View>
          ) : error ? (
            <View className="mt-6 rounded-2xl bg-white/15 p-4">
              <Text className="text-sm text-white">Không tải được thông tin tài khoản.</Text>
              <Pressable onPress={load} className="mt-3 self-start rounded-lg bg-white px-3 py-2">
                <Text className="text-xs font-bold text-blue-700">Thử lại</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-7 flex-row items-center">
              <View className="rounded-full border-4 border-white/30">
                <Avatar uri={profile?.avatarUrl} name={name} size={76} />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-xl font-bold text-white">{name}</Text>
                <Text className="mt-1 text-sm text-blue-100">{profile?.email}</Text>
                <View className="mt-2 self-start rounded-full bg-emerald-400/20 px-3 py-1">
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={14} color="#d1fae5" />
                    <Text className="ml-1 text-xs font-semibold text-emerald-100">
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
            <View className="mt-6 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm">
              <View className="flex-row items-center justify-between px-2 pb-2 pt-1">
                <Text className="text-base font-bold text-slate-900">Thông tin cá nhân</Text>
                <Text className="text-xs font-semibold text-blue-600">Cập nhật</Text>
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

          <View className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <MenuItem icon="shield-checkmark-outline" label="Bảo mật tài khoản" />
            <MenuItem icon="notifications-outline" label="Cài đặt thông báo" />
            <MenuItem icon="help-circle-outline" label="Trung tâm hỗ trợ" />
            <MenuItem icon="information-circle-outline" label="Điều khoản và chính sách" />
          </View>

          <Pressable
            onPress={logout}
            className="mt-6 flex-row items-center justify-center rounded-2xl bg-red-50 py-4">
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            <Text className="ml-2 font-bold text-red-600">Đăng xuất</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomTabBar active="profile" onSelect={onSelectTab} />
    </SafeAreaView>
  );
}
