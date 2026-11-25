// Port of the web listing detail logic: hs-web-app/lib/rent-detail-sections.ts,
// lib/listing-to-rent-property.ts (detail branch), lib/format-time-ago.ts and the pure parts of
// components/rent/RentDetailView.tsx. Kept free of React Native imports so tests/rent-detail.test.cjs
// can load it next to the web modules and compare outputs.
import type { ListingDetail } from '@/services/listingApi';
import { formatTimeAgo } from './listing-format';

export type RentDetailItem = { label: string; value: string };
export type RentDetailSection = { title: string; items: RentDetailItem[] };
export type RentCategory =
  'apartment' | 'house' | 'office' | 'commercial' | 'studio' | 'room' | 'villa';
export type RentMediaItem = { id?: string; type: 'image' | 'video'; url: string };
export type RentDetails = Record<string, unknown>;

export type RentProperty = {
  id: string;
  status: string;
  title: string;
  description?: string;
  location: string;
  district: string;
  ward: string;
  provinceCode?: string;
  provinceName: string;
  wardCode?: string;
  city: string;
  priceMillion: number;
  depositType?: string;
  depositAmount: number | null;
  depositMonths: number | null;
  beds: number;
  baths: number;
  areaM2: number;
  images: string[];
  videos: { id?: string; url: string }[];
  mediaItems: RentMediaItem[];
  isVerified: boolean;
  hasVideo: boolean;
  category: RentCategory;
  categoryLabel: string;
  timeAgo: string;
  photosCount: number;
  viewCount: number;
  ownerId?: string;
  details: RentDetails;
  landlord: {
    id?: string;
    name: string;
    avatar?: string;
    role: string;
    listingsCount: number;
    phone?: string;
  };
};

// ---------------------------------------------------------------- formatting

/** Same output as `Intl.NumberFormat('vi-VN').format(n)` without relying on Hermes Intl. */
export function formatNumberVi(value: number, maxFractionDigits = 3) {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value < 0 ? '-∞' : '∞';
  const [int, fraction = ''] = Math.abs(value).toFixed(maxFractionDigits).split('.');
  const trimmed = fraction.replace(/0+$/, '');
  const body = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (trimmed ? `,${trimmed}` : '');
  return value < 0 && /[1-9]/.test(int + trimmed) ? `-${body}` : body;
}

/** Same output as the web `formatPrice` (Intl vi-VN VND currency, no fraction digits): "14.000.000 ₫". */
export const formatPrice = (priceMillion: number) =>
  `${formatNumberVi(Math.round(priceMillion * 1_000_000), 0)} ₫`;

export function formatListingTimeAgo(...candidates: (string | null | undefined)[]) {
  const stamp = candidates.find((value) => typeof value === 'string' && value.trim());
  return stamp ? formatTimeAgo(stamp) : 'Vừa xong';
}

export function formatLocationLabel(value: string) {
  return value.replace(/^(thành phố|tỉnh|tp\.?|p\.?|phường|xã)\s*/i, '').trim();
}

export const VIEWING_DAY_LABELS: Record<string, string> = {
  MONDAY: 'Thứ 2',
  TUESDAY: 'Thứ 3',
  WEDNESDAY: 'Thứ 4',
  THURSDAY: 'Thứ 5',
  FRIDAY: 'Thứ 6',
  SATURDAY: 'Thứ 7',
  SUNDAY: 'Chủ nhật',
};

export const VIEWING_SLOT_LABELS: Record<string, string> = {
  MORNING: 'Buổi sáng (08:00–12:00)',
  AFTERNOON: 'Buổi chiều (13:00–17:00)',
  EVENING: 'Buổi tối (18:00–21:00)',
};

export const QUICK_SUGGESTIONS = [
  'Nhà này còn không?',
  'Thời hạn thuê tối thiểu?',
  'Giá thuê có thương lượng được không?',
  'Khi nào có thể xem nhà?',
];

// Port of the "Lối đi" branch of hs-web-app/lib/contract-property-feature-labels.ts.
const ACCESS_TYPE_LABELS: Record<string, string> = {
  PRIVATE: 'Riêng biệt',
  SHARED: 'Dùng chung',
  'ĐƯỜNG NỘI BỘ': 'Đường nội bộ',
  'HẺM XE HƠI': 'Hẻm xe hơi',
  'HẺM XE MÁY': 'Hẻm xe máy',
  'MẶT TIỀN': 'Mặt tiền',
};

function accessTypeLabel(raw: unknown) {
  const original = String(raw ?? '');
  const key = original.trim().toUpperCase();
  const known = Object.prototype.hasOwnProperty.call(ACCESS_TYPE_LABELS, key);
  return (known ? ACCESS_TYPE_LABELS[key] : original).replace(/m²/g, 'mét vuông');
}

// ------------------------------------------------------- listing -> property

const CATEGORY_MAP: Record<string, RentCategory> = {
  APARTMENT: 'apartment',
  HOUSE: 'house',
  ROOM: 'room',
};

const CATEGORY_LABELS: Record<string, string> = {
  apartment: 'Căn hộ chung cư',
  house: 'Nhà nguyên căn',
  room: 'Phòng trọ',
};

const num = (value: unknown) => (value != null ? Number(value) : null);

/** Detail branch of the web `toRentProperty`. Media urls are returned as-is (no web video proxy). */
export function toRentProperty(listing: ListingDetail): RentProperty {
  const { pricing } = listing;
  const details: RentDetails = {
    ...(listing.apartmentDetail ?? {}),
    ...(listing.houseDetail ?? {}),
    ...(listing.officeDetail ?? {}),
    ...(listing.commercialDetail ?? {}),
    ...(listing.roomDetail ?? {}),
    pricing,
    address: listing.address,
    charges: listing.charges ?? [],
    policies: listing.policies ?? [],
    amenities: (listing.amenities ?? []).map((a) => a.name || a.code),
    customAmenities: listing.customAmenities ?? [],
    furnishings: (listing.furnishings ?? []).map((f) =>
      f.quantity > 1 ? `${f.assetName} (x${f.quantity})` : f.assetName
    ),
    furnishingList: listing.furnishings ?? [],
    viewingDays: listing.viewingDays ?? [],
    viewingSlots: listing.viewingSlots ?? [],
    availableFrom: listing.availableFrom,
    depositType: pricing?.depositType,
    depositAmount: num(pricing?.depositAmount),
    depositMonths: num(pricing?.depositMonths),
    minimumLeaseMonths: pricing?.minimumLeaseMonths ?? 6,
  };

  const address = listing.address && 'display' in listing.address ? listing.address : undefined;
  const provinceName = address?.city ?? '';
  const wardName = address?.ward ?? '';
  const category = CATEGORY_MAP[listing.category] ?? 'room';
  const media = listing.media ?? [];
  const images = media
    .filter((m) => m.mediaType === 'IMAGE' && Boolean(m.url))
    .map((m) => m.url as string);
  const videos = media
    .filter((m) => m.mediaType === 'VIDEO' && Boolean(m.url))
    .map((m) => ({ id: m.id, url: m.url as string }));
  // Videos always go last, like the web gallery.
  const mediaItems: RentMediaItem[] = [
    ...images.map((url) => ({ type: 'image' as const, url })),
    ...videos.map((video) => ({ id: video.id, type: 'video' as const, url: video.url })),
  ];

  return {
    id: listing.id,
    status: listing.status,
    title: listing.title,
    description: listing.description ?? undefined,
    location:
      address?.display ??
      [address?.street ?? '', wardName, provinceName].filter(Boolean).join(', '),
    district: wardName,
    ward: wardName,
    provinceCode: address?.cityId,
    provinceName,
    wardCode: address?.wardId,
    city: provinceName,
    priceMillion: (pricing?.amount != null ? Number(pricing.amount) : 0) / 1_000_000,
    depositType: pricing?.depositType,
    depositAmount: num(pricing?.depositAmount),
    depositMonths: num(pricing?.depositMonths),
    beds: (listing.apartmentDetail?.bedroomCount ??
      listing.houseDetail?.bedroomCount ??
      0) as number,
    baths: (listing.apartmentDetail?.bathroomCount ??
      listing.houseDetail?.bathroomCount ??
      listing.officeDetail?.restroomCount ??
      listing.commercialDetail?.restroomCount ??
      0) as number,
    areaM2: Number(listing.areaM2 ?? 0),
    images,
    videos,
    mediaItems,
    isVerified: listing.status === 'PUBLISHED',
    hasVideo: videos.length > 0 || media.some((m) => m.mediaType === 'VIDEO'),
    category,
    categoryLabel: CATEGORY_LABELS[category] || 'Phòng trọ',
    timeAgo: formatListingTimeAgo(listing.updatedAt, listing.publishedAt, listing.createdAt),
    photosCount: images.length,
    viewCount: listing.viewCount ?? 0,
    ownerId: listing.ownerId,
    details,
    landlord: {
      id: listing.ownerId || listing.owner?.id,
      name: listing.owner?.displayName ?? 'Chủ nhà',
      role: 'Chính chủ',
      listingsCount: 1,
      phone: listing.owner?.phone || undefined,
      avatar: listing.owner?.avatarUrl || undefined,
    },
  };
}

// ------------------------------------------------------------- detail sections

const DIRECTION_LABELS: Record<string, string> = {
  EAST: 'Đông',
  WEST: 'Tây',
  SOUTH: 'Nam',
  NORTH: 'Bắc',
  SOUTH_EAST: 'Đông Nam',
  NORTH_EAST: 'Đông Bắc',
  SOUTH_WEST: 'Tây Nam',
  NORTH_WEST: 'Tây Bắc',
};

const FURNISHING_LABELS: Record<string, string> = {
  UNFURNISHED: 'Không nội thất (Bàn giao thô)',
  BASIC: 'Nội thất cơ bản',
  PARTIALLY_FURNISHED: 'Nội thất bán phần',
  FULLY_FURNISHED: 'Đầy đủ nội thất',
  LUXURY: 'Nội thất cao cấp',
};

const LEGAL_LABELS: Record<string, string> = {
  NONE: 'Chưa cập nhật',
  PINK_BOOK: 'Sổ hồng / Sổ đỏ',
  CONTRACT: 'Hợp đồng mua bán',
  PENDING: 'Đang chờ cấp sổ',
  OTHER: 'Giấy tờ hợp lệ khác',
};

const CHARGE_TYPE_LABELS: Record<string, string> = {
  ELECTRICITY: 'Tiền điện',
  WATER: 'Tiền nước',
  MANAGEMENT: 'Phí quản lý tòa nhà',
  INTERNET: 'Internet / Wifi',
  SERVICE_OR_GARBAGE: 'Phí dịch vụ & rác',
  MOTORBIKE_PARKING: 'Phí gửi xe máy',
  CAR_PARKING: 'Phí gửi ô tô',
  OVERTIME_AIR_CONDITIONING: 'Điều hòa ngoài giờ',
  OTHER: 'Chi phí khác',
};

const BILLING_METHOD_LABELS: Record<string, string> = {
  PER_KWH: 'đ/kWh',
  STATE_WATER_RATE: 'Theo giá nhà nước',
  PER_M3: 'đ/m³',
  PER_PERSON_MONTH: 'đ/người/tháng',
  PER_MONTH: 'đ/tháng',
  PER_M2_MONTH: 'đ/mét vuông/tháng',
  PER_VEHICLE_MONTH: 'đ/xe/tháng',
  PER_HOUR: 'đ/giờ',
  FREE: 'Miễn phí',
  INCLUDED: 'Đã gồm trong giá thuê',
  NOT_APPLICABLE: 'Không áp dụng',
  NEGOTIABLE: 'Thỏa thuận',
  CUSTOM: 'Theo thực tế',
};

const PAYMENT_CYCLE_LABELS: Record<string, string> = {
  MONTHLY: '1 tháng/lần (Hàng tháng)',
};

const DEPOSIT_TYPE_LABELS: Record<string, string> = {
  NONE: 'Không cần đặt cọc',
  FIXED_AMOUNT: 'Số tiền cố định',
  MONTH_COUNT: 'Theo số tháng thuê',
};

function detail(labelText: string, value: unknown, suffix = '', money = false): RentDetailItem {
  if (value === undefined || value === null || value === '') return { label: labelText, value: '' };
  if (money) return { label: labelText, value: `${formatNumberVi(Number(value))} VNĐ${suffix}` };
  return { label: labelText, value: `${value}${suffix}` };
}

function booleanLabel(value: unknown) {
  if (value === true) return 'Có';
  if (value === false) return 'Không';
  return '';
}

function label(value: unknown, labels: Record<string, string>) {
  return typeof value === 'string' ? (labels[value] ?? value) : '';
}

function clean(items: RentDetailItem[]) {
  return items.filter((item) => item.value && item.value.trim() !== '');
}

function categoryTitle(category: RentCategory) {
  return (
    {
      apartment: 'Thông tin chi tiết căn hộ',
      house: 'Thông tin nhà ở & kiến trúc',
      room: 'Thông tin phòng trọ & sinh hoạt',
      studio: 'Thông tin căn hộ studio',
      commercial: 'Thông tin mặt bằng kinh doanh',
      office: 'Thông số văn phòng & tòa nhà',
      villa: 'Thông tin biệt thự',
    }[category] || 'Thông số bất động sản'
  );
}

export function getRentDetailSections(
  property: Pick<RentProperty, 'category' | 'details'>
): RentDetailSection[] {
  const details = property.details ?? {};
  const pricing = (details.pricing as Record<string, unknown>) ?? {};
  const charges = Array.isArray(details.charges)
    ? (details.charges as Record<string, unknown>[])
    : [];

  const categoryItems: Record<string, RentDetailItem[]> = {
    apartment: [
      detail('Tên dự án / Chung cư', details.projectName),
      detail('Tòa nhà / Block', details.buildingBlock),
      detail('Mã căn hộ', details.unitCode),
      detail('Tầng số', details.floorNumber),
      detail('Tổng số tầng tòa nhà', details.buildingTotalFloors, ' tầng'),
      detail('Số phòng ngủ', details.bedroomCount, ' phòng'),
      detail('Số phòng vệ sinh', details.bathroomCount, ' phòng'),
      detail('Phòng khách', details.livingRoomCount, ' phòng'),
      detail('Phòng bếp', details.kitchenCount, ' phòng'),
      detail('Tình trạng nội thất', label(details.furnishingStatus, FURNISHING_LABELS)),
      detail('Hướng cửa chính', label(details.mainDoorDirection, DIRECTION_LABELS)),
      detail('Hướng ban công', label(details.balconyDirection, DIRECTION_LABELS)),
      detail('Tầm nhìn / View', details.viewDescription),
      detail('Số người ở tối đa', details.maxOccupants, ' người'),
      detail('Giấy tờ pháp lý', label(details.legalStatus, LEGAL_LABELS)),
    ],
    house: [
      detail('Diện tích đất', details.landAreaM2, ' mét vuông'),
      detail('Mặt tiền', details.frontageWidthM, ' m'),
      detail('Chiều dài', details.lengthM, ' m'),
      detail('Độ rộng đường/hẻm', details.accessRoadWidthM, ' m'),
      detail('Số mặt tiền', details.frontageCount, ' mặt tiền'),
      detail('Tổng số tầng', details.totalFloors, ' tầng'),
      detail('Số phòng ngủ', details.bedroomCount, ' phòng'),
      detail('Số phòng tắm / WC', details.bathroomCount, ' phòng'),
      detail('Phòng khách', details.livingRoomCount, ' phòng'),
      detail('Phòng bếp', details.kitchenCount, ' phòng'),
      detail('Sân thượng', booleanLabel(details.hasRooftop)),
      detail('Garage để xe', booleanLabel(details.hasGarage)),
      detail('Lối đi', accessTypeLabel(details.accessType)),
      detail('Tình trạng nội thất', label(details.furnishingStatus, FURNISHING_LABELS)),
      detail('Số người ở tối đa', details.maxOccupants, ' người'),
      detail('Số xe máy tối đa', details.maxVehicles, ' xe'),
      detail('Pháp lý', label(details.legalStatus, LEGAL_LABELS)),
      detail('Phạm vi cho thuê', details.rentalScopeDescription),
      detail(
        'Tầng cho thuê',
        details.rentedFloorFrom && details.rentedFloorTo
          ? `Từ tầng ${details.rentedFloorFrom} đến tầng ${details.rentedFloorTo}`
          : ''
      ),
    ],
    office: [
      detail('Tên tòa nhà', details.buildingName),
      detail(
        'Hạng văn phòng',
        label(details.officeGrade, {
          GRADE_A: 'Văn phòng Hạng A',
          GRADE_B: 'Văn phòng Hạng B',
          GRADE_C: 'Văn phòng Hạng C',
          ECONOMY: 'Văn phòng Tiết kiệm / Tư nhân',
        })
      ),
      detail('Tầng cho thuê', details.floorNumber),
      detail(
        'Tình trạng bàn giao',
        label(details.handoverStatus, {
          RAW: 'Bàn giao thô',
          BASIC: 'Hoàn thiện cơ bản',
          FULL: 'Đầy đủ nội thất',
        })
      ),
      detail('Số chỗ ngồi dự kiến', details.expectedSeats, ' chỗ'),
      detail('Diện tích chia nhỏ tối thiểu', details.minimumDivisibleAreaM2, ' mét vuông'),
      detail('Số phòng vệ sinh', details.restroomCount, ' phòng'),
      detail(
        'Hệ thống vệ sinh',
        label(details.restroomType, { PRIVATE: 'Riêng từng khu vực', SHARED: 'Dùng chung cả tầng' })
      ),
      detail(
        'Khu vực Pantry',
        label(details.pantryType, { PRIVATE: 'Riêng biệt', SHARED: 'Dùng chung', NONE: 'Không có' })
      ),
      detail('Chỗ gửi ô tô', details.carParkingCapacity, ' xe'),
      detail('Chỗ gửi xe máy', details.motorbikeParkingCapacity, ' xe'),
      detail(
        'Chế độ hoạt động',
        label(details.operatingMode, {
          ALWAYS_OPEN: 'Tự do 24/7',
          CUSTOM_SCHEDULE: 'Theo giờ quy định',
        })
      ),
    ],
    commercial: [
      detail(
        'Vị trí mặt bằng',
        label(details.positionType, {
          GROUND_FLOOR: 'Mặt đất / Tầng trệt',
          UPPER_FLOOR: 'Tầng lầu',
          SHOPPING_MALL: 'Trong trung tâm thương mại',
          OTHER: 'Khác',
        })
      ),
      detail('Chiều ngang mặt tiền', details.frontageWidthM, ' m'),
      detail('Chiều dài', details.lengthM, ' m'),
      detail('Độ rộng mặt đường', details.roadWidthM, ' m'),
      detail('Số mặt tiền', details.frontageCount, ' mặt tiền'),
      detail('Số tầng cho thuê', details.rentedFloorCount, ' tầng'),
      detail('Gác lửng', booleanLabel(details.hasMezzanine)),
      detail('Số phòng vệ sinh', details.restroomCount, ' phòng'),
      detail('Lối đi', label(details.accessType, { PRIVATE: 'Riêng biệt', SHARED: 'Chung' })),
      detail(
        'Chỗ để xe',
        label(details.parkingType, {
          NONE: 'Không có',
          MOTORBIKE: 'Xe máy',
          CAR: 'Ô tô',
          MOTORBIKE_AND_CAR: 'Cả xe máy & ô tô',
        })
      ),
      detail('Tình trạng bàn giao', details.handoverStatus),
      detail('Điện 3 pha', booleanLabel(details.hasThreePhasePower)),
      detail('PCCC tiêu chuẩn', booleanLabel(details.hasStandardFireSafety)),
      detail('Ngành nghề hạn chế', details.restrictedBusinesses),
      detail('Khu vực bốc xếp hàng', details.loadingAreaDescription),
      detail('Giờ hoạt động', details.operatingHoursDescription),
    ],
    room: [
      detail('Mã / Tên phòng', details.roomCode),
      detail('Tầng', details.floorNumber),
      detail(
        'Nhà vệ sinh',
        label(details.restroomType, {
          PRIVATE: 'Nhà vệ sinh riêng khép kín trong phòng',
          SHARED: 'Nhà vệ sinh chung ngoài phòng',
        })
      ),
      detail(
        'Khu bếp nấu ăn',
        label(details.kitchenType, {
          PRIVATE: 'Kệ bếp riêng trong phòng',
          SHARED: 'Khu bếp chung',
          NONE: 'Không nấu ăn / Không có bếp',
        })
      ),
      detail(
        'Cửa sổ phòng',
        details.hasWindow === true
          ? 'Có cửa sổ thông thoáng đón gió/sáng'
          : details.hasWindow === false
            ? 'Không có cửa sổ (Phòng kín máy lạnh)'
            : ''
      ),
      detail(
        'Ban công',
        label(
          details.balconyType ??
            (details.hasBalcony === true ? 'PRIVATE' : details.hasBalcony === false ? 'NONE' : ''),
          {
            PRIVATE: 'Ban công riêng phơi đồ / ngắm cảnh',
            SHARED: 'Ban công / sân phơi chung',
            NONE: 'Không có ban công',
          }
        )
      ),
      detail(
        'Gác lửng',
        details.hasMezzanine === true
          ? 'Có gác lửng cao ráo'
          : details.hasMezzanine === false
            ? 'Không có gác lửng'
            : ''
      ),
      detail('Nội thất phòng', label(details.furnishingStatus, FURNISHING_LABELS)),
      detail(
        'Lối đi',
        label(details.accessType, {
          PRIVATE: 'Lối đi riêng biệt (Tự do ra vào)',
          SHARED: 'Lối đi chung với chủ nhà',
        })
      ),
      detail(
        'Giờ giấc sinh hoạt',
        label(details.accessHoursType, {
          FLEXIBLE: 'Tự do 24/7 (Khóa vân tay / Thẻ từ)',
          CURFEW: 'Có giờ đóng cửa buổi tối',
        })
      ),
      detail(
        'Đồng hồ điện',
        label(details.electricMeterType, {
          PRIVATE: 'Đồng hồ điện riêng từng phòng',
          SHARED: 'Dùng chung đồng hồ tổng',
        })
      ),
      detail(
        'Đồng hồ nước',
        label(details.waterMeterType, {
          PRIVATE: 'Đồng hồ nước riêng từng phòng',
          SHARED: 'Dùng chung / Tính theo đầu người',
        })
      ),
      detail('Số người ở tối đa', details.maxOccupants, ' người'),
      detail('Số xe tối đa', details.maxVehicles, ' xe'),
      detail(
        'Chính sách gửi xe',
        label(details.parkingPolicy, {
          FREE: 'Miễn phí chỗ để xe trong nhà / hầm xe',
          PAID: 'Có thu phí gửi xe hàng tháng',
          NONE: 'Không có chỗ để xe (Gửi bãi ngoài)',
        })
      ),
    ],
  };

  const sections: RentDetailSection[] = [];

  const cleanedCatItems = clean(categoryItems[property.category] || []);
  if (cleanedCatItems.length > 0) {
    sections.push({ title: categoryTitle(property.category), items: cleanedCatItems });
  }

  if (charges.length > 0) {
    const chargeItems: RentDetailItem[] = charges
      // Management fee only applies to apartments.
      .filter((c) => !(c.chargeType === 'MANAGEMENT' && property.category !== 'apartment'))
      .map((c) => {
        const typeLabel =
          c.customName || CHARGE_TYPE_LABELS[String(c.chargeType)] || String(c.chargeType);
        if (c.includedInRent) {
          return { label: String(typeLabel), value: 'Đã bao gồm trong giá thuê' };
        }
        const method = BILLING_METHOD_LABELS[String(c.billingMethod)] || String(c.billingMethod);
        if (c.amount != null) {
          return {
            label: String(typeLabel),
            value: `${formatNumberVi(Number(c.amount))} ${method}`,
          };
        }
        return { label: String(typeLabel), value: method };
      });
    sections.push({ title: 'Bảng chi phí hàng tháng', items: clean(chargeItems) });
  }

  const leaseItems: RentDetailItem[] = [
    detail('Hình thức đặt cọc', label(pricing.depositType, DEPOSIT_TYPE_LABELS)),
    detail(
      'Tiền cọc',
      pricing.depositAmount ? pricing.depositAmount : details.depositAmount,
      '',
      true
    ),
    detail('Số tháng đặt cọc', pricing.depositMonths ? `${pricing.depositMonths} tháng` : ''),
    detail('Chu kỳ thanh toán', label(pricing.paymentCycle, PAYMENT_CYCLE_LABELS)),
    detail('Thời hạn thuê tối thiểu', pricing.minimumLeaseMonths, ' tháng'),
    detail(
      'Thương lượng',
      (() => {
        const negotiable = pricing.negotiable ?? details.negotiable;
        if (negotiable === true) return 'Có thể thương lượng';
        if (negotiable === false) return 'Không thương lượng';
        return '';
      })()
    ),
    detail(
      'Phí quản lý tòa nhà',
      property.category === 'apartment' &&
        (pricing.managementFeeIncluded === true ||
          charges.some(
            (c) =>
              c.chargeType === 'MANAGEMENT' && (c.includedInRent || c.billingMethod === 'INCLUDED')
          ))
        ? 'Đã bao gồm trong tiền thuê'
        : ''
    ),
    detail('Ngày có thể dọn vào', details.availableFrom),
  ];
  const cleanedLease = clean(leaseItems);
  if (cleanedLease.length > 0) {
    sections.push({ title: 'Giá & Điều kiện thuê', items: cleanedLease });
  }

  return sections;
}

// ------------------------------------------- RentDetailView presentation logic

export type RentMetric = {
  icon: 'area' | 'bed' | 'building' | 'users' | 'bath';
  label: string;
  value: string;
};

export function getQuickMetrics(property: RentProperty): RentMetric[] {
  const d = property.details;
  let second: RentMetric;
  if (['apartment', 'house', 'villa'].includes(property.category)) {
    second = { icon: 'bed', label: 'Phòng ngủ', value: `${property.beds} PN` };
  } else if (property.category === 'office' && d.expectedSeats != null) {
    second = { icon: 'building', label: 'Chỗ ngồi', value: `${d.expectedSeats} chỗ` };
  } else if (property.category === 'commercial' && d.frontageWidthM != null) {
    second = { icon: 'building', label: 'Mặt tiền', value: `${d.frontageWidthM} m` };
  } else if (property.category === 'room' && d.maxOccupants != null) {
    second = { icon: 'users', label: 'Tối đa', value: `${d.maxOccupants} người` };
  } else {
    second = { icon: 'building', label: 'Loại hình', value: property.categoryLabel };
  }
  return [
    { icon: 'area', label: 'Diện tích', value: `${property.areaM2} m²` },
    second,
    {
      icon: 'bath',
      label: 'Phòng tắm / WC',
      value: `${
        property.baths ||
        (d.bathroomCount as number) ||
        (d.restroomCount as number) ||
        (d.restroomType === 'PRIVATE' ? 'Khép kín' : d.restroomType === 'SHARED' ? 'Chung' : 1)
      } WC`,
    },
  ];
}

export type FurnishingRow = {
  index?: number;
  assetName?: string;
  quantity?: number;
  handoverCondition?: string;
  conditionText?: string;
  conditionNote?: string;
};

export type FurnishingView =
  | { kind: 'table'; rows: FurnishingRow[] }
  | { kind: 'chips'; items: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'none' };

const strings = (value: unknown) =>
  (Array.isArray(value) ? value : []).filter((item): item is string => typeof item === 'string');

export function getRentDetailExtras(property: RentProperty) {
  const d = property.details;
  const pricing = (d.pricing as Record<string, unknown> | undefined) ?? undefined;
  const status = property.status;
  const rows = (
    Array.isArray(d.furnishingList) ? (d.furnishingList as FurnishingRow[]) : []
  ).filter((item) => Boolean(item && item.assetName));
  const roomFeatures = strings(Array.isArray(d.furnishings) ? d.furnishings : d.roomFeatures);
  let furnishing: FurnishingView;
  if (rows.length > 0) furnishing = { kind: 'table', rows };
  else if (roomFeatures.length > 0) furnishing = { kind: 'chips', items: roomFeatures };
  else if (['house', 'apartment', 'room'].includes(property.category))
    furnishing = {
      kind: 'note',
      text:
        d.furnishingStatus === 'UNFURNISHED'
          ? 'Không có nội thất bàn giao kèm theo. Bài đăng được chủ nhà khai báo là không nội thất.'
          : 'Chủ nhà chưa cung cấp danh sách nội thất bàn giao. Vui lòng xác nhận khi xem nhà.',
    };
  else furnishing = { kind: 'none' };

  return {
    isNegotiable: Boolean(pricing?.negotiable ?? d.negotiable),
    acceptsNewRequests: status === 'PUBLISHED',
    publicListing: status === 'PUBLISHED' || status === 'RESERVED',
    amenities: [...strings(d.amenities), ...strings(d.customAmenities)],
    furnishing,
    viewingDays: strings(d.viewingDays),
    viewingSlots: strings(d.viewingSlots),
    highlights: property.photosCount > 0 ? [`${property.photosCount} ảnh thực tế`] : [],
  };
}

export type ChatListing = {
  id: string;
  title: string;
  price: string;
  location: string;
  image: string;
  bedrooms: number;
  area: number;
  verified: boolean;
};

/** Same payload as the web `chatListing` (image is passed in so the screen can apply its fallback). */
export function toChatListing(property: RentProperty, image: string): ChatListing {
  return {
    id: property.id,
    title: property.title,
    price: formatPrice(property.priceMillion),
    location: property.location,
    image,
    bedrooms: property.beds,
    area: property.areaM2,
    verified: property.isVerified,
  };
}
