# Xử lý báo cáo `review-B-codex.md` (Claude kiểm lại, 25/11)

Đã tự mở code kiểm: 2 nhận định về web (đúng), RB-01, RB-02, RB-03 (đúng). Các mục còn lại tin theo Codex + phase2-B.md, chưa tự kiểm riêng.

| Mã | Mức | Xử lý |
|---|---|---|
| RB-01 gửi tệp cũ khi bộ chọn còn xử lý | Cao | Sonnet sửa (lỗi riêng mobile) |
| RB-02 chứng từ cọc lọt sang khoản tháng đầu | Cao | Sonnet sửa. Web cũng lỗi → mobile KHÁC WEB (chờ duyệt) |
| RB-03 xác nhận/từ chối áp vào lần báo chuyển mới | Cao | **Lỗi backend** (confirm chỉ nhận paymentId) → không sửa ở mobile; cần sửa backend + web |
| RB-04 xem/ký hợp đồng cọc là placeholder | Cao | Phần C (Pha 2 đợt 2) |
| RB-05 thông báo thanh toán mất paymentId | Cao | PaymentLinkScreen: phần D; nối thông báo: Pha 3 |
| RB-06 chấm dứt sớm/phụ lục chưa có điểm vào | Cao | Phần C mount |
| RB-07 đóng phiếu khi đang gửi → dữ liệu cũ | TB | Giữ như web (web cùng đường đi) — đề xuất sửa cả hai |
| RB-08 GET lỗi vẫn báo thành công | TB | Giữ như web (web cũng nuốt lỗi) — đề xuất sửa cả hai |
| RB-09 chọn lại bằng chứng huỷ bị cộng dồn | TB | Sonnet sửa (khác web do mobile) |
| RB-10 thiếu biên lai, sổ cọc | TB | Phần D |
| RB-11 màn hồ sơ cọc chưa mở được | TB | Pha 3 (nối deep link) |
| RB-12 đề nghị bắt đầu sớm không tự mở | Thấp | Sonnet sửa |
| RB-13 báo "đã lưu QR" khi huỷ chia sẻ | Thấp | Sonnet sửa |

## Lỗi WEB đã xác minh (cần người làm web sửa)
- `components/rental-request/RentalPaymentModal.tsx:337-364` + submit `:421`: chọn tệp mới hợp lệ không xoá `uploadedStorageId`; upload tệp mới lỗi → nút gửi vẫn bật và gửi **tệp cũ**. Không đánh số lượt upload → upload cũ chậm có thể đè tệp mới.
- Backend `PaymentRequestService.confirmReceipt` (~:566) và reject: chỉ theo paymentId, không ràng buộc lần báo chuyển/chứng từ đã xem.
