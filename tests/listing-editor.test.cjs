const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// The mobile modules are compared with the real web sources (hs-web-app next to this app).
const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, '../hs-web-app');
const EDITOR = 'app/dashboard/properties/new';

function loader(base, stubs = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = ts.transpileModule(fs.readFileSync(path.join(base, file), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const mod = { exports: {} };
    cache.set(file, mod);
    const resolve = (name) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith('@/')) {
        const target = (base === ROOT ? 'src/' : '') + name.slice(2);
        return name.endsWith('.json') ? require(path.join(base, target)) : load(`${target}.ts`);
      }
      if (name.startsWith('.'))
        return load(`${path.posix.join(path.posix.dirname(file), name)}.ts`);
      return require(name);
    };
    // Same realm, so deepStrictEqual compares plain objects.
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(
      resolve,
      mod,
      mod.exports
    );
    return mod.exports;
  }
  return load;
}
const mobile = loader(ROOT);
const web = loader(WEB);

const form = mobile('src/lib/listing-form.ts');
const editor = mobile('src/lib/listing-editor.ts');
const mapper = mobile('src/lib/listing-form-map.ts');
const payload = mobile('src/lib/listing-payload.ts');
const validation = mobile('src/lib/listing-validation.ts');
const policy = mobile('src/lib/listing-policy.ts');
const media = mobile('src/lib/listing-media.ts');
const description = mobile('src/lib/listing-description.ts');
const quota = mobile('src/lib/listing-quota.ts');
const fields = mobile('src/lib/listing-fields.ts');
const webPayload = web(`${EDITOR}/utils/buildListingPayload.ts`);
const webMapper = web(`${EDITOR}/utils/mapListingDetailToFormState.ts`);
const webConstants = web(`${EDITOR}/constants.ts`);
const webDescription = web('lib/listing-description-request.ts');
const webSuggestions = web('lib/listing-policy-suggestions.ts');

const json = (value) => JSON.parse(JSON.stringify(value));
const TODAY = '2026-11-26';
const CATEGORIES = ['apartment', 'house', 'room'];

/** A function of the web editor component, run with the given closure variables. */
function webEditorFunction(name, context) {
  const source = fs.readFileSync(path.join(WEB, EDITOR, 'ListingEditor.tsx'), 'utf8');
  const ast = ts.createSourceFile(
    'editor.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let found;
  (function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  })(ast);
  assert.ok(found, name);
  const js = ts.transpileModule(`${found.getText(ast)};globalThis.result=${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, context);
  return context.result;
}

const catalog = {
  category: 'ROOM',
  amenities: [{ code: 'WIFI', name: 'Wifi' }],
  furnishings: [{ code: 'BED', name: 'Giường' }],
  policies: [
    { code: 'petPolicy', label: 'Thú cưng', valueType: 'PERMISSION', required: true },
    { code: 'depositRefundDays', label: 'Hoàn cọc', valueType: 'INTEGER', required: true },
  ],
};
const savedAddress = {
  id: 'addr-1',
  refId: 'ref-saved',
  street: 'Lê Lợi',
  ward: 'P1',
  city: 'HCM',
};

function filled(category) {
  const state = form.createListingForm({ today: TODAY });
  Object.assign(state.basicInfo, {
    category,
    title: '  Tin cho thuê thử nghiệm  ',
    description: 'Mô tả đủ dài cho tin cho thuê thử nghiệm này.',
    images: [{ name: 'a.jpg', uri: 'file:///a.jpg', storageObjectId: 's-img' }],
  });
  Object.assign(state.apartmentDetails, {
    projectName: ' Dự án ',
    areaM2: '75',
    floor: '0',
    view: ' Sông ',
  });
  Object.assign(state.houseDetails, {
    totalUsableAreaM2: '180',
    hasGarage: true,
    privateEntrance: 'SHARED',
  });
  Object.assign(state.roomDetails, {
    areaM2: '25',
    roomCode: ' P1 ',
    hasLoft: true,
    kitchenType: 'NONE',
  });
  state.furnishingAssets = [{ ...form.emptyFurnishingRow(), assetName: ' Giường ', quantity: '2' }];
  state.selectedAmenities = ['WIFI', 'PETS_ALLOWED', 'Sân phơi'];
  state.listingPolicies = [{ code: 'petPolicy', value: 'ALLOWED', note: ' ghi chú ' }];
  Object.assign(state.monthlyExpenses, {
    managementFeeType: 'PER_M2',
    managementFee: '15000',
    customFees: [{ ...form.newCustomFee(), name: '', amount: '50000' }],
  });
  state.pricing.priceMonthly = '5000000';
  state.selectedViewingDays = ['MONDAY'];
  state.selectedViewingSlots = ['MORNING'];
  state.selectedAddress = { refId: 'ref-new', addressNote: 'Hẻm 1' };
  return state;
}

function detailOf(category) {
  const code = category.toUpperCase();
  return {
    id: 'listing-1',
    title: 'Tin đã đăng trên hệ thống',
    description: 'Mô tả đủ dài của tin đã đăng trên hệ thống.',
    category: code,
    status: 'PUBLISHED',
    pendingEditId: null,
    branchId: 'branch-1',
    availableFrom: '2027-01-01',
    areaM2: 42,
    maxMotorbikeCount: 2,
    maxCarCount: 0,
    pricing: {
      amount: 7000000,
      unit: code === 'ROOM' ? 'PERSON_MONTH' : 'MONTH',
      negotiable: true,
      depositType: 'FIXED_AMOUNT',
      depositAmount: 3000000,
      depositMonths: null,
      minimumLeaseMonths: 12,
    },
    apartmentDetail:
      code === 'APARTMENT'
        ? {
            projectName: 'DA',
            unitCode: 'A1',
            floorNumber: 0,
            bedroomCount: 0,
            bathroomCount: 2,
            furnishingStatus: 'PARTIALLY_FURNISHED',
            legalStatus: 'CONTRACT',
            mainDoorDirection: 'EAST',
          }
        : null,
    houseDetail:
      code === 'HOUSE'
        ? {
            totalFloors: 3,
            bedroomCount: 4,
            bathroomCount: 3,
            hasRooftop: true,
            hasGarage: false,
            accessType: 'SHARED',
            furnishingStatus: 'UNFURNISHED',
            frontageCount: 2,
          }
        : null,
    roomDetail:
      code === 'ROOM'
        ? {
            roomCode: 'P2',
            floorNumber: 0,
            restroomType: 'SHARED',
            kitchenType: 'NONE',
            hasWindow: false,
            balconyType: 'SHARED',
            hasMezzanine: true,
            furnishingStatus: 'LUXURY',
            accessHoursType: 'CURFEW',
            maxOccupants: 3,
            parkingPolicy: 'PAID',
          }
        : null,
    amenities: [{ code: 'WIFI', name: 'Wifi' }],
    customAmenities: ['Sân phơi'],
    furnishings: [
      {
        itemCode: 'BED',
        assetName: 'Giường',
        quantity: 1,
        handoverCondition: 'NORMAL',
        conditionNote: 'cũ',
      },
    ],
    policies: [{ code: 'petPolicy', value: 'NOT_ALLOWED', note: null }],
    charges: [
      {
        chargeType: 'ELECTRICITY',
        billingMethod: 'PER_KWH',
        amount: 2925,
        includedInRent: false,
        description: 'Theo công tơ',
        currency: 'VND',
        sortOrder: 1,
      },
      {
        chargeType: 'WATER',
        billingMethod: 'PER_PERSON_MONTH',
        amount: 100000,
        includedInRent: false,
        sortOrder: 2,
      },
      {
        chargeType: 'OTHER',
        billingMethod: 'PER_MONTH',
        amount: 30000,
        customName: 'Thang máy',
        includedInRent: false,
        sortOrder: 9,
      },
    ],
    address: { refId: 'ref-listing', display: '1 Lê Lợi', addressNote: 'Tầng 2' },
    media: [
      {
        id: 'm1',
        storageObjectId: 's1',
        mediaType: 'IMAGE',
        sortOrder: 0,
        cover: true,
        url: 'https://x/1',
      },
      {
        id: 'm2',
        storageObjectId: 's2',
        mediaType: 'VIDEO',
        sortOrder: 1,
        cover: false,
        url: 'https://x/2',
      },
    ],
    viewingDays: ['SUNDAY'],
    viewingSlots: ['EVENING'],
  };
}

/** Web form state has the same objects; only the media preview field is called differently. */
const webBasic = (basicInfo) => ({
  ...basicInfo,
  images: basicInfo.images.map(({ uri, ...item }) => ({ ...item, dataUrl: uri })),
});

for (const category of CATEGORIES) {
  for (const addressMode of ['new', 'saved']) {
    test(`${category}: create payload (${addressMode} address) equals the web payload`, () => {
      for (const action of ['SAVE_DRAFT', 'SUBMIT_FOR_REVIEW']) {
        const state = { ...filled(category), addressMode };
        const uploaded = [{ storageObjectId: 's-img', mediaType: 'IMAGE' }];
        const params = editor.buildPayloadParams(
          state,
          editor.createListingSession(),
          catalog,
          savedAddress,
          action,
          uploaded
        );
        const result = payload.buildCreateListingPayload(params);
        assert.deepEqual(
          result,
          webPayload.buildCreateListingPayload({ ...params, basicInfo: webBasic(params.basicInfo) })
        );
        assert.equal(result.id, null);
        assert.deepEqual(result.amenityCodes, ['WIFI']);
        assert.deepEqual(result.customAmenities, ['Sân phơi']);
        assert.deepEqual(
          result.policies.map((p) => [p.code, p.value]),
          [
            ['petPolicy', 'ALLOWED'],
            ['depositRefundDays', '15'],
          ]
        );
        assert.equal(result.addressSource.type, addressMode === 'saved' ? 'SAVED' : 'NEW');
      }
    });
  }

  for (const mode of ['edit', 'duplicate']) {
    test(`${category}: ${mode} loads and saves like the web`, () => {
      const detail = detailOf(category);
      const branches = [
        {
          id: 'branch-1',
          refId: 'ref-branch',
          category: category.toUpperCase(),
          name: 'CN',
          display: 'x',
        },
      ];
      const opened = editor.openListing(detail, mode, branches, TODAY);
      const expected = webMapper.mapListingDetailToFormState(detail, mode, branches, TODAY);
      const { listingPolicies, selectedAddress, basicInfo, ...state } = opened.state;
      const { basicInfo: expectedBasic, notice, ...rest } = expected;
      assert.deepEqual(state, rest);
      assert.deepEqual(
        { ...basicInfo, images: 0, videos: 0 },
        { ...expectedBasic, images: 0, videos: 0 }
      );
      for (const kind of ['images', 'videos'])
        assert.deepEqual(
          basicInfo[kind].map((m) => [m.name, m.storageObjectId, m.sourceMediaId]),
          expectedBasic[kind].map((m) => [m.name, m.storageObjectId, m.sourceMediaId])
        );
      assert.equal(selectedAddress.refId, 'ref-branch');
      assert.deepEqual(listingPolicies, [{ code: 'petPolicy', value: 'NOT_ALLOWED', note: '' }]);

      // Round trip, untouched and with one fee changed.
      for (const electricityPrice of ['2925', '4000']) {
        const next = {
          ...opened.state,
          monthlyExpenses: { ...opened.state.monthlyExpenses, electricityPrice },
        };
        const uploaded = [...next.basicInfo.images, ...next.basicInfo.videos].map((m, i) => ({
          storageObjectId: m.storageObjectId,
          sourceMediaId: m.sourceMediaId,
          mediaType: i ? 'VIDEO' : 'IMAGE',
        }));
        const params = editor.buildPayloadParams(
          next,
          opened.session,
          catalog,
          null,
          'SUBMIT_FOR_REVIEW',
          uploaded
        );
        const result = payload.buildCreateListingPayload(params);
        assert.deepEqual(
          result,
          webPayload.buildCreateListingPayload({ ...params, basicInfo: webBasic(params.basicInfo) })
        );
        assert.equal(result.id, mode === 'edit' ? 'listing-1' : null);
        assert.equal(
          result.duplicateSourceListingId,
          mode === 'duplicate' ? 'listing-1' : undefined
        );
        assert.equal(result.maxMotorbikeCount, 2);
        assert.equal(result.charges[0].amount, Number(electricityPrice));
        assert.equal(result.charges[0].description, 'Theo công tơ');
        if (electricityPrice === '2925') assert.deepEqual(result.charges, detail.charges);
      }
    });
  }

  test(`${category}: field validation matches the web editor`, () => {
    const variants = [
      form.createListingForm({ today: TODAY }),
      filled(category),
      (() => {
        const s = filled(category);
        Object.assign(s.basicInfo, {
          title: 'ngắn',
          availableDate: '2020-01-01',
          description: 'ngắn',
        });
        Object.assign(s.pricing, {
          priceMonthly: '0',
          depositType: 'AMOUNT',
          minimumLeaseMonths: '0',
        });
        Object.assign(s.apartmentDetails, { bedrooms: '', bathrooms: '0', floor: '' });
        Object.assign(s.houseDetails, { bedrooms: '0', totalFloors: '0' });
        Object.assign(s.roomDetails, { roomCode: ' ', maxOccupants: '' });
        s.furnishingAssets = [{ ...form.emptyFurnishingRow(), quantity: '0' }];
        s.pricing.depositType = 'MONTHS';
        s.pricing.depositMonths = '1.5';
        s.selectedAddress = null;
        return s;
      })(),
    ];
    for (const state of variants) {
      state.basicInfo.category = category;
      for (const [skipDescription, loadedAvailableDate] of [
        [false, null],
        [true, null],
        [false, '2020-01-01'],
      ]) {
        const webErrors = webEditorFunction('collectErrors', {
          loadedAvailableDate,
          ...state,
          savedUserAddress: savedAddress,
          isFurnishingRequired: form.isFurnishingRequired(state),
          getTodayDateString: () => TODAY,
        })(skipDescription);
        assert.deepEqual(
          validation.collectErrors(
            state,
            {
              today: TODAY,
              savedAddressRefId: savedAddress.refId,
              originalAvailableDate: loadedAvailableDate,
            },
            skipDescription
          ),
          json(webErrors)
        );
      }
    }
  });

  test(`${category}: description facts equal the web adapter`, () => {
    const state = filled(category);
    const session = editor.createListingSession();
    const result = description.buildDescriptionRequest(state, session, catalog, null);
    const built = payload.buildCreateListingPayload(
      editor.buildPayloadParams(state, session, catalog, null, 'SAVE_DRAFT', [])
    );
    assert.deepEqual(
      result,
      webDescription.toDescriptionRequest(built, state.selectedAddress, { WIFI: 'Wifi' })
    );
  });
}

test('branch selection matches the web editor: prefill on create only, fees stay on edit', () => {
  const branch = {
    id: 'b',
    name: 'CN',
    category: 'ROOM',
    refId: 'r',
    display: 'd',
    buildingRules: 'Giữ yên lặng',
    isComplete: false,
    missingCharges: ['water'],
    defaultCharges: [
      { chargeType: 'ELECTRICITY', billingMethod: 'PER_KWH', amount: 4000 },
      { chargeType: 'WATER', billingMethod: 'PER_MONTH', amount: 90000 },
      { chargeType: 'CLEANING', billingMethod: 'PER_PERSON_MONTH', amount: 20000 },
      { chargeType: 'CAR_PARKING', billingMethod: 'FREE' },
      { chargeType: 'OTHER', billingMethod: 'PER_MONTH', amount: 10000 },
    ],
  };
  assert.deepEqual(
    mapper.buildExpensesFromBranch(branch, 'apartment'),
    webMapper.buildExpensesFromBranch(branch, 'apartment')
  );
  for (const mode of ['create', 'edit', 'duplicate']) {
    for (const branchId of ['b', '']) {
      const state = form.createListingForm({ today: TODAY });
      if (mode === 'edit') state.basicInfo.category = 'room';
      state.monthlyExpenses.electricityPrice = '1';
      const webState = json(state);
      const set = (key) => (next) => {
        webState[key] = typeof next === 'function' ? next(webState[key]) : next;
      };
      const noop = () => {};
      webEditorFunction('handleSelectBranch', {
        branches: [branch],
        basicInfo: webState.basicInfo,
        isEditMode: mode === 'edit',
        isDuplicateMode: mode === 'duplicate',
        PRICE_UNITS_BY_CATEGORY: webConstants.PRICE_UNITS_BY_CATEGORY,
        swapPolicySuggestions: webSuggestions.swapPolicySuggestions,
        toast: { info: noop, error: noop, warning: noop },
        setBasicInfo: set('basicInfo'),
        setMonthlyExpenses: set('monthlyExpenses'),
        setPricing: set('pricing'),
        setListingPolicies: set('listingPolicies'),
        setAddressMode: set('addressMode'),
        setSelectedAddress: set('selectedAddress'),
        setErrors: noop,
      })(branchId);
      // Deliberate difference: a changed category resets the price unit in every mode.
      if (mode === 'duplicate' && branchId) webState.pricing.priceUnit = 'VND_ROOM_MONTH';
      assert.deepEqual(
        json(form.selectBranch(state, branchId, [branch], mode).state),
        json(webState),
        `${mode} ${branchId}`
      );
    }
  }
  const apartment = form.createListingForm();
  const rejected = form.selectBranch(apartment, 'b', [branch], 'edit');
  assert.equal(rejected.state, apartment);
  assert.equal(rejected.notice.type, 'error');
});

test('category change resets only what the web resets', () => {
  const state = { ...filled('apartment'), listingPolicies: [] };
  const next = form.changeCategory(state, 'room', 'create');
  assert.deepEqual([next.selectedAmenities, next.furnishingAssets], [[], []]);
  assert.equal(next.pricing.priceUnit, 'VND_ROOM_MONTH');
  assert.equal(next.monthlyExpenses.managementFeeType, 'NONE');
  assert.equal(next.monthlyExpenses.customFees.length, 1);
  assert.equal(next.apartmentDetails.projectName, state.apartmentDetails.projectName);
  assert.equal(form.changeCategory(state, 'room', 'edit'), state);
});

test('option metadata covers the web constants', () => {
  assert.deepEqual(form.PRICE_UNITS_BY_CATEGORY, webConstants.PRICE_UNITS_BY_CATEGORY);
  assert.deepEqual(form.PROPERTY_CATEGORIES, webConstants.PROPERTY_CATEGORIES);
  assert.deepEqual(fields.FURNISHING_OPTIONS, webConstants.FURNISHING_OPTIONS);
  assert.deepEqual(fields.HANDOVER_CONDITIONS, webConstants.HANDOVER_CONDITIONS);
  assert.deepEqual(fields.LEGAL_STATUS_OPTIONS, webConstants.LEGAL_STATUS_OPTIONS);
  assert.deepEqual(fields.ORIENTATIONS, webConstants.ORIENTATIONS);
  assert.deepEqual(json(form.VIEWING_DAYS), json(webConstants.VIEWING_DAYS));
  assert.deepEqual(json(form.VIEWING_SLOTS), json(webConstants.VIEWING_SLOTS));
  assert.equal(media.MAX_IMAGES, webConstants.MAX_IMAGES);
  assert.equal(media.MAX_VIDEOS, webConstants.MAX_VIDEOS);
  const blank = form.createListingForm();
  for (const category of CATEGORIES) {
    const keys = fields.DETAIL_SECTIONS[category].fields
      .filter((f) => f.type !== 'furnishing-assets')
      .map((f) => f.key);
    assert.deepEqual(keys.sort(), Object.keys(blank[`${category}Details`]).sort(), category);
  }
});

test('policies: suggestions equal the web; drafts never drop answers without the catalog', () => {
  const rows = [{ code: 'petPolicy', value: 'ALLOWED', note: '' }];
  for (const category of ['APARTMENT', 'HOUSE', 'ROOM']) {
    for (const name of ['withDefaultSuggestions', 'withSystemRules'])
      assert.deepEqual(
        policy[name](rows, catalog.policies, category),
        webSuggestions[name](rows, catalog.policies, category)
      );
    assert.deepEqual(
      policy.swapPolicySuggestions(rows, category),
      webSuggestions.swapPolicySuggestions(rows, category)
    );
  }
  const state = filled('room');
  const down = { definitions: [], error: policy.CATALOG_LOAD_FAILED };
  assert.equal(validation.validatePolicies(state, down, 'SAVE_DRAFT'), policy.CATALOG_LOAD_FAILED);
  assert.equal(
    validation.validatePolicies({ ...state, listingPolicies: [] }, down, 'SAVE_DRAFT'),
    null
  );
  const up = { definitions: catalog.policies, error: '' };
  assert.equal(
    validation.validatePolicies({ ...state, listingPolicies: [] }, up, 'SUBMIT_FOR_REVIEW'),
    'Cần nhập chính sách: Thú cưng'
  );
  assert.equal(validation.validatePolicies(state, up, 'SUBMIT_FOR_REVIEW'), null);
  const blocked = validation.validateStep({ ...state, listingPolicies: [] }, up, 4, {
    today: TODAY,
  });
  assert.equal(blocked.step, 4);
  assert.ok(blocked.errors.policies);
});

test('media limits reject long, large and unknown files', () => {
  const basic = form.createListingForm().basicInfo;
  const video = (extra) => ({
    uri: 'file:///v.mp4',
    fileName: 'v.mp4',
    fileSize: 10,
    duration: 1000,
    ...extra,
  });
  assert.deepEqual(media.addPickedMedia(basic, 'VIDEO', [video({ duration: 121000 })]).errors, [
    'v.mp4 dài quá 2 phút.',
  ]);
  assert.deepEqual(
    media.addPickedMedia(basic, 'VIDEO', [video({ fileSize: 501 * 1024 * 1024 })]).errors,
    ['v.mp4 vượt quá giới hạn 500MB.']
  );
  assert.deepEqual(media.addPickedMedia(basic, 'VIDEO', [video({ duration: null })]).errors, [
    'Không thể đọc video v.mp4.',
  ]);
  const images = Array.from({ length: 8 }, (_, i) => ({ uri: `file:///${i}.png`, fileSize: 5 }));
  const picked = media.addPickedMedia(basic, 'IMAGE', images);
  assert.equal(picked.basicInfo.images.length, 6);
  assert.equal(picked.basicInfo.images[0].file.contentType, 'image/png');
});

test('a failed save keeps uploaded ids; the retry uploads only the missing file', async () => {
  let state = filled('room');
  const file = (name) => ({
    name,
    uri: name,
    file: { uri: name, fileName: name, contentType: 'image/jpeg', sizeBytes: 1 },
  });
  state.basicInfo.images = [
    { name: 'old', uri: 'u', storageObjectId: 'old' },
    file('a'),
    file('b'),
  ];
  const uploads = [];
  let fail = true;
  const sent = [];
  const run = () =>
    editor.saveListing(
      {
        state,
        session: editor.createListingSession(),
        catalog,
        catalogError: '',
        savedAddress: null,
        action: 'SUBMIT_FOR_REVIEW',
        profile: { kycVerified: true },
      },
      {
        upload: async (local) => {
          uploads.push(local.uri);
          if (local.uri === 'b' && fail) throw new Error('Không thể tải tệp lên kho lưu trữ.');
          return `id-${local.uri}`;
        },
        onMediaUploaded: (kind, index, id) =>
          (state = { ...state, basicInfo: media.markUploaded(state.basicInfo, kind, index, id) }),
        upsert: async (body) => (sent.push(body), { id: 'new' }),
      }
    );
  assert.deepEqual(await run(), {
    status: 'error',
    message: 'Không thể tải tệp lên kho lưu trữ.',
    externallyRented: false,
  });
  fail = false;
  assert.equal((await run()).message, 'Tin đã được gửi chờ duyệt');
  assert.deepEqual(uploads, ['a', 'b', 'b']);
  assert.deepEqual(
    sent[0].media.map((m) => [m.storageObjectId, m.sortOrder, m.cover]),
    [
      ['old', 0, true],
      ['id-a', 1, false],
      ['id-b', 2, false],
    ]
  );
});

test('save guards: KYC, rented externally, quota and the 4012 conflict', async () => {
  const state = filled('room');
  const base = {
    state,
    session: editor.createListingSession(),
    catalog,
    catalogError: '',
    savedAddress: null,
    action: 'SUBMIT_FOR_REVIEW',
    profile: { kycVerified: true },
  };
  const never = {
    upload: async () => assert.fail('upload'),
    upsert: async () => assert.fail('upsert'),
  };
  assert.equal(
    (await editor.saveListing({ ...base, profile: { kycVerified: false } }, never)).status,
    'kyc'
  );
  const session = { ...base.session, mode: 'edit', listingId: 'x', status: 'RENTED_EXTERNALLY' };
  assert.equal((await editor.saveListing({ ...base, session }, never)).status, 'locked');
  const reject = (code) => ({
    ...never,
    upsert: async () => {
      throw { isAxiosError: true, response: { status: 409, data: { code, message: 'Lỗi' } } };
    },
  });
  assert.equal((await editor.saveListing(base, reject(4013))).status, 'quota');
  const edit = { ...base, session: { ...session, status: 'PUBLISHED' } };
  assert.deepEqual(await editor.saveListing(edit, reject(4012)), {
    status: 'error',
    message: 'Lỗi',
    externallyRented: true,
  });
  assert.equal((await editor.saveListing(edit, reject(409))).externallyRented, false);
  assert.equal(editor.requiresEditReview(edit.session), true);
  assert.equal(quota.getPublishableUses({ remainingUses: 1, addonRemaining: 2 }), 3);
});

test('description job drops stale and aborted answers', async () => {
  let current = { facts: { price: 1 }, description: '' };
  let finish;
  const job = description.createDescriptionJob({
    read: () => current,
    fetch: () => new Promise((resolve) => (finish = resolve)),
  });
  const yes = async () => true;
  const first = job.run(yes);
  assert.equal((await job.run(yes)).status, 'busy');
  current = { facts: { price: 2 }, description: '' };
  finish({ description: 'cũ', templateId: 't' });
  assert.equal((await first).status, 'stale');
  const second = job.run(yes);
  job.abort();
  finish({ description: 'x', templateId: 't' });
  assert.equal((await second).status, 'cancelled');
  const third = job.run(yes);
  finish({ description: 'mới', templateId: 't' });
  assert.equal((await third).description, 'mới');
});

test('description API reports a missing web URL clearly', async () => {
  const load = loader(ROOT, {
    '@/config/env': { webBaseUrl: undefined, apiTransportUrl: (v) => v },
  });
  await assert.rejects(
    load('src/services/listingDescriptionApi.ts').fetchListingDescription(
      {},
      new AbortController().signal
    ),
    /EXPO_PUBLIC_WEB_BASE_URL/
  );
});

test('an error scrolls to the topmost field on screen, or waits for the first one to be drawn', () => {
  const source = ts.transpileModule(
    fs.readFileSync(path.join(ROOT, 'src/components/rental/contract/anchors.tsx'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }
  ).outputText;
  const mod = { exports: {} };
  const react = {
    createContext: () => ({}),
    useMemo: (make) => make(),
    useRef: (current) => ({ current }),
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(
    (name) => (name === 'react' ? react : {}),
    mod,
    mod.exports
  );
  const scrolled = [];
  const anchors = mod.exports.useAnchorController(
    { current: { scrollTo: ({ y }) => scrolled.push(y) } },
    { current: {} }
  );
  const at = (y) => ({ measureLayout: (_content, done) => done(0, y) });
  anchors.register('viewingDays', at(900));
  anchors.register('streetLine', at(500));
  anchors.scrollToFirst(['viewingDays', 'streetLine', 'notMounted']);
  assert.deepEqual(scrolled, [492]);
  anchors.scrollToFirst(['title', 'images']);
  anchors.register('title', at(100));
  anchors.laidOut('title');
  assert.deepEqual(scrolled, [492, 92]);
});

test('an unsupported branch category is refused instead of crashing', () => {
  const office = { id: 'o', name: 'VP', category: 'OFFICE', refId: 'r', display: 'd' };
  assert.equal(form.isSupportedBranch(office), false);
  assert.equal(form.isSupportedBranch({ ...office, category: 'ROOM' }), true);
  for (const mode of ['create', 'duplicate', 'edit']) {
    const state = form.createListingForm();
    const result = form.selectBranch(state, 'o', [office], mode);
    assert.equal(result.state, state);
    assert.equal(result.notice.type, 'error');
  }
});

const uploadedOf = (state) =>
  state.basicInfo.images.map((m) => ({ storageObjectId: m.storageObjectId, mediaType: 'IMAGE' }));
const payloadOf = (state, session) =>
  payload.buildCreateListingPayload(
    editor.buildPayloadParams(state, session, catalog, null, 'SUBMIT_FOR_REVIEW', uploadedOf(state))
  );

test('an edit keeps the rental scope, the floors and an unchanged past date', () => {
  const detail = detailOf('house');
  detail.availableFrom = '2026-01-15';
  Object.assign(detail.houseDetail, {
    rentalScopeDescription: 'Chỉ thuê tầng 2–3',
    rentedFloorFrom: 2,
    rentedFloorTo: 3,
  });
  const edit = editor.openListing(detail, 'edit', [], TODAY);
  const body = payloadOf(edit.state, edit.session);
  assert.equal(body.availableFrom, '2026-01-15');
  assert.deepEqual(
    [
      body.houseDetail.rentalScopeDescription,
      body.houseDetail.rentedFloorFrom,
      body.houseDetail.rentedFloorTo,
    ],
    ['Chỉ thuê tầng 2–3', 2, 3]
  );
  const context = { today: TODAY, originalAvailableDate: edit.session.originalAvailableDate };
  const dateError = (state) =>
    validation.collectErrors(state, context).some((e) => e.key === 'availableDate');
  assert.equal(dateError(edit.state), false);
  // Another past date is still refused.
  const moved = {
    ...edit.state,
    basicInfo: { ...edit.state.basicInfo, availableDate: '2026-02-01' },
  };
  assert.equal(dateError(moved), true);
  const copy = editor.openListing(detail, 'duplicate', [], TODAY);
  assert.equal(copy.state.basicInfo.availableDate, TODAY);
  assert.equal(copy.session.originalAvailableDate, null);
});

test('changing the custom fees keeps the stored terms of the other ones', () => {
  const detail = detailOf('room');
  detail.charges = [
    {
      chargeType: 'OTHER',
      billingMethod: 'PER_PERSON_MONTH',
      amount: 30000,
      customName: 'Giặt',
      description: 'Theo người',
      includedInRent: false,
      sortOrder: 9,
    },
    {
      chargeType: 'OTHER',
      billingMethod: 'FREE',
      amount: null,
      customName: 'Hồ bơi',
      description: 'Miễn phí năm đầu',
      includedInRent: false,
      sortOrder: 10,
    },
  ];
  const opened = editor.openListing(detail, 'edit', [], TODAY);
  const fees = opened.state.monthlyExpenses.customFees;
  const others = (customFees) =>
    payloadOf(
      { ...opened.state, monthlyExpenses: { ...opened.state.monthlyExpenses, customFees } },
      opened.session
    ).charges.filter((c) => c.chargeType === 'OTHER');
  const added = others([...fees, { ...form.newCustomFee(), name: 'Thang máy', amount: '50000' }]);
  assert.deepEqual(
    added.map((c) => [c.customName, c.billingMethod, c.amount, c.description]),
    [
      ['Giặt', 'PER_PERSON_MONTH', 30000, 'Theo người'],
      ['Hồ bơi', 'FREE', null, 'Miễn phí năm đầu'],
      ['Thang máy', 'PER_MONTH', 50000, undefined],
    ]
  );
  // Removing the first row keeps the second one's own terms; pricing a free fee makes it monthly.
  assert.equal(others([fees[1]])[0].billingMethod, 'FREE');
  const priced = others([
    { ...fees[0], amount: '40000' },
    { ...fees[1], amount: '10000' },
  ]);
  assert.deepEqual(
    priced.map((c) => [c.billingMethod, c.amount, c.description]),
    [
      ['PER_PERSON_MONTH', 40000, 'Theo người'],
      ['PER_MONTH', 10000, 'Miễn phí năm đầu'],
    ]
  );
});

test('an unconfirmed create is flagged; a refusal, an upload failure and an edit are not', async () => {
  const state = filled('room');
  const run = (error, extra = {}, upload) =>
    editor.saveListing(
      {
        state,
        session: editor.createListingSession(),
        catalog,
        catalogError: '',
        savedAddress: null,
        action: 'SUBMIT_FOR_REVIEW',
        profile: { kycVerified: true },
        ...extra,
      },
      {
        upload: upload ?? (async () => 'id'),
        upsert: async () => {
          throw error;
        },
      }
    );
  const http = (status) => ({ isAxiosError: true, response: { status, data: {} } });
  for (const error of [{ isAxiosError: true }, http(500), http(504), http(408), new TypeError()])
    assert.equal((await run(error)).maybeSaved, true, JSON.stringify(error));
  for (const status of [400, 403, 409, 422])
    assert.equal((await run(http(status))).maybeSaved, undefined, String(status));
  const edit = { ...editor.createListingSession(), mode: 'edit', listingId: 'x', status: 'DRAFT' };
  assert.equal((await run(http(500), { session: edit })).maybeSaved, undefined);
  const file = { uri: 'a', fileName: 'a', contentType: 'image/jpeg', sizeBytes: 1 };
  const pending = {
    ...state,
    basicInfo: { ...state.basicInfo, images: [{ name: 'a', uri: 'a', file }] },
  };
  const failed = await run(null, { state: pending }, async () => {
    throw { isAxiosError: true };
  });
  assert.equal(failed.status, 'error');
  assert.equal(failed.maybeSaved, undefined);
});

test('the quota dialog only offers a save the API allows; a pending edit asks before replacing', () => {
  const edit = (status, pendingEdit = false) => ({
    ...editor.createListingSession(),
    mode: 'edit',
    listingId: 'x',
    status,
    pendingEdit,
  });
  for (const status of ['PUBLISHED', 'RESERVED', 'RENTED', 'HIDDEN', 'EXPIRED'])
    assert.equal(editor.quotaSaveAction(edit(status)), 'SUBMIT_FOR_REVIEW', status);
  assert.equal(editor.quotaSaveAction(edit('PENDING_REVIEW', true)), 'SUBMIT_FOR_REVIEW');
  for (const status of ['DRAFT', 'REJECTED', 'PENDING_REVIEW'])
    assert.equal(editor.quotaSaveAction(edit(status)), 'SAVE_DRAFT', status);
  assert.equal(editor.quotaSaveAction(editor.createListingSession()), 'SAVE_DRAFT');
  assert.equal(editor.editSubmitConfirm(edit('PUBLISHED')), editor.EDIT_SUBMIT_CONFIRM);
  assert.match(editor.editSubmitConfirm(edit('PUBLISHED', true)).description, /thay thế toàn bộ/);
  const detail = { ...detailOf('room'), pendingEditId: 'p', editRejectionReason: 'Ảnh mờ' };
  const { session } = editor.openListing(detail, 'edit', [], TODAY);
  assert.deepEqual([session.pendingEdit, session.editRejectionReason], [true, 'Ảnh mờ']);
});

test('a description over 5000 characters is refused before any upload', async () => {
  const state = filled('room');
  state.basicInfo.description = 'a'.repeat(5001);
  const never = {
    upload: async () => assert.fail('upload'),
    upsert: async () => assert.fail('upsert'),
  };
  for (const action of ['SAVE_DRAFT', 'SUBMIT_FOR_REVIEW']) {
    const result = await editor.saveListing(
      {
        state,
        session: editor.createListingSession(),
        catalog,
        catalogError: '',
        savedAddress: null,
        action,
        profile: { kycVerified: true },
      },
      never
    );
    assert.equal(result.status, 'invalid');
    assert.ok(result.validation.errors.description);
  }
  state.basicInfo.description = ` ${'a'.repeat(5000)} `;
  assert.ok(!validation.collectErrors(state).some((e) => e.key === 'description'));
});

test('the address note survives retyping and picking the same place again', () => {
  const first = { refId: 'a', display: 'A', addressNote: 'Hẻm 2' };
  const typing = form.chooseAddress(first, null);
  assert.equal(typing.refId, undefined);
  const again = form.chooseAddress(form.chooseAddress(typing, null), { refId: 'a', display: 'A' });
  assert.equal(again.addressNote, 'Hẻm 2');
  const other = form.chooseAddress(typing, { refId: 'b', display: 'B' });
  assert.equal(other.addressNote, undefined);
});

test('the way to the membership screen never drops unsaved input', () => {
  assert.equal(editor.membershipRoute(false, false), 'leave');
  assert.equal(editor.membershipRoute(false, true), 'leave');
  assert.equal(editor.membershipRoute(true, true), 'save-first');
  assert.equal(editor.membershipRoute(true, false), 'over-editor');
});

/** QuotaModal has no hooks, so it can be called and its element tree read. */
function quotaButtons(action, saving = false) {
  const source = fs.readFileSync(
    path.join(ROOT, 'src/components/listing-editor/QuotaModal.tsx'),
    'utf8'
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const stubs = {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { Text: 'Text', View: 'View' },
    '@/components/rental/shared/ActionButton': { default: 'ActionButton' },
    '@/components/rental/shared/ModalShell': { default: 'ModalShell' },
    '@/lib/membership': mobile('src/lib/membership.ts'),
    './ui': { Notice: 'Notice' },
  };
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`)(
    (name) => stubs[name] ?? assert.fail(`Unexpected dependency ${name}`),
    mod,
    mod.exports
  );
  const calls = [];
  const modal = mod.exports.default({
    membership: null,
    action,
    saving,
    onClose: () => calls.push('close'),
    onSave: () => calls.push('save'),
    onSaveAndBuy: () => calls.push('plan'),
    onSaveAndBuyAddon: () => calls.push('addon'),
  });
  const buttons = [modal.props.footer.props.children].flat().map((button) => button.props);
  return { buttons, calls };
}

test('the quota dialog saves before buying a plan or extra uses', () => {
  for (const [action, labels] of [
    [
      'SAVE_DRAFT',
      [
        'Lưu nháp & Mua gói đăng tin',
        'Lưu nháp & Mua thêm lượt',
        'Chỉ lưu tin nháp (Miễn phí)',
        'Ở lại chỉnh sửa tiếp',
      ],
    ],
    [
      'SUBMIT_FOR_REVIEW',
      [
        'Gửi bản sửa & Mua gói đăng tin',
        'Gửi bản sửa & Mua thêm lượt',
        'Chỉ gửi bản sửa để duyệt',
        'Ở lại chỉnh sửa tiếp',
      ],
    ],
  ]) {
    const { buttons, calls } = quotaButtons(action);
    assert.deepEqual(
      buttons.map((button) => button.label),
      labels
    );
    buttons.forEach((button) => button.onClick());
    assert.deepEqual(calls, ['plan', 'addon', 'save', 'close']);
  }
  for (const button of quotaButtons('SAVE_DRAFT', true).buttons)
    assert.ok(button.busy || button.disabled, button.label);
  // The web offers the same two purchases.
  const webModal = fs.readFileSync(
    path.join(WEB, 'components/membership/InsufficientQuotaModal.tsx'),
    'utf8'
  );
  for (const text of ['Lưu nháp & Mua thêm lượt', 'Lưu nháp & Mua gói đăng tin'])
    assert.ok(webModal.includes(text), text);
});

test('wiring: every editor host forwards the extra-use purchase', () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\s+/g, ' ');
  const hook = read('src/components/listing-editor/useListingEditor.ts');
  // The addon flag leaves the editor only after the save succeeded.
  assert.ok(hook.includes('if (buy) onOpenMembership(true);'));
  assert.ok(hook.includes('if (thenBuy) onOpenMembership(false);'));
  assert.ok(hook.includes('if (buyOver) setBuying(buyOver);'));
  const screen = read('src/screens/ListingDraftScreen.tsx');
  assert.ok(screen.includes("onSaveAndBuyAddon={() => editor.saveFromQuota('addon')}"));
  assert.ok(screen.includes("initialAddon={editor.buying === 'addon'}"));
  assert.ok(screen.includes('onBuyAddon={() => editor.openMembership(true)}'));
  assert.ok(
    read('src/components/listing-manage/MyListingsScreen.tsx').includes(
      'onOpenMembership={openMembership}'
    )
  );
  assert.ok(
    read('src/screens/ListingDetailScreen.tsx').includes(
      'setMembershipView({ addon: addon === true })'
    )
  );
  assert.ok(
    read('src/components/membership/MembershipScreen.tsx').includes('setAddonOpen(addon === true)')
  );
  // "Quản lý tin đăng" from the editor reaches the list, not what Back returns to.
  assert.ok(screen.includes('editor.leaveTo(onManageListings);'));
  assert.ok(
    read('src/screens/ListingDetailScreen.tsx').includes(
      "onManageListings={() => onOpenManagement('landlord-properties')} />"
    )
  );
  assert.ok(
    read('src/components/listing-manage/MyListingsScreen.tsx').includes(
      'onManageListings={() => closeOverlay(true)} /> );'
    )
  );
  assert.ok(hook.includes('leaveTo: leave,'));
  for (const file of [
    'src/components/listing-editor/QuotaModal.tsx',
    'src/components/listing-editor/useListingEditor.ts',
  ])
    assert.ok(!read(file).includes('Trang chủ'), file);
});

test('an edit re-reads the listing: a pending edit made meanwhile asks to replace it', async () => {
  const { session } = editor.openListing(detailOf('room'), 'edit', [], TODAY);
  assert.equal(editor.editSubmitConfirm(session), editor.EDIT_SUBMIT_CONFIRM);
  const reads = [];
  const fresh = await editor.refreshEditSession(session, async (id) => {
    reads.push(id);
    return { ...detailOf('room'), status: 'PENDING_REVIEW', pendingEditId: 'from-other-device' };
  });
  assert.deepEqual(reads, ['listing-1']);
  assert.equal(fresh.pendingEdit, true);
  assert.match(editor.editSubmitConfirm(fresh).title, /Thay thế/);
  assert.equal(fresh.chargeBaseline, session.chargeBaseline);
});

test('a leave answer given after a save started does not navigate', () => {
  const { unlessBusy } = mobile('src/lib/leave-guard.ts');
  let busy = false;
  const calls = [];
  const press = unlessBusy(
    () => busy,
    () => calls.push('go'),
    () => calls.push('wait')
  );
  busy = true;
  press();
  busy = false;
  press();
  assert.deepEqual(calls, ['wait', 'go']);
});

test('the maybe-saved question survives reopening, per account and source', async () => {
  const stored = new Map();
  const store = {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => void stored.set(key, value),
    removeItem: async (key) => void stored.delete(key),
  };
  // A fresh module instance is what a restarted app sees: only the storage remains.
  const reopened = () => loader(ROOT)('src/lib/listing-editor.ts');
  const session = editor.createListingSession();
  const asked = [];
  const run = async (upsert, answer, extra = {}) => {
    const app = reopened();
    return app.saveListing(
      {
        state: filled('room'),
        session,
        catalog,
        catalogError: '',
        savedAddress: null,
        action: 'SUBMIT_FOR_REVIEW',
        profile: { kycVerified: true },
        ...extra,
      },
      {
        upload: async () => 'id',
        upsert,
        unconfirmed: app.maybeSavedFlag(store, 'user-1', session),
        confirmResend: async () => (asked.push(answer), answer),
      }
    );
  };
  // HTTP 200 without an id is not a success.
  const noId = await run(async () => ({}));
  assert.deepEqual([noId.status, noId.maybeSaved], ['error', true]);
  assert.deepEqual([...stored.keys()], ['homespace.listingMaybeSaved.user-1.create']);
  const declined = await run(async () => assert.fail('sent'), false);
  assert.equal(declined.status, 'cancelled');
  assert.equal(stored.size, 1);
  assert.equal((await run(async () => ({ id: 'new' }), true)).status, 'saved');
  assert.equal(stored.size, 0);
  assert.deepEqual(asked, [false, true]);
  // A definite refusal leaves nothing to ask about.
  await run(async () => {
    throw { isAxiosError: true, response: { status: 422, data: {} } };
  });
  assert.equal(stored.size, 0);
  const copy = { ...session, mode: 'duplicate', listingId: 'src-1' };
  const flag = editor.maybeSavedFlag(store, 'user-2', copy);
  await flag.mark();
  assert.deepEqual([...stored.keys()], ['homespace.listingMaybeSaved.user-2.src-1']);
  assert.equal(await editor.maybeSavedFlag(store, 'user-1', copy).pending(), false);
  await flag.clear();
  assert.equal(editor.maybeSavedFlag(store, 'user-1', { ...session, mode: 'edit' }), undefined);
});

test('total floors cannot drop below the kept rental scope', () => {
  const state = filled('house');
  Object.assign(state.houseDetails, { totalFloors: '2', rentedFloorFrom: 2, rentedFloorTo: 3 });
  const floors = () =>
    validation.collectErrors(state, { today: TODAY }).find((e) => e.key === 'totalFloors');
  assert.match(floors().msg, /tầng 2–3/);
  state.houseDetails.totalFloors = '3';
  assert.equal(floors(), undefined);
});

test('the unit of a custom fee follows the billing method that will be sent', () => {
  const stored = [
    { chargeType: 'OTHER', billingMethod: 'PER_PERSON_MONTH', amount: 30000 },
    { chargeType: 'OTHER', billingMethod: 'FREE', amount: null },
  ];
  const unit = (id, amount) => payload.customFeeUnit({ id, name: 'x', amount }, stored);
  assert.equal(unit('custom-0', '40000'), 'đ/người/tháng');
  assert.equal(unit('custom-1', ''), 'Miễn phí');
  assert.equal(unit('custom-1', '10000'), 'đ/tháng');
  assert.equal(unit('fee-1', '10000'), 'đ/tháng');
});
