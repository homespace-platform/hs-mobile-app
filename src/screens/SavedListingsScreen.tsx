import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialog } from '@/components/AppDialog';
import { Pager, CategoryTabs, SearchSortBar } from '@/components/collection/SavedListingsControls';
import ListingCard from '@/components/ListingCard';
import Ionicons from '@/components/Icon';
import { Button, ErrorNotice, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { useFavoriteListings } from '@/lib/use-favorite-listings';
import {
  categoryCounts,
  filterSavedListings,
  pageWindow,
  SAVED_PAGE_SIZE,
  type SavedSort,
} from '@/lib/saved-listings';
import { clearHistory, getFavorites, getHistory, removeFavorite } from '@/services/favoriteApi';
import type { ListingSummary } from '@/services/listingApi';

// Copy and limits mirror web app/favorites and app/history.
const CONFIG = {
  favorites: {
    title: 'Danh sách yêu thích',
    description: 'Quản lý các không gian sống bạn đang quan tâm.',
    badge: (n: number) => `${n} tin`,
    size: 50,
    clearLabel: 'Xóa tất cả',
    clearConfirm: 'Bạn có chắc chắn muốn xóa tất cả tin đăng yêu thích?',
    clearError: 'Có lỗi xảy ra khi xóa danh sách yêu thích.',
    placeholder: 'Tìm theo tên, quận...',
    sortRecent: 'Mới lưu gần đây',
    unit: 'tin đăng',
    pageNote: '',
    loadError: 'Không thể tải danh sách tin yêu thích.',
    loading: 'Đang tải danh sách yêu thích...',
    emptyTitle: 'Chưa có tin đăng yêu thích nào',
    emptyText:
      'Hãy nhấn vào biểu tượng trái tim ở góc các căn hộ bạn yêu thích để lưu và xem lại bất cứ lúc nào.',
    explore: 'Khám phá tin đăng mới',
    emptyIcon: 'heart-outline',
  },
  history: {
    title: 'Lịch sử xem tin',
    description:
      'Tự động ghi nhận tối đa 40 tin đăng bạn đã xem gần đây nhất, giúp bạn dễ dàng so sánh và tìm lại căn nhà phù hợp.',
    badge: (n: number) => `${n} / 40 tin`,
    size: 40,
    clearLabel: 'Xóa lịch sử',
    clearConfirm: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem tin?',
    clearError: 'Có lỗi xảy ra khi xóa lịch sử.',
    placeholder: 'Tìm trong lịch sử xem...',
    sortRecent: 'Mới xem gần đây',
    unit: 'tin đã xem',
    pageNote: ` (${SAVED_PAGE_SIZE} tin/trang)`,
    loadError: 'Không thể tải lịch sử xem tin.',
    loading: 'Đang tải lịch sử xem tin...',
    emptyTitle: 'Chưa có lịch sử xem tin nào',
    emptyText:
      'Các tin đăng cho thuê bạn mở xem sẽ được tự động lưu vào đây để bạn dễ dàng theo dõi lại.',
    explore: 'Khám phá tin đăng ngay',
    emptyIcon: 'time-outline',
  },
} as const;

function Skeleton({ label }: { label: string }) {
  return (
    <View className="px-5 pt-6" accessibilityLabel={label}>
      {[0, 1].map((key) => (
        <View
          key={key}
          className="mb-4 animate-pulse overflow-hidden rounded-3xl border border-border bg-surface">
          <View className="h-40 bg-muted" />
          <View className="gap-3 p-4">
            <View className="h-4 w-3/4 rounded-full bg-muted" />
            <View className="h-4 w-1/2 rounded-full bg-muted" />
            <View className="h-3 w-2/3 rounded-full bg-muted" />
          </View>
        </View>
      ))}
      <Text className="text-center text-sm text-muted-foreground">{label}</Text>
    </View>
  );
}

export default function SavedListingsScreen({
  mode,
  onBack,
  onOpenListing,
  onExplore,
}: {
  mode: 'favorites' | 'history';
  onBack: () => void;
  onOpenListing: (id: string) => void;
  onExplore: () => void;
}) {
  const cfg = CONFIG[mode];
  const showDialog = useDialog();
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef(0);
  const [rows, setRows] = useState<ListingSummary[]>([]);
  const { favoriteIds, setFavoriteIds, loadIds, toggle } = useFavoriteListings({
    autoLoad: false,
    onToggled: (id, saved) => {
      if (mode === 'favorites' && !saved) setRows((current) => current.filter((r) => r.id !== id));
    },
  });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SavedSort>('recent');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Same as web: one request for the whole list, then filter/sort/page on the client.
      const data =
        mode === 'favorites' ? await getFavorites(1, cfg.size) : await getHistory(1, cfg.size);
      const items = data.result ?? [];
      setRows(items);
      if (mode === 'favorites') setFavoriteIds(new Set(items.map((item) => item.id)));
      else void loadIds();
    } catch (cause) {
      setError(`${cfg.loadError} ${apiError(cause)}`);
    } finally {
      setLoading(false);
    }
  }, [mode, cfg.size, cfg.loadError, setFavoriteIds, loadIds]);
  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => categoryCounts(rows), [rows]);
  const filtered = useMemo(
    () => filterSavedListings(rows, { category, query, sort }),
    [rows, category, query, sort]
  );
  const total = filtered.length;
  const view = pageWindow(total, page);
  const items = filtered.slice(view.start, view.end);

  const changePage = (next: number) => {
    setPage(next);
    scrollRef.current?.scrollTo({ y: Math.max(listY.current - 8, 0), animated: true });
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      // Web removes favorites one by one (DELETE /favorites/{id}); history has a single clear.
      if (mode === 'favorites') await Promise.all(rows.map((row) => removeFavorite(row.id)));
      else await clearHistory();
      setRows([]);
      if (mode === 'favorites') setFavoriteIds(new Set());
    } catch (cause) {
      showDialog('Chưa xóa được', `${cfg.clearError} ${apiError(cause)}`);
      await load(); // Some favorites may already be gone; resync with the server.
    } finally {
      setClearing(false);
    }
  };
  const confirmClear = () =>
    showDialog(cfg.clearLabel, cfg.clearConfirm, [
      { text: 'Hủy', style: 'cancel' },
      { text: cfg.clearLabel, style: 'destructive', onPress: () => void clearAll() },
    ]);

  const sortOptions: { value: SavedSort; label: string }[] = [
    { value: 'recent', label: cfg.sortRecent },
    { value: 'price_asc', label: 'Giá: Thấp đến Cao' },
    { value: 'price_desc', label: 'Giá: Cao đến Thấp' },
    { value: 'area_desc', label: 'Diện tích: Lớn nhất' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title={cfg.title} onBack={onBack} />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl refreshing={loading && rows.length > 0} onRefresh={() => void load()} />
        }>
        <View className="border-b border-border px-5 pb-5 pt-5">
          <View className="flex-row items-center gap-2">
            <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <Text accessibilityRole="header" className="text-2xl font-extrabold text-foreground">
                {cfg.title}
              </Text>
              <Text className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
                {cfg.badge(rows.length)}
              </Text>
            </View>
            {rows.length > 0 ? (
              <Pressable
                onPress={confirmClear}
                disabled={clearing}
                accessibilityRole="button"
                accessibilityLabel={cfg.clearLabel}
                accessibilityState={{ disabled: clearing, busy: clearing }}
                className={`h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface ${clearing ? 'opacity-50' : 'active:opacity-70'}`}>
                <Ionicons name="trash-outline" size={20} className="text-danger" />
              </Pressable>
            ) : null}
          </View>
          <Text className="mt-2 text-sm leading-5 text-muted-foreground">{cfg.description}</Text>
        </View>

        {error ? (
          <View className="px-5">
            <ErrorNotice message={error} />
            <Button label="Thử lại" onPress={() => void load()} disabled={loading} />
          </View>
        ) : null}

        {rows.length > 0 ? (
          <>
            <CategoryTabs
              counts={counts}
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
            />
            <SearchSortBar
              query={query}
              onQuery={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder={cfg.placeholder}
              sortOptions={sortOptions}
              sort={sort}
              onSort={(value) => {
                setSort(value);
                setPage(1);
              }}
            />
            <View
              onLayout={(event) => {
                listY.current = event.nativeEvent.layout.y;
              }}
              className="mx-5 mt-4 flex-row items-start justify-between gap-3">
              <Text className="flex-1 text-xs text-muted-foreground">
                {'Hiển thị '}
                <Text className="font-semibold text-foreground">
                  {total > 0 ? `${view.start + 1} - ${view.end}` : '0'}
                </Text>
                {' trên tổng số '}
                <Text className="font-semibold text-foreground">{total}</Text>
                {` ${cfg.unit}`}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Trang {view.page} / {view.totalPages}
                {cfg.pageNote}
              </Text>
            </View>
          </>
        ) : null}

        {loading && rows.length === 0 ? (
          <Skeleton label={cfg.loading} />
        ) : !error && total === 0 ? (
          <View className="mx-5 mt-6 items-center rounded-3xl border border-border bg-surface p-8">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-danger-soft">
              <Ionicons name={cfg.emptyIcon} size={40} className="text-danger" />
            </View>
            <Text className="mt-5 text-center text-lg font-bold text-foreground">
              {rows.length === 0 ? cfg.emptyTitle : 'Không tìm thấy tin đăng phù hợp'}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
              {rows.length === 0
                ? cfg.emptyText
                : 'Thử thay đổi bộ lọc thể loại hoặc tìm kiếm với từ khóa khác.'}
            </Text>
            <View className="self-stretch">
              <Button label={cfg.explore} onPress={onExplore} />
            </View>
          </View>
        ) : (
          <View className="mt-4 px-5">
            {items.map((listing) => (
              <ListingCard
                key={listing.id}
                fullWidth
                listing={listing}
                favorite={favoriteIds.has(listing.id)}
                onPress={() => onOpenListing(listing.id)}
                onToggleFavorite={() => void toggle(listing.id)}
              />
            ))}
            <Pager page={view.page} totalPages={view.totalPages} onChange={changePage} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
