// Web ListingItemCard.
import { Image, Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import {
  canDuplicateListing,
  canEditListing,
  formatListingAmount,
  formatListingDate,
  listingCategoryLabel,
} from '@/lib/listing-manage';
import { listingImage } from '@/services/listingApi';
import type { MyListingSummary } from '@/services/myListingApi';

import StatusBadge from './StatusBadge';
import StatusChangeButton from './StatusChangeButton';

export default function MyListingCard({
  item,
  onView,
  onEdit,
  onDuplicate,
  onChanged,
  onOpenMembership,
}: {
  item: MyListingSummary;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onChanged: () => void;
  onOpenMembership: (addon?: boolean) => void;
}) {
  const hasReason = item.status === 'REJECTED' || item.status === 'VIOLATION';
  const dates = [
    ['Đăng', item.createdAt],
    item.publishedAt ? ['Duyệt ngày', item.publishedAt] : ['Gửi duyệt', item.submittedAt],
    ['Hạn hiển thị', item.expiresAt],
  ].filter(([label, value]) => label === 'Đăng' || value);
  return (
    <View className="mb-2 gap-1.5 rounded-2xl border border-border bg-surface p-2.5">
      <View className="flex-row gap-2.5">
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel={`Xem tin đăng ${item.title}`}
          className="h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-muted">
          {item.coverImageUrl ? (
            <Image
              source={{ uri: listingImage(item.coverImageUrl) }}
              resizeMode="cover"
              className="h-full w-full"
            />
          ) : (
            <Icon name="business-outline" size={32} className="text-subtle" />
          )}
        </Pressable>
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <StatusBadge status={item.status} />
            <Text className="shrink text-xs text-muted-foreground">
              {listingCategoryLabel(item.category)}
              {item.mediaCount ? ` · ${item.mediaCount} ảnh` : ''}
            </Text>
          </View>
          {item.branchName ? (
            <Text className="text-xs font-semibold text-primary">{item.branchName}</Text>
          ) : null}
          <Text numberOfLines={2} onPress={onView} className="text-sm font-bold text-foreground">
            {item.title}
          </Text>
          <Text numberOfLines={2} className="text-xs text-muted-foreground">
            {item.fullAddress || 'Chưa có thông tin địa chỉ'}
          </Text>
          <Text className="text-sm font-bold text-primary">
            {formatListingAmount(item.priceAmount)}
            <Text className="text-xs font-normal text-muted-foreground">
              /{item.priceUnit === 'M2_MONTH' ? 'm²/tháng' : 'tháng'}
            </Text>
            <Text className="text-xs font-semibold text-foreground"> · {item.areaM2} m²</Text>
            {item.availableFrom ? (
              <Text className="text-xs font-normal text-muted-foreground">
                {' '}
                · Vào ở từ: {formatListingDate(item.availableFrom)}
              </Text>
            ) : null}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-x-3">
        {dates.map(([label, value]) => (
          <Text key={label} className="text-xs text-muted-foreground">
            {label}: {formatListingDate(value)}
          </Text>
        ))}
      </View>
      {item.statusReason && hasReason ? (
        <Text className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
          <Text className="font-bold">
            {item.status === 'VIOLATION' ? 'Lý do khóa tin: ' : 'Lý do từ chối: '}
          </Text>
          {item.statusReason}
        </Text>
      ) : null}
      <View className="flex-row gap-1.5 border-t border-border pt-1.5">
        <ActionButton
          label="Xem"
          icon="eye-outline"
          variant="secondary"
          hint={`Xem tin đăng ${item.title}`}
          compact
          onClick={onView}
        />
        {canEditListing(item.status, item.category) ? (
          <ActionButton
            label="Sửa"
            icon="create-outline"
            variant="secondary"
            hint={`Sửa tin đăng ${item.title}`}
            compact
            onClick={onEdit}
          />
        ) : null}
        {canDuplicateListing(item.status, item.category) ? (
          <ActionButton
            label="Nhân bản"
            icon="copy-outline"
            variant="secondary"
            hint={`Nhân bản tin đăng ${item.title}`}
            compact
            onClick={onDuplicate}
          />
        ) : null}
        <StatusChangeButton
          listing={item}
          onChanged={onChanged}
          onOpenMembership={onOpenMembership}
        />
      </View>
    </View>
  );
}
