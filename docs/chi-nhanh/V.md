# Agent V (lớp xem) · Nhật ký

Phạm vi: `00-thiet-ke.md` §5. Chỉ sửa `src/components/branch/view/**`, `src/lib/branch-view.ts`, `tests/branch-view.test.cjs`, script `test:branch-view`, file này.

## Tiến độ: XONG

- [x] Đọc thiết kế, concept, mã web (`BranchOverviewLayers`, `BranchMap`), mã dùng chung; chạy skill ui-ux-pro-max.
- [x] `src/lib/branch-view.ts`: dòng trong ô, mục trong sheet, đếm chú giải, tìm/làm nổi, bề rộng cột.
- [x] UI trong `components/branch/view/`: `BranchMapView`, `MapControls`, `FloorBoard`, `EntryList`, `RoomSheet`, `tone`.
- [x] `tests/branch-view.test.cjs` + `npm run test:branch-view`.
- [x] 27/11: `test:branch-view` 5/5, `typecheck` đạt (cả cây, gồm phần E/A đang có lúc chạy), `test:theme` 5/5,
      `branch-foundation` 7/7, eslint file của V sạch, `expo export --platform android` (EXPO_NO_DOTENV=1, offline) đóng gói được.
- [ ] Chưa chạy trên máy/giả lập: 320px, cỡ chữ lớn, dark mode, cuộn ngang, kéo làm mới, Back Android, TalkBack.

## Ngoài §5 (nhỏ, để dễ dùng)

- Khi tìm/làm nổi mà tầng đang xem không có phòng khớp: nút "Xem Tầng n (m phòng khớp)".
- Mỗi mục trong sheet có chữ hành động ("Mở hóa đơn", "Mở hợp đồng"…), chỉ để đọc; đích vẫn theo `href`.
- Sơ đồ phải cuộn ngang thì có dòng nhắc "Vuốt ngang…".

## Giới hạn

- Kéo để làm mới đọc lại tình trạng và sơ đồ; `renderTray` không có tín hiệu đọc lại (props đã chốt), nên số ở khay
  chỉ mới lại khi khay tự đọc (theo cách E cài).
