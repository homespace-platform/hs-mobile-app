# Pha 3.5 — Dọn code thuê cũ

Trạng thái: **XONG** (chưa thử trên thiết bị).

Quy tắc: chỉ xoá khi đã grep mọi importer (`src`, `App.tsx`, `tests`) và không còn ai dùng.
Không đụng file của agent 3.2.

## Nhật ký xoá

### Bước 1 — file không ai import

| Xoá | Bằng chứng |
|---|---|
| `src/screens/rental/placeholders.tsx` | grep `placeholders\|BlockPlaceholder\|ScreenPlaceholder\|ModalPlaceholder` trong src, App.tsx, tests, scripts: chỉ chính file đó; không tới được từ `App.tsx` |
| `src/components/RentalRequestForm.tsx` | không file nào import (các kết quả grep còn lại là type `RentalRequestForm` của `useRentalRequestForm`); thay bằng `components/rental/requests/*` |
| `src/lib/form-validation.ts` (`validDate`, `positiveInteger`, `nonnegativeInteger`, `today`) | importer duy nhất trong src là `RentalRequestForm.tsx` |
| `PolicyConsent` trong `components/PolicyDialog.tsx` | importer duy nhất là `RentalRequestForm.tsx`; code thuê mới dùng `PolicyConsent` riêng ở `rental/shared/PolicyNotice.tsx` (chỉ import `PolicyDialog`, `PolicyNotice` từ file gốc) |

Test: bỏ `dates and numeric form validation reject invalid calendar and count values` (chỉ phủ hàm đã xoá); `profile form validation...` chỉ bỏ dòng truyền `@/lib/form-validation` (`lib/profile-form.ts` không import nó), giữ mọi assertion.

### Bước 2 — phần thuê của `ManagementScreen`, `BillingScreen`, `billingApi`

Bằng chứng không tới được: `App.openManagement` đổi mọi section thuê sang `openRental`. Chỗ khác gọi `setManagementSection` với giá trị khác null là `openListing(..., section)`, mà chỉ `ManagementScreen` truyền `section` (tức section không thuê). App luôn truyền `initialSection` (khác null, kèm `key={managementSection}`) và `onExit`, nên menu nội bộ (section = null) cũng không tới được.

| Xoá | Ghi chú / bằng chứng |
|---|---|
| `ManagementScreen`: menu nội bộ (`MENUS`, tab vai, chấm đỏ trong menu, `ProfileCompletionBanner`, `TabHeader`), tab trạng thái yêu cầu, `requestTone`, lọc thanh toán, thẻ "Hóa đơn & chứng từ", mở `BillingScreen`; trong `EntryDetail`: phiếu xác nhận, onboarding, văn bản hợp đồng, QR/chứng từ/báo chuyển khoản, ô lý do, tải lại chi tiết từ server, gọi `markRentalNoticeSeen` | Giữ: danh sách/chi tiết tin đăng, tạo/sửa tin, chi nhánh, lịch hẹn, `BottomTabBar` + `attentionVersion`. Bỏ prop `onOpenRental` (sửa `App.tsx`). Với tin đăng, "Tải lại chi tiết" cũ chỉ xoá lỗi (không gọi API) nên nút vẫn làm đúng việc đó; kéo-để-tải ở màn chi tiết (không làm gì với tin đăng) đã bỏ |
| `src/screens/BillingScreen.tsx` | importer duy nhất là `ManagementScreen` |
| `src/services/billingApi.ts` (cả file) | importer duy nhất là `ManagementScreen`, `BillingScreen`; không test nào load. `getPayment` / `getContractPayments` trùng tên ở nơi khác thuộc `services/rental/*` |

Test: `tests/rental-nav.test.cjs`, ca `wiring: ...` chỉ bỏ assertion `ManagementScreen` gọi `rentalRouteForDestination(item.section)` (menu đã xoá); giữ assertion cho `App.tsx` và `NotificationsScreen`.

### Bước 3 — `managementApi`, `bookingApi`, `lib/booking`

`managementApi.ts` (importer đã grep: `App`, `BottomTabBar`, `AppointmentsScreen`, `RentalRequestsScreen`, `ManagementScreen`, `lib/notification`, `lib/dashboard-navigation`, `HomeScreen`, `ListingDetailScreen`, `NotificationsScreen`, `api.test.cjs`). Sau bước 2 không còn importer nào cho:

- `RENTAL_REQUEST_STATUSES`, `RentalRequestStatus`, `getRentalRequestCounts`
- `rentalEntry`, `paymentEntry`, `paymentTypeLabel`, `contractEntry`, `branchEntry` (nhánh `landlord-branches` của `getManagementPage` không bao giờ được gọi; chi nhánh dùng `branchApi`)
- `refreshManagementEntry`, `refreshRentalOnboarding`, `getContractDocuments`, `reportPaymentTransfer`
- type `Payment`, `RentalOnboarding`, `ContractDocument`, `BankAccount`, `Contract`, `Branch`
- action `reject|cancel|accept|confirm-receipt|reject-receipt`, `needsReason`

Thu gọn: `getManagementPage(page)` chỉ tải tin đăng của tôi; `performManagementAction(entry, action)` chỉ đổi trạng thái tin (vẫn chặn action không được mời); `money` bỏ export; `RentalRequest` còn 5 trường chấm đỏ đọc, bỏ export. Giữ nguyên `markRentalNoticeSeen`, `markAppointmentNoticeSeen`, `getManagementAttentionCounts` và mọi thứ chúng dùng.

`bookingApi.ts`: chỉ còn `getReservationPolicy` (`ProfileScreen` dùng). Đã xoá `estimateRental`, `getMyRentalRequestByListing`, `createRentalRequest` và type đi kèm (chỉ `RentalRequestForm` + test dùng; bản mới ở `services/rental/rental-request.service.ts`), và các re-export `createAppointment`, `getAvailability`, `getMyBookingByListing`, `rescheduleAppointment`, `Availability` (src không còn ai import qua file này trừ `lib/booking.ts` đã sửa; hàm thật ở `appointmentApi`).

`lib/booking.ts`: xoá `canBookSlot`, `viewingPeriod` (chỉ test dùng). Giữ `VIEWING_DAYS`, `canSelectViewingDay` (`BookingDatePicker`, dùng bởi `ListingDraftScreen`).

Thay đổi trong `tests/api.test.cjs`:

| Test cũ | Xử lý |
|---|---|
| `each management menu calls its real endpoint...` | bỏ assertion section thuê và `landlord-branches`; giữ phần tin đăng (đổi tên `own listings call...`) |
| `rental request tabs count all statuses...`, `payment menus distinguish...`, `only payee may confirm...`, `accepted rental requests ... cannot be canceled`, `report transfer requires proof...` | xoá: chỉ phủ hàm đã xoá |
| `rental policy and authoritative cost estimate...` | bỏ phần `estimateRental`; giữ chính sách giữ chỗ (đổi tên, thêm assert URL) |
| `listing rental action reads the existing request...` | xoá: chỉ phủ hàm đã xoá |
| `viewing date selection...` | bỏ 3 assertion `viewingPeriod` |
| `booking only accepts a slot still available...` | xoá: chỉ phủ `canBookSlot` |
| `changing dates can cancel the previous availability request...` | giữ nguyên assertion, load `appointmentApi.ts` thay vì re-export |
| mới | `a listing status change sends only an action offered for that listing` |
| dọn | bỏ fixture `payment`, `appointment` và stub `appointmentApi` trong `load()` (không còn ai dùng) |

## Giữ lại (chưa chắc / ngoài phạm vi)

- `statusLabel` giữ nguyên cả nhãn thanh toán/hợp đồng: chưa chắc hết các trạng thái tin đăng server có thể trả.
- Type `ManagementSection` giữ các giá trị thuê: `App`, `lib/notification`, `rental-nav`, `dashboard-navigation` vẫn dùng.
- `bookingApi.getReservationPolicy` trùng `rentalRequestService.getReservationPolicy`; không đổi `ProfileScreen`.
- `src/screens/RegisterScreen.tsx`: không tới được từ `App.tsx` nhưng không thuộc phần thuê.
- `src/lib/empty-module.js`, `src/lib/metamask-websocket.js`: không import tĩnh từ `App.tsx` (nghi do cấu hình bundler dùng).
- `docs/appointment-parity.md`, `docs/yeu-cau-thue.md` còn nhắc file cũ (tài liệu lịch sử, không sửa).

## Kiểm tra

| Lệnh | Kết quả |
|---|---|
| mọi script `test*` trong `package.json` (27) | đạt hết |
| `npx tsc --noEmit` | sạch |
| prettier (file đã sửa) | sạch |
| eslint (file đã sửa) | chỉ còn 2 lỗi `__dirname` `no-undef` trong `tests/api.test.cjs`, ở dòng có từ trước |
| `CI=1 npx expo export --platform android` | thành công (bundle resolve đủ) |

Chưa kiểm trên thiết bị: tab Quản lý, danh sách/chi tiết/ẩn/hiện/gửi duyệt lại tin đăng, tạo/sửa tin, chi nhánh, lịch hẹn, chấm đỏ.
