import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@/components/Icon';
import { useDialog } from '@/components/AppDialog';
import { apiError } from '@/lib/api-error';
import { LISTING_CATEGORIES } from '@/lib/listing-format';
import { getFavoriteIds, toggleFavorite } from '@/services/favoriteApi';
import type { ListingSummary } from '@/services/listingApi';
import ListingCard from './ListingCard';

function Skeleton() {
  return (
    <ScrollView
      horizontal
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      className="-mr-5 mt-4"
      accessibilityLabel="Đang tải tin đăng">
      {[0, 1].map((key) => (
        <View
          key={key}
          className="mr-4 w-72 animate-pulse overflow-hidden rounded-3xl border border-border bg-surface">
          <View className="h-40 bg-muted" />
          <View className="gap-3 p-4">
            <View className="h-4 w-3/4 rounded-full bg-muted" />
            <View className="h-4 w-1/2 rounded-full bg-muted" />
            <View className="h-3 w-2/3 rounded-full bg-muted" />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export default function FeaturedListings({
  areaLabel,
  wholeCity,
  category,
  onChangeCategory,
  listings,
  loading,
  error,
  onRetry,
  onViewAll,
  onOpenListing,
}: {
  areaLabel: string;
  wholeCity: boolean;
  category?: string;
  onChangeCategory: (value?: string) => void;
  listings: ListingSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewAll: () => void;
  onOpenListing?: (id: string) => void;
}) {
  const showDialog = useDialog();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());

  useEffect(() => {
    getFavoriteIds()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => undefined); // Hearts stay empty; a toggle still reports the server state.
  }, []);

  const setFavorite = useCallback((id: string, value: boolean) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      if (pending.current.has(id)) return;
      pending.current.add(id);
      const before = favoriteIds.has(id);
      setFavorite(id, !before); // optimistic
      try {
        setFavorite(id, await toggleFavorite(id));
      } catch (cause) {
        setFavorite(id, before);
        showDialog('Chưa cập nhật được yêu thích', apiError(cause));
      } finally {
        pending.current.delete(id);
      }
    },
    [favoriteIds, setFavorite, showDialog]
  );

  return (
    <View className="mt-7 px-5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-primary">
        Gợi ý cho bạn
      </Text>
      <Text className="mt-1 text-xl font-bold text-foreground">Nhà cho thuê quanh bạn</Text>
      <Text className="mt-1 text-sm leading-5 text-muted-foreground">
        {`Tin mới nhất tại ${areaLabel}${wholeCity ? ' (toàn tỉnh/thành)' : ''}, xác thực On-chain và thẩm định bởi AI.`}
      </Text>
      <Pressable
        onPress={onViewAll}
        accessibilityRole="button"
        className="min-h-11 flex-row items-center gap-1.5 self-start">
        <Text className="text-sm font-semibold text-primary">Xem tất cả tin đăng</Text>
        <Ionicons name="arrow-forward" size={16} className="text-primary" />
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mt-1"
        contentContainerStyle={{ paddingHorizontal: 20 }}>
        {LISTING_CATEGORIES.map((item) => {
          const active = category === item.value;
          return (
            <Pressable
              key={item.label}
              onPress={() => onChangeCategory(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`mr-2 min-h-10 justify-center rounded-full px-4 ${active ? 'bg-inverse' : 'border border-border bg-surface'}`}>
              <Text
                className={`text-sm font-semibold ${active ? 'text-on-inverse' : 'text-secondary'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <View className="mt-4 rounded-2xl bg-danger-soft p-4" accessibilityRole="alert">
          <Text className="text-sm font-semibold text-danger">Không thể tải tin đăng</Text>
          <Text className="mt-1 text-sm text-danger">
            Không thể tải tin đăng quanh bạn. Vui lòng thử lại.
          </Text>
          <Pressable onPress={onRetry} className="mt-3 min-h-10 justify-center self-start">
            <Text className="text-sm font-bold text-danger">Thử lại</Text>
          </Pressable>
        </View>
      ) : listings.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mr-5 mt-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              favorite={favoriteIds.has(listing.id)}
              onPress={() => onOpenListing?.(listing.id)}
              onToggleFavorite={() => void toggle(listing.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View className="mt-4 items-center rounded-2xl border border-dashed border-border-strong bg-surface p-8">
          <Ionicons name="home-outline" size={36} className="text-subtle" />
          <Text className="mt-3 text-center text-sm font-semibold text-secondary">
            Chưa có tin mới tại {areaLabel}
          </Text>
          <Text className="mt-1 text-center text-xs text-muted-foreground">
            Thử đổi loại nhà hoặc chọn phạm vi tỉnh/phường khác ở mục Khu vực của bạn.
          </Text>
        </View>
      )}
    </View>
  );
}
