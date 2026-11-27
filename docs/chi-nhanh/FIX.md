# Sửa lỗi theo REVIEW.md

Nếu bị dừng: đọc file này, mục chưa đánh dấu là việc còn lại. Không commit/push; không đọc `.env`; không sửa `hs-web-app`, `hs-core-api`. Test đỏ của Codex không được sửa.

## Tiến độ
- [x] 0. Chạy lại 7 test đỏ trước khi sửa
- [x] 1. Tải lại sau 409 xoá nháp
- [x] 2. Lưu sơ đồ khi không đọc được liên kết
- [x] 3. Ghi liên kết xong muộn làm mất lớp Thu tiền
- [x] 4. Badge "Cần chú ý" giấu việc mới
- [x] 5. Kéo làm mới bỏ sót khay
- [x] 6. Back từ lịch xem qua danh sách chung
- [x] 7. Chip form chi nhánh (và nút lịch xem) dưới 44dp
- [x] 8. Ba chip lọc ở 320px / chữ 200%
- [x] 9. Nút "Thử lại" của `ErrorBlock` dưới 44dp
- [x] 10. `00-thiet-ke.md`: bảng link
- [x] 11. Kiểm cuối: typecheck, test, test:theme, bundle Android

## Ghi chép

- 0: trước khi sửa, 594 ca, 587 đạt, 7 đỏ (mục 1-7).
- 1 (đúng): `reload` xoá nháp trước GET. Nay `fetchLayout(true)` chỉ xoá sau khi nhận sơ đồ mới; GET lỗi thì "Thử lại" đề nghị khôi phục nháp.
- 2 (đúng): lượt đọc liên kết lỗi bị bỏ qua. Nay lưu có bỏ phòng (xoá hoặc đổi thành ô trống) mà đọc lỗi thì phải xác nhận "liên kết có thể bị gỡ"; đóng hộp thoại = không lưu. Đọc thành công thì cảnh báo như cũ.
- 3 (đúng): `reload` cũ gọi loader tháng cũ và tăng `seq`. Sửa gốc ở `lib/use-branch-read.ts`: mọi `reload` đọc loader đang hiện (áp dụng cho mọi nơi dùng hook).
- 4 (đúng): số của trang Cần chú ý luôn thắng summary. Nay badge lấy số đến sau cùng (summary trả thêm `at`; summary lỗi giữ `at` cũ).
- 5 (đúng): khay có lượt đọc riêng, kéo làm mới không chạm tới. Nay cả hai trạng thái (có tầng / chưa có tầng) gọi thêm `reloadTray()` (đổi tên từ `announceLinkWrite`).
- 6 (đúng): đóng chi tiết chỉ đóng modal nên lộ danh sách lịch chung. Thêm prop `onLinkedClose` (chỉ host chi nhánh truyền): X/Back trên lịch được liên kết thì về chi nhánh. Bấm một hành động vẫn ở lại màn lịch (hộp thoại hành động cần màn này; sau đó Back một lần về chi nhánh). Luồng thông báo/danh sách giữ nguyên.
- 7 (đúng): chip form dùng `min-h-[44px] min-w-[44px]`. Mọi nút trong `AppointmentDetailModal` (hành động, Đóng, X, Xem tin đăng) cũng `min-h-11`/`h-11` = 38,5dp, đã nâng 44. Các `min-h-11` khác ở màn lịch cũ ngoài modal chưa sửa.
- 8: hàng ba chip lọc đổi sang `flex-wrap`, chip `grow shrink max-w-full`, nhãn và số được xuống dòng. Mới kiểm qua đọc layout, chưa có ảnh trên máy.
- 9: nút của `ErrorBlock` dùng chung chỉ 42dp; thêm `min-h-[44px]` (đã biên dịch thử: giá trị tuỳ ý đứng sau `min-h-12` trong CSS nên thắng). Áp dụng cho mọi nơi dùng `ErrorBlock`.
- 10: `00-thiet-ke.md` cập nhật bảng link §4 (phụ lục, chấm dứt sớm, thanh toán `actHere`, lịch xem), phần host, và các dòng §5, §6, §8, §11 đổi theo mục 1-6.
- 11: `npm run typecheck` đạt; `node --test --test-isolation=none tests/*.cjs tests/*.mjs` 594/594 (7 test của Codex đạt, không sửa test nào); `test:theme` 5/5; `expo export --platform android` với `EXPO_NO_DOTENV=1 EXPO_OFFLINE=1` thành công (1 bundle Hermes 11,2 MB, xuất vào thư mục tạm).

## Chưa kiểm
- Chưa chạy trên máy/giả lập: 320px chữ 200%, vùng bấm thực tế, Back Android, dark mode.
- Vài test của Codex chỉ so mã nguồn (mục 1, 2, 4-7): đạt test chưa thay cho thử trên máy.
- Core: hợp đồng bị ẩn khỏi phòng vì trùng lịch chỉ hiện ở khay trong `/assignments`, nên cảnh báo trước khi lưu không tính nó vào phòng sắp bỏ (đọc mã, chưa chạy).
