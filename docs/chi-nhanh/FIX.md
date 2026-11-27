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

## RECHECK mục 6: badge "Cần chú ý" khi hai lượt đọc về ngược thứ tự

- Đúng như báo cáo: mục 4 ở trên đóng dấu độ mới bằng giờ máy nhận, nên summary chụp trước (0 việc) trả sau đè số 1 của trang Cần chú ý.
- Sửa: `newestCount` (`lib/branch-overview.ts`) lấy số từ ảnh chụp máy chủ mới hơn theo `realNow` (bằng nhau thì lấy trang Cần chú ý), dùng cho cả badge và thẻ chi nhánh. `parseAttentionSummary` trả `{ realNow, branches }` và từ chối phản hồi thiếu `realNow`. Shell giữ lượt đọc trang cuối của từng chi nhánh, mở chi nhánh khác không xoá. `useBranchRead` không đổi.
- Đọc lỗi: hook giữ summary cũ, shell giữ lượt đọc trang cũ, nên số đã biết không thành 0.
- Đổi tài khoản: số đếm chỉ nằm trong state của shell, đăng xuất thì `App` gỡ cả cây đã đăng nhập; không thêm cache cấp module (đọc mã, không có test).
- Test mới `tests/branch-attention-badge.test.cjs` chạy shell, tab, hook, API và parser thật trên runtime hook tối giản: 3 ca đỏ trước khi sửa, đạt sau khi sửa. Sửa một assert so mã trong `branch-attention.test.cjs` (`onCountChange(data)`).
- Kiểm: `npm run typecheck` đạt; `node --test --test-isolation=none tests/*.cjs tests/*.mjs` 597/597; `test:theme` 5/5. Chưa chạy trên máy/giả lập.
- Giới hạn (đọc mã core): `/attention` lấy `realNow` sau câu truy vấn kiểm quyền (câu mở ảnh chụp), summary lấy trước; hai lượt chụp cách nhau vài ms vẫn có thể bị xếp sai.

## R-D phía mobile: acknowledgedDetach và 409/4093

- Mọi lần lưu sơ đồ gửi `acknowledgedDetach { listingIds, contractIds }`: id tin và HĐ trên các phòng bỏ/đổi thành ô trống mà chủ đã xác nhận từ lượt đọc assignments mới; rỗng khi không bỏ phòng nào (không đọc thêm). Code: `saveWithLinks` trong `lib/branch-layout-save.ts`, `BranchMapEditor` chỉ truyền hộp thoại và nguồn đọc.
- 4093: giữ nháp, đọc lại assignments, hỏi lại với liên kết mới, chỉ gửi lại khi xác nhận; từ chối thì dừng, nháp còn. Xác nhận trùng lần trước mà server vẫn 4093 thì báo lỗi, không lặp. 4074 và 409 khác giữ nguyên xử lý cũ.
- Không gửi đôi: vẫn qua `savingRef`. Nháp: effect `keep` chạy khi còn dirty, chỉ xoá khi lưu thành công, nên Back Android/nền app không đổi; không thêm mã.
- Khi không đọc được liên kết, người dùng xác nhận "có thể bị gỡ" nhưng gửi danh sách rỗng, nên nếu thực có liên kết server trả 4093 và hỏi lại (an toàn, có thể phải thử lại).
- Test: 6 ca mới trong `tests/branch-editing.test.cjs` (5 hành vi, 1 so mã). Kiểm: typecheck đạt; 603/603; test:theme 5/5. Chưa thử trên máy/giả lập hay với server thật (server đang viết).
