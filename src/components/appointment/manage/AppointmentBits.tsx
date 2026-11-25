// Pieces shared by the list card and the detail overlay.
import { Image, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { getStatusMeta, TONE_CLASSES } from '@/lib/appointment';

export function StatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  const tone = TONE_CLASSES[meta.tone];
  return (
    <View
      className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${tone.fill} ${tone.border}`}>
      <Icon name={meta.icon} size={13} className={tone.text} />
      <Text className={`text-xs font-bold ${tone.text}`}>{meta.label}</Text>
    </View>
  );
}

/** Web also accepts "/relative" images; only http(s) loads on mobile, otherwise the placeholder. */
export function ListingThumb({ url, large }: { url: string | null; large?: boolean }) {
  const size = large ? 'h-16 w-16' : 'h-14 w-14';
  return url && /^https?:\/\//i.test(url.trim()) ? (
    <Image
      source={{ uri: url.trim() }}
      accessibilityLabel="Ảnh tin đăng"
      className={`${size} rounded-xl bg-muted`}
    />
  ) : (
    <View className={`${size} items-center justify-center rounded-xl bg-muted`}>
      <Icon name="business-outline" size={large ? 24 : 20} className="text-muted-foreground" />
    </View>
  );
}
