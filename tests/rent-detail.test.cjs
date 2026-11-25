const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// The mobile listing detail is a port of the web one; every comparison below loads the real web
// modules from ../../hs-web-app and the mobile modules from ../src and diffs their output.
const WEB = path.resolve(__dirname, '../../hs-web-app');
const MOBILE_SRC = path.resolve(__dirname, '../src');

function loader(root) {
  const cache = new Map();
  function resolve(from, request) {
    const base = request.startsWith('@/')
      ? path.join(root, request.slice(2))
      : path.resolve(path.dirname(from), request);
    return `${base}.ts`;
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(file, module);
    vm.runInNewContext(source, {
      exports: module.exports,
      require: (request) => load(resolve(file, request)),
      Buffer,
      URL,
    });
    return module.exports;
  }
  return (request) => load(resolve(path.join(root, 'x'), request));
}

const web = loader(WEB);
const mobile = loader(MOBILE_SRC);
const webSections = web('@/lib/rent-detail-sections');
const webProperty = web('@/lib/listing-to-rent-property');
const webDirections = web('@/lib/nearby-directions');
const webSync = web('@/lib/nearby-sync');
const m = mobile('@/lib/rent-detail');
const nearby = mobile('@/lib/nearby');
// Objects built inside a vm have other realms' prototypes; compare as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));
const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

const address = (extra = {}) => ({
  id: 'a1',
  listingId: 'l1',
  refId: 'vm:1',
  display: '12 Nguyễn Huệ, Phường Bến Nghé, Thành phố Hồ Chí Minh',
  street: '12 Nguyễn Huệ',
  address: '12 Nguyễn Huệ',
  cityId: '79',
  city: 'Thành phố Hồ Chí Minh',
  wardId: '26734',
  ward: 'Phường Bến Nghé',
  latitude: 10.77,
  longitude: 106.7,
  addressNote: null,
  ...extra,
});

const pricing = (extra = {}) => ({
  amount: 14_000_000,
  currency: 'VND',
  unit: 'MONTH',
  negotiable: true,
  depositType: 'MONTH_COUNT',
  depositAmount: null,
  depositMonths: 2,
  paymentCycle: 'MONTHLY',
  minimumLeaseMonths: 6,
  managementFeeIncluded: false,
  ...extra,
});

function listing(category, extra = {}) {
  return {
    id: `id-${category}`,
    ownerId: 'owner-1',
    title: `Tin ${category}`,
    description: 'Mô tả\nchi tiết',
    category,
    subtype: 'X',
    rentalMode: 'WHOLE',
    status: 'PUBLISHED',
    availableFrom: '2026-12-01',
    areaM2: 54.5,
    pricing: pricing(),
    amenities: [{ code: 'POOL', name: 'Hồ bơi' }, { code: 'GYM' }],
    customAmenities: ['Sân BBQ'],
    furnishings: [],
    charges: [],
    policies: [],
    address: address(),
    owner: {
      id: 'owner-1',
      displayName: 'Nguyễn A',
      phone: '0900000000',
      avatarUrl: 'https://x/a.png',
    },
    media: [
      { id: 'v1', mediaType: 'VIDEO', sortOrder: 0, cover: false, url: 'https://x/v.mp4' },
      { id: 'i1', mediaType: 'IMAGE', sortOrder: 1, cover: true, url: 'https://x/1.jpg' },
      { id: 'i2', mediaType: 'IMAGE', sortOrder: 2, cover: false, url: 'https://x/2.jpg' },
      { id: 'i3', mediaType: 'IMAGE', sortOrder: 3, cover: false, url: null },
    ],
    viewingDays: ['MONDAY', 'SUNDAY'],
    viewingSlots: ['MORNING', 'EVENING'],
    updatedAt: hoursAgo(2.5),
    publishedAt: hoursAgo(80),
    createdAt: hoursAgo(100),
    viewCount: 7,
    ...extra,
  };
}

const apartment = listing('APARTMENT', {
  pricing: pricing({
    managementFeeIncluded: true,
    depositType: 'FIXED_AMOUNT',
    depositAmount: 28_000_000,
  }),
  apartmentDetail: {
    projectName: 'Vinhomes',
    buildingBlock: 'S1',
    unitCode: 'S1.1205',
    floorNumber: 12,
    buildingTotalFloors: 40,
    bedroomCount: 2,
    bathroomCount: 2,
    livingRoomCount: 1,
    kitchenCount: 1,
    furnishingStatus: 'FULLY_FURNISHED',
    mainDoorDirection: 'SOUTH_EAST',
    balconyDirection: 'NORTH',
    viewDescription: 'Sông',
    maxOccupants: 4,
    legalStatus: 'PINK_BOOK',
  },
  charges: [
    { chargeType: 'ELECTRICITY', billingMethod: 'PER_KWH', amount: 3500.5, includedInRent: false },
    { chargeType: 'WATER', billingMethod: 'STATE_WATER_RATE', includedInRent: false },
    { chargeType: 'MANAGEMENT', billingMethod: 'INCLUDED', includedInRent: true },
    {
      chargeType: 'OTHER',
      customName: 'Phí ABC',
      billingMethod: 'PER_MONTH',
      amount: 0,
      includedInRent: false,
    },
    {
      chargeType: 'CAR_PARKING',
      billingMethod: 'PER_VEHICLE_MONTH',
      amount: 1_200_000,
      includedInRent: false,
    },
  ],
  furnishings: [
    {
      itemCode: 'BED',
      assetName: 'Giường',
      quantity: 2,
      handoverCondition: 'GOOD',
      conditionNote: 'Mới',
    },
    { itemCode: 'TV', assetName: 'Tivi', quantity: 1, handoverCondition: 'GOOD' },
  ],
  policies: [{ code: 'PET', label: 'Thú cưng', value: 'ALLOWED', displayValue: 'Cho phép' }],
});
const house = listing('HOUSE', {
  pricing: pricing({ negotiable: false, depositType: 'NONE', depositMonths: null }),
  houseDetail: {
    landAreaM2: 80,
    frontageWidthM: 5,
    lengthM: 16,
    accessRoadWidthM: 4,
    frontageCount: 1,
    totalFloors: 3,
    bedroomCount: 4,
    bathroomCount: 3,
    hasRooftop: true,
    hasGarage: false,
    accessType: 'HẺM XE HƠI',
    furnishingStatus: 'UNFURNISHED',
    maxOccupants: 8,
    maxVehicles: 3,
    legalStatus: 'RED_BOOK',
    rentalScopeDescription: 'Cả nhà',
    rentedFloorFrom: 1,
    rentedFloorTo: 3,
  },
  charges: [
    { chargeType: 'MANAGEMENT', billingMethod: 'PER_MONTH', amount: 100000, includedInRent: false },
    { chargeType: 'INTERNET', billingMethod: 'FREE', includedInRent: false },
  ],
  status: 'RESERVED',
});
const room = listing('ROOM', {
  pricing: pricing({ amount: 3_500_000, negotiable: undefined }),
  roomDetail: {
    roomCode: 'P101',
    floorNumber: 1,
    restroomType: 'SHARED',
    kitchenType: 'NONE',
    hasWindow: false,
    hasBalcony: true,
    hasMezzanine: false,
    furnishingStatus: 'BASIC',
    accessType: 'PRIVATE',
    accessHoursType: 'CURFEW',
    electricMeterType: 'PRIVATE',
    waterMeterType: 'SHARED',
    maxOccupants: 2,
    maxVehicles: 2,
    parkingPolicy: 'PAID',
  },
  furnishings: [
    { assetName: 'Quạt', quantity: 3, handoverCondition: 'GOOD' },
    { assetName: 'Tủ', quantity: 1 },
  ],
  viewingDays: [],
  viewingSlots: ['AFTERNOON'],
});
const office = listing('OFFICE', {
  officeDetail: {
    buildingName: 'Tòa A',
    officeGrade: 'GRADE_A',
    expectedSeats: 30,
    restroomCount: 2,
    pantryType: 'NONE',
  },
  status: 'PENDING_REVIEW',
});
const minimal = listing('HOUSE', {
  address: null,
  owner: null,
  media: [],
  description: null,
  pricing: pricing({ amount: null, depositMonths: null }),
  updatedAt: null,
  publishedAt: null,
  createdAt: null,
  viewCount: undefined,
  viewingDays: undefined,
  viewingSlots: undefined,
  amenities: [],
  customAmenities: [],
  status: 'VIOLATION',
});
const fixtures = { apartment, house, room, office, minimal };

// Mobile has no web video proxy, so streamUrl and the unused web-only keys are dropped.
function normalizeWeb(property) {
  const value = plain(property);
  delete value.slug;
  delete value.viewsCount;
  for (const video of value.videos ?? []) delete video.streamUrl;
  for (const item of value.mediaItems ?? []) delete item.streamUrl;
  return value;
}

test('toRentProperty matches the web detail branch for every fixture', () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    assert.deepEqual(
      plain(m.toRentProperty(fixture)),
      normalizeWeb(webProperty.toRentProperty(fixture)),
      name
    );
  }
});

test('toRentProperty details: category label, address location and videos last', () => {
  const property = m.toRentProperty(apartment);
  assert.equal(property.categoryLabel, 'Căn hộ chung cư');
  assert.equal(m.toRentProperty(house).categoryLabel, 'Nhà nguyên căn');
  assert.equal(m.toRentProperty(room).categoryLabel, 'Phòng trọ');
  assert.equal(property.location, apartment.address.display);
  assert.deepEqual(plain(property.mediaItems.map((item) => item.type)), [
    'image',
    'image',
    'video',
  ]);
  assert.equal(property.photosCount, 2);
  assert.equal(property.hasVideo, true);
  assert.equal(m.toRentProperty(minimal).location, '');
});

test('getRentDetailSections matches the web output', () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    const property = webProperty.toRentProperty(fixture);
    assert.deepEqual(
      plain(m.getRentDetailSections(m.toRentProperty(fixture))),
      plain(webSections.getRentDetailSections(property)),
      name
    );
  }
  assert.ok(m.getRentDetailSections(m.toRentProperty(apartment)).length >= 3);
});

test('getRentDetailSections matches the web output for categories toRentProperty never produces', () => {
  const details = {
    pricing: pricing(),
    charges: [{ chargeType: 'MANAGEMENT', includedInRent: true }],
    buildingName: 'B',
    officeGrade: 'ECONOMY',
    handoverStatus: 'FULL',
    operatingMode: 'ALWAYS_OPEN',
    positionType: 'SHOPPING_MALL',
    parkingType: 'MOTORBIKE_AND_CAR',
    accessType: 'SHARED',
    hasMezzanine: true,
    hasThreePhasePower: false,
    restrictedBusinesses: 'Không',
    frontageWidthM: 6,
    availableFrom: '2027-01-01',
    depositAmount: 5_000_000,
  };
  for (const category of ['office', 'commercial', 'studio', 'villa', 'unknown']) {
    assert.deepEqual(
      plain(m.getRentDetailSections({ category, details })),
      plain(webSections.getRentDetailSections({ category, details })),
      category
    );
  }
  assert.deepEqual(plain(m.getRentDetailSections({ category: 'house' })), []);
});

test('formatNumberVi and formatPrice equal the web Intl output', () => {
  const webPrice = (priceMillion) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(priceMillion * 1_000_000);
  for (const value of [0, 0.5, 1, 3.5, 14, 14.5, 99.999, 123.456789, 1250, 0.1 + 0.2, 7.0000004]) {
    assert.equal(m.formatPrice(value), webPrice(value), String(value));
  }
  assert.equal(m.formatPrice(14), '14.000.000 ₫');
  for (const value of [
    0, 1, 999, 1000, 1234.5, 1234567.891, 0.0005, 12.3456, 3500.5, 1e9, -1500.25,
  ]) {
    assert.equal(
      m.formatNumberVi(value),
      new Intl.NumberFormat('vi-VN').format(value),
      String(value)
    );
  }
});

test('formatListingTimeAgo and formatLocationLabel match the web helpers', () => {
  const webTime = web('@/lib/format-time-ago');
  const cases = [
    [],
    [null, undefined, '  '],
    [new Date(Date.now() - 20_000).toISOString()],
    [new Date(Date.now() - 5.5 * 60_000).toISOString()],
    [hoursAgo(2.5)],
    [hoursAgo(36)],
    [hoursAgo(24 * 3.5)],
    [hoursAgo(24 * 15)],
    [hoursAgo(24 * 100)],
    [hoursAgo(24 * 400)],
    ['not a date'],
    [new Date(Date.now() + 3_600_000).toISOString()],
    [null, hoursAgo(5), hoursAgo(9)],
  ];
  for (const candidates of cases) {
    assert.equal(
      m.formatListingTimeAgo(...candidates),
      webTime.formatListingTimeAgo(...candidates)
    );
  }
  // formatLocationLabel is a private helper of RentDetailView.tsx; expected values from its regex.
  assert.equal(m.formatLocationLabel('Thành phố Hồ Chí Minh'), 'Hồ Chí Minh');
  // Web quirk kept on purpose: `p\.?` precedes `phường` in the alternation, so only "P" is stripped.
  assert.equal(m.formatLocationLabel('Phường Bến Nghé'), 'hường Bến Nghé');
  assert.equal(m.formatLocationLabel('Tỉnh Đồng Nai'), 'Đồng Nai');
  assert.equal(m.formatLocationLabel('Xã Tân Phú'), 'Tân Phú');
  assert.equal(m.formatLocationLabel('Quận 1'), 'Quận 1');
});

test('quick metrics follow RentDetailView', () => {
  const metrics = (fixture) => plain(m.getQuickMetrics(m.toRentProperty(fixture)));
  assert.deepEqual(metrics(apartment), [
    { icon: 'area', label: 'Diện tích', value: '54.5 m²' },
    { icon: 'bed', label: 'Phòng ngủ', value: '2 PN' },
    { icon: 'bath', label: 'Phòng tắm / WC', value: '2 WC' },
  ]);
  assert.deepEqual(metrics(room).slice(1), [
    { icon: 'users', label: 'Tối đa', value: '2 người' },
    { icon: 'bath', label: 'Phòng tắm / WC', value: 'Chung WC' },
  ]);
  // OFFICE listings are mapped to the "room" category, so no seat metric appears.
  assert.deepEqual(metrics(office)[1], {
    icon: 'building',
    label: 'Loại hình',
    value: 'Phòng trọ',
  });
  assert.equal(metrics(office)[2].value, '2 WC');
  assert.equal(metrics(minimal)[2].value, '1 WC');
  const seats = m.getQuickMetrics({ ...m.toRentProperty(office), category: 'office' });
  assert.deepEqual(plain(seats[1]), { icon: 'building', label: 'Chỗ ngồi', value: '30 chỗ' });
  const commercial = m.getQuickMetrics({
    ...m.toRentProperty(office),
    category: 'commercial',
    details: { frontageWidthM: 6 },
  });
  assert.deepEqual(plain(commercial[1]), { icon: 'building', label: 'Mặt tiền', value: '6 m' });
});

test('extras: negotiable, amenities, furnishing branches, viewing and highlights', () => {
  const extras = (fixture) => m.getRentDetailExtras(m.toRentProperty(fixture));
  const apt = extras(apartment);
  assert.equal(apt.isNegotiable, true);
  assert.equal(apt.publicListing, true);
  assert.equal(apt.acceptsNewRequests, true);
  assert.deepEqual(plain(apt.amenities), ['Hồ bơi', 'GYM', 'Sân BBQ']);
  assert.equal(apt.furnishing.kind, 'table');
  assert.equal(apt.furnishing.rows.length, 2);
  assert.deepEqual(plain(apt.highlights), ['2 ảnh thực tế']);
  assert.deepEqual(plain(apt.viewingDays), ['MONDAY', 'SUNDAY']);
  assert.equal(m.VIEWING_SLOT_LABELS.MORNING, 'Buổi sáng (08:00–12:00)');
  assert.equal(m.VIEWING_DAY_LABELS.SUNDAY, 'Chủ nhật');

  const h = extras(house);
  assert.equal(h.isNegotiable, false);
  assert.equal(h.publicListing, true);
  assert.equal(h.acceptsNewRequests, false);
  assert.equal(h.furnishing.kind, 'note');
  assert.match(h.furnishing.text, /^Không có nội thất bàn giao kèm theo/);

  const min = extras(minimal);
  assert.match(min.furnishing.text, /^Chủ nhà chưa cung cấp danh sách nội thất/);
  assert.equal(min.publicListing, false);
  assert.deepEqual(plain(min.highlights), []);
  assert.deepEqual(plain(min.amenities), []);
  assert.equal(
    m.getRentDetailExtras({ ...m.toRentProperty(office), category: 'office', details: {} })
      .furnishing.kind,
    'none'
  );
});

test('toChatListing builds the same payload as the web chatListing', () => {
  const property = m.toRentProperty(apartment);
  assert.deepEqual(plain(m.toChatListing(property, 'https://x/1.jpg')), {
    id: 'id-APARTMENT',
    title: 'Tin APARTMENT',
    price: '14.000.000 ₫',
    location: apartment.address.display,
    image: 'https://x/1.jpg',
    bedrooms: 2,
    area: 54.5,
    verified: true,
  });
});

test('nearby directions urls equal the web helpers', () => {
  const points = [
    { latitude: 10.77, longitude: 106.7 },
    { latitude: -33.8688, longitude: 151.2093 },
    { latitude: 91, longitude: 0 },
    { latitude: 10, longitude: 181 },
    { latitude: NaN, longitude: 1 },
    { latitude: undefined, longitude: 1 },
    null,
    undefined,
  ];
  for (const origin of points) {
    assert.equal(
      nearby.currentLocationDirectionsUrl(origin),
      webDirections.currentLocationDirectionsUrl(origin)
    );
    for (const destination of points) {
      assert.equal(
        nearby.nearbyDirectionsUrl(origin, destination),
        webDirections.nearbyDirectionsUrl(origin, destination)
      );
    }
    assert.equal(nearby.validCoordinates(origin), webDirections.validCoordinates(origin));
  }
});

test('nearby constants and sync helpers match the web', async () => {
  const webTypes = web('@/types/nearby.type');
  assert.equal(nearby.NEARBY_RADIUS_METERS, webTypes.NEARBY_RADIUS_METERS);
  assert.equal(nearby.NEARBY_PAGE_SIZE, webTypes.NEARBY_PAGE_SIZE);
  assert.deepEqual(plain(nearby.NEARBY_GROUPS), plain(webTypes.NEARBY_GROUPS));
  for (const status of [undefined, 'PENDING', 'RUNNING', 'RETRY_WAIT', 'DONE', 'FAILED']) {
    assert.equal(nearby.isNearbySyncPending(status), webSync.isNearbySyncPending(status));
  }
  const page = { enabled: true, items: [], total: 0, page: 1, size: 5, coverage: { groups: [] } };
  const received = [];
  await new Promise((resolve) => {
    nearby.watchNearbySync(
      async () => page,
      (data, watching) => {
        received.push(watching);
        resolve();
      },
      () => resolve(),
      new AbortController().signal
    );
  });
  assert.deepEqual(received, [false]);
  let failed = 0;
  await new Promise((resolve) => {
    nearby.watchNearbySync(
      async () => {
        throw new Error('x');
      },
      () => {},
      () => {
        failed += 1;
        resolve();
      },
      new AbortController().signal
    );
  });
  assert.equal(failed, 1);
});
