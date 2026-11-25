# Xử lý báo cáo `review-D-codex.md` (Claude kiểm lại, 26/11)

Tự mở code kiểm: RD-01 — web chỉ gắn màn quyết toán ở MỘT chỗ (`contract/page/PaymentTab.tsx:51` → `DepositSettlementPanel`, điều kiện `agreementKind === "DEPOSIT"`); `EndTab.tsx` không gắn; backend `DepositAgreementService.createAutomatically` trả null khi miễn cọc. (Phần "backend vẫn cho lập đề xuất khi miễn cọc" tin theo Codex, chưa tự kiểm.) Các mục khác tin theo Codex; người sửa đọc lại dòng được dẫn.

| Mã | Mức | Xử lý |
|---|---|---|
| RD-01 hợp đồng miễn cọc không có chỗ chốt quyết toán | Cao | **CHỜ USER QUYẾT** (web cũng thiếu; thêm điểm vào trên mobile = khác web) |
| RD-02 chạm thông báo mất đích | Cao | Pha 3 |
| RD-03 chứng từ cũ gửi cho số tiền mới | Cao | Sonnet sửa (chốt an toàn; web cũng lỗi) |
| RD-04 xác nhận nhầm lần báo chuyển | Cao | Lỗi backend (= RB-03) |
| RD-05 một chạm phát hành hoá đơn bổ sung | TB | Giữ như web — CHỜ USER QUYẾT |
| RD-06 thử lại có thể tạo khoản thu thứ hai | TB | Giữ như web; lỗi web/backend, rủi ro THU TIỀN HAI LẦN |
| RD-07 "1.5" thành 15, "-5" thành 5 | TB | Sonnet sửa (lỗi mobile) |
| RD-08 không nghe payment-changed | TB | Giữ như web |
| RD-09 tải lại đổi thao tác của bản nháp khiếu nại | TB | Sonnet sửa (chốt an toàn; web cũng lỗi) |
| RD-10 không chặn chỉ số quá lớn | TB | Giữ như web (backend chặn phía hoá đơn bổ sung; hoá đơn tháng cần backend) |
| RD-11 báo thành công cho tệp chưa gắn | TB | Sonnet sửa |
| RD-12 mở tệp sau khi đã rời màn | Thấp | Sonnet sửa |
| RD-13 bản sao chứng từ trong cache | Thấp | Pha 3 (cùng việc dọn cache) |

## Lỗi web được Codex xác minh (7 nhận định, đều đúng trừ phạm vi của mục 5)
Duyệt nhầm lần báo chuyển · lý do từ chối quyết toán theo nhầm lần · gửi lại tệp cũ ở quyết toán · báo chuyển hoá đơn thiếu khoá khi đọc/tải · nháp đối soát đi vào đề xuất mới · tải lại khiếu nại đổi hồ sơ của bản nháp. Dòng web: xem `review-D-codex.md` mục "Nhận định về lỗi web".
