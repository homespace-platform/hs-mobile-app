import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import TabHeader from '@/components/TabHeader';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import ListingCard from '@/components/ListingCard';
import RentFilterPanel, { Chip } from '@/components/RentFilterPanel';
import SortDropdown from '@/components/SortDropdown';
import { useDialog } from '@/components/AppDialog';
import { ErrorNotice } from '@/components/Screen';
import { useFavoriteListings } from '@/lib/use-favorite-listings';
import { apiError } from '@/lib/api-error';
import {
  DEFAULT_RENT_FILTER,
  RENT_CATEGORIES,
  SORT_OPTIONS,
  activeFilterCount,
  changeCategory,
  rentSeedFromBrowse,
  sanitizeRentFilter,
  toQueryParams,
  type RentFilter,
} from '@/lib/rent-filter';
import { getPublicListingsPage, type ListingSummary } from '@/services/listingApi';
import provinces from '@/data/provinces.json';
import wardsCatalog from '@/data/wards.json';

const PAGE_SIZE = 12;
const DEFAULT_CITY = provinces.find((item) => item.name.includes('Hồ Chí Minh')) ?? provinces[0];
const WARDS = Object.values(wardsCatalog) as {
  code: string;
  parent_code: string;
  name_with_type: string;
}[];

export default function SearchScreen({
  onSelectTab,
  onOpenListing,
  initialFilters,
}: {
  onSelectTab: (tab: MainTab) => void;
  onOpenListing: (id: string) => void;
  /** Home "browse" entry points: { cityId, wardId, category (API enum), keyword }. Read once on mount. */
  initialFilters?: Record<string, string | number>;
}) {
  const showDialog = useDialog();
  const seed = useMemo(() => rentSeedFromBrowse(initialFilters ?? {}), [initialFilters]);
  const [city, setCity] = useState(
    () => provinces.find((item) => item.code === seed.cityId) ?? DEFAULT_CITY
  );
  const [wardId, setWardId] = useState(() =>
    WARDS.some((ward) => ward.code === seed.wardId && ward.parent_code === city.code)
      ? seed.wardId
      : ''
  );
  // `filter` drives the API; `draft` is what the advanced panel edits until "Áp dụng bộ lọc".
  const [filter, setFilter] = useState<RentFilter>(seed.filter);
  const [draft, setDraft] = useState<RentFilter>(seed.filter);
  const [keyword, setKeyword] = useState(seed.filter.searchQuery);
  const [panelOpen, setPanelOpen] = useState(false);
  const { favoriteIds, toggle: toggleFavoriteListing } = useFavoriteListings();
  const [rows, setRows] = useState<ListingSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  const selectedWard = WARDS.find((ward) => ward.code === wardId);

  const load = useCallback(
    async (nextPage = 1) => {
      const ticket = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicListingsPage(
          toQueryParams(filter, { page: nextPage, size: PAGE_SIZE, cityId: city.code, wardId })
        );
        if (ticket !== requestId.current) return;
        setRows((current) =>
          nextPage === 1
            ? data.result
            : [
                ...current.filter((row) => !data.result.some((next) => next.id === row.id)),
                ...data.result,
              ]
        );
        setPage(nextPage);
        setTotal(data.totalElements);
        setHasMore(data.hasMore);
      } catch (cause) {
        if (ticket === requestId.current) setError(apiError(cause));
      } finally {
        if (ticket === requestId.current) setLoading(false);
      }
    },
    [filter, city.code, wardId]
  );
  useEffect(() => {
    setRows([]);
    setHasMore(false);
    void load();
    return invalidateRequests;
  }, [load, invalidateRequests]);

  // Chips, search, sort and video apply immediately (web); the panel applies on demand.
  const applyNow = (update: (current: RentFilter) => RentFilter) => {
    setFilter(update);
    setDraft(update);
  };
  const submitSearch = (text: string) => {
    const searchQuery = sanitizeRentFilter({ searchQuery: text }).searchQuery;
    setKeyword(searchQuery);
    applyNow((current) => ({ ...current, searchQuery }));
  };
  const openPanel = () => {
    setDraft(filter);
    setPanelOpen(true);
  };
  const closePanel = () => {
    setDraft(filter); // closing the sheet discards unapplied edits
    setPanelOpen(false);
  };
  const applyDraft = () => {
    if (draft.minPrice > draft.maxPrice) {
      showDialog('Khoảng giá chưa hợp lệ', 'Giá tối thiểu cần nhỏ hơn giá tối đa.');
      return;
    }
    setFilter(draft);
    setPanelOpen(false);
  };
  const reset = () => {
    setKeyword('');
    setFilter(DEFAULT_RENT_FILTER);
    setDraft(DEFAULT_RENT_FILTER);
  };
  const filterCount = activeFilterCount(draft);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <TabHeader>
        <View className="mt-2 flex-row items-center">
          <Text
            accessibilityRole="header"
            className="mr-2 flex-1 text-xl font-bold text-foreground">
            Danh sách nhà cho thuê
          </Text>
          <View className="rounded-full bg-primary-soft px-3 py-1">
            <Text className="text-xs font-bold text-primary">{total} tin đăng</Text>
          </View>
        </View>
        <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
          {selectedWard ? `${selectedWard.name_with_type}, ${city.name}` : city.name}
        </Text>
      </TabHeader>
      <ProfileCompletionBanner />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="px-5 pb-10 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View className="rounded-2xl border border-border bg-surface p-4">
          <View className="min-h-12 flex-row items-center rounded-xl border border-border bg-muted pl-3 pr-1">
            <Icon name="search-outline" size={18} className="text-subtle" />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={() => submitSearch(keyword)}
              returnKeyType="search"
              placeholder="Tìm theo tên, địa chỉ hoặc từ khóa tin đăng..."
              accessibilityLabel="Tìm theo tên, địa chỉ hoặc từ khóa"
              className="min-h-11 flex-1 px-2 text-foreground placeholder:text-subtle"
            />
            {keyword ? (
              <Pressable
                onPress={() => submitSearch('')}
                accessibilityRole="button"
                accessibilityLabel="Xóa từ khóa"
                className="min-h-10 min-w-10 items-center justify-center">
                <Icon name="close-circle" size={18} className="text-subtle" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => submitSearch(keyword)}
              accessibilityRole="button"
              className="min-h-10 justify-center rounded-lg bg-brand px-3">
              <Text className="text-sm font-bold text-on-brand">Tìm kiếm</Text>
            </Pressable>
          </View>

          <View className="mt-3 flex-row flex-wrap">
            {RENT_CATEGORIES.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={filter.category === item.id}
                onPress={() => applyNow((current) => changeCategory(current, item.id))}
              />
            ))}
          </View>

          <View className="mt-1 flex-row items-center gap-2">
            <SortDropdown
              options={SORT_OPTIONS}
              value={filter.sortBy}
              onChange={(id) =>
                applyNow((current) => ({ ...current, sortBy: id as RentFilter['sortBy'] }))
              }
            />
            <Pressable
              onPress={openPanel}
              accessibilityRole="button"
              accessibilityHint="Mở bộ lọc nâng cao"
              className="min-h-11 flex-row items-center rounded-xl border border-border bg-surface px-3">
              <Icon name="options-outline" size={18} className="text-primary" />
              <Text className="ml-1.5 font-bold text-primary">Bộ lọc</Text>
              {filterCount > 0 ? (
                <View className="ml-2 min-w-5 items-center rounded-full bg-brand px-1.5">
                  <Text className="text-xs font-extrabold text-on-brand">{filterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View className="mt-2 flex-row items-center">
            <Switch
              value={filter.hasVideoOnly}
              onValueChange={(hasVideoOnly) =>
                applyNow((current) => ({ ...current, hasVideoOnly }))
              }
              accessibilityLabel="Tin có video"
            />
            <Text className="ml-2 text-sm font-medium text-muted-foreground">Tin có video</Text>
          </View>
        </View>

        <RentFilterPanel
          visible={panelOpen}
          onClose={closePanel}
          draft={draft}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          city={city}
          wardId={wardId}
          onLocationChange={(nextCity, nextWardId) => {
            setCity(nextCity);
            setWardId(nextWardId);
          }}
          onReset={reset}
          onApply={applyDraft}
        />

        <ErrorNotice message={error} />
        <View className="mt-4">
          {rows.map((row) => (
            <ListingCard
              key={row.id}
              fullWidth
              listing={row}
              favorite={favoriteIds.has(row.id)}
              onPress={() => onOpenListing(row.id)}
              onToggleFavorite={() => void toggleFavoriteListing(row.id)}
            />
          ))}
        </View>
        {loading ? (
          <ActivityIndicator className="my-8 text-primary" />
        ) : !rows.length && !error ? (
          <View className="items-center py-8">
            <Text className="font-bold text-foreground">Không tìm thấy nhà cho thuê phù hợp</Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Hãy thử điều chỉnh lại mức giá, diện tích hoặc chọn lại phường/xã.
            </Text>
            <Pressable
              onPress={reset}
              accessibilityRole="button"
              className="mt-4 min-h-11 justify-center rounded-xl bg-brand px-5">
              <Text className="font-bold text-on-brand">Xóa tất cả bộ lọc</Text>
            </Pressable>
          </View>
        ) : null}
        {error ? (
          <Pressable
            onPress={() => void load()}
            className="mt-3 min-h-11 items-center justify-center rounded-xl border border-border bg-surface">
            <Text className="font-semibold text-primary">Thử lại</Text>
          </Pressable>
        ) : null}
        {hasMore ? (
          <Pressable
            onPress={() => void load(page + 1)}
            disabled={loading}
            className="mt-4 min-h-12 items-center justify-center rounded-xl bg-brand">
            <Text className="font-bold text-on-brand">Tải thêm</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <BottomTabBar active="search" onSelect={onSelectTab} />
    </SafeAreaView>
  );
}
