# Pha 1a — lớp API (`src/services/rental/`)

Trạng thái: **XONG** (chưa thử trên thiết bị). 126/126 hàm service web có bản mobile và được so request/kết quả/lỗi trong `tests/rental-api.test.cjs`.

## Tiến độ

| File | Trạng thái | Export (giống web) | Số hàm |
|---|---|---|---|
| `rental-request.service.ts` | done | default | 11 (+1 mobile) |
| `rental-request-review.service.ts` | done | default | 2 |
| `rental-onboarding.service.ts` | done | `rentalOnboardingService` + types `RentalOnboarding`, `RentalStartChange`, `NextAction`, `NextActionCode` | 12 |
| `rental-workflow.service.ts` | done | `rentalWorkflowService` | 5 |
| `deposit-agreement.service.ts` | done | `depositAgreementService` + `DepositAgreementView` | 3 |
| `contract.service.ts` | done | `contractService` | 23 |
| `contract-amendment.service.ts` | done | `contractAmendmentService` | 10 |
| `contract-blockchain.service.ts` | done | `contractBlockchainService` | 3 |
| `contract-lifecycle.service.ts` | done | `contractLifecycleService` | 7 |
| `monthly-invoice.service.ts` | done | `monthlyInvoiceService` | 18 |
| `payment-request.service.ts` | done | `paymentRequestService` + default | 9 |
| `payment-receipt.service.ts` | done | `paymentReceiptService` + `PaymentReceipt` | 4 |
| `complaint.service.ts` | done | `complaintService` | 4 |
| `storage.service.ts` | done | default | 10 |
| `bank-account.service.ts` | done | `bankAccountService` + default | 7 |

Helper chỉ có ở mobile:

- `client.ts` — bọc `axiosClient`, mặc định `timeout: 0` như web (mặc định mobile 15 s sẽ cắt AI review, kết xuất PDF, SmartCA). Timeout riêng giữ nguyên: preview 95 s, preview-status 10 s. Hệ quả: UI không được giả định request tự hết giờ.
- `files.ts` — `blobText(blob)`, `saveBase64ToCache(base64, fileName) → uri`, `blobToCacheFile(blob, fileName) → uri`, `sharePdf(uri)`.

## Cách UI Pha 2 dùng

Đổi đường import `@/services/<tên>.service` → `@/services/rental/<tên>.service`, `@/types/<tên>.type` → `@/types/rental/<tên>.type`, `@/types/api.type` → `@/types/api`. Khác chữ ký:

| Hàm | Web | Mobile |
|---|---|---|
| `storageService.upload*` (7 hàm) | `file: File` | `file: LocalFile` (`@/services/storageApi`): `{uri, fileName, contentType, sizeBytes}`. `uri` là `file://` (document picker để `copyToCacheDirectory`, mặc định bật). `sizeBytes` bị bỏ qua: dung lượng đọc từ tệp thật. |
| `paymentReceiptService.pdf(id)` | `Promise<Blob>` | `Promise<string>` = URI tệp PDF trong cache (`hoa-don-<id>.pdf`); mở bằng trình xem PDF hoặc `sharePdf(uri)`. RN không dựng được `Blob` từ bytes. |
| `contractService.getDocumentContent`, `complaintService.sourcePdf` | `Promise<Blob>` | Giữ nguyên; muốn xem thì `blobToCacheFile(blob, tên)`. |
| `contractService.downloadDocument` | tải bằng thẻ `<a>` | Ghi cache rồi mở bảng chia sẻ; thiết bị không hỗ trợ → lỗi "Thiết bị chưa hỗ trợ mở hoặc lưu PDF." |
| `rentalRequestService.getReservationPolicy()` | không có (RentalRequestModal gọi axios trực tiếp) | Thêm mới → `{version, text}`. `getPolicy()` dùng cho lời gọi `/policy` trực tiếp còn lại của modal. |

## Khác web (kỹ thuật)

- `getEffectiveDocument`: ngày Việt Nam tính bằng `vnDateKey` (`src/lib/rental/format.ts`, của Pha 1b) thay `Intl` `en-CA`.
- `contract.service` dùng `primaryDocument` từ `src/lib/rental/contract-document-history.ts` (Pha 1b).
- Đọc `Blob` bằng `FileReader` (Blob của RN không có `.text()`).
- Upload presigned PUT bằng `FileSystem.uploadAsync` (như `chatMediaApi`). Chỉ cho Android/iOS; bản Expo web không upload được.
- `bank-account.service` gọi lại `bankAccountApi`; `getViewUrl`/`getPaymentProofViewUrl`/`listUserAvatars` gọi lại `storageApi` (chỉ import). Các lời gọi này giữ timeout 15 s của mobile; `id` được `encodeURIComponent` (không khác với UUID).
- `storageApi.uploadFile` không dùng lại: không có purpose `GENERAL`, khác kiểu trả về và thông báo lỗi.
- `createProofUploadSession`, `getProofUploadSessionStatus` được port cho đủ nhưng UI không dùng (Q2). `contractAmendmentService.options` cũng không có UI web gọi.
- AI review không dùng SSE/stream: hai POST thường.

## Không thuộc lớp này

- `notificationService.subscribe` (RentalWorkflowPanel, useRentalRequestSync, MonthlyInvoicesSection): dựng bus từ `src/lib/realtime/connections.ts` (Pha 1c).
- `appointment.service` (RentDetailView): đã có `appointmentApi`.
- Tải ảnh QR ngân hàng (`fetch(qrImageUrl)` trong RentalPaymentModal) và tải PDF trong trình xem: việc của UI.

## Trùng với code cũ (xoá ở Pha 3, chưa đụng)

| File cũ | Phần trùng |
|---|---|
| `bookingApi.ts` | estimate, reservation-policy, by-listing, tạo yêu cầu thuê |
| `managementApi.ts` | `/payment-requests/mine`, danh sách owner/my-requests, danh sách hợp đồng, chi tiết/duyệt/từ chối/huỷ yêu cầu, onboarding refresh, chi tiết/xác nhận/từ chối/báo chuyển khoản thanh toán, tài liệu hợp đồng |
| `billingApi.ts` | danh sách hợp đồng, hoá đơn tháng, thanh toán theo hợp đồng, biên lai (list/by-payment/PDF/retry), chi tiết thanh toán |

`bankAccountApi.ts` và `storageApi.ts` vẫn được dùng, không xoá.

## Dependency / package.json

- Không cần dependency mới (`expo-file-system`, `expo-sharing`, `expo-crypto` đã có).
- Đề xuất thêm script: `"test:rental-api": "node --test tests/rental-api.test.cjs"`.

## Kiểm tra

| Lệnh | Kết quả |
|---|---|
| `node --test tests/rental-api.test.cjs` | 15/15, so 126/126 hàm web |
| `npm run test:api` | 47/47 |
| `npx tsc --noEmit` | sạch |
| eslint (file của 1a) | 0 lỗi; 2 cảnh báo `import/no-duplicates` có sẵn trong type chép nguyên văn (`contract-lifecycle.type.ts`) |
| prettier (file của 1a) | sạch (`src/types/rental` đã được định dạng lại; khác web duy nhất về nội dung: đường import trong `rental-request.type.ts`) |

## Chưa kiểm trên thiết bị

- `responseType: 'blob'` qua XHR của RN, `new Blob([blob], {type})`, `FileReader` đọc blob, `atob` trên Hermes (test dùng bản của Node).
- PUT presigned bằng `uploadAsync` cho tệp từ image/document picker; URL `localhost` từ storage khi chạy dev Android không được viết lại (giống `storageApi`).
- Bảng chia sẻ PDF trên Android/iOS.
- PDF hợp đồng và biên lai ghi vào cache riêng của app và **không bị xoá chủ động** (kể cả khi đăng xuất) — cần quyết định ở Pha 3.
