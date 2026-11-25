const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Expectations are taken from the web app (hs-web-app): components/rent/RentFilterSidebar.tsx,
// lib/rent-filter-state.ts and app/rent/page.tsx.
function load(file) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { exports: module.exports });
  return module.exports;
}

const lib = load('lib/rent-filter.ts');
const {
  DEFAULT_RENT_FILTER: DEFAULTS,
  visibleSections,
  changeCategory,
  activeFilterCount,
  toQueryParams,
  sanitizeRentFilter,
  rentSeedFromBrowse,
} = lib;
// Objects built inside the vm have another realm's prototypes; compare as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));
const withFilter = (patch) => ({ ...plain(DEFAULTS), ...patch });
const query = (patch, options) => plain(toQueryParams(withFilter(patch), options));

test('defaults match the web DEFAULT_RENT_FILTER', () => {
  assert.deepEqual(plain(DEFAULTS), {
    category: 'all',
    minPrice: 0,
    maxPrice: 100,
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
  });
  assert.deepEqual(
    plain(lib.RENT_CATEGORIES).map((item) => item.label),
    ['Tất cả', 'Nhà nguyên căn', 'Căn hộ chung cư', 'Phòng trọ']
  );
  assert.equal(lib.AREA_OPTIONS.length, 9);
  assert.equal(activeFilterCount(DEFAULTS), 0);
});

test('visible sections per category follow the web show* flags', () => {
  const sections = (category) => plain(visibleSections(category));
  assert.deepEqual(sections('all'), ['price', 'area', 'beds', 'baths']);
  assert.deepEqual(sections('house'), [
    'price',
    'area',
    'beds',
    'baths',
    'furnishing',
    'legal',
    'houseFeatures',
  ]);
  assert.deepEqual(sections('apartment'), [
    'price',
    'area',
    'beds',
    'baths',
    'furnishing',
    'direction',
    'legal',
  ]);
  assert.deepEqual(sections('room'), ['price', 'area', 'furnishing', 'roomFeatures']);
  assert.deepEqual(sections('office'), sections('all'));
});

test('changeCategory resets sub-filters like web handleCategoryChange', () => {
  const dirty = withFilter({
    category: 'apartment',
    minPrice: 5,
    maxPrice: 20,
    areaRange: '50_80',
    beds: '2',
    baths: '2',
    furnishingStatus: 'BASIC',
    direction: 'EAST',
    balconyDirection: 'WEST',
    restroomType: 'PRIVATE',
    kitchenType: 'SHARED',
    accessType: 'PRIVATE',
    legalStatus: 'PINK_BOOK',
    hasMezzanine: true,
    hasRooftop: true,
    hasGarage: true,
    hasVideoOnly: true,
    sortBy: 'price_asc',
    searchQuery: 'quận 1',
  });
  const kept = {
    minPrice: 5,
    maxPrice: 20,
    areaRange: '50_80',
    hasVideoOnly: true,
    sortBy: 'price_asc',
    searchQuery: 'quận 1',
  };
  const resets = {
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
  for (const category of ['all', 'house', 'apartment']) {
    // beds survive unless the target is a room
    assert.deepEqual(plain(changeCategory(dirty, category)), {
      ...kept,
      ...resets,
      category,
      beds: '2',
    });
  }
  assert.deepEqual(plain(changeCategory(dirty, 'room')), {
    ...kept,
    ...resets,
    category: 'room',
    beds: 'all',
  });
  assert.equal(dirty.beds, '2', 'input is not mutated');
  assert.equal(changeCategory(dirty, 'office'), dirty, 'unknown category is ignored');
});

test('activeFilterCount counts each group like the web badge', () => {
  const count = (patch) => activeFilterCount(withFilter(patch));
  const groups = [
    { category: 'house' },
    { minPrice: 1 },
    { maxPrice: 99 },
    { areaRange: 'under_30' },
    { beds: '1' },
    { baths: '3' },
    { furnishingStatus: 'BASIC' },
    { direction: 'EAST' },
    { balconyDirection: 'EAST' },
    { restroomType: 'SHARED' },
    { kitchenType: 'NONE' },
    { accessType: 'PRIVATE' },
    { legalStatus: 'PENDING' },
    { hasMezzanine: true },
    { hasRooftop: true },
    { hasGarage: true },
  ];
  for (const patch of groups) assert.equal(count(patch), 1, JSON.stringify(patch));
  assert.equal(count({ minPrice: 5, maxPrice: 10 }), 1, 'price range is one group');
  assert.equal(count({ minPrice: 0, maxPrice: 100 }), 0);
  assert.equal(count({ category: 'all', areaRange: 'all', beds: 'all' }), 0);
  assert.equal(count({ hasVideoOnly: true, sortBy: 'price_desc', searchQuery: 'abc' }), 0);
  assert.equal(count({ category: 'room', beds: '2', baths: '1', hasGarage: true }), 4);
  // minPrice + maxPrice share one group, so 16 patches give 15 groups
  assert.equal(count(Object.assign({}, ...groups, { category: 'apartment' })), 15);
});

test('toQueryParams: defaults only send sort/page/size/location', () => {
  assert.deepEqual(query({}), { sort: 'newest' });
  assert.deepEqual(query({}, { page: 1, size: 12, cityId: '79' }), {
    page: 1,
    size: 12,
    cityId: '79',
    sort: 'newest',
  });
});

test('toQueryParams: categories and typical filters', () => {
  assert.equal(query({ category: 'house' }).category, 'HOUSE');
  assert.equal(query({ category: 'apartment' }).category, 'APARTMENT');
  assert.equal(query({ category: 'room' }).category, 'ROOM');
  assert.equal('category' in query({ category: 'all' }), false);

  assert.deepEqual(
    query(
      {
        category: 'apartment',
        beds: '3',
        baths: '2',
        furnishingStatus: 'FULLY_FURNISHED',
        direction: 'SOUTH_EAST',
        balconyDirection: 'NORTH',
        legalStatus: 'PINK_BOOK',
      },
      { page: 2, size: 12, cityId: '01' }
    ),
    {
      page: 2,
      size: 12,
      category: 'APARTMENT',
      bedrooms: 3,
      bathrooms: 2,
      furnishingStatus: 'FULLY_FURNISHED',
      direction: 'SOUTH_EAST',
      balconyDirection: 'NORTH',
      legalStatus: 'PINK_BOOK',
      cityId: '01',
      sort: 'newest',
    }
  );
  assert.deepEqual(
    query({
      category: 'house',
      hasRooftop: true,
      hasGarage: true,
      accessType: 'PRIVATE',
      hasVideoOnly: true,
      sortBy: 'area_desc',
    }),
    {
      category: 'HOUSE',
      hasRooftop: true,
      hasGarage: true,
      accessType: 'PRIVATE',
      hasVideo: true,
      sort: 'area_desc',
    }
  );
  assert.deepEqual(
    query({
      category: 'room',
      restroomType: 'SHARED',
      kitchenType: 'NONE',
      hasMezzanine: true,
      furnishingStatus: 'UNFURNISHED',
      sortBy: 'price_desc',
    }),
    {
      category: 'ROOM',
      restroomType: 'SHARED',
      kitchenType: 'NONE',
      hasMezzanine: true,
      furnishingStatus: 'UNFURNISHED',
      sort: 'price_desc',
    }
  );
});

test('toQueryParams: price maps millions to VND and ignores the 0 / 100 bounds', () => {
  assert.deepEqual(query({ minPrice: 5 }), { priceMin: 5_000_000, sort: 'newest' });
  assert.deepEqual(query({ maxPrice: 20 }), { priceMax: 20_000_000, sort: 'newest' });
  assert.deepEqual(query({ minPrice: 5, maxPrice: 20 }), {
    priceMin: 5_000_000,
    priceMax: 20_000_000,
    sort: 'newest',
  });
  assert.deepEqual(query({ minPrice: 0, maxPrice: 100 }), { sort: 'newest' });
  assert.equal(query({ maxPrice: 99 }).priceMax, 99_000_000);
  assert.equal(query({ minPrice: 0.5 }).priceMin, 500_000);
  // min > max falls back to the full range (web readRentState)
  assert.deepEqual(query({ minPrice: 30, maxPrice: 10 }), { sort: 'newest' });
});

test('toQueryParams: area ranges incl. boundaries', () => {
  const area = (areaRange) => {
    const { areaMin, areaMax } = query({ areaRange });
    return [areaMin, areaMax];
  };
  assert.deepEqual(area('all'), [undefined, undefined]);
  assert.deepEqual(area('under_30'), [undefined, 30]);
  assert.deepEqual(area('30_50'), [30, 50]);
  assert.deepEqual(area('50_80'), [50, 80]);
  assert.deepEqual(area('80_100'), [80, 100]);
  assert.deepEqual(area('100_150'), [100, 150]);
  assert.deepEqual(area('150_200'), [150, 200]);
  assert.deepEqual(area('200_250'), [200, 250]);
  assert.deepEqual(area('over_250'), [250, undefined]);
});

test('toQueryParams: sort, video, keyword, ward and city', () => {
  for (const sort of ['newest', 'price_asc', 'price_desc', 'area_desc'])
    assert.equal(query({ sortBy: sort }).sort, sort);
  assert.equal(query({ hasVideoOnly: false }).hasVideo, undefined);
  assert.equal(query({ hasVideoOnly: true }).hasVideo, true);

  assert.equal(query({ searchQuery: '   căn hộ  quận 7  ' }).keyword, 'căn hộ  quận 7');
  assert.equal(query({ searchQuery: '   ' }).keyword, undefined);
  assert.equal(query({ searchQuery: '' }).keyword, undefined);
  assert.equal(query({ searchQuery: 'a&b=c#?%/\\"<>' }).keyword, 'a&b=c#?%/\\"<>');
  assert.equal(query({ searchQuery: 'x'.repeat(300) }).keyword.length, 255);

  assert.deepEqual(query({}, { cityId: '79', wardId: '26734' }), {
    cityId: '79',
    wardId: '26734',
    sort: 'newest',
  });
  assert.deepEqual(query({}, { cityId: '79', wardId: '' }), { cityId: '79', sort: 'newest' });
  // a ward never travels without its city
  assert.deepEqual(query({}, { cityId: '', wardId: '26734' }), { sort: 'newest' });
});

test('invalid values are dropped', () => {
  const bad = {
    category: 'office',
    minPrice: -1,
    maxPrice: 1000,
    areaRange: '1_2',
    beds: '9',
    baths: 'x',
    furnishingStatus: 'GOLD',
    direction: 'UP',
    balconyDirection: 'DOWN',
    restroomType: 'NONE',
    kitchenType: 'OPEN',
    accessType: 'NONE',
    legalStatus: 'RED',
    hasMezzanine: 'true',
    hasRooftop: 1,
    hasGarage: 'yes',
    hasVideoOnly: 'true',
    sortBy: 'area_asc',
    searchQuery: 42,
  };
  assert.deepEqual(plain(sanitizeRentFilter(bad)), plain(DEFAULTS));
  assert.deepEqual(plain(toQueryParams(bad)), { sort: 'newest' });
  assert.equal(query({ minPrice: NaN }).priceMin, undefined);
  // Values the API accepts but the picker does not list stay valid (web allowed list)
  assert.equal(query({ furnishingStatus: 'LUXURY' }).furnishingStatus, 'LUXURY');
  assert.equal(
    query({ furnishingStatus: 'PARTIALLY_FURNISHED' }).furnishingStatus,
    'PARTIALLY_FURNISHED'
  );
});

test('home browse params seed category, keyword and location', () => {
  const seed = (params) => plain(rentSeedFromBrowse(params));
  assert.deepEqual(seed({ cityId: '79', wardId: '26734', category: 'APARTMENT' }), {
    cityId: '79',
    wardId: '26734',
    filter: { ...plain(DEFAULTS), category: 'apartment' },
  });
  assert.equal(seed({ cityId: '01', category: 'OFFICE' }).filter.category, 'all');
  assert.equal(seed({ cityId: '01', category: 'ROOM' }).filter.category, 'room');
  assert.equal(seed({ cityId: '01', keyword: '  q7 ' }).filter.searchQuery, 'q7');
  assert.equal(seed({ wardId: '5' }).wardId, '', 'ward without city is dropped');
  assert.equal(seed({}).cityId, '');
});
