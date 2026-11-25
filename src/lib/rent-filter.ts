// Pure rent-search filter logic, mirrored from the web "Nhà cho thuê" page
// (hs-web-app: components/rent/RentFilterSidebar.tsx, lib/rent-filter-state.ts, app/rent/page.tsx).
// No react-native imports so it can be unit-tested with node.

export type RentCategory = 'all' | 'house' | 'apartment' | 'room';
export type RentSort = 'newest' | 'price_asc' | 'price_desc' | 'area_desc';

export type RentFilter = {
  category: RentCategory;
  minPrice: number; // millions VND / month
  maxPrice: number; // millions VND / month; 100 means "no upper bound"
  areaRange: string;
  beds: string;
  baths: string;
  furnishingStatus: string;
  direction: string;
  balconyDirection: string;
  restroomType: string;
  kitchenType: string;
  accessType: string;
  legalStatus: string;
  hasMezzanine: boolean;
  hasRooftop: boolean;
  hasGarage: boolean;
  hasVideoOnly: boolean;
  sortBy: RentSort;
  searchQuery: string;
};

export type RentOption = { id: string; label: string };

export const MAX_PRICE = 100;
export const PRICE_PRESETS = [0, 5, 10, 20, 40, 70, 100];

export const DEFAULT_RENT_FILTER: RentFilter = {
  category: 'all',
  minPrice: 0,
  maxPrice: MAX_PRICE,
  areaRange: 'all',
  beds: 'all',
  baths: 'all',
  furnishingStatus: 'all',
  direction: 'all',
  balconyDirection: 'all',
  restroomType: 'all',
  kitchenType: 'all',
  accessType: 'all',
  legalStatus: 'all',
  hasMezzanine: false,
  hasRooftop: false,
  hasGarage: false,
  hasVideoOnly: false,
  sortBy: 'newest',
  searchQuery: '',
};

export const RENT_CATEGORIES: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'house', label: 'Nhà nguyên căn' },
  { id: 'apartment', label: 'Căn hộ chung cư' },
  { id: 'room', label: 'Phòng trọ' },
];

export const AREA_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả diện tích' },
  { id: 'under_30', label: 'Dưới 30 m²' },
  { id: '30_50', label: '30 - 50 m²' },
  { id: '50_80', label: '50 - 80 m²' },
  { id: '80_100', label: '80 - 100 m²' },
  { id: '100_150', label: '100 - 150 m²' },
  { id: '150_200', label: '150 - 200 m²' },
  { id: '200_250', label: '200 - 250 m²' },
  { id: 'over_250', label: 'Trên 250 m²' },
];

export const BEDS_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: '1', label: '1 PN' },
  { id: '2', label: '2 PN' },
  { id: '3', label: '3+ PN' },
];

export const BATHS_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: '1', label: '1 WC' },
  { id: '2', label: '2 WC' },
  { id: '3', label: '3+ WC' },
];

export const FURNISHING_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'UNFURNISHED', label: 'Bàn giao thô' },
  { id: 'BASIC', label: 'Nội thất cơ bản' },
  { id: 'FULLY_FURNISHED', label: 'Đầy đủ nội thất' },
];

export const DIRECTION_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả hướng' },
  { id: 'EAST', label: 'Đông' },
  { id: 'WEST', label: 'Tây' },
  { id: 'SOUTH', label: 'Nam' },
  { id: 'NORTH', label: 'Bắc' },
  { id: 'SOUTH_EAST', label: 'Đông Nam' },
  { id: 'NORTH_EAST', label: 'Đông Bắc' },
  { id: 'SOUTH_WEST', label: 'Tây Nam' },
  { id: 'NORTH_WEST', label: 'Tây Bắc' },
];

export const RESTROOM_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'PRIVATE', label: 'Khép kín (Riêng)' },
  { id: 'SHARED', label: 'Dùng chung' },
];

export const KITCHEN_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'PRIVATE', label: 'Bếp riêng' },
  { id: 'SHARED', label: 'Bếp chung' },
  { id: 'NONE', label: 'Không nấu ăn' },
];

export const ACCESS_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'PRIVATE', label: 'Lối đi riêng' },
  { id: 'SHARED', label: 'Đi chung' },
];

export const LEGAL_OPTIONS: RentOption[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'PINK_BOOK', label: 'Sổ hồng / Sổ đỏ' },
  { id: 'CONTRACT', label: 'Hợp đồng mua bán' },
  { id: 'PENDING', label: 'Đang chờ cấp sổ' },
];

export const SORT_OPTIONS: RentOption[] = [
  { id: 'newest', label: 'Tin mới nhất' },
  { id: 'price_asc', label: 'Giá thấp đến cao' },
  { id: 'price_desc', label: 'Giá cao đến thấp' },
  { id: 'area_desc', label: 'Diện tích lớn nhất' },
];

// Web `allowed` lists (lib/rent-filter-state.ts): values the API accepts, UI list is a subset.
const ids = (options: RentOption[]) => options.map((option) => option.id);
const DIRECTION_IDS = ids(DIRECTION_OPTIONS);
const ALLOWED = {
  category: ids(RENT_CATEGORIES),
  areaRange: ids(AREA_OPTIONS),
  beds: ['all', '1', '2', '3'],
  baths: ['all', '1', '2', '3'],
  furnishingStatus: [
    'all',
    'UNFURNISHED',
    'BASIC',
    'PARTIALLY_FURNISHED',
    'FULLY_FURNISHED',
    'LUXURY',
  ],
  direction: DIRECTION_IDS,
  balconyDirection: DIRECTION_IDS,
  restroomType: ['all', 'PRIVATE', 'SHARED'],
  kitchenType: ['all', 'PRIVATE', 'SHARED', 'NONE'],
  accessType: ['all', 'PRIVATE', 'SHARED'],
  legalStatus: ['all', 'PINK_BOOK', 'CONTRACT', 'PENDING'],
  sortBy: ids(SORT_OPTIONS),
};

const API_CATEGORY: Record<string, string> = {
  apartment: 'APARTMENT',
  house: 'HOUSE',
  room: 'ROOM',
};

// Web page.tsx "Map area range".
const AREA_BOUNDS: Record<string, { areaMin?: number; areaMax?: number }> = {
  under_30: { areaMax: 30 },
  '30_50': { areaMin: 30, areaMax: 50 },
  '50_80': { areaMin: 50, areaMax: 80 },
  '80_100': { areaMin: 80, areaMax: 100 },
  '100_150': { areaMin: 100, areaMax: 150 },
  '150_200': { areaMin: 150, areaMax: 200 },
  '200_250': { areaMin: 200, areaMax: 250 },
  over_250: { areaMin: 250 },
};

export type RentSection =
  | 'price'
  | 'area'
  | 'beds'
  | 'baths'
  | 'furnishing'
  | 'direction' // main door + balcony
  | 'legal'
  | 'houseFeatures' // rooftop, garage, access type
  | 'roomFeatures'; // restroom, kitchen, mezzanine

const isCategory = (value: unknown): value is RentCategory =>
  typeof value === 'string' && ALLOWED.category.includes(value);

/** Filter groups shown in the advanced panel, in web order. Mirrors the show* flags of RentFilterSidebar. */
export function visibleSections(category: RentCategory): RentSection[] {
  const c = isCategory(category) ? category : 'all';
  const sections: RentSection[] = ['price', 'area'];
  if (c === 'all' || c === 'apartment' || c === 'house') sections.push('beds', 'baths');
  if (c !== 'all') sections.push('furnishing');
  if (c === 'apartment') sections.push('direction');
  if (c === 'apartment' || c === 'house') sections.push('legal');
  if (c === 'house') sections.push('houseFeatures');
  if (c === 'room') sections.push('roomFeatures');
  return sections;
}

/** Web handleCategoryChange: set category, reset type-specific sub-filters. Beds survive unless switching to room. */
export function changeCategory(filter: RentFilter, category: string): RentFilter {
  if (!isCategory(category)) return filter;
  return {
    ...filter,
    category,
    beds: category === 'room' ? 'all' : filter.beds,
    baths: 'all',
    furnishingStatus: 'all',
    direction: 'all',
    balconyDirection: 'all',
    restroomType: 'all',
    kitchenType: 'all',
    accessType: 'all',
    legalStatus: 'all',
    hasMezzanine: false,
    hasRooftop: false,
    hasGarage: false,
  };
}

const notAll = (value: string) => Boolean(value) && value !== 'all';

/** Same counting as the web "Áp dụng bộ lọc" badge (video, sort and keyword are not counted). */
export function activeFilterCount(filter: RentFilter): number {
  return [
    filter.category !== 'all',
    filter.minPrice > 0 || filter.maxPrice < MAX_PRICE,
    filter.areaRange !== 'all',
    filter.beds !== 'all',
    filter.baths !== 'all',
    notAll(filter.furnishingStatus),
    notAll(filter.direction),
    notAll(filter.balconyDirection),
    notAll(filter.restroomType),
    notAll(filter.kitchenType),
    notAll(filter.accessType),
    notAll(filter.legalStatus),
    filter.hasMezzanine,
    filter.hasRooftop,
    filter.hasGarage,
  ].filter(Boolean).length;
}

const pick = <T extends string>(value: unknown, allowed: string[], fallback: T) =>
  (typeof value === 'string' && allowed.includes(value) ? value : fallback) as T;
const validPrice = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_PRICE
    ? value
    : fallback;

/** Drops values the web would not accept (web readRentState): unknown ids, out-of-range price, min > max. */
export function sanitizeRentFilter(filter: Partial<RentFilter>): RentFilter {
  const d = DEFAULT_RENT_FILTER;
  const next: RentFilter = {
    category: pick(filter.category, ALLOWED.category, d.category),
    minPrice: validPrice(filter.minPrice, d.minPrice),
    maxPrice: validPrice(filter.maxPrice, d.maxPrice),
    areaRange: pick(filter.areaRange, ALLOWED.areaRange, d.areaRange),
    beds: pick(filter.beds, ALLOWED.beds, d.beds),
    baths: pick(filter.baths, ALLOWED.baths, d.baths),
    furnishingStatus: pick(filter.furnishingStatus, ALLOWED.furnishingStatus, d.furnishingStatus),
    direction: pick(filter.direction, ALLOWED.direction, d.direction),
    balconyDirection: pick(filter.balconyDirection, ALLOWED.balconyDirection, d.balconyDirection),
    restroomType: pick(filter.restroomType, ALLOWED.restroomType, d.restroomType),
    kitchenType: pick(filter.kitchenType, ALLOWED.kitchenType, d.kitchenType),
    accessType: pick(filter.accessType, ALLOWED.accessType, d.accessType),
    legalStatus: pick(filter.legalStatus, ALLOWED.legalStatus, d.legalStatus),
    hasMezzanine: filter.hasMezzanine === true,
    hasRooftop: filter.hasRooftop === true,
    hasGarage: filter.hasGarage === true,
    hasVideoOnly: filter.hasVideoOnly === true,
    sortBy: pick(filter.sortBy, ALLOWED.sortBy, d.sortBy),
    searchQuery:
      typeof filter.searchQuery === 'string' ? filter.searchQuery.slice(0, 255).trim() : '',
  };
  if (next.minPrice > next.maxPrice) {
    next.minPrice = d.minPrice;
    next.maxPrice = d.maxPrice;
  }
  return next;
}

export type RentQueryParams = Record<string, string | number | boolean>;

/** Query for GET /api/v1/public/listings, same names/mapping as web app/rent/page.tsx getPublicListings({...}). */
export function toQueryParams(
  input: Partial<RentFilter>,
  options: { page?: number; size?: number; cityId?: string; wardId?: string } = {}
): RentQueryParams {
  const f = sanitizeRentFilter(input);
  const params: RentQueryParams = {};
  if (options.page !== undefined) params.page = options.page;
  if (options.size !== undefined) params.size = options.size;
  if (API_CATEGORY[f.category]) params.category = API_CATEGORY[f.category];
  if (f.minPrice > 0) params.priceMin = Math.round(f.minPrice * 1_000_000);
  if (f.maxPrice < MAX_PRICE) params.priceMax = Math.round(f.maxPrice * 1_000_000);
  Object.assign(params, AREA_BOUNDS[f.areaRange]);
  if (f.beds !== 'all') params.bedrooms = parseInt(f.beds, 10);
  if (f.baths !== 'all') params.bathrooms = parseInt(f.baths, 10);
  if (f.hasVideoOnly) params.hasVideo = true;
  for (const key of [
    'furnishingStatus',
    'direction',
    'balconyDirection',
    'restroomType',
    'kitchenType',
    'accessType',
    'legalStatus',
  ] as const) {
    if (f[key] !== 'all') params[key] = f[key];
  }
  if (f.hasMezzanine) params.hasMezzanine = true;
  if (f.hasRooftop) params.hasRooftop = true;
  if (f.hasGarage) params.hasGarage = true;
  if (options.cityId) {
    params.cityId = options.cityId;
    if (options.wardId) params.wardId = options.wardId; // web: ward only counts under a selected city
  }
  if (f.searchQuery) params.keyword = f.searchQuery;
  params.sort = f.sortBy;
  return params;
}

const WEB_CATEGORY: Record<string, RentCategory> = {
  HOUSE: 'house',
  APARTMENT: 'apartment',
  ROOM: 'room',
};

/** Home screen "browse" params ({cityId, wardId, category: API enum, keyword}) -> initial filter + location. */
export function rentSeedFromBrowse(params: Record<string, string | number>) {
  const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));
  return {
    cityId: text(params.cityId),
    wardId: text(params.cityId) ? text(params.wardId) : '',
    filter: sanitizeRentFilter({
      category: WEB_CATEGORY[text(params.category)] ?? 'all',
      searchQuery: text(params.keyword),
    }),
  };
}
