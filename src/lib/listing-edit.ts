import type { ListingDetail } from '@/services/listingApi';
import type { ListingCategory } from '@/lib/listing-draft';

const str = (value: unknown) => (value == null ? '' : String(value));
const yesNo = (value: unknown) => (value == null ? '' : value ? 'Có' : 'Không');
const shared = (value: unknown) =>
  value == null ? '' : value === 'SHARED' ? 'Dùng chung' : 'Riêng';
const furnishing = (value: unknown) =>
  (
    ({
      UNFURNISHED: 'Bàn giao thô',
      BASIC: 'Cơ bản',
      PARTIALLY_FURNISHED: 'Một phần',
      FULLY_FURNISHED: 'Đầy đủ',
      LUXURY: 'Cao cấp',
    }) as Record<string, string>
  )[str(value)] ?? 'Bàn giao thô';

export function mapListingForEdit(listing: ListingDetail) {
  if (!['APARTMENT', 'HOUSE', 'ROOM'].includes(listing.category))
    throw new Error('Loại tin này chưa có biểu mẫu chỉnh sửa trên mobile.');
  const category = listing.category.toLowerCase() as ListingCategory;
  const apartment = listing.apartmentDetail ?? {};
  const house = listing.houseDetail ?? {};
  const room = listing.roomDetail ?? {};
  const details: Record<string, string> =
    category === 'apartment'
      ? {
          projectName: str(apartment.projectName),
          areaM2: str(listing.areaM2),
          floor: str(apartment.floorNumber),
          bedrooms: str(apartment.bedroomCount),
          bathrooms: str(apartment.bathroomCount),
          furnishing: furnishing(apartment.furnishingStatus),
          buildingBlock: str(apartment.buildingBlock),
          unitNumber: str(apartment.unitCode),
          livingRooms: str(apartment.livingRoomCount),
          kitchens: str(apartment.kitchenCount),
          totalFloors: str(apartment.buildingTotalFloors),
          doorOrientation: str(apartment.mainDoorDirection),
          balconyOrientation: str(apartment.balconyDirection),
          view: str(apartment.viewDescription),
          maxOccupants: str(apartment.maxOccupants),
          legalStatus: str(apartment.legalStatus),
        }
      : category === 'house'
        ? {
            totalUsableAreaM2: str(listing.areaM2),
            totalFloors: str(house.totalFloors),
            bedrooms: str(house.bedroomCount),
            bathrooms: str(house.bathroomCount),
            furnishing: furnishing(house.furnishingStatus),
            landAreaM2: str(house.landAreaM2),
            facadeWidthM: str(house.frontageWidthM),
            lengthM: str(house.lengthM),
            streetWidthM: str(house.accessRoadWidthM),
            frontageCount: str(house.frontageCount),
            livingRooms: str(house.livingRoomCount),
            kitchens: str(house.kitchenCount),
            hasRooftopTerrace: yesNo(house.hasRooftop),
            privateEntrance:
              house.accessType == null ? '' : house.accessType === 'PRIVATE' ? 'Có' : 'Không',
            hasGarage: yesNo(house.hasGarage),
            maxOccupants: str(house.maxOccupants),
            maxVehicles: str(house.maxVehicles),
            legalStatus: str(house.legalStatus),
          }
        : {
            roomCode: str(room.roomCode),
            areaM2: str(listing.areaM2),
            maxOccupants: str(room.maxOccupants),
            toiletType: shared(room.restroomType),
            kitchenType: room.kitchenType === 'NONE' ? 'Không có' : shared(room.kitchenType),
            furnishing: furnishing(room.furnishingStatus),
            roomFloor: str(room.floorNumber),
            hasWindow: yesNo(room.hasWindow),
            hasBalcony: room.balconyType === 'NONE' ? 'Không có' : shared(room.balconyType),
            hasLoft: yesNo(room.hasMezzanine),
            entranceType: shared(room.accessType),
            curfewType:
              room.accessHoursType == null
                ? ''
                : room.accessHoursType === 'CURFEW'
                  ? 'Có giờ đóng cửa'
                  : 'Tự do',
            electricityMeter: shared(room.electricMeterType),
            waterMeter: shared(room.waterMeterType),
            maxVehicles: str(room.maxVehicles),
            parkingPolicy:
              room.parkingPolicy === 'PAID'
                ? 'Có phí'
                : room.parkingPolicy === 'FREE'
                  ? 'Miễn phí'
                  : room.parkingPolicy === 'NONE'
                    ? 'Không có'
                    : '',
          };
  const pricing: Record<string, string> = {
    priceMonthly: str(listing.pricing.amount),
    priceUnit:
      listing.pricing.unit === 'ROOM_MONTH'
        ? 'VNĐ / phòng / tháng'
        : listing.pricing.unit === 'PERSON_MONTH'
          ? 'VNĐ / người / tháng'
          : 'VNĐ / tháng',
    negotiable: listing.pricing.negotiable ? 'Có' : 'Không',
    depositType:
      listing.pricing.depositType === 'FIXED_AMOUNT'
        ? 'Số tiền'
        : listing.pricing.depositType === 'MONTH_COUNT'
          ? 'Số tháng'
          : 'Không cọc',
    depositValue: str(
      listing.pricing.depositType === 'MONTH_COUNT'
        ? listing.pricing.depositMonths
        : listing.pricing.depositAmount
    ),
    paymentCycle: 'Hằng tháng',
    minimumLeaseMonths: str(listing.pricing.minimumLeaseMonths),
  };
  const methods: Record<string, Record<string, string>> = {
    ELECTRICITY: { PER_KWH: 'Theo kWh', INCLUDED: 'Đã bao gồm' },
    WATER: {
      PER_M3: 'Theo m³',
      PER_PERSON_MONTH: 'Theo người',
      PER_MONTH: 'Theo phòng',
      INCLUDED: 'Đã bao gồm',
    },
    MANAGEMENT: {
      PER_MONTH: 'Theo tháng',
      PER_M2_MONTH: 'Theo m²',
      INCLUDED: 'Đã bao gồm',
      NOT_APPLICABLE: 'Không có',
    },
    INTERNET: { PER_MONTH: 'Theo tháng', INCLUDED: 'Đã bao gồm', NOT_APPLICABLE: 'Tự trả' },
    SERVICE_OR_GARBAGE: {
      PER_MONTH: 'Theo tháng',
      INCLUDED: 'Đã bao gồm',
      NOT_APPLICABLE: 'Không có',
    },
    MOTORBIKE_PARKING: {
      PER_VEHICLE_MONTH: 'Theo xe',
      INCLUDED: 'Đã bao gồm',
      NOT_APPLICABLE: 'Không có',
    },
    CAR_PARKING: {
      PER_VEHICLE_MONTH: 'Theo xe',
      INCLUDED: 'Đã bao gồm',
      NOT_APPLICABLE: 'Không có',
    },
  };
  const keys: Record<string, string> = {
    ELECTRICITY: 'electricity',
    WATER: 'water',
    MANAGEMENT: 'management',
    INTERNET: 'internet',
    SERVICE_OR_GARBAGE: 'garbage',
    MOTORBIKE_PARKING: 'motorbike',
    CAR_PARKING: 'car',
  };
  for (const charge of listing.charges ?? []) {
    const key = keys[charge.chargeType];
    if (!key) continue;
    pricing[`${key}Type`] = methods[charge.chargeType]?.[charge.billingMethod] ?? '';
    pricing[`${key}Price`] = str(charge.amount);
  }
  const media = [...(listing.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  if (media.some((item) => !item.storageObjectId))
    throw new Error(
      'Tin đăng có tệp chưa xác định. Vui lòng cập nhật media trên web trước khi sửa.'
    );
  const picked = (kind: string) =>
    media
      .filter((item) => item.mediaType === kind)
      .map((item) => ({
        uri: item.url ?? '',
        name: item.id,
        mimeType: item.contentType ?? (kind === 'IMAGE' ? 'image/jpeg' : 'video/mp4'),
        sizeBytes: item.sizeBytes ?? 0,
        storageObjectId: item.storageObjectId!,
      }));
  return {
    category,
    basic: {
      title: listing.title,
      branchId: listing.branchId ?? '',
      availableDate: listing.availableFrom,
    },
    location: {
      refId: listing.address?.refId ?? '',
      display: listing.address?.display ?? listing.address?.fullAddress ?? '',
      note: listing.address?.addressNote ?? '',
    },
    details,
    images: picked('IMAGE'),
    videos: picked('VIDEO'),
    amenities: [
      ...(listing.amenities ?? []).map((item) => item.code),
      ...(listing.customAmenities ?? []),
    ],
    assets: (listing.furnishings ?? []).map((item) => ({
      name: item.assetName,
      quantity: str(item.quantity),
      condition:
        item.handoverCondition === 'BRAND_NEW'
          ? 'Mới'
          : item.handoverCondition === 'USED_ACCEPTABLE'
            ? 'Đã sử dụng'
            : 'Tốt',
      itemCode: item.itemCode,
      conditionNote: item.conditionNote,
    })),
    pricing,
    customFees: (listing.charges ?? [])
      .filter((item) => item.chargeType === 'OTHER')
      .map((item) => ({
        name: item.customName ?? '',
        amount: str(item.amount),
        unit: item.unit ?? 'tháng',
      })),
    days: listing.viewingDays ?? [],
    slots: listing.viewingSlots ?? [],
    description: listing.description,
    policyValues: Object.fromEntries(
      (listing.policies ?? []).map((item) => [item.code, item.value])
    ),
  };
}
