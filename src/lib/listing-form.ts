// Form state of the listing editor. Port of hs-web-app new/types.ts, constants.ts and the state
// rules of ListingEditor.tsx. No React / React Native imports.
import { buildExpensesFromBranch, defaultMonthlyExpenses } from '@/lib/listing-form-map';
import { swapPolicySuggestions, type ListingPolicyInput } from '@/lib/listing-policy';
import type { Branch } from '@/services/branchApi';
import type { LocalFile } from '@/services/storageApi';
import type { VietmapAddress } from '@/types/api';

export type PropertyCategoryKey = 'apartment' | 'house' | 'room';
export type ListingCategoryCode = 'APARTMENT' | 'HOUSE' | 'ROOM';
/** `listingId` is the edited listing (edit) or the source listing (duplicate). */
export type ListingEditorMode = 'create' | 'edit' | 'duplicate';

/** Exactly one of `file` (new pick), `storageObjectId` (stored) or `sourceMediaId` (duplicate). */
export type ListingMediaItem = {
  name: string;
  uri: string;
  file?: LocalFile;
  storageObjectId?: string;
  sourceMediaId?: string;
};

export type DepositType = 'NONE' | 'AMOUNT' | 'MONTHS';

export type CustomMonthlyFee = {
  id: string;
  name: string;
  amount: number | string;
  unit: string;
};

export type BasicInfoData = {
  branchId?: string;
  title: string;
  images: ListingMediaItem[];
  videos: ListingMediaItem[];
  category: PropertyCategoryKey;
  /** YYYY-MM-DD */
  availableDate: string;
  description: string;
};

export type ApartmentDetailsData = {
  projectName: string;
  buildingBlock?: string;
  unitNumber?: string;
  areaM2?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  livingRooms?: number | string;
  kitchens?: number | string;
  floor?: number | string;
  totalFloors?: number | string;
  furnishing: string;
  doorOrientation?: string;
  balconyOrientation?: string;
  view?: string;
  maxOccupants?: number | string;
  legalStatus?: string;
};

export type HouseDetailsData = {
  // No inputs for these three: kept so that saving does not erase them (as web).
  rentalScopeDescription?: string | null;
  rentedFloorFrom?: number | null;
  rentedFloorTo?: number | null;
  landAreaM2?: number | string;
  totalUsableAreaM2?: number | string;
  facadeWidthM?: number | string;
  lengthM?: number | string;
  streetWidthM?: number | string;
  frontageCount?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  livingRooms?: number | string;
  kitchens?: number | string;
  totalFloors?: number | string;
  hasRooftopTerrace?: boolean;
  privateEntrance?: string;
  hasGarage?: boolean;
  maxOccupants?: number | string;
  maxVehicles?: number | string;
  furnishing: string;
  legalStatus?: string;
};

export type RoomDetailsData = {
  roomCode?: string;
  areaM2?: number | string;
  roomFloor?: number | string;
  toiletType: string;
  kitchenType?: string;
  hasWindow?: string;
  hasBalcony?: string;
  hasLoft?: boolean;
  furnishing: string;
  entranceType?: string;
  curfewType?: string;
  electricityMeter?: string;
  waterMeter?: string;
  maxOccupants?: number | string;
  maxVehicles?: number | string;
  parkingPolicy?: string;
};

export type FurnishingAssetRow = {
  itemCode: string | null;
  assetName: string;
  quantity: number | string;
  handoverCondition: string;
  conditionNote?: string;
};

export type MonthlyExpensesData = {
  electricityType: 'KWH' | 'INCLUDED';
  electricityPrice?: number | string;
  waterType: 'M3' | 'PER_PERSON' | 'FLAT_ROOM' | 'INCLUDED';
  waterPrice?: number | string;
  managementFeeType: 'MONTHLY' | 'PER_M2' | 'INCLUDED' | 'NONE';
  managementFee?: number | string;
  internetType: 'MONTHLY' | 'INCLUDED' | 'SELF_PAY';
  internetFee?: number | string;
  garbageFeeType: 'MONTHLY' | 'PER_PERSON' | 'INCLUDED' | 'NONE';
  garbageFee?: number | string;
  motorbikeParkingType: 'PER_VEHICLE' | 'INCLUDED' | 'NONE';
  motorbikeParkingFee?: number | string;
  carParkingType: 'PER_VEHICLE' | 'INCLUDED' | 'NONE';
  carParkingFee?: number | string;
  customFees: CustomMonthlyFee[];
};

export type PricingData = {
  priceMonthly?: number | string;
  priceUnit: string;
  isNegotiable: boolean;
  depositType: DepositType;
  depositAmount?: number | string;
  depositMonths?: number | string;
  paymentCycle: 'MONTHLY';
  minimumLeaseMonths: number | string;
  includeManagementFee?: boolean;
};

export type AddressMode = 'saved' | 'new';
/** A Vietmap place, a branch or the stored listing address: all that matters on save is refId. */
export type ListingAddress = Partial<VietmapAddress> & {
  refId?: string;
  /** Set instead of refId while the user retypes: which place `addressNote` belongs to. */
  noteRefId?: string;
};

/** A new search result, or null while typing. The note returns when the same place is picked again. */
export function chooseAddress(
  previous: ListingAddress | null,
  next: ListingAddress | null
): ListingAddress | null {
  if (!next)
    return previous?.refId
      ? { noteRefId: previous.refId, addressNote: previous.addressNote }
      : previous;
  return next.refId === (previous?.refId ?? previous?.noteRefId)
    ? { ...next, addressNote: previous?.addressNote }
    : next;
}

export type ListingFormState = {
  basicInfo: BasicInfoData;
  apartmentDetails: ApartmentDetailsData;
  houseDetails: HouseDetailsData;
  roomDetails: RoomDetailsData;
  furnishingAssets: FurnishingAssetRow[];
  selectedAmenities: string[];
  /** Raw rows; show and send `withSystemRules(...)` of them (see listing-policy). */
  listingPolicies: ListingPolicyInput[];
  monthlyExpenses: MonthlyExpensesData;
  pricing: PricingData;
  addressMode: AddressMode;
  selectedAddress: ListingAddress | null;
  selectedViewingDays: string[];
  selectedViewingSlots: string[];
};

export type ListingNotice = { type: 'info' | 'warning' | 'error'; message: string };

export function getTodayDateString(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const categoryCode = (category: PropertyCategoryKey) =>
  category.toUpperCase() as ListingCategoryCode;

export function createListingForm(options?: {
  hasSavedAddress?: boolean;
  today?: string;
}): ListingFormState {
  return {
    basicInfo: {
      title: '',
      images: [],
      videos: [],
      category: 'apartment',
      availableDate: options?.today ?? getTodayDateString(),
      description: '',
    },
    apartmentDetails: {
      projectName: '',
      buildingBlock: '',
      unitNumber: '',
      areaM2: '',
      bedrooms: '2',
      bathrooms: '2',
      livingRooms: '1',
      kitchens: '1',
      floor: '',
      totalFloors: '',
      furnishing: 'FULL',
      doorOrientation: '',
      balconyOrientation: '',
      view: '',
      maxOccupants: '4',
      legalStatus: 'PINK_BOOK',
    },
    houseDetails: {
      landAreaM2: '',
      totalUsableAreaM2: '',
      facadeWidthM: '',
      lengthM: '',
      streetWidthM: '',
      frontageCount: '1',
      bedrooms: '3',
      bathrooms: '3',
      livingRooms: '1',
      kitchens: '1',
      totalFloors: '2',
      hasRooftopTerrace: false,
      privateEntrance: 'PRIVATE',
      hasGarage: false,
      maxOccupants: '6',
      maxVehicles: '4',
      furnishing: 'BASIC',
      legalStatus: 'PINK_BOOK',
    },
    roomDetails: {
      roomCode: '',
      areaM2: '',
      roomFloor: '2',
      toiletType: 'PRIVATE',
      kitchenType: 'PRIVATE',
      hasWindow: 'YES',
      hasBalcony: 'PRIVATE',
      hasLoft: false,
      furnishing: 'FULL',
      entranceType: 'PRIVATE',
      curfewType: 'FREE',
      electricityMeter: 'PRIVATE',
      waterMeter: 'PRIVATE',
      maxOccupants: '2',
      maxVehicles: '2',
      parkingPolicy: 'FREE',
    },
    furnishingAssets: [],
    selectedAmenities: [],
    listingPolicies: [],
    monthlyExpenses: defaultMonthlyExpenses(),
    pricing: {
      priceMonthly: '',
      priceUnit: 'VND_MONTH',
      isNegotiable: false,
      depositType: 'MONTHS',
      depositAmount: '',
      depositMonths: '1',
      paymentCycle: 'MONTHLY',
      minimumLeaseMonths: '6',
      includeManagementFee: false,
    },
    addressMode: options?.hasSavedAddress ? 'saved' : 'new',
    selectedAddress: null,
    selectedViewingDays: [],
    selectedViewingSlots: [],
  };
}

export const PROPERTY_CATEGORIES: {
  key: PropertyCategoryKey;
  label: string;
  description: string;
}[] = [
  { key: 'house', label: 'Nhà nguyên căn', description: 'Nhà nguyên căn, nhà phố, biệt thự' },
  { key: 'apartment', label: 'Căn hộ chung cư', description: 'Căn hộ chung cư' },
  { key: 'room', label: 'Phòng trọ', description: 'Phòng trọ' },
];

export const PRICE_UNITS_BY_CATEGORY: Record<
  PropertyCategoryKey,
  { value: string; label: string }[]
> = {
  apartment: [{ value: 'VND_MONTH', label: 'VNĐ / tháng' }],
  house: [{ value: 'VND_MONTH', label: 'VNĐ / tháng' }],
  room: [
    { value: 'VND_ROOM_MONTH', label: 'VNĐ / phòng / tháng' },
    { value: 'VND_PERSON_MONTH', label: 'VNĐ / người / tháng' },
    { value: 'VND_MONTH', label: 'VNĐ / tháng' },
  ],
};

export const DEPOSIT_TYPES = [
  { value: 'NONE', label: 'Không đặt cọc' },
  { value: 'AMOUNT', label: 'Cọc theo số tiền' },
  { value: 'MONTHS', label: 'Cọc theo số tháng' },
] as const;

export const PAYMENT_CYCLES = [{ value: 'MONTHLY', label: 'Hằng tháng (1 tháng)' }] as const;

export const VIEWING_DAYS = [
  ['MONDAY', 'Thứ 2'],
  ['TUESDAY', 'Thứ 3'],
  ['WEDNESDAY', 'Thứ 4'],
  ['THURSDAY', 'Thứ 5'],
  ['FRIDAY', 'Thứ 6'],
  ['SATURDAY', 'Thứ 7'],
  ['SUNDAY', 'Chủ nhật'],
] as const;

export const VIEWING_SLOTS = [
  { value: 'MORNING', label: 'Buổi sáng', time: '08:00 – 12:00' },
  { value: 'AFTERNOON', label: 'Buổi chiều', time: '13:00 – 17:00' },
  { value: 'EVENING', label: 'Buổi tối', time: '18:00 – 21:00' },
] as const;

export const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

// --- Amenities (PETS_ALLOWED is a policy now: never shown, never sent) ---
export const visibleAmenities = <T extends { code: string }>(options: T[]) =>
  options.filter((item) => item.code !== 'PETS_ALLOWED');

/** Selected entries that are not catalog codes: show them as removable custom amenities. */
export const customAmenities = (selected: string[], options: { code: string }[]) =>
  selected.filter(
    (item) => item !== 'PETS_ALLOWED' && !options.some((option) => option.code === item)
  );

export function addCustomAmenity(selected: string[], input: string) {
  const text = input.trim();
  return !text || selected.includes(text) ? selected : [...selected, text];
}

// --- Handover assets ---
export const emptyFurnishingRow = (): FurnishingAssetRow => ({
  itemCode: null,
  assetName: '',
  quantity: 1,
  handoverCondition: 'GOOD',
  conditionNote: '',
});

export function toggleCatalogFurnishing(
  rows: FurnishingAssetRow[],
  item: { code: string; name: string }
) {
  return rows.some((row) => row.itemCode === item.code)
    ? rows.filter((row) => row.itemCode !== item.code)
    : [...rows, { ...emptyFurnishingRow(), itemCode: item.code, assetName: item.name }];
}

export const activeDetails = (state: ListingFormState) =>
  state.basicInfo.category === 'apartment'
    ? state.apartmentDetails
    : state.basicInfo.category === 'house'
      ? state.houseDetails
      : state.roomDetails;

/** Anything but "raw" needs the handover table (it becomes the contract's handover record). */
export const isFurnishingRequired = (state: ListingFormState) =>
  activeDetails(state).furnishing !== 'RAW';

/** Custom fees are always monthly on the wire. */
export const newCustomFee = (): CustomMonthlyFee => ({
  id: `fee-${Date.now()}`,
  name: '',
  amount: '',
  unit: 'tháng',
});

// --- Category ---
export const canChangeCategory = (state: ListingFormState, mode: ListingEditorMode) =>
  mode !== 'edit' && !state.basicInfo.branchId;

/** Apply after the user confirmed. Clear field errors too. */
export function changeCategory(
  state: ListingFormState,
  category: PropertyCategoryKey,
  mode: ListingEditorMode
): ListingFormState {
  if (mode === 'edit' || category === state.basicInfo.category) return state;
  return {
    ...state,
    basicInfo: { ...state.basicInfo, category },
    pricing: { ...state.pricing, priceUnit: PRICE_UNITS_BY_CATEGORY[category][0].value },
    listingPolicies: swapPolicySuggestions(state.listingPolicies, categoryCode(category)),
    // Amenity and asset catalogs differ per category.
    selectedAmenities: [],
    furnishingAssets: [],
    monthlyExpenses:
      category !== 'apartment'
        ? { ...state.monthlyExpenses, managementFeeType: 'NONE', managementFee: '' }
        : state.monthlyExpenses,
  };
}

// --- Branch ---
/** Option label of the branch picker; the empty option is BRANCH_NONE_LABEL. */
export const branchLabel = (branch: Branch) =>
  `${branch.name} ${branch.code ? `(${branch.code})` : ''} - ${branch.display}`;
export const BRANCH_NONE_LABEL = '-- Không chọn chi nhánh --';

/** Branches of legacy categories (OFFICE...) still come back from the API; the editor cannot use them. */
export const isSupportedBranch = (branch: Branch) =>
  !branch.category || branch.category.toLowerCase() in PRICE_UNITS_BY_CATEGORY;

/** Branch rates only prefill a new listing; edit/duplicate keep their own fees. */
export function selectBranch(
  state: ListingFormState,
  branchId: string,
  branches: Branch[],
  mode: ListingEditorMode
): { state: ListingFormState; notice?: ListingNotice } {
  const prefill = mode === 'create';
  if (!branchId) {
    return {
      state: {
        ...state,
        basicInfo: { ...state.basicInfo, branchId: '' },
        monthlyExpenses: prefill ? defaultMonthlyExpenses() : state.monthlyExpenses,
      },
      notice: {
        type: 'info',
        message: 'Đã chọn đăng tin riêng lẻ. Bạn có thể tự nhập tất cả thông tin.',
      },
    };
  }
  const branch = branches.find((item) => item.id === branchId);
  if (!branch) return { state };
  if (!isSupportedBranch(branch))
    return {
      state,
      notice: { type: 'error', message: 'Chi nhánh này thuộc loại hình chưa hỗ trợ đăng tin.' },
    };
  const current = state.basicInfo.category;
  if (mode === 'edit' && branch.category && branch.category.toLowerCase() !== current) {
    return {
      state,
      notice: { type: 'error', message: 'Không thể chọn chi nhánh khác loại hình của bài đăng.' },
    };
  }
  const category = branch.category
    ? (branch.category.toLowerCase() as PropertyCategoryKey)
    : current;
  const next: ListingFormState = {
    ...state,
    basicInfo: { ...state.basicInfo, branchId, category },
  };
  if (category !== current)
    next.listingPolicies = swapPolicySuggestions(state.listingPolicies, categoryCode(category));
  if (branch.category && (prefill || category !== current))
    next.pricing = { ...state.pricing, priceUnit: PRICE_UNITS_BY_CATEGORY[category][0].value };
  if (branch.refId) {
    next.addressMode = 'new';
    next.selectedAddress = branch;
  }
  if (prefill) next.monthlyExpenses = buildExpensesFromBranch(branch, current);
  if (branch.buildingRules && !state.basicInfo.description) {
    next.basicInfo.description = `Nội quy & Quy định chung tòa nhà ${branch.name}:\n${branch.buildingRules}`;
  }
  const incomplete = branch.isComplete === false || Boolean(branch.missingCharges?.length);
  return {
    state: next,
    notice: incomplete
      ? {
          type: 'warning',
          message: `Chi nhánh "${branch.name}" chưa hoàn thiện biểu phí (${branch.missingCharges?.join(', ')}). Vui lòng cập nhật biểu phí chi nhánh trước khi đăng tin.`,
        }
      : {
          type: 'info',
          message: `Đã áp dụng thông tin địa chỉ & biểu phí từ chi nhánh "${branch.name}"`,
        },
  };
}
