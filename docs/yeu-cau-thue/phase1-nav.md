# Pha 1c-điều hướng — route, deep link, đồng bộ, trình xem PDF, sở hữu file Pha 2

Trạng thái: **XONG phần code** (chưa thử trên thiết bị). Kết quả build Android: xem mục 7.

## 1. Mô hình route (`src/lib/rental-nav/routes.ts`)

`RentalRoute` dùng nguyên object của `lib/rental/contract-routes` (nên kết quả `primaryAction`, `paymentLink`, `contractLandingTarget`, `paymentModulePath` đưa thẳng vào `onNavigate`). Tên trường theo code đã port: `side` (không phải `perspective`), `invoice` (không phải `invoiceId`).

| `screen` | Trường | URL web | Màn (chủ) |
|---|---|---|---|
| `rental-requests` | `mode: RECEIVED\|SENT`, `requestId?`, `invalidLink?` | `/dashboard/rental-requests[/my-requests][?requestId=]` | `RentalRequestsScreen` (A) |
| `contract-list` | `side`, `kind?: LEASE\|DEPOSIT` | `/dashboard/{side}/contracts?kind=` | `ContractListScreen` (C) |
| `contract-detail` | `side`, `contractId`, `tab?`, `section?`, `invoice?` | `/dashboard/{side}/contracts/<id>` | `ContractDetailScreen` (C) |
| `contract-landing` | `contractId`, `tab?`, `section?`, `invoice?` | `/dashboard/contracts/<id>` | `ContractLandingScreen` (C) |
| `invoice-landing` | như trên | `/dashboard/invoices/<contractId>` | không có màn: `navigateStack` đổi ngay thành `contract-landing` (tab `payment`) |
| `reservation` | `side`, `rentalId` | `/dashboard/tenant/contracts/reservations/<rentalId>` | `ReservationWorkspaceScreen` (B) |
| `payment-history` | `side`, `contractId?` | `/dashboard/invoices[?contract=]` | `PaymentHistoryScreen` (D) |
| `complaint` | `requestId`, `complaintId` | `/dashboard/complaints?requestId&complaintId` | `ComplaintScreen` (D) |
| `payment-lookup` | `paymentId` | `/dashboard/payments?paymentId=` | `PaymentLinkScreen` (D) |
| `link-error` | `message`, `contractListSide?` | thông báo lỗi liên kết của web | vẽ trong `RentalNavigator` |

Parity A–D không có trang nào khác; phần còn lại là modal/tab trong các màn trên (chi tiết yêu cầu, AI review, phiếu chuyển khoản, xem nhanh, PDF).

### Navigator

- `src/screens/rental/RentalNavigator.tsx`: state + vẽ theo điều kiện như `App.tsx`. Stack (`rentalStack`) nằm trong `App.tsx` nên còn nguyên khi mở trang bài đăng rồi quay lại. Bấm tab Quản lý hoặc `openManagement` (đường cũ) xoá stack.
- `onNavigate(route)` = push; `onNavigate(route, { replace: true })` = `router.replace` (đổi tab, đổi `kind`, xoá `requestId`, landing chuyển tiếp). `onBack()` = pop; hết stack thì về menu Quản lý.
- Đổi `tab/section/invoice/kind/requestId` bằng `replace` **không** remount màn. Chỉ màn trên cùng được mount: quay lại thì màn dưới tải lại (giữ được bộ lọc nào đã nằm trong route).
- Nút Back Android thuộc `ScreenHeader` của màn: **mọi màn phải vẽ `ScreenHeader`** ở mọi trạng thái (loading, lỗi). Màn có bản nháp chưa lưu tự hỏi (`useActionDialog`) rồi mới gọi `onBack`.
- Đã nối: menu/overview Quản lý "Yêu cầu thuê", "Yêu cầu đã gửi", "Hợp đồng cho thuê", "Hợp đồng đi thuê", "Lịch sử thanh toán" (2 vai). **Chưa đổi**: chạm thông báo, lối tắt Home, đường vào `ManagementScreen` cũ (Pha 3).
- Link web ra ngoài luồng: bài đăng → prop `onOpenListing`; `/rent` → `onBrowseListings`; `/settings/bank-accounts` → `openSettings('bank-accounts')`, `/settings/account-security` → `openSettings('profile')` (`@/lib/profile-gate-signal`; kiểm tra đúng mục khi port); KYC → luồng KYC mobile; Etherscan/URL ngoài → `expo-web-browser`; neo `#...` → cuộn bằng ref.

## 2. Deep link (`src/lib/rental-nav/deep-link.ts`)

`rentalRouteFromActionPath(actionPath, role = 'tenant') → RentalRoute | null`. Hàm thuần, **chưa nối vào chạm thông báo** (Pha 3: `null` thì giữ hành vi `notificationTarget` cũ). Web chỉ điều hướng theo `actionPath`; `metadata` chỉ dùng cho đồng bộ (mục 3). `requestId` được giữ (mapper cũ `src/lib/notification.ts` đang bỏ). `role` chỉ dùng ở chỗ web đọc vai đã lưu.

| actionPath | Route |
|---|---|
| `/dashboard/rental-requests[/my-requests]?requestId=<uuid>` | `rental-requests`; không phải UUID → `invalidLink` |
| `/dashboard/contracts/<id>[?tab=sign\|end\|content]` | `contract-landing` |
| `…#monthly-invoices` | `contract-landing` `tab=payment&section=monthly` |
| `/dashboard/invoices/<cid>?section=monthly[&invoice=]` (INVOICE_*, đơn phương chấm dứt) | `contract-landing` `tab=payment&section=monthly&invoice=` (`first-rent:<id>` hợp lệ; invoice hỏng giữ nguyên để hiện "không tìm thấy") |
| `/dashboard/invoices/<cid>?section=deposit` (SETTLEMENT_*, LEASE_CLOSED) | bước 1: `contract-landing` `section=deposit`; bước 2 (`ContractLandingScreen`): `contractLandingTarget` → HĐ cọc `tab=payment`, không có → HĐ thuê `tab=end` |
| `/dashboard/payments?paymentId=` | `payment-lookup` (không có `paymentId` → `null`) |
| `/dashboard/complaints?requestId&complaintId` | `complaint` |
| `/dashboard/invoices`, `/dashboard/invoices/receipts` `[?contract=]` | `payment-history` (`contract` sai mẫu bị bỏ) |
| `/dashboard/contracts` | `contract-list` theo `role` |
| `/dashboard/{landlord,tenant}/contracts[?kind=]`, `…/contracts/<id>?tab&section&invoice` | `contract-list`, `contract-detail` |
| `/dashboard/tenant/contracts/reservations/<rentalId>` | `reservation` |
| id sai mẫu (`safeResourceId`; khiếu nại `{0,199}`) | `link-error` với chuỗi web |
| `/operations/…`, URL ngoài, `..`, ký tự lạ, > 500 ký tự, trang không thuộc luồng | `null` |

`ContractLandingScreen` phải đưa **`query`** (không phải cả route) vào `contractLandingTarget`: hàm này trải object nhận được lên kết quả.

## 3. Đồng bộ thời gian thực (`src/lib/rental-sync/`)

Nguồn: `subscribeNotificationEvents` (socket thông báo + push foreground + app trở lại active, cả ba đã có trong `lib/realtime/connections.ts`). `events.ts` (thuần) port `NotificationTransport.tsx`: `notification:new` → `rental-request-changed` / `complaint-changed` / `payment-changed` / `invoice-changed` / `agreement-changed`; `connect` và `notifications:changed` → phát 4 loại không id (khiếu nại không nằm trong "recover", như web).

| Web | Mobile (`@/lib/rental-sync/hooks`) |
|---|---|
| `notificationService.subscribe` + debounce tự viết (MIS, WP, payments) và `useNotificationChangeSync(matches, refresh, enabled)` | `useNotificationChangeSync` (cùng chữ ký) |
| `useAgreementChangeSync(matches, refresh, enabled)` | cùng tên, cùng chữ ký |
| `useRentalRequestSync(refresh, {enabled, requestId, pollMs})` | cùng tên, cùng chữ ký |
| window event `homespace:complaint-changed` | `useNotificationChangeSync(e => e.type === 'complaint-changed' && e.requestId === id, …)` |
| `setInterval` + `visibilityState` (30 s/20 s/15 s/5 s) | `useVisiblePoll(refresh, ms, enabled)`; `isAppVisible()` |
| `useNowMs(ms)` | `useNowMs` |
| `useDetailTab` | `resolveDetailTab(tab, default)` + `onNavigate({...route, tab}, {replace: true})` |

Khác web (nhỏ): `ComplaintPanel` nghe `complaint-changed` qua hook nên được gộp 250 ms (web gọi ngay). Không có bus cục bộ `notify*Changed` vì không component nào trong luồng web tự phát. Socket thông báo tắt khi thiếu `EXPO_PUBLIC_REALTIME_ORIGIN`: khi đó còn push + AppState + poll.

## 4. Hợp đồng prop

Mọi màn có `onBack: () => void` và `onNavigate: RentalNavigate` (`RentalScreenNavProps`). Prop chính xác nằm trong từng file stub (đã chép theo web); thân là "Đang phát triển". **Giữ nguyên prop**; cần đổi thì báo vì có chủ khác dùng.

| Màn | Prop thêm |
|---|---|
| `RentalRequestsScreen` | `mode`, `requestId?`, `invalidLink?`, `onOpenListing(listingId)`, `onBrowseListings()` |
| `ContractListScreen` | `perspective`, `kind` |
| `ContractDetailScreen` | `perspective`, `contractId`, `tab?`, `section?`, `invoice?` (chuỗi thô, tự qua `safeInvoiceSelectionId` như PaymentTab) |
| `ContractLandingScreen` | `contractId`, `query: {tab?, section?, invoice?}` |
| `ReservationWorkspaceScreen` | `perspective`, `rentalId` |
| `PaymentHistoryScreen` | `role`, `contractId?` |
| `ComplaintScreen` | `rentalRequestId`, `initialComplaintId` |
| `PaymentLinkScreen` | `paymentId`: tìm trong `getMyPaymentRequests()` (web không gửi id này lên API), rồi `onNavigate(paymentLink(p, userId).href, {replace: true})`; không thấy → chuỗi `PAYMENT_NOT_FOUND` (`deep-link.ts`) |

### Component dùng chéo chủ (stub, dưới `src/components/rental/`)

| File | Chủ | Ai dùng | Khác prop web |
|---|---|---|---|
| `requests/RentalRequestModal` | A | A (chi tiết bài đăng) | — |
| `onboarding/RentalPaymentModal` | B | A, B (OP, WP); D nếu cần | — |
| `onboarding/RentalDepositQuickViewModal` (+ `RentalReceiptNotice`) | B | A | — |
| `onboarding/RentalStartChangeQuickModal` (+ `StartChangeNotice`) | B | A | — |
| `onboarding/RentalOnboardingPanel` (+ `PanelSection`) | B | A, C | + `onNavigate` |
| `onboarding/DepositAgreementPanel` | B | B, C | + `onNavigate` |
| `onboarding/RentalWorkflowPanel` | B | B, C | + `onNavigate` |
| `onboarding/AgreementDocumentActions` | B | A, C | + `onNavigate` |
| `contract/SmartCaSignaturePanel` | C | B, C | — |
| `contract/ContractPdfViewerModal` | C | B, C | bỏ `portalContainer` |
| `contract/ContractBlockchainProof` | C | B, C | — |
| `billing/MonthlyInvoicesSection` | D | C (PaymentTab) | — |
| `billing/DepositSettlementPanel` | D | C (PaymentTab) | + `onNavigate` |
| `billing/ComplaintPanel` | D | C (EndTab), D | — |
| `billing/PaymentReceiptActions` | D | B, D | — |
| `billing/DepositLedgerSummary` | D | B, D | — |

Stub quick view không có `isOpen` (như web: mount là mở). Component trong `shared/` (xem `phase1-ui.md`) **không port lại**: ModalShell, `useActionDialog`, PolicyNotice, DetailTabs, NextActionCard, OnboardingStepper, EndOfPeriodCharges, RentalCostSummary, VndMoneyInput, DecimalInput, DateField, EvidencePicker, ActionButton, Card/Badge/InfoRow/Accordion, StateBlocks.

## 5. Bảng sở hữu file Pha 2

Quy tắc: mỗi chủ chỉ sửa file/thư mục ở dòng của mình; file mới đặt trong thư mục của mình (kể cả hook/logic mới); test mới là `tests/rental-<thư mục>.test.cjs` (script `package.json` do Pha 3 thêm, chạy bằng `node --test`).

**Đóng băng cho cả 4** (cần sửa thì báo, không tự sửa): `src/lib/rental/**`, `src/lib/rental-nav/**`, `src/lib/rental-sync/**`, `src/services/**`, `src/types/**`, `src/components/rental/shared/**`, `src/components/rental/pdf/**`, `src/screens/rental/{RentalNavigator,placeholders}.tsx`, `src/components/AppDialog.tsx`, `App.tsx`, `ManagementDashboardScreen.tsx`, `ManagementScreen.tsx`, `global.css`, `tailwind.config.js`, `package.json`, `tests/rental-{api,logic,ui,nav}.test.cjs`, và các file chat/realtime đang do tiến trình khác sửa.

| | A — Yêu cầu thuê | B — Giữ chỗ & cọc | C — Hợp đồng | D — Hoá đơn & thanh toán |
|---|---|---|---|---|
| File sở hữu | `screens/rental/RentalRequestsScreen.tsx`; `components/rental/requests/**`; sửa nhỏ `components/listing-detail/ContactCta.tsx` và `screens/ListingDetailScreen.tsx` (mở form) | `screens/rental/ReservationWorkspaceScreen.tsx`; `components/rental/onboarding/**` | `screens/rental/{ContractListScreen,ContractDetailScreen,ContractLandingScreen}.tsx`; `components/rental/contract/**` | `screens/rental/{PaymentHistoryScreen,ComplaintScreen,PaymentLinkScreen}.tsx`; `components/rental/billing/**` |
| Checklist | A-001…A-177 (toàn bộ `parity-A`), thêm B-230 (đã có ở shared, chỉ dùng), B-231, B-233 | B-001…B-229, B-232, B-234…B-242, **trừ** B-070 (nút biên lai là component D), B-100…B-103 (D) | C-001…C-312 (**trừ** C-030 → B; C-146 chỉ gắn `ComplaintPanel`), D-170, D-171 (chữ trong EndTab) | toàn bộ `parity-D` D-001…D-183 **trừ** D-170, D-171; thêm B-100…B-103 |

### File web mỗi chủ port

- **A** (`components/rental-request/`): `RentalRequestModal`, `RentalRequestsManagement`, `RentalRequestCard`, `RentalRequestDetailModal`, `RentalRequestDialogs`, `RentalRequestFilters`, `RentalRequestAiReviewModal`, `RentalContractFallbackButton`, `useRentalRequestList`, `useRentalRequestDeepLink` (phần toast/gọi API), `useRequestContracts`, `useRentalHoldMinutes`; CTA "Yêu cầu thuê nhà" của `components/rent/RentDetailView.tsx`.
- **B**: `rental-request/{RentalOnboardingPanel,OnboardingPaymentCard,RentalPaymentModal,DepositAgreementPanel,RentalDepositQuickViewModal,RentalStartChangeQuickModal,EarlierStart,RentalWorkflowPanel,WorkflowDocumentsPanel}`, `contract/{AgreementDocumentActions,RentalReservationWorkspace}`. Nhớ: luật nút `OnboardingPaymentCard.tsx:31-43` chưa có trong lib, port kèm test.
- **C**: `contract/ContractListView`, `contract/ContractDetailView`, `app/dashboard/contracts/[id]/page.tsx`, `contract/page/{ContractPage,ContractSummary,DraftActionsCard,EndTab,HistoryTab,OverviewTab,PaymentTab,ui,usePolledRead,useOnboardingNextAction}`, `contract/detail/{ContractHeader,ContractPartiesSection,ContractPropertySection,ContractLeaseSection,ContractFinancialSection,ContractAmenitiesSection,ContractChargesSection,ContractEquipmentSection,ContractPoliciesSection,ContractHandoverSection,ContractMissingFieldsNotice,ContractInitialPaymentSection,ContractFieldState,utils,ContractDraftEditor,InlineAmendmentFields,ContractAmendmentPanel,ContractAmendmentWorkspace,AmendmentEffectiveDatePicker,ListingSyncControl,ContractDocumentSection,ContractSignaturePanel,SmartCaSignaturePanel,ContractPdfViewerModal,ContractPdfViewerContent,ContractBlockchainProof}`, và **nhánh `mode="renewal"`** của `ContractLifecyclePanel` → file mới `contract/ContractRenewalPanel.tsx`.
- **D**: `contract/detail/{MonthlyInvoicesSection,OverdueActionsPanel,PaymentExtensionPanel,SettlementPaymentPanel,UnilateralTerminationPanel,InvoiceLineCalculation,MeterReading}`, **nhánh `mode="settlement"`** của `ContractLifecyclePanel` → `billing/ContractLifecyclePanel.tsx` (hai chủ gọi `contractLifecycleService` độc lập, không dùng chung file), `contract/page/DepositSettlementPanel`, `complaint/{ComplaintPanel,ComplaintHistory}`, `payment/{DepositLedgerSummary,PaymentReceiptActions}`, `dashboard/invoices/PaymentReceiptsPanel`, `app/dashboard/invoices/page.tsx`, `app/dashboard/complaints/page.tsx`, `paymentLink` của `app/dashboard/payments/page.tsx`.

### Module lib/service dùng chung (suy từ import của web)

`lib/X` web = `@/lib/rental/X`; service = `@/services/rental/<tên>.service`; logic tách từ `.tsx` = `@/lib/rental/<Component>`; `getApiErrorMessage` = `@/lib/rental/apiError`.

| Chủ | lib | service |
|---|---|---|
| A | `contract-routes`, `rental-labels`, `rental-request-presentation`, `rental-request-actions`, `rental-request.helper`, `rental-request-snapshot.helper`, `rental-occupant-limit`, `rental-contract-fallback`, `RentalRequestModal`, `useRentalRequestList`, `useRentalRequestDeepLink` | rental-request, rental-request-review, rental-onboarding, contract, payment-request |
| B | `agreement-preview`, `contract-document-history`, `contract-routes`, `deposit-agreement-loader`, `payment-transfer-presentation`, `rental-deposit-quick-view`, `rental-start-change-quick-view`, `rental-labels`, `rental-onboarding-read`, `rental-request-presentation`, `rental-request.helper`, `RentalOnboardingPanel`, `OnboardingPaymentCard`, `RentalPaymentModal`, `DepositAgreementPanel`, `RentalWorkflowPanel` | rental-onboarding, rental-workflow, deposit-agreement, payment-request, contract, storage |
| C | `contract-routes`, `payment-module`, `rental-labels`, `rental-onboarding-read`, `contract-*` (amendment, blockchain-proof, document-history, field-state, initial-meters, preview, property-feature-labels), `ContractListView`, `ContractDetailView`, `Contract*Section`, `ContractDraftEditor`, `ContractAmendment*`, `ContractLifecyclePanel`, `nextStep`, `NextActionCard`, `timeline`, `pageData` | contract, contract-amendment, contract-blockchain, contract-lifecycle, deposit-agreement, rental-onboarding, rental-workflow, storage |
| D | `contract-routes`, `payment-module`, `invoice-list`, `invoice-status`, `rental-labels`, `split-sentences`, `payment-link`, `MonthlyInvoicesSection`, `OverdueActionsPanel`, `PaymentExtensionPanel`, `InvoiceLineCalculation`, `MeterReading`, `ContractLifecyclePanel`, `DepositLedgerSummary` | monthly-invoice, payment-receipt, payment-request, complaint, contract, contract-lifecycle, storage |

Thay thế cho hook web: `useAuth` → `@/features/auth/AuthProvider`; `usePermission`/`getGateLock` → `@/lib/use-feature-gate`, `@/lib/permissions`; `toast` → `useDialog`; `AiMarkdownMessage` (A), `ListingPoliciesCard` và `useBanks` (C) chưa được kiểm có bản mobile hay chưa, chủ tự tìm trước khi viết.

## 6. Trình xem PDF (`src/components/rental/pdf/PdfViewerModal.tsx`)

- `react-native-pdf-renderer@2.3.0` (ghim). API đã đọc từ mã đã cài: một component mặc định; prop `source` (đường dẫn file cục bộ), `style`, `distanceBetweenPages`, `maxZoom`, `maxPageResolution` (Android), `singlePage`, `onPageChange(page 0-based, total)`, `onError()` (không kèm thông tin). Không có chọn chữ, tìm, mật khẩu, xoay. Có spec Fabric/codegen (`newArchEnabled=true` của app).
- **Bẫy:** Android làm `new File(source.replace("file://", ""))`, không giải mã `%XX`; iOS dùng `NSURL URLWithString` (cần mã hoá). `saveBase64ToCache` mã hoá tên tệp, nên viewer chỉ `decodeURIComponent` trên Android.
- Props: `{isOpen, onClose, title, subtitle?, source: uri | (signal) => Promise<uri>, documentKey?, loadingText?, errorText?, closeLabel?, shareLabel?}`. Tệp do loader tải về bị **xoá khi đóng**; uri truyền sẵn thì người gọi giữ. Nút chia sẻ dùng `sharePdf`. Dịch vụ rental không nhận `signal` ở mọi hàm; viewer vẫn bỏ kết quả đến muộn và xoá tệp.
  - Hợp đồng (C): `title="Xem hợp đồng: <fileName||PDF>"`, bản ký đủ: `source={async s => blobToCacheFile(await contractService.getDocumentContent(id, false, s), name)}`, `loadingText="Đang kiểm tra và tải PDF đã ký…"`, `errorText="Chưa xác thực được tài liệu. Vui lòng thử lại."`.
  - Biên lai (D): `title="Chứng từ thanh toán"`, `subtitle="<receiptNumber> · …"`, `closeLabel="Đóng bản xem PDF"`, `source={() => paymentReceiptService.pdf(id)}` (câu "Có thể in bằng thanh công cụ PDF." không đúng trên mobile: cần user duyệt chữ).
- **Chưa file nào import.** Bản dev đang cài trên máy chưa có module native. Chỉ C (`ContractPdfViewerModal`) và D (`PaymentReceiptActions`) được import nó, **sau khi** user đã cài bản dev mới.
- Nếu Pha 2 cần thêm module native khác (parity B đề xuất `expo-clipboard`) thì nên thêm trước khi user build lại.

## 7. Kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` (toàn repo) | sạch |
| eslint, prettier file của 1c-nav | sạch |
| `npm run test:rental-nav` | 11/11 |
| `test:rental-logic` / `test:rental-api` / `test:rental-ui` | 28/28 · 15/15 · 9/9 |
| `test:api` / `test:push` | 47/47 · 10/10 |
| `test:theme` | 5/5 |
| `cd android && ./gradlew :app:assembleDebug` | **BUILD SUCCESSFUL** (27 phút 18 giây, 25/11/2026); `PdfRendererPackage` có trong autolinking. APK: `android/app/build/outputs/apk/debug/app-debug.apk` (chưa cài lên máy) |

Chưa kiểm trên thiết bị: điều hướng và nút Back Android; hook đồng bộ với socket/push thật (mới test phần thuần); mở PDF thật (user cần cài bản dev mới, thử 1 PDF đã ký, tên tệp có dấu cách/tiếng Việt); iOS chưa build.
