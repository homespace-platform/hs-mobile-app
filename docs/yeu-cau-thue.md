# Luồng Yêu cầu thuê → Hợp đồng → Thanh toán (port web → mobile)

> File tiến độ dùng chung cho mọi phiên/agent. **Đọc file này trước khi làm**, cập nhật ngay sau mỗi bước.
> Nguyên tắc: web `hs-web-app` là chuẩn duy nhất. Không tự nghĩ workflow; mọi hành vi, điều kiện, chuỗi tiếng Việt, API đều phải trỏ được về file:dòng của web. Chỗ nào mobile buộc phải khác (thiết bị) thì ghi vào mục "Khác web" và chờ user duyệt.

Trạng thái: **XONG Pha 1 — DỪNG, chờ user duyệt để sang Pha 2** (25/11/2026). Pha 2: tối đa 2 agent cùng lúc; mỗi agent ghi tiến độ sớm.

**Quy tắc cho mọi agent:** model Sonnet; dùng skill `ui-ux-pro-max` khi làm UI (đẹp, gọn trên điện thoại) nhưng nội dung/luồng/chuỗi giữ đúng web; tuân `hs-mobile-app/AGENTS.md` (token màu semantic, `@/components/Icon`, `useDialog`); không commit; không sửa `hs-web-app`/backend; chỉ sửa file mình sở hữu.

**Cổng duyệt (user yêu cầu 25/11):** xong mỗi pha thì DỪNG, báo cáo cho user, cập nhật file này; chỉ sang pha sau khi user cho phép.

**Quyết định đã chốt (user duyệt kế hoạch 25/11):** Q1 PDF xem trong app bằng thư viện native (build lại app), DOCX tải về mở bằng app của máy · Q2 bỏ chế độ "tải minh chứng từ điện thoại qua QR", chọn ảnh/tệp trực tiếp · Q3 web lệch backend → mobile theo web, ghi lại · Q4 đã commit (HEAD 881ea2b).
**Mục tiêu nghiệm thu:** full luồng cho cả chủ nhà và người thuê, từ gửi yêu cầu thuê → giữ chỗ/cọc → ký hợp đồng → vòng đời (hoá đơn, gia hạn, phụ lục, chấm dứt) → kết thúc (quyết toán, hoàn cọc, khiếu nại).

---

## 1. Phạm vi (rà từ menu Dashboard web)

Luồng nối tiếp:

```
Chi tiết nhà ──"Yêu cầu thuê nhà"──▶ Yêu cầu thuê (PENDING)
   │                                   │ chủ nhà duyệt / từ chối / hết hạn / huỷ
   ▼                                   ▼
"Yêu cầu đã gửi" (khách)      "Yêu cầu thuê" (chủ nhà)
                                       │ ACCEPTED → giữ chỗ + onboarding
                                       ▼
        Thoả thuận đặt cọc → Thanh toán cọc/tiền đầu (chuyển khoản + minh chứng → xác nhận)
                                       ▼
        Hợp đồng: DRAFT → PENDING_REVIEW → ký chủ nhà → ký khách (SmartCA) → ACTIVE
                                       ▼
        Hoá đơn hằng tháng → quá hạn / gia hạn / chấm dứt → hết hạn → quyết toán & hoàn cọc → khiếu nại
                                       ▼
                         "Lịch sử thanh toán" (biên lai)
```

| Menu web | Route web | Vai trò | Điểm vào code web |
|---|---|---|---|
| (nút trên chi tiết nhà) | `/rent/[slug]` | khách | `components/rent/RentDetailView.tsx` → `rental-request/RentalRequestModal.tsx` |
| Yêu cầu thuê | `/dashboard/rental-requests` | chủ nhà | `RentalRequestsManagement mode="RECEIVED"` |
| Yêu cầu đã gửi | `/dashboard/rental-requests/my-requests` | khách | `RentalRequestsManagement mode="SENT"` |
| Hợp đồng cho thuê / đi thuê | `/dashboard/{landlord,tenant}/contracts[/id]` | cả hai | `contract/ContractListView.tsx`, `contract/ContractDetailView.tsx` |
| (giữ chỗ trước hợp đồng) | `/dashboard/tenant/contracts/reservations/[rentalId]` | khách | `contract/RentalReservationWorkspace.tsx` |
| Lịch sử thanh toán | `/dashboard/invoices[?contract=]` | cả hai | `dashboard/invoices/PaymentReceiptsPanel.tsx` |
| Khiếu nại (từ hợp đồng/thông báo) | `/dashboard/complaints?requestId&complaintId` | cả hai | `complaint/ComplaintPanel.tsx` |
| URL cũ (redirect) | `/dashboard/contracts`, `/dashboard/invoices/[contractId]`, `/invoices/receipts` | — | chỉ cần ánh xạ deep link |

Đồ thị import từ các điểm vào: **180 file, ~20.300 dòng** (gồm ~13k dòng riêng của luồng). Lớn nhất: `RentalPaymentModal` 1231, `RentalRequestModal` 1200, `ContractDetailView` 742, `MonthlyInvoicesSection` 484, `ContractPdfViewerContent` 458.
API: ~105 lệnh gọi trong 13 service (`rental-request` 11, `rental-onboarding` 12, `rental-workflow` 5, `deposit-agreement` 3, `rental-request-review` (AI) 2, `contract` 21, `contract-amendment` 10, `contract-blockchain` 3, `contract-lifecycle` 2, `monthly-invoice` 18, `payment-request` 9, `payment-receipt` 4, `complaint` 5) + `storage`, `bank-account`.

**Ngoài phạm vi** (không có trong menu, không được link): `/dashboard/payments`, `/deposit`, `/withdraw`, `/transactions` (trang trống). Dashboard tổng quan tenant/landlord: chỉ làm phần thẻ "bước tiếp theo" nếu nó thuộc luồng — xác nhận ở Pha 0.

**Mobile hiện có (sẽ thay thế, không vá):** phần yêu cầu thuê/hợp đồng/thanh toán dạng chung trong `ManagementScreen.tsx` (1066 dòng) + `managementApi.ts` (688), `RentalRequestForm.tsx` (521), `BillingScreen.tsx` (638), một số hàm trong `bookingApi.ts`. Màn chi tiết nhà đang hiện dialog "đang phát triển" cho "Yêu cầu thuê nhà".

---

## 2. Quyết định cần user chốt trước khi code

| # | Vấn đề | Đề xuất |
|---|---|---|
| Q1 | **Xem PDF/DOCX hợp đồng**: web dùng `react-pdf` + `docx-preview` hiển thị ngay trong trang. Android WebView không tự hiển thị PDF. | (a) thêm thư viện xem PDF native (cần build lại app) — giống web nhất; (b) tải file rồi mở bằng ứng dụng xem của máy — không thêm native nhưng rời app. **Đề xuất (a) cho PDF, (b) cho DOCX.** |
| Q2 | **Minh chứng chuyển khoản**: web có chế độ "tải từ điện thoại" (hiện mã QR để quét bằng điện thoại). Trên mobile, máy chính là điện thoại. | Bỏ chế độ này trên mobile, chọn ảnh/tệp trực tiếp (giữ nguyên upload session API). |
| Q3 | **Web và backend lệch nhau** (sẽ liệt kê ở Pha 0) | Mobile làm theo web như module Đặt lịch, ghi lại để sửa riêng. |
| Q4 | Thứ tự làm | Pha 0 → 1 → 2 (song song) → 3, mỗi pha user duyệt kết quả rồi mới sang pha sau. |

---

## 3. Kế hoạch theo pha (chia sub-agent)

**Điều kiện trước:** commit phần Đặt lịch xem và phần gọi video đang lẫn trong `hs-mobile-app` (40 file chưa commit), để luồng này có diff sạch.

### Pha 0 — Kiểm kê (1 agent, chỉ đọc + viết tài liệu)
- Đọc toàn bộ 180 file web theo đồ thị import + controller/DTO `hs-core-api` tương ứng.
- Viết checklist đối chiếu `docs/yeu-cau-thue-parity.md`: mỗi tính năng/trạng thái/nút/điều kiện/chuỗi/validation/toast/API/empty-loading-error/deep link/realtime là **một dòng có ID**, kèm `file:dòng` web, trạng thái mobile hiện tại, và module sở hữu (F/A/B/C/D).
- Ghi các chỗ web ↔ backend lệch nhau (W1…), và actionPath thông báo nào mở màn nào.
- **Kết quả:** checklist đầy đủ để user duyệt. Không sửa code.

### Pha 1 — Nền tảng (1 agent)
- `src/types/` + `src/services/` cho đủ ~105 API, cùng endpoint/params/body/xử lý lỗi như web (test so request mobile vs web như module Đặt lịch).
- Port nguyên văn các lib thuần: `rental-labels`, `rental-request-presentation`, `rental-request-actions`, `invoice-list`, `invoice-status`, `payment-module`, `payment-transfer-presentation`, `contract-routes`, `contract-*`, `rental-*`, `vnd-input`, `nextStep`, `timeline`, các helper `rental-request*.helper` — có test so với module web.
- Khung điều hướng: các màn rỗng + route trong `App.tsx`/menu Quản lý, ánh xạ deep link thông báo → màn mobile.
- Component dùng chung: ModalShell/bottom sheet, ActionDialog, PolicyNotice, DetailTabs, NextActionCard.
- Bảng sở hữu file cho Pha 2.

### Pha 2 — Màn hình (4 agent song song, mỗi agent chỉ sửa file của mình)
| Agent | Phần | File web chính |
|---|---|---|
| **A — Yêu cầu thuê** | Form gửi yêu cầu từ chi tiết nhà (ước tính chi phí, chính sách giữ chỗ, giới hạn người ở); danh sách SENT/RECEIVED, lọc, thẻ, chi tiết, duyệt/từ chối/huỷ, xung đột, AI review | `RentalRequestModal`, `RentalRequestsManagement`, `RentalRequestCard/DetailModal/Dialogs/Filters/AiReviewModal`, `useRentalRequestList/Sync/DeepLink` |
| **B — Giữ chỗ & cọc** | Workflow/onboarding sau khi duyệt, thoả thuận cọc, thanh toán cọc/tiền đầu (QR ngân hàng, minh chứng, báo đã chuyển, xác nhận/từ chối), đổi ngày bắt đầu, phí cuối kỳ | `RentalWorkflowPanel`, `RentalOnboardingPanel`, `OnboardingStepper/PaymentCard`, `DepositAgreementPanel`, `RentalPaymentModal`, `RentalDepositQuickViewModal`, `RentalStartChangeQuickModal`, `EarlierStart`, `EndOfPeriodCharges`, `WorkflowDocumentsPanel`, `RentalReservationWorkspace` |
| **C — Hợp đồng** | Danh sách, chi tiết theo tab (Tổng quan/Thanh toán/Kết thúc/Lịch sử), các section, ký (SmartCA), xem PDF, phụ lục/sửa đổi, vòng đời, blockchain proof, đồng bộ tin | `ContractListView`, `ContractDetailView`, `contract/page/*`, `contract/detail/*` (trừ phần hoá đơn) |
| **D — Hoá đơn & thanh toán** | Hoá đơn tháng (lập, phát hành, quá hạn, gia hạn, hoãn, chấm dứt đơn phương), quyết toán & hoàn cọc, Lịch sử thanh toán, biên lai, khiếu nại | `MonthlyInvoicesSection`, `OverdueActionsPanel`, `PaymentExtensionPanel`, `SettlementPaymentPanel`, `UnilateralTerminationPanel`, `DepositSettlementPanel`, `PaymentReceiptsPanel`, `PaymentReceiptActions`, `ComplaintPanel` |

### Pha 3 — Tích hợp & nghiệm thu (tôi làm, không giao agent)
- Nối luồng xuyên module (yêu cầu → giữ chỗ → hợp đồng → hoá đơn → lịch sử), deep link từ thông báo, tự làm mới khi có thông báo.
- **Tự đối chiếu từng dòng checklist với code** (không dựa vào báo cáo agent — bài học module Đặt lịch: một mục "có" nhưng màn không mở được).
- Xoá code cũ bị thay thế; chạy toàn bộ test, `tsc`, eslint, build bundle Android.
- Kịch bản thử trên máy với 2 tài khoản cho user.

---

## 4. Tiến độ

| Pha | Trạng thái | Ghi chú |
|---|---|---|
| Kế hoạch | ✅ xong | user duyệt 25/11 |
| Điều kiện trước (commit) | ✅ | HEAD 881ea2b |
| 0 — Kiểm kê | ✅ | 737 mục: A 178 · B 164 · C 241 · D 154 → `docs/yeu-cau-thue/parity-{A,B,C,D}.md` |
| 1 — Nền tảng | ✅ | API 126/126 hàm · logic 62 module · UI kit `components/rental/shared` · điều hướng + deep link + đồng bộ realtime · PDF viewer (chưa màn nào import) · tự kiểm: tsc sạch, 20/20 script test pass, eslint 0 lỗi, Android assembleDebug OK (agent chạy) |
| 2A — Yêu cầu thuê | ☐ | |
| 2B — Giữ chỗ & cọc | ☐ | |
| 2C — Hợp đồng | ☐ | |
| 2D — Hoá đơn & thanh toán | ☐ | |
| 3 — Tích hợp & nghiệm thu | ☐ | |

## 5. Nhật ký
- 25/11: rà menu + đồ thị import web (180 file), kiểm kê mobile hiện có, lập kế hoạch.

- 25/11 15:xx: Pha 0 xong A (A-001…A-177, WA-1…18), B (164 dòng `B-0xx`, 31 API, WB-1…15).
- 25/11: D hết hạn mức 5 giờ ở bước rà cuối, nhưng `parity-D.md` đã đủ 8 mục (D-001…D-190, 154 dòng, WD-1…19). C bị dừng trước khi ghi file; agent đó không chạy tiếp được → cần user cho tạo agent mới.
- Lưu ý khi sang Pha 1: (1) `hs-mobile-app` lại có thay đổi chưa commit của phần chat media (có cả `storageApi.ts` mà luồng này sẽ dùng lại) → commit trước; (2) cần thư viện xem PDF native (và có thể `expo-clipboard`) → build lại app; (3) WB-1: tiền tố `/api/v1` của `PaymentRequestController` chưa kiểm được cơ chế (web đang chạy được).

- 25/11: C chạy lại bằng agent mới và xong (C: 241 mục, 36 API, WC-1…9). Đã kiểm: 4 file đủ mục, không trùng ID, đường dẫn web được trích đều tồn tại. Chưa đối chiếu nội dung từng dòng với web.

### Duyệt trước Pha 1 (user cho phép sang Pha 1, 25/11 20:2x — áp dụng theo đề xuất)
- Thư viện xem PDF: đề xuất `react-native-pdf-renderer@2.3.0` (cần build lại native, ghim bản; 1 maintainer). Phương án B: `react-native-pdf` + config plugin + `react-native-blob-util` 0.24.x. Pha 1 phải build Android và mở thử 1 PDF đã ký thật trước khi viết UI xem PDF.
- Trình xem PDF trên mobile bỏ: xoay, xem từng trang, "mở tab mới", bật/tắt toàn màn hình.
- Nghi lỗi backend (đọc code, CHƯA tái hiện): WC-1 chủ nhà có thể kẹt ở `LANDLORD_SIGNATURE_PENDING` nếu VNPT từ chối ngay (web chỉ cho ký ở `DRAFT`); WC-2 web mời ký lại sau lỗi nhúng chữ ký PDF nhưng backend từ chối.
- Commit thay đổi chat media đang dở (có `storageApi.ts`) trước Pha 1.

### Pha 1 — bố cục & sở hữu file
- Kiểu dữ liệu: `src/types/rental/*.type.ts` (sao chép nguyên văn từ web).
- API: `src/services/rental/<tên web>.service.ts`, giữ nguyên kiểu export như web. Logic thuần: `src/lib/rental/<tên web>.ts`.
- Tiến trình khác ĐANG sửa chat media trong repo (chat-threads, chat*, realtime/*, storageApi, MessagesScreen, ConversationDetailScreen) → không đụng.

### Việc bắt buộc ghi nhớ cho Pha 2/3
- Pha 2 (OnboardingPaymentCard): quy tắc nút trả/nhận/duyệt ở `OnboardingPaymentCard.tsx:31-43` KHÔNG có trong danh sách logic thuần → port cẩn thận kèm test.
- Pha 3: dọn file PDF hợp đồng/biên lai trong cache app khi đăng xuất (dữ liệu nhạy cảm).
- Pha 3: gỡ phần rental cũ trùng trong `bookingApi`, `managementApi`, `billingApi`.

- 25/11: Pha 1 xong. Sau build của agent đã cài thêm `expo-clipboard` (web có nút sao chép: RentalPaymentModal.tsx:261,276) → CHƯA build thử lại sau khi thêm. Bảng sở hữu file Pha 2: `yeu-cau-thue/phase1-nav.md`. Props UI kit: `phase1-ui.md`. Ánh xạ import logic: `phase1-logic.md`. API: `phase1-api.md`.
- Trước khi thử Pha 2 trên máy: build lại app (`npm run run:android`) vì có 2 thư viện native mới (`react-native-pdf-renderer@2.3.0`, `expo-clipboard`).
- Chờ duyệt: câu web "Có thể in bằng thanh công cụ PDF." không đúng trên mobile (đề xuất bỏ câu này).
- Chưa nối thông báo → màn mới (Pha 3). Thanh toán qua `paymentId`: làm theo web (chỉ so khớp trong danh sách của mình).

## 6. Khác web (đã duyệt)
_(trống)_
