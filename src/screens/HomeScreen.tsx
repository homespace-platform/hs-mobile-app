import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import { getPublicListings, listingImage, type ListingSummary } from '@/services/listingApi';
import { getUserProfileApi } from '@/services/userApi';
import type { UserProfileResponse } from '@/types/api';

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
      className="mr-4 w-72 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <Image
        source={{ uri: listingImage(listing.coverImageUrl) }}
        className="h-40 w-full bg-slate-100"
      />
      <View className="p-4">
        <Text className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          {categoryLabel(listing.category)}
        </Text>
        <Text className="mt-1 text-base font-bold text-slate-900" numberOfLines={2}>
          {listing.title}
        </Text>
        <Text className="mt-2 text-base font-bold text-blue-700">
          {formatPrice(listing.priceAmount)}
        </Text>
        <View className="mt-2 flex-row items-center">
          <Ionicons name="location-outline" size={14} color="#64748b" />
          <Text className="ml-1 flex-1 text-xs text-slate-500" numberOfLines={1}>
            {listing.fullAddress || listing.provinceName || 'Đang cập nhật địa chỉ'}
          </Text>
        </View>
        <View className="mt-3 flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="resize-outline" size={14} color="#64748b" />
            <Text className="text-xs text-slate-500">{listing.areaM2 || '—'} m²</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="bed-outline" size={14} color="#64748b" />
            <Text className="text-xs text-slate-500">{listing.bedroomCount ?? '—'} PN</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="water-outline" size={14} color="#64748b" />
            <Text className="text-xs text-slate-500">{listing.bathroomCount ?? '—'} WC</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({
  onSelectTab,
  onOpenListing,
}: {
  onSelectTab?: (tab: MainTab) => void;
  onOpenListing?: (id: string) => void;
}) {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0]);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadListings = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setListings(
          await getPublicListings({
            page: 1,
            size: 8,
            sort: 'newest',
            ...(activeCategory.value ? { category: activeCategory.value } : {}),
            ...(submittedSearch.trim() ? { keyword: submittedSearch.trim() } : {}),
          })
        );
      } catch (loadError) {
        setListings([]);
        setError(loadError instanceof Error ? loadError.message : 'Không tải được tin đăng');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeCategory.value, submittedSearch]
  );

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    getUserProfileApi()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadListings(true)} />
        }
        contentContainerClassName="pb-6"
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between bg-white px-5 pb-3 pt-2">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-widest text-blue-600">
              HomeSpace
            </Text>
            <Text className="mt-1 text-xl font-bold text-slate-900">Tìm nơi gọi là nhà</Text>
          </View>
          <Pressable
            onPress={() => onSelectTab?.('profile')}
            className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-blue-100 bg-blue-600">
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

        <View className="mx-5 mt-4 rounded-3xl bg-blue-600 p-5">
          <Text className="text-2xl font-bold leading-8 text-white">
            Không gian phù hợp đang chờ bạn
          </Text>
          <Text className="mt-2 text-sm leading-5 text-blue-100">
            Khám phá những căn nhà được xác thực và cập nhật mới nhất trên HomeSpace.
          </Text>
          <View className="mt-5 flex-row items-center rounded-2xl bg-white px-4 py-1">
            <Ionicons name="search-outline" size={20} color="#94a3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => setSubmittedSearch(search)}
              placeholder="Tìm theo khu vực, tên nhà..."
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              className="ml-2 flex-1 py-3 text-sm text-slate-800"
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
                className={`mr-2 rounded-full px-4 py-2.5 ${active ? 'bg-slate-900' : 'border border-slate-200 bg-white'}`}>
                <Text
                  className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mt-7 px-5">
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-xl font-bold text-slate-900">Nhà cho thuê quanh đây</Text>
              <Text className="mt-1 text-sm text-slate-500">Những tin mới nhất dành cho bạn</Text>
            </View>
            <Text className="text-sm font-semibold text-blue-600">Xem tất cả</Text>
          </View>

          {loading ? (
            <View className="mt-10 items-center">
              <ActivityIndicator color="#2563eb" />
              <Text className="mt-2 text-sm text-slate-500">Đang tải tin đăng...</Text>
            </View>
          ) : error ? (
            <View className="mt-4 rounded-2xl bg-red-50 p-4">
              <Text className="text-sm text-red-700">Không thể tải danh sách nhà lúc này.</Text>
              <Pressable
                onPress={() => loadListings()}
                className="mt-3 self-start rounded-lg bg-red-100 px-3 py-2">
                <Text className="text-xs font-semibold text-red-700">Thử lại</Text>
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
            <View className="mt-4 items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8">
              <Ionicons name="home-outline" size={36} color="#94a3b8" />
              <Text className="mt-3 text-center text-sm font-semibold text-slate-700">
                Chưa có tin phù hợp
              </Text>
              <Text className="mt-1 text-center text-xs text-slate-500">
                Hãy thử đổi khu vực hoặc danh mục tìm kiếm.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-8 px-5">
          <Text className="text-xl font-bold text-slate-900">Khám phá theo khu vực</Text>
          <View className="mt-4 flex-row flex-wrap gap-3">
            {['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương'].map((location) => (
              <Pressable
                key={location}
                className="flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Ionicons name="location-outline" size={16} color="#2563eb" />
                <Text className="ml-1.5 text-sm font-semibold text-slate-700">{location}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomTabBar active="home" onSelect={(tab) => onSelectTab?.(tab)} />
    </SafeAreaView>
  );
}
