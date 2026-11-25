# Sửa sau review Pha 3

Đã tiếp tục phần bàn giao và đối chiếu các hành vi với web. Thay đổi nằm trong `hs-mobile-app`.

| Mã | Xử lý |
| --- | --- |
| R3-01 | Phân tích đoạn chèn theo vùng chọn. Từ chối sự kiện trùng chữ có thể đổi số tiền và từ chối thao tác xoá dấu phân nhóm khi vị trí con trỏ trước/sau chưa rõ. So sánh với web trên từng vị trí và vùng chọn. |
| R3-02 | Tệp đang đọc, tải hoặc chờ đến lượt trong một nhóm được giữ đến khi kết thúc. Tệp bị thay, xoá hoặc bỏ khi đóng màn được dọn sau đó. |
| R3-03 | Dọn theo từng mục cache. Bản đã chuyển cho app nhận được giữ 10 phút. Chặn việc tiếp tục tải/chia sẻ tài liệu hoặc gửi request xác thực của phiên cũ sau khi đăng nhập lại. Áp dụng ở các bước tải tệp của chat và đăng tin. |
| R3-04 | Hộp thoại 1010 xếp hàng các thông báo khác. Chỉ lỗi của chính request đã có hộp 1010 được bỏ ở các luồng yêu cầu thuê tương ứng. Khi bấm hành động, native modal đóng trước rồi hàng đợi tiếp tục. |
| R3-05 | Mở lịch hẹn trong điều hướng chi tiết tin. Back trở về tin B, danh sách yêu cầu rồi tin A. |
| R3-06 | Tiêu đề và lưới ngày của lịch giới hạn dùng cùng một tháng. Test render lưới tháng 1 trực tiếp và qua tháng 12. |
| R3-07 | Lượt chạm mới nhất mới được điều hướng. Hai lượt chạm cùng thông báo dùng chung cập nhật đã đọc. |
| R3-08 | Khóa theo tài khoản và tin đăng tồn tại tới khi POST hoàn tất, kể cả khi đăng nhập lại. |
| R3-09 | Loại tài liệu nằm cạnh tên PDF, mục đích hiển thị ở dòng phụ. |

## Rà soát độc lập

Phiên Codex khác chạy với `-s read-only`. Các ca tái hiện gồm xoá dấu phân nhóm mơ hồ, 401 muộn dùng phiên mới, tải/chia sẻ PDF xuyên phiên, thông báo đang đợi dễ bị ghi đè và giảm đếm chưa đọc hai lần. Các ca này đã được xử lý và kiểm lại. Cập nhật fixture của `api`, `chat-media`, `rental-api` và các test chia sẻ liên quan vì cơ chế giữ tệp có thêm bước bất đồng bộ. Các assertion về lỗi tải PDF vẫn đối chiếu với web.

## Khác web

RN có thể chỉ trả chuỗi sau thao tác và một vị trí con trỏ. Nếu vị trí đó có thể là cả trước Delete lẫn sau Backspace, app báo lỗi và giữ nguyên số tiền. Web nhận được hướng xoá từ sự kiện trình duyệt. Cần xác nhận thời điểm nhận sự kiện trên máy thật.

RD-01 và các mục cần quyết định tiếp tục theo dõi tại [lỗi web/backend](loi-web-backend.md). Kiểm thử thiết bị dùng [kịch bản hai tài khoản](kich-ban-thu.md).
