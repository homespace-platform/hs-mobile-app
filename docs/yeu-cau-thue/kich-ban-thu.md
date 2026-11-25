# Kịch bản thử luồng thuê trên máy (2 tài khoản)

**Chuẩn bị**
- Build lại app: `npm run run:android` (có 2 thư viện native mới: `react-native-pdf-renderer`, `expo-clipboard`).
- Tài khoản **K** (khách thuê) và **C** (chủ nhà), đã hoàn thiện hồ sơ, KYC, C có tài khoản ngân hàng nhận tiền.
- App đang trỏ `api.homespace.id.vn` → **dữ liệu và khoản tiền tạo ra là dữ liệu thật của hệ thống**. Dùng tin đăng thử, không chuyển tiền thật.
- Nên mở thêm web cùng tài khoản để so từng bước. Chỗ nào mobile khác web mà không có trong danh sách "Khác web" thì ghi lại.

Cột "✔" để tự đánh dấu. Gặp lỗi: ghi bước, tài khoản, ảnh màn hình, giờ (để dò log).

## 0. Rủi ro cao — thử trước
| ✔ | Thử | Mong đợi |
|---|---|---|
| ☐ | Mở app sau khi build, vào từng mục Quản lý (cả 2 vai) | Không văng; mục thuê nhà mở màn mới |
| ☐ | Ô tiền (giá/cọc/phí trong hợp đồng, phụ lục): bôi đen cả ô đang là `1.250`, **dán** `1.25` | Báo lỗi dán; **không** thành `125`. Thử cả Android và iOS |
| ☐ | Cùng ô: gõ, xoá lùi từng ký tự, xoá qua dấu chấm | Gõ/xoá bình thường |
| ☐ | C: sửa nháp hợp đồng → **Lưu** (kết xuất) → ký/gửi ngay, **không** tải lại | Khung ký nhận đúng file mới, không báo "Chưa tìm thấy tệp đúng phiên bản" |
| ☐ | Mở PDF hợp đồng đã ký (tên tệp có dấu cách/tiếng Việt) | Hiện nội dung; chia sẻ được |
| ☐ | Hộp thoại mở từ trong cửa sổ trượt (xác nhận, nhập lý do), đóng cửa sổ rồi bấm thao tác khác | Hộp hiện đủ, không tự đóng và không tự trả "không" |
| ☐ | Gửi form khi hồ sơ thiếu | Hộp có nút "Cập nhật hồ sơ" không bị hộp khác che |

## 1. Luồng chính (có cọc)
| ✔ | Ai | Bước |
|---|---|---|
| ☐ | K | Chi tiết nhà → **Yêu cầu thuê nhà** → điền, ước tính đổi theo ngày/thời hạn/số người → đồng ý chính sách → gửi. Ảnh trong form phải đúng ảnh tin |
| ☐ | K | Thử email sai và số tháng 241 → bị chặn |
| ☐ | C | Quản lý → Yêu cầu thuê → xem chi tiết, thử hỏi AI → **Chấp thuận** |
| ☐ | K | Thanh toán cọc: QR, nút sao chép, tải QR, chọn ảnh (thử ảnh HEIC trên iPhone), gửi |
| ☐ | K | Trước khi gửi: đổi sang ảnh khác khi mạng yếu → không được gửi ảnh cũ |
| ☐ | C | Xem chứng từ → **Từ chối** (lý do) → K gửi lại → C **Xác nhận đã nhận** |
| ☐ | C, K | Hợp đồng cọc → xem PDF → ký (SmartCA: chuyển sang app VNPT rồi quay lại) |
| ☐ | C, K | Tiền tháng đầu: báo chuyển → xác nhận |
| ☐ | C | Tạo/hoàn thiện hợp đồng thuê → Lưu → Gửi cho người thuê |
| ☐ | K | Ký hợp đồng thuê → trạng thái Đang hiệu lực |
| ☐ | C, K | Xem bằng chứng blockchain (nếu có) |

## 2. Vòng đời
| ✔ | Ai | Bước |
|---|---|---|
| ☐ | C | Hoá đơn tháng: nhập chỉ số bằng dấu phẩy `12,5` → phát hành |
| ☐ | K | Thanh toán hoá đơn → C xác nhận → K mở biên lai PDF |
| ☐ | C, K | Gia hạn thanh toán một hoá đơn (yêu cầu → duyệt/từ chối) |
| ☐ | C, K | Phụ lục: soạn → xem lại thay đổi → gửi → K yêu cầu sửa/đồng ý → ký |
| ☐ | K, C | Gia hạn hợp đồng (gần hết hạn) |
| ☐ | K, C | Khiếu nại: mở, trao đổi, đính kèm tệp, đóng, mở lại |

## 3. Kết thúc
| ✔ | Ai | Bước |
|---|---|---|
| ☐ | K/C | Đề nghị chấm dứt sớm → phản hồi → ký văn bản |
| ☐ | C | Chi phí cuối kỳ + bàn giao → **Gửi đề xuất quyết toán** |
| ☐ | K | Gửi đối soát → C sửa → K **Đồng ý quyết toán** |
| ☐ | C | Báo chuyển hoàn cọc → K xác nhận đã nhận |
| ☐ | C, K | Hợp đồng đóng; Lịch sử thanh toán có đủ khoản, mở được PDF |
| ☐ | — | **Hợp đồng miễn cọc:** thử đi tới quyết toán. Dự kiến **bị tắc** (RD-01, web cũng vậy) → xác nhận để quyết định |

## 4. Điều hướng, thông báo, tệp
| ✔ | Thử | Mong đợi |
|---|---|---|
| ☐ | Bấm từng loại thông báo trong app (yêu cầu, thanh toán, hợp đồng, hoá đơn, quyết toán, khiếu nại) với cả 2 vai | Mở đúng màn, đúng bản ghi |
| ☐ | Bấm thông báo đẩy (kể cả khi app đang tắt) | Mở **danh sách thông báo** (giới hạn: push không kèm đường dẫn); bấm mục trong danh sách mở đúng màn |
| ☐ | Nút Back Android ở chi tiết nhà, các màn thuê, khi đang mở cửa sổ | Đóng lớp trên cùng trước; quay đúng nơi đã đến từ |
| ☐ | Từ yêu cầu đã gửi → Xem bài đăng → Back | Về danh sách yêu cầu |
| ☐ | Chia sẻ PDF/DOCX sang Zalo, Drive, Gmail | App nhận đọc được tệp |
| ☐ | Đăng xuất → đăng nhập tài khoản khác | Không thấy dữ liệu/tệp của tài khoản trước |
| ☐ | Chat gửi ảnh/tệp, đổi ảnh đại diện, đăng tin có ảnh (sau khi đã đăng xuất/đăng nhập lại) | Vẫn hoạt động |
| ☐ | Đặt lịch xem, tin đăng của tôi, đổi trạng thái tin, chi nhánh | Không bị ảnh hưởng bởi việc gỡ code cũ |
| ☐ | Giao diện sáng/tối; chữ đơn cách ở mã chuyển khoản | Đọc được |
