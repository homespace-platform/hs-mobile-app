import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@/components/Icon';
import Avatar from '@/components/Avatar';
import { categoryLabel, formatListingPrice, formatTimeAgo } from '@/lib/listing-format';
import { listingImage, type ListingSummary } from '@/services/listingApi';

function Spec({
  icon,
  text,
}: {
  icon: 'resize-outline' | 'bed-outline' | 'water-outline';
  text: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={14} className="text-muted-foreground" />
      <Text className="text-xs text-muted-foreground">{text}</Text>
    </View>
  );
}

export default function ListingCard({
  listing,
  favorite,
  onPress,
  onToggleFavorite,
  fullWidth = false,
}: {
  listing: ListingSummary;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  /** Vertical lists: fill the row instead of the fixed carousel width. */
  fullWidth?: boolean;
}) {
  const cover = listing.coverImageUrl ?? listing.imageUrls?.[0];
  const photoCount = listing.imageUrls?.length || (listing.coverImageUrl ? 1 : 0);
  const ownerName = listing.ownerName || 'Chủ nhà';

  return (
    <View
      className={`${fullWidth ? 'mb-4 w-full' : 'mr-4 w-72'} overflow-hidden rounded-3xl border border-border bg-surface shadow-sm`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Mở tin đăng: ${listing.title}`}>
        <View className="h-40 w-full bg-muted">
          <Image source={{ uri: listingImage(cover) }} className="h-full w-full" />
          <View className="absolute left-2.5 top-2.5 rounded-lg bg-overlay/60 px-2.5 py-1">
            <Text className="text-xs font-semibold text-on-brand">
              {categoryLabel(listing.category)}
            </Text>
          </View>
          <View className="absolute bottom-2.5 right-2.5 flex-row items-center gap-1.5">
            {listing.hasVideo ? (
              <View className="flex-row items-center gap-1 rounded-md bg-danger px-2 py-0.5">
                <Ionicons name="videocam" size={12} className="text-on-brand" />
                <Text className="text-xs font-bold text-on-brand">Video</Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1 rounded-md bg-overlay/60 px-2 py-0.5">
              <Ionicons name="camera-outline" size={12} className="text-on-brand" />
              <Text className="text-xs font-semibold text-on-brand">{photoCount}</Text>
            </View>
          </View>
        </View>
        <View className="px-4 pt-4">
          <Text className="min-h-10 text-base font-bold text-foreground" numberOfLines={2}>
            {listing.title}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-baseline gap-x-2">
            <Text className="text-base font-bold text-primary">
              {formatListingPrice(listing.priceAmount, listing.priceUnit)}
            </Text>
            {listing.negotiable ? (
              <Text className="text-xs text-muted-foreground">Thương lượng</Text>
            ) : null}
          </View>
          <View className="mt-2 flex-row items-start">
            <Ionicons name="location-outline" size={14} className="mt-0.5 text-muted-foreground" />
            <Text className="ml-1 min-h-8 flex-1 text-xs text-muted-foreground" numberOfLines={2}>
              {listing.fullAddress || listing.provinceName || 'Đang cập nhật địa chỉ'}
            </Text>
          </View>
          <View className="mt-2 flex-row items-center gap-3">
            <Spec icon="resize-outline" text={`${listing.areaM2 || '—'} m²`} />
            {listing.category !== 'ROOM' ? (
              <Spec icon="bed-outline" text={`${listing.bedroomCount ?? '—'} PN`} />
            ) : null}
            <Spec icon="water-outline" text={`${listing.bathroomCount ?? '—'} WC`} />
          </View>
        </View>
        <View className="mx-4 mb-4 mt-3 flex-row items-center border-t border-border pt-3">
          <Avatar uri={listing.ownerAvatarUrl} name={ownerName} size={28} />
          <View className="ml-2 flex-1">
            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
              {ownerName}
            </Text>
            <Text className="text-xs font-semibold text-primary">
              {formatTimeAgo(listing.updatedAt || listing.publishedAt)}
            </Text>
          </View>
          <View
            className="flex-row items-center gap-1"
            accessibilityLabel={`${listing.viewCount ?? 0} lượt xem`}>
            <Ionicons name="eye-outline" size={14} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{listing.viewCount ?? 0}</Text>
          </View>
        </View>
      </Pressable>
      {/* Sibling of the card Pressable so tapping the heart never opens the listing. */}
      <Pressable
        onPress={onToggleFavorite}
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Bỏ lưu tin' : 'Lưu tin này'}
        accessibilityState={{ selected: favorite }}
        hitSlop={6}
        className="absolute right-2.5 top-2.5 h-9 w-9 items-center justify-center rounded-full bg-overlay/60">
        <Ionicons
          name={favorite ? 'heart' : 'heart-outline'}
          size={19}
          className={favorite ? 'text-danger' : 'text-on-brand'}
        />
      </Pressable>
    </View>
  );
}
