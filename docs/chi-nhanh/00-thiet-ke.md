# Chi nhánh / Tòa nhà trên mobile · Thiết kế

Nguồn chuẩn: `hs-core-api/docs/branch/00-concept.md` (thắng mọi thứ; chủ dự án đã yêu cầu thêm mobile), API ở `01-thiet-ke.md` và `07-thiet-ke-p3-p5.md`, quyết định ở cuối `04-cau-hoi.md`. Hành vi lấy theo `hs-web-app`. Tiến độ: `01-tien-do.md`.

Mục tiêu: **nhìn là biết phòng nào cần làm gì, không sót**. Chi nhánh chỉ xem và dẫn đường: mọi việc xử lý ở màn đã có. Không thêm màn nhập chỉ số, thu tiền hay kéo thả. Dữ liệu ghi thêm chỉ có sơ đồ, liên kết phòng/chi nhánh và dấu phòng.

## 1. Nguyên tắc UI (bắt buộc cho cả V, E, A)

- Vùng bấm tối thiểu 44dp. Trong cấu hình NativeWind này `min-h-11` chỉ ra **38,5dp**, `min-h-12` ra **42dp**. Dùng `min-h-[48px]` (`ActionButton` thường dùng `className="min-h-[48px]"`; bản `compact` đã đủ 44).
- Màu không bao giờ là tín hiệu duy nhất: mỗi trạng thái có biểu tượng + chữ (`lib/branch-status.ts`).
- **Không đặt icon trong ô bo góc có nền màu.** Vì vậy không dùng `EmptyBlock` (có sẵn ô icon) và không truyền `icon` cho `ModalShell`. Ô trống/rỗng chỉ cần khung viền đứt + chữ. `LoadingBlock`, `ErrorBlock`, `StatusTag` dùng được. Hộp thoại chung `useDialog` giữ nguyên.
- Chỉ dùng token theme. Đã thêm đúng một cặp mới `pending` / `pending-soft` (tím "chờ xác nhận" của concept §5).
- Chạy ổn ở rộng 320px và cỡ chữ lớn: không đặt chiều cao cố định cho khối có chữ, cho phép xuống dòng (`flex-wrap`, `shrink`), không `numberOfLines` cho mã phòng, trạng thái, hạn. Trang không cuộn ngang; **chỉ vùng sơ đồ, hàng chú giải và hàng chọn tầng** cuộn ngang bên trong.
- Phân biệt rõ đang tải / rỗng / lỗi (có "Thử lại"). Lỗi tải lại giữ dữ liệu cũ và nói là có thể đã cũ.
- Lý do từ máy chủ: `branchError(error, câuMặcĐịnh)`.
- Nút/hàng bấm có `accessibilityRole` và nhãn đọc đủ ý; có trạng thái `selected` / `expanded` / `disabled`. Có phản hồi khi nhấn (`active:bg-muted`). Mọi sheet có nút đóng và đóng được bằng Back Android.
- Một màn một hành động chính.

## 2. Bản đồ màn hình và điều hướng

App không dùng thư viện điều hướng: state + render có điều kiện. `screens/BranchManagementScreen.tsx` là shell, giữ toàn bộ state của chi nhánh.

```
Quản lý (menu hoặc thông báo gộp)
└─ Danh sách chi nhánh                    mode 'list'
   ├─ Thêm chi nhánh (form 3 bước)        mode 'form' ─ tạo xong ─┬─ HOUSE: Chi tiết (sơ đồ 1 ô tự tạo)
   │                                                              └─ khác : Thiết lập sơ đồ (bỏ qua được)
   └─ Chi tiết chi nhánh                  mode 'detail'   [Sơ đồ] [Cần chú ý (n)]    "Thông tin" ở đầu trang
      ├─ Thông tin chi nhánh              mode 'info'     địa chỉ, phí, nội quy, Sửa (form), Xoá
      ├─ Sửa / thiết lập sơ đồ            mode 'editor'   (E) toàn màn hình
      ├─ Sheet phòng (V) chứa phần gắn kết (E)
      ├─ Sheet "Chưa xếp phòng" (E)
      └─ Đích đến (màn đã có)             state destination → BranchDestinationHost (A)
```

**Back** (nút trên đầu và nút cứng Android, đều qua `ScreenHeader` hoặc `onRequestClose` của Modal):

| Đang ở | Back về |
|---|---|
| Đích đến | Chi tiết, đúng tab, tầng, lớp, tháng; khay vẫn mở nếu đang mở |
| Sheet phòng / khay | Sơ đồ |
| Sửa sơ đồ | Chi tiết; có thay đổi thì hỏi trước (E) |
| Form (bước 2, 3) | Bước trước; bước 1: Thông tin (khi sửa) hoặc Danh sách (khi tạo), hỏi nếu đã sửa |
| Thông tin | Chi tiết |
| Chi tiết | Danh sách |
| Danh sách | Menu Quản lý, hoặc nơi đã mở (thông báo) |

Đích đến **không** đi qua `App.openListing` / `App.openRental`: hai hàm đó tháo shell và làm mất chỗ đang xem. Host vẽ màn đã có ngay bên trong shell. Chỉ thanh tab dưới (`onSelectTab`) mới rời chi nhánh.

`BranchViewState {floorId, layer, month}`, tab và cờ mở khay do shell giữ (thay cho query trên URL của web). Ô tìm kiếm, chú giải đang làm nổi và vị trí cuộn không được giữ (web cũng không đưa hai mục đầu lên URL).

Cập nhật dữ liệu: các tab bị tháo khi mở đích đến nên quay về là đọc lại; `useBranchRead` đọc lại thêm khi app trở lại foreground. Shell gọi `summary.reload()` mỗi khi danh sách hoặc chi tiết hiện lại, nên việc đã xử lý tự biến mất.

## 3. Danh sách chi nhánh (shell + A)

```
‹  Chi nhánh / Tòa nhà
[ + Thêm chi nhánh                ]
[ Tìm tên, loại hoặc địa chỉ      ]
≡ Bộ lọc                              (ngày tạo + đủ/thiếu phí, thu gọn mặc định)
┌──────────────────────────────────┐
│ (ảnh bìa nếu có)                 │
│ Dãy trọ Văn Lang              ›  │  bấm → Chi tiết, tab Sơ đồ
│ Phòng trọ · CN-VL01              │
│ 12 Nguyễn ...                    │
│ 12 phòng/căn   Thiếu biểu phí    │
├──────────────────────────────────┤
│ ! 3 việc cần chú ý            ›  │  bấm → Chi tiết, tab Cần chú ý (A)
└──────────────────────────────────┘
```

- Thứ tự: `orderByAttention` theo thứ tự máy chủ (gấp nhất lên đầu). Đã nối trong shell.
- Hàng số việc (`BranchCard`, A): `count > 0`: "n việc cần chú ý", nền `warning-soft`, `alert-circle-outline`, cao ≥ 48, có chevron, gọi `onOpenAttention`, nhãn đọc "n việc cần chú ý ở chi nhánh X". `count === 0`: dòng chữ phụ "Không có việc cần chú ý". `undefined`: không hiện gì. Summary chỉ có số, không có mức gấp, nên không tự tô đỏ.
- Hàng số việc là **anh em** của `Pressable` thân thẻ, không lồng bên trong.
- Lỗi summary: shell đã có ô báo + "Thử lại"; danh sách vẫn dùng được.
- Xoá: nút ở màn Thông tin. Luôn gửi DELETE rồi hiện **lý do của máy chủ**; không chặn trước bằng `totalUnits` (01 §3).

## 4. Điều hướng đích (A: `lib/branch-target.ts` + `BranchDestinationHost`)

`BranchNav.openTarget(target)` = `targetHref(target)` (chỉ nhận `/dashboard/…`) → `branchDestination(href)` → `nav.open(...)`. Trả `null` thì shell báo "Chưa mở được trên điện thoại". Quyết định theo **href**, không theo `target.kind`.

`branchDestination` phải thuần. Phần lớn dùng lại `rentalRouteFromActionPath(href, 'landlord')` (trả `link-error` thì vẫn mở được, màn đó tự báo lỗi); tự xử lý bốn nhóm còn lại.

| href của web (07 §6) | Dùng cho | Đích mobile | Ghi chú |
|---|---|---|---|
| `/dashboard/landlord/contracts/{id}?tab=overview\|payment\|sign\|end` | HĐ gốc, ký, hết hạn, cọc/khoản đầu trước hiệu lực | `rental` → `contract-detail` | có sẵn trong deep-link |
| `…?tab=payment&section=monthly[&invoice={id\|first-rent:…}]` | hoá đơn, ghi số, khoản đầu | `rental` → `contract-detail` | giữ nguyên `invoice` sau decode; mở đúng hoá đơn |
| `…?tab=end&amendmentId={id}` | phụ lục chờ phản hồi | `rental` → `contract-detail`, tab Hủy / kết thúc | **Thiếu:** mobile chưa cuộn tới đúng thẻ phụ lục; thẻ việc ghi "kéo đến mục Phụ lục / điều chỉnh" (`targetNote`). Không sửa màn HĐ trong đợt này |
| `…?tab=end&focus=early-exit` | chấm dứt chờ phản hồi | như trên | **Thiếu:** chưa tự mở rộng panel trả phòng sớm; thẻ ghi "kéo đến mục Kết thúc sớm / trả nhà" |
| `/dashboard/contracts/{id}[?tab=sign]` | ký phụ lục/gia hạn, văn bản trả sớm | `rental` → `contract-landing` | có sẵn |
| `/dashboard/rental-requests?requestId={id}` | yêu cầu thuê, giữ chỗ, 3 việc P4-R2 | `rental` → `rental-requests` RECEIVED | có sẵn |
| `/dashboard/payments?paymentId={id}` | chờ xác nhận, hoàn tiền, quyết toán, bù cọc | `rental` → `payment-lookup` với `actHere: true` (chỉ link từ chi nhánh) | Khoản hoàn / quyết toán (`isSettlementTransfer`: `INITIAL_PAYMENT_REFUND`, `DEPOSIT_REFUND`, `DEPOSIT_ADJUSTMENT`, `OTHER_CHARGE` không có hoá đơn): `PaymentLinkScreen` hiện `SettlementPaymentPanel` tại chỗ, kèm nút sang hồ sơ thuê / quyết toán cọc (vì hồ sơ thuê không có nút chuyển khi khoản hoàn đã quá hạn; HĐ không có HĐ cọc không có khung thanh toán). Khác 07 §6: khoản cọc cũng thao tác tại chỗ. Khoản khác: nhảy thẳng tới màn xử lý. Thông báo không có `actHere`, giữ hành vi cũ |
| `/dashboard/properties/view?id={id}` | tin đang đăng / bị từ chối / hết hạn | `listing` → `ListingDetailScreen own` | theo cách `MyListingsScreen` đang gọi; đóng thì về chi nhánh |
| `/dashboard/properties/new?branchId=&roomId=` | phòng trống chưa đăng tin | `new-listing` → `NewRoomListingScreen` (E) | thiếu một trong hai id → `null` |
| `/dashboard/viewing-schedules?appointmentId={id}` | lịch xem chờ duyệt | `appointment` → `AppointmentsScreen role="OWNER" linkedAppointmentId` | X / Back trên lịch được liên kết về chi nhánh (`onLinkedClose`) |
| `/dashboard/branches/{id}?tab=map#unplaced` | HĐ/tin chưa xếp | `tray` | shell tự chuyển tab Sơ đồ và mở khay; không qua host |
| khác | | `null` | báo chưa mở được |

Kiểm `id` bằng `safeResourceId`. Host:

- `rental`: `RentalNavigator` với `stack` là state của host (khởi tạo `[route]`), `role="landlord"`, `onExit={onClose}`, `onBrowseListings={() => onSelectTab('search')}`; `onOpenListing` mở `ListingDetailScreen` chồng lên trong host mà **không mất stack**.
- `listing`: `onOpenMessages` không làm gì (chủ tin không có chat), `onOpenListing` đổi tin trong host. "Quản lý tin đăng" mở `MyListingsScreen` ngay trong host (nơi có "Gửi duyệt lại", "Hiển thị lại"), Back về tin; mục quản lý khác thì đóng như Back.
- `appointment`: `onBack={onClose}`, `onLinkedClose={onClose}`; bấm một hành động trên lịch thì ở lại màn lịch (Back về chi nhánh); "mở tin" xem trong host với `own`.
- `new-listing`: đã nối sẵn sang component của E.

Thông báo gộp `/dashboard/branches` đã ánh xạ ở `lib/notification.ts` (xong ở phần nền): mở danh sách chi nhánh.

## 5. Sơ đồ phòng, lớp xem (V)

Thứ tự từ trên xuống, một `ScrollView` có kéo để làm mới (gọi `overview.reload`, `onRefreshLayout` và `reloadTray`; chi nhánh chưa có tầng cũng đọc lại khay):

```
[✓ Phòng     ] [  Thu tiền  ]         lớp: lưới 2x2 (basis ~47%), 1 lớp mỗi lúc
[  Ghi chỉ số] [  Hợp đồng  ]
[‹]      Tháng 11/2026      [›]       chỉ lớp Thu tiền; "Tháng hiện tại" khi month ≠ ""
[Tìm mã phòng hoặc tên người thuê ✕]
‹ ! Quá hạn 2 · ⧗ Chờ xác nhận 1 · …› chú giải = bộ đếm, một hàng cuộn ngang
Làm nổi 2 phòng.        Bỏ làm nổi
‹[Tầng 1 (2 khớp)] [Tầng 2] ›         chỉ khi > 1 tầng
 Dãy 1          Dãy 2
┌────────────┐ ┌────────────┐
│ 101        │ │ 201        │
│ ! Quá hạn  │ │ ✓ Đã thu   │
│ 2 khoản    │ │            │
│ Hạn 08:00… │ └────────────┘
└────────────┘ ┌╌ Ô trống ╌╌┐
Khoản thu chưa xếp phòng (n)          lớp tiền của overview
[renderTray]                          khay (E)
[ Sửa sơ đồ ]                         khi canEdit
```

- **Cột = dãy**, giữ đúng hình sơ đồ. Tầng có 1 dãy: ô rộng hết trang. 2 dãy: hai cột `flex-1` (vừa 320px). Từ 3 dãy: cột rộng cố định khoảng 136, cuộn ngang trong vùng sơ đồ. Cỡ chữ lớn (`useWindowDimensions().fontScale ≥ 1.3`): cột rộng hơn, luôn cho cuộn ngang nếu không vừa.
- Ô: nền/viền theo `BRANCH_TONES[layerLook(layer,status).tone]`; mã phòng đậm; biểu tượng + `statusLabel`; theo lớp như web `BranchOverviewLayers.cell`: Phòng = tên người ở, "Sắp vào dd/mm: tên"; Thu tiền = "n khoản", hạn đầu tiên, đếm ngược nếu chờ xác nhận; Ghi chỉ số = ngày ghi + hạn; Hợp đồng = còn n ngày + mốc kết thúc. Trong ô tối đa vài dòng, đủ chi tiết nằm ở sheet. Chưa có overview: "Đang tải…"; không có dữ liệu phòng: "Chưa có dữ liệu".
- Ô trống: viền đứt, không bấm được.
- Chú giải: theo thứ tự khoá của `LAYER_STATUS_LABEL[layer]`, đếm **ô** trên mọi tầng theo `roomLayerStatus`; chỉ hiện trạng thái có số > 0 (và trạng thái đang chọn). Bấm để làm nổi, bấm lại để bỏ. Ô không khớp mờ đi (viền đứt, chữ phụ), ô khớp viền đậm `border-4 border-foreground`; tên đọc thêm "đang được làm nổi". Tìm bằng `roomMatches`.
- Tháng: `shiftMonth`, `monthLabel`; `month: ''` = tháng máy chủ, lấy `overview.month` để hiển thị. Chú thích nhỏ như web cho lớp Thu tiền, Ghi chỉ số, Hợp đồng.
- Đọc: `useBranchRead(load, describe)` với `load` phụ thuộc `branchId` + `view.month` gọi `branchOverviewApi.getOverview`. **Không hiện dữ liệu của tháng khác.** Đổi tầng/lớp không gọi lại. Overview lỗi: ô báo + "Thử lại" (+ "Về tháng hiện tại"); sơ đồ vẫn hiện trơn và bấm ô vẫn mở sheet. `layerReady` sai: báo máy chủ chưa có dữ liệu lớp đó, không tô màu.
- Đếm ngược: `confirmationCountdown(payment, overview, useNowMs() - at)`. Không dùng giờ máy để xét nghiệp vụ.

**Sheet phòng** (`ModalShell`, không icon; tiêu đề "Phòng 101 · Tầng 1, Dãy 1"). Bấm ô **luôn** mở sheet:

1. `StatusTag` trạng thái của lớp đang xem.
2. Các việc của lớp đang xem, mỗi mục một hàng lớn cả hàng bấm được (biểu tượng, tiêu đề, các dòng, chevron), nội dung như `paymentEntry` / `meterEntry` / `expiryEntry` / `stayEntries` của web. Bấm: đóng sheet rồi `nav.openTarget(entry.target)`. `targetHref` null: không chevron, ghi "Chưa có đường dẫn mở.". Target kind `ROOM` không phải một trang.
3. `renderRoomLinks({roomId, code}, overview.reload)` (E).

Khác web có chủ đích: web mở thẳng trang khi ô chỉ có một mục; trên điện thoại luôn qua sheet để không mở nhầm khi vuốt, và để một chỗ có đủ việc lẫn liên kết.

`renderTray` gọi **đúng một lần**, truyền hàm đọc lại overview. "Khoản thu chưa xếp phòng" (`overview.unplacedPayments`, tiêu đề kèm "Tháng m/yyyy và nợ cũ") cũng thuộc V, đặt ngay trên khay.

## 6. Trình sửa sơ đồ (E: `BranchMapEditor`)

Toàn màn hình. Port hành vi `BranchLayoutEditor`, `LayoutBoard`, `LayoutDialogs`; logic đã có trong `lib/branch-layout.ts` (không viết lại).

- Mẫu (khi sơ đồ rỗng hoặc "Chọn mẫu khác"): 4 thẻ chọn một (Một dãy, Hai dãy đối diện, Nhà nhiều tầng, Tự thiết kế), ô số tầng/số phòng bàn phím số, kiểm `MAX_FLOORS` / `MAX_ROOMS_PER_BATCH`.
- Bảng sửa: **một tầng mỗi lúc** (chip tầng + "Thêm tầng"). Cột dãy như §5; dưới mỗi cột nút **+** tròn ≥ 48. Tiêu đề dãy bấm được → sheet dãy (đổi tên, thêm nhiều phòng, thêm ô trống, xoá dãy). Hàng nút của tầng: "Thêm dãy", "Nhân bản", "Tuỳ chọn tầng" (đổi tên, đặt lại mã, xoá). "Đặt lại mã" cho mọi tầng có xem trước mã.
- Bấm ô → sheet ô: đổi mã (`roomCodeError` hiện ngay dưới ô nhập), Chuyển lên/xuống, Chuyển sang dãy khác (danh sách hàng bấm), đổi phòng ↔ ô trống, xoá ô. Mỗi thao tác đóng sheet và đọc thông báo ngắn (`accessibilityLiveRegion`). Không kéo thả. Không có phần gắn kết trong trình sửa (làm ở sheet phòng).
- Thanh dưới cố định: "Hoàn tác" · nút chính "Lưu sơ đồ" (khoá khi không có thay đổi, đang lưu hoặc bản nháp cũ). Khi `dirty` có thêm "Huỷ thay đổi" (hỏi lại). `setup`: đầu trang ghi "Đã tạo chi nhánh. Bước này không bắt buộc, bạn có thể làm sau." và nút "Bỏ qua" / "Xong" (khi đã lưu).
- `!canEdit`: hiện `lockMessage`, không cho sửa.
- Nhà nguyên căn: sơ đồ 1 ô **đã do shell tự tạo** (`loadBranchLayout`); trình sửa không tự tạo lại.

Lưu (giữ đúng web):

1. `validateDraft` → có lỗi thì hiện danh sách (tối đa 5), không gửi.
2. Trước khi lưu, nếu `lostAttachedRooms(saved, draft, rooms)` khác rỗng thì hỏi "Lưu sẽ bỏ phòng đang có liên kết" (đọc mới `branchAssignmentApi.getAssignments` ngay lúc lưu). Khác web: có phòng bị bỏ mà đọc lỗi thì bắt buộc xác nhận rằng liên kết trên các phòng đó có thể bị gỡ; không bao giờ lưu im lặng.
3. `saveLayoutDraft(branchLayoutApi, branchId, draft, saved, revision)`:
   - `saved`: nhận `layout`, xoá bản nháp, báo "Đã lưu sơ đồ." (`useToast` từ `@/components/rental/onboarding/common`).
   - `refused`: hiện đúng lý do máy chủ, giữ bản nháp, đọc lại liên kết.
   - `conflict`: khoá lưu, "Sơ đồ đã được thay đổi ở nơi khác…" + "Tải lại sơ đồ" (hỏi lại). Chỉ xoá bản nháp sau khi nhận được sơ đồ mới; GET lỗi thì "Thử lại" đề nghị khôi phục bản nháp.
   - `failed`: hiện lỗi, giữ bản nháp, cho thử lại.

Bản nháp (`services/branchDraftStore`, bất đồng bộ), quy tắc an toàn:

- `userId` lấy từ `useViewer()`. **Chưa có `userId` và chưa `read` xong thì chưa được ghi/xoá và chưa cho sửa** (nếu không hiệu ứng "không dirty thì xoá" sẽ nuốt bản nháp cũ).
- Sau khi tải: bản nháp trùng hệt cây đã tải (`sameLayout`) và cùng revision → `removeOwned`; khác → đề nghị "Khôi phục bản nháp" / "Bỏ bản nháp". Đang đề nghị thì không đụng vào bản lưu.
- Khi `dirty`: `owned = {revision: draftRevision, draft}` rồi `write`. Hết dirty: `removeOwned(owned)`. Không bao giờ `write(null)` bản mình không sở hữu.
- Bản nháp khác revision: mở lại xem được nhưng khoá lưu (`stale`).
- Rời trình sửa khi dirty (Back trên đầu, Back Android = `ScreenHeader onBack`, và `setLeaveGuard` cho push/mở cài đặt): hỏi "Bỏ thay đổi chưa lưu?" (Ở lại / Bỏ thay đổi); chọn bỏ thì xoá bản nháp. Đang lưu thì không cho rời. App bị tắt: bản nháp còn lại và được đề nghị lần sau.

## 7. Gắn phòng, khay, đăng tin cho phòng (E)

**`RoomLinksPanel`** (nằm trong `ModalShell` của V: không `ScrollView`, không mở Modal riêng; danh sách chọn hiện **thay chỗ ngay trong panel** và có nút "Đóng danh sách"). Port `RoomPanel` + `CandidatePicker`:

- Tự đọc `getAssignments(branchId)`; phòng không có trong kết quả → `emptyRoom`. Lỗi đọc không che phần trạng thái của V.
- Hợp đồng (`sortContracts`): Mở hợp đồng (`nav.open(itemDestination('CONTRACT', id))`), Chuyển phòng (các phòng khác + "Khay Chưa xếp phòng"), Gỡ khỏi chi nhánh. Giữ chỗ: Mở hồ sơ thuê (`rentalRequestDestination`). Tin: Mở tin, Gỡ khỏi phòng.
- Phòng trống liên kết: "Gắn hợp đồng có sẵn", "Gắn tin có sẵn", nút chính "Đăng tin cho phòng này" (`newRoomListingDestination`). Ứng viên phân trang 20, trạng thái nút/ghi chú từ `candidateState`; tin rỗng: chỉ đổi chi nhánh ở menu Tin đăng.
- "Đánh dấu phòng": 3 lựa chọn `MANUAL_STATUS_LABEL`, lựa chọn đang bật có dấu ✓.
- `permissionBlock(canEdit, lockMessage)` khoá thao tác ghi và nói lý do; mở trang vẫn được.
- Một lần ghi mỗi lúc; **sau mỗi lần ghi, kể cả lỗi**, đọc lại và gọi `onChanged()`; lỗi hiện lý do máy chủ ngay trong panel.
- Trên điện thoại hỏi xác nhận bằng `useDialog` trước "Gỡ khỏi chi nhánh" / "Gỡ khỏi phòng" (chống bấm nhầm).

**`UnplacedTray`**: hàng bấm "Chưa xếp phòng (n)  ›" (n = `unplaced.totalElements`; lỗi đọc thì hàng vẫn hiện kèm lỗi). `open` → `ModalShell` danh sách: mỗi mục Mở / Xếp phòng / (HĐ) Gỡ khỏi chi nhánh; "Thêm hợp đồng cũ" (đích: khay hoặc một phòng; khay dùng `addContractToTray`); phân trang; `rooms` rỗng thì nói cần tạo và lưu sơ đồ trước. Đóng sheet gọi `onOpenChange(false)`. Khi mở đích từ khay, **giữ `open`** để Back quay lại khay.

**Đăng tin cho phòng** (`NewRoomListingScreen` + editor tin có sẵn). `loadListingEditor` đã nhận `branchId`; việc còn lại:

- Thêm `branchId?`, `roomId?` vào `ListingDraftScreen` → `useListingEditor`.
- Port `hs-web-app/lib/listing-room-link.ts`: `roomId` chỉ gửi cho **tin tạo mới** (không `id`, không `duplicateSourceListingId`).
- Banner như `RoomLinkBanner`: đang gắn phòng nào; chưa tải được sơ đồ (Thử lại); phòng không còn (chọn lại); chưa áp dụng được chi nhánh; "Đăng tin không gắn phòng". Đổi chi nhánh trong editor → bỏ liên kết phòng và báo. Trước khi gửi: đọc lại sơ đồ, phòng không còn thì chặn, **không** tạo tin rời. Không tự điền mã phòng vào tiêu đề (Q3).
- Màn phụ của editor (xem tin, nhân bản, gói hội viên) xử lý như `MyListingsScreen`; lưu xong → `onClose()`.

## 8. Cần chú ý (A: `BranchAttentionTab`)

```
Cần chú ý (5)
Việc gấp ở trên. Bấm để mở đúng nơi xử lý; xử lý xong thì việc tự mất.
┌──────────────────────────────────┐
│ (! Gấp)  Tiền                    │
│ Quá hạn thanh toán            ›  │
│ Phòng 101 · HD-0001              │
│ Đã qua mốc 08:00 27/11/2026      │
└──────────────────────────────────┘
        [‹ Trước]  Trang 1/2  [Sau ›]
```

- Thứ tự, mức gấp, số đếm đều của máy chủ; không sắp lại, không gom lại. Mức: `StatusTag look={PRIORITY_LOOK[p]} label={PRIORITY_LABEL[p]}`; nhóm + nhãn: `workLabel`; ngữ cảnh: `workContext`; hạn: `workDeadline(work, data, useNowMs() - at)`.
- Cả thẻ bấm được → `nav.openTarget(work.target)`. `branchDestination` trả `null` → không chevron, ghi "Chưa mở được trên điện thoại.".
- `useBranchRead` + `getAttention(branchId, page)`; kéo để làm mới; phân trang 20; trang vượt cuối thì lùi về trang cuối. Rỗng: "Không có việc nào cần chú ý.". Lỗi: như web ("Chưa tải được danh sách việc. Các phần khác của chi nhánh vẫn dùng được.").
- Mỗi lần đọc được gọi `onCountChange(data.totalElements)`.
- `useBranchAttentionSummary`: `useBranchRead(branchOverviewApi.getAttentionSummary, …)`; hàm `load` và `describe` phải ổn định, `reload` ổn định. Badge của tab lấy số đến sau cùng giữa summary (`at`) và trang Cần chú ý.

## 9. Mã dùng chung (đã viết, đã typecheck)

| File | Nội dung |
|---|---|
| `src/types/branch-layout.ts`, `branch-assignment.ts` | Kiểu hợp đồng API, như web |
| `src/lib/branch-layout.ts` | Logic sơ đồ, giống hệt web |
| `src/lib/branch-layout-save.ts` | `saveLayoutDraft` (nhận ra lần lưu đã thành công, 409), `loadBranchLayout` (nhà nguyên căn) |
| `src/lib/branch-layout-draft.ts`, `services/branchDraftStore.ts` | Bản nháp trên máy (AsyncStorage), thao tác tuần tự |
| `src/lib/branch-assignment.ts` | Parser chặt, quy tắc phòng/ứng viên, dựng đích đến |
| `src/lib/branch-overview.ts` | Kiểu, nhãn, parser chặt, đếm ngược, tìm, thứ tự thẻ |
| `src/services/branchMonitorApi.ts` | `branchLayoutApi`, `branchAssignmentApi`, `branchOverviewApi` |
| `src/lib/branch-status.ts`, `components/branch/StatusTag.tsx` | Biểu tượng + tông màu mọi trạng thái và mức gấp |
| `src/lib/branch-nav.ts` | `BranchNav`, `BranchDestination`, `BranchViewState` |
| `src/lib/branch-error.ts`, `lib/use-branch-read.ts` | Lý do lỗi; đọc lại khi quay về; đồng hồ 30 giây |

Shell: `screens/BranchManagementScreen.tsx`, `screens/branch/BranchDetailScreen.tsx`, `ScreenHeader` có thêm prop `right`. Test nền: `tests/branch-foundation.test.cjs` (so với mã web).

## 10. Quyền sở hữu file khi làm song song

Mỗi agent **chỉ sửa file của mình**. File ở §9, shell, `global.css`, `tailwind.config.js` và test nền là chỉ đọc; cần đổi thì báo người điều phối. Props của stub là chốt cuối. Được thêm file mới trong thư mục của mình.

| Agent | File sở hữu |
|---|---|
| **V** (xem) | `src/components/branch/view/**` (stub `BranchMapView.tsx`); logic thuần mới đặt ở `src/lib/branch-view.ts`; test `tests/branch-view.test.cjs` |
| **E** (sửa) | `src/components/branch/editing/**` (`BranchMapEditor`, `RoomLinksPanel`, `UnplacedTray`, `NewRoomListingScreen`); `src/screens/ListingDraftScreen.tsx`; `src/components/listing-editor/**`; `src/services/listingEditorApi.ts`; `src/lib/listing-editor.ts`, `src/lib/listing-payload.ts`, mới `src/lib/listing-room-link.ts`; `tests/listing-editor.test.cjs`, `tests/branch-editing.test.cjs` |
| **A** (việc cần chú ý) | `src/components/branch/attention/**` (`BranchAttentionTab`, `BranchCard`, `useBranchAttentionSummary`, `BranchDestinationHost`); `src/lib/branch-target.ts`; test `tests/branch-attention.test.cjs` |

Phụ thuộc chéo duy nhất khi chạy: host của A vẽ `NewRoomListingScreen` của E; sheet của V vẽ `RoomLinksPanel` của E (qua render prop do shell nối). Props đã chốt nên không phải chờ nhau. Cho tới khi A xong `branchDestination`, `openTarget` báo "Chưa mở được"; `nav.open(...)` trực tiếp vẫn chuyển tới host.

Mỗi agent xong: `npm run typecheck`, `npm run test:theme`, test của mình và `node --test tests/branch-foundation.test.cjs`.

## 11. Khác web và giới hạn

- Không chặn được deep link tới đúng thẻ phụ lục / panel trả phòng sớm (xem §4): chỉ mở tab "Kết thúc".
- `/dashboard/payments?paymentId=` không có trang thẻ thanh toán riêng trên mobile: khoản hoàn / quyết toán xử lý ngay trên `PaymentLinkScreen` (§4), khoản khác nhảy tới hồ sơ thuê hoặc hoá đơn.
- Không có URL: tầng/lớp/tháng sống trong state, mất khi rời chi nhánh. Không chia sẻ được link.
- Không có "đóng tab/tải lại" của trình duyệt: thay bằng hỏi khi Back + bản nháp trên máy. Bản nháp theo máy, không đồng bộ với web.
- Sơ đồ nhiều dãy phải cuộn ngang; không thu phóng.
- Làm mới khi quay về = tháo/lắp lại hoặc app trở lại foreground (không có sự kiện focus cửa sổ).
- Web có tab "Tổng quan" kèm danh sách tin của chi nhánh. Mobile có hai tab theo yêu cầu; phần thông tin nằm ở "Thông tin", không dựng lại danh sách tin (đã có ở menu Tin đăng và trên sơ đồ).
