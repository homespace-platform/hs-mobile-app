import { Text, View } from 'react-native';

import Ionicons from '@/components/Icon';
import { formatMonthYear } from '@/lib/profile-format';
import type { UserProfileResponse } from '@/types/api';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="min-w-0 flex-1 text-right text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

/** Same rows as the web public profile; private fields live in Settings -> Thông tin cá nhân. */
export default function ProfileInfoCard({ profile }: { profile: UserProfileResponse }) {
  const area = profile.address?.city;
  const joined = formatMonthYear(profile.createdAt);
  return (
    <View className="mt-6 rounded-3xl border border-border bg-surface p-4 shadow-sm">
      <View className="mb-1 flex-row items-center gap-2">
        <Ionicons name="at-outline" size={16} className="text-primary" />
        <Text className="text-base font-bold text-foreground">Thông tin cá nhân</Text>
      </View>
      <InfoRow label="Tên người dùng" value={`@${profile.username}`} />
      {area ? <InfoRow label="Khu vực" value={area} /> : null}
      {joined ? <InfoRow label="Tham gia" value={joined} /> : null}
      <InfoRow
        label="Xác minh"
        value={profile.kycVerified ? 'Đã xác minh danh tính' : 'Chưa xác minh'}
      />
    </View>
  );
}
