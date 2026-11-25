# Pha 2B — Giữ chỗ & cọc (tiến độ)

Chủ: agent B. File sở hữu: `src/components/rental/onboarding/**`, `src/screens/rental/ReservationWorkspaceScreen.tsx`, `tests/rental-onboarding.test.cjs`.

Trạng thái: **XONG phần code** (chưa chạy trên thiết bị).

## Tiến độ

| Thành phần | ID | Trạng thái |
|---|---|---|
| logic.ts (luật nút, tải/kiểm phiếu, minh chứng, single-flight, workflow) | B-061, B-063…B-068, B-111, B-130, B-135, B-136, B-140, B-151, B-187, B-212…B-215 | xong |
| common.tsx (toast, checkbox, nút chọn, mở tệp) | B-084, B-207 | xong |
| OnboardingPaymentCard | B-060…B-069 | xong |
| RentalPaymentModal + PaymentProofForm | B-110…B-143 | xong |
| DepositAgreementPanel | B-090…B-099 | xong |
| RentalDepositQuickViewModal (+ RentalReceiptNotice, ReservationReceipt) | B-150…B-158 | xong |
| EarlierStart + RentalStartChangeQuickModal (+ StartChangeNotice) | B-160…B-171 | xong |
| WorkflowDocumentsPanel | B-218, B-219 | xong |
| RentalWorkflowPanel | B-200…B-217, B-219 | xong, xem ID chưa đủ |
| RentalOnboardingPanel | B-020…B-055, B-080…B-085, B-180…B-193 | xong |
| AgreementDocumentActions | B-234 | xong |
| ReservationWorkspaceScreen | B-001…B-005 | xong |
| tests/rental-onboarding.test.cjs | — | 18/18 |
| Tự đối chiếu checklist | tất cả | xong |

## Cách đã đối chiếu

- Máy: mọi chuỗi tiếng Việt (AST) của 11 file web B đều có trong mã mobile, trừ danh sách "Chuỗi web không có" bên dưới. Kiểm này chỉ xác nhận chuỗi có mặt, không xác nhận vị trí.
- Máy + tay: biểu thức điều kiện / `disabled` của web không khớp nguyên chữ trong mobile đã được đọc từng dòng (đều do đổi tên biến, chuyển vào `logic.ts`, thay API trình duyệt, hoặc MOBILE_QR).
- Test chạy song song với mã web: luật nút khoản tiền (2240 tổ hợp vai × chiều × trạng thái × loại × số tiền × hạn × đề nghị hủy), quyền báo chuyển, disabled của nút workflow, câu xác nhận workflow, tiêu đề hộp quá hạn.

## ID chưa làm đủ

| ID | Thiếu | Lý do |
|---|---|---|
| B-018, B-019 | không làm ở B | thuộc modal chi tiết yêu cầu của A |
| B-070, B-100…B-103 | chỉ gắn component | `PaymentReceiptActions`, `DepositLedgerSummary` của D (còn là stub) |
| B-095, B-099, B-218 | xem PDF, blockchain proof, ký số chưa chạy | gắn stub của C: `ContractPdfViewerModal`, `ContractBlockchainProof`, `SmartCaSignaturePanel` |
| B-122, B-157, B-218 | tooltip nút sao chép toàn bộ; 2 chuỗi chặn popup | điện thoại không có tooltip / popup |
| B-133, B-143 | bỏ | MOBILE_QR (Q2) |
| B-200 | nhãn đọc màn hình `Đóng cửa sổ chấm dứt sớm`; accordion dùng mũi tên thay `+/−`; không có nút chữ `Đóng` riêng (dùng X) | `ModalShell`, `Accordion` đóng băng |
| B-210 | không có nhãn `Tháng sau`/`Tháng trước`/`Ngày dd/MM/yyyy`; lịch mở dạng sheet, ngày hợp lệ phân biệt bằng cách làm mờ ngày khác | `AppCalendar`/`DateField` đóng băng; chưa kiểm lịch mở ở tháng nào khi ngày hợp lệ đầu tiên ở tháng sau |
| B-219 | `focusRequest` mở sẵn + viền nổi bật nhưng KHÔNG cuộn trang cha tới panel (trong modal chấm dứt sớm thì có cuộn tới văn bản) | panel không giữ ScrollView của màn C |
| B-010…B-017, B-230 | không viết lại | component chung Pha 1 (NextActionCard, DetailTabs, EndOfPeriodCharges) |
| B-231, B-233 | không làm ở B | thuộc A |
| B-232 | không viết lại | `lib/rental/rental-contract-fallback` (Pha 1), A gọi |

Chuỗi web không có trên mobile: chuỗi MOBILE_QR (`RentalPaymentModal.tsx:182-401, 829-1130`), `Sao chép toàn bộ thông tin chuyển khoản` (tooltip), `Trình duyệt đang chặn mở chứng từ…`, `Cho phép mở cửa sổ để tải Word phụ lục.`, `Đóng cửa sổ chấm dứt sớm`.

## Khác web

1. Minh chứng: chỉ lần chọn mới nhất được gán `storageId`; chọn tệp mới xoá `storageId` cũ; khoá chọn/xoá khi đang gửi. Web giữ id cũ và để upload chậm ghi đè: nếu tệp thứ hai tải lỗi, web vẫn gửi được tệp thứ nhất (nên ghi thành lỗi web).
2. Tệp sai: dòng lỗi hiện dưới ô chọn (web lưu lỗi nhưng không vẽ khi chưa có tệp).
3. Ba nút chọn: `Chọn từ thư viện` (ảnh), `Chọn tệp (PDF)`, `Chụp ảnh`; khi đã có tệp vẫn đủ ba nút (nút đầu đổi thành `Chọn tệp khác`).
4. Chứng từ, bằng chứng, Word mở bằng `expo-web-browser`.
5. `Tải mã QR` mở bảng chia sẻ; không báo đã lưu (thiết bị không trả kết quả).
6. `toast` → `useDialog` tiêu đề `Thông báo`.
7. Phiếu chuyển khoản gắn bản nháp với `payment.id` đã tải (web không có; chờ người dùng duyệt, xem "Sửa sau review").
8. Xem nhanh: chạm lại khoản đang chọn không tải lại. Nút `Kiểm tra / tạo lại` và `Mở lại hạn ký cọc` khoá bằng ref. `Đang mở…` luôn được tắt.
9. Mã người dùng lấy từ `GET /users/me/profile` (web: phiên Keycloak / Redux).
10. Cuộn tới văn bản không xét "giảm chuyển động". Màn hồ sơ cọc: liên kết `Hợp đồng đi thuê/cho thuê` thay màn hiện tại (replace).
11. Giữ nguyên theo web dù đáng lưu ý: đếm ngược trên thẻ theo `serverNow`, còn phiếu chuyển khoản xét hết hạn theo giờ máy (WB-5); WB-3; câu `…theo thông tin bên cạnh` (trên điện thoại nằm bên dưới). Phiếu chuyển khoản web KHÔNG có nút xác nhận/từ chối: hai thao tác này ở thẻ khoản và xem nhanh.

## Gắn component (khả năng truy cập từ app)

| Component | Đang được gắn | Chủ khác cần gắn |
|---|---|---|
| RentalOnboardingPanel | A: `RentalRequestDetailModal` | C: `{rentalRequestId, isLandlord, sections, onUpdated, onSnapshot, onNavigate}` |
| RentalPaymentModal | A: `RentalRequestsScreen`; B: OnboardingPanel, WorkflowPanel | — |
| Quick view + 2 notice, AgreementDocumentActions | A | C: AgreementDocumentActions `{contract, perspective, showPrimary?, showDetails?, onNavigate}` |
| DepositAgreementPanel | B: OnboardingPanel | C: `{rentalRequestId, isLandlord, onUpdated?, onNavigate}` |
| RentalWorkflowPanel `cancellation` | B: OnboardingPanel (section `end`) | — |
| RentalWorkflowPanel `early-exit` | **chưa nơi nào** | C: `{rentalRequestId, kind: 'early-exit', contractId, onUpdated, onNavigate}`; landing thêm `focusRequest`, `agreementId` |
| WorkflowDocumentsPanel | B: WorkflowPanel early-exit | — |
| ReservationWorkspaceScreen | route `reservation` trong `RentalNavigator`; chỉ deep link tạo route này và deep link chưa nối vào thông báo | Pha 3 (web cũng không có liên kết tới trang này, WB-7) |

Prop export của stub giữ nguyên, không thêm prop nào.

## Thiếu trong file đóng băng

- `ModalShell`: không đặt được nhãn đọc màn hình cho nút đóng.
- `ActionButton`: không có `accessibilityState.selected` → B dùng `ChoiceButton` trong `onboarding/common.tsx`.
- `AppCalendar`/`DateField`: không đặt được nhãn chuyển tháng, nhãn ngày, tháng mở đầu.

## Kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | chỉ còn 2 lỗi trong file của A (`RentalRequestsScreen.tsx:11, :372`), A đang viết song song |
| eslint + prettier file của B | 0 lỗi, 0 cảnh báo, đúng định dạng |
| `node --test tests/rental-onboarding.test.cjs` | 18/18 |
| `test:rental-logic` / `rental-nav` / `rental-api` / `rental-ui` / `theme` | 28/28 · 11/11 · 15/15 · 9/9 · 5/5 |

Đề xuất cho chủ `package.json`: `"test:rental-onboarding": "node --test tests/rental-onboarding.test.cjs"`.

## Chưa kiểm

Chưa chạy trên thiết bị: giao diện, Modal chồng nhau, chọn/chụp/tải tệp (HEIC), sao chép (`expo-clipboard` là module native, phải build lại app trước khi chạy), chia sẻ QR, mở trình duyệt, lịch, đồng bộ realtime/poll, `new Date()` với Instant nhiều chữ số trên Hermes (đếm ngược và quyền trả tiền dựa vào nó).

## Sửa sau review

Theo `review-B-codex.md`. Đường dẫn tính từ `src/components/rental/`; test ở `tests/rental-onboarding.test.cjs`.

| Mã | Đã đổi | File |
|---|---|---|
| RB-01 | Khoá gửi từ lúc mở bộ chọn đến khi xử lý xong hoặc huỷ (prop tùy chọn `onPickingChange`). Ô chọn đã gỡ thì bỏ kết quả đến muộn và trả khoá; phiếu đã đóng thì không bắt đầu upload. Áp cho phiếu chuyển khoản và bằng chứng đề nghị hủy. | `shared/EvidencePicker.tsx`, `onboarding/{logic.ts,PaymentProofForm.tsx,RentalPaymentModal.tsx,RentalWorkflowPanel.tsx}` |
| RB-02 | `flow.bind(payment.id)`: ID đã tải đổi thì đóng form, xoá tệp, bỏ kết quả upload/gửi đang chạy; không chọn hoặc gửi tệp cho ID khác. **KHÁC WEB** (web cùng lỗi): chốt an toàn được phép làm, chờ người dùng xác nhận. | `onboarding/{logic.ts,RentalPaymentModal.tsx}` |
| RB-09 | Prop tùy chọn `replace`: mỗi lần chọn thành công thay cả danh sách, tối đa 5 tệp mỗi lần; `ack` đặt lại như web (đã có sẵn). Mặc định vẫn cộng dồn. | `shared/EvidencePicker.tsx`, `onboarding/RentalWorkflowPanel.tsx` |
| RB-12 | Accordion dựng lại khi trạng thái "có `REQUESTED`" đổi (như `<details open>` của web: có thì mở, hết thì đóng); người dùng vẫn tự đóng/mở. | `onboarding/RentalOnboardingPanel.tsx` |
| RB-13 | Bỏ thông báo đã lưu sau khi bảng chia sẻ đóng; giữ nhãn `Tải mã QR`. | `onboarding/RentalPaymentModal.tsx` |

Kiểm sau khi sửa: `tsc --noEmit` sạch; eslint + prettier file đã sửa sạch; `rental-onboarding` 26/26, `rental-ui` 9/9. Phần nối màn hình của RB-02/09/12/13 chỉ kiểm bằng đối chiếu mã nguồn; chưa chạy trên thiết bị.

## Sửa sau đối chiếu

Theo `audit-B-codex.md` (bảng KHÔNG khớp). Không sửa: B-001..005/B-030 (web cũng không có điểm vào trong giao diện; tới được bằng deep link), B-012 (dấu phân cách do locale của trình duyệt), B-017 (phím mũi tên bàn phím ngoài).

| Mã | Đã đổi |
|---|---|
| B-013 | `NextActionCard`: actor `SYSTEM` quay cả khi thẻ chỉ có `fallbackMessage` (`ActivityIndicator`). |
| B-014 | `ActionButton`/`CardAction` có `link`: `ContractPage` (hồ sơ liên quan, hóa đơn, cọc) và `Mở hồ sơ thanh toán & quyết toán →` đọc là liên kết khi đang bật. Còn `Xử lý ngay` ở `ReservationWorkspaceScreen` (web cũng là `href`; ngoài phạm vi file được sửa). |
| B-026 | Khối tải có `accessibilityRole="progressbar"` như `PageSkeleton`. |
| B-110 | Lấy mã người xem trước, rồi mới mount phiếu với key `người xem:yêu cầu:khoản`. Trong lúc chờ không vẽ gì (như web). Không lấy được mã: báo lỗi và gọi `onClose` để mở lại được, không còn phiếu trống. |
| B-122 | Nút `Sao chép toàn bộ` có `accessibilityHint` nguyên văn mô tả web. |
| B-142 | Tải QR: đóng phiếu thì không mở bảng chia sẻ/trình duyệt, không đổi state (tệp tạm vẫn xoá). Sao chép: không báo sau khi đóng. `EvidencePicker`: đã gỡ thì không mở hộp quyền/camera, không `setPicking`. |
| B-200 | Accordion đề nghị hủy hiện `+`/`−` (`Accordion plusMinus`). Hộp chấm dứt sớm: nút chữ `Đóng`, nhãn `Đóng cửa sổ chấm dứt sớm` (`ModalShell closeText`), vẫn khoá khi `busy`. |
| B-203 | `createCoalesced` có tham số tùy chọn `defer`: app ở nền thì không chạy lượt GET tiếp theo; `RentalWorkflowPanel` giữ lại và chạy khi app về `active`. Nơi gọi khác không đổi. |
| B-209 | Bằng chứng đề nghị hủy kiểm thêm đuôi tên tệp như web (`EvidencePicker namePattern`), giữ thông báo và xoá lựa chọn. Tên được kiểm sau khi chuẩn hóa: ảnh JPEG vẫn được đổi đuôi `.jpg` như trước (cần cho HEIC đã chuyển mã). |
| B-210 | `AppCalendar` thêm prop tùy chọn `range` (`DateField onlyAvailable`): tô ngày hợp lệ, mở tháng của ngày đã chọn hoặc ngày hợp lệ đầu, chuyển tháng chỉ trong khoảng (nút `Tháng trước`/`Tháng sau`), ẩn ngày ngoài tháng. Thư viện lịch không có giới hạn chuyển tháng nên khi có `range` dùng thanh tháng riêng. Không truyền `range` thì như cũ (đặt lịch hẹn, bộ lọc ngày, tạm tính, yêu cầu thuê). |

Kiểm: `tsc --noEmit` sạch; eslint + prettier file đã sửa sạch; `rental-onboarding` 30/30, `rental-ui` 12/12, `rental-contract-detail` 15/15, `appointment` 11/11, `appointment-booking` 20/20, `theme` 5/5. Test của `AppCalendar` không dựng thư viện lịch thật; phần nối màn hình kiểm bằng đối chiếu mã nguồn. Chưa chạy trên thiết bị (lịch có `range`, nút `Đóng`, trình đọc màn hình, đóng phiếu khi đang tải QR/chọn tệp, về nền giữa hai lượt tải).
