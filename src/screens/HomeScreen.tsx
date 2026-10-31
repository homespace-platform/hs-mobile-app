import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@/components/Icon';
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

import Avatar from '@/components/Avatar';
import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import { matchesProvince } from '@/lib/location-search';
import { getPublicListings, listingImage, type ListingSummary } from '@/services/listingApi';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';
import provinces from '@/data/provinces.json';

type Category = { label: string; value?: string };

const CATEGORIES: Category[] = [
  { label: 'Tất cả' },
  { label: 'Căn hộ', value: 'APARTMENT' },
  { label: 'Nhà riêng', value: 'HOUSE' },
  { label: 'Phòng trọ', value: 'ROOM' },
  { label: 'Văn phòng', value: 'OFFICE' },
];

function formatPrice(value: number) {
  if (!value) return 'Thỏa thuận';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu/tháng`;
  }
  return `${value.toLocaleString('vi-VN')} đ/tháng`;
}

function categoryLabel(category: string) {
  return (
    CATEGORIES.find((item) => item.value === category)?.label ??
    (category || 'Nhà cho thuê').replace(/_/g, ' ')
  );
}

function ListingCard({ listing, onPress }: { listing: ListingSummary; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-4 w-72 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <Image
        source={{ uri: listingImage(listing.coverImageUrl) }}
        className="h-40 w-full bg-muted"
      />
      <View className="p-4">
        <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
          {categoryLabel(listing.category)}
        </Text>
        <Text className="mt-1 text-base font-bold text-foreground" numberOfLines={2}>
          {listing.title}
        </Text>
        <Text className="mt-2 text-base font-bold text-primary">
          {formatPrice(listing.priceAmount)}
        </Text>
        <View className="mt-2 flex-row items-center">
          <Ionicons name="location-outline" size={14} className="text-muted-foreground" />
          <Text className="ml-1 flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {listing.fullAddress || listing.provinceName || 'Đang cập nhật địa chỉ'}
          </Text>
        </View>
        <View className="mt-3 flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="resize-outline" size={14} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{listing.areaM2 || '—'} m²</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="bed-outline" size={14} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{listing.bedroomCount ?? '—'} PN</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="water-outline" size={14} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{listing.bathroomCount ?? '—'} WC</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({
  onSelectTab,
  onOpenListing,
  onBrowse,
}: {
  onSelectTab?: (tab: MainTab) => void;
  onOpenListing?: (id: string) => void;
  onBrowse: (filters: Record<string, string | number>) => void;
}) {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0]);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [areaExpanded, setAreaExpanded] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  const [city, setCity] = useState(
    provinces.find((item) => item.name.includes('Hồ Chí Minh')) || provinces[0]
  );
  const browseFilters: Record<string, string | number> = {
    cityId: city.code,
    ...(activeCategory.value ? { category: activeCategory.value } : {}),
    ...(submittedSearch.trim() ? { keyword: submittedSearch.trim() } : {}),
  };
  const filteredProvinces = provinces.filter((item) => matchesProvince(item.name, areaQuery));

  const loadListings = useCallback(
    async (isRefresh = false) => {
      const id = ++requestId.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await getPublicListings({
          page: 1,
          size: 8,
          sort: 'newest',
          cityId: city.code,
          ...(activeCategory.value ? { category: activeCategory.value } : {}),
          ...(submittedSearch.trim() ? { keyword: submittedSearch.trim() } : {}),
        });
        if (id === requestId.current) setListings(result);
      } catch (loadError) {
        if (id !== requestId.current) return;
        setListings([]);
        setError(loadError instanceof Error ? loadError.message : 'Không tải được tin đăng');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeCategory.value, submittedSearch, city.code]
  );

  useEffect(() => {
    loadListings();
    return invalidateRequests;
  }, [loadListings, invalidateRequests]);

  useEffect(() => {
    getUserProfileApi()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadListings(true)} />
        }
        contentContainerClassName="pb-6"
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between bg-surface px-5 pb-3 pt-2">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-widest text-primary">
              HomeSpace
            </Text>
            <Text className="mt-1 text-xl font-bold text-foreground">Tìm nơi gọi là nhà</Text>
          </View>
          <Pressable
            onPress={() => onSelectTab?.('profile')}
            className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-primary-border bg-brand">
            <Avatar
              uri={profile?.avatarUrl}
              name={
                [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
                profile?.username ||
                'HomeSpace'
              }
              size={40}
            />
          </Pressable>
        </View>

        <View className="mx-5 mt-4 rounded-3xl bg-brand p-5">
          <Text className="text-2xl font-bold leading-8 text-on-brand">
            Không gian phù hợp đang chờ bạn
          </Text>
          <Text className="mt-2 text-sm leading-5 text-on-brand-muted">
            Khám phá những căn nhà được xác thực và cập nhật mới nhất trên HomeSpace.
          </Text>
          <View className="mt-5 flex-row items-center rounded-2xl bg-surface px-4 py-1">
            <Ionicons name="search-outline" size={20} className="text-subtle" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => setSubmittedSearch(search)}
              placeholder="Tìm theo khu vực, tên nhà..."
              returnKeyType="search"
              className="ml-2 flex-1 py-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5 pl-5">
          {CATEGORIES.map((category) => {
            const active = activeCategory.label === category.label;
            return (
              <Pressable
                key={category.label}
                onPress={() => setActiveCategory(category)}
                className={`mr-2 rounded-full px-4 py-2.5 ${active ? 'bg-inverse' : 'border border-border bg-surface'}`}>
                <Text
                  className={`text-sm font-semibold ${active ? 'text-on-inverse' : 'text-secondary'}`}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mt-7 px-5">
          <Text className="text-xl font-bold text-foreground">Khám phá theo khu vực</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Chọn tỉnh/thành để xem những tin mới trong khu vực.
          </Text>
          <Pressable
            onPress={() => setAreaExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded: areaExpanded }}
            accessibilityLabel={`Tỉnh thành: ${city.name}`}
            className="mt-4 min-h-14 flex-row items-center rounded-2xl border border-primary-border bg-surface px-4">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
              <Ionicons name="location-outline" size={20} className="text-primary" />
            </View>
            <Text className="ml-3 flex-1 text-sm font-bold text-foreground">{city.name}</Text>
            <Ionicons
              name={areaExpanded ? 'chevron-up' : 'chevron-down'}
              size={19}
              className="text-secondary"
            />
          </Pressable>
          {areaExpanded ? (
            <View className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface">
              <View className="m-3 flex-row items-center rounded-xl bg-muted px-3">
                <Ionicons name="search-outline" size={18} className="text-subtle" />
                <TextInput
                  value={areaQuery}
                  onChangeText={setAreaQuery}
                  placeholder="Nhập tên tỉnh/thành"
                  autoCorrect={false}
                  className="ml-2 min-h-11 flex-1 text-sm text-foreground selection:text-primary placeholder:text-subtle"
                />
              </View>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                className="max-h-64">
                {filteredProvinces.length ? (
                  filteredProvinces.map((location) => (
                    <Pressable
                      key={location.code}
                      onPress={() => {
                        setCity(location);
                        setAreaExpanded(false);
                        setAreaQuery('');
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: location.code === city.code }}
                      className="min-h-12 flex-row items-center border-t border-border px-4 py-3">
                      <Text
                        className={`flex-1 text-sm ${location.code === city.code ? 'font-bold text-primary' : 'text-foreground'}`}>
                        {location.name}
                      </Text>
                      {location.code === city.code ? (
                        <Ionicons name="checkmark-circle" size={20} className="text-primary" />
                      ) : null}
                    </Pressable>
                  ))
                ) : (
                  <Text className="px-4 py-5 text-center text-sm text-muted-foreground">
                    Không tìm thấy tỉnh/thành phù hợp.
                  </Text>
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View className="mt-7 px-5">
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-xl font-bold text-foreground">Nhà cho thuê</Text>
              <Text className="mt-1 text-sm font-semibold text-primary">{city.name}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Những tin mới nhất dành cho bạn
              </Text>
            </View>
            <Pressable
              onPress={() => onBrowse(browseFilters)}
              accessibilityRole="button"
              className="min-h-11 justify-center">
              <Text className="text-sm font-semibold text-primary">Xem tất cả</Text>
            </Pressable>
          </View>

          {loading ? (
            <View className="mt-10 items-center">
              <ActivityIndicator className="text-primary" />
              <Text className="mt-2 text-sm text-muted-foreground">Đang tải tin đăng...</Text>
            </View>
          ) : error ? (
            <View className="mt-4 rounded-2xl bg-danger-soft p-4">
              <Text className="text-sm text-danger">Không thể tải danh sách nhà lúc này.</Text>
              <Pressable
                onPress={() => loadListings()}
                className="mt-3 self-start rounded-lg bg-danger-soft px-3 py-2">
                <Text className="text-xs font-semibold text-danger">Thử lại</Text>
              </Pressable>
            </View>
          ) : listings.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mr-5 mt-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onPress={() => onOpenListing?.(listing.id)}
                />
              ))}
            </ScrollView>
          ) : (
            <View className="mt-4 items-center rounded-2xl border border-dashed border-border-strong bg-surface p-8">
              <Ionicons name="home-outline" size={36} className="text-subtle" />
              <Text className="mt-3 text-center text-sm font-semibold text-secondary">
                Chưa có tin phù hợp
              </Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                Hãy thử đổi khu vực hoặc danh mục tìm kiếm.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-8 px-5">
          <Text className="text-xl font-bold text-foreground">Tìm theo nhu cầu</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Bắt đầu với loại nhà bạn đang quan tâm.
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => onBrowse({ cityId: city.code, category: 'APARTMENT' })}
              accessibilityRole="button"
              className="min-h-36 flex-1 justify-between rounded-2xl border border-primary-border bg-primary-soft p-4">
              <Ionicons name="business-outline" size={28} className="text-primary" />
              <View>
                <Text className="text-base font-bold text-foreground">Căn hộ</Text>
                <Text className="mt-1 text-xs text-muted-foreground">Khám phá căn hộ cho thuê</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => onBrowse({ cityId: city.code, category: 'ROOM' })}
              accessibilityRole="button"
              className="min-h-36 flex-1 justify-between rounded-2xl border border-border bg-warning-soft p-4">
              <Ionicons name="bed-outline" size={28} className="text-warning" />
              <View>
                <Text className="text-base font-bold text-foreground">Phòng trọ</Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  Xem phòng tại {city.name}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View className="mt-8 px-5">
          <Text className="text-xl font-bold text-foreground">Từ tìm nhà đến dọn vào</Text>
          <View className="mt-4 rounded-3xl border border-border bg-surface px-4">
            {(
              [
                {
                  icon: 'options-outline',
                  title: 'Tìm đúng nơi',
                  note: 'Lọc theo khu vực và loại nhà.',
                },
                {
                  icon: 'calendar-outline',
                  title: 'Hẹn lịch xem',
                  note: 'Chọn ngày giờ thuận tiện.',
                },
                {
                  icon: 'list-outline',
                  title: 'Theo dõi dễ dàng',
                  note: 'Xem lịch hẹn và yêu cầu thuê trong Quản lý.',
                },
              ] as const
            ).map((item, index) => (
              <View
                key={item.title}
                className={`flex-row items-center py-4 ${index ? 'border-t border-border' : ''}`}>
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                  <Ionicons name={item.icon} size={20} className="text-primary" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-foreground">{item.title}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">{item.note}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomTabBar active="home" onSelect={(tab) => onSelectTab?.(tab)} />
    </SafeAreaView>
  );
}
