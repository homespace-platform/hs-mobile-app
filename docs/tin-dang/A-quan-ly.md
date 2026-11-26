# A. Quản lý tin đăng trên mobile

## Đối chiếu web và mobile

| Web | Mobile | Trạng thái |
|---|---|---|
| Menu "Tin đăng" và lối tắt trên dashboard mở danh sách | `openDestination` chuyển `landlord-properties` sang danh sách; Quay lại về dashboard. Nút đăng tin ở Trang chủ vẫn mở danh sách | Xong |
| 11 tab trạng thái kèm số lượng (`/listings/me/counts`) | Đủ 11 tab, cùng nhãn | Xong |
| Tìm kiếm phía server, trễ 400 ms | `keyword`, trễ 400 ms, về trang 1 | Xong |
| Phân trang phía server có nút số trang | Trang trước / Trang sau, "Trang x / y (Tổng cộng n)"; tự lùi trang khi trang cuối hết tin | Xong, không có nút số trang vì màn hình hẹp |
| Đang tải, lỗi + Thử lại, trống, trống do bộ lọc, Làm mới | Đủ, thêm kéo để làm mới; chỉ yêu cầu mới nhất được cập nhật | Xong |
| Làm mới danh sách và số đếm theo thông báo tin đăng | Dùng socket thông báo sẵn có (kết nối lại, push, thông báo `LISTING`), gộp 250 ms | Xong |
| Thẻ tin: ảnh, loại, trạng thái, chi nhánh, tiêu đề, địa chỉ, giá, diện tích, ngày vào ở, ngày đăng, duyệt/gửi duyệt, lý do | Đủ; thêm "Hạn hiển thị" theo yêu cầu | Xong |
| Xem / Sửa / Nhân bản / Đổi trạng thái | Cùng điều kiện: không sửa khi `VIOLATION`, `RENTED_EXTERNALLY`; không nhân bản khi `VIOLATION` | Xong phần nút; ẩn Sửa/Nhân bản với loại ngoài căn hộ, nhà, phòng vì trình soạn chưa hỗ trợ |
| Sửa tin `RENTED` | Nút hiện như web | Chưa xong: `ListingDraftScreen` (phần của agent khác) đang từ chối `RENTED` |
| Nhân bản mở trình soạn có dữ liệu sẵn | Truyền `duplicateFromId` | Chưa xong: lúc kiểm tra, `ListingDraftScreen` mới khai báo prop, chưa dùng |
| Menu đổi trạng thái: mọi chuyển đổi, bước xác nhận, ghi chú tối đa 2000 ký tự, khóa theo quyền | Đủ | Xong |
| Hết lượt khi đăng lại: hộp thoại hạn mức | Hộp thoại kèm nút "Xem gói hội viên" | Xong, không hiển thị chi tiết hạn mức trong hộp thoại |
| Trang xem tin của chủ: trạng thái, lý do, bản sửa chờ duyệt / bị từ chối, thao tác, chặn tài khoản khác, lỗi 403/404, tự làm mới | Sửa lại theo đúng web `/rent/[slug]` (nút "Xem" của web mở trang này, không phải `/dashboard/properties/view`): dùng lại `ListingDetailScreen`, thêm `ListingStatusBanner` và nút nhân bản ở thẻ chính chủ; bỏ `OwnerListingPanel`. Đổi trạng thái làm ở thẻ trong danh sách | Xong |
| Thẻ gói hội viên thu gọn | Gói, lượt gói, lượt mua thêm + hạn gần nhất, giữ chỗ, hạn gói, giờ hồi lượt, chính sách, làm mới | Xong |
| "Mua / Nâng cấp gói", "Gói hội viên" | Mở Trang chủ (bảng gói và thanh toán nằm ở cuối trang) | Một phần: mobile chưa có màn hình gói riêng |
| "Mua thêm lượt" | Không có | Chưa làm: mobile chưa có luồng mua lượt lẻ, ngoài phạm vi |
| "Đăng tin mới" khóa theo `LISTING_POST` và hồ sơ | `useFeatureGate`, hiện lý do dưới nút | Xong |

Bộ lọc theo ngày của danh sách cũ đã bỏ vì web không có.

## File thay đổi

- Sửa: `App.tsx`, `package.json` (script `test:listing-manage`), `src/screens/ManagementScreen.tsx`, `src/screens/ManagementDashboardScreen.tsx` (prop đổi tên thành `onOpenSection`), `src/screens/ListingDetailScreen.tsx`, `src/services/membershipApi.ts`, `src/lib/membership.ts`.
- Mới: `src/services/myListingApi.ts`, `src/lib/listing-manage.ts`, `src/components/listing-manage/` (`MyListingsScreen`, `MyListingCard`, `StatusChangeButton`, `StatusBadge`, `MembershipCard`, `useListingNotifications`), `tests/listing-manage.test.cjs`, file này.

## Kiểm tra đã chạy

- `npm run typecheck`: đạt (tại thời điểm chạy, các agent khác vẫn đang sửa file của họ).
- `npm run test:listing-manage`: 9/9 đạt.
- `npm run test:theme`: 5/5 đạt.
- `node --test tests/api.test.cjs tests/rental-nav.test.cjs tests/rental-requests.test.cjs`: 91/91 đạt.
- Chưa chạy trên thiết bị hay trình giả lập, chưa gọi backend thật.

## Rủi ro và việc còn lại

- Hai mục "Chưa xong" ở trên phụ thuộc `ListingDraftScreen`; cần kiểm tra lại sau khi phần trình soạn hoàn tất.
- `getManagementPage`, `performManagementAction`, `statusLabel` trong `managementApi.ts` không còn được app dùng, chỉ còn `tests/api.test.cjs` gọi. Giữ lại vì file test ngoài phạm vi sửa; nên xóa cùng test.
- Các trường mới của `MembershipView` là tùy chọn; chỗ khác (menu Trang chủ, bảng gói) vẫn chỉ hiển thị lượt gói.
- Quay lại từ trang xem tin hoặc trình soạn giữ tab, từ khóa, trang nhưng không giữ vị trí cuộn.
- Menu "Chi nhánh / Tòa nhà" trên dashboard vẫn mở trang chỉ có tiêu đề dù đã có `BranchManagementScreen` (ngoài phạm vi).
