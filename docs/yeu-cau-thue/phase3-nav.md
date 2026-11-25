# Pha 3.1 — Nối điều hướng luồng thuê

Trạng thái: **XONG phần code** (chưa thử trên thiết bị).

## Khảo sát

- Web điều hướng thông báo chỉ bằng `router.push(actionPath)` (`NotificationDropdown.openItem`, `app/notifications/page.tsx`), không hỏi vai. Vai do trang đích xác định: hợp đồng/hoá đơn theo bên tham gia thật, khoản tiền theo `paymentLink`, yêu cầu thuê theo URL. Chỉ `/dashboard/invoices` trần dùng vai đã lưu (chưa có thì mời chọn) và `/dashboard/contracts` trần dùng vai đã lưu, mặc định tenant; notification service không gửi hai đường dẫn này. Mobile dùng `managementRole` (luôn có giá trị, mặc định tenant) nên không hỏi.
- Push native (`firebase-push.provider.ts`) chỉ mang `data = {event: 'notifications.changed', category}`: **không có actionPath/id**.

## 1. Chạm thông báo / push — xong

- `NotificationsScreen.open`: đánh dấu đã đọc như cũ → `rentalRouteFromActionPath(actionPath, managementRole)` → `onOpenRental`. `null` → `notificationTarget` như cũ. Giữ `requestId`, `paymentId`, khiếu nại, `tab/section/invoice`.
- Push (kể cả cold start): payload không có đích nên **không đổi** (`CHAT` → Tin nhắn, còn lại → trung tâm thông báo; chạm tiếp vào mục sẽ đi theo dòng trên). Không sửa `use-push-events.ts`, không log payload.
- Banner push khi app đang mở dùng cùng đường này. App không có popup thông báo trong app như web (`NotificationPopup`).

## 2. Cổng đăng nhập / onboarding — xong (không cần code)

- **Đích thuê không thể tới khi chưa đăng nhập:** push không mang đích; không có app link/deep link nào cho trang thuê (scheme `homespace://` chỉ xử lý kết quả KYC); đích thuê chỉ sinh khi chạm mục trong trung tâm thông báo (đã đăng nhập).
- Chạm push còn trên khay sau khi đăng xuất: `usePushEvents` chỉ mount khi đã đăng nhập và đọc `getLastNotificationResponse()` lúc mount, nên sau đăng nhập vẫn mở trung tâm thông báo (chưa thử thiết bị).
- `InitialPasswordGate` là Modal phủ trên `SignedInApp`: trạng thái điều hướng giữ nguyên. Cổng hồ sơ/KYC không tháo `SignedInApp`.
- Phiên hết hạn đúng lúc chạm: về màn đăng nhập, mất đích — giống web (`clearSession` → `/`, không lưu return URL).

## 3. Đường vào màn cũ — xong

Chốt chặn: `App.openManagement` đổi mọi section thuê sang `openRental` (`rentalRouteForDestination`), nên `ManagementScreen` không còn nhận `*-requests`, `*-contracts`, `*-payments`.

| Đường vào | Trước | Nay |
|---|---|---|
| Thông báo `/dashboard/rental-requests[/my-requests]?requestId=` | `ManagementScreen` yêu cầu (mất id) | `rental-requests` RECEIVED/SENT + `requestId` |
| Thông báo `/dashboard/contracts/<id>?tab=` | hỏi vai → hợp đồng cũ | `contract-landing` (tự xác định vai) |
| Thông báo `/dashboard/invoices/<id>?section=&invoice=` | hỏi vai → thanh toán cũ | `contract-landing` tab payment |
| Thông báo `/dashboard/payments?paymentId=` | hỏi vai → thanh toán cũ | `payment-lookup` |
| Thông báo `/dashboard/complaints?…` | hộp thoại nội dung | `complaint` |
| Thông báo `/dashboard/tenant/contracts/reservations/<id>` (RB-11) | hộp thoại nội dung | `reservation` (service chưa gửi đường này) |
| Thông báo `/dashboard/{side}/contracts…`, `/dashboard/contracts`, `/dashboard/invoices[/receipts]` | hộp thoại | `contract-list` / `contract-detail` / `payment-history` |
| Thông báo mapper trả `null` mà đường cũ coi là thuê (`/dashboard/payments` trần, `/dashboard/contracts/x/y`) | hỏi vai → màn cũ | vẫn hỏi vai → `payment-history` / `contract-list` |
| Menu + overview Quản lý (yêu cầu, hợp đồng, lịch sử thanh toán) | màn mới (Pha 1) | như cũ, qua `openRental` |
| Menu nội bộ `ManagementScreen` (thực tế không tới được vì App luôn truyền `onExit`) | màn cũ | `onOpenRental` |
| Chi tiết bài đăng "Xem yêu cầu" | `RentalNavigator` lồng | như cũ |
| Chi tiết bài đăng "Lịch đi xem" / "Quản lý tin"; modal đặt lịch | `ManagementScreen` lịch/tin | không đổi |
| Lối tắt Home (chỉ có "Đăng tin" → `landlord-properties`); HomeDrawer (tab Quản lý) | — | không đổi, không có lối tắt thuê |
| `BillingScreen`, `EntryDetail` thuê, phiếu thanh toán cũ | chỉ từ section thuê của `ManagementScreen` | **không tới được** |
| `components/RentalRequestForm.tsx` | không file nào import | không tới được |

Không xoá code cũ. **Agent dọn code phải giữ** `getManagementAttentionCounts`, `markRentalNoticeSeen`, `markAppointmentNoticeSeen` trong `managementApi.ts` (chấm đỏ tab Quản lý).

Chấm đỏ: `markRentalNoticeSeen` trước chỉ được gọi từ màn cũ; nay `RentalRequestsScreen` gọi khi xem chi tiết / quick view / thanh toán của một yêu cầu (nếu không, chấm sẽ không bao giờ tắt).

## 4. Back Android — xong

- `ListingDetailScreen` (kể cả đang tải/lỗi): `BackHandler` gọi đúng `onBack` của nút header; tắt khi đang hiện danh sách yêu cầu / trình sửa tin (có `ScreenHeader` riêng) nên bài đăng mở từ danh sách quay về danh sách.
- Mọi màn thuê và `NotificationsScreen` đã có `ScreenHeader`. Modal (`ModalShell`, PDF, đặt lịch, dialog) là RN `Modal` có `onRequestClose` nên đóng trước.

## 5. Back stack — xong

- Vào từ thông báo: Back ở màn thuê đầu tiên về trung tâm thông báo (`RentalNavigator.onExit`), kể cả sau khi ghé trang bài đăng. Trung tâm thông báo mount lại (bộ lọc về mặc định).
- Vào từ bài đăng: navigator lồng, Back về bài đăng. Vào từ Quản lý: Back về Quản lý.
- Mở từ thông báo thay stack thuê cũ (nếu còn).
- Giữ nguyên hành vi cũ: Back của trung tâm thông báo luôn về Home; chạm push khi đang sửa dở không đi qua cảnh báo nháp.

## Kiểm tra

| Lệnh | Kết quả |
|---|---|
| mọi script `test*` trong `package.json` | đạt; `test:rental-nav` 16/16. `test:api` một lần 37/47 khi agent 3.2 đang sửa dở file, chạy lại 47/47 |
| `npx tsc --noEmit` | còn lỗi chỉ ở file ngoài phần này, đang được sửa song song: `billing/MonthlyInvoicesSection.tsx`, `billing/SettlementPaymentPanel.tsx`, `contract/ContractBlockchainProof.tsx` (trước đó trong phiên đã sạch với toàn bộ thay đổi của phần này) |
| eslint, prettier file đã sửa | sạch |

Chưa kiểm trên thiết bị: chạm thông báo/push thật (cả cold start), nút Back Android, Back stack, chấm đỏ.
