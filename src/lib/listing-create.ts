import { DETAIL_FIELDS, type ListingCategory } from '@/lib/listing-draft';
import type { ListingCatalog, ListingSubmissionAction } from '@/services/listingCreateApi';

export type ListingMedia = {
  storageObjectId: string;
  mediaType: 'IMAGE' | 'VIDEO';
};
export type ListingForm = {
  category: ListingCategory;
  title: string;
  branchId: string;
  availableDate: string;
  addressRefId: string;
  addressNote: string;
  details: Record<string, string>;
  amenities: string[];
  assets: { name: string; quantity: string; condition: string }[];
  pricing: Record<string, string>;
  customFees: { name: string; amount: string; unit: string }[];
  days: string[];
  slots: string[];
  description: string;
  policyValues: Record<string, string>;
  catalog: ListingCatalog | null;
  media: ListingMedia[];
};

const number = (value?: string) => Number(value || 0);
const optionalNumber = (value?: string) => (value?.trim() ? Number(value) : null);
const yes = (value?: string) => value === 'Có';
const furnishing = (value?: string) =>
  ({
    'Bàn giao thô': 'UNFURNISHED',
    'Cơ bản': 'BASIC',
    'Một phần': 'PARTIALLY_FURNISHED',
    'Đầy đủ': 'FULLY_FURNISHED',
    'Cao cấp': 'LUXURY',
  })[value || ''] || 'UNFURNISHED';
const condition = (value: string) =>
  ({
    Mới: 'BRAND_NEW',
    Tốt: 'GOOD',
    'Đã sử dụng': 'USED_ACCEPTABLE',
  })[value] || 'GOOD';

export function buildListingPayload(form: ListingForm, action: ListingSubmissionAction) {
  const d = form.details;
  const p = form.pricing;
  if (form.title.trim().length < 15) throw new Error('Tiêu đề cần ít nhất 15 ký tự.');
  if (form.description.trim().length < 30) throw new Error('Mô tả cần ít nhất 30 ký tự.');
  if (!form.branchId && !form.addressRefId) throw new Error('Vui lòng chọn địa chỉ từ Vietmap.');
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!form.availableDate || form.availableDate < todayKey)
    throw new Error('Ngày có thể vào ở không được ở trong quá khứ.');
  if (!form.media.some((item) => item.mediaType === 'IMAGE'))
    throw new Error('Cần ít nhất một ảnh.');
  if (!(number(p.priceMonthly) > 0)) throw new Error('Vui lòng nhập giá thuê hợp lệ.');
  if (!(number(p.minimumLeaseMonths) >= 1))
    throw new Error('Vui lòng nhập thời hạn thuê tối thiểu.');
  if (p.depositType !== 'Không cọc' && !(number(p.depositValue) > 0))
    throw new Error('Vui lòng nhập tiền cọc hợp lệ.');
  if (!form.days.length || !form.slots.length) throw new Error('Vui lòng chọn lịch xem nhà.');
  const areaM2 = number(form.category === 'house' ? d.totalUsableAreaM2 : d.areaM2);
  if (!(areaM2 > 0)) throw new Error('Vui lòng nhập diện tích hợp lệ.');
  if (form.category === 'apartment' && (!d.projectName?.trim() || !d.floor?.trim()))
    throw new Error('Vui lòng nhập dự án và tầng căn hộ.');
  if (form.category === 'house' && !(number(d.totalFloors) > 0))
    throw new Error('Vui lòng nhập tổng số tầng.');
  if (form.category === 'room' && (!d.roomCode?.trim() || !(number(d.maxOccupants) > 0)))
    throw new Error('Vui lòng nhập mã phòng và số người ở tối đa.');
  if (!d.furnishing || (form.category === 'room' && !d.toiletType))
    throw new Error('Vui lòng chọn tình trạng nội thất và thông tin nhà vệ sinh.');
  for (const field of [
    ...DETAIL_FIELDS[form.category].main,
    ...DETAIL_FIELDS[form.category].more,
  ]) {
    const value = d[field.key];
    if (field.number && value?.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))
      throw new Error(`${field.label}: vui lòng nhập số hợp lệ.`);
  }
  if (furnishing(d.furnishing) !== 'UNFURNISHED' && !form.assets.length)
    throw new Error('Vui lòng kê khai trang thiết bị bàn giao.');
  for (const asset of form.assets) {
    if (!asset.name.trim() || !(number(asset.quantity) >= 1) || number(asset.quantity) > 999)
      throw new Error('Vui lòng kiểm tra tên và số lượng trang thiết bị.');
  }
  const policies = (form.catalog?.policies ?? [])
    .filter((definition) => form.policyValues[definition.code]?.trim())
    .map((definition) => ({
      code: definition.code,
      value: form.policyValues[definition.code].trim(),
      note: '',
    }));
  if (action === 'SUBMIT_FOR_REVIEW') {
    if (!form.catalog?.policies?.length)
      throw new Error('Chưa tải được danh mục chính sách. Vui lòng thử lại.');
    const missing = form.catalog.policies.find(
      (definition) => definition.required && !form.policyValues[definition.code]?.trim()
    );
    if (missing) throw new Error(`Cần nhập chính sách: ${missing.label}.`);
  }
  for (const definition of form.catalog?.policies ?? []) {
    const value = form.policyValues[definition.code];
    if (!value?.trim()) continue;
    if (
      definition.valueType === 'INTEGER' &&
      (!Number.isInteger(Number(value)) ||
        (definition.minimumValue != null && Number(value) < definition.minimumValue) ||
        (definition.maximumValue != null && Number(value) > definition.maximumValue))
    )
      throw new Error(`${definition.label}: nhập số trong khoảng cho phép.`);
  }
  const charges: Record<string, unknown>[] = [];
  if (!form.branchId) {
    const feeFields = [
      ['electricity', 'ELECTRICITY', { 'Theo kWh': 'PER_KWH', 'Đã bao gồm': 'INCLUDED' }],
      [
        'water',
        'WATER',
        {
          'Theo m³': 'PER_M3',
          'Theo người': 'PER_PERSON_MONTH',
          'Theo phòng': 'PER_MONTH',
          'Đã bao gồm': 'INCLUDED',
        },
      ],
      [
        'management',
        'MANAGEMENT',
        {
          'Theo tháng': 'PER_MONTH',
          'Theo m²': 'PER_M2_MONTH',
          'Đã bao gồm': 'INCLUDED',
          'Không có': 'NOT_APPLICABLE',
        },
      ],
      [
        'internet',
        'INTERNET',
        { 'Theo tháng': 'PER_MONTH', 'Đã bao gồm': 'INCLUDED', 'Tự trả': 'NOT_APPLICABLE' },
      ],
      [
        'garbage',
        'SERVICE_OR_GARBAGE',
        { 'Theo tháng': 'PER_MONTH', 'Đã bao gồm': 'INCLUDED', 'Không có': 'NOT_APPLICABLE' },
      ],
      [
        'motorbike',
        'MOTORBIKE_PARKING',
        { 'Theo xe': 'PER_VEHICLE_MONTH', 'Đã bao gồm': 'INCLUDED', 'Không có': 'NOT_APPLICABLE' },
      ],
      [
        'car',
        'CAR_PARKING',
        { 'Theo xe': 'PER_VEHICLE_MONTH', 'Đã bao gồm': 'INCLUDED', 'Không có': 'NOT_APPLICABLE' },
      ],
    ] as const;
    for (const [key, chargeType, methods] of feeFields) {
      if (key === 'management' && form.category !== 'apartment') continue;
      const selected = p[`${key}Type`];
      if (!selected) {
        if (key === 'electricity' || key === 'water')
          throw new Error(
            `Vui lòng chọn cách tính ${key === 'electricity' ? 'tiền điện' : 'tiền nước'}.`
          );
        continue;
      }
      const billingMethod = (methods as Record<string, string>)[selected];
      if (!billingMethod) throw new Error(`Cách tính ${chargeType} không hợp lệ.`);
      const paid = !['INCLUDED', 'NOT_APPLICABLE'].includes(billingMethod);
      const amount = paid ? number(p[`${key}Price`]) : null;
      if (paid && !(amount! > 0)) throw new Error(`Vui lòng nhập đơn giá ${chargeType}.`);
      charges.push({
        chargeType,
        billingMethod,
        amount,
        currency: 'VND',
        unit:
          billingMethod === 'PER_KWH'
            ? 'kWh'
            : billingMethod === 'PER_M3'
              ? 'm³'
              : billingMethod === 'PER_PERSON_MONTH'
                ? 'người/tháng'
                : billingMethod === 'PER_M2_MONTH'
                  ? 'm²/tháng'
                  : billingMethod === 'PER_VEHICLE_MONTH'
                    ? 'xe/tháng'
                    : 'phòng/tháng',
        includedInRent: billingMethod === 'INCLUDED',
        sortOrder: charges.length + 1,
      });
    }
    form.customFees.forEach((fee, index) => {
      if (!fee.name.trim() || !(number(fee.amount) > 0))
        throw new Error(`Kiểm tra khoản phí khác ${index + 1}.`);
      charges.push({
        chargeType: 'OTHER',
        billingMethod: 'PER_MONTH',
        amount: number(fee.amount),
        currency: 'VND',
        unit: fee.unit.trim() || 'tháng',
        customName: fee.name.trim(),
        includedInRent: false,
        sortOrder: charges.length + 1,
      });
    });
  }
  const catalogCodes = new Set(form.catalog?.amenities.map((item) => item.code) ?? []);
  const category = form.category.toUpperCase();
  const detail =
    form.category === 'apartment'
      ? {
          projectName: d.projectName.trim(),
          buildingBlock: d.buildingBlock || null,
          unitCode: d.unitNumber || null,
          floorNumber: number(d.floor),
          buildingTotalFloors: optionalNumber(d.totalFloors),
          bedroomCount: number(d.bedrooms),
          bathroomCount: number(d.bathrooms),
          livingRoomCount: optionalNumber(d.livingRooms),
          kitchenCount: optionalNumber(d.kitchens),
          furnishingStatus: furnishing(d.furnishing),
          mainDoorDirection: d.doorOrientation || null,
          balconyDirection: d.balconyOrientation || null,
          viewDescription: d.view || null,
          maxOccupants: optionalNumber(d.maxOccupants),
          legalStatus: d.legalStatus || null,
        }
      : form.category === 'house'
        ? {
            landAreaM2: optionalNumber(d.landAreaM2),
            frontageWidthM: optionalNumber(d.facadeWidthM),
            lengthM: optionalNumber(d.lengthM),
            accessRoadWidthM: optionalNumber(d.streetWidthM),
            frontageCount: number(d.frontageCount) || 1,
            totalFloors: number(d.totalFloors),
            bedroomCount: number(d.bedrooms),
            bathroomCount: number(d.bathrooms),
            livingRoomCount: optionalNumber(d.livingRooms),
            kitchenCount: optionalNumber(d.kitchens),
            hasRooftop: d.hasRooftopTerrace ? yes(d.hasRooftopTerrace) : null,
            hasGarage: d.hasGarage ? yes(d.hasGarage) : null,
            accessType: d.privateEntrance ? (yes(d.privateEntrance) ? 'PRIVATE' : 'SHARED') : null,
            maxOccupants: optionalNumber(d.maxOccupants),
            maxVehicles: optionalNumber(d.maxVehicles),
            furnishingStatus: furnishing(d.furnishing),
            legalStatus: d.legalStatus || null,
          }
        : {
            roomCode: d.roomCode.trim(),
            floorNumber: optionalNumber(d.roomFloor),
            restroomType: d.toiletType === 'Dùng chung' ? 'SHARED' : 'PRIVATE',
            kitchenType: !d.kitchenType
              ? null
              : d.kitchenType === 'Dùng chung'
                ? 'SHARED'
                : d.kitchenType === 'Không có'
                  ? 'NONE'
                  : 'PRIVATE',
            hasWindow: d.hasWindow ? yes(d.hasWindow) : null,
            balconyType: !d.hasBalcony
              ? null
              : d.hasBalcony === 'Dùng chung'
                ? 'SHARED'
                : d.hasBalcony === 'Không có'
                  ? 'NONE'
                  : 'PRIVATE',
            hasMezzanine: d.hasLoft ? yes(d.hasLoft) : null,
            furnishingStatus: furnishing(d.furnishing),
            accessType: !d.entranceType
              ? null
              : d.entranceType === 'Dùng chung'
                ? 'SHARED'
                : 'PRIVATE',
            accessHoursType: !d.curfewType
              ? null
              : d.curfewType === 'Có giờ đóng cửa'
                ? 'CURFEW'
                : 'FLEXIBLE',
            electricMeterType: !d.electricityMeter
              ? null
              : d.electricityMeter === 'Dùng chung'
                ? 'SHARED'
                : 'PRIVATE',
            waterMeterType: !d.waterMeter
              ? null
              : d.waterMeter === 'Dùng chung'
                ? 'SHARED'
                : 'PRIVATE',
            maxOccupants: number(d.maxOccupants),
            maxVehicles: optionalNumber(d.maxVehicles),
            parkingPolicy: !d.parkingPolicy
              ? null
              : d.parkingPolicy === 'Có phí'
                ? 'PAID'
                : d.parkingPolicy === 'Không có'
                  ? 'NONE'
                  : 'FREE',
          };
  return {
    id: null,
    branchId: form.branchId || null,
    submissionAction: action,
    title: form.title.trim(),
    description: form.description.trim(),
    category,
    availableFrom: form.availableDate,
    areaM2,
    pricing: {
      amount: number(p.priceMonthly),
      currency: 'VND',
      unit:
        p.priceUnit === 'VNĐ / phòng / tháng'
          ? 'ROOM_MONTH'
          : p.priceUnit === 'VNĐ / người / tháng'
            ? 'PERSON_MONTH'
            : 'MONTH',
      negotiable: p.negotiable === 'Có',
      depositType:
        p.depositType === 'Số tiền'
          ? 'FIXED_AMOUNT'
          : p.depositType === 'Số tháng'
            ? 'MONTH_COUNT'
            : 'NONE',
      depositAmount: p.depositType === 'Số tiền' ? number(p.depositValue) : null,
      depositMonths: p.depositType === 'Số tháng' ? number(p.depositValue) : null,
      paymentCycle: 'MONTHLY',
      minimumLeaseMonths: number(p.minimumLeaseMonths),
      managementFeeIncluded: form.category === 'apartment' && p.managementType === 'Đã bao gồm',
    },
    apartmentDetail: form.category === 'apartment' ? detail : null,
    houseDetail: form.category === 'house' ? detail : null,
    roomDetail: form.category === 'room' ? detail : null,
    amenityCodes: form.amenities.filter((item) => catalogCodes.has(item)),
    customAmenities: form.amenities.filter((item) => !catalogCodes.has(item)),
    furnishings: form.assets.map((asset) => ({
      assetName: asset.name.trim(),
      quantity: number(asset.quantity),
      handoverCondition: condition(asset.condition),
    })),
    charges,
    addressSource: {
      type: 'NEW',
      address: { refId: form.addressRefId, addressNote: form.addressNote },
    },
    media: form.media.map((item, index) => ({
      ...item,
      sortOrder: index,
      cover: index === 0 && item.mediaType === 'IMAGE',
    })),
    viewingDays: form.days,
    viewingSlots: form.slots,
    policies,
  };
}
