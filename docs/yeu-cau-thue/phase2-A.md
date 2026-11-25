# Pha 2A — Yêu cầu thuê (màn hình)

Trạng thái: **XONG phần code + tự đối chiếu** (chưa chạy trên thiết bị). Checklist: `parity-A.md` (A-001…A-177) + B-231, B-233.

## Tiến độ

| Phần (trong `src/components/rental/requests/` trừ khi ghi khác)           | ID                                                 | Trạng thái |
| -------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| `logic.ts` (quyết định/trạng thái thuần)                                   |                                                    | xong       |
| Hooks: viewer, list, contracts, hold minutes, deep link, decisions, nháp   | A-007…A-015, A-021…A-031, A-057…A-075, A-107…A-113 | xong       |
| Filters, thẻ, nút tạo hợp đồng, `screens/rental/RentalRequestsScreen.tsx` | A-001…A-056, B-231, B-233                          | xong       |
| Modal chi tiết (+ `RequestDetailOverview`)                                 | A-076…A-106                                        | xong       |
| Modal AI (+ `AiText`)                                                      | A-114…A-123                                        | xong       |
| `RentalRequestModal` + `RequestForm*`, `useRentalRequestForm`              | A-131…A-166                                        | xong       |
| CTA chi tiết nhà (`ContactCta`, `ListingDetailScreen`)                     | A-124…A-130                                        | xong       |
| `tests/rental-requests.test.cjs` (20 test)                                 |                                                    | xong       |
| Tự đối chiếu + kiểm tra                                                    |                                                    | xong       |

## Cách đối chiếu

- Đọc lại từng file web của phần A (`RentalRequestsManagement`, `Card`, `Dialogs`, `Filters`, `DetailModal`, `AiReviewModal`, `RentalRequestModal`, `ContractFallbackButton`, các hook, CTA của `RentDetailView`, `PolicyDialog`, `ModalShell`, `CostSummary`, `EndOfPeriodCharges`) bên cạnh code mobile.
- So chuỗi tiếng Việt hai chiều bằng script tạm: sau khi sửa, mọi khác biệt còn lại là do script cắt chuỗi template, trừ "Đóng đánh giá AI" (A-114) và "Chọn ngày dọn vào" (web cũng không hiện được: luôn có ngày). Mobile chỉ thêm tiêu đề hộp "Thành công"/"Thông báo" và nhãn trình đọc màn hình.
- Lỗi tìm thấy khi đối chiếu và đã sửa: thiếu tooltip "Phòng này có N yêu cầu đang chờ duyệt"; ngày dọn vào bị viết hoa từng chữ; điều kiện giữ chỗ có xuống dòng không tách câu như web.

## ID chưa đạt đầy đủ

| ID | Thiếu gì | Lý do |
| -- | -------- | ----- |
| A-107, A-109…A-113 | Có code và test phần quyết định, nhưng **hiện chưa mở được từ app**: không đường nào truyền `requestId`/`invalidLink` | Chạm thông báo chưa nối `rentalRouteFromActionPath` (Pha 3). `payment-link` (D) cũng sinh route này nhưng chỉ tới được qua deep link |
| A-108 | Không có "đăng nhập rồi quay lại link" | Chưa đăng nhập thì app chỉ có màn đăng nhập; lưu link chờ là việc của Pha 3 |
| A-125 (nhánh chưa đăng nhập) | Không có toast "Vui lòng đăng nhập để gửi yêu cầu thuê nhà" | Như trên: không tới được màn chi tiết khi chưa đăng nhập |
| A-114 | Nút đóng đọc là "Đóng", không phải "Đóng đánh giá AI" | `ModalShell` (đóng băng) cố định nhãn |
| A-117, A-121 | Markdown chỉ hỗ trợ tiêu đề, gạch đầu dòng, đánh số, **đậm**, link thành chữ; bảng/khối mã/ảnh hiện dạng chữ thô | App không có thư viện markdown, không được thêm dependency |
| A-139, A-145 | Thiếu chặn mức HTML của web: `max=240` ở ô số tháng và `type="email"` (trình duyệt tự chặn submit, không có chuỗi tiếng Việt) | Mobile gửi đi và hiện lỗi server (vd "leaseMonths cannot exceed 240"). Không tự đặt chuỗi mới |
| A-034 | `accessibilityLabel` đặt trên khung thẻ không focus được, trình đọc màn hình có thể không đọc | Đặt `accessible` sẽ gộp mất các nút trong thẻ |
| A-041, A-042, A-043, A-046, A-052, A-102 | Phần A đã gắn đúng prop; nội dung bên trong là component của B | Đang được review riêng, chưa chạy trên máy |

Đạt nhờ code có sẵn, A không sửa: A-166, A-170 (backend); A-169 (`lib/axios-client` xử lý 1009/1010); A-177 (`lib/notification.ts` có đủ 26 nhãn, đã so với web, và nhãn vai trò).

Còn lại A-001…A-176 không nêu trên, cùng B-231, B-233: có trong code.

## Khác web (do thiết bị)

- Tooltip → dòng chữ dưới nút (lý do khoá, "Thử tạo bản nháp…") hoặc `accessibilityHint` (AI, CTA).
- Toast → `useDialog`; toast có nút ("Cài đặt tài khoản", "Xác minh ngay") → hộp thoại có nút. Thông báo "Đang kiểm tra kết quả kết xuất…" là hộp thoại.
- Sau khi đóng modal chi tiết/AI/xem nhanh, hộp thoại hoặc modal kế tiếp mở sau 400 ms (xem lỗi 1 bên dưới).
- Lịch ngày dọn vào mở ngay trong form; lịch sử hỏi AI không có vùng cuộn riêng; chip mã `#id` không hiện (web cũng ẩn trên điện thoại).
- Mở lại form: tên/SĐT/email điền lại từ hồ sơ (web giữ giá trị đã gõ giữa hai lần mở trong cùng trang).
- Không tải được hồ sơ người xem: hiện khối lỗi, "Làm mới" để thử lại (web lấy userId từ token).
- "Xem yêu cầu của tôi" ở chi tiết nhà mở `RentalNavigator` ngay trong `ListingDetailScreen`; quay lại về bài đăng. Trong đó "Tìm nhà cho thuê" = đóng và rời bài đăng.
- Rời màn (mở bài đăng, hợp đồng) rồi quay lại: bộ lọc, trang và modal chi tiết trở về mặc định (navigator chỉ mount màn trên cùng).

Giữ nguyên theo web, nên biết: trong lúc dự toán lại, khối "Phương tiện mang theo" ẩn rồi hiện lại (bấm +/- xe sẽ thấy giật); "hôm nay" tính theo ngày của máy (WA-9).

## Lỗi/thiếu ở file không thuộc A (cần Pha 3 hoặc chủ file)

1. `components/AppDialog.tsx` + `shared/ActionDialog.tsx`: gọi `confirm`/`askReason` **cùng lượt** với lệnh đóng `ModalShell` thì hộp thoại được vẽ trong host của modal đang đóng và bị `onDismiss` khi unmount → `confirm` trả `false` ngay, không thấy gì (suy từ code, chưa thử trên máy). Cách tránh ở A: `useAfterModalClose` trong `RentalRequestsScreen`.
2. `components/PolicyDialog.tsx`: tách câu chỉ theo `". "`, web dùng `/(?<=\.)\s+/` (`lib/rental/split-sentences`). A nối lại chuỗi trước khi truyền.
3. `shared/ModalShell.tsx`: không đổi được nhãn nút đóng.
4. `App.tsx`: `openManagement('tenant-requests' | 'landlord-requests')` (thông báo, lối tắt Home) vẫn mở `ManagementScreen` cũ.
5. `package.json`: cần thêm `"test:rental-requests": "node --test tests/rental-requests.test.cjs"`.
6. Dọn ở Pha 3: `components/RentalRequestForm.tsx` (mồ côi), `getMyRentalRequestByListing` trong `bookingApi.ts` (không còn ai dùng).

## Đường tới màn hình (đã lần theo code)

| Đích | Đường vào |
| ---- | --------- |
| Danh sách RECEIVED / SENT | Tab Quản lý → "Yêu cầu thuê" / "Yêu cầu đã gửi" (`ManagementDashboardScreen` → `onOpenRental`) |
| SENT từ chi tiết nhà | Nút "Đã gửi yêu cầu thuê…", "Yêu cầu được duyệt…", "Xem yêu cầu của tôi" |
| Form gửi yêu cầu | Chi tiết nhà → "Yêu cầu thuê nhà" (qua cổng chủ bài / quyền + hồ sơ / KYC) |
| Modal chi tiết | "Xem chi tiết" / "Mở hồ sơ" trên thẻ; từ xem nhanh thanh toán; deep link (chưa nối) |
| Modal AI | Thẻ PENDING phía chủ nhà khi tin có xung đột → "Hỏi AI đánh giá" |
| Duyệt / từ chối / huỷ | Nút trên thẻ, modal chi tiết; "Chấp thuận yêu cầu này" trong AI |
| Phiếu thanh toán (B) | "Thanh toán" / "Gửi lại chứng từ"; NextActionCard khi chưa có onboarding |
| Xem nhanh, đổi ngày (B) | Dải thông báo trên thẻ; "Đề nghị bắt đầu thuê sớm" |
| Hợp đồng (C, Pha 2C còn placeholder) | "Mở hợp đồng" / nút footer / sau "Tạo hợp đồng" |

## Kiểm tra

| Lệnh | Kết quả |
| ---- | ------- |
| `npx tsc --noEmit` | sạch (toàn repo) |
| eslint, prettier file của A | 0 lỗi, 0 cảnh báo |
| `node --test tests/rental-requests.test.cjs` | 20/20 |
| `test:rental-logic` / `rental-nav` / `rental-api` / `rental-ui` | 28/28 · 11/11 · 15/15 · 9/9 |
| `test:rent-detail` / `appointment-booking` | 11/11 · 20/20 |
| `test:theme` (trước sửa cuối ở form, không đổi token) | 5/5 |

Chưa kiểm: không chạy trên máy/emulator, không build Android, không gọi backend thật. Cần thử trước: modal chồng (chi tiết → hộp thoại, chi tiết → phiếu thanh toán, form → điều kiện giữ chỗ), bàn phím trong form, nút Back Android, ảnh đường dẫn tương đối (cần `EXPO_PUBLIC_WEB_BASE_URL`).

## Sửa sau review

Theo `review-A-codex.md` (RA-02 để Pha 3). Mỗi mục đã đọc lại dòng web và mobile được dẫn.

- **RA-01, RA-03** (đúng, đã sửa). `inputConstraintError` (`requests/logic.ts`) chặn như trình duyệt, chạy trước `validateRentalRequest` (giữ nguyên): số tháng nguyên trong `minimumLeaseMonths || 1`…240 (ô được khôi phục như khi blur trước), số người ≤ `occupantLimit ?? 20`, tên/SĐT `required`, email theo quy tắc HTML của `type="email"` (để trống hợp lệ). Lỗi hiện bằng hộp "Thông báo" như các lỗi khác của form. Đã rà mọi thuộc tính của form web: số xe (`min/max`) đã được kẹp sẵn trong state, ghi chú đã có `maxLength` 500, ô cọc thỏa thuận không có ràng buộc, checkbox `required` đã khoá nút gửi. Chưa mô phỏng việc Chrome tự đổi tên miền email có dấu sang punycode (mobile từ chối). Thay dòng A-139, A-145 ở bảng trên.
- **RA-04** (đúng, đã sửa). Khoá gửi theo `listingId` nằm ngoài sheet (`submitLocks`): mở lại form khi POST còn chờ vẫn thấy "Đang gửi yêu cầu...". Form đã đóng không gọi `onClose` nữa; `ListingDetailScreen` chỉ nhận `onSuccess` của đúng bài đang xem. Khác web một chút: khi POST cũ thành công, form vừa mở lại không tự đóng (backend từ chối nếu gửi thêm).
- **RA-09** (đúng, đã sửa). Họ tên/SĐT/email giữ theo bài đăng khi đóng/mở sheet (kể cả ô đã xoá trống); hồ sơ chỉ điền ô chưa có; các trường khác vẫn đặt lại theo A-136. Rời màn chi tiết (kể cả mở "Xem yêu cầu của tôi") thì điền lại từ hồ sơ, như web đổi trang. Thay dòng "Mở lại form: …" ở mục "Khác web".
- **RA-05, RA-08** (đúng, đã sửa). `useViewer` chỉ lấy `userId` từ claim `sub` của access token trong phiên (`tokenSubject`), dùng cho danh sách yêu cầu và chi tiết nhà; lỗi `/favorites/ids` hay API hồ sơ không còn ẩn CTA hoặc chặn danh sách. Form tự tải hồ sơ chỉ để điền ô liên hệ (lỗi thì bỏ qua). Thay dòng "Không tải được hồ sơ người xem…" ở mục "Khác web".
- **RA-06** (đúng, đã sửa). "Xem bài đăng" từ hồ sơ thuê đọc bằng `getAccessibleListing` (prop `accessible` của `ListingDetailScreen`); quyền chủ tin vẫn chỉ theo `own`/`userId`; lịch sử xem chỉ ghi khi tin `PUBLISHED`/`RESERVED` như web. Chưa port dải thông báo "Tin đăng liên quan đến yêu cầu thuê của bạn" của web.
- **RA-07** (đúng, đã sửa). Tab Quản lý: `App` giữ `rentalStack`, Back về danh sách. Danh sách mở từ chi tiết bài A: bài B hiển thị chồng trên danh sách, Back về danh sách rồi về A. Như trước, bộ lọc/trang/modal của danh sách về mặc định khi quay lại, và nút Back Android trên màn chi tiết chưa được xử lý. Thay dòng "Xem yêu cầu của tôi…" ở mục "Khác web" ("Tìm nhà cho thuê" giữ như cũ).
- **RA-11** (đúng, đã sửa). `ModalShell` có thêm `closeLabel` (mặc định "Đóng"); modal AI truyền "Đóng đánh giá AI". Thay dòng A-114 ở bảng trên và mục 3 "Lỗi/thiếu ở file không thuộc A".
- **RA-12** (đúng, đã sửa). Dòng hướng dẫn mẫu phát hành chuyển vào `RentalContractFallbackButton`, nên thẻ và modal chi tiết đều có.
- **RA-10** (đúng, đã sửa). `AiText` dựng bảng GFM (cuộn ngang, `<br>` trong ô xuống dòng) và mở link khi bấm, chỉ `http`/`https`; link tin `/rent/<uuid>` mở trên web qua `EXPO_PUBLIC_WEB_BASE_URL` (chưa cấu hình thì hiện chữ). Khối mã, ảnh, URL trần vẫn là chữ thô. Thay dòng A-117, A-121 ở bảng trên.

Kiểm tra sau sửa: `tsc --noEmit` sạch; eslint + prettier các file đã đổi sạch; `test:rental-requests` 27/27, `rental-ui` 9/9, `rental-logic` 28/28, `rental-nav` 11/11, `rent-detail` 11/11, `appointment-booking` 20/20, `api` 47/47, `theme` 5/5. Test cho RA-06, RA-07, RA-11, RA-12 chỉ đối chiếu mã nguồn. Chưa chạy trên máy/emulator, chưa gọi backend thật (gồm bảng/link AI, giải mã token trên Hermes, màn chi tiết lồng nhau).

## Sửa sau đối chiếu

Theo bảng "KHÔNG khớp" của `audit-A-codex.md`. Mỗi mục đã đọc lại dòng web và mobile được dẫn. Không sửa A-032, A-065b, A-076, A-114, A-124, A-125 (cấu hình, bàn phím cứng, cách trình bày trên thiết bị, app bắt đăng nhập).

- **A-002** đã sửa: biểu tượng nằm cạnh tiêu đề (`ScreenHeader` có thêm prop `icon` tuỳ chọn).
- **A-073** đã sửa: `AppDialog` có thêm mức `warning` (tham số `tone` vẫn mặc định `info`, caller cũ không đổi); `draftResultTone` chọn cảnh báo / thông tin / thành công như web.
- **A-085** đã sửa: modal chi tiết dựng đúng ba khối skeleton (`PageSkeleton` giữ nguyên cho màn hợp đồng).
- **A-086** đã sửa: tiêu đề "Không thể tải yêu cầu" nằm trong hộp đỏ (`ErrorBlock` có thêm `title` tuỳ chọn). Bố cục căn giữa và kiểu nút của web không đổi theo, audit không nêu.
- **A-087** đã sửa: thêm biểu tượng ghim trước địa chỉ.
- **A-117, A-121** đã sửa: `markdownLines`/`AiText` dựng in nghiêng (`*x*`, `_x_`; bỏ qua `_` trong từ, URL, đích link và mã) và đoạn trích `>`. Giới hạn: không lồng nhấn mạnh, không có "lazy continuation" của đoạn trích. Khối mã, ảnh, URL trần vẫn như trước.
- **A-128** sửa một nửa. Phần đúng: web gọi cả với tin của chính mình (`dashboard/properties/view` không dùng `previewMode`), nên đã bỏ điều kiện `own`. Phần không đúng, giữ nguyên: gọi lại khi quay về từ danh sách yêu cầu là tương đương web, vì "Xem yêu cầu của tôi" trên web là trang khác (`router.push`), quay lại sẽ mount lại `RentDetailView` và gọi lúc vào; mobile giữ màn đang mount nên phải gọi lại (bỏ đi thì CTA hiện trạng thái cũ).
- **A-130, A-134** đã sửa: form nhận `listingThumbnail` của chính tin từ `rentalModalProps`; `RequestThumbnail` vẫn ghép `EXPO_PUBLIC_WEB_BASE_URL` cho đường dẫn tương đối. Đã rà `listingImage()`: trong luồng thuê chỉ có chỗ này. Ngoài luồng thuê, không sửa: ảnh gallery, `ListingCard`, thẻ tin trong chat (`openPropertyChat`, `MessagesScreen`) và `BookingAppointmentModal` (đặt lịch xem) vẫn có thể đổi ảnh `homespace-dev-files` thành ảnh mẫu.
- **A-132** đã sửa: `summary` của `PolicyNotice` nhận `ReactNode` (chuỗi vẫn dùng được), số phút / cụm thay thế in đậm. Bỏ giới hạn 2 dòng cho mọi `PolicyNotice` (web không cắt dòng), nên tóm tắt dài ở màn khác giờ cũng hiện đủ.
- **A-139** đã sửa: ô số tháng nhận mọi dạng số HTML có giá trị nguyên (`12e0`, `12.0`); kiểm tra min/max khi gửi giữ nguyên. Như web, số tháng gửi đi vẫn lấy theo `parseInt` của chữ đã gõ.
- **A-158** đã sửa: ô lời nhắn cao cố định 3 dòng, nội dung dài cuộn bên trong.
- **A-159** đã sửa: bấm phần chữ "Tôi đã đọc và đồng ý" / "(bắt buộc)" cũng tích hoặc bỏ tích; liên kết điều khoản vẫn là vùng bấm riêng. Mục này không cần sửa `PolicyNotice`/`PolicyDialog`.
- **A-169** đã sửa ở một chỗ dùng chung thay vì từng `catch`: hộp 1010 của interceptor được đánh dấu `keep`, và `AppDialog` bỏ qua thông báo thường (không có nút riêng) khi hộp đó còn mở. Nhờ vậy mọi đường gửi của luồng thuê được che (tạo / duyệt / từ chối / huỷ yêu cầu, tạo hợp đồng, và `toast.error` qua `useToast` ở onboarding, hợp đồng, hoá đơn, khiếu nại, ký số) mà không đụng file của agent khác; luồng ngoài thuê cũng được che. Nếu hộp 1010 bị chặn lặp trong 5 giây và đã đóng, thông báo lỗi của form vẫn hiện. 1009: interceptor không mở hộp nào (chỉ tải lại quyền) nên thông báo của form giữ nguyên. Đổi lại: thông báo thường khác đến đúng lúc hộp 1010 đang mở cũng bị bỏ.
  Thêm: lỗi 1010 khi duyệt có thể nhắc "ngân hàng", trước đây bị `isMissingPayeeAccount` coi là thiếu tài khoản nhận tiền và mở hộp có nút đè lên hộp 1010; nay bỏ qua 1010.

Kiểm tra sau sửa: `tsc --noEmit` sạch (toàn repo); eslint + prettier các file đã đổi sạch; `test:rental-requests` 34/34 (thêm 7 test; sửa một assertion cũ vốn đòi từ chối `24e1`, trái với A-139), `rental-ui` 12/12, `rent-detail` 11/11, `api` 40/40, `theme` 5/5, `profile-gate` 10/10, `appointment-booking` 20/20, `rental-logic` 28/28, `rental-nav` 16/16, `rental-api` 15/15, `rental-onboarding` 30/30, `rental-billing` 22/22, `rental-contract-signing` 20/20, `rental-contract-detail` 15/15, `rental-contract-amendment` 20/20. Chưa chạy trên máy/emulator, chưa gọi backend thật: giao diện của A-002, A-085…A-087, A-117 (in nghiêng, đoạn trích), A-132 (đậm lồng trong tóm tắt), A-158, A-159 và hộp 1010 chồng trên form (gồm bấm "Cập nhật hồ sơ" khi form còn mở) chưa được nhìn thấy thật.
