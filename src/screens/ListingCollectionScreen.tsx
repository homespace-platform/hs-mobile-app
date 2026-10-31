import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNotice, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { getFavorites } from '@/services/favoriteApi';
import { getPublicListingsPage, listingImage, type ListingSummary } from '@/services/listingApi';
import { money } from '@/services/managementApi';

export default function ListingCollectionScreen({
  favorites,
  filters,
  onBack,
  onOpenListing,
}: {
  favorites: boolean;
  filters: Record<string, string | number>;
  onBack: () => void;
  onOpenListing: (id: string) => void;
}) {
  const [rows, setRows] = useState<ListingSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        const data = favorites
          ? await getFavorites(nextPage)
          : await getPublicListingsPage({ ...filters, page: nextPage, size: 12 });
        setRows((current) =>
          nextPage === 1
            ? data.result
            : [
                ...current.filter((row) => !data.result.some((next) => next.id === row.id)),
                ...data.result,
              ]
        );
        setPage(nextPage);
        setHasMore(data.hasMore);
      } catch (e) {
        setError(apiError(e));
      } finally {
        setLoading(false);
      }
    },
    [favorites, filters]
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title={favorites ? 'Tin đã yêu thích' : 'Tìm nhà cho thuê'} onBack={onBack} />
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} />}>
        <ErrorNotice message={error} />
        {error ? <Button label="Thử lại" onPress={() => load()} disabled={loading} /> : null}
        {rows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => onOpenListing(row.id)}
            accessibilityRole="button"
            className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
            <Image
              source={{ uri: listingImage(row.coverImageUrl) }}
              className="h-44 w-full bg-muted"
            />
            <View className="p-4">
              <Text className="text-base font-bold text-foreground">{row.title}</Text>
              <Text className="mt-2 font-bold text-primary">{money(row.priceAmount)}/tháng</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {row.fullAddress || row.provinceName}
              </Text>
            </View>
          </Pressable>
        ))}
        {loading ? (
          <ActivityIndicator className="my-6 text-primary" />
        ) : !rows.length && !error ? (
          <Text className="py-10 text-center text-muted-foreground">
            {favorites ? 'Bạn chưa lưu tin đăng nào.' : 'Chưa có tin phù hợp với bộ lọc.'}
          </Text>
        ) : null}
        {hasMore ? (
          <Button label="Tải thêm" onPress={() => load(page + 1)} disabled={loading} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
