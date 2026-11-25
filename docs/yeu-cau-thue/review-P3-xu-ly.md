# Xử lý báo cáo `review-P3-codex.md` (26/11)

Gỡ code cũ: Codex không thấy xoá nhầm tính năng ngoài luồng thuê.
Claude xem lại code R3-01: đúng (mobile phân tích cả chuỗi sau khi dán, không chỉ đoạn được chèn). Các mục khác tin theo Codex; người sửa đọc lại dòng được dẫn.

| Mã | Mức | Xử lý |
|---|---|---|
| R3-01 dán tại con trỏ đổi số tiền âm thầm; Delete cạnh dấu phân nhóm xoá sai chữ số | Cao | Sonnet P3-fix-1, sau đó Codex kiểm lại riêng |
| R3-02 xoá/thay chứng từ khi đang upload xoá mất tệp | TB | P3-fix-2 |
| R3-03 đăng xuất xoá tệp đang được dùng (picker, tệp đã chia sẻ) | TB | P3-fix-2 |
| R3-04 hộp 1010 nuốt thông báo của thao tác khác | TB | P3-fix-2 |
| R3-05 Back từ lịch hẹn mất bài đăng + stack thuê | TB | P3-fix-2 |
| R3-06 lịch hiện tiêu đề tháng 1 nhưng lưới tháng khác | TB | P3-fix-1 |
| R3-07 lượt chạm thông báo cũ ghi đè màn mới | TB | P3-fix-2 |
| R3-08 đăng xuất bỏ khoá gửi yêu cầu | Thấp | P3-fix-2 |
| R3-09 thiếu nhãn loại tài liệu ở trình xem PDF (C-283) | Thấp | P3-fix-1 |
