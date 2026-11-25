# Lỗi web / backend phát hiện khi port luồng thuê (để chuyển người phụ trách)

Chưa lỗi nào được tái hiện trên hệ thống chạy thật; tất cả đến từ đọc code.
**[K]** = Claude đã tự mở code kiểm · **[C]** = chỉ Codex/agent xác minh, nên kiểm lại.
Mã trong ngoặc trỏ tới báo cáo `review-*-codex.md` (có file:dòng, kịch bản, cách sửa).

## Ưu tiên 1 — tiền và chữ ký
| # | Lỗi | Nơi sửa | Mức kiểm | Mobile đang làm gì |
|---|---|---|---|---|
| 1 | Đồng ý ký không gắn phiên bản/PDF đã xem: xem bản A có thể ký/gửi bản B (SmartCA, INTERNAL, nút "Gửi cho người thuê") (RC1-01, RC2-01) | backend + web | [K] phần SmartCA | đọc lại trước khi gửi (chỉ giảm rủi ro) |
| 2 | Xác nhận/từ chối chứng từ chỉ theo paymentId → có thể áp vào lần báo chuyển mới, gồm hoàn cọc (RB-03, RD-04) | backend + web | [K] | đọc lại trước khi gửi ở hoá đơn/quyết toán; còn khe hở |
| 3 | Đổi ảnh chứng từ, lần tải sau lỗi → web vẫn gửi **ảnh cũ**; upload cũ chậm đè tệp mới (`RentalPaymentModal.tsx:337-364`, `:421`) | web | [K] | đã chặn |
| 4 | Ảnh chọn cho khoản cọc bị mang sang khoản tiền tháng đầu (RB-02) | web | [C] | đã chặn |
| 5 | Báo chuyển "thành công" dù backend không gắn tệp vừa gửi (RD-11, modal cọc) | web + backend | [C] | đã chặn |
| 6 | Ảnh chọn ở số tiền cũ được gửi cho số tiền mới sau khi cộng phí (RD-03) | web | [C] | đã chặn |
| 7 | Hoá đơn bổ sung: mất phản hồi rồi nhập lại → **có thể thu hai lần** (RD-06) | web + backend | [C] | giữ như web |
| 8 | Hoá đơn bổ sung phát hành bằng một chạm, không xác nhận (RD-05) | web | [C] | giữ như web |

## Ưu tiên 2 — luồng bị tắc hoặc mất dữ liệu
| # | Lỗi | Mức kiểm |
|---|---|---|
| 9 | **Hợp đồng miễn cọc không có điểm vào để chốt bàn giao/quyết toán** — màn quyết toán chỉ gắn ở hợp đồng cọc (`contract/page/PaymentTab.tsx:51`); miễn cọc không tạo hợp đồng cọc (RD-01) | [K] điểm mount; phần "backend cho lập đề xuất" [C] |
| 10 | VNPT từ chối ngay → hợp đồng kẹt `LANDLORD_SIGNATURE_PENDING`, chủ nhà không có nút ký lại (WC-1); lỗi nhúng chữ ký: web mời ký lại nhưng backend từ chối (WC-2) | [C] |
| 11 | Hai phiên cùng soạn phụ lục ghi đè/xoá nháp của nhau (RC2-02) | [C] |
| 12 | Mở phụ lục theo ID có thể hiện/cho ký văn bản khác khi đang tải hoặc tải lỗi (RC1-02) | [C] — mobile đã chặn |
| 13 | "Chỉnh lại phụ lục" từ trang văn bản con không có ô để sửa (RC2-04) | [C] |
| 14 | Thẻ bước tiếp theo chỉ nhầm người khi HĐ INTERNAL ở `PENDING_REVIEW` (RC2-07, backend) | [C] |
| 15 | Bỏ bản bài đăng đã chọn, phản hồi cũ làm nó hiện lại, lệch dữ liệu lưu (RC2-03) | [C] — mobile đã chặn |

## Ưu tiên 3
- Bộ lọc "Đã hủy" trang 7: web xin `size=56`, backend `@Max(50)` [K].
- Gửi hợp đồng xong vẫn báo "Không thể gửi" khi GET sau đó lỗi (RC2-06) [C].
- Lỗi chỉ số/phí: đổi tab bị kéo về "Nội dung" (RC2-08) [C]. Nút "Xem lịch sử tệp" của HĐ cọc không có đích (RC2-11) [C].
- Nháp lý do/tệp đi theo nhầm phiên bản hoặc hồ sơ ở đối soát và khiếu nại (RD-09 và mục "Nhận định" trong `review-D-codex.md`) [C].
- Không nghe `payment-changed` ở khối hoá đơn (RD-08); không chặn chỉ số công tơ quá lớn (RD-10) [C].
- Đóng phiếu khi đang gửi có thể để trạng thái cũ (RB-07); GET lỗi vẫn báo thành công (RB-08) [C].
- Các chỗ web ↔ backend lệch ghi ở Pha 0: mục WA-*, WB-*, WC-*, WD-* trong `parity-{A,B,C,D}.md`.
