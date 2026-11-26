// Port of hs-web-app new/utils/mapListingDetailToFormState.ts (listing/branch -> form state).
import type {
  ApartmentDetailsData,
  BasicInfoData,
  FurnishingAssetRow,
  HouseDetailsData,
  ListingMediaItem,
  ListingNotice,
  MonthlyExpensesData,
  PricingData,
  PropertyCategoryKey,
  RoomDetailsData,
  ListingFormState,
} from '@/lib/listing-form';
import { furnishingStatusToFormValue } from '@/lib/listing-payload';
import type { Branch } from '@/services/branchApi';
import type { ListingDetail } from '@/services/listingApi';

export function defaultMonthlyExpenses(): MonthlyExpensesData {
  return {
    electricityType: 'KWH',
    electricityPrice: '3500',
    waterType: 'M3',
    waterPrice: '25000',
    managementFeeType: 'NONE',
    managementFee: '',
    internetType: 'SELF_PAY',
    internetFee: '',
    garbageFeeType: 'INCLUDED',
    garbageFee: '',
    motorbikeParkingType: 'NONE',
    motorbikeParkingFee: '',
    carParkingType: 'NONE',
    carParkingFee: '',
    customFees: [],
  };
}

export function buildExpensesFromBranch(
  branch: Branch,
  category: PropertyCategoryKey
): MonthlyExpensesData {
  const isApartment = (branch.category ? branch.category.toLowerCase() : category) === 'apartment';
  const expenses = defaultMonthlyExpenses();
  const charges = branch.defaultCharges;
  if (!charges?.length) return expenses;
  const find = (type: string) => charges.find((c) => c.chargeType === type);
  const text = (amount?: number) => (amount ? String(amount) : '');

  const elec = find('ELECTRICITY');
  if (elec) {
    expenses.electricityPrice = text(elec.amount);
    expenses.electricityType =
      elec.includedInRent || elec.billingMethod === 'INCLUDED' ? 'INCLUDED' : 'KWH';
  }

  const water = find('WATER');
  if (water) {
    expenses.waterPrice = text(water.amount);
    if (water.billingMethod === 'PER_PERSON_MONTH') expenses.waterType = 'PER_PERSON';
    else if (water.billingMethod === 'PER_MONTH') expenses.waterType = 'FLAT_ROOM';
    else if (water.includedInRent || water.billingMethod === 'INCLUDED')
      expenses.waterType = 'INCLUDED';
    else expenses.waterType = 'M3';
  }

  const mgmt = find('MANAGEMENT');
  if (isApartment && mgmt) {
    expenses.managementFee = text(mgmt.amount);
    if (mgmt.includedInRent || mgmt.billingMethod === 'INCLUDED')
      expenses.managementFeeType = 'INCLUDED';
    else if (mgmt.billingMethod === 'PER_M2_MONTH') expenses.managementFeeType = 'PER_M2';
    else if (mgmt.billingMethod === 'NOT_APPLICABLE' || mgmt.billingMethod === 'FREE')
      expenses.managementFeeType = 'NONE';
    else expenses.managementFeeType = 'MONTHLY';
  }

  const net = find('INTERNET');
  if (net) {
    expenses.internetFee = text(net.amount);
    if (net.includedInRent || net.billingMethod === 'INCLUDED') expenses.internetType = 'INCLUDED';
    else if (net.billingMethod === 'NOT_APPLICABLE') expenses.internetType = 'SELF_PAY';
    else expenses.internetType = 'MONTHLY';
  }

  const garb = charges.find((c) =>
    ['SERVICE_OR_GARBAGE', 'GARBAGE', 'CLEANING'].includes(c.chargeType)
  );
  if (garb) {
    expenses.garbageFee = text(garb.amount);
    if (garb.includedInRent || garb.billingMethod === 'INCLUDED')
      expenses.garbageFeeType = 'INCLUDED';
    else if (garb.billingMethod === 'NOT_APPLICABLE') expenses.garbageFeeType = 'NONE';
    else if (garb.billingMethod === 'PER_PERSON_MONTH') expenses.garbageFeeType = 'PER_PERSON';
    else expenses.garbageFeeType = 'MONTHLY';
  }

  const moto = find('MOTORBIKE_PARKING');
  if (moto) {
    expenses.motorbikeParkingFee = text(moto.amount);
    if (moto.billingMethod === 'FREE' || moto.includedInRent || moto.billingMethod === 'INCLUDED')
      expenses.motorbikeParkingType = 'INCLUDED';
    else if (moto.billingMethod === 'NOT_APPLICABLE') expenses.motorbikeParkingType = 'NONE';
    else expenses.motorbikeParkingType = 'PER_VEHICLE';
  }

  const car = find('CAR_PARKING');
  if (car) {
    expenses.carParkingFee = text(car.amount);
    if (car.billingMethod === 'FREE' || car.includedInRent || car.billingMethod === 'INCLUDED')
      expenses.carParkingType = 'INCLUDED';
    else if (car.billingMethod === 'NOT_APPLICABLE') expenses.carParkingType = 'NONE';
    else expenses.carParkingType = 'PER_VEHICLE';
  }

  expenses.customFees = charges
    .filter((c) => c.chargeType === 'OTHER')
    .map((c, index) => ({
      id: c.id || `branch-fee-${index}`,
      name: c.customName || 'Phí dịch vụ khác',
      amount: text(c.amount),
      unit: c.unit || 'tháng',
    }));
  return expenses;
}

export function buildExpensesFromListingCharges(
  charges: ListingDetail['charges'] | undefined,
  category: PropertyCategoryKey
): MonthlyExpensesData {
  if (!charges?.length) return defaultMonthlyExpenses();
  const find = (type: string) => charges.find((c) => c.chargeType === type);
  const elec = find('ELECTRICITY');
  const water = find('WATER');
  const mgmt = find('MANAGEMENT');
  const net = find('INTERNET');
  const garb = charges.find(
    (c) => c.chargeType === 'SERVICE_OR_GARBAGE' || c.chargeType === 'GARBAGE'
  );
  const moto = find('MOTORBIKE_PARKING');
  const car = find('CAR_PARKING');
  const text = (amount: number | null | undefined, fallback = '') =>
    amount != null ? String(amount) : fallback;
  const parking = (c: typeof moto) =>
    !c
      ? 'NONE'
      : c.billingMethod === 'FREE' || c.includedInRent || c.billingMethod === 'INCLUDED'
        ? 'INCLUDED'
        : c.billingMethod === 'NOT_APPLICABLE'
          ? 'NONE'
          : c.amount != null
            ? 'PER_VEHICLE'
            : 'NONE';

  return {
    electricityType:
      elec?.includedInRent || elec?.billingMethod === 'INCLUDED' ? 'INCLUDED' : 'KWH',
    electricityPrice: text(elec?.amount, '3500'),
    waterType:
      water?.includedInRent || water?.billingMethod === 'INCLUDED'
        ? 'INCLUDED'
        : water?.billingMethod === 'PER_PERSON_MONTH'
          ? 'PER_PERSON'
          : water?.billingMethod === 'PER_MONTH'
            ? 'FLAT_ROOM'
            : 'M3',
    waterPrice: text(water?.amount, '25000'),
    managementFeeType:
      category !== 'apartment' ||
      !mgmt ||
      mgmt.billingMethod === 'NOT_APPLICABLE' ||
      mgmt.billingMethod === 'FREE'
        ? 'NONE'
        : mgmt.includedInRent || mgmt.billingMethod === 'INCLUDED'
          ? 'INCLUDED'
          : mgmt.billingMethod === 'PER_M2_MONTH'
            ? 'PER_M2'
            : mgmt.billingMethod === 'PER_MONTH' || mgmt.amount != null
              ? 'MONTHLY'
              : 'NONE',
    managementFee: category === 'apartment' ? text(mgmt?.amount) : '',
    internetType:
      net?.includedInRent || net?.billingMethod === 'INCLUDED'
        ? 'INCLUDED'
        : net?.billingMethod === 'NOT_APPLICABLE'
          ? 'SELF_PAY'
          : net?.amount != null
            ? 'MONTHLY'
            : 'SELF_PAY',
    internetFee: text(net?.amount),
    garbageFeeType:
      !garb || garb.includedInRent || garb.billingMethod === 'INCLUDED'
        ? 'INCLUDED'
        : garb.billingMethod === 'NOT_APPLICABLE'
          ? 'NONE'
          : garb.billingMethod === 'PER_PERSON_MONTH'
            ? 'PER_PERSON'
            : 'MONTHLY',
    garbageFee: text(garb?.amount),
    motorbikeParkingType: parking(moto),
    motorbikeParkingFee: text(moto?.amount),
    carParkingType: parking(car),
    carParkingFee: text(car?.amount),
    customFees: charges
      .filter((c) => c.chargeType === 'OTHER')
      .map((c, index) => ({
        id: `custom-${index}`,
        name: c.customName || '',
        amount: text(c.amount),
        unit: c.unit || 'tháng',
      })),
  };
}

type Values = Record<string, any>;

export function mapListingDetailToFormState(
  detail: ListingDetail,
  mode: 'edit' | 'duplicate',
  branches: Branch[],
  today: string
): { state: ListingFormState; notice?: ListingNotice } {
  const category: PropertyCategoryKey =
    detail.category === 'HOUSE' ? 'house' : detail.category === 'ROOM' ? 'room' : 'apartment';
  const duplicate = mode === 'duplicate';

  const media = (kind: 'IMAGE' | 'VIDEO'): ListingMediaItem[] =>
    (detail.media || [])
      .filter((m) => m.mediaType === kind)
      .map((m) => ({
        name: m.id || kind.toLowerCase(),
        uri: m.url || '',
        // A duplicate only references the source media; the server copies it.
        ...(duplicate
          ? { sourceMediaId: m.id }
          : { storageObjectId: m.storageObjectId ?? undefined }),
      }));

  let branchId = detail.branchId || '';
  let notice: ListingNotice | undefined;
  const branch = branches.find((b) => b.id === detail.branchId);
  if (detail.branchId && !branch && duplicate) {
    branchId = '';
    notice = {
      type: 'warning',
      message:
        'Chi nhánh của tin gốc không còn tồn tại hoặc bạn không còn quyền sở hữu. Hệ thống đã chuyển sang đăng tin độc lập.',
    };
  }

  const basicInfo: BasicInfoData = {
    branchId,
    title: duplicate ? (detail.title ? `${detail.title} (Bản sao)` : '') : detail.title || '',
    images: media('IMAGE'),
    videos: media('VIDEO'),
    category,
    // An edit keeps a past date (the API accepts it unchanged); a copy starts today at the earliest.
    availableDate:
      detail.availableFrom && (!duplicate || detail.availableFrom >= today)
        ? detail.availableFrom
        : today,
    description: detail.description || '',
  };

  const a: Values = detail.apartmentDetail ?? {};
  const apartmentDetails: ApartmentDetailsData = {
    projectName: a.projectName || '',
    buildingBlock: a.buildingBlock || '',
    unitNumber: duplicate ? '' : a.unitCode || '',
    areaM2: String(detail.areaM2 || ''),
    bedrooms: String(a.bedroomCount ?? '2'),
    bathrooms: String(a.bathroomCount ?? '2'),
    livingRooms: String(a.livingRoomCount ?? '1'),
    kitchens: String(a.kitchenCount ?? '1'),
    floor: String(a.floorNumber ?? ''),
    totalFloors: String(a.buildingTotalFloors ?? ''),
    furnishing: furnishingStatusToFormValue(a.furnishingStatus),
    doorOrientation: a.mainDoorDirection || '',
    balconyOrientation: a.balconyDirection || '',
    view: a.viewDescription || '',
    maxOccupants: String(a.maxOccupants ?? '4'),
    legalStatus: a.legalStatus || 'PINK_BOOK',
  };

  const h: Values = detail.houseDetail ?? {};
  const houseDetails: HouseDetailsData = {
    rentalScopeDescription: h.rentalScopeDescription,
    rentedFloorFrom: h.rentedFloorFrom,
    rentedFloorTo: h.rentedFloorTo,
    landAreaM2: String(h.landAreaM2 ?? ''),
    totalUsableAreaM2: String(detail.areaM2 || ''),
    facadeWidthM: String(h.frontageWidthM ?? ''),
    lengthM: String(h.lengthM ?? ''),
    streetWidthM: String(h.accessRoadWidthM ?? ''),
    frontageCount: String(h.frontageCount ?? '1'),
    bedrooms: String(h.bedroomCount ?? '3'),
    bathrooms: String(h.bathroomCount ?? '3'),
    livingRooms: String(h.livingRoomCount ?? '1'),
    kitchens: String(h.kitchenCount ?? '1'),
    totalFloors: String(h.totalFloors ?? '2'),
    hasRooftopTerrace: Boolean(h.hasRooftop),
    privateEntrance: h.accessType || 'PRIVATE',
    hasGarage: Boolean(h.hasGarage),
    maxOccupants: String(h.maxOccupants ?? '6'),
    maxVehicles: String(h.maxVehicles ?? '4'),
    furnishing: furnishingStatusToFormValue(h.furnishingStatus),
    legalStatus: h.legalStatus || 'PINK_BOOK',
  };

  const r: Values = detail.roomDetail ?? {};
  const shared = (value: unknown) => (value === 'SHARED' ? 'SHARED' : 'PRIVATE');
  const roomDetails: RoomDetailsData = {
    roomCode: duplicate ? '' : r.roomCode || '',
    areaM2: String(detail.areaM2 || ''),
    roomFloor: String(r.floorNumber ?? '2'),
    toiletType: shared(r.restroomType),
    kitchenType: r.kitchenType === 'NONE' ? 'NONE' : shared(r.kitchenType),
    hasWindow: r.hasWindow ? 'YES' : 'NO',
    hasBalcony: ['SHARED', 'PRIVATE', 'NONE'].includes(r.balconyType)
      ? r.balconyType
      : r.hasBalcony === true
        ? 'PRIVATE'
        : 'NONE',
    hasLoft: Boolean(r.hasMezzanine),
    furnishing: furnishingStatusToFormValue(r.furnishingStatus),
    entranceType: shared(r.accessType),
    curfewType: r.accessHoursType === 'CURFEW' ? 'CURFEW' : 'FREE',
    electricityMeter: shared(r.electricMeterType),
    waterMeter: shared(r.waterMeterType),
    maxOccupants: String(r.maxOccupants ?? '2'),
    maxVehicles: String(r.maxVehicles ?? '2'),
    parkingPolicy:
      r.parkingPolicy === 'PAID' ? 'PAID' : r.parkingPolicy === 'NONE' ? 'NONE' : 'FREE',
  };

  const furnishingAssets: FurnishingAssetRow[] = (detail.furnishings || []).map((f) => ({
    itemCode: f.itemCode ?? null,
    assetName: f.assetName || '',
    quantity: f.quantity ?? 1,
    handoverCondition: f.handoverCondition || 'GOOD',
    conditionNote: f.conditionNote || '',
  }));

  const p: Values = detail.pricing ?? {};
  const units: Record<string, string> = {
    M2_MONTH: 'VND_M2_MONTH',
    ROOM_MONTH: 'VND_ROOM_MONTH',
    PERSON_MONTH: 'VND_PERSON_MONTH',
    SEAT_MONTH: 'VND_SEAT_MONTH',
  };
  const pricing: PricingData = {
    priceMonthly: String(p.amount ?? ''),
    priceUnit: units[p.unit] ?? 'VND_MONTH',
    isNegotiable: Boolean(p.negotiable),
    depositType:
      p.depositType === 'FIXED_AMOUNT'
        ? 'AMOUNT'
        : p.depositType === 'MONTH_COUNT'
          ? 'MONTHS'
          : 'NONE',
    depositAmount: String(p.depositAmount ?? ''),
    depositMonths: String(p.depositMonths ?? ''),
    paymentCycle: 'MONTHLY',
    minimumLeaseMonths: String(p.minimumLeaseMonths ?? '6'),
    includeManagementFee: false,
  };

  return {
    state: {
      basicInfo,
      apartmentDetails,
      houseDetails,
      roomDetails,
      furnishingAssets,
      selectedAmenities: [
        ...(detail.amenities || []).map((item) => item.code).filter(Boolean),
        ...(detail.customAmenities || []),
      ],
      listingPolicies: (detail.policies ?? []).map((item) => ({
        code: item.code,
        value: item.value,
        note: item.note ?? '',
      })),
      // Once saved, a listing owns its fees: branch defaults only prefill a new listing.
      monthlyExpenses: buildExpensesFromListingCharges(detail.charges, category),
      pricing,
      addressMode: 'new',
      selectedAddress: branches.find((item) => item.id === branchId) ?? detail.address ?? null,
      selectedViewingDays: detail.viewingDays ?? [],
      selectedViewingSlots: detail.viewingSlots ?? [],
    },
    notice,
  };
}
