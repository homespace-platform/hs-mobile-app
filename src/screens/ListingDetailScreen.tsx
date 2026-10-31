import { useCallback, useEffect, useMemo, useState } from 'react';
import Ionicons from '@/components/Icon';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { createConversation, type RelatedListing } from '@/services/chatApi';
import { getPublicListing, listingImage, type ListingDetail } from '@/services/listingApi';
import { getAccessibleListing } from '@/services/listingApi';
import { getFavoriteIds, toggleFavorite, recordListingHistory } from '@/services/favoriteApi';
import { getUserProfileApi } from '@/services/userApi';
import BookingForm from '@/components/BookingForm';
import RentalRequestForm from '@/components/RentalRequestForm';
import { Button } from '@/components/Screen';
import { apiError } from '@/lib/api-error';

const LABELS: Record<string, string> = {
  projectName: 'Dự án',
  buildingBlock: 'Tòa nhà',
  unitCode: 'Mã căn',
  floorNumber: 'Tầng',
  buildingTotalFloors: 'Tổng số tầng',
  bedroomCount: 'Phòng ngủ',
  bathroomCount: 'Phòng tắm',
  livingRoomCount: 'Phòng khách',
  kitchenCount: 'Nhà bếp',
  furnishingStatus: 'Nội thất',
  mainDoorDirection: 'Hướng cửa',
  balconyDirection: 'Hướng ban công',
  maxOccupants: 'Số người tối đa',
  legalStatus: 'Pháp lý',
  totalFloors: 'Số tầng',
  expectedSeats: 'Chỗ ngồi',
  frontageWidthM: 'Mặt tiền',
  restroomCount: 'Số WC',
  restroomType: 'Loại WC',
  positionType: 'Vị trí',
};

const VALUE_LABELS: Record<string, string> = {
  FULLY_FURNISHED: 'Đầy đủ nội thất',
  PARTIALLY_FURNISHED: 'Nội thất một phần',
  UNFURNISHED: 'Không nội thất',
  BASIC: 'Nội thất cơ bản',
  SOUTH: 'Nam',
  NORTH: 'Bắc',
  EAST: 'Đông',
  WEST: 'Tây',
  PINK_BOOK: 'Sổ hồng',
  PRIVATE: 'Riêng',
  SHARED: 'Dùng chung',
};

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Thứ 2',
  TUESDAY: 'Thứ 3',
  WEDNESDAY: 'Thứ 4',
  THURSDAY: 'Thứ 5',
  FRIDAY: 'Thứ 6',
  SATURDAY: 'Thứ 7',
  SUNDAY: 'Chủ nhật',
};

const SLOT_LABELS: Record<string, string> = {
  MORNING: 'Buổi sáng',
  AFTERNOON: 'Buổi chiều',
  EVENING: 'Buổi tối',
};

const CHARGE_LABELS: Record<string, string> = {
  ELECTRICITY: 'Điện',
  WATER: 'Nước',
  MANAGEMENT: 'Phí quản lý',
  INTERNET: 'Internet',
  SERVICE_OR_GARBAGE: 'Dịch vụ / rác',
  MOTORBIKE_PARKING: 'Gửi xe máy',
  CAR_PARKING: 'Gửi ô tô',
};

function formatMoney(value?: number | null) {
  return value ? `${value.toLocaleString('vi-VN')} đ` : 'Thỏa thuận';
}

function formatValue(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return VALUE_LABELS[String(value)] ?? String(value).replace(/_/g, ' ');
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-[48%] rounded-2xl bg-background p-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="mt-1 text-sm font-bold text-foreground">{value}</Text>
    </View>
  );
}

export default function ListingDetailScreen({
  listingId,
  onBack,
  onOpenMessages,
  own = false,
}: {
  listingId: string;
  onBack: () => void;
  onOpenMessages: (conversationId: string) => void;
  own?: boolean;
}) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [favoriteReady, setFavoriteReady] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [form, setForm] = useState<'booking' | 'rental' | null>(null);
  const loadInteractions = useCallback(async () => {
    setFavoriteReady(false);
    setChatError(null);
    try {
      const [ids, profile] = await Promise.all([getFavoriteIds(), getUserProfileApi()]);
      setFavorite(ids.includes(listingId));
      setUserId(profile.id);
      setFavoriteReady(true);
    } catch (e) {
      setChatError(apiError(e));
    }
  }, [listingId]);
  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);
  async function saveFavorite() {
    if (!favoriteReady || favoriteSaving) return;
    setFavoriteSaving(true);
    setChatError(null);
    try {
      setFavorite(await toggleFavorite(listingId));
    } catch (e) {
      setChatError(apiError(e));
    } finally {
      setFavoriteSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setListing(await (own ? getAccessibleListing(listingId) : getPublicListing(listingId)));
      if (!own) void recordListingHistory(listingId).catch(() => undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được bài đăng');
    } finally {
      setLoading(false);
    }
  }, [listingId, own]);

  useEffect(() => {
    load();
  }, [load]);

  const detailValues = useMemo(() => {
    if (!listing) return [];
    const values =
      listing.apartmentDetail ??
      listing.houseDetail ??
      listing.officeDetail ??
      listing.commercialDetail ??
      listing.roomDetail ??
      {};
    return Object.entries(values).filter(
      ([key, value]) => LABELS[key] && value !== null && value !== undefined && value !== ''
    ) as [string, string | number | boolean][];
  }, [listing]);

  if (form === 'booking')
    return (
      <BookingForm
        listingId={listingId}
        onBack={() => setForm(null)}
        onSuccess={() => setForm(null)}
      />
    );
  if (form === 'rental')
    return (
      <RentalRequestForm
        listingId={listingId}
        onBack={() => setForm(null)}
        onSuccess={() => setForm(null)}
      />
    );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator className="text-primary" />
        <Text className="mt-3 text-sm text-muted-foreground">Đang tải thông tin nhà...</Text>
      </SafeAreaView>
    );
  }

  if (!listing || error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-base font-semibold text-foreground">
          Không thể mở bài đăng
        </Text>
        <Pressable onPress={load} className="mt-4 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-on-brand">Thử lại</Text>
        </Pressable>
        <Pressable onPress={onBack} className="mt-3 px-5 py-3">
          <Text className="font-semibold text-muted-foreground">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const images = Array.from(
    new Set(
      listing.media
        .filter((item) => item.mediaType === 'IMAGE')
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => listingImage(item.url))
    )
  );
  const categoryDetails = detailValues;
  const currentListing = listing;
  const relatedListing: RelatedListing = {
    id: currentListing.id,
    title: currentListing.title,
    price: `${formatMoney(currentListing.pricing.amount)}/${currentListing.pricing.unit || 'tháng'}`,
    location: currentListing.address?.fullAddress || 'Đang cập nhật địa chỉ',
    image: listingImage(
      currentListing.media.find((item) => item.mediaType === 'IMAGE')?.url || null
    ),
  };

  async function handleOpenMessages() {
    const participantId = currentListing.owner?.id || currentListing.ownerId;
    if (!participantId) {
      setChatError('Bài đăng chưa có thông tin chủ nhà');
      return;
    }
    setOpeningChat(true);
    setChatError(null);
    try {
      const conversation = await createConversation(participantId, relatedListing, {
        displayName: currentListing.owner?.displayName,
        avatarUrl: currentListing.owner?.avatarUrl || undefined,
      });
      onOpenMessages(conversation.id);
    } catch (openError) {
      setChatError(openError instanceof Error ? openError.message : 'Không thể mở cuộc trò chuyện');
    } finally {
      setOpeningChat(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="absolute left-0 right-0 top-12 z-10 flex-row justify-between px-4">
        <Pressable
          onPress={onBack}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface/95 shadow">
          <Ionicons name="chevron-back" size={25} className="text-foreground" />
        </Pressable>
        <Pressable
          onPress={saveFavorite}
          disabled={!favoriteReady || favoriteSaving}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
          accessibilityState={{ selected: favorite, disabled: !favoriteReady || favoriteSaving }}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface/95 shadow">
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={24}
            className={favorite ? 'text-danger' : 'text-secondary'}
          />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-28">
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {(images.length ? images : [listingImage(null)]).map((url, index) => (
            <Image
              key={`${url}-${index}`}
              source={{ uri: url }}
              className="h-72 w-screen bg-muted"
            />
          ))}
        </ScrollView>

        <View className="px-5 py-5">
          <View className="flex-row items-center justify-between">
            <Text className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
              {listing.category.replace(/_/g, ' ')}
            </Text>
            <View className="flex-row items-center">
              <Ionicons name="eye-outline" size={15} className="text-muted-foreground" />
              <Text className="ml-1 text-xs text-muted-foreground">
                {listing.viewCount ?? 0} lượt xem
              </Text>
            </View>
          </View>
          <Text className="mt-3 text-2xl font-bold leading-8 text-foreground">{listing.title}</Text>
          <View className="mt-2 flex-row items-start">
            <Ionicons name="location-outline" size={17} className="text-muted-foreground" />
            <Text className="ml-1 flex-1 text-sm leading-5 text-muted-foreground">
              {listing.address?.fullAddress || 'Đang cập nhật địa chỉ'}
            </Text>
          </View>
          <Text className="mt-4 text-2xl font-extrabold text-primary">
            {formatMoney(listing.pricing.amount)}/tháng
          </Text>
          {!own && userId && userId !== listing.ownerId ? (
            <>
              <Button label="Đặt lịch xem nhà" onPress={() => setForm('booking')} />
              <Button label="Gửi yêu cầu thuê" onPress={() => setForm('rental')} />
            </>
          ) : null}
          {!favoriteReady && chatError ? (
            <Button label="Thử tải lại thao tác" onPress={loadInteractions} />
          ) : null}
          {listing.pricing.negotiable ? (
            <Text className="mt-1 text-xs font-semibold text-success">Có thể thương lượng</Text>
          ) : null}

          <View className="mt-5 flex-row flex-wrap justify-between gap-y-3 rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <Metric label="Diện tích" value={`${listing.areaM2} m²`} />
            <Metric
              label="Phòng ngủ"
              value={`${listing.apartmentDetail?.bedroomCount ?? listing.houseDetail?.bedroomCount ?? '—'} phòng`}
            />
            <Metric
              label="Phòng tắm"
              value={`${listing.apartmentDetail?.bathroomCount ?? listing.houseDetail?.bathroomCount ?? '—'} phòng`}
            />
            <Metric label="Có thể vào ở" value={listing.availableFrom || 'Liên hệ'} />
          </View>

          {categoryDetails.length ? (
            <View className="mt-7">
              <Text className="text-lg font-bold text-foreground">Thông tin chi tiết</Text>
              <View className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
                {categoryDetails.map(([key, value], index) => (
                  <View
                    key={key}
                    className={`flex-row justify-between px-4 py-3 ${index ? 'border-t border-border' : ''}`}>
                    <Text className="text-sm text-muted-foreground">{LABELS[key]}</Text>
                    <Text className="max-w-[55%] text-right text-sm font-semibold text-foreground">
                      {formatValue(value)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="mt-7">
            <Text className="text-lg font-bold text-foreground">Điều khoản thuê</Text>
            <View className="mt-3 flex-row flex-wrap justify-between gap-y-3">
              <Metric
                label="Tiền cọc"
                value={
                  listing.pricing.depositMonths
                    ? `${listing.pricing.depositMonths} tháng`
                    : formatMoney(listing.pricing.depositAmount)
                }
              />
              <Metric
                label="Thuê tối thiểu"
                value={`${listing.pricing.minimumLeaseMonths} tháng`}
              />
              <Metric label="Thanh toán" value={formatValue(listing.pricing.paymentCycle)} />
              <Metric
                label="Phí quản lý"
                value={listing.pricing.managementFeeIncluded ? 'Đã bao gồm' : 'Chưa bao gồm'}
              />
            </View>
          </View>

          {listing.amenities.length || listing.customAmenities.length ? (
            <View className="mt-7">
              <Text className="text-lg font-bold text-foreground">Tiện ích</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {[...listing.amenities.map((item) => item.name), ...listing.customAmenities].map(
                  (item) => (
                    <View
                      key={item}
                      className="flex-row items-center rounded-xl border border-primary-border bg-primary-soft px-3 py-2">
                      <Ionicons name="checkmark-circle" size={14} className="text-primary" />
                      <Text className="ml-1 text-xs font-semibold text-primary">{item}</Text>
                    </View>
                  )
                )}
              </View>
            </View>
          ) : null}

          {listing.charges.length ? (
            <View className="mt-7">
              <Text className="text-lg font-bold text-foreground">Chi phí khác</Text>
              <View className="mt-3 overflow-hidden rounded-2xl border border-border">
                {listing.charges.map((charge, index) => (
                  <View
                    key={`${charge.chargeType}-${index}`}
                    className={`flex-row justify-between px-4 py-3 ${index ? 'border-t border-border' : ''}`}>
                    <Text className="text-sm text-muted-foreground">
                      {charge.customName || CHARGE_LABELS[charge.chargeType] || charge.chargeType}
                    </Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {charge.includedInRent
                        ? 'Đã bao gồm'
                        : charge.amount
                          ? `${formatMoney(charge.amount)}${charge.unit ? `/${charge.unit}` : ''}`
                          : formatValue(charge.billingMethod)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {listing.viewingDays?.length || listing.viewingSlots?.length ? (
            <View className="mt-7 rounded-2xl bg-success-soft p-4">
              <Text className="text-lg font-bold text-foreground">Lịch xem nhà</Text>
              <Text className="mt-2 text-sm text-secondary">
                {(listing.viewingDays ?? []).map((day) => DAY_LABELS[day] ?? day).join(', ')}
              </Text>
              <Text className="mt-1 text-sm font-semibold text-success">
                {(listing.viewingSlots ?? []).map((slot) => SLOT_LABELS[slot] ?? slot).join(' · ')}
              </Text>
            </View>
          ) : null}

          <View className="mt-7">
            <Text className="text-lg font-bold text-foreground">Mô tả chi tiết</Text>
            <Text className="mt-3 text-sm leading-6 text-secondary">
              {listing.description || 'Chủ nhà chưa thêm mô tả.'}
            </Text>
          </View>

          <View className="mt-7 flex-row items-center rounded-2xl border border-border p-4">
            <Avatar
              uri={listing.owner?.avatarUrl}
              name={listing.owner?.displayName || 'HomeSpace'}
              size={48}
            />
            <View className="ml-3 flex-1">
              <Text className="text-xs text-muted-foreground">Chủ nhà</Text>
              <Text className="mt-0.5 font-bold text-foreground">
                {listing.owner?.displayName || 'Người đăng tin'}
              </Text>
              <View className="mt-0.5 flex-row items-center">
                <Ionicons name="checkmark-circle" size={13} className="text-success" />
                <Text className="ml-1 text-xs text-success">Tài khoản đã xác thực</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-border bg-surface px-5 pb-5 pt-3">
        <Pressable
          onPress={() => listing.owner?.phone && Linking.openURL(`tel:${listing.owner.phone}`)}
          disabled={!listing.owner?.phone}
          className="flex-1 flex-row items-center justify-center rounded-2xl border border-primary py-3.5">
          <Ionicons name="call-outline" size={18} className="text-primary" />
          <Text className="ml-2 font-bold text-primary">Gọi điện</Text>
        </Pressable>
        <Pressable
          onPress={handleOpenMessages}
          disabled={openingChat || userId === listing.ownerId || !userId}
          className="flex-1 flex-row items-center justify-center rounded-2xl bg-brand py-3.5">
          <Ionicons name="chatbubble-outline" size={18} className="text-on-brand" />
          <Text className="ml-2 font-bold text-on-brand">
            {openingChat ? 'Đang mở...' : 'Nhắn tin'}
          </Text>
        </Pressable>
      </View>
      {chatError ? (
        <Text className="absolute bottom-20 left-5 right-5 rounded-xl bg-danger-soft px-3 py-2 text-center text-xs text-danger">
          {chatError}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
