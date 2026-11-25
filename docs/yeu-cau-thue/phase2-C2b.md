# Pha 2 — phần C2b: phụ lục / điều chỉnh và gia hạn

Web `hs-web-app` là chuẩn. `contract/` = `src/components/rental/contract/`.

Trạng thái: **XONG phần code** (chưa thử trên thiết bị, chưa chạy Metro/bundle, chưa gọi backend thật).

| Mục | ID | Trạng thái |
|---|---|---|
| `contract/amendmentLogic.ts` (luật tách khỏi .tsx web) | | done |
| `contract/ContractAmendmentWorkspace` (soạn, dừng poll/sync) | C-200, C-213, C-221 | done |
| `contract/InlineAmendmentFields` (bảng soạn) | C-168, C-176, C-182 | done |
| `contract/AmendmentEffectiveDatePicker` | C-215, C-216 | done |
| `contract/ContractAmendmentPanel` (+ thanh thao tác) | C-201…C-212, C-214, C-217…C-220, C-222…C-227 | done |
| `screens/rental/ContractDetailScreen` (footer, chặn rời trang) | C-213 | done |
| `contract/ContractRenewalPanel` | C-290…C-299 | done |
| `tests/rental-contract-amendment.test.cjs` | | 17/17 |

Ghi chú: web **không** nhúng ký số hay `WorkflowDocumentsPanel` vào panel phụ lục (`WorkflowDocumentsPanel` chỉ
được `RentalWorkflowPanel` dùng). Ký phụ lục/gia hạn nằm ở trang hợp đồng con (tab "Ký số & tài liệu", đã gắn ở C2a);
panel chỉ dẫn link tới đó.

## Đường vào (đọc mã)

- Phụ lục: chi tiết HĐ gốc (ACTIVE/EXPIRED/CLOSED) → tab "Hủy / kết thúc" → "Điều chỉnh hợp đồng" (chủ nhà, tự chuyển
  sang tab Nội dung + footer) hoặc "Đề nghị điều chỉnh" (người thuê). APPROVED → link sang HĐ con → ký ở tab Ký số.
- Gia hạn: HĐ ACTIVE → tab "Hủy / kết thúc" → panel gia hạn → link văn bản gia hạn → ký ở HĐ con.

## Khác web (chờ duyệt)

1. Ô đồng ý gắn với đúng bản xem trước / đúng nội dung đề xuất đã mở. Nếu danh sách tải lại không còn đúng đề xuất đó,
   hộp thoại chỉ còn "Đóng" (không thêm chữ mới).
2. `GET amendments` trả về muộn không ghi đè kết quả mới hơn (hoặc kết quả vừa lưu/gửi); bản nháp tải lần đầu cũng vậy.
3. Khoá khi đang xử lý: "Tiếp tục bản nháp", "Soạn phụ lục trên hợp đồng", "Chỉnh lại trên hợp đồng"/"phụ lục",
   "Lý do và mô tả thay đổi", chọn minh chứng.
4. Rời màn khi đang soạn thì hỏi trước (web chỉ có `beforeunload`): "Rời trang?" + câu của nút "Hủy" trên web.
   Thanh tab dưới của app / app tự chuyển màn không chặn được.
5. Thanh nổi → footer cố định, ẩn khi bàn phím mở. Workspace riêng trên trang HĐ con vẽ thanh trong panel.
6. `input:invalid` → kiểm 4 ô số (3 ô cư trú, số tháng thuê), lỗi dưới ô "Nhập số nguyên từ {min} đến {max}."
   (chữ mobile đã có từ C2a), cuộn tới mục lỗi và vẫn hiện thông báo của web.
7. Minh chứng sai loại/cỡ/quá số lượng bị từ chối ngay khi chọn (web: lúc lưu/gửi).
8. `window.confirm` → hộp thoại app, chữ web tách tiêu đề/mô tả, nút "Xác nhận"/"Quay lại".
9. Chọn lại đúng cách tính phí / ngân hàng / ngày đang hiện thì bỏ qua (đúng như `<select>`, `<input type=date>`
   không phát `onChange`; nếu không sẽ sinh thay đổi giả trong payload).
10. Link văn bản gia hạn/phụ lục mở trong app (web: tab mới cho gia hạn). Nhãn chuyển tháng của lịch do `AppCalendar`.
    Bảng soạn phụ lục → mỗi dòng một thẻ.

## Lỗi web phát hiện (chưa sửa web, đã port giống)

1. Trang HĐ con của phụ lục SCHEDULED: "Chỉnh lại phụ lục" mở khung soạn trong workspace riêng ở tab Ký số, không có
   ô nội dung nào (các section dùng workspace của trang), và đổi tab là mất.
2. AP:83-115: `note` dùng chung giữa ô "Lý do từ chối yêu cầu" và `WITHDRAW`/`CANCEL`, chữ gõ dở được gửi kèm.
3. `changes` không bao giờ chứa `equipments`/`amenities` và web không mount hai bảng đó (code chết; chỉ đổi được qua
   đồng bộ bài đăng).

## Cần người khác

`package.json`: `"test:rental-contract-amendment": "node --test tests/rental-contract-amendment.test.cjs"`.

## Kiểm tra

`npx tsc --noEmit` sạch; eslint + prettier file C2b sạch; test C2b 17/17 (chạy `useWorkspaceState` và
`InlineAmendmentFields` của web song song bản mobile, so chuỗi JSON payload; bản mobile dùng `structuredClone` của
`@ungap` như trên máy); `rental-contract-detail` 14/14, `rental-logic` 28/28, `rental-api` 15/15, `rental-nav` 11/11.
Đối chiếu chuỗi tiếng Việt hai chiều: chỉ lệch do tách confirm, `BankPicker`/`AppCalendar` sẵn có và chữ ở mục 6.

## Chưa kiểm

Toàn bộ giao diện trên thiết bị (cuộn tới mục, ẩn footer theo bàn phím, modal lịch, chọn minh chứng, Back Android);
panel, thanh thao tác và panel gia hạn chưa có test render (chỉ tsc); gọi backend thật.
