import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import TabHeader from '@/components/TabHeader';
import { ErrorNotice } from '@/components/Screen';
import { matchesProvince } from '@/lib/location-search';
import { apiError } from '@/lib/api-error';
import { getPublicListingsPage, listingImage, type ListingSummary } from '@/services/listingApi';
import provinces from '@/data/provinces.json';
import wardsCatalog from '@/data/wards.json';

type Option = readonly [string, string];
type Filters = {
  category: string;
  priceMin: string;
  priceMax: string;
  areaRange: string;
  beds: string;
  baths: string;
  furnishingStatus: string;
  direction: string;
  balconyDirection: string;
  restroomType: string;
  kitchenType: string;
  accessType: string;
  legalStatus: string;
  sort: string;
  hasVideo: boolean;
  hasMezzanine: boolean;
  hasRooftop: boolean;
  hasGarage: boolean;
};

const DEFAULT_FILTERS: Filters = {
  category: '',
  priceMin: '',
  priceMax: '',
  areaRange: '',
  beds: '',
  baths: '',
  furnishingStatus: '',
  direction: '',
  balconyDirection: '',
  restroomType: '',
  kitchenType: '',
  accessType: '',
  legalStatus: '',
  sort: 'newest',
  hasVideo: false,
  hasMezzanine: false,
  hasRooftop: false,
  hasGarage: false,
};
const CATEGORIES: Option[] = [
  ['', 'Tất cả'],
  ['HOUSE', 'Nhà nguyên căn'],
  ['APARTMENT', 'Căn hộ'],
  ['ROOM', 'Phòng trọ'],
];
const AREAS: Option[] = [
  ['', 'Tất cả'],
  ['under_30', '< 30 m²'],
  ['30_50', '30–50 m²'],
  ['50_80', '50–80 m²'],
  ['80_100', '80–100 m²'],
  ['100_150', '100–150 m²'],
  ['150_200', '150–200 m²'],
  ['200_250', '200–250 m²'],
  ['over_250', '> 250 m²'],
];
const COUNTS: Option[] = [
  ['', 'Tất cả'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3+'],
];
const FURNISHING: Option[] = [
  ['', 'Tất cả'],
  ['UNFURNISHED', 'Bàn giao thô'],
  ['BASIC', 'Cơ bản'],
  ['FULLY_FURNISHED', 'Đầy đủ'],
];
const DIRECTIONS: Option[] = [
  ['', 'Tất cả'],
  ['EAST', 'Đông'],
  ['WEST', 'Tây'],
  ['SOUTH', 'Nam'],
  ['NORTH', 'Bắc'],
  ['SOUTH_EAST', 'Đông Nam'],
  ['NORTH_EAST', 'Đông Bắc'],
  ['SOUTH_WEST', 'Tây Nam'],
  ['NORTH_WEST', 'Tây Bắc'],
];
const RESTROOMS: Option[] = [
  ['', 'Tất cả'],
  ['PRIVATE', 'Riêng'],
  ['SHARED', 'Chung'],
];
const KITCHENS: Option[] = [
  ['', 'Tất cả'],
  ['PRIVATE', 'Riêng'],
  ['SHARED', 'Chung'],
  ['NONE', 'Không có'],
];
const ACCESS: Option[] = [
  ['', 'Tất cả'],
  ['PRIVATE', 'Riêng'],
  ['SHARED', 'Chung'],
];
const LEGAL: Option[] = [
  ['', 'Tất cả'],
  ['PINK_BOOK', 'Sổ hồng / đỏ'],
  ['CONTRACT', 'Hợp đồng mua bán'],
  ['PENDING', 'Chờ cấp sổ'],
];
const SORT: Option[] = [
  ['newest', 'Mới nhất'],
  ['price_asc', 'Giá tăng dần'],
  ['price_desc', 'Giá giảm dần'],
  ['area_desc', 'Diện tích giảm dần'],
];
const WARDS = Object.values(wardsCatalog) as {
  code: string;
  name_with_type: string;
  parent_code: string;
}[];

function FilterSection({
  label,
  summary,
  children,
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="border-b border-border">
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="min-h-14 flex-row items-center py-3">
        <View className="flex-1">
          <Text className="font-bold text-foreground">{label}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={19} className="text-subtle" />
      </Pressable>
      {expanded ? <View className="pb-4">{children}</View> : null}
    </View>
  );
}

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterSection label={label} summary={options.find(([key]) => key === value)?.[1] ?? 'Tất cả'}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {options.map(([key, title]) => (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === key }}
            className={`mr-2 min-h-11 justify-center rounded-full border px-4 ${value === key ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            <Text
              className={`text-sm font-semibold ${value === key ? 'text-primary' : 'text-secondary'}`}>
              {title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </FilterSection>
  );
}

function priceMillions(value: string) {
  const number = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(number) && number >= 0
    ? Math.round(number * 1_000_000)
    : undefined;
}

function queryParams(cityId: string, wardId: string, keyword: string, filters: Filters) {
  const params: Record<string, string | number | boolean> = { cityId, sort: filters.sort };
  if (wardId) params.wardId = wardId;
  if (keyword.trim()) params.keyword = keyword.trim();
  if (filters.category) params.category = filters.category;
  const priceMin = priceMillions(filters.priceMin),
    priceMax = priceMillions(filters.priceMax);
  if (priceMin) params.priceMin = priceMin;
  if (priceMax !== undefined) params.priceMax = priceMax;
  const [min, max] =
    filters.areaRange === 'under_30'
      ? [undefined, 30]
      : filters.areaRange === 'over_250'
        ? [250, undefined]
        : filters.areaRange
          ? filters.areaRange.split('_').map(Number)
          : [];
  if (min !== undefined) params.areaMin = min;
  if (max !== undefined) params.areaMax = max;
  if (filters.beds) params.bedrooms = Number(filters.beds);
  if (filters.baths) params.bathrooms = Number(filters.baths);
  for (const key of [
    'furnishingStatus',
    'direction',
    'balconyDirection',
    'restroomType',
    'kitchenType',
    'accessType',
    'legalStatus',
  ] as const) {
    if (filters[key]) params[key] = filters[key];
  }
  for (const key of ['hasVideo', 'hasMezzanine', 'hasRooftop', 'hasGarage'] as const) {
    if (filters[key]) params[key] = true;
  }
  return params;
}

export default function SearchScreen({
  onSelectTab,
  onOpenListing,
}: {
  onSelectTab: (tab: MainTab) => void;
  onOpenListing: (id: string) => void;
}) {
  const [city, setCity] = useState(
    provinces.find((item) => item.name.includes('Hồ Chí Minh')) ?? provinces[0]
  );
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [wardId, setWardId] = useState('');
  const [wardOpen, setWardOpen] = useState(false);
  const [wardQuery, setWardQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [applied, setApplied] = useState(() => queryParams(city.code, '', '', DEFAULT_FILTERS));
  const [rows, setRows] = useState<ListingSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  const wards = useMemo(() => WARDS.filter((ward) => ward.parent_code === city.code), [city.code]);
  const visibleWards = wards.filter((ward) => matchesProvince(ward.name_with_type, wardQuery));
  const selectedWard = wards.find((ward) => ward.code === wardId);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const load = useCallback(
    async (nextPage = 1) => {
      const ticket = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicListingsPage({ ...applied, page: nextPage, size: 12 });
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
    [applied]
  );
  useEffect(() => {
    void load();
    return invalidateRequests;
  }, [load, invalidateRequests]);
  const apply = () => {
    const next = queryParams(city.code, wardId, keyword, filters);
    if (
      filters.priceMin &&
      filters.priceMax &&
      Number(filters.priceMin.replace(',', '.')) > Number(filters.priceMax.replace(',', '.'))
    ) {
      setError('Giá tối thiểu cần nhỏ hơn giá tối đa.');
      return;
    }
    setRows([]);
    setHasMore(false);
    setApplied(next);
  };
  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setKeyword('');
    setWardId('');
    setRows([]);
    setHasMore(false);
    setApplied(queryParams(city.code, '', '', DEFAULT_FILTERS));
  };
  const toggle = (key: 'hasVideo' | 'hasMezzanine' | 'hasRooftop' | 'hasGarage', label: string) => (
    <Pressable
      key={key}
      onPress={() => setFilter(key, !filters[key])}
      accessibilityRole="button"
      accessibilityState={{ selected: filters[key] }}
      className={`mb-2 mr-2 min-h-11 rounded-full border px-4 py-2.5 ${filters[key] ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
      <Text className={`text-sm font-semibold ${filters[key] ? 'text-primary' : 'text-secondary'}`}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <TabHeader title="Tìm nhà">
        <Text className="mt-1 text-sm text-muted-foreground">
          Lọc theo nhu cầu để tìm nơi ở phù hợp
        </Text>
      </TabHeader>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-10 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View className="rounded-2xl border border-border bg-surface p-4">
          <FilterSection
            label="Khu vực"
            summary={`${city.name}${selectedWard ? ` · ${selectedWard.name_with_type}` : ''}`}>
            <Pressable
              onPress={() => setCityOpen(!cityOpen)}
              accessibilityRole="button"
              className="mt-3 min-h-12 flex-row items-center rounded-xl border border-border px-3">
              <Icon name="location-outline" size={20} className="text-primary" />
              <Text className="ml-2 flex-1 font-semibold text-foreground">{city.name}</Text>
              <Icon
                name={cityOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                className="text-subtle"
              />
            </Pressable>
            {cityOpen ? (
              <View className="mt-2 rounded-xl border border-border bg-surface p-2">
                <TextInput
                  value={cityQuery}
                  onChangeText={setCityQuery}
                  placeholder="Tìm tỉnh/thành"
                  className="min-h-11 rounded-lg bg-muted px-3 text-foreground placeholder:text-subtle"
                />
                <ScrollView
                  nestedScrollEnabled
                  className="max-h-56"
                  keyboardShouldPersistTaps="handled">
                  {provinces
                    .filter((item) => matchesProvince(item.name, cityQuery))
                    .map((item) => (
                      <Pressable
                        key={item.code}
                        onPress={() => {
                          setCity(item);
                          setWardId('');
                          setWardQuery('');
                          setCityOpen(false);
                        }}
                        className="min-h-11 justify-center border-b border-border px-3">
                        <Text className="text-foreground">{item.name}</Text>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
            ) : null}
            <Pressable
              onPress={() => setWardOpen(!wardOpen)}
              accessibilityRole="button"
              className="mt-2 min-h-12 flex-row items-center rounded-xl border border-border px-3">
              <Text className="flex-1 text-sm text-foreground">
                {selectedWard?.name_with_type ?? 'Tất cả phường/xã'}
              </Text>
              <Icon
                name={wardOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                className="text-subtle"
              />
            </Pressable>
            {wardOpen ? (
              <View className="mt-2 rounded-xl border border-border bg-surface p-2">
                <TextInput
                  value={wardQuery}
                  onChangeText={setWardQuery}
                  placeholder="Tìm phường/xã"
                  className="min-h-11 rounded-lg bg-muted px-3 text-foreground placeholder:text-subtle"
                />
                <ScrollView
                  nestedScrollEnabled
                  className="max-h-56"
                  keyboardShouldPersistTaps="handled">
                  <Pressable
                    onPress={() => {
                      setWardId('');
                      setWardOpen(false);
                    }}
                    className="min-h-11 justify-center border-b border-border px-3">
                    <Text className="text-primary">Tất cả phường/xã</Text>
                  </Pressable>
                  {visibleWards.map((ward) => (
                    <Pressable
                      key={ward.code}
                      onPress={() => {
                        setWardId(ward.code);
                        setWardOpen(false);
                      }}
                      className="min-h-11 justify-center border-b border-border px-3">
                      <Text className="text-foreground">{ward.name_with_type}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </FilterSection>
          <FilterSection label="Từ khóa" summary={keyword.trim() || 'Tên nhà, địa chỉ...'}>
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={apply}
              returnKeyType="search"
              placeholder="Tên nhà, địa chỉ, từ khóa..."
              className="mt-3 min-h-12 rounded-xl border border-border px-3 text-foreground placeholder:text-subtle"
            />
          </FilterSection>
          <OptionGroup
            label="Loại nhà"
            options={CATEGORIES}
            value={filters.category}
            onChange={(value) => setFilter('category', value)}
          />
          <FilterSection
            label="Giá thuê"
            summary={
              filters.priceMin || filters.priceMax
                ? `${filters.priceMin || '0'} – ${filters.priceMax || '∞'} triệu/tháng`
                : 'Tất cả mức giá'
            }>
            <View className="mt-2 flex-row gap-2">
              <TextInput
                value={filters.priceMin}
                onChangeText={(value) => setFilter('priceMin', value)}
                keyboardType="decimal-pad"
                placeholder="Từ"
                className="min-h-12 flex-1 rounded-xl border border-border px-3 text-foreground placeholder:text-subtle"
              />
              <TextInput
                value={filters.priceMax}
                onChangeText={(value) => setFilter('priceMax', value)}
                keyboardType="decimal-pad"
                placeholder="Đến"
                className="min-h-12 flex-1 rounded-xl border border-border px-3 text-foreground placeholder:text-subtle"
              />
            </View>
          </FilterSection>
          <OptionGroup
            label="Diện tích"
            options={AREAS}
            value={filters.areaRange}
            onChange={(value) => setFilter('areaRange', value)}
          />
          <Pressable
            onPress={() => setAdvancedOpen(!advancedOpen)}
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            className="mt-5 min-h-11 flex-row items-center justify-between border-t border-border pt-3">
            <Text className="font-bold text-primary">Bộ lọc chi tiết</Text>
            <Icon
              name={advancedOpen ? 'chevron-up' : 'chevron-down'}
              size={19}
              className="text-primary"
            />
          </Pressable>
          {advancedOpen ? (
            <>
              <OptionGroup
                label="Phòng ngủ"
                options={COUNTS}
                value={filters.beds}
                onChange={(value) => setFilter('beds', value)}
              />
              <OptionGroup
                label="Phòng tắm"
                options={COUNTS}
                value={filters.baths}
                onChange={(value) => setFilter('baths', value)}
              />
              <OptionGroup
                label="Nội thất"
                options={FURNISHING}
                value={filters.furnishingStatus}
                onChange={(value) => setFilter('furnishingStatus', value)}
              />
              <OptionGroup
                label="Hướng nhà"
                options={DIRECTIONS}
                value={filters.direction}
                onChange={(value) => setFilter('direction', value)}
              />
              <OptionGroup
                label="Hướng ban công"
                options={DIRECTIONS}
                value={filters.balconyDirection}
                onChange={(value) => setFilter('balconyDirection', value)}
              />
              <OptionGroup
                label="Nhà vệ sinh"
                options={RESTROOMS}
                value={filters.restroomType}
                onChange={(value) => setFilter('restroomType', value)}
              />
              <OptionGroup
                label="Bếp"
                options={KITCHENS}
                value={filters.kitchenType}
                onChange={(value) => setFilter('kitchenType', value)}
              />
              <OptionGroup
                label="Lối đi"
                options={ACCESS}
                value={filters.accessType}
                onChange={(value) => setFilter('accessType', value)}
              />
              <OptionGroup
                label="Giấy tờ pháp lý"
                options={LEGAL}
                value={filters.legalStatus}
                onChange={(value) => setFilter('legalStatus', value)}
              />
              <FilterSection
                label="Tiện ích khác"
                summary={
                  [
                    filters.hasVideo && 'Video',
                    filters.hasMezzanine && 'Gác lửng',
                    filters.hasRooftop && 'Sân thượng',
                    filters.hasGarage && 'Gara',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Chưa chọn'
                }>
                <View className="flex-row flex-wrap">
                  {toggle('hasVideo', 'Có video')}
                  {toggle('hasMezzanine', 'Có gác lửng')}
                  {toggle('hasRooftop', 'Có sân thượng')}
                  {toggle('hasGarage', 'Có gara')}
                </View>
              </FilterSection>
            </>
          ) : null}
          <OptionGroup
            label="Sắp xếp"
            options={SORT}
            value={filters.sort}
            onChange={(value) => setFilter('sort', value)}
          />
          <View className="mt-5 flex-row gap-2">
            <Pressable
              onPress={reset}
              accessibilityRole="button"
              className="min-h-12 items-center justify-center rounded-xl border border-border px-4">
              <Text className="font-semibold text-secondary">Xóa lọc</Text>
            </Pressable>
            <Pressable
              onPress={apply}
              accessibilityRole="button"
              className="min-h-12 flex-1 items-center justify-center rounded-xl bg-brand px-4">
              <Text className="font-bold text-on-brand">Tìm nhà</Text>
            </Pressable>
          </View>
        </View>
        <View className="mt-6 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-foreground">Kết quả</Text>
          <Text className="text-sm text-muted-foreground">{total} tin</Text>
        </View>
        <ErrorNotice message={error} />
        {rows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => onOpenListing(row.id)}
            accessibilityRole="button"
            className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
            <Image
              source={{ uri: listingImage(row.coverImageUrl) }}
              className="h-44 w-full bg-muted"
            />
            <View className="p-4">
              <Text className="text-base font-bold text-foreground">{row.title}</Text>
              <Text className="mt-2 font-bold text-primary">
                {row.priceAmount.toLocaleString('vi-VN')} đ/tháng
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {row.fullAddress || row.provinceName}
              </Text>
              <Text className="mt-2 text-xs text-secondary">
                {row.areaM2} m² · {row.bedroomCount ?? '—'} PN · {row.bathroomCount ?? '—'} WC
              </Text>
            </View>
          </Pressable>
        ))}
        {loading ? (
          <ActivityIndicator className="my-8 text-primary" />
        ) : !rows.length && !error ? (
          <Text className="py-8 text-center text-muted-foreground">
            Không có nhà phù hợp với bộ lọc.
          </Text>
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
