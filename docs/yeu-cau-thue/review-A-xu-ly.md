# Xử lý báo cáo `review-A-codex.md` (Claude kiểm lại, 25/11)

Tự mở code kiểm: RA-01, RA-08 (đúng). Các mục khác tin theo Codex, người sửa phải đọc lại dòng được dẫn trước khi sửa.

| Mã | Mức | Xử lý |
|---|---|---|
| RA-01 email sai vẫn lưu | Cao | Sonnet sửa |
| RA-02 chạm thông báo mở màn cũ | Cao | Pha 3 (đã lên kế hoạch) |
| RA-03 …RA-09, RA-11, RA-12 | TB/Thấp | Sonnet sửa |
| RA-10 markdown AI (bảng GFM, link) | Thấp | Sonnet sửa |
| Hộp thoại bị tự đóng khi sheet đóng | — | Cơ chế có thật nhưng KHÔNG điểm gọi nào hiện bị dính (A dùng trễ 400 ms, B giữ sheet). Cần thử trên máy; Pha 3 cân nhắc đổi sang tín hiệu đóng modal xong |

## Lỗi WEB/backend (mobile giữ như web)
- Bộ lọc "Đã hủy" trang 7: client xin `size=56`, backend `@Max(50)` (`RentalRequestController.java:82,133`).

## Cập nhật phần B
5 lỗi (RB-01, 02, 09, 12, 13) đã sửa; kiểm lại: tsc sạch, 22/22 script test pass, eslint không lỗi.
