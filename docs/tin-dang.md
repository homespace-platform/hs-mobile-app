# Quản lý tin & đăng tin trên mobile

Nguồn chuẩn: `hs-web-app` (`app/dashboard/properties/**`). Backend không đổi.

Nguyên nhân trang trống: `ManagementDashboardScreen.openDestination` đưa `landlord-properties` vào trang chỉ có tiêu đề, dù `ManagementScreen` và `ListingDraftScreen` đã có sẵn.

| Phần | Người làm | Báo cáo | Trạng thái |
|---|---|---|---|
| A. Quản lý tin (danh sách, thao tác) | Sonnet | `tin-dang/A-quan-ly.md` | xong, chưa thử trên máy |
| B. Logic đăng tin (payload, kiểm tra, mô tả) | Sonnet | `tin-dang/B-logic.md` | xong |
| C. Giao diện đăng tin | Sonnet | `tin-dang/C-giao-dien.md` | xong, chưa thử trên máy |
| D. Trang gói hội viên & lượt đăng (đã nối trình soạn tin; ETH tạm tắt trên mobile) | Sonnet | `tin-dang/D-hoi-vien.md` | xong, chưa thử trên máy |
| E. Thu gọn màn quản lý tin (mobile + web màn nhỏ) | Sonnet | `tin-dang/E-gon-man-hinh.md` | xong, chưa thử trên máy |
| Review | sol Codex | `tin-dang/review-codex.md` | 12 phát hiện |
| Xử lý review | Sonnet | `tin-dang/review-xu-ly.md` | đã sửa 12/12 (giới hạn ghi trong báo cáo), chưa thử trên máy |
| Review đợt 2 (hội viên, sửa lỗi, giao diện) | sol Codex | `tin-dang/review-hoi-vien-codex.md`, `review-sua-loi-codex.md`, `review-gon-man-hinh-codex.md` | xong |
| Sửa lỗi đợt 2 | Sonnet | `D-hoi-vien.md`, `review-xu-ly.md`, `E-gon-man-hinh.md` | xong; bản sửa đợt 2 chưa review lại |

Kiểm tra tổng 26/11: typecheck mobile và web đạt, 555/555 test mobile, 6/6 test web liên quan.

Còn mở: API backend tra đơn chờ (mất phản hồi lúc tạo đơn); WebView SePay trên Android; chưa thử trên máy thật.
