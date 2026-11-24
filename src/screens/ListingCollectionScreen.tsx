import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ListingCard from '@/components/ListingCard';
import { Button, ErrorNotice, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { useFavoriteListings } from '@/lib/use-favorite-listings';
import { getPublicListingsPage, type ListingSummary } from '@/services/listingApi';
import SavedListingsScreen from '@/screens/SavedListingsScreen';

// Favorites and history have their own richer screen; this one only serves "browse".
export default function ListingCollectionScreen({
  mode,
  filters,
  onBack,
  onOpenListing,
  onExplore,
}: {
  mode: 'favorites' | 'history' | 'browse';
  filters: Record<string, string | number>;
  onBack: () => void;
  onOpenListing: (id: string) => void;
  onExplore: () => void;
}) {
  return mode === 'browse' ? (
    <BrowseScreen filters={filters} onBack={onBack} onOpenListing={onOpenListing} />
  ) : (
    <SavedListingsScreen
      mode={mode}
      onBack={onBack}
      onOpenListing={onOpenListing}
      onExplore={onExplore}
    />
  );
}

function BrowseScreen({
  filters,
  onBack,
  onOpenListing,
}: {
  filters: Record<string, string | number>;
  onBack: () => void;
  onOpenListing: (id: string) => void;
}) {
  const { favoriteIds, toggle } = useFavoriteListings();
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
        const data = await getPublicListingsPage({ ...filters, page: nextPage, size: 12 });
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
    [filters]
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Tìm nhà cho thuê" onBack={onBack} />
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} />}>
        <ErrorNotice message={error} />
        {error ? <Button label="Thử lại" onPress={() => load()} disabled={loading} /> : null}
        {rows.map((row) => (
          <ListingCard
            key={row.id}
            fullWidth
            listing={row}
            favorite={favoriteIds.has(row.id)}
            onPress={() => onOpenListing(row.id)}
            onToggleFavorite={() => void toggle(row.id)}
          />
        ))}
        {loading ? (
          <ActivityIndicator className="my-6 text-primary" />
        ) : !rows.length && !error ? (
          <Text className="py-10 text-center text-muted-foreground">
            Chưa có tin phù hợp với bộ lọc.
          </Text>
        ) : null}
        {hasMore ? (
          <Button label="Tải thêm" onPress={() => load(page + 1)} disabled={loading} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
