# Chi nhánh trên mobile · Tiến độ

Nếu bị dừng giữa chừng: đọc file này, rồi `00-thiet-ke.md`. Không commit/push/reset/checkout; không đọc `.env`; không sửa `hs-web-app`, `hs-core-api`.
Nhánh: `feature/branch-monitoring` (repo `hs-mobile-app`).

## Giai đoạn nền: XONG

- [x] Đọc concept, thiết kế API, mã web và mobile.
- [x] Mã dùng chung: types, API, logic thuần, màu trạng thái (thêm token `pending`), giao diện điều hướng.
- [x] Shell: sửa menu trắng, danh sách, chi tiết 2 tab, Back, xoá hiện lý do máy chủ, stub cho V/E/A.
- [x] Thông báo gộp `/dashboard/branches` mở danh sách chi nhánh (trước đó `tests/rental-nav.test.cjs` đỏ vì thiếu ánh xạ này).
- [x] `00-thiet-ke.md`.
- [x] `npm run typecheck`; test `branch-foundation`, `theme`, `listing-manage`, `api`, `rental-nav` (76/76).
- [ ] Chưa chạy trên máy/giả lập: 320px, cỡ chữ lớn, dark mode, Back Android, Hermes.

## Ba agent song song (quyền sở hữu: `00-thiet-ke.md` §10)

- [ ] V · lớp xem (§5): `components/branch/view/**`.
- [ ] E · sửa sơ đồ, gắn kết, khay, đăng tin cho phòng (§6, §7): `components/branch/editing/**` + editor tin.
- [ ] A · cần chú ý, số việc trên thẻ, điều hướng đích (§3, §4, §8): `components/branch/attention/**`, `lib/branch-target.ts`.

Mỗi agent ghi tiến độ vào dòng của mình (chỉ sửa dòng/mục của mình).

## Ghi chú

- Trên Windows, lệnh shell nhiều heredoc dài bị cắt; ghi script ra file rồi chạy.
- `node --test tests/*.test.cjs`: 560 test, 555 đạt. 5 test đỏ đều ở `tests/listing-editor.test.cjs`, có nguyên nhân ngoài phần nền (không file editor tin nào bị sửa): test chạy đoạn trích từ `ListingEditor.tsx` của web, mà web từ Phase 2 đã dùng `roomLink` (`ReferenceError: roomLink is not defined`; các ca còn lại lệch kết quả, chưa chẩn đoán từng ca). **E** xử lý cùng phần chuyển `roomId`.
