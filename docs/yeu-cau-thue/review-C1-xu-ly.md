# Xử lý báo cáo `review-C1-codex.md` (Claude kiểm lại, 25/11)

Tự mở code kiểm: RC1-01 (đúng: consent chỉ gắn `contract.id`, payload chỉ có `certificateSerial` + `consent:true`). Các mục khác tin theo Codex; người sửa phải đọc lại dòng được dẫn.

**Trạng thái: ĐÃ SỬA (26/11)** — chi tiết ở `phase2-C1.md` mục "Sửa sau review". RC1-01 chỉ giảm rủi ro; RC1-05 còn 1 đường ở `ContractHeader.tsx:108` (chuyển sang đợt sửa C2).

| Mã | Mức | Xử lý |
|---|---|---|
| RC1-01 đồng ý bản A có thể ký bản B | Cao | Mobile: xoá consent khi revision/PDF nguồn đổi (chỉ giảm rủi ro). **Sửa triệt để cần backend** nhận + kiểm revisionId/documentId; web cũng lỗi |
| RC1-02 mở phụ lục theo ID hiện/cho ký văn bản khác | Cao | Mobile: chỉ hiện tệp + nút ký khi khớp đúng ID; lọc PDF đúng phiên bản/mục đích. Web cũng lỗi → KHÁC WEB (chờ duyệt) |
| RC1-03 form SmartCA mở lại sau khi ký | TB | Sửa |
| RC1-04 timeout refresh chỉ mở khoá UI | TB | Sửa (cần cho service nhận timeout/signal: sửa nhỏ file service) |
| RC1-05 tệp hợp đồng còn trong cache | TB | Sửa |
| RC1-06 "Thử lại" dùng URL PDF hết hạn | TB | Sửa |
| RC1-07 câu "trong trình duyệt" | Thấp | Sửa câu cho native |
| RA-03 dán "12.0" bị từ chối | — | Sửa |
| RA-04 khoá gửi theo tin, không theo người dùng | — | Sửa: khoá theo user + tin |
| RA-07 đường "Quản lý tin đăng" làm mất danh sách yêu cầu | — | Sửa; Android Back của chi tiết nhà → Pha 3 |
| RA-10 link trong code span vẫn bấm được | — | Sửa |

## Lỗi WEB/backend (ký hợp đồng — cần người làm web/backend)
1. Consent ký không ràng buộc phiên bản/PDF đã xem (web `SmartCaSignaturePanel.tsx:89`; backend `SmartCaSignatureServiceImpl.java:506`, `ContractServiceImpl.java:1093`).
2. Panel phụ lục mở theo ID có thể hiện/cho ký văn bản khác khi đang tải hoặc GET lỗi (web `WorkflowDocumentsPanel.tsx:20,53`).
