import { Image, Text, View } from 'react-native';

import { formatVND } from '@/lib/appointment';

export default function ListingSummary({
  title,
  address,
  price,
  thumbnail,
}: {
  title: string;
  address?: string;
  price?: number;
  thumbnail?: string | null;
}) {
  // Web also accepts "/relative" paths; only http(s) loads on a phone.
  const uri = thumbnail?.trim();
  return (
    <View className="flex-row items-center gap-3.5 rounded-2xl border border-border bg-surface p-3.5">
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {uri && /^https?:\/\//.test(uri) ? (
          <Image
            source={{ uri }}
            accessibilityLabel={title || 'Ảnh tin đăng'}
            resizeMode="cover"
            className="h-full w-full"
          />
        ) : (
          <Text className="text-xs text-muted-foreground">Ảnh</Text>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-sm font-bold text-foreground">
          {title}
        </Text>
        {address ? (
          <Text numberOfLines={1} className="mt-0.5 text-xs text-muted-foreground">
            {address}
          </Text>
        ) : null}
        {price ? (
          <Text className="mt-1 text-sm font-bold text-primary">{formatVND(price)} / tháng</Text>
        ) : null}
      </View>
    </View>
  );
}
