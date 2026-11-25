import { Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import Ionicons from '@/components/Icon';
import { formatMonthYear } from '@/lib/profile-format';
import type { UserProfileResponse } from '@/types/api';

function Chip({
  icon,
  text,
}: {
  icon: 'calendar-outline' | 'location-outline' | 'shield-checkmark-outline';
  text: string;
}) {
  return (
    <View className="flex-row items-center rounded-full bg-on-brand/20 px-3 py-1">
      <Ionicons name={icon} size={13} className="text-on-brand" />
      <Text className="ml-1 text-xs font-semibold text-on-brand">{text}</Text>
    </View>
  );
}

export default function ProfileHeader({
  profile,
  name,
  onEdit,
  onShareLink,
}: {
  profile: UserProfileResponse;
  name: string;
  onEdit: () => void;
  /** Omitted when no public web URL is configured: the button is hidden. */
  onShareLink?: () => void;
}) {
  const joined = formatMonthYear(profile.createdAt);
  const area = profile.address?.city;
  return (
    <View className="mt-6 items-center">
      <View className="rounded-full border-4 border-on-brand/30">
        <Avatar uri={profile.avatarUrl} name={name} size={96} />
      </View>
      <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
        <Text className="text-xl font-bold text-on-brand">{name}</Text>
        {profile.kycVerified ? (
          <View
            accessibilityLabel="Đã xác minh danh tính"
            className="h-5 w-5 items-center justify-center rounded-full bg-on-brand">
            <Ionicons name="checkmark" size={13} className="text-brand" />
          </View>
        ) : null}
      </View>
      <Text className="mt-0.5 text-sm text-on-brand-muted">@{profile.username}</Text>
      <View className="mt-4 flex-row flex-wrap justify-center gap-2">
        {joined ? <Chip icon="calendar-outline" text={`Tham gia ${joined}`} /> : null}
        {area ? <Chip icon="location-outline" text={area} /> : null}
        {profile.kycVerified ? (
          <Chip icon="shield-checkmark-outline" text="Đã xác minh danh tính" />
        ) : null}
      </View>
      <View className="mt-5 flex-row flex-wrap justify-center gap-2">
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          className="flex-row items-center rounded-xl bg-surface px-4 py-2.5">
          <Ionicons name="create-outline" size={16} className="text-primary" />
          <Text className="ml-1.5 text-sm font-semibold text-primary">Chỉnh sửa trang cá nhân</Text>
        </Pressable>
        {onShareLink ? (
          <Pressable
            onPress={onShareLink}
            accessibilityRole="button"
            className="flex-row items-center rounded-xl bg-on-brand/15 px-4 py-2.5">
            <Ionicons name="copy-outline" size={16} className="text-on-brand" />
            <Text className="ml-1.5 text-sm font-semibold text-on-brand">Sao chép liên kết</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
