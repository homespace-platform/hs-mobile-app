# E. Thu gọn trang "Quản lý tin đăng" trên màn hình nhỏ

Hành vi, cách tải dữ liệu, điều kiện bật/tắt hành động và backend không đổi. Chỉ đổi bố cục.

## Kiểm tra web ở bề ngang điện thoại

Web cũng bị quá khổ như app: ảnh bìa cao và rộng hết thẻ, ngày tháng và nút chiếm nhiều dòng, thẻ gói hội viên cao. Vì vậy cả hai nền tảng đều được tối ưu.

## App (hs-mobile-app)

- Thẻ tin (`MyListingCard`): ảnh thu nhỏ 96px; trạng thái, loại hình và số ảnh cùng một hàng; chi nhánh; tiêu đề tối đa 2 dòng; địa chỉ; giá, diện tích, ngày vào ở cùng một đoạn; các ngày (Đăng, Duyệt/Gửi duyệt, Hạn hiển thị) gộp và tự xuống dòng; lý do từ chối/khóa gọn lại.
- Bốn hành động (Xem, Sửa, Nhân bản, Đổi trạng thái) nằm một hàng, biểu tượng trên chữ, cao tối thiểu 44px. Dùng prop mới `compact` của `ActionButton`; mặc định của nút không đổi.
- `StatusBadge` nhỏ hơn (áp dụng cả trong hộp đổi trạng thái).
- Thẻ gói hội viên: tên gói, nút mua/nâng cấp và làm mới trên đầu (nút cao 44dp, không dùng `hitSlop`); số dư, giữ chỗ, hạn gói, hồi lượt gộp một đoạn; quy định thành một dòng bấm được, mở hộp nội dung đầy đủ. Thẻ này dùng cả trong màn soạn tin.
- Màn danh sách: lề hẹp hơn, khoảng cách nhỏ hơn, tab trạng thái và ô tìm kiếm gọn (vẫn cao 44px).
- Phần nối mua gói / "Mua thêm lượt" do tác vụ màn hội viên làm song song được giữ nguyên.

## Web (hs-web-app), chỉ dưới breakpoint `sm` (< 640px)

Mọi thay đổi giao diện dùng `max-sm:` hoặc phần tử `sm:hidden`, nên máy tính bảng và máy tính giữ nguyên giao diện.

- `ListingItemCard` (dùng cả ở trang chi tiết chi nhánh): bố cục lưới với ảnh 96px; loại hình và số ảnh chuyển lên cạnh trạng thái; "Đăng" gộp cùng dòng "Duyệt ngày/Gửi duyệt"; bốn nút một hàng, cao 44px. Web không hiển thị "Hạn hiển thị" từ trước nên không thêm.
- `MembershipStatusCard` chế độ compact (trang danh sách và trình soạn tin): bỏ ô biểu tượng, quy định gọn hơn, các nút cao 44px và chia đều hàng. Thêm `aria-label` cho nút làm mới.
- Trang danh sách: khoảng cách, nút đầu trang, tab, ô tìm kiếm (cao 44px, nút xóa có nhãn), khung chờ và trạng thái rỗng gọn hơn.
- `ListingStatusActionMenu` không cần sửa.

## Cách kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| App `typecheck` | Đạt |
| App `test:theme` | 5/5 đạt |
| App `test:listing-manage` | 9/10. Lỗi `wiring: the dashboard menu opens the listing list`: kiểm tra chuỗi trong `ManagementDashboardScreen.tsx`, file vừa được tác vụ màn hội viên đổi; ngoài phạm vi này |
| Web `npx tsc --noEmit` | Đạt |
| Web `eslint` 3 file đã sửa | Đạt |
| Web `tests/listing-notification.test.mjs` | 8/18. Các ca của trang danh sách đạt. 10 ca lỗi do thiếu stub `@/components/common/BreadcrumbTitle` (trang chi tiết) và `createThrottle is not a function`; không đến từ file đã sửa |

- Web đã xem bằng mắt: dựng riêng trang danh sách với dữ liệu mẫu (stub service, auth, router, `next/image`), chụp bằng Chrome headless ở khung 390px và 360px, và một ảnh ở 1280px. Không có cuộn ngang. Sau khi cuộn qua phần đầu thấy được hơn hai thẻ.
- App chỉ kiểm tra từ mã nguồn, chưa chạy trên thiết bị hay giả lập.

## Rủi ro và việc cần thử trên máy thật

- App: thử bề ngang 320px và cỡ chữ lớn (nhãn trạng thái dài, hàng bốn nút, đầu thẻ hội viên sẽ xuống dòng). Mục tiêu "hai thẻ trên màn 390x844" mới là ước tính.
- App: khi hết lượt, nút "Mua thêm lượt" thêm một hàng 44px vào thẻ hội viên, đẩy danh sách xuống.
- Web: ảnh chụp không gồm thanh điều hướng và nút "Menu quản lý" của khung dashboard, nên trên trang thật thẻ đầu tiên nằm thấp hơn. Trình soạn tin và trang chi nhánh chưa được xem bằng mắt.
- Địa chỉ dài hơn 2 dòng vẫn bị cắt; dưới `sm` và trên app tối đa 2 dòng.

## Xử lý review Codex (`review-gon-man-hinh-codex.md`)

Cấu hình NativeWind hiện tại tính `min-h-11` là 38,5dp, nên các vùng chạm đã sửa dùng `[44px]`. Các chỗ phía trên ghi "44px" trên app được hiểu theo bản sửa này.

| Mục | Kết quả |
| --- | --- |
| 1. App mở sai màn từ "Quản lý tin đăng" | Không xử lý ở đây, thuộc tác vụ khác |
| 2. Web cắt phân trang ở 320px | Đã sửa: dưới `sm` hàng số trang tự xuống dòng, nút 44px; thêm `aria-label` "Trang trước", "Trang sau". Đã chụp 320px với 7 trang, không cuộn ngang |
| 3. Nút xóa tìm kiếm đè ô nhập | Đã sửa: dưới `sm` ô nhập chừa lề phải 44px (`max-sm:pr-11`) |
| 4. Vùng chạm chồng nhau trong thẻ hội viên | Đã sửa: bỏ cả ba `hitSlop`, mỗi nút và dòng quy định có khung thật cao 44dp. Thẻ cao hơn bản trước |
| 5. Vùng chạm dưới 44dp | Đã sửa: tab trạng thái, ô tìm kiếm, nút xóa, nút làm mới và mua gói, "Mua thêm lượt", dòng quy định, bốn nút trên thẻ tin |
| 6. Địa chỉ bị cắt | Đã sửa: tối đa 2 dòng ở app và ở web dưới `sm` |
| 7. Nhãn trạng thái mất nền | Đã sửa: thêm dấu cách còn thiếu trong class của `StatusBadge` |

Kiểm tra sau khi sửa: app `typecheck` đạt, `test:listing-manage` 10/10, `test:theme` 5/5; web `tsc` và `eslint` file đã sửa đạt; `listing-notification.test.mjs` vẫn 8/18 với các ca trang danh sách đạt (đã chạy lại, 10 ca lỗi như trên).

Còn lại: nút `ActionButton` cỡ thường ("Đăng tin mới", phân trang trên app) vẫn dùng `min-h-12` (42dp) như trước đợt thu gọn; chưa đổi vì là nút dùng chung. Chiều cao hai thẻ tin trên màn 390x844 cần kiểm tra lại trên máy thật.
