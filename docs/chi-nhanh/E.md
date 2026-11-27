# Agent E · Sửa sơ đồ, gắn kết, khay, đăng tin cho phòng

Trạng thái: **XONG phần mã** (27/11/2026). Chưa chạy trên máy/giả lập.

## Nhật ký

- [x] Đọc concept, thiết kế mobile/API, mã web, mã dùng chung, editor tin.
- [x] 5 test đỏ của `listing-editor`:
  - 1 ca (`branch selection…`): test chạy `handleSelectBranch` của web, hàm này nay dùng `roomLink`. Thêm `roomLink: null` vào harness. Khoảng trống thật của mobile (chưa có `roomLink`) đã làm trong mã.
  - 4 ca (lưu lỗi, chặn lưu, tin chưa xác nhận, câu hỏi gửi lại): fixture ghim `TODAY = '2026-11-26'`, từ 27/11 thành ngày quá khứ. Web cũng chặn như vậy nên mobile không sai; `TODAY` lấy theo đồng hồ máy. Không sửa assertion nào.
- [x] Đăng tin cho phòng: `lib/listing-room-link.ts`, `saveListing` (đọc lại sơ đồ trước khi tải tệp; sai chi nhánh hoặc mất phòng thì không tạo gì; sửa/nhân bản bỏ `roomId`), `useListingEditor`, `RoomLinkBanner`, `NewRoomListingScreen`. Không có `roomId`: payload và số lần gọi API như cũ.
- [x] Trình sửa: `BranchMapEditor`, `TemplatePicker`, `LayoutBoard`, `LayoutSheets`. Luật bản nháp ở `editing/logic.ts` (`createDraftSession`).
- [x] `RoomLinksPanel`, `CandidatePicker`, `UnplacedTray`. Khay đọc lại khi bảng phòng ghi (`announceLinkWrite`).
- [x] Kiểm tra: `typecheck`; `test:branch-editing` 6/6; `test:listing-editor` 43/43; `test:theme` 5/5; `branch-foundation` 7/7; export bundle Android offline (`EXPO_NO_DOTENV=1`, ra thư mục tạm). ESLint: 0 lỗi, 1 cảnh báo `loadSeq.current` trong cleanup (bộ đếm, không phải ref tới view).

## Khác web có chủ đích

- Báo thành công khi gắn/gỡ hiện ngay trong panel/khay (không bật hộp thoại); lưu sơ đồ vẫn dùng toast.
- "Không ghi đè bản nháp revision mới hơn" kiểm ở `createDraftSession` (kho dùng chung chỉ có `removeOwned`).
- Nút "Đăng tin cho phòng này" là nút chính khi phòng chưa gắn gì; hai nút gắn có sẵn luôn hiện như web.
- Hộp thoại "Tin có thể đã được lưu" khi đăng từ phòng: nút ghi "Về chi nhánh kiểm tra".
- Banner phòng không có "Mở chi nhánh (tab mới)".
- `SelectField` có thêm prop `tall` (48dp), chỉ banner dùng.

## Chưa kiểm

- Máy/giả lập: 320px, cỡ chữ lớn, dark mode, Back Android, bàn phím trong sheet, iOS.
- Gọi API thật (409, từ chối lưu, gắn/gỡ, tạo tin kèm `roomId`).
- Không đề nghị sửa mã dùng chung.
