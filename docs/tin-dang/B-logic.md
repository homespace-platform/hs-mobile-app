# B. Logic đăng tin trên mobile

Nguồn chuẩn: `hs-web-app/app/dashboard/properties/new/**`. Backend không đổi.

**Trạng thái:** logic nằm trong module mới. `ListingDraftScreen.tsx` chưa sửa, vẫn chạy logic cũ cho tới khi phần C chuyển sang các module dưới đây.

Kiểm tra đã chạy: `npm run typecheck` và `npm run test:listing-editor` (27 ca, so trực tiếp với mã nguồn web cho căn hộ / nhà / phòng, gồm sửa và nhân bản; cần thư mục `../hs-web-app`), `npm run test:api`, `tests/rental-cache.test.cjs`. Chưa chạy trên thiết bị hay server thật.

## 1. Khoảng cách so với web

### Đã làm (trong module mới)

| Mobile cũ | Theo web |
|---|---|
| Enum gửi bằng nhãn tiếng Việt (hướng `Đông`, giấy tờ `Sổ hồng / Sổ đỏ`) | Mã enum (`EAST`, `PINK_BOOK`…) |
| Tình trạng tài sản `NORMAL`, `MINOR_DAMAGE` bị đổi thành `GOOD` | Đủ 5 mức, giữ nguyên khi sửa |
| Không có giá trị mặc định | Mặc định như web (chi tiết, chi phí, cọc 1 tháng, tối thiểu 6 tháng) |
| Chỉ gửi chi phí khi không chọn chi nhánh | Luôn gửi; chi nhánh chỉ điền sẵn khi **tạo mới**; luôn sửa được |
| Sửa tin làm mất mô tả/thứ tự phí | Phí không đổi được gửi lại nguyên bản |
| Chọn chi nhánh không điền gì | Loại hình, đơn vị giá, địa chỉ, phí, mô tả từ nội quy, cảnh báo thiếu biểu phí |
| Chính sách: không có mặc định/quy định hệ thống, mất ghi chú đã nhập | Mặc định gợi ý, đổi gợi ý theo loại hình, quy định hệ thống, chặn lưu khi thiếu danh mục |
| Đổi loại hình xóa chính sách, giữ tài sản | Quy tắc reset của web |
| Chỉ địa chỉ mới | Địa chỉ hồ sơ (`SAVED`) hoặc địa chỉ Vietmap mới |
| Thông báo kiểm tra khác web | Cùng thứ tự, thông báo, bước |
| Không có nhân bản | Có (`sourceMediaId`, bỏ mã phòng/mã căn, thêm "(Bản sao)") |
| Không xử lý bản sửa chờ duyệt | `requiresEditReview`, thông báo theo `pendingEditId` |
| Chặn sửa `RENTED`, `VIOLATION` | Chỉ khóa `RENTED_EXTERNALLY` (server vẫn kiểm quyền) |
| Chặn gửi khi chi nhánh thiếu biểu phí | Chỉ cảnh báo |
| Không giới hạn video 2 phút | Có |
| Không có sinh mô tả | Gọi `POST /api/listing-description`, bỏ kết quả cũ, hủy được |
| Không nhận biết hết lượt | Nhận biết lỗi quota và lỗi 4012 |

### Chưa làm / giới hạn

- Toàn bộ giao diện (phần C), gồm thẻ gói thành viên, modal hết lượt, điều hướng KYC.
- File cũ `src/lib/listing-create.ts`, `listing-edit.ts`, `listing-draft.ts` còn lại vì màn hình cũ đang dùng. **C xóa ba file này** sau khi chuyển.
- `tests/rental-cache.test.cjs` yêu cầu `screens/ListingDraftScreen.tsx` có `withFileLease(`. Nếu màn hình mới chỉ gọi `submitListing`, đổi dòng đó thành `services/listingEditorApi.ts`.
- Ảnh giới hạn 25 MB theo server (web chỉ ghi gợi ý 10 MB, không chặn).
- Upload giữ purpose `LISTING_IMAGE` / `LISTING_VIDEO` (server yêu cầu).
- Tệp media cũ không có `storageObjectId`: web âm thầm bỏ; mobile chặn lưu và yêu cầu xóa/tải lại.
- Theo đúng web nên mobile cũng: kiểm tra mọi trường cả khi lưu nháp; khi sửa không gửi lại `pricing.vatIncluded`. Các thay đổi sau review (phạm vi thuê, ngày bàn giao, phí khác...) ở [`review-xu-ly.md`](review-xu-ly.md).
- Cần đặt `EXPO_PUBLIC_WEB_BASE_URL` (đã có sẵn trong `env.ts` và `.env.example`) để sinh mô tả; trên Android dev, `localhost` được đổi theo `EXPO_PUBLIC_ANDROID_API_HOST`.

## 2. BÀN GIAO CHO GIAO DIỆN

### Dạng state (`@/lib/listing-form`)

```ts
ListingFormState {
  basicInfo: { branchId?, title, images, videos, category: 'apartment'|'house'|'room',
               availableDate /* YYYY-MM-DD */, description }
  apartmentDetails, houseDetails, roomDetails  // giữ riêng, đổi loại hình không mất dữ liệu
  furnishingAssets: { itemCode, assetName, quantity, handoverCondition, conditionNote? }[]
  selectedAmenities: string[]                  // mã catalog + tên tự nhập
  listingPolicies: { code, value, note? }[]    // giá trị thô
  monthlyExpenses: { electricityType, electricityPrice, waterType, waterPrice,
    managementFeeType, managementFee, internetType, internetFee, garbageFeeType, garbageFee,
    motorbikeParkingType, motorbikeParkingFee, carParkingType, carParkingFee,
    customFees: { id, name, amount, unit }[] }
  pricing: { priceMonthly, priceUnit, isNegotiable, depositType: 'NONE'|'AMOUNT'|'MONTHS',
             depositAmount, depositMonths, paymentCycle: 'MONTHLY', minimumLeaseMonths }
  addressMode: 'saved'|'new'
  selectedAddress: { refId?, display?, addressNote?, ... } | null
  selectedViewingDays: string[]
  selectedViewingSlots: string[]
}
ListingMediaItem { name, uri, file?, storageObjectId?, sourceMediaId? }  // uri để xem trước
ListingEditorSession { mode: 'create'|'edit'|'duplicate', listingId, sourceTitle, status,
                       pendingEdit, vehicleLimits, chargeBaseline }
```

Ô số giữ dạng chuỗi. UI tự giữ thêm: `catalog`, `catalogError`, `errors: Record<string,string>`, `step`, cờ đang lưu.

### Hàm theo module

**`@/services/listingEditorApi`**
- `loadListingEditor({ listingId?, duplicateFromId?, branchId? })` → `{ state, session, notice?, branches, savedAddress }`. Ném `Error` có thông báo để hiện toàn màn hình.
- `submitListing({ state, session, catalog, catalogError, savedAddress, action, singlePage? }, { onStart?(loadingText), onMediaUploaded?(kind, index, storageId) })` → không ném, trả `status`:
  - `saved` `{ id, pendingEditId, message }`
  - `invalid` `{ validation, message }`
  - `kyc` / `locked` / `quota` `{ message }`
  - `error` `{ message, externallyRented? }`

**`@/lib/listing-form`** (hàm thuần, trả state mới)
- `createListingForm`, `getTodayDateString`, `categoryCode`, `toggleValue`
- `canChangeCategory(state, mode)`, `changeCategory(state, category, mode)`
- `selectBranch(state, branchId, branches, mode)` → `{ state, notice? }`; `branchLabel`, `BRANCH_NONE_LABEL`
- `visibleAmenities(options)`, `customAmenities(selected, options)`, `addCustomAmenity(selected, text)`
- `emptyFurnishingRow`, `toggleCatalogFurnishing(rows, item)`, `isFurnishingRequired(state)`, `activeDetails(state)`, `newCustomFee`
- Hằng: `PROPERTY_CATEGORIES`, `PRICE_UNITS_BY_CATEGORY`, `DEPOSIT_TYPES`, `PAYMENT_CYCLES`, `VIEWING_DAYS`, `VIEWING_SLOTS`

**`@/lib/listing-fields`**
- `DETAIL_SECTIONS[category]` = `{ title, description, fields[] }`; field = `{ key, label, type: 'text'|'number'|'select'|'checkbox'|'furnishing-assets', required?, options?, placeholder?, hint?, maxLength? }`. `key` trỏ vào `<category>Details`.
- `EXPENSE_CONTROLS[]` = `{ typeKey, priceKey, label, placeholder, apartmentOnly?, options[{ value, label, unit?, note? }] }` (option có `unit` thì hiện ô giá, ngược lại hiện `note`).
- `FURNISHING_OPTIONS`, `HANDOVER_CONDITIONS`, `LEGAL_STATUS_OPTIONS`, `ORIENTATIONS`

**`@/lib/listing-validation`**
- `WIZARD_STEPS`, `LAST_STEP`, `POLICY_STEP`, `STEP_SECTIONS`, `EDIT_SECTIONS`, `isSinglePage(mode, step)`
- `catalogState` = `{ definitions: catalog?.policies ?? [], error: catalogError }`
- `validateStep(state, catalogState, step, { savedAddressRefId })` → `{ ok, errors, step?, focusIds?, message? }`
- `validateListing(state, catalogState, action, { savedAddressRefId, singlePage, skipDescription })` → như trên
- `firstInvalidStep(state, context)`, `collectErrors`, `validatePolicies` (trả thông báo hoặc `null`), `errorMap`
- Khóa trong `errors` là `key` của trường; tài sản: `furnishingAssets.<i>.assetName|quantity`; thêm `policies`, `streetLine`, `viewingDays`, `viewingSlots`.

**`@/lib/listing-policy`** (`category` ở đây là `'APARTMENT'|'HOUSE'|'ROOM'`)
- `policyField(definition, rows, category)` → `{ row, fixedValue?, fixedNote?, choices, template? }`
- `selectPermission(row, value, category)`, `replacePolicy(rows, row)`, `withSystemRules(rows, definitions, category)`
- `CATALOG_LOADING`, `CATALOG_LOAD_FAILED`, `catalogMessage(policies)`, `POLICY_TEXT_MAX`, `POLICY_NOTE_MAX`

**`@/lib/listing-editor`**
- `applyCatalog(state, session, catalog)`, `listingLock(session, title)` → `{ title, message } | null`, `requiresEditReview(session)`, `EDIT_SUBMIT_CONFIRM`

**`@/lib/listing-media`**
- `mediaSlotsLeft(basicInfo, kind)`, `addPickedMedia(basicInfo, kind, pickerAssets)` → `{ basicInfo, errors }`, `removeMedia(basicInfo, kind, index)`, `markUploaded(basicInfo, kind, index, id)`, hằng `MAX_*`. `kind` = `'IMAGE'|'VIDEO'`.

**Mô tả:** `@/lib/listing-description` + `@/services/listingDescriptionApi`
- `createDescriptionJob({ read, fetch: fetchListingDescription })` → `{ run(confirmReplace, onGenerating), abort() }`
- `read()` = `{ facts: buildDescriptionRequest(state, session, catalog, savedAddress), description: state.basicInfo.description }`
- `run` → `busy` / `cancelled` (im lặng), `stale` / `error` `{ message }`, `done` `{ description, message }`
- `DESCRIPTION_BLOCKED_MESSAGE`, `DESCRIPTION_REPLACE_CONFIRM`, `DESCRIPTION_STEPS`

**Địa chỉ và catalog:** `@/lib/listing-latest` (`createLatest`, `ADDRESS_MIN_QUERY`, `ADDRESS_DEBOUNCE_MS`, `ADDRESS_ERROR_MESSAGE`); tìm bằng `searchBranchAddress(text, signal)` (`branchApi`), chọn bằng `getLocationPlace(refId, signal)` (`userApi`); `getListingCatalog(category)` (`listingCreateApi`).

**Hết lượt:** `@/lib/listing-quota` (`getPublishableUses`, `isOutOfQuota`, `QUOTA_BANNER`) + `getMyMembership()` (`membershipApi`).

### Checklist hành vi UI

Quyền và mở màn hình
- [ ] `useFeatureGate(PERMISSIONS.LISTING_POST)`: không được phép thì thay form bằng `title` (lý do khóa).
- [ ] Hồ sơ chưa KYC: đưa đi xác minh bằng `startKyc` (`@/lib/kyc/client`), cả khi mở màn hình và khi kết quả lưu là `kyc`.
- [ ] Đang tải / lỗi tải hiện toàn màn hình; hiện `notice`. `listingLock(...)` khác `null`: màn khóa, có "Xem chi tiết tin", "Nhân bản thành tin mới".
- [ ] Nối `duplicateFromId` (prop đã khai báo ở màn hình cũ nhưng chưa dùng) vào `loadListingEditor`.
- [ ] Tiêu đề: "Đăng tin cho thuê" / "Chỉnh sửa tin đăng" / "Nhân bản tin đăng". Nhân bản có banner `Đang tạo tin mới từ "<sourceTitle>"`: tin gốc không đổi, tin mới chỉ tạo khi lưu nháp hoặc gửi duyệt.

Điều hướng và kiểm tra
- [ ] Tạo/nhân bản: wizard 6 bước; sửa: một trang. Bước 6 hiện mọi section, sửa được tại chỗ.
- [ ] "Tiếp tục" gọi `validateStep`; stepper cho bấm bước `<= firstInvalidStep`.
- [ ] Khi lỗi: đặt `errors = result.errors`, chuyển `result.step` (trừ khi một trang), cuộn tới `focusIds[0]`, hiện `message`.
- [ ] Đổi bước thì cuộn lên đầu.

Catalog
- [ ] Sau khi tải editor và mỗi lần `category` đổi (cả do chọn chi nhánh): đặt `catalog = null`, `catalogError = CATALOG_LOADING`; tải qua `createLatest`; chỉ khi còn mới nhất: đặt `catalog`, `catalogError = catalogMessage(catalog.policies)`, `setState(s => applyCatalog(s, session, catalog))`. Lỗi: `CATALOG_LOAD_FAILED`, cho thử lại.
- [ ] Có `catalogError` thì hiện lỗi thay cho các trường chính sách.

Thông tin cơ bản và media
- [ ] Tiêu đề tối đa 150 ký tự; ngày chọn từ hôm nay.
- [ ] Loại hình khóa khi sửa hoặc đã chọn chi nhánh (ghi chú "Theo chi nhánh"). Đổi loại hình phải xác nhận "Xác nhận đổi loại hình" ("Giữ nguyên" / "Đồng ý đổi"), rồi `changeCategory` và xóa `errors`.
- [ ] Chọn chi nhánh qua `selectBranch`, hiện `notice`, xóa lỗi `streetLine`.
- [ ] Tối đa 6 ảnh, 3 video; ảnh đầu là "Ảnh bìa". Truyền asset của ImagePicker (có `duration`) vào `addPickedMedia`, hiện từng lỗi.

Chi tiết, tiện ích, giá
- [ ] Render theo `DETAIL_SECTIONS`; bảng tài sản: chip catalog bật/tắt, thêm dòng tay; mỗi dòng có tên, số lượng, tình trạng, ghi chú.
- [ ] Tiện ích: ẩn `PETS_ALLOWED`; tiện ích tự nhập xóa được.
- [ ] Đơn vị giá theo loại hình; ô cọc theo `depositType`; "Thương lượng"; hiện số tiền định dạng VND.
- [ ] Chi phí theo `EXPENSE_CONTROLS` (phí quản lý chỉ căn hộ); phí khác thêm/xóa, đơn vị cố định `đ/tháng`. Chọn chi nhánh vẫn sửa được.

Chính sách, vị trí, lịch
- [ ] Hiện giá trị từ `withSystemRules(...)`; thẻ có `fixedValue` chỉ đọc, nhãn "Quy định hệ thống". PERMISSION đổi bằng `selectPermission`; INTEGER và PERMISSION có ô ghi chú; TEXT nhiều dòng; nút "Dùng mẫu gợi ý" khi có `template`. Ghi vào `listingPolicies` bằng `replacePolicy`.
- [ ] Không chọn chi nhánh và có `savedAddress`: hai nút "Dùng địa chỉ hồ sơ" / "Chọn địa chỉ mới". Có chi nhánh: địa chỉ khóa, "Địa chỉ theo chi nhánh đã chọn."
- [ ] Ô địa chỉ: tìm từ 2 ký tự, trễ 350 ms; gõ lại thì `selectedAddress = null`; chọn gợi ý thì gọi `getLocationPlace`; hủy request khi unmount. Ghi chú địa chỉ (nếu UI cho sửa) ghi vào `selectedAddress.addressNote`.
- [ ] Lịch xem: bật/tắt ngày và buổi (kèm giờ).

Mô tả
- [ ] Trước khi `run`: `validateListing(..., 'SUBMIT_FOR_REVIEW', { skipDescription: true })`; lỗi thì chỉ chỗ lỗi và hiện `DESCRIPTION_BLOCKED_MESSAGE`.
- [ ] Tạo job một lần (ref); `read` phải đọc state mới nhất (ref). Đang tạo: khóa ô mô tả, đổi chữ `DESCRIPTION_STEPS` mỗi 1300 ms. `done`: ghi mô tả, xóa lỗi `description`. Gọi `abort()` khi unmount và trong `onStart`.
- [ ] Đếm ký tự, ghi "(tối thiểu 30 ký tự)".

Lưu
- [ ] Khóa bằng ref: một lần lưu tại một thời điểm; khóa form khi đang lưu (upload ghi theo index).
- [ ] `onMediaUploaded`: `setState(s => ({ ...s, basicInfo: markUploaded(s.basicInfo, kind, index, id) }))`.
- [ ] `requiresEditReview`: ẩn "Lưu nháp", ghi "Admin duyệt nội dung mới. Trạng thái cho thuê tiếp tục theo hồ sơ hiện tại."
- [ ] Sửa: nút "Cập nhật & Gửi duyệt": `validateListing` → xác nhận `EDIT_SUBMIT_CONFIRM` → `submitListing`.
- [ ] `saved`: hiện `message`, về danh sách. `error`: giữ form; `externallyRented` thì đặt `session.status = 'RENTED_EXTERNALLY'`.
- [ ] `quota`: giữ form, banner `QUOTA_BANNER`, modal gồm "chỉ lưu nháp", "lưu nháp rồi mua gói", "lưu nháp rồi mua lượt" (đều `SAVE_DRAFT`), tải lại membership. Lưu thành công thì đóng banner.
- [ ] Web không chặn nút gửi theo số lượt; chỉ hiển thị.
- [ ] Thoát khi chưa lưu: giữ hộp xác nhận hiện có của mobile.
