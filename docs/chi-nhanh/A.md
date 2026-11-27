# Agent A · Cần chú ý và điều hướng đích

## Tiến độ: XONG phần code (chưa chạy trên máy/giả lập)
- [x] 1. Đọc thiết kế, mã web, backend (href), màn đích mobile.
- [x] 2. `lib/branch-target.ts` + xử lý khoản hoàn.
- [x] 3. `components/branch/attention/**` (thêm `WorkCard.tsx`).
- [x] 4. `typecheck`; `test:branch-attention` 11/11, `test:theme` 5/5, `rental-nav` 16/16, `rental-billing` 24/24, `rental-contract-detail` 15/15, `rental-contract-signing` 20/20, `rental-logic` 28/28, `rental-ui` 13/13, `rental-money` 13/13, `branch-foundation` 7/7.

## Param thêm vào màn thuê (chỉ link từ chi nhánh bật)
- `lib/rental-nav/routes.ts`: `payment-lookup.actHere?`.
- `RentalNavigator`: chuyển `actHere` cho `PaymentLinkScreen`.
- `PaymentLinkScreen`: khi `actHere` và là khoản hoàn/quyết toán (`isSettlementTransfer`, mới trong `lib/rental/payment-link.ts`) thì hiện `SettlementPaymentPanel` tại chỗ, kèm nút sang hồ sơ thuê / quyết toán cọc. Thêm `keyboardShouldPersistTaps` cho ô lý do.
- Không có `actHere` (thông báo): giữ nguyên hành vi.

## Vì sao (mục mở của phần nền)
- `INITIAL_PAYMENT_REFUND`: `paymentLink` đưa về hồ sơ thuê, chi tiết mở ở "Tổng quan"; thẻ khoản ở đó không có nút chuyển khi `OVERDUE` (`paymentCardState.canPay`). Web làm thao tác ngay trên thẻ ở `/dashboard/payments`.
- Bù cọc / quyết toán còn thiếu của HĐ không có HĐ cọc: `section=deposit` rơi về tab Kết thúc, nơi không có khung thanh toán (`ContractLifecyclePanel` chỉ nằm trong `DepositSettlementPanel` của HĐ cọc).
- Khác 07 §6: `DEPOSIT_REFUND` / `DEPOSIT_ADJUSTMENT` cũng thao tác tại chỗ (web chỉ dẫn tiếp). Cùng khung và API; nút sang trang gốc vẫn còn.

## Các đích còn lại
- Đã đối chiếu có màn xử lý: hoá đơn (kể cả `first-rent:` xác nhận được), hồ sơ thuê, lịch xem (mở đúng lịch), tin của mình, ký (landing + tab ký). Mức kiểm: đọc mã, chưa bấm thử.
- Mọi href backend đang sinh đều có màn mobile. Href lạ: thẻ không bấm được, ghi "Hãy xử lý trên web".
- Phụ lục / chấm dứt sớm: mở tab "Hủy / kết thúc", thẻ ghi rõ kéo đến mục nào (không sửa màn HĐ).
- Khác 00 §4: "Quản lý tin đăng" trong host mở `MyListingsScreen` (nơi có "Gửi duyệt lại"), không đóng host.

## Giới hạn / báo điều phối
- Thông báo `/dashboard/payments?paymentId=` của khoản hoàn ban đầu đã quá hạn vẫn đi đường cũ (hồ sơ thuê, không có nút chuyển). Có từ trước, ngoài phạm vi.
- Back từ đích về tab "Cần chú ý" đọc lại và về trang 1 (state trang không nằm trong shell; web cũng vậy).
- Đích khay: shell chuyển sang tab Sơ đồ, nên Back không quay lại "Cần chú ý".
- Nút "Thử lại" trong `ErrorBlock` dùng chung chỉ khoảng 42dp; ở tab này "Làm mới" (48) làm cùng việc.
- Chưa kiểm 320px, cỡ chữ lớn, dark mode, Back Android trên thiết bị.
