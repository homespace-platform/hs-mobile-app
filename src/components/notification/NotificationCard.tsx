import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import Ionicons from '@/components/Icon';
import {
  formatNotificationDate,
  getNotificationRecipientSideLabel,
  getNotificationTag,
  getSafeActionPath,
  isNotificationUnread,
  type NotificationCategory,
  type NotificationItem,
} from '@/lib/notification';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<NotificationCategory, IconName> = {
  SYSTEM: 'notifications-outline',
  NEWS: 'newspaper-outline',
  ACCOUNT: 'shield-checkmark-outline',
  LISTING: 'business-outline',
  APPOINTMENT: 'calendar-outline',
  RENTAL_REQUEST: 'key-outline',
  CONTRACT: 'document-text-outline',
  PAYMENT: 'card-outline',
  CHAT: 'chatbubble-ellipses-outline',
};

// Semantic tone per category (web uses one hue per category).
const TAG_TONES: Record<NotificationCategory, string> = {
  NEWS: 'bg-success-soft text-success',
  SYSTEM: 'bg-success-soft text-success',
  ACCOUNT: 'bg-success-soft text-success',
  PAYMENT: 'bg-danger-soft text-danger',
  APPOINTMENT: 'bg-warning-soft text-warning',
  CONTRACT: 'bg-primary-soft text-primary',
  RENTAL_REQUEST: 'bg-primary-soft text-primary',
  LISTING: 'bg-primary-soft text-primary',
  CHAT: 'bg-primary-soft text-primary',
};

export default function NotificationCard({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const unread = isNotificationUnread(item);
  const tone = (TAG_TONES[item.category] ?? TAG_TONES.SYSTEM).split(' ');
  const side = getNotificationRecipientSideLabel(item);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Chưa đọc. ' : ''}${item.title}`}
      className={`mb-3 flex-row rounded-2xl border p-4 ${unread ? 'border-primary-border bg-primary-soft' : 'border-border bg-surface'}`}>
      <View className="mr-3 pt-0.5">
        {unread ? (
          <View className="absolute -left-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-danger" />
        ) : null}
        <View
          className={`h-11 w-11 items-center justify-center rounded-xl ${unread ? 'bg-surface' : 'bg-primary-soft'}`}>
          <Ionicons
            name={ICONS[item.category] ?? ICONS.SYSTEM}
            size={22}
            className="text-primary"
          />
        </View>
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="min-w-0 flex-1 text-sm font-bold text-foreground">{item.title}</Text>
          <View className={`shrink-0 rounded-full px-2.5 py-0.5 ${tone[0]}`}>
            <Text className={`text-xs font-semibold ${tone[1]}`}>{getNotificationTag(item)}</Text>
          </View>
        </View>
        <Text numberOfLines={3} className="mt-1 text-xs leading-5 text-muted-foreground">
          {item.body}
        </Text>
        {side ? <Text className="mt-1 text-xs text-warning">{side}</Text> : null}
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs font-medium text-subtle">
            {formatNotificationDate(item.createdAt)}
          </Text>
          {getSafeActionPath(item.actionPath) ? (
            <Text className="text-xs font-semibold text-primary">Xem chi tiết →</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
