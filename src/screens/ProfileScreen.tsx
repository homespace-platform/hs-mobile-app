import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    <View className="w-1/2 px-1 py-2">
      <Text className="text-xs text-slate-400">{label}</Text>
      <Text className="mt-0.5 text-sm text-slate-800">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
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

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <Text className="text-sm font-semibold text-slate-800">HomeSpace</Text>
        <Pressable onPress={logout}>
          <Text className="text-sm text-slate-500">Đăng xuất</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-5 py-6">
        <Text className="text-2xl font-bold text-slate-800">
          {loading ? 'Đang tải...' : displayName(profile)}
        </Text>

        {error ? (
          <View className="mt-4 rounded-xl bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-600">{error}</Text>
            <Pressable onPress={load} className="mt-3 self-start rounded-lg bg-red-100 px-3 py-2">
              <Text className="text-xs font-semibold text-red-700">Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && profile ? (
          <View className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row flex-wrap">
              <Field label="Username" value={profile.username} />
              <Field label="Email" value={profile.email} />
              <Field label="Họ" value={profile.lastName || '—'} />
              <Field label="Tên" value={profile.firstName || '—'} />
              <Field label="Số điện thoại" value={profile.phone || '—'} />
              <Field label="Ngày sinh" value={profile.dob || '—'} />
              <Field label="Giới tính" value={profile.gender || '—'} />
              <Field label="Vai trò" value={profile.role || '—'} />
              <Field
                label="Email đã xác thực"
                value={profile.emailVerified ? 'Có' : 'Chưa'}
              />
              <Field label="Trạng thái" value={profile.active ? 'Active' : 'Inactive'} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
