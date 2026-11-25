# Xử lý báo cáo `review-C2-codex.md` (Claude kiểm lại, 26/11)

Tự mở code kiểm: RC2-05 (`maxLength={2}`), RC2-09 (`openSettings('profile')`), lỗi báo thành công giả ở `onboarding/logic.ts` (trả `updated` không kiểm chứng từ) — đúng. Các mục khác tin theo Codex.

**Luồng đầu-cuối (Codex lần theo handler thật): 13/13 bước thông cho cả hai vai** (luồng có cọc). Đứt: chỉnh lại phụ lục từ trang văn bản con (RC2-04, web cũng vậy); SmartCA bị VNPT từ chối ngay (WC-1, backend); hợp đồng miễn cọc (RD-01).

| Mã | Mức | Xử lý |
|---|---|---|
| RC2-01 gửi INTERNAL phiên bản khác bản đã rà | Cao | Mobile: thanh đáy đọc lại như panel (chỉ giảm rủi ro). Cần backend |
| RC2-02 hai phiên ghi đè/xoá nháp phụ lục | Cao | Lỗi backend (cần phiên bản nháp) |
| RC2-03 bản bài đăng đã bỏ hiện lại | TB | Sửa (chốt dữ liệu; web cũng lỗi) |
| RC2-04 chỉnh phụ lục từ văn bản con bị đứt | TB | Giữ như web |
| RC2-05 "100" bị cắt thành 10 tháng | TB | Sửa (lỗi mobile) |
| RC2-06 gửi xong vẫn báo "Không thể gửi" | TB | Giữ như web |
| RC2-07 thẻ bước tiếp theo chỉ nhầm người | TB | Lỗi backend |
| RC2-08 đổi tab bị kéo về Nội dung | TB | Giữ như web |
| RC2-09 link KYC mở sai màn | Thấp | Sửa (lỗi mobile) |
| RC2-10 landing lỗi về nhầm danh sách vai | Thấp | Sửa (lỗi mobile) |
| RC2-11 nút lịch sử tệp HĐ cọc không có đích | Thấp | Giữ như web |
| RC2-12 minh chứng mở sau khi đã đóng | Thấp | Sửa (lỗi mobile) |
| RD-12 còn khe hở | Thấp | Sửa |
| PaymentProofForm/RentalPaymentModal báo thành công giả | — | Sửa (như RD-11; web cũng lỗi) |
| RC1-05 còn `ContractHeader` gọi `downloadDocument` | — | Sửa |
RD-03, RD-07, RD-09, RD-11: ĐẠT.
