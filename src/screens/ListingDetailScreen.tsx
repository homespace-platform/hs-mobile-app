import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { createConversation, type RelatedListing } from '@/services/chatApi';
import { getPublicListing, listingImage, type ListingDetail } from '@/services/listingApi';

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
    <View className="w-[48%] rounded-2xl bg-slate-50 p-3">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="mt-1 text-sm font-bold text-slate-900">{value}</Text>
    </View>
  );
}

export default function ListingDetailScreen({
  listingId,
  onBack,
  onOpenMessages,
}: {
  listingId: string;
  onBack: () => void;
  onOpenMessages: (conversationId: string) => void;
}) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setListing(await getPublicListing(listingId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được bài đăng');
    } finally {
      setLoading(false);
    }
  }, [listingId]);

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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#2563eb" />
        <Text className="mt-3 text-sm text-slate-500">Đang tải thông tin nhà...</Text>
      </SafeAreaView>
    );
  }

  if (!listing || error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-center text-base font-semibold text-slate-800">
          Không thể mở bài đăng
        </Text>
        <Pressable onPress={load} className="mt-4 rounded-xl bg-blue-600 px-5 py-3">
          <Text className="font-semibold text-white">Thử lại</Text>
        </Pressable>
        <Pressable onPress={onBack} className="mt-3 px-5 py-3">
          <Text className="font-semibold text-slate-500">Quay lại</Text>
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
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="absolute left-0 right-0 top-12 z-10 flex-row justify-between px-4">
        <Pressable
          onPress={onBack}
          className="h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow">
          <Ionicons name="chevron-back" size={25} color="#0f172a" />
        </Pressable>
        <Pressable
          onPress={() => setFavorite((value) => !value)}
          className="h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow">
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={24}
            color={favorite ? '#ef4444' : '#334155'}
          />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-28">
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {(images.length ? images : [listingImage(null)]).map((url, index) => (
            <Image
              key={`${url}-${index}`}
              source={{ uri: url }}
              className="h-72 w-screen bg-slate-100"
            />
          ))}
        </ScrollView>

        <View className="px-5 py-5">
          <View className="flex-row items-center justify-between">
            <Text className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {listing.category.replace(/_/g, ' ')}
            </Text>
            <View className="flex-row items-center">
              <Ionicons name="eye-outline" size={15} color="#64748b" />
              <Text className="ml-1 text-xs text-slate-500">{listing.viewCount ?? 0} lượt xem</Text>
            </View>
          </View>
          <Text className="mt-3 text-2xl font-bold leading-8 text-slate-900">{listing.title}</Text>
          <View className="mt-2 flex-row items-start">
            <Ionicons name="location-outline" size={17} color="#64748b" />
            <Text className="ml-1 flex-1 text-sm leading-5 text-slate-500">
              {listing.address?.fullAddress || 'Đang cập nhật địa chỉ'}
            </Text>
          </View>
          <Text className="mt-4 text-2xl font-extrabold text-blue-700">
            {formatMoney(listing.pricing.amount)}/tháng
          </Text>
          {listing.pricing.negotiable ? (
            <Text className="mt-1 text-xs font-semibold text-emerald-600">Có thể thương lượng</Text>
          ) : null}

          <View className="mt-5 flex-row flex-wrap justify-between gap-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
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
              <Text className="text-lg font-bold text-slate-900">Thông tin chi tiết</Text>
              <View className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {categoryDetails.map(([key, value], index) => (
                  <View
                    key={key}
                    className={`flex-row justify-between px-4 py-3 ${index ? 'border-t border-slate-100' : ''}`}>
                    <Text className="text-sm text-slate-500">{LABELS[key]}</Text>
                    <Text className="max-w-[55%] text-right text-sm font-semibold text-slate-800">
                      {formatValue(value)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="mt-7">
            <Text className="text-lg font-bold text-slate-900">Điều khoản thuê</Text>
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
              <Text className="text-lg font-bold text-slate-900">Tiện ích</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {[...listing.amenities.map((item) => item.name), ...listing.customAmenities].map(
                  (item) => (
                    <View
                      key={item}
                      className="flex-row items-center rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                      <Ionicons name="checkmark-circle" size={14} color="#1d4ed8" />
                      <Text className="ml-1 text-xs font-semibold text-blue-700">{item}</Text>
                    </View>
                  )
                )}
              </View>
            </View>
          ) : null}

          {listing.charges.length ? (
            <View className="mt-7">
              <Text className="text-lg font-bold text-slate-900">Chi phí khác</Text>
              <View className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                {listing.charges.map((charge, index) => (
                  <View
                    key={`${charge.chargeType}-${index}`}
                    className={`flex-row justify-between px-4 py-3 ${index ? 'border-t border-slate-100' : ''}`}>
                    <Text className="text-sm text-slate-500">
                      {charge.customName || CHARGE_LABELS[charge.chargeType] || charge.chargeType}
                    </Text>
                    <Text className="text-sm font-semibold text-slate-800">
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
            <View className="mt-7 rounded-2xl bg-emerald-50 p-4">
              <Text className="text-lg font-bold text-slate-900">Lịch xem nhà</Text>
              <Text className="mt-2 text-sm text-slate-600">
                {(listing.viewingDays ?? []).map((day) => DAY_LABELS[day] ?? day).join(', ')}
              </Text>
              <Text className="mt-1 text-sm font-semibold text-emerald-700">
                {(listing.viewingSlots ?? []).map((slot) => SLOT_LABELS[slot] ?? slot).join(' · ')}
              </Text>
            </View>
          ) : null}

          <View className="mt-7">
            <Text className="text-lg font-bold text-slate-900">Mô tả chi tiết</Text>
            <Text className="mt-3 text-sm leading-6 text-slate-600">
              {listing.description || 'Chủ nhà chưa thêm mô tả.'}
            </Text>
          </View>

          <View className="mt-7 flex-row items-center rounded-2xl border border-slate-200 p-4">
            <Avatar
              uri={listing.owner?.avatarUrl}
              name={listing.owner?.displayName || 'HomeSpace'}
              size={48}
            />
            <View className="ml-3 flex-1">
              <Text className="text-xs text-slate-500">Chủ nhà</Text>
              <Text className="mt-0.5 font-bold text-slate-900">
                {listing.owner?.displayName || 'Người đăng tin'}
              </Text>
              <View className="mt-0.5 flex-row items-center">
                <Ionicons name="checkmark-circle" size={13} color="#059669" />
                <Text className="ml-1 text-xs text-emerald-600">Tài khoản đã xác thực</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-slate-200 bg-white px-5 pb-5 pt-3">
        <Pressable
          onPress={() => listing.owner?.phone && Linking.openURL(`tel:${listing.owner.phone}`)}
          className="flex-1 flex-row items-center justify-center rounded-2xl border border-blue-600 py-3.5">
          <Ionicons name="call-outline" size={18} color="#1d4ed8" />
          <Text className="ml-2 font-bold text-blue-700">Gọi điện</Text>
        </Pressable>
        <Pressable
          onPress={handleOpenMessages}
          disabled={openingChat}
          className="flex-1 flex-row items-center justify-center rounded-2xl bg-blue-600 py-3.5">
          <Ionicons name="chatbubble-outline" size={18} color="white" />
          <Text className="ml-2 font-bold text-white">
            {openingChat ? 'Đang mở...' : 'Nhắn tin'}
          </Text>
        </Pressable>
      </View>
      {chatError ? (
        <Text className="absolute bottom-20 left-5 right-5 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
          {chatError}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
