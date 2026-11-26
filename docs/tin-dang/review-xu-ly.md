# Xử lý review quản lý và đăng tin

Nguồn: [`review-codex.md`](review-codex.md). Đã đối chiếu 12 phát hiện với mã mobile và backend: cả 12 đều đúng. Không sửa `hs-web-app`, `hs-core-api`. **Chưa chạy trên điện thoại hay backend thật.**

| # | Kết quả | Cách xử lý | Giới hạn còn lại |
|---|---|---|---|
| 1. Ghi đè bản sửa chờ duyệt | Đã sửa phía mobile | Trình soạn hiện cảnh báo bản sửa đang chờ và lý do từ chối (nếu API trả `editRejectionReason`). Gửi khi đang chờ phải xác nhận "Thay thế và gửi duyệt" | Không thêm API nên biểu mẫu vẫn nạp bản đã duyệt. Bản chờ tạo từ nơi khác sau khi mở trình soạn thì không phát hiện được. Trang chi tiết không đổi |
| 2. Chi nhánh `OFFICE` làm lỗi | Đã sửa | Bộ chọn ẩn chi nhánh loại hình chưa hỗ trợ; `selectBranch` từ chối kèm thông báo | |
| 3. Sửa tin xóa phạm vi thuê, đổi ngày bàn giao | Đã sửa | Gửi lại mô tả phạm vi và hai mốc tầng đã lưu; khi sửa giữ ngày cũ đã qua nếu không đổi | Không có ô sửa phạm vi: giảm số tầng xuống dưới mốc đã lưu thì phải chỉnh ở nơi khác (xem ghi chú web) |
| 4. Thêm phí làm đổi phí cũ | Đã sửa | Mỗi phí "khác" đã lưu giữ cách tính, mô tả, đơn vị; chỉ đổi tên và số tiền. Phí miễn phí được nhập giá thì chuyển thành theo tháng | Gợi ý dưới ô tiền vẫn ghi "đ/tháng" cả với phí theo người |
| 5. "Thử lại" tạo trùng tin | Đã sửa ở mức client | Tạo/nhân bản mà upsert không có phản hồi, timeout, 5xx hoặc phản hồi lạ: không có nút thử lại, báo tin có thể đã lưu, nút "Kiểm tra danh sách tin". Gửi lại bất kỳ cách nào đều phải xác nhận. Lỗi 4xx và lỗi tải tệp vẫn thử lại bình thường | Backend chưa có khóa chống trùng. Đóng trình soạn rồi mở lại thì không còn cảnh báo |
| 6. Sai đơn vị giá khi đổi chi nhánh | Đã sửa | Đổi loại hình qua chi nhánh thì đặt lại đơn vị giá ở mọi chế độ | |
| 7. Mất ghi chú vị trí | Đã sửa | Thêm lại ô "Ghi chú vị trí" (địa chỉ mới, không theo chi nhánh, hiện sau khi chọn địa chỉ); chọn lại cùng `refId` giữ ghi chú | Chọn địa chỉ khác thì ghi chú cũ bị bỏ |
| 8. Chi tiết dùng API công khai | Đã sửa | Mọi đường vào `ListingDetailScreen` dùng API có xác thực (app chỉ mở màn này khi đã đăng nhập). Bỏ prop `accessible`, `listingFromRental` và `getPublicListing` không còn dùng. Lịch sử xem chỉ ghi tin `PUBLISHED`/`RESERVED` | |
| 9. Làm mới nền bỏ kết quả tải đầu | Đã sửa | `createApplyGate`: phản hồi cũ chỉ bị bỏ khi phản hồi mới hơn đã được áp dụng; làm mới nền lỗi tạm thời không tính | |
| 10. Bấm thông báo đẩy mất biểu mẫu | Đã sửa | `lib/leave-guard.ts`: thông báo đẩy và "Cập nhật hồ sơ" hỏi "Rời biểu mẫu?" khi có thay đổi; đang lưu thì báo đợi | Đăng xuất / hết phiên hoặc hệ điều hành đóng app vẫn mất dữ liệu |
| 11. Hộp thoại hết lượt gửi thao tác bị cấm | Đã sửa | Tin phải duyệt bản sửa: nút "Gửi bản sửa..." (có xác nhận); tin khác: lưu nháp | Không làm luồng mua lượt lẻ (theo quyết định). "Mua gói" vẫn mở Trang chủ; trang hội viên (phần D) đang được làm riêng, cần nối lại khi xong |
| 12. Mô tả quá 5.000 ký tự vẫn upload | Đã sửa | Kiểm tra tối đa 5.000 trước khi tải tệp, cả lưu nháp; bộ đếm hiện `x/5000` | |

## Ghi chú về web

- **Lỗi web (phát hiện 3):** web từng xóa phạm vi thuê và đổi ngày bàn giao khi sửa. Trong lúc xử lý, cây làm việc `hs-web-app` đã có bản sửa chưa commit (không phải của lượt này). Mobile đã khớp đúng cách đó, gồm cả việc bản nhân bản mang theo phạm vi thuê; test so khớp với web đạt.
- **Web vẫn còn (phát hiện 4):** đổi phí "khác" thì web tạo lại cả nhóm theo tháng và mất mô tả. Mobile cố ý khác.
- Mobile cũng cố ý khác web ở phát hiện 6 (web chỉ đặt lại đơn vị giá khi tạo mới).

## Kiểm tra đã chạy

- `npm run typecheck`: đạt (chạy lại sau thay đổi cuối).
- `test:listing-editor` 35/35 (thêm ca cho 1, 2, 3, 4, 5, 6, 7, 11, 12), `test:listing-manage` 10/10 (thêm ca cho 9), `test:theme` 5/5, `test:api` 37/37.
- `node --test` cho 12 file (`rental-cache`, `rental-money`, `rental-contract-detail`, `rental-contract-amendment`, `rental-ui`, `rental-nav`, `rental-requests`, `appointment-manage`, `push-realtime`, `rent-detail`, `profile-gate`, `kyc`): 210/210. `rental-requests.test.cjs` được sửa hai khẳng định theo phát hiện 8.
- `eslint` trên file đã sửa: sạch. Đóng gói `expo export --platform android` offline, không nạp `.env`: thành công.
- Sau lượt `eslint` và đóng gói chỉ xóa hàm `getPublicListing` không còn dùng (đã chạy lại typecheck và `test:api`).
- Phát hiện 8 chỉ có khẳng định trên mã nguồn, phát hiện 10 chưa có test. Trong lúc làm, agent khác cũng đang sửa repo; kết quả phản ánh cây mã tại thời điểm chạy.

## Lượt 2: [`review-sua-loi-codex.md`](review-sua-loi-codex.md)

Đã đối chiếu và sửa phát hiện 1-8. Phát hiện 9 bỏ qua theo quyết định (web `/rent` không hiện lý do từ chối, trang chi tiết giữ giống web). **Chưa chạy trên điện thoại hay backend thật.**

| # | Cách xử lý | Giới hạn còn lại |
|---|---|---|
| 1 | Đọc lại tin ngay trước khi gửi bản sửa (cả khi "Thử lại"); đang có bản chờ thì phải xác nhận thay thế. Không đọc được thì không gửi | Bản chờ tạo trong lúc đang tải tệp vẫn bị ghi đè (backend không kiểm phiên bản). Nội dung đã được duyệt từ nơi khác sau khi mở form không được nạp lại |
| 2 | Nút "Rời biểu mẫu" kiểm tra lại lúc bấm; đang lưu thì không chuyển màn | |
| 3 | Cờ "có thể đã lưu" ghi vào AsyncStorage trước khi gọi upsert, theo tài khoản và nguồn (tạo mới / tin gốc nhân bản). Xóa khi lưu thành công hoặc máy chủ từ chối rõ ràng lần gửi đã được xác nhận; lỗi tải tệp không đổi cờ | Cờ theo thiết bị. Bản dev build phải có sẵn module AsyncStorage; nếu lưu trữ lỗi thì chỉ nhớ trong phiên app. Mọi tin tạo mới dùng chung một cờ |
| 4 | Phản hồi không có `id` là lỗi chưa xác định, không báo thành công | |
| 5 | Báo lỗi khi tổng số tầng nhỏ hơn tầng cho thuê cao nhất, ghi rõ phạm vi (web có thông báo riêng, câu chữ khác) | Không có ô sửa phạm vi thuê |
| 6 | Banner đọc thời hạn giữ chỗ bằng `useRentalHoldMinutes`; chưa có số thì không ghi số | `ContactCta` vẫn ghi 60 phút cố định (ngoài phát hiện) |
| 7 | Tin 404 với người xem hiện "Tin đăng không còn hiển thị..." (mọi đường vào, gồm lịch hẹn) | Nút "Xem tin đăng" ở lịch hẹn vẫn còn |
| 8 | Đơn vị dưới ô phí khác theo cách tính sẽ gửi (`đ/người/tháng`, `đ/tháng`, `Miễn phí`...) | |

Kiểm tra lượt 2: `typecheck` đạt; `test:listing-editor` 43/43 (thêm ca cho 1, 2, 3, 4, 5, 8), `test:listing-manage` 11/11 (7 và khẳng định mã nguồn cho 6), `test:theme` 5/5, `test:api` 37/37; `rental-cache`, `rental-requests`, `rental-nav`, `rental-ui`, `rent-detail`, `appointment-manage` 99/99; `eslint` trên file đã sửa sạch; đóng gói Android offline thành công. Phần nối trong hook (1, 2) chỉ được test qua hàm thuần. Agent khác đang sửa trình soạn cùng lúc, thay đổi của họ được giữ.
