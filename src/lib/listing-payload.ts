// Port of hs-web-app new/utils/buildListingPayload.ts: same input, same request body.
// Change it only together with the web file (tests/listing-editor.test.cjs compares both).
// Deliberate difference: when the custom fees change, each stored one keeps its terms (the web
// recreates them all as monthly and drops their descriptions).
import type {
  ApartmentDetailsData,
  BasicInfoData,
  FurnishingAssetRow,
  HouseDetailsData,
  MonthlyExpensesData,
  PricingData,
  RoomDetailsData,
  ListingCategoryCode,
} from '@/lib/listing-form';
import type { ListingPolicyInput } from '@/lib/listing-policy';
import type { ListingSubmissionAction } from '@/services/listingCreateApi';
import type { ListingDetail } from '@/services/listingApi';

export type ListingChargeRequest = ListingDetail['charges'][number];

export type UploadedListingMedia = {
  storageObjectId?: string;
  sourceMediaId?: string;
  mediaType: 'IMAGE' | 'VIDEO';
};

export type BuildPayloadParams = {
  policies?: ListingPolicyInput[];
  id?: string | null;
  duplicateSourceListingId?: string | null;
  submissionAction: ListingSubmissionAction;
  basicInfo: BasicInfoData;
  apartmentDetails: ApartmentDetailsData;
  houseDetails: HouseDetailsData;
  roomDetails: RoomDetailsData;
  furnishingAssets: FurnishingAssetRow[];
  selectedAmenities: string[];
  catalogAmenityCodes?: string[];
  monthlyExpenses: MonthlyExpensesData;
  originalCharges?: ListingChargeRequest[];
  originalMonthlyExpenses?: MonthlyExpensesData;
  vehicleLimits?: { maxMotorbikeCount: number | null; maxCarCount: number | null } | null;
  pricing: PricingData;
  addressMode: 'saved' | 'new';
  savedAddressId?: string | null;
  refId?: string;
  addressNote?: string;
  uploadedMediaList: UploadedListingMedia[];
  selectedViewingDays?: string[];
  selectedViewingSlots?: string[];
};

const FURNISHING: Record<string, string> = {
  LUXURY: 'LUXURY',
  FULL: 'FULLY_FURNISHED',
  PARTIAL: 'PARTIALLY_FURNISHED',
  BASIC: 'BASIC',
};
const resolveFurnishing = (value: string) => FURNISHING[value] ?? 'UNFURNISHED';

/** Inverse of resolveFurnishing, used when loading a listing. */
export function furnishingStatusToFormValue(status?: string | null): string {
  switch (status) {
    case 'LUXURY':
      return 'LUXURY';
    case 'FULLY_FURNISHED':
      return 'FULL';
    case 'PARTIALLY_FURNISHED':
      return 'PARTIAL';
    case 'BASIC':
      return 'BASIC';
    case 'UNFURNISHED':
      return 'RAW';
    default:
      return 'FULL';
  }
}

const PRICE_UNITS: Record<string, string> = {
  VND_M2_MONTH: 'M2_MONTH',
  VND_ROOM_MONTH: 'ROOM_MONTH',
  VND_PERSON_MONTH: 'PERSON_MONTH',
  VND_SEAT_MONTH: 'SEAT_MONTH',
};

/** What one custom fee row sends. A row loaded from the listing keeps its stored terms. */
function customFeeCharge(
  fee: MonthlyExpensesData['customFees'][number],
  index: number,
  storedCharges: ListingChargeRequest[] | undefined
): ListingChargeRequest {
  const entered = {
    chargeType: 'OTHER',
    billingMethod: 'PER_MONTH',
    amount: Number(fee.amount) || 0,
    unit: 'tháng',
    customName: fee.name || 'Phí khác',
    includedInRent: false,
    sortOrder: 9 + index,
  };
  // "custom-<n>" is the n-th stored OTHER charge (buildExpensesFromListingCharges).
  const stored = storedCharges?.filter((c) => c.chargeType === 'OTHER')[
    Number(/^custom-(\d+)$/.exec(fee.id)?.[1])
  ];
  if (!stored) return entered;
  const samePrice = Number(stored.amount || 0) === entered.amount;
  const free =
    stored.includedInRent || ['FREE', 'INCLUDED', 'NOT_APPLICABLE'].includes(stored.billingMethod);
  // A price typed on a free fee needs a priced method.
  if (free && !samePrice) return { ...stored, ...entered };
  return {
    ...stored,
    amount: samePrice ? stored.amount : entered.amount,
    customName: entered.customName,
    sortOrder: entered.sortOrder,
  };
}

const FEE_UNITS: Record<string, string> = {
  PER_MONTH: 'đ/tháng',
  PER_PERSON_MONTH: 'đ/người/tháng',
  FREE: 'Miễn phí',
  INCLUDED: 'Đã bao gồm trong giá thuê',
  NOT_APPLICABLE: 'Không áp dụng',
  NEGOTIABLE: 'Thỏa thuận',
};

/** What the number typed on a custom fee row means: follows the method that will be sent. */
export function customFeeUnit(
  fee: MonthlyExpensesData['customFees'][number],
  storedCharges: ListingChargeRequest[] | undefined
) {
  const charge = customFeeCharge(fee, 0, storedCharges);
  if (charge.includedInRent) return FEE_UNITS.INCLUDED;
  return FEE_UNITS[charge.billingMethod] ?? (charge.unit ? `đ/${charge.unit}` : 'đ');
}

export function buildCreateListingPayload(params: BuildPayloadParams) {
  const {
    basicInfo,
    apartmentDetails,
    houseDetails,
    roomDetails,
    furnishingAssets,
    selectedAmenities,
    monthlyExpenses,
    pricing,
    addressMode,
    savedAddressId,
    uploadedMediaList,
  } = params;

  const category: ListingCategoryCode =
    basicInfo.category === 'house' ? 'HOUSE' : basicInfo.category === 'room' ? 'ROOM' : 'APARTMENT';

  let areaM2 = 30;
  if (basicInfo.category === 'apartment') {
    areaM2 = Number(apartmentDetails.areaM2) || 30;
  } else if (basicInfo.category === 'house') {
    areaM2 = Number(houseDetails.totalUsableAreaM2) || 50;
  } else if (basicInfo.category === 'room') {
    areaM2 = Number(roomDetails.areaM2) || 20;
  }

  const depositType =
    pricing.depositType === 'AMOUNT'
      ? 'FIXED_AMOUNT'
      : pricing.depositType === 'MONTHS'
        ? 'MONTH_COUNT'
        : 'NONE';
  const pricingPayload = {
    amount: Number(pricing.priceMonthly) || 0,
    currency: 'VND',
    unit: PRICE_UNITS[pricing.priceUnit] ?? 'MONTH',
    negotiable: Boolean(pricing.isNegotiable),
    depositType,
    depositAmount:
      depositType === 'FIXED_AMOUNT' && pricing.depositAmount
        ? Number(pricing.depositAmount)
        : null,
    depositMonths:
      depositType === 'MONTH_COUNT' && pricing.depositMonths ? Number(pricing.depositMonths) : null,
    paymentCycle: 'MONTHLY',
    minimumLeaseMonths: Number(pricing.minimumLeaseMonths) || 1,
    managementFeeIncluded:
      basicInfo.category === 'apartment' && monthlyExpenses.managementFeeType === 'INCLUDED',
  };

  const apartmentDetail =
    category !== 'APARTMENT'
      ? null
      : {
          projectName: apartmentDetails.projectName.trim(),
          buildingBlock: apartmentDetails.buildingBlock?.trim() || null,
          unitCode: apartmentDetails.unitNumber?.trim() || null,
          floorNumber: Number(apartmentDetails.floor) || 0,
          buildingTotalFloors: apartmentDetails.totalFloors
            ? Number(apartmentDetails.totalFloors)
            : null,
          bedroomCount: Number(apartmentDetails.bedrooms) || 0,
          bathroomCount: Number(apartmentDetails.bathrooms) || 1,
          livingRoomCount: apartmentDetails.livingRooms
            ? Number(apartmentDetails.livingRooms)
            : null,
          kitchenCount: apartmentDetails.kitchens ? Number(apartmentDetails.kitchens) : null,
          furnishingStatus: resolveFurnishing(apartmentDetails.furnishing),
          mainDoorDirection: apartmentDetails.doorOrientation || null,
          balconyDirection: apartmentDetails.balconyOrientation || null,
          viewDescription: apartmentDetails.view?.trim() || null,
          maxOccupants: apartmentDetails.maxOccupants
            ? Number(apartmentDetails.maxOccupants)
            : null,
          legalStatus: apartmentDetails.legalStatus || null,
        };
  const houseDetail =
    category !== 'HOUSE'
      ? null
      : {
          landAreaM2: houseDetails.landAreaM2 ? Number(houseDetails.landAreaM2) : null,
          frontageWidthM: houseDetails.facadeWidthM ? Number(houseDetails.facadeWidthM) : null,
          lengthM: houseDetails.lengthM ? Number(houseDetails.lengthM) : null,
          accessRoadWidthM: houseDetails.streetWidthM ? Number(houseDetails.streetWidthM) : null,
          frontageCount: houseDetails.frontageCount ? Number(houseDetails.frontageCount) : 1,
          totalFloors: Number(houseDetails.totalFloors) || 1,
          bedroomCount: Number(houseDetails.bedrooms) || 1,
          bathroomCount: Number(houseDetails.bathrooms) || 1,
          livingRoomCount: houseDetails.livingRooms ? Number(houseDetails.livingRooms) : null,
          kitchenCount: houseDetails.kitchens ? Number(houseDetails.kitchens) : null,
          hasRooftop: Boolean(houseDetails.hasRooftopTerrace),
          hasGarage: Boolean(houseDetails.hasGarage),
          accessType: houseDetails.privateEntrance || 'PRIVATE',
          maxOccupants: houseDetails.maxOccupants ? Number(houseDetails.maxOccupants) : null,
          maxVehicles: houseDetails.maxVehicles ? Number(houseDetails.maxVehicles) : null,
          furnishingStatus: resolveFurnishing(houseDetails.furnishing),
          legalStatus: houseDetails.legalStatus || null,
          rentalScopeDescription: houseDetails.rentalScopeDescription ?? null,
          rentedFloorFrom: houseDetails.rentedFloorFrom ?? null,
          rentedFloorTo: houseDetails.rentedFloorTo ?? null,
        };
  const roomDetail =
    category !== 'ROOM'
      ? null
      : {
          roomCode: roomDetails.roomCode?.trim() || null,
          floorNumber: roomDetails.roomFloor ? Number(roomDetails.roomFloor) : null,
          restroomType: roomDetails.toiletType === 'SHARED' ? 'SHARED' : 'PRIVATE',
          kitchenType:
            roomDetails.kitchenType === 'SHARED'
              ? 'SHARED'
              : roomDetails.kitchenType === 'NONE'
                ? 'NONE'
                : 'PRIVATE',
          hasWindow: roomDetails.hasWindow === 'YES',
          balconyType:
            roomDetails.hasBalcony === 'SHARED'
              ? 'SHARED'
              : roomDetails.hasBalcony === 'NONE' || roomDetails.hasBalcony === 'NO'
                ? 'NONE'
                : 'PRIVATE',
          hasMezzanine: Boolean(roomDetails.hasLoft),
          furnishingStatus: resolveFurnishing(roomDetails.furnishing),
          accessType: roomDetails.entranceType === 'SHARED' ? 'SHARED' : 'PRIVATE',
          accessHoursType: roomDetails.curfewType === 'CURFEW' ? 'CURFEW' : 'FLEXIBLE',
          electricMeterType: roomDetails.electricityMeter === 'SHARED' ? 'SHARED' : 'PRIVATE',
          waterMeterType: roomDetails.waterMeter === 'SHARED' ? 'SHARED' : 'PRIVATE',
          maxOccupants: Number(roomDetails.maxOccupants) || 1,
          maxVehicles: roomDetails.maxVehicles ? Number(roomDetails.maxVehicles) : null,
          parkingPolicy:
            roomDetails.parkingPolicy === 'PAID'
              ? 'PAID'
              : roomDetails.parkingPolicy === 'NONE'
                ? 'NONE'
                : 'FREE',
        };

  const e = monthlyExpenses;
  const paid = (condition: boolean, value?: number | string) =>
    condition && value ? Number(value) : null;
  let charges: ListingChargeRequest[] = [
    {
      chargeType: 'ELECTRICITY',
      billingMethod: e.electricityType === 'KWH' ? 'PER_KWH' : 'INCLUDED',
      amount: paid(e.electricityType === 'KWH', e.electricityPrice),
      unit: 'kWh',
      includedInRent: e.electricityType === 'INCLUDED',
      sortOrder: 1,
    },
    {
      chargeType: 'WATER',
      billingMethod:
        e.waterType === 'M3'
          ? 'PER_M3'
          : e.waterType === 'PER_PERSON'
            ? 'PER_PERSON_MONTH'
            : e.waterType === 'FLAT_ROOM'
              ? 'PER_MONTH'
              : 'INCLUDED',
      amount: paid(
        e.waterType === 'M3' || e.waterType === 'PER_PERSON' || e.waterType === 'FLAT_ROOM',
        e.waterPrice
      ),
      unit:
        e.waterType === 'M3'
          ? 'm³'
          : e.waterType === 'PER_PERSON'
            ? 'người/tháng'
            : e.waterType === 'FLAT_ROOM'
              ? 'phòng/tháng'
              : undefined,
      includedInRent: e.waterType === 'INCLUDED',
      sortOrder: 2,
    },
    ...(basicInfo.category === 'apartment' && e.managementFeeType !== 'NONE'
      ? [
          {
            chargeType: 'MANAGEMENT',
            billingMethod:
              e.managementFeeType === 'MONTHLY'
                ? 'PER_MONTH'
                : e.managementFeeType === 'PER_M2'
                  ? 'PER_M2_MONTH'
                  : 'INCLUDED',
            amount: paid(
              e.managementFeeType === 'MONTHLY' || e.managementFeeType === 'PER_M2',
              e.managementFee
            ),
            includedInRent: e.managementFeeType === 'INCLUDED',
            sortOrder: 3,
          },
        ]
      : []),
    {
      chargeType: 'INTERNET',
      billingMethod:
        e.internetType === 'MONTHLY'
          ? 'PER_MONTH'
          : e.internetType === 'INCLUDED'
            ? 'INCLUDED'
            : 'NOT_APPLICABLE',
      amount: paid(e.internetType === 'MONTHLY', e.internetFee),
      includedInRent: e.internetType === 'INCLUDED',
      sortOrder: 4,
    },
    {
      chargeType: 'SERVICE_OR_GARBAGE',
      billingMethod:
        e.garbageFeeType === 'MONTHLY'
          ? 'PER_MONTH'
          : e.garbageFeeType === 'PER_PERSON'
            ? 'PER_PERSON_MONTH'
            : e.garbageFeeType === 'NONE'
              ? 'NOT_APPLICABLE'
              : 'INCLUDED',
      amount: paid(
        e.garbageFeeType === 'MONTHLY' || e.garbageFeeType === 'PER_PERSON',
        e.garbageFee
      ),
      includedInRent: e.garbageFeeType === 'INCLUDED',
      sortOrder: 5,
    },
    {
      chargeType: 'MOTORBIKE_PARKING',
      billingMethod:
        e.motorbikeParkingType === 'PER_VEHICLE'
          ? 'PER_VEHICLE_MONTH'
          : e.motorbikeParkingType === 'INCLUDED'
            ? 'INCLUDED'
            : 'NOT_APPLICABLE',
      amount: paid(e.motorbikeParkingType === 'PER_VEHICLE', e.motorbikeParkingFee),
      includedInRent: e.motorbikeParkingType === 'INCLUDED',
      sortOrder: 6,
    },
    {
      chargeType: 'CAR_PARKING',
      billingMethod:
        e.carParkingType === 'PER_VEHICLE'
          ? 'PER_VEHICLE_MONTH'
          : e.carParkingType === 'INCLUDED'
            ? 'INCLUDED'
            : 'NOT_APPLICABLE',
      amount: paid(e.carParkingType === 'PER_VEHICLE', e.carParkingFee),
      includedInRent: e.carParkingType === 'INCLUDED',
      sortOrder: 7,
    },
    ...e.customFees.map((fee, index) => customFeeCharge(fee, index, params.originalCharges)),
  ];
  // Edit/duplicate: untouched fees are sent back exactly as stored.
  if (params.originalCharges && params.originalMonthlyExpenses) {
    const before = params.originalMonthlyExpenses;
    const controls: [string, (keyof MonthlyExpensesData)[]][] = [
      ['ELECTRICITY', ['electricityType', 'electricityPrice']],
      ['WATER', ['waterType', 'waterPrice']],
      ['MANAGEMENT', ['managementFeeType', 'managementFee']],
      ['INTERNET', ['internetType', 'internetFee']],
      ['SERVICE_OR_GARBAGE', ['garbageFeeType', 'garbageFee']],
      ['MOTORBIKE_PARKING', ['motorbikeParkingType', 'motorbikeParkingFee']],
      ['CAR_PARKING', ['carParkingType', 'carParkingFee']],
    ];
    const changed = new Set(
      controls
        .filter(([, fields]) =>
          fields.some((field) => {
            const oldValue = before[field];
            const newValue = monthlyExpenses[field];
            return field.toLowerCase().endsWith('fee') || field.toLowerCase().endsWith('price')
              ? Number(oldValue || 0) !== Number(newValue || 0)
              : oldValue !== newValue;
          })
        )
        .map(([type]) => type)
    );
    const customKey = (data: MonthlyExpensesData) =>
      JSON.stringify(
        data.customFees.map(({ name, amount, unit }) => [name, Number(amount || 0), unit])
      );
    if (customKey(before) !== customKey(monthlyExpenses)) changed.add('OTHER');
    const remaining = new Map(
      charges
        .filter((charge) => charge.chargeType !== 'OTHER')
        .map((charge) => [charge.chargeType, charge])
    );
    const resolved: ListingChargeRequest[] = [];
    for (const original of params.originalCharges) {
      if (changed.has(original.chargeType)) {
        const replacement = remaining.get(original.chargeType);
        if (replacement) {
          resolved.push({
            ...replacement,
            sortOrder: original.sortOrder ?? replacement.sortOrder,
            ...(original.description != null ? { description: original.description } : {}),
            ...(original.currency != null ? { currency: original.currency } : {}),
            ...(original.customName != null && replacement.customName == null
              ? { customName: original.customName }
              : {}),
          });
          remaining.delete(original.chargeType);
        }
      } else resolved.push(original);
    }
    for (const charge of charges) {
      if (charge.chargeType === 'OTHER') {
        if (changed.has('OTHER')) resolved.push(charge);
        continue;
      }
      if (changed.has(charge.chargeType) && remaining.has(charge.chargeType)) {
        resolved.push(charge);
        remaining.delete(charge.chargeType);
      }
    }
    charges = resolved;
  }

  const media = uploadedMediaList.map((item, index) => ({
    storageObjectId: item.storageObjectId,
    sourceMediaId: item.sourceMediaId,
    mediaType: item.mediaType,
    sortOrder: index,
    cover: index === 0,
  }));

  const addressSource =
    addressMode === 'saved' && savedAddressId
      ? { type: 'SAVED' as const, savedAddressId }
      : {
          type: 'NEW' as const,
          address: { refId: params.refId || '', addressNote: params.addressNote },
        };

  const amenities = selectedAmenities.filter((item) => item !== 'PETS_ALLOWED');
  const codes = params.catalogAmenityCodes?.length ? params.catalogAmenityCodes : null;

  return {
    policies: params.policies ?? [],
    id: params.id || null,
    duplicateSourceListingId: params.duplicateSourceListingId || undefined,
    branchId: basicInfo.branchId || null,
    submissionAction: params.submissionAction,
    title: basicInfo.title.trim(),
    description: basicInfo.description.trim(),
    availableFrom:
      basicInfo.availableDate ||
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
    category,
    areaM2,
    ...(params.vehicleLimits ?? {}),
    pricing: pricingPayload,
    apartmentDetail,
    houseDetail,
    roomDetail,
    amenityCodes: codes ? amenities.filter((item) => codes.includes(item)) : amenities,
    customAmenities: codes ? amenities.filter((item) => !codes.includes(item)) : [],
    furnishings: furnishingAssets.map((row) => ({
      itemCode: row.itemCode || null,
      assetName: row.assetName.trim(),
      quantity: Number(row.quantity) || 1,
      handoverCondition: row.handoverCondition,
      conditionNote: row.conditionNote?.trim() || null,
    })),
    charges,
    addressSource,
    media,
    viewingDays: params.selectedViewingDays || [],
    viewingSlots: params.selectedViewingSlots || [],
  };
}

export type ListingPayload = ReturnType<typeof buildCreateListingPayload>;
