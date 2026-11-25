# Parity C — Hợp đồng

Pha 0 (kiểm kê), phần C. Web `hs-web-app` là chuẩn. Chỉ đọc code, không sửa. Ngày 25/11/2026.

## 0. Viết tắt file

Gốc `hs-web-app/`. `D/` = `components/contract/detail/`, `P/` = `components/contract/page/`.

| Mã | File | Mã | File |
|---|---|---|---|
| LV | `components/contract/ContractListView.tsx` | HD | `D/ContractHeader.tsx` |
| DV | `components/contract/ContractDetailView.tsx` | PT | `D/ContractPartiesSection.tsx` |
| LD | `app/dashboard/contracts/[id]/page.tsx` (landing) | PR | `D/ContractPropertySection.tsx` |
| CPG | `P/ContractPage.tsx` | LS | `D/ContractLeaseSection.tsx` |
| SUM | `P/ContractSummary.tsx` | FS | `D/ContractFinancialSection.tsx` |
| DRC | `P/DraftActionsCard.tsx` | AM | `D/ContractAmenitiesSection.tsx` |
| NS | `P/nextStep.ts` | CH | `D/ContractChargesSection.tsx` |
| TL | `P/timeline.ts` | EQ | `D/ContractEquipmentSection.tsx` |
| OV | `P/OverviewTab.tsx` | PO | `D/ContractPoliciesSection.tsx` |
| PAY | `P/PaymentTab.tsx` | HO | `D/ContractHandoverSection.tsx` |
| END | `P/EndTab.tsx` | MF | `D/ContractMissingFieldsNotice.tsx` |
| HIS | `P/HistoryTab.tsx` | IP | `D/ContractInitialPaymentSection.tsx` |
| UI | `P/ui.tsx` | FST / UT | `D/ContractFieldState.tsx` / `D/utils.tsx` |
| PRD / ONA / PD | `P/usePolledRead.ts` / `useOnboardingNextAction.ts` / `pageData.ts` | DE / IAF | `D/ContractDraftEditor.tsx` / `D/InlineAmendmentFields.tsx` |
| AP | `D/ContractAmendmentPanel.tsx` | LSY | `D/ListingSyncControl.tsx` |
| AW | `D/ContractAmendmentWorkspace.tsx` | DS | `D/ContractDocumentSection.tsx` |
| AEP | `D/AmendmentEffectiveDatePicker.tsx` | PVM / PVC | `D/ContractPdfViewerModal.tsx` / `D/ContractPdfViewerContent.tsx` |
| LP | `D/ContractLifecyclePanel.tsx` | SP / SCA | `D/ContractSignaturePanel.tsx` / `D/SmartCaSignaturePanel.tsx` |
| BC | `D/ContractBlockchainProof.tsx` | RL | `lib/rental-labels.ts` |
| CS | `services/contract.service.ts` | CAS / CLS / CBS | `services/contract-{amendment,lifecycle,blockchain}.service.ts` |

Ranh giới: B = `RentalReservationWorkspace`, `AgreementDocumentActions` (B-234), `RentalOnboardingPanel`, `DepositAgreementPanel`, `RentalWorkflowPanel`, `NextActionCard`/`DetailTabs`; D = `MonthlyInvoicesSection`, `DepositSettlementPanel`, `ComplaintPanel`, các panel hoá đơn.

## 1. Màn hình & điểm vào

### 1.1 Route

| Route web | Vai | Render | Mobile đề xuất |
|---|---|---|---|
| `/dashboard/landlord/contracts?kind=LEASE\|DEPOSIT` | chủ nhà | `ContractListView perspective="landlord"` | màn danh sách (menu "Hợp đồng cho thuê", `components/dashboard/dashboard-nav.ts:66`) |
| `/dashboard/tenant/contracts?kind=LEASE\|DEPOSIT` | khách | `ContractListView perspective="tenant"` | menu "Hợp đồng đi thuê" (`dashboard-nav.ts:99`) |
| `/dashboard/landlord/contracts/[id]?tab=&invoice=` | chủ nhà | `ContractDetailView perspective="landlord"` (Suspense + `ContractPageSkeleton`) | màn chi tiết, param `{id, perspective, tab?, invoice?}` |
| `/dashboard/tenant/contracts/[id]?tab=&invoice=` | khách | `ContractDetailView perspective="tenant"` | như trên |
| `/dashboard/tenant/contracts/reservations/[rentalId]` | khách | `RentalReservationWorkspace perspective="tenant"` → handed to B | B |
| `/dashboard/contracts` (cũ) | role lưu, mặc định tenant | redirect về danh sách; chữ `Đang mở danh sách hợp đồng…` | chỉ ánh xạ deep link |
| `/dashboard/contracts/[id]?tab=…` (landing, đích thông báo) | tự suy từ tài khoản | LD | **bộ phân giải deep link** (1.3) |
| `/dashboard/invoices/[contractId]?section=monthly\|deposit&invoice=` (cũ) | — | redirect → `/dashboard/contracts/{id}?tab=payment&section=…[&invoice=]` (`app/dashboard/invoices/[contractId]/page.tsx:16`) | ánh xạ rồi đi qua landing |

Breadcrumb: `Hợp đồng` / `Hợp đồng cho thuê` / `Hợp đồng đi thuê` / `Chi tiết hợp đồng` / `Hồ sơ cọc & nhận nhà` (`components/dashboard/dashboard-breadcrumb.ts:26-43`).

Tab chi tiết (`?tab=`, RL:70-77): `overview` Tổng quan · `sign` Ký số & tài liệu · `payment` Thanh toán & cọc · `end` Hủy / kết thúc · `content` Nội dung hợp đồng · `history` Lịch sử. Tab khả dụng: HĐ cọc = overview, sign, payment, end, history (DV:484); HĐ thuê gốc = đủ 6; HĐ con (`parentContractId`) = overview, sign, content (DV:581). Tab không khả dụng → hiển thị `overview` (CPG:68).

**HĐ cọc vs HĐ thuê** (`ContractResponse.agreementKind`): `DEPOSIT` = hợp đồng cọc giữ phòng: trang chỉ gọi `getContract`, không tải revision/completeness/documents/chữ ký/billing/meter/amendment (DV:142-146), tab sign do panel B lo; `null` + không `parentContractId` = HĐ thuê gốc; `AMENDMENT` = phụ lục (con); `RENEWAL` hoặc con kind `null` = văn bản gia hạn (con); `WORKFLOW` = văn bản trả nhà/chấm dứt sớm (con, chỉ xem/ký qua panel của gốc, DV:470-474, LD:30-47). Liên kết 2 chiều: HĐ thuê có `depositAgreementContractId` (nút "Xem HĐ cọc", B); HĐ cọc → "Mở HĐ thuê liên kết →" (`DepositAgreementPanel:135`, B).

### 1.2 Deep link & thông báo

| Nguồn (`hs-notification-service/src/modules/notification-events/notification-event.ts`) | actionPath | Đích |
|---|---|---|
| `AGREEMENT_*` (REVIEW_READY, SIGNING_TURN, SIGNING_DUE_SOON, FULLY_SIGNED, SIGNATURE_NEEDS_REVIEW; kind LEASE/DEPOSIT/AMENDMENT/RENEWAL/EARLY_EXIT) `:865-877` | `/dashboard/contracts/{agreementId}?tab=sign` (EARLY_EXIT → `?tab=end`) | landing → chi tiết; WORKFLOW early-exit → panel B |
| `AMENDMENT_*` `:878-884` | `/dashboard/contracts/{contractId}?tab=end` (`AMENDMENT_APPLIED` → `?tab=content`) | HĐ thuê gốc |
| `LEASE_RENEWAL_WINDOW_OPENED`, `RENEWAL_*` `:885-890` | `…?tab=end` | gốc |
| `TERMINATION_*`, `LEASE_EXPIRED` `:891-897` | `…?tab=end`; 4 loại đơn phương (`TERMINATION_NOTICE_ISSUED/REVIEW_REQUESTED/REVIEW_APPROVED/NOTICE_CANCELLED`) → `/dashboard/invoices/{id}?section=monthly` | gốc (đơn phương → tab payment, panel D) |
| `LEASE_RETURN_CONFIRMED/COMPLETED` `:898-905` | `…?tab=end` | gốc |
| `SETTLEMENT_*` `:898-905` | `/dashboard/invoices/{id}?section=deposit` | landing → **HĐ cọc** `?tab=payment` → D |
| `INVOICE_*` `:853-864` | `/dashboard/invoices/{id}?section=monthly&invoice={invoiceId}` | tab payment HĐ thuê → D |
| `CONTRACT_AWAITING_SIGNATURE/SIGNED/EXPIRED` (kiểu cũ) `:171-188,912-945` | `/notifications` | không điều hướng |

Link nội bộ vào chi tiết HĐ: `DepositAgreementPanel:135` (B); `RentalRequestsManagement:115,173,297` (A); `app/dashboard/payments/page.tsx:124` "Xem hợp đồng"; trong module: LV, AP:112, DS:89, LP:200, DV:473/677, HIS:315, LD:68/71.

### 1.3 Logic landing (LD + `lib/payment-module.ts:43-53`)

1. Auth chưa init → `Đang xác thực tài khoản…`; chưa đăng nhập → thẻ đăng nhập (C-001).
2. `safeResourceId(id)` (`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`) sai → missing.
3. `GET contracts/{id}`; side = so `userId` với `landlordId`/`tenantId` (không dùng role đang chọn); không khớp hoặc `contract.id!==id` → missing. Lỗi 400/403/404 → missing, lỗi khác → retry.
4. `WORKFLOW`: thiếu `parentContractId` → missing; nếu có `rentalRequestId` và `rentalWorkflowService.documents(rentalRequestId,"early-exit")` có `signingContractId===id` → panel early-exit (B) + link "Mở hợp đồng gốc"; không → thông báo + "Mở hợp đồng gốc".
5. Còn lại `replace(contractLandingTarget(side, contract, search, hash))`: hash `#monthly-invoices` → `?tab=payment&section=monthly#…`; HĐ thuê gốc (không kind, không parent) + `section=deposit` → `{depositAgreementContractId}?tab=payment`, không có → `{own}?tab=end`; khác → giữ nguyên query.

## 2. Bảng vòng đời: trạng thái × vai

Chuỗi chính (BE mặc định `homespace.signature.mode=SMARTCA`, `application.properties:160`): `DRAFT` → (chủ nhà initiate) `LANDLORD_SIGNATURE_PENDING` → `TENANT_SIGNATURE_PENDING` → `ACTIVE` → `EXPIRED` → `CLOSED`, hoặc `TERMINATED` / `CANCELLED`. `PENDING_REVIEW` chỉ có ở chế độ INTERNAL (`DRAFT` —send→ `PENDING_REVIEW` —khách sign→ `ACTIVE`).

### 2.1 Trạng thái × vai (HĐ thuê gốc; khác biệt HĐ cọc ghi riêng)

Nhãn LEASE (RL:26-36); nhãn cọc khác ở `DRAFT` "Chờ chủ nhà ký" (warning), `ACTIVE` "Đã ký đủ", `EXPIRED` "Đã hết hiệu lực" (RL:38-43); status lạ "Đang cập nhật", rỗng "—".

| Status (nhãn, tone) | Chủ nhà: danh sách → chi tiết | Khách: danh sách → chi tiết |
|---|---|---|
| `DRAFT` (Bản nháp, neutral) | nhóm MINE "Bản nháp đang chờ bạn hoàn thiện.", "Mở hồ sơ". preActive; `reviewDraft`: sửa tab content, thanh nổi Lưu/Kết xuất (+đồng bộ bài đăng; INTERNAL thêm "Gửi cho người thuê"); tab sign: checklist, MissingFields, onboarding sign, panel ký (SmartCA: form khi `onboarding.canSign` + PDF sẵn sàng) | WAITING, không gợi ý, hộp "bản đang soạn". BE chỉ cho thấy khi rental ACCEPTED + đã xác nhận cọc/tiền đầu. Chỉ đọc + notice "Bản nháp"; SmartCA: C-245/C-246; đề nghị bắt đầu sớm ở tab payment (B) |
| `PENDING_REVIEW` (Chờ xác nhận, warning; INTERNAL) | WAITING "Đang chờ người thuê."; C-234 | MINE "Cần bạn xem lại và xác nhận."; C-233 checkbox + "Xác nhận ký hợp đồng" khi `signingAllowed` |
| `LANDLORD_SIGNATURE_PENDING` (Chờ chủ nhà ký, warning) | MINE "Đến lượt bạn ký số.", nút "Ký số" → `?tab=sign`; có request pending → C-248/249 (poll 5 s); không pending → C-243/C-246 (xem WC-1). Không còn thanh nổi/sửa nháp | WAITING "Đang chờ chủ nhà."; C-246 "Hợp đồng đang chờ bên còn lại hoàn tất bước ký số." (hoặc C-245 khi chưa đủ điều kiện) |
| `TENANT_SIGNATURE_PENDING` (Chờ người thuê ký, warning) | WAITING "Đang chờ người thuê."; "Chủ nhà đã ký số. Đang chờ người thuê ký cùng bản PDF." | MINE, "Ký số"; form SmartCA (cần `signingAllowed`, PDF READY) → pending → SIGNED → ACTIVE |
| `ACTIVE` (Đang hiệu lực, success) | RUNNING; "Xem hóa đơn" + "Mở hồ sơ". 6 tab, lifecycle poll 30 s, next step 2.2. Tab end: early-exit (B), gia hạn (duyệt/từ chối), phụ lục (soạn/gửi), khiếu nại (D); content: điều khoản đang áp dụng | như chủ nhà; gia hạn (gửi yêu cầu), phụ lục (đề nghị/duyệt/ký) |
| `EXPIRED` (Hết thời hạn thuê, info) | ENDED; "Xem hóa đơn". Tab end: early-exit + phụ lục (BE chặn tạo mới), không gia hạn/khiếu nại; next step quyết toán; hoàn cọc ở HĐ cọc tab payment (D) | như chủ nhà; SmartCA C-240 |
| `CLOSED` (Đã đóng, neutral) | như EXPIRED (vẫn có phụ lục + early-exit); C-240 | như chủ nhà |
| `TERMINATED` (Đã chấm dứt, danger) | ENDED; "Xem hóa đơn"; tab end chỉ early-exit (không phụ lục) | như chủ nhà |
| `CANCELLED` (Đã hủy, neutral) | ENDED "Mở hồ sơ"; vẫn `preActive` (onboarding summary/payments/end/history của B) | như chủ nhà |
| HĐ cọc, mọi status | Trang `preActive` kể cả ACTIVE/CLOSED; 5 tab; nội dung chủ yếu từ panel B (sign: DepositAgreementPanel + onboarding) và D (hoàn cọc); header không có nút tài liệu/thanh nổi. Danh sách: ACTIVE → RUNNING "Đã ký đủ" | như chủ nhà |
| HĐ con (phụ lục/gia hạn) | Không có trong danh sách (BE lọc `parentContractId IS NULL`). 3 tab (overview, sign, content). Next step chỉ khi PENDING_REVIEW/LSP/TSP (`childStep`). DRAFT con: chủ nhà "Kết xuất file" rồi ký SmartCA, `signingAllowed=true` | Mở qua link phụ lục/gia hạn/thông báo; ký khi TSP |

### 2.2 Bước tiếp theo sau hiệu lực (`deriveNextStep`, NS; ưu tiên quyết toán > hoá đơn > ký > đề nghị)

"Mình" = vai phải làm (tone info, trừ ghi danger); "chờ" = tone warning. Hoá đơn mở = DRAFT/UNPAID/OVERDUE; "mở để trả" = paymentStatus ∉ {TRANSFER_REPORTED, CONFIRMED}; nhãn `{L}` = "kỳ {paymentPeriodNumber ?? periodIndex}" hoặc "{n} kỳ"; 1 hoá đơn thì link kèm invoiceId.

| Điều kiện | Chủ nhà | Khách | NS |
|---|---|---|---|
| không closure + EXPIRED + canProposeClosure | "Lập đề xuất hoàn cọc" / "Hết thời hạn thuê: chốt chi phí cuối, bàn giao và đề xuất số tiền hoàn." [Mở hồ sơ hoàn cọc] | "Chờ chủ nhà lập đề xuất hoàn cọc" (+ nếu !allPaid: "Còn hóa đơn chưa hoàn tất: hãy thanh toán để chủ nhà có thể lập đề xuất.") | 31-45 |
| không closure + EXPIRED + !canProposeClosure | "Hợp đồng đã hết thời hạn thuê" / "Hai bên hoàn tất hóa đơn cuối và bàn giao để quyết toán cọc." (neutral) | như trên | 40-45 |
| WAITING_HANDOVER | canPropose: "Lập đề xuất hoàn cọc" / "Đã đủ hóa đơn: nêu khoản khấu trừ (nếu có) và số tiền hoàn."; ngược lại "Đang chờ bàn giao và hoàn tất hóa đơn cuối" / "Cọc được xử lý sau khi bàn giao và thanh toán đủ hóa đơn." | "Chờ chủ nhà lập đề xuất hoàn cọc" | 50-54 |
| PROPOSED | "Chờ người thuê phản hồi đề xuất hoàn cọc" | "Xem và phản hồi đề xuất hoàn cọc" / "Kiểm tra khoản khấu trừ và số tiền hoàn trước khi đồng ý." [Xem đề xuất] | 55-56 |
| DISPUTED | "Đối soát khoản khấu trừ" / "Người thuê chưa đồng ý đề xuất hoàn cọc." [Xem phản hồi] | "Chờ chủ nhà đối soát khoản khấu trừ" | 57-58 |
| REFUND_PENDING chưa báo / đã báo | "Chuyển khoản hoàn cọc cho người thuê" [Mở hồ sơ hoàn cọc] / "Chờ người thuê xác nhận đã nhận tiền hoàn" | "Chờ chủ nhà chuyển khoản hoàn cọc" / "Xác nhận đã nhận tiền hoàn cọc" [Xác nhận] | 59-62 |
| BALANCE_PENDING chưa báo / đã báo | "Chờ người thuê thanh toán khoản còn thiếu" / "Xác nhận đã nhận khoản còn thiếu" [Xác nhận] | "Thanh toán khoản còn thiếu" / "Khoản khấu trừ lớn hơn tiền cọc đang giữ." [Thanh toán] / "Chờ chủ nhà xác nhận khoản còn thiếu" | 63-66 |
| closure CLOSED | không có bước từ closure, xét tiếp hoá đơn | | 67-69 |
| hoá đơn | 1) có TRANSFER_REPORTED: "Xác nhận đã nhận tiền hóa đơn {L}" / "Chỉ xác nhận khi tiền đã vào tài khoản." [Mở hóa đơn]; 2) OVERDUE mở & canResolveOverdue≠false: "Hóa đơn {L} đã quá hạn" / "Chọn hướng xử lý: nhắc thanh toán, dời hạn hoặc các phương án khác." [Xử lý hóa đơn] danger; 3) DRAFT: "Chốt chỉ số cho hóa đơn {L}" / "Nhập chỉ số điện nước để phát hành hóa đơn." [Mở hóa đơn]; 4) "Chờ người thuê thanh toán hóa đơn {L}" (+ nếu có overdue: "Hóa đơn đã quá hạn; các phương án xử lý của chủ nhà mở khi đủ điều kiện, xem ở mục hóa đơn.") | 1) OVERDUE mở: "Hóa đơn {L} đã quá hạn" / "Thanh toán sớm để tránh phí chậm trả và việc xử lý của chủ nhà." [Thanh toán hóa đơn] danger; 2) UNPAID mở: "Thanh toán hóa đơn {L}"; 3) "Chờ chủ nhà xác nhận tiền hóa đơn {L}" | 72-99 |
| phụ lục APPROVED có agreementContractId (người ký = TSP/PENDING_REVIEW → khách, còn lại chủ nhà) | mình: "Ký phụ lục điều chỉnh hợp đồng" / "Xem bản PDF rồi ký số. Chưa ký đủ thì điều khoản cũ vẫn áp dụng." [Mở phụ lục để ký]; chờ: "Chờ người thuê\|chủ nhà ký phụ lục" | đối xứng | 101-106 |
| renewal APPROVED + agreement DRAFT | "Chuẩn bị văn bản gia hạn để ký" / "Mở văn bản gia hạn, kiểm tra nội dung rồi kết xuất PDF để ký số." [Chuẩn bị văn bản] tab end | "Chờ chủ nhà chuẩn bị văn bản gia hạn" | 107-109 |
| renewal APPROVED + agreement chờ ký | "Ký văn bản gia hạn" [Mở văn bản để ký] hoặc "Chờ … ký văn bản gia hạn" | đối xứng | 110-112 |
| renewal REQUESTED | "Trả lời đề nghị gia hạn thuê" / "Người thuê muốn kéo dài thời gian thuê." [Xem đề nghị] | "Chờ chủ nhà trả lời đề nghị gia hạn" | 116-122 |
| phụ lục REQUESTED/TENANT_REQUESTED/CHANGES_REQUESTED | nếu `recipientId==actorId`: "Phản hồi đề nghị điều chỉnh hợp đồng" / "Xem nội dung thay đổi và ngày áp dụng." [Xem đề nghị]; ngược lại "Chờ bên còn lại phản hồi đề nghị điều chỉnh" | như trên | 123-125 |
| HĐ con chờ ký | "Ký số văn bản" / "Xem bản PDF rồi ký trong mục Ký số & tài liệu." [Đi tới ký số] hoặc "Chờ bên còn lại ký" | như trên | 129-132 |

Trước hiệu lực: bước do server (`onboarding.nextAction`), chữ và tab đích theo `describeNextAction` (RL:79-131; B đã kiểm kê nhãn thẻ).

### 2.3 Chuyển trạng thái ở backend (`hs-contract-service`, viết tắt CSI = `service/impl/ContractServiceImpl.java`, SCS = `…/SmartCaSignatureServiceImpl.java`, LCS = `service/ContractLifecycleService.java`)

| Chuyển | Ai / điều kiện | file:dòng |
|---|---|---|
| tạo `DRAFT` | HĐ thuê / cọc / gia hạn / phụ lục / workflow | CSI:274; `deposit/DepositAgreementService.java:202`; LCS:106; `ContractAmendmentService.java:257`; `WorkflowDocumentService.java:50` |
| DRAFT → PENDING_REVIEW | `send`: INTERNAL, chủ nhà, KYC đủ, completeness, có preview | CSI:1076-1122 |
| PENDING_REVIEW → ACTIVE | `sign`: INTERNAL, khách, không phải HĐ con, cửa sổ ký + thanh toán CONFIRMED | CSI:1164-1212 |
| DRAFT → LSP | `initiate` của chủ nhà (đặt trước khi gọi VNPT) | SCS:523-525 |
| LSP → DRAFT | poll VNPT trả từ chối/lỗi hoặc hết hạn (giao dịch 5 phút) | SCS:653,672,919-929 |
| LSP → TSP → ACTIVE | nhúng chữ ký xong (chủ nhà, rồi khách); khách ký: PDF SIGNED_FINAL + enqueue blockchain | SCS:826-860 |
| ACTIVE → EXPIRED | `today >= end` (job và **cả khi GET lifecycle**) | LCS:77-79,432-435 |
| → CLOSED | quyết toán hoàn tất; cọc | LCS:471; DepositAgreementService:126 |
| → TERMINATED | chấm dứt (billing/cọc) | `MonthlyBillingService.java:353,769`; DepositAgreementService:93,109 |
| → CANCELLED | huỷ trước thuê; phụ lục bị huỷ/từ chối; gia hạn hết hạn | `RentalOnboardingService.java:374,437,619,684`; `PreTenancyCancellation.java:41`; ContractAmendmentService:572; LCS:426 |

Request ký: `CREATED → PENDING_USER_CONFIRMATION → PROVIDER_SIGNED → EMBEDDING → SIGNED`; nhánh `REJECTED/EXPIRED/FAILED/CANCELLED` (`SignatureRequestStatus.java`). Server tự poll 5 s (`scheduler/SignaturePollingScheduler.java`) nên không cần giữ app mở.

## 3. Checklist hành vi

Định dạng: `ID | hành vi (chuỗi nguyên văn) | file:dòng | API`.

### 3.1 Landing & route cũ

C-001 | Landing: `Đang mở văn bản…`; `Đang xác thực tài khoản…`; chưa đăng nhập: "Đăng nhập để mở văn bản", "Văn bản chỉ hiển thị cho các bên của hợp đồng.", nút "Đăng nhập" (quay lại đúng path+query+hash) | LD:25,61,76-82 | —
C-002 | Missing: "Không tìm thấy văn bản hoặc bạn không có quyền xem." + "Về danh sách hợp đồng" (id sai mẫu, không phải bên của HĐ, 400/403/404, WORKFLOW thiếu gốc) | LD:30,35,51,66,84 | GET contracts/{id}
C-003 | Lỗi mạng/5xx: "Chưa kết nối được máy chủ để mở văn bản. Lỗi kết nối không có nghĩa bạn mất quyền xem." + "Thử lại" | LD:62-65 | GET contracts/{id}
C-004 | WORKFLOW early-exit: link "Mở hợp đồng gốc" + `RentalWorkflowPanel` → handed to B `{rentalRequestId, kind:"early-exit", contractId: rootId, agreementId, focusRequest}`; WORKFLOW khác: "Văn bản này được quản lý cùng hồ sơ của hợp đồng gốc. Mở hợp đồng gốc" | LD:32-48,67-71 | rentalWorkflowService.documents (B)
C-005 | Chọn đích theo `contractLandingTarget` (1.3); side theo tài khoản, giữ `?tab/invoice/section` | LD:52; payment-module.ts:43-53 | —
C-006 | Route cũ `/dashboard/invoices/[id]`: `Đang mở thanh toán & hóa đơn…`; id sai: "Không tìm thấy hợp đồng này hoặc bạn không có quyền xem." + "Về danh sách hợp đồng"; `invoice` sai mẫu vẫn chuyển tiếp nguyên văn | app/dashboard/invoices/[contractId]/page.tsx:12-19 | —

### 3.2 Danh sách (LV)

C-010 | Tiêu đề "Hợp đồng cho thuê"/"Hợp đồng đi thuê"; mô tả CN "Ký và theo dõi hợp đồng cọc, hợp đồng thuê của các hồ sơ cho thuê." · khách "Xem và ký hợp đồng cọc giữ phòng, hợp đồng thuê của bạn." | LV:158-166 | —
C-011 | Nút "Làm mới" (tải lại có skeleton) | LV:168-171 | GET contracts
C-012 | Hai tab loại "Hợp đồng thuê" (LEASE, mặc định) / "Hợp đồng cọc" (`?kind=DEPOSIT`); đổi tab: page=1, nhóm=ALL, replace URL | LV:116,174-180 | GET contracts?agreementKind=
C-013 | Tab cọc: PolicyNotice "Hợp đồng cọc" — "Ký cọc, theo dõi hạn vào ở và thanh toán tháng đầu tại đây."; chi tiết "Xem và ký cọc, theo dõi hạn vào ở, thanh toán tháng đầu và xử lý hồ sơ giữ phòng tại đây. Sau khi ký cọc, bạn cần hoàn tất nghĩa vụ đúng hạn." | LV:181 | —
C-014 | Chip nhóm (lọc client trên trang hiện tại): "Tất cả (n)", "Cần tôi xử lý (n)", "Đang chờ bên kia (n)", "Đang thuê (n)" (cọc: "Đã ký đủ (n)"), "Đã kết thúc (n)"; bấm "Tất cả" còn reset page=1 | LV:56-63,183-194 | —
C-015 | Ghi chú "Số lượng tính trên các hợp đồng đang hiển thị ở trang này." | LV:195 | —
C-016 | Gọi list: `role=LANDLORD|TENANT`, `page` 1-based, `size=12`, `agreementKind`; không gửi status; bỏ phản hồi cũ (sequence) | LV:124-143 | GET contracts
C-017 | Poll 30 s khi trang hiển thị, im lặng (không skeleton, không toast lỗi) | LV:145-150 | GET contracts
C-018 | Loading: 3 khối skeleton + "Đang tải…" (fallback "Đang tải hợp đồng…") | LV:66,197-201 | —
C-019 | Lỗi tải (không im lặng): toast lỗi BE, fallback "Không thể tải danh sách hợp đồng."; giữ items cũ | LV:139 | —
C-020 | Rỗng: "Chưa có hợp đồng thuê"/"Chưa có hợp đồng cọc"; PolicyNotice "Khi nào xuất hiện hợp đồng?" (nút "Xem quy tắc"), summary CN "Hợp đồng cọc xuất hiện sau khi bạn xác nhận nhận cọc." · khách "Bạn ký hợp đồng cọc sau khi chủ nhà xác nhận nhận cọc." | LV:202-206 | —
C-021 | Quy tắc CN: "Với hồ sơ có cọc, hợp đồng cọc sẽ xuất hiện sau khi xác nhận nhận cọc. Hồ sơ không đặt cọc hoặc cọc 0 đồng bỏ qua hợp đồng cọc. Hợp đồng thuê được chuẩn bị khi đến ngày bắt đầu và xác nhận đủ tiền thuê." · khách: "Với hồ sơ có cọc, bạn xem và ký hợp đồng cọc sau khi chủ nhà xác nhận nhận cọc. Không đặt cọc hoặc cọc 0 đồng thì bỏ qua bước này. Hợp đồng thuê xuất hiện khi đến ngày bắt đầu và xác nhận đủ tiền." | LV:207-209 | —
C-022 | Link rỗng "Xem yêu cầu thuê" (CN → A RECEIVED) / "Xem yêu cầu đã gửi" (khách → A SENT) | LV:211-213 | —
C-023 | Nhóm lọc rỗng: "Không có hợp đồng thuộc nhóm này ở trang hiện tại." + "Xem tất cả" | LV:218-223 | —
C-024 | Phân trang khi totalPages>1: "Trang trước"/"Trang sau" (disable ở biên), "page/totalPages" | LV:226-234 | —
C-025 | Thẻ: nhãn "Hợp đồng cọc · Giữ phòng"/"Hợp đồng thuê"; `contractNumber` (1 dòng, bấm mở chi tiết); badge `contractStatus(status,kind)`; viền nhấn khi đến lượt tôi | LV:70-86 | —
C-026 | Dòng phụ "Bạn là bên cho thuê"/"Bạn là bên đi thuê" + " · Tạo dd/MM/yyyy" + (LEASE và effectiveLeaseMonths) " · Thời hạn {n} tháng" | LV:88-92 | —
C-027 | Gợi ý theo `turnOf`: mine+*_SIGNATURE_PENDING "Đến lượt bạn ký số."; mine+DRAFT "Bản nháp đang chờ bạn hoàn thiện."; mine khác "Cần bạn xem lại và xác nhận."; waiting "Đang chờ người thuê."/"Đang chờ chủ nhà." (ẩn khi khách+DRAFT+không phải cọc); running/ended không có gợi ý | LV:21-54,93 | —
C-028 | LEASE DRAFT phía khách: "Đây là bản đang soạn, chưa có hiệu lực. Bạn được xem nội dung; chỉ ký được khi đã đến ngày thuê và xác nhận đủ tiền." + link "Xem hợp đồng & đề nghị bắt đầu thuê sớm →" | LV:76,94-99 | —
C-029 | Nút chính "{label} →": mine+*_SIGNATURE_PENDING "Ký số" → `?tab=sign`; không phải cọc & ACTIVE/EXPIRED/CLOSED/TERMINATED "Xem hóa đơn" → `/dashboard/invoices/{id}`; còn lại "Mở hồ sơ". Phụ "Mở hồ sơ" khi nút chính khác "Mở hồ sơ" và không phải tenant draft | LV:35-44,101-106 | —
C-030 | `AgreementDocumentActions` → handed to B (B-234) `{contract, perspective, showDetails:false}` | LV:107 | (B)

### 3.3 Chi tiết: tải, đồng bộ, quyền (DV)

C-040 | Loading toàn trang = `ContractPageSkeleton` ("Đang tải thông tin hợp đồng"); khi chưa có `profile.id`: "Đang xác thực tài khoản…" | DV:455-461; UI:32-48 | —
C-041 | Tải: `getContract`; nếu kind DEPOSIT/WORKFLOW dừng ở đó; ngược lại song song revision, completeness, documents, signatures/state, và `preview-status` chỉ khi `DRAFT`. Một lỗi bất kỳ → toast (fallback "Không thể tải dữ liệu hợp đồng.") và về danh sách | DV:125-168 | CS
C-042 | Vai: `isLandlord = perspective=="landlord" && profile.id==landlordId` (tương tự tenant). Không khớp: "Hợp đồng này không thuộc vai trò cho thuê|đi thuê của bạn." + "Về danh sách hợp đồng" | DV:106-113,463-468 | —
C-043 | WORKFLOW mở bằng route vai: "Văn bản ký riêng của hồ sơ trả nhà / chấm dứt sớm", "Văn bản này được xem và ký cùng hồ sơ của hợp đồng gốc, nơi có đủ nội dung và kiểm tra phiên bản đang áp dụng.", "Mở hợp đồng gốc →" | DV:470-474 | —
C-044 | `preActive` = không WORKFLOW, không parent, và (cọc hoặc status ∉ {ACTIVE,EXPIRED,CLOSED,TERMINATED}) (CANCELLED vẫn preActive). Khi preActive và là bên của HĐ: đọc onboarding (`get`, chỉ lùi `refresh` khi 404/405), poll 30 s + khi quay lại foreground; lỗi giữ bản cũ | DV:114-119; ONA; PRD; lib/rental-onboarding-read.ts | onboarding get (B)
C-045 | Tab mặc định (khi không có `?tab=`): preActive & bước tiếp theo là của tôi → `nextView.tab`, ngược lại `overview` (tab tự nhảy khi onboarding tải xong); đổi tab ghi `?tab=` bằng replace | DV:120-121; hooks/useDetailTab.ts | —
C-046 | `refreshSignedState` single-flight (gọi chồng → 1 lượt bù, bỏ kết quả của HĐ cũ): chỉ ghi contract + documents + signature state, không đụng nháp đang sửa/PDF đã chọn/consent ký | DV:170-206 | GET contracts/{id}, documents, signatures/state
C-047 | `afterUpdate` (sau mọi panel): refresh signed state (lỗi → toast info "Đã cập nhật, chưa tải lại được dữ liệu."), `syncTick++` (reload lifecycle), preActive → reload onboarding | DV:209-213 | —
C-048 | Realtime: sự kiện `agreement-changed` đúng `contractId` hoặc không id → `afterUpdate` (debounce 250 ms, ẩn thì chờ hiện lại). Tắt khi HĐ cọc (panel cọc tự lo) | DV:214; hooks/useAgreementChangeSync.ts | —
C-049 | `latestDoc`: DRAFT = đúng bản preview (`preview-status.id`, revision hiện tại, READY); còn lại: READY có url (hoặc PDF SIGNED_FINAL có storageObjectId), ưu tiên SIGNED_FINAL > SIGNED_LANDLORD > OFFICIAL > PREVIEW, fallback `documents[0]` | DV:220-230 | —
C-050 | `hasReadyCurrentDocument`: có doc READY + storageObjectId của revision hiện tại; DRAFT phải là bản preview hiện tại; bắt buộc PDF khi SMARTCA hoặc (DRAFT không có parent) | DV:232-247 | —

### 3.4 Khung trang: bước tiếp theo & tab (CPG, SUM)

C-051 | Thứ tự: header → banner lỗi lifecycle → thẻ bước tiếp theo → `DetailTabs` → nội dung tab; đệm đáy lớn cho thanh nổi | CPG:117-131 | —
C-052 | Lifecycle chỉ đọc khi `root` (không preActive, không parent, ACTIVE/EXPIRED/CLOSED/TERMINATED); poll 30 s + khi hiện lại; reload khi `syncTick>0`; chia sẻ qua PageData | CPG:60-63; PRD | GET contracts/{id}/lifecycle
C-053 | Lỗi lifecycle: "Chưa cập nhật được tiến trình hợp đồng. Bước tiếp theo đang hiển thị có thể chưa mới nhất." + "Tải lại" | CPG:121-126 | —
C-054 | preActive: `NextActionCard` → handed to B `{role, nextAction, fallbackMessage: onboarding.message, primary, secondary: []}`; đang tải = skeleton ("Đang kiểm tra bước tiếp theo"); lỗi lần đầu: "Chưa tải được bước tiếp theo của hồ sơ." + "Thử lại" | CPG:104-112 | —
C-055 | preActive primary: chỉ khi bước là của tôi và tab đích ≠ tab đang mở; nhãn `primaryLabel`: "Đi tới ký số" / "Đi tới thanh toán" / "Xử lý đề nghị" / "Xem nội dung hợp đồng" / "Xem lịch sử" / "Xem tổng quan" | CPG:96; NS:142-144 | —
C-056 | Không preActive: thẻ từ `deriveNextStep` (2.2) với pill "Đến lượt bạn" (info; danger nếu tone danger) / "Đang chờ bên còn lại" (warning) + hint; không có bước → không có thẻ | CPG:46-53,79-82,113-115 | —
C-057 | Nút thẻ: mine+link → primary link (`cta`, mặc định "Mở"); mine+tab khác → primary đổi tab; không mine + link → secondary "Xem cọc & hoàn cọc" (deposit) / "Xem hóa đơn" (monthly) / "Mở hồ sơ liên quan" (contract) | CPG:91-102 | —
C-058 | Link hoá đơn: monthly → tab payment của HĐ này (`?tab=payment&section=monthly[&invoice=]`); deposit → landing `?tab=payment&section=deposit` (→ HĐ cọc) | CPG:91-93 | —
C-059 | Badge "1" trên tab đích của bước thuộc về tôi, khi tab đó không đang mở | CPG:84-88 | —
C-060 | Đang soạn phụ lục (workspace.editing) → ép sang tab `content`; `goTo(tab, elementId)` đổi tab rồi cuộn tới phần tử | CPG:65-77 | —
C-061 | Form nháp giữ mounted (ẩn) khi ở tab khác (`keepMounted="content"` khi reviewDraft) để nút "Lưu" ở thanh nổi submit được; mobile phải giữ state nháp ngoài tab | CPG:130; DV:736 | —
C-062 | `ContractSummary`: lưới "fact" (icon, nhãn, giá trị); bỏ giá trị rỗng/"—"; không còn fact nào thì ẩn | SUM:7-21 | —
C-063 | Facts HĐ cọc: "Tiền cọc" (`deposit.originalAmount` → `1.000.000 đ`), "Thời hạn thuê" (`dd/MM/yyyy – dd/MM/yyyy` từ onboarding.startsOn/endExclusive, in nguyên endExclusive) | DV:68-69,486-489 | —
C-064 | Facts HĐ thuê: "Người thuê"/"Chủ nhà" (counterpart.fullName); "Bất động sản" (title‖listingTitle‖propertyType + địa chỉ dòng phụ); "Tiền thuê · Tiền cọc" (`financial.amountNumber` + "Cọc: không đặt cọc"/số/"—"); "Thời hạn thuê" (`startDateText – endDate`) | DV:582-599 | —
C-065 | Kết thúc hiệu lực khi có `agreedEarlyEndExclusive` (HĐ gốc): hiển thị `agreed − 1 ngày` thay `lease.endDateText` (facts + card) | DV:584-588 | —

### 3.5 Header & thanh thao tác (HD)

C-070 | Nút quay lại: "Về hợp đồng gốc" (AMENDMENT; đích = HĐ gốc) / "Danh sách hợp đồng" (HĐ cọc quay về `?kind=DEPOSIT`) | HD:136-143; DV:492,615 | —
C-071 | `contractNumber`, chip loại "HĐ cọc"/"HĐ thuê"/"Phụ lục" (văn bản gia hạn cũng hiện "HĐ thuê"), pill trạng thái; ghi đè: onboarding.stage `CANCELLATION_REFUND_PENDING` → "Chờ xác nhận hoàn tiền"; AMENDMENT ACTIVE → "Đã ký đủ phụ lục" | HD:96-98,150-153; DV:632 | —
C-072 | "Bạn là chủ nhà (Bên A)"/"Bạn là người thuê (Bên B)"/"Quan sát viên" | HD:156-158 | —
C-073 | Dòng thanh toán: AMENDMENT "Thanh toán theo hợp đồng gốc"; `paymentStatus` PAID/PAID_MOCK "Đã hoàn tất thanh toán ban đầu"; khác "Chưa thanh toán" (HĐ cọc cũng áp dụng) | HD:92-94,159-166 | —
C-074 | `landlordConfirmedAt` → "Chủ nhà đã xác nhận" | HD:167-172 | —
C-075 | Nút xem: hiện khi (ACTIVE gốc hoặc phụ lục đã ký ACTIVE) hoặc latestDoc là PDF SIGNED_FINAL READY hoặc có viewUrl. Nhãn: "Xem phụ lục chấm dứt đang áp dụng" / "Xem hợp đồng đang áp dụng" / "Xem bản đã ký" / "Xem bản đang ký" / "Xem bản soạn thảo" | HD:105-106,180-190 | effective-document logic (4.x) hoặc GET documents/{id}
C-076 | Nút tải: cùng điều kiện (url = downloadUrl). Nhãn "Tải phụ lục chấm dứt đang áp dụng" / "Tải PDF đang áp dụng" / "Tải PDF đã ký" / "Tải bản {DOCX|PDF}" | HD:191-201 | như trên
C-077 | Mở/tải luôn đọc lại server (không dùng URL cũ): effective → `getEffectiveDocument` phải READY+SIGNED_FINAL+PDF; ngược lại `getDocument(latestDoc.id)` phải cùng id+contractId, READY, có url (trừ bản ký cần nội dung kiểm chứng). Lỗi: "Chưa tải được PDF đã ký của hợp đồng đang áp dụng. Vui lòng thử lại; hệ thống không mở thay bằng bản cũ." / "Chưa mở được tài liệu hiện tại. Hãy tải lại hồ sơ rồi thử lại." / "Không mở được tài liệu."; khoá nút khi đang mở | HD:107-131 | CS
C-078 | Tải bản ký (`requiresVerifiedContent` = PDF+SIGNED_FINAL+READY) qua POST `/content?download=true`, tên `fileName` ‖ "hop-dong-da-ky.pdf"; bản khác mở `downloadUrl` (web-only: "Hãy cho phép trình duyệt mở cửa sổ tải về rồi thử lại." → bỏ trên mobile) | HD:111-127; CS:43-55 | POST documents/{id}/content
C-079 | Phụ lục đã ký: nút "Xem riêng phụ lục này" (mở latestDoc của chính phụ lục) + ghi chú "Phụ lục đã ký có thể còn chờ hiệu lực. Nút “đang áp dụng” luôn lấy bản có hiệu lực theo ngày hệ thống; xem riêng phụ lục để đối chiếu bản này." | HD:202-217 | GET documents/{id}
C-080 | Link "Bằng chứng blockchain" khi `signedAt` & không parent → tab sign, cuộn tới `contract-blockchain-proof` | HD:206-211 | —
C-081 | Link (khi có revision) "Xem văn bản và lịch sử tệp" hoặc "Đã áp dụng {n} lần điều chỉnh · Xem hợp đồng và lịch sử" (đếm `appliedAmendment`) → tab sign, cuộn `contract-document-history` | HD:89-90,212-214 | —
C-082 | Gập "Thông tin văn bản": "Số hợp đồng", "Địa điểm lập văn bản" (signingCity), "Thời điểm hai bên ký đủ" (vi-VN giờ VN, hoặc "Chưa ký đủ hai bên"), "Ngày lập in trên Word/PDF được hệ thống ghi lúc kết xuất; không đồng nhất với ngày bắt đầu thuê hoặc thời điểm ký đủ. Xem bản đã ký để đối chiếu ngày in chính xác."; gập con "Thông tin kỹ thuật · Chỉ đọc": "Phiên bản cấu trúc dữ liệu", "Số bản soạn thảo" | HD:220-231 | —
C-083 | Thanh nổi đáy (CN, `DRAFT`, không refund-pending, không đang sửa phụ lục, và (chưa có doc sẵn sàng ‖ không SmartCA ‖ có nút đồng bộ bài đăng)). Chữ: "Bản xem trước đã sẵn sàng." / "Bản nháp đã lưu. Bạn có thể thử kết xuất lại PDF." / "Lưu nội dung đã rà soát và tự tạo PDF để kiểm tra trước khi ký." / "Kết xuất PDF để kiểm tra và tiếp tục ký ở đầu trang." (thanh chỉ có cho DRAFT, kể cả HĐ con) | HD:234-242 | —
C-084 | Nút Lưu/Kết xuất (ẩn khi doc đã sẵn sàng): "Đang lưu bản nháp..." / "Đang kiểm tra kết quả..." / "Đang kết xuất..." / "Thử kết xuất lại" / "Lưu" (reviewDraft) / "Kết xuất file". Disable: rendering, reconciling, sending, saving (kể cả đang đồng bộ), locked, thiếu `CONTRACT_MANAGE`/hồ sơ (tooltip = lý do khoá) | HD:243-259; DV:627 | PATCH revision, POST previews
C-085 | "Gửi cho người thuê"/"Đang gửi..." chỉ khi KHÔNG SmartCA; disable nếu chưa `completeness.complete` ("Bổ sung đủ trường trước khi gửi"), chưa có file ("Kết xuất file hợp đồng trước khi gửi"), busy, thiếu quyền | HD:260-281 | POST send
C-086 | Quyền `CONTRACT_MANAGE` + cổng hồ sơ: thiếu quyền → thông điệp khoá tính năng; thiếu hồ sơ → "Cần cập nhật: {Thông tin cá nhân, Địa chỉ, Tài khoản ngân hàng, Xác minh danh tính (KYC)}"; backend 403 code 1010 | HD:85; hooks/usePermission.ts; lib/profile-gate.ts | —

### 3.6 Soạn nháp: lưu + kết xuất + gửi + xác nhận (DV, DRC)

C-090 | `reviewDraft` = CN & DRAFT & không parent. `signatureLocked` = `landlordConfirmedAt` hoặc có request ký CREATED/PENDING_USER_CONFIRMATION/PROVIDER_SIGNED/EMBEDDING/SIGNED. `reviewLocked` = conflict ‖ signatureLocked ‖ stage CANCELLATION_REFUND_PENDING | DV:271-274 | —
C-091 | Dirty = chỉ số điện/nước khác bản lưu ‖ phí chậm trả đổi ‖ thoả thuận bổ sung đổi ‖ draftContent patch ‖ có dữ liệu bài đăng chờ lưu. Dirty → ẩn nút xem/tải (`latestDoc=null`) và coi như chưa có file | DV:266-287,613,619 | —
C-092 | Yêu cầu chỉ số: điện khi charge ELECTRICITY+PER_KWH; nước khi WATER+PER_M3/STATE_WATER_RATE; nước theo người (PER_PERSON_MONTH, không đo) thì không gửi waterInitial | DV:251-264 | —
C-093 | Validate trước lưu: chỉ số "Vui lòng nhập chỉ số điện ban đầu." / "…nước ban đầu."; sai mẫu "{label} phải là số không âm, tối đa 3 chữ số thập phân (ví dụ: 0 hoặc 1250.5)." (≤20 ký tự, ≤1e12) | DV:304-309; lib/contract-initial-meters.ts | —
C-094 | Phí chậm trả ≠ NONE: số nguyên 1..1.000.000.000, lỗi "Nhập mức phạt là số tiền nguyên dương, tối đa 1 tỷ đồng."; SĐT hai bên nếu sửa phải khớp `^0(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$`, toast "Nhập số điện thoại di động Việt Nam hợp lệ."; lỗi → cuộn tới handover/parties/policies, rồi `reportValidity()` của form (required/pattern HTML ở từng ô) | DV:310-324 | —
C-095 | Lỗi chỉ số/phí khi đang ở tab khác → tự chuyển tab `content` | DV:288-291 | —
C-096 | Lưu: PATCH revision `{baseRevisionId, revisionNote:"Hoàn thiện bản nháp hợp đồng.", meters?, additionalTerms?, draftContent?, listingSourceVersion?, policies?{latePaymentFeeMode, latePaymentFeeAmount(0 nếu NONE)}}`, reset state nháp theo revision mới | DV:333-358 | PATCH contracts/{id}/revision
C-097 | Kết xuất: POST previews (timeout 95 s, `expectedRevisionId` chỉ khi reviewDraft) một lần; kết quả không chắc (502/503/504, timeout/mất mạng) → "Đang kiểm tra kết quả..." poll `preview-status` 20 lần cách 3 s; khớp = READY + revision đúng + storageObjectId (+PDF khi reviewDraft); không khớp sau 20 lần = "chưa biết" | lib/contract-preview.ts; DV:360-366 | POST previews, GET preview-status
C-098 | Toast: "Đã lưu và kết xuất PDF. Bạn có thể xem lại trước khi ký." / "Đã tạo bản xem trước hợp đồng."; chưa biết: "Đã lưu bản nháp. Chưa xác nhận được kết quả kết xuất PDF." / "Chưa xác nhận được kết quả kết xuất. Bạn có thể thử kết xuất lại."; lỗi: "Không thể lưu bản nháp."/"Không thể kết xuất bản xem trước." (thêm tiền tố "Đã lưu bản nháp. " nếu đã lưu); sau đó tải lại completeness + documents; cuộn lên đầu | DV:367-402 | —
C-099 | Lỗi code `6072` → conflict: khoá sửa, "Bản nháp đã thay đổi ở nơi khác. Hãy đối chiếu nội dung trước khi chỉnh sửa lại." + "Tải lại bản nháp"; nếu còn dirty hỏi dialog "Tải bản mới?" / "Tải bản mới và bỏ các chỉnh sửa chưa lưu trên trang này." / "Tải lại" (warning) | DV:292-294,379-383,703-706 | —
C-100 | Đồng bộ bài đăng báo sai revision: "Phiên bản hợp đồng đã thay đổi. Tải lại trang trước khi cập nhật." | DV:300-303 | —
C-101 | Huỷ kết xuất đang chạy khi đổi HĐ/rời trang (AbortController); không chạy 2 lượt song song | DV:86-89,297,327 | —
C-102 | Gửi: nếu `!readyToSign` toast warning "Dữ liệu đã thay đổi hoặc chưa có file kết xuất. Vui lòng kết xuất file xem trước trước khi gửi."; thành công "Đã xác nhận nội dung và gửi hợp đồng cho người thuê."; lỗi "Không thể gửi hợp đồng cho người thuê." (không có dialog xác nhận) | DV:410-433 | POST send, GET documents
C-103 | Khách xác nhận (chế độ INTERNAL): chỉ PENDING_REVIEW, nếu không "Bạn chưa thể xác nhận vì hợp đồng chưa ở trạng thái chờ ký."; thành công "Đã xác nhận đồng ý hợp đồng. Hợp đồng đã có hiệu lực."; lỗi "Không thể xác nhận ký hợp đồng." | DV:436-453 | POST sign
C-104 | `DraftActionsCard` (tab sign, reviewDraft): "Hoàn thiện bản nháp" / "Rà soát nội dung, lưu ở thanh dưới màn hình để tạo PDF, rồi gửi hoặc ký."; 3 bước "1. Rà soát và sửa nội dung trong mục Nội dung hợp đồng (còn thiếu chỉ số điện nước)." "2. Bấm Lưu ở thanh cố định phía dưới để tạo PDF xem trước." "3. Kiểm tra PDF rồi gửi cho người thuê hoặc ký số."; "Có thay đổi chưa lưu"; "Bản nháp đang xử lý chữ ký. Theo dõi trạng thái ở phần ký bên dưới."; conflict + "Tải lại bản nháp"; nút "Rà soát nội dung" → tab content | DRC:7-41; DV:665-666 | —

### 3.7 Tab Tổng quan (OV, TL)

C-110 | preActive: `RentalOnboardingPanel` → handed to B `{rentalRequestId, isLandlord, showDepositAgreement:false, sections:["summary"], onSnapshot:accept, onUpdated:afterUpdate}` (cả HĐ cọc lẫn HĐ thuê) | DV:499,663; OV:82 | (B)
C-111 | InfoCard: ẩn dòng rỗng/"—", ẩn card trống. HĐ cọc 1 card "Hợp đồng cọc & giữ phòng": "Trạng thái", "Tiền cọc", "Đang giữ" (heldAmount) | OV:21-37; DV:497-498 | —
C-112 | Card "Các bên": "Chủ nhà (Bên A)", "Người thuê (Bên B)", "Điện thoại người thuê"/"Điện thoại chủ nhà" | DV:601-602 | —
C-113 | Card "Bất động sản": "Địa chỉ", "Loại hình", "Diện tích" (areaText), "Số căn / phòng", "Tầng" | DV:603-604 | —
C-114 | Card "Thời hạn thuê": "Bắt đầu", "Kết thúc", "Thời hạn" (durationText ‖ "{n} tháng"; khi rút ngắn: "Rút ngắn theo phụ lục chấm dứt sớm"), "Bàn giao" | DV:605-606 | —
C-115 | Card "Tiền thuê & cọc": "Tiền thuê", "Tiền cọc" ("Không đặt cọc" khi `isZeroDeposit`), "Kỳ thanh toán", "Phương thức" | DV:607-608 | —
C-116 | HĐ gốc đã hiệu lực: card "Thanh toán & hóa đơn" (hint "Hóa đơn thuê từng kỳ nằm ở mục Thanh toán & cọc. Cọc và hoàn cọc nằm ở hợp đồng cọc."): "Đang tải tình trạng hóa đơn…" / "Không có hóa đơn nào đang chờ xử lý" / "{n} hóa đơn chưa hoàn tất · {tổng} đ" (bill DRAFT/UNPAID/OVERDUE; tổng bỏ DRAFT) + "{k} hóa đơn đã quá hạn" / khách "Thanh toán trước hạn để tránh phí chậm trả" / CN "Theo dõi và xác nhận thanh toán của người thuê"; nút "Xem thanh toán & hóa đơn" → tab payment | OV:74-105; DV:580,661 | lifecycle
C-117 | "Hành trình hợp đồng" ("Các mốc từ lúc soạn đến khi hợp đồng có hiệu lực.") chỉ HĐ thuê gốc: mốc `leaseTimeline` (5.2), số thứ tự/✓, "Đang ở bước này", ngày `dd/MM/yyyy` | OV:39-60,107-112; TL; DV:662 | —
C-118 | `depositSigned` (có mốc "Hợp đồng cọc ký đủ") chỉ khi gốc, onboarding có `depositAgreementContractId` và `depositAgreementRequired!==false`; = depositAgreementStatus ∈ POST_ACTIVE. Onboarding chỉ tải khi preActive nên mốc này biến mất sau khi HĐ hiệu lực | DV:610-611 | —
C-119 | "Đi tới mục khác" / "Mỗi việc cần làm nằm ở đúng một mục.": ô tắt cho mỗi tab khả dụng, mô tả sign "Ký số, xem PDF và bằng chứng blockchain", payment "Chuyển khoản, xác nhận và sổ tiền cọc", end "Hủy, gia hạn, phụ lục và khiếu nại", content "Toàn bộ điều khoản của hợp đồng", history "Phụ lục, phiên bản tài liệu, nhật ký" | OV:13-19,114-134 | —

### 3.8 Tab Ký số & tài liệu (thứ tự khối)

C-120 | HĐ cọc: `DepositAgreementPanel` → handed to B `{rentalRequestId, isLandlord, onUpdated}` rồi `RentalOnboardingPanel` → B `{…, showDepositAgreement:false, sections:["sign"], onSnapshot, onUpdated}` | DV:500-503 | (B)
C-121 | HĐ thuê, theo thứ tự: DraftActionsCard (reviewDraft) → MissingFields → notice nháp (khách) → RentalOnboardingPanel sign (preActive; ở đây KHÔNG truyền `showDepositAgreement:false`) → B → notice HĐ con + link gốc → `ContractAmendmentPanel{contractId: parent, actorId, perspective, agreementId: contract.id}` (AMENDMENT) → panel ký (SCA nếu `signatureMode==="SMARTCA"`, ngược lại SP) → `ContractDocumentSection{documents, contract}` | DV:664-682 | —
C-122 | Khách + HĐ thuê DRAFT: PolicyNotice "Bản nháp hợp đồng" / "Bản nháp để xem trước · Chưa có hiệu lực" / "Chủ nhà vẫn có thể cập nhật nội dung. Bạn có thể xem văn bản và đề nghị nhận nhà, bắt đầu hợp đồng sớm trong mục Thanh toán & cọc. Chấp nhận đề nghị sẽ đổi ngày thuê và các kỳ hóa đơn; không chỉ mở ký trước ngày thuê cũ." | DV:668-670 | —
C-123 | HĐ con: tiêu đề "Phụ lục hợp đồng"/"Văn bản gia hạn hợp đồng"; AMENDMENT "Phụ lục này ghi nhận điều khoản đã thống nhất với ngày áp dụng riêng. Xem bảng thay đổi và PDF trước khi ký. Hợp đồng gốc và lịch sử thanh toán được giữ nguyên."; khác "Đây là văn bản gia hạn liên kết hợp đồng gốc. Không thu lại cọc hoặc tiền thuê tháng đầu; giữ nguyên điều kiện đã chốt. Chỉ có hiệu lực sau đủ chữ ký hai bên."; link "Mở hợp đồng gốc để theo dõi thời hạn, hóa đơn và cọc →" | DV:672-678 | —
C-124 | `signingAllowed = parentContractId ‖ onboarding.canSign`; `blockedReason = onboarding.message ?? "Đang kiểm tra ngày bắt đầu thuê và trạng thái thanh toán…"`; SCA `hasReadyPdf = readyToSign && có PDF READY revision hiện tại`; SP `canSend = completeness.complete && readyToSign` | DV:638-658 | —

### 3.9 Tab Thanh toán & cọc (khung, PAY)

C-130 | preActive: `RentalOnboardingPanel` → B `sections:["payments"]`; HĐ con: "Các khoản thanh toán được quản lý trên hợp đồng gốc. Mở thanh toán & hóa đơn của hợp đồng gốc" (tab payment không có trong `available` của HĐ con → nhánh này thực tế không tới được) | PAY:24-27; DV:581 | (B)
C-131 | Còn lại: `MonthlyInvoicesSection` → handed to D `{key:contract.id, contractId, rentalRequestId, contractActive: status==ACTIVE, isLandlord, isTenant:!isLandlord, requestedInvoiceId (safeInvoiceSelectionId(?invoice)), invalidInvoiceRequest, onUpdated, electricityRequired (ELECTRICITY+PER_KWH), waterRequired (bất kỳ PER_M3), unsupportedWaterRate (STATE_WATER_RATE & includedInRent≠true), initialElectricity, initialWater}` | PAY:28-37 | (D)
C-132 | preActive & HĐ cọc: `DepositSettlementPanel` → D `{rentalRequestId, isLandlord, onUpdated}` (HĐ cọc đã ký đủ vẫn preActive nên hoàn cọc ở đây) | PAY:39; DV:504 | (D)
C-133 | HĐ thuê: `ContractInitialPaymentSection{initialPayment: revision.initialPayment}` cuối tab (3.12) | DV:683-684 | —

### 3.10 Tab Hủy / kết thúc (END)

C-140 | Đầu tab: `CancelRules{preActive}` (2 biến thể quy tắc hủy/kết thúc) → đã kiểm kê ở **D-170** (không chép lại) | END:13-37,61 | —
C-142 | preActive: `RentalOnboardingPanel` → B `sections:["end"]` | END:62-64 | (B)
C-143 | Gốc & ACTIVE/EXPIRED/CLOSED/TERMINATED: "Kết thúc sớm / trả nhà" ("Đề nghị chấm dứt hoặc trả nhà trước hạn, có sự đồng ý của hai bên.") → `RentalWorkflowPanel` → B `{rentalRequestId, kind:"early-exit", onUpdated}` | END:67-70 | (B)
C-144 | Chỉ ACTIVE: "Gia hạn thời gian thuê" ("Kéo dài thời hạn thuê. Dời hạn thanh toán một hóa đơn là việc khác, nằm trong mục hóa đơn.") → `ContractLifecyclePanel{key:actorId:contractId, contractId, isLandlord, onUpdated, mode:"renewal"}` | END:72-77 | 3.14
C-145 | ACTIVE/EXPIRED/CLOSED: "Phụ lục / điều chỉnh" ("Đổi điều khoản đã ký (giá thuê, phí, số người…). Có hiệu lực sau khi hai bên ký.") → AP (khi đang soạn thì AP chuyển sang tab content, `AmendmentSlot`) | END:42-46,78-83; DV:718 | 3.13
C-146 | Chỉ ACTIVE: "Khiếu nại" ("Gửi và theo dõi khiếu nại liên quan đến hợp đồng đang thuê.") → `ComplaintPanel` → D `{rentalRequestId, onUpdated}` | END:84-89 | (D)

### 3.11 Tab Lịch sử (HIS)

C-150 | HĐ gốc có dữ liệu phụ lục: "Phụ lục & điều chỉnh" ("Các đề xuất đổi điều khoản, từ mới nhất đến cũ nhất."); rỗng "Chưa có phụ lục hay đề xuất điều chỉnh nào."; dòng = `amendmentDocumentTitle` + "Áp dụng từ dd/MM/yyyy · {amendmentDocumentStatus}" + "Mở phụ lục". Chỉ hiện khi workspace bật (HĐ gốc đã hiệu lực); bỏ proposal `TENANT_*` | HIS:13-45; lib/contract-document-history.ts:75-99 | amendments
C-151 | Card "Phiên bản tài liệu" ("Mọi tệp Word/PDF đã tạo, các mốc ký và bằng chứng blockchain.") nút "Xem lịch sử tệp" → tab sign, cuộn `contract-document-history` (HĐ cọc: phần tử này không tồn tại, chỉ đổi tab) | HIS:59-73 | —
C-152 | preActive: "Nhật ký hồ sơ thuê" ("Những gì đã diễn ra từ lúc đặt cọc.") → `RentalOnboardingPanel` → B `sections:["history"]` | HIS:74-79 | (B)

### 3.12 Tab Nội dung hợp đồng: các section

Nguồn dữ liệu mỗi section (ưu tiên): `workspace.editing ? listingSync.terms.X` → `workspace.data.currentTerms.X` (điều khoản đang áp dụng, chỉ khi HĐ gốc đã hiệu lực) → revision (hoặc `listingSyncPreview.terms.X` khi soạn nháp). `str()` rỗng → "—" (UT:6-10). Riêng `InitialPayment` không bị thay bởi preview.

C-160 | Thứ tự tab content: (reviewDraft) khối rà soát + MissingFields + Handover → (khách, thiếu chỉ số) Handover lên đầu → notice nguồn nội dung (CN, draft gốc) → `ContractTermsNotice` (đã hiệu lực) → AP khi đang soạn → Legend, Parties, Property, Lease, Financial, Amenities, Charges, Equipment, Policies → Handover cuối (khi không ưu tiên) | DV:686-729,568-578 | —
C-161 | Khối "Rà soát bản nháp trước khi ký": notice "Soạn bản nháp hợp đồng"/"Kiểm tra và sửa trực tiếp các ô bên dưới. Bấm Lưu để lưu bản nháp và tự tạo PDF xem trước."; link neo "Chỉ số điện nước", "Thông tin hai bên", "Thông tin bất động sản", "Phí chậm trả & thỏa thuận"; "Có thay đổi chưa lưu"; "Đã tải dữ liệu bài đăng. Hoàn thiện các ô còn thiếu để lưu và kết xuất." + "Bỏ dữ liệu vừa lấy"; conflict; "Bản nháp đang xử lý chữ ký. Hãy theo dõi trạng thái ở mục Ký số & tài liệu." | DV:687-711 | —
C-162 | CN draft gốc: "Nguồn nội dung hợp đồng nháp" / "Các nội dung chính lấy từ hồ sơ thuê đã chấp thuận." / "Ngày thuê, thời hạn, tiền thuê, tiền cọc và số người/xe lấy từ hồ sơ đã chấp thuận. Đổi ngày nhận nhà dùng đề nghị nhận nhà sớm trong mục Thanh toán & cọc. Các điều khoản sau ký được điều chỉnh qua phụ lục." | DV:714-716 | —
C-163 | Notice "Điều khoản đang áp dụng" (đã hiệu lực): lỗi "Chưa tải được điều khoản hiện tại. Các mục bên dưới tạm hiển thị bản hợp đồng gốc; tải lại mục Phụ lục trước khi đối chiếu."; đang tải "Đang kiểm tra phụ lục để hiển thị điều khoản hiện tại. Bản hợp đồng gốc đã ký được giữ nguyên trong hồ sơ."; xong "Các mục bên dưới thể hiện điều khoản đang áp dụng, bao gồm phụ lục đã đủ chữ ký và đến ngày hiệu lực. Bản hợp đồng gốc đã ký được giữ nguyên tại Tài liệu hợp đồng." | AW:ContractTermsNotice | —
C-164 | Chú thích màu: "● Có thể sửa trên bản nháp"/"● Có thể điều chỉnh qua phụ lục" (xanh dương), "● Chỉ đọc / Hệ thống tự tính", "● Đã sửa trong bản đang soạn" (xanh lá) + notice "Chú thích màu sắc"; ô đã đổi có chữ "Đã sửa". `ContractSnapshotReadOnly=true` khi DRAFT → mọi FieldRow chế độ đọc | FST; UT:37-62; DV:735 | —
C-165 | Parties: tiêu đề "Chủ thể giao kết hợp đồng" + "Thông tin trong điều khoản đang áp dụng"; "Bên A — Bên cho thuê"(chip "Chủ nhà"), "Bên B — Bên thuê"(chip "Người thuê"). Dòng: "Họ và tên", "Số CCCD / Định danh", "Nơi thường trú", "Ngày sinh", "Giới tính", "Ngày cấp CCCD", "Ngày hết hạn CCCD", "Nơi cấp CCCD", "Số điện thoại", "Email liên hệ"; nhóm "Tài khoản nhận thanh toán" (A) / "Tài khoản nhận hoàn trả / hoàn cọc" (B): "Ngân hàng", "Số tài khoản", "Chủ tài khoản" (in nguyên chuỗi) | PT | —
C-166 | Bên B thêm: "Số người ở chính thức" "{n} người" (0/rỗng → "—"); "Xe máy đăng ký" "{n} xe"/"Không đăng ký xe máy"; "Ô tô đăng ký" "{n} xe"/"Không đăng ký ô tô" | PT | —
C-167 | Parties khi soạn (draft/phụ lục): `ContractTermFields` — danh tính (fullName "Họ và tên" hint "Theo KYC đã xác thực", idNumber, birthDate, gender, permanentAddress, issueDate, expirationDate, issuePlace) khoá (draft: hiện FieldRow; phụ lục: input disabled); sửa được "Số điện thoại","Email liên hệ","Ngân hàng"(select),"Số tài khoản","Chủ tài khoản"; B thêm "Số người cư trú","Xe máy đăng ký","Ô tô đăng ký"; notice "Thông tin các bên" 2 bản chữ (draft: "Danh tính lấy từ KYC đã xác thực và không được nhập sửa. Thông tin liên hệ dùng trên văn bản không thay tài khoản thu/hoàn tiền trong Settings. Phí theo người/xe được tính lại khi lưu; khoản đã thanh toán giữ lịch sử."; phụ lục: "Danh tính KYC giữ nguyên theo snapshot hợp đồng. Bạn có thể sửa thông tin liên hệ và điều khoản được phép. QR thanh toán dùng tài khoản ngân hàng đã đăng ký trong hồ sơ thanh toán.") | PT; IAF | —
C-168 | Ràng buộc input: số `occupantCount` 1-100, motorbike/car 0-100 (draft: required), maxOccupants/maxVehicles 0-100, durationMonths 1-120; diện tích min 0.001 draft / 0.01 phụ lục; maxLength idNumber 12, STK 34, phone 10 + email 100 + khác 1000 (draft), 2000 (phụ lục); pattern (chỉ khi đổi trong draft) CCCD `9|12 số`, STK `1-34 số`; ngày: date input ↔ chuỗi `dd/MM/yyyy`; hint khoá mặc định "Giữ nguyên dữ liệu đã xác nhận; không ghi đè lịch sử." | IAF; lib/contract-amendment-input.ts | —
C-169 | Select ngân hàng: "{code} - {shortName} ({name})", giá trị lưu = `bank.name`; "Đang tải danh sách ngân hàng...", "Chọn ngân hàng", lỗi "Không thể tải danh sách ngân hàng. Thử lại" | IAF:BankNameSelect; hooks/useBanks.ts | GET banks (bank-account.service)
C-170 | Property: "Thông tin bất động sản bàn giao", "Mã tin: {listingCode}"; "Địa chỉ tài sản","Loại hình","Diện tích sử dụng"(m²→"mét vuông"),"Số căn / phòng"(rỗng "Toàn bộ căn"),"Tầng / Độ cao","Phạm vi cho thuê"(rỗng "Toàn bộ diện tích tài sản"),"Số người tối đa"("{n} người"/"Theo thỏa thuận"),"Số xe tối đa"("0 xe (Không giữ xe)"/"{n} xe"/"Theo thỏa thuận"); ghi chú "Tài sản được bàn giao độc lập theo đúng hiện trạng mô tả trong hợp đồng và biên bản bàn giao đính kèm." | PR | —
C-171 | Bảng "Đặc điểm tài sản | Giá trị" (`features[]`, dịch mã bằng `contractPropertyFeatureValue`) | PR; lib/contract-property-feature-labels.ts | —
C-172 | Lease: "Thời hạn thuê và bàn giao" + "Thời hạn trong điều khoản đang áp dụng"; "Ngày bắt đầu tính tiền thuê", "Ngày kết thúc hợp đồng" (rút ngắn: "Ngày kết thúc theo văn bản đã ký"), "Thời hạn thuê" (ghép `durationText (n tháng)` nếu chưa chứa tổng tháng), "Ngày bàn giao tài sản" (rỗng "Cùng ngày bắt đầu thuê") | LS | —
C-173 | Khi `agreedEarlyEndExclusive`: hộp "Đã thống nhất kết thúc thuê sớm", "Mốc kết thúc đang áp dụng: dd/MM/yyyy lúc 00:00 (không gồm ngày này).", notice "Thời hạn thuê theo phụ lục"/"Thời hạn gốc trong văn bản đã ký bên dưới được giữ nguyên để đối chiếu. Bàn giao và quyết toán thực hiện riêng." | LS | —
C-174 | Lease khi soạn phụ lục: 5 ô (startDateText "Ngày bắt đầu tính tiền thuê", endDateText, durationMonths "Số tháng thuê", durationText, handoverDateText), tự tính chéo (`amendmentLeasePatch`); notice "Đổi ngày bắt đầu thuê"/"Ngày kết thúc khép đủ kỳ thuê tháng. Nếu đổi ngày bắt đầu, chọn đúng ngày hiệu lực của phụ lục; kỳ thuê và khoản thu trước đó được giữ nguyên." | LS | —
C-175 | Financial: "Giá thuê định kỳ và tiền đặt cọc" + "Giá thuê và cọc theo điều khoản đang áp dụng"; "Tiền thuê hàng tháng","Bằng chữ","Kỳ hạn thanh toán","Hạn đóng tiền định kỳ","Phương thức thanh toán","Tiền đặt cọc bảo đảm","Tiền cọc bằng chữ" (in nguyên chuỗi server), "Điều kiện & thời hạn hoàn cọc" / khi không cọc "Quy định về tiền cọc" = "Không đặt cọc theo điều khoản này." | FS | —
C-176 | Financial khi `editing && editingFinancial`: tiền thuê (VND, min 1) + "Bằng chữ được tính lại từ số tiền; tiền cọc đã nhận giữ nguyên."; "Kỳ hạn thanh toán"(hint "Hàng tháng, Hàng quý, Hàng năm hoặc Mỗi N tháng (1–12). Phí điện/nước vẫn quyết toán hàng tháng."), "Phương thức thanh toán", "Điều kiện hoàn cọc"; nhãn quy tắc hạn; "Tiền đặt cọc bảo đảm (đ)"; notice "Điều chỉnh tiền cọc"/"Số tiền bằng chữ được tính lại. Đổi tiền cọc tạo khoản thu thêm hoặc hoàn phần chênh lệch sau khi phụ lục có hiệu lực; không sửa khoản cọc đã thanh toán." | FS | —
C-177 | Ô tiền VND: chấm nghìn, bàn phím số, hậu tố "đ", lỗi "Nhập số tiền VNĐ nguyên từ {min} đến {max} đ." (max 1 tỷ), "Chỉ nhập số tiền VNĐ nguyên, không dùng số âm hoặc ký hiệu e.", "Dán số tiền VNĐ nguyên; không nhập số âm hoặc phần thập phân."; gợi ý "Chọn nhanh số tiền · Không tự cộng thêm số 0" (×10..×1.000.000 ≤ max) | components/ui/vnd-money-input.tsx; lib/vnd-input.ts | — (dùng chung A)
C-178 | Amenities: "Tiện ích" / "Danh sách tiện ích đã chốt trong hợp đồng", "{n} tiện ích", bảng "STT | Tên tiện ích"; rỗng "Không có tiện ích được ghi nhận." | AM | —
C-179 | Charges: "Phí dịch vụ và chi phí sinh hoạt" / "Đơn giá, cách thức tính phí và phân loại chi phí định kỳ hoặc theo công tơ", "{n} khoản phí"; cột "STT|Khoản phí|Mức phí / Đơn giá|Đơn vị tính|Ghi chú / Điều kiện"; đơn vị theo BILLING_METHOD_LABELS (5.5); giá = amountAndMethod‖amount; ghi chú rỗng "Theo mức sử dụng thực tế"; icon điện/nước cho PER_KWH/PER_M3 | CH | —
C-180 | Charges rỗng: "Phí dịch vụ trong hợp đồng"/"Chưa có khoản phí dịch vụ được ghi nhận trong hợp đồng. Không tự suy ra các dịch vụ đã miễn phí hoặc bao gồm trong giá thuê."; chân "Chi phí tính theo công tơ"/"Các chi phí tính theo công tơ (điện, nước sinh hoạt) sẽ được chốt chỉ số định kỳ hàng tháng theo đúng đơn giá ghi trong bảng này." | CH | —
C-181 | Equipment: "Nội thất và tài sản bàn giao" / "Trang thiết bị gắn liền với tài sản bàn giao theo hiện trạng thực tế", "{n} thiết bị / nội thất"; cột "STT|Tên tài sản / Thiết bị|Số lượng(mặc định 01)|Hiện trạng|Ghi chú(rỗng Chưa có ghi chú bàn giao)"; badge hiện trạng (5.5); rỗng "Bàn giao nhà thô / cơ bản, không có danh mục nội thất rời."; notice "Trách nhiệm kiểm tra thiết bị"/"Bên B có trách nhiệm kiểm tra chi tiết tình trạng hoạt động và ký xác nhận tại Biên bản bàn giao khi nhận bàn giao thực tế." | EQ | —
C-182 | Bảng soạn phụ lục (charges khi editingFinancial / equipments / amenities): cột theo nhóm + "Xóa", "Thêm dòng phí|nội thất|tiện ích" (tối đa 50), "Khôi phục mục này", "Nhập nội dung đã thỏa thuận · Chưa có hiệu lực"; nhập cách tính bằng chữ tự do ("Bao gồm" khi includedInRent; sửa giá/cách tính đặt includedInRent=false); notice "Cách nhập phí dịch vụ": "Nhập cách tính: Tháng, Người / tháng, Xe máy / tháng, Ô tô / tháng, kWh, m³, mét vuông / tháng, Miễn phí, Bao gồm hoặc Không áp dụng. Hệ thống tính lại tổng tiền khi đối chiếu." Chú ý: Equipment/Amenities section chỉ đọc; chỉ charges render InlineAmendmentFields (equipments/amenities chỉ đổi qua đồng bộ bài đăng) | IAF; CH | —
C-183 | Policies: "Chính sách vận hành và điều khoản thỏa thuận bổ sung"; có `listingPolicies` → card "Chính sách & nội quy thuê" (label/displayValue, bỏ `depositRefundDays` khi không cọc; notice "Chính sách lấy từ bài đăng đã duyệt. Sửa bài gốc, gửi admin duyệt rồi cập nhật vào bản nháp hoặc đề xuất phụ lục."); không có → "Thời hạn báo trước khi chấm dứt"("Tối thiểu {n} ngày"/"Chưa có thỏa thuận"), "Thời hạn hoàn trả tiền đặt cọc"("Trong vòng {n} ngày sau khi bàn giao và quyết toán"), "Cho thuê lại (Subletting)" ("Được phép theo thỏa thuận"/"Không được phép"), "Quy định nuôi thú cưng" ("Được phép, tuân thủ nội quy"), "Quy định hút thuốc trong nhà" ("Chỉ tại khu vực cho phép"); thiếu dữ liệu "Chưa có thỏa thuận trong bản chụp hợp đồng" | PO; components/listing/ListingPoliciesCard.tsx | —
C-184 | "Phí phạt đóng trễ" khi soạn nháp: "Cách tính phí" {Không phạt, Phạt một lần sau hạn, Phạt cho mỗi ngày trễ}, "Mức phạt (đ)" placeholder "Ví dụ: 100.000 đ/ngày|đ/lần"; ví dụ "Trễ 1 ngày: X · Tối đa 5 ngày: 5X trên mỗi hóa đơn." / "Trễ 1 hay nhiều ngày: chỉ phạt một lần X." / "Nhập mức tiền để xem ví dụ tính phí." / "Không cộng phí chậm thanh toán vào hóa đơn." + lỗi phí + nhãn quy tắc hệ thống | PO | —
C-185 | Phí phạt chỉ đọc: NONE "Không áp dụng phí phạt đóng trễ cho hợp đồng này."; khác: số tiền + "/ mỗi ngày trễ"|"/ một lần duy nhất" + badge "Đã lưu trong bản nháp"|"Điều khoản đã chốt", "Trễ 1 ngày: … · Trễ 5 ngày: …." (5.4), notice "Thời điểm bắt đầu tính phạt" ("Bắt đầu tính sau {g} ngày ân hạn kể từ hạn…|từ ngày đầu tiên sau hạn thanh toán ghi trên hóa đơn. Sau 5 ngày quá hạn, hệ thống nhắc chủ nhà quyết định hướng xử lý."), "Tổng phí phạt tối đa áp dụng: …." , notice "Giới hạn tính phí phạt" | PO | —
C-186 | Cảnh báo "Xử lý khi quá hạn 5 ngày" (nút "Xem quy tắc"), theo thứ tự: `overdueUnilateralTermination24h` "Sau đủ 5 ngày quá hạn, chủ nhà có thể chọn phương án xử lý. Nếu có quyết định đơn phương chấm dứt, người thuê có 24 giờ để khiếu nại theo điều khoản hệ thống." · `overdueLandlordTerminationAfterFiveDays` "Sau hơn 5 ngày quá hạn, chủ nhà có thể cho cộng nợ kỳ sau hoặc đề nghị chấm dứt. Nếu người thuê từ chối, chủ nhà có thể chọn chấm dứt theo điều khoản đã ký sau khi thông báo và thực tế nhận lại phòng; khi đó hệ thống ghi cọc cho chủ nhà và mở lại tin đăng. Hệ thống không tự chấm dứt." · còn lại "Hợp đồng này không có điều khoản chấm dứt sau 5 ngày quá hạn theo cấu trúc hiện hành; hệ thống không tự chấm dứt hoặc thu cọc." | PO | —
C-187 | "Điều khoản hệ thống · Chỉ đọc" ("Xem điều khoản hệ thống", pre-wrap); "Điều khoản thỏa thuận khác": nháp textarea 4 dòng max 8000 placeholder "Nhập thỏa thuận bổ sung giữa hai bên nếu có…"; đọc: rỗng "Không có điều khoản bổ sung." / nháp không sửa "Điều khoản của bản nháp này được giữ nguyên ở phần chỉ đọc."; > 280 ký tự thu vào dialog "Hai bên có thỏa thuận bổ sung riêng. Mở để xem đầy đủ." | PO | —
C-188 | `BillingSystemRuleLabels` (chỉ đọc "Quy tắc hệ thống · Không chỉnh sửa", dữ liệu `currentTerms.billingRules ?? policies.billingRules`): thiếu → "Mốc thanh toán và giới hạn phạt do hệ thống quản lý."; chế độ hạn: "Thời gian thanh toán" "{paymentWindowDays} ngày lịch, tính cả ngày chốt kỳ"; chế độ phạt: "Bắt đầu tính phạt", "Giới hạn tính phạt mỗi hóa đơn", "Tổng phí phạt tối đa · Hệ thống tính", "Mốc xử lý quá hạn" (overdueActionDays, autoRolloverDays??10, terminationReviewHours??24) + cảnh báo "Điều khoản theo bản ký cũ" | IAF:BillingSystemRuleLabels | —
C-189 | Handover "Chỉ số công tơ ban đầu" / "Nhập chỉ số ban đầu khi khoản phí được tính theo đồng hồ để ghi vào hợp đồng." / badge "Bắt buộc với phí tính theo đồng hồ"; CN + DRAFT: "Chỉ số điện ban đầu (kWh) *" placeholder "Ví dụ: 1250", "Chỉ số nước ban đầu (m³) *" "Ví dụ: 85", decimal, max 20; hint "Nhập số không âm; 0 là hợp lệ." / "Không bắt buộc nếu điện không tính theo công tơ." / "…nước không tính theo đồng hồ." / "Nước tính theo đầu người; không cần chỉ số đồng hồ." (ô khoá, placeholder "Không áp dụng đồng hồ nước") | HO | —
C-190 | Handover đọc: "Chưa ghi nhận" / "Không áp dụng đồng hồ nước (Tính theo đầu người)"; notice CN nháp "Kiểm tra chỉ số thực tế cùng người thuê. Các giá trị này được lưu cùng bản nháp khi bấm Lưu." / khác "Chỉ số ban đầu dùng để đối chiếu với nội dung hợp đồng và kỳ tính phí đầu tiên." Ưu tiên (viền vàng, lên đầu + kèm MissingFields) khi DRAFT thiếu chỉ số bắt buộc | HO; DV:531-534 | —
C-191 | MissingFields (ẩn khi 0): "Hợp đồng còn {n} thông tin bắt buộc chưa có dữ liệu", "Đã điền {x}/{total} trường."; có ô công tơ: CN "Vui lòng nhập chỉ số thực tế vào các ô bên dưới. Số 0 là hợp lệ. Chọn Lưu sau khi đã rà soát bản nháp." / khách "Chủ nhà cần bổ sung và lưu chỉ số công tơ ban đầu trước khi kết xuất, ký hợp đồng. Người thuê vui lòng kiểm tra chỉ số thực tế cùng chủ nhà." / "Thông tin khác cần bổ sung:"; không: "Vui lòng bổ sung thông tin còn thiếu trước khi kết xuất và gửi hợp đồng."; tối đa 6 label + "… và {n} trường khác" | MF | completeness
C-192 | CN thiếu trường KYC `landlord.{fullName,idNumber,birthDate,gender,permanentAddress,issueDate,expirationDate,issuePlace}` → link "Kiểm tra thông tin KYC đã xác thực" (`/settings/account-security`) | MF | —
C-193 | InitialPayment "Ghi nhận thanh toán ban đầu" + "Dữ liệu lịch sử tại thời điểm lập hợp đồng · Chỉ đọc." / "…Phụ lục không sửa giao dịch đã xác nhận hoặc thu lại khoản này."; bảng "Khoản thanh toán|Số tiền|Chi tiết ghi nhận" từ `rows[]` hoặc 2 dòng "Tiền thuê kỳ đầu", "Tiền đặt cọc ban đầu"; cọc 0 "Không phát sinh thanh toán tiền cọc" | IP | —
C-194 | InitialPayment chân: "Trạng thái xác nhận","Tổng tiền ban đầu","Người thuê báo chuyển","Chủ nhà xác nhận nhận","Hoàn tất xác nhận hai chiều","Nội dung chuyển khoản","Mã giao dịch ngân hàng","Thời điểm thanh toán đã lưu","Mã tham chiếu thanh toán đã lưu"; trạng thái CONFIRMED "Hai bên đã xác nhận", PAID "Đã thanh toán", PAID_MOCK "Thanh toán thử nghiệm", PENDING "Chờ xác nhận", UNPAID "Chưa thanh toán"; thời gian rỗng "Chưa ghi nhận" | IP | —
C-195 | `ListingSyncControl` "Cập nhật dữ liệu từ bài đăng"/"Đang cập nhật…"; revision lệch → "Phiên bản hợp đồng đã thay đổi. Tải lại trang trước khi cập nhật."; có `financialDifferences` → toast "Các khoản đã chốt được giữ nguyên: {label: before → after; …}. Giá bài đăng mới không tự thay thế giá thuê, tiền cọc hoặc kỳ thanh toán đã xác nhận."; `leaseMessage` toast info; lỗi "Không cập nhật được dữ liệu bài đăng đã duyệt."; huỷ khi đổi HĐ. Ở nháp: chọn xong tự lưu+kết xuất ngay (DV:513-518), nút nằm ở thanh nổi | LSY | GET listing-sync

### 3.13 Phụ lục / điều chỉnh (AW, AP, AEP)

C-200 | Workspace: bật cho HĐ gốc đã hiệu lực (AP tự tạo workspace riêng khi `contractId` khác, vd. mở từ HĐ phụ lục); tải `GET amendments`, CN tải thêm bản nháp riêng (lỗi bỏ qua); poll 30 s khi hiển thị và không đang soạn/bận; realtime `agreement-changed` đúng id gốc hoặc id con của proposal | AW; AP:45-48; DV:734 | GET amendments, amendments/draft
C-201 | Panel: lỗi "Không tải được điều khoản đang áp dụng." (hoặc message BE) + "Tải lại phụ lục"; tải "Đang tải phụ lục…"; tiêu đề "Phụ lục & điều chỉnh"; CN "Chỉnh tại từng mục hợp đồng, đối chiếu rồi gửi người thuê duyệt." / khách "Gửi mong muốn hoặc xem và phản hồi đề xuất của chủ nhà."; nút "Làm mới phụ lục" (disable busy/editing) | AP:58-60,120 | —
C-202 | Danh sách hiển thị: proposal đang mở (`activeAmendment` = REQUESTED, CHANGES_REQUESTED, APPROVED, SCHEDULED, TENANT_REQUESTED, TENANT_ACCEPTED) hoặc (trang phụ lục) đúng `agreementContractId`; còn lại trong "Lịch sử yêu cầu và phụ lục (n)" | AP:61,68,139 | —
C-203 | Nút chính "Điều chỉnh hợp đồng" (CN) / "Đề nghị điều chỉnh" (khách), disable `!canPropose`; hiện `blockedReason` bên dưới; ẩn khi đang soạn/trang phụ lục | AP:121-122 | —
C-204 | CN có nháp: "Tiếp tục bản nháp" (khi không có proposal mở, hoặc TENANT_ACCEPTED/CHANGES_REQUESTED, hoặc SCHEDULED trùng previousProposalId); "Xóa bản nháp" confirm "Xóa bản nháp riêng? Nội dung hợp đồng không thay đổi." | AP:121 | DELETE amendments/draft
C-205 | Nhãn trạng thái proposal (5.3). Card: nhãn; "Yêu cầu bằng chữ của người thuê"|"{n} nội dung thay đổi" · thời gian nộp; chip "Áp dụng sau khi ký đủ"|"Từ dd/MM/yyyy"; lý do; "Phản hồi: {responseNote}"; "Minh chứng {i} ↗" (lỗi "Không mở được minh chứng.") | AP:100-103,34-39 | storage view url
C-206 | Yêu cầu khách TENANT_REQUESTED/ACCEPTED: "Hạn xử lý yêu cầu điều chỉnh" ("Hạn chủ nhà phản hồi|Hạn soạn và gửi đề xuất: {respondBy}. Không xử lý thì đóng yêu cầu; không tự chấp thuận.") | AP:105 | —
C-207 | CN + TENANT_REQUESTED: "Chấp thuận trao đổi · Soạn phụ lục" (disable busy/editing) → toast "Đã chấp thuận trao đổi. Hãy soạn nội dung trên hợp đồng bên dưới." và mở soạn; "Lý do từ chối yêu cầu"(≤2000) + "Từ chối yêu cầu" (disable <10 ký tự; lỗi "Ghi rõ lý do từ chối (ít nhất 10 ký tự).") → "Đã từ chối yêu cầu. Điều khoản giữ nguyên." | AP:88-93,106 | POST tenant-requests/{id}/decision
C-208 | CN + TENANT_ACCEPTED: "Soạn phụ lục trên hợp đồng" (nạp nháp đúng yêu cầu); khách: "Trạng thái đề nghị điều chỉnh"/"Chủ nhà đã chấp thuận trao đổi, chưa chấp thuận điều khoản cụ thể. Bạn sẽ nhận bản đối chiếu để duyệt trước khi ký." | AP:107-108 | —
C-209 | Proposal: "Xem nội dung đề xuất →"; REQUESTED: "Bạn cần phản hồi|Chờ người thuê phản hồi trước {respondBy}."; CHANGES_REQUESTED & CN là proposer: "Chỉnh lại trên hợp đồng" | AP:109-111 | —
C-210 | APPROVED có agreementContractId: CN/TENANT_SIGNATURE_PENDING "Bạn đã ký. Chờ người thuê ký để hoàn tất."; khách "Chủ nhà đã ký. Đến lượt bạn xem PDF và ký."; chờ CN ký: CN "Người thuê đã đồng ý. Đến lượt bạn ký phụ lục.", khách "Bạn đã đồng ý nội dung. Chờ chủ nhà ký trước."; "Hạn ký: {signBy}. Chưa ký đủ thì điều khoản cũ vẫn áp dụng."; link "Mở phụ lục để xem và ký số"|"Xem hồ sơ phụ lục" → chi tiết HĐ con | AP:112 | —
C-211 | SCHEDULED: "Đã đủ chữ ký. Điều khoản mới áp dụng từ dd/MM/yyyy."; CN & canReplace "Chỉnh lại phụ lục"; không canReplace → `replacementBlockedReason` | AP:113 | —
C-212 | "Rút đề xuất" (proposer, REQUESTED/CHANGES_REQUESTED), confirm "Rút đề xuất này? Điều khoản hiện tại sẽ được giữ nguyên." → WITHDRAW; "Hủy phụ lục chờ ký" (APPROVED, cả hai bên thấy), confirm "Hủy phụ lục đang chờ ký? Chữ ký đã hoàn tất của một bên được lưu để đối chiếu; điều khoản hiện tại giữ nguyên." → CANCEL; toast "Đã lưu phản hồi." | AP:114-115,83-87 | POST amendments/{pid}/decision
C-213 | Bắt đầu soạn: chặn "Bản nháp dựa trên điều khoản cũ. Hãy bắt đầu lại và đối chiếu nội dung đang áp dụng." (baseRevision lệch), "Yêu cầu liên kết bản nháp đã đóng. Xóa bản nháp hoặc bắt đầu đề xuất mới."; nạp lại `restoreTerms`; ngày áp dụng mặc định theo AW `start`; nháp có listingSourceVersion → tải lại preview, lỗi "Bản bài đăng trong đề xuất đã cũ. Hãy cập nhật lại dữ liệu từ bài đăng." / "Không tải được bản bài đăng trong đề xuất. Hãy đối chiếu lại dữ liệu."; cuộn tới `contract-amendment-actions`, CPG chuyển sang tab content; cảnh báo rời trang (beforeunload → mobile chặn back) | AW | GET listing-sync
C-214 | Khung soạn: "Đang soạn phụ lục · Nội dung chưa có hiệu lực"; notice "Hướng dẫn soạn phụ lục" (nút "Xem hướng dẫn", summary "Điều chỉnh giá, cọc hoặc phí cần hai bên duyệt và ký.", đủ "Dùng bản bài đăng đã duyệt để cập nhật tài sản, tiện ích, nội thất và nội quy. Nhập các thỏa thuận riêng trực tiếp trên hợp đồng. Điều chỉnh giá, cọc hoặc phí cần hai bên duyệt và ký."); chip neo "Thông tin các bên, Tài sản thuê, Bàn giao, Giá thuê, Tiện ích, Phí dịch vụ, Nội thất, Nội quy" | AP:123 | —
C-215 | Chọn ngày: "Thời điểm áp dụng", "Mọi điều chỉnh chỉ áp dụng từ đầu kỳ thuê tương lai, sau khi hai bên ký đủ.", nút "{dd/MM/yyyy} · Đầu kỳ thuê"|"Chọn ngày trên lịch…" (disable khi không có ngày), "Chỉ chọn ngày đầu chu kỳ còn hợp lệ: …." | "Không còn đầu kỳ hợp lệ trong thời hạn hợp đồng. Không thể đổi giá/phí cho kỳ đã chốt hóa đơn."; bản thay thế chỉ cho ngày cũ | AEP; AP:123 | —
C-216 | Dialog lịch "Chọn ngày đầu kỳ áp dụng" / "Chỉ ngày được tô nổi bật mới có thể chọn. Ngày khác, kỳ đã chốt và ngày ngoài thời hạn thuê đều bị khóa." / "Ngày này là đầu chu kỳ thuê, không phải ngày 01 hằng tháng. Hệ thống không cho chọn tùy ý giữa kỳ."; parse ngày theo local (không UTC) | AEP | —
C-217 | Cạnh ô ngày: tài chính "Giá/phí mới dùng từ đầu kỳ tương lai. Chi phí kỳ trước theo đơn giá cũ; không sửa hóa đơn đã phát hành." / khác "Nội dung không ảnh hưởng tiền cũng áp dụng từ đầu kỳ thuê tương lai, không áp dụng ngay."; "Lý do và mô tả thay đổi" (≤2000); "Minh chứng bổ sung (tối đa 5 tệp)" jpeg/png/webp/pdf | AP:123 | —
C-218 | "Soạn thỏa thuận tài chính" (disable khi đã chọn bản bài đăng) ↔ "Đang soạn thỏa thuận tài chính riêng" + "Bỏ chỉnh sửa tài chính" (confirm "Bỏ phần chỉnh sửa giá, cọc và phí của đề xuất này?") | AP:124-137 | —
C-219 | Bản thay thế: "Chỉnh lại phụ lục chưa áp dụng" (summary "Bản ký cũ vẫn giữ nguyên lịch áp dụng cho đến khi hai bên ký đủ bản thay thế.", đủ "Đang chỉnh lại phụ lục chưa áp dụng, giữ ngày hiệu lực {d}. Bản ký cũ vẫn giữ nguyên lịch áp dụng cho đến khi người thuê duyệt và hai bên ký đủ bản thay thế. Hủy thao tác hoặc bản mới không hoàn tất không làm mất bản cũ.") | AP:138 | —
C-220 | Thanh nổi: "{n} nhóm nội dung đã chỉnh"; ListingSyncControl (disable khi editingFinancial; toast "Đã cập nhật dữ liệu vào phụ lục đang soạn."), "Bỏ bản bài đăng đã chọn", "Hủy" (confirm "Đóng chỉnh sửa? Thay đổi chưa lưu sẽ bị bỏ; bản nháp đã lưu vẫn giữ lại."), "Lưu nháp", "Xem lại thay đổi"/"Đang xử lý…" (disable !hasChanges) | AP:140 | listing-sync
C-221 | Validate payload (xem lại): "Chưa có dữ liệu hợp đồng.", "Hãy cập nhật lại dữ liệu bài đăng trước khi lưu phụ lục.", "Hãy lập đề xuất tài chính riêng cho thay đổi giá thuê, tiền cọc hoặc phí.", "Kiểm tra lại giá trị số/ngày đang nhập.", "Chưa có nội dung thay đổi.", "Lý do cần ít nhất 10 ký tự.", "Chọn đầu kỳ áp dụng hợp lệ; bản thay thế phải giữ ngày hiệu lực cũ."; mọi lỗi → toast (fallback "Không thực hiện được thao tác."), 1 thao tác 1 lúc (mutex) | AW `payload`,`run` | —
C-222 | "Lưu nháp" (không validate bắt buộc): upload minh chứng (tổng ≤5 "Tối đa 5 minh chứng.", không upload lại file đã lên) → PUT draft; toast "Đã lưu bản nháp riêng. Chưa gửi cho người thuê." | AP:70-82 | storage.uploadAmendmentEvidence, PUT amendments/draft
C-223 | "Xem lại thay đổi" → POST preview → dialog "Kiểm tra thay đổi trước khi gửi" / "Chỉ hiển thị nội dung thay đổi. Đồng ý nội dung chưa thay thế việc ký số."; checkbox "Tôi đã kiểm tra đúng nội dung và ngày áp dụng trước khi gửi cho người thuê."; nút "Quay lại chỉnh sửa", "Gửi đề xuất cho người thuê" (disable !consent) → toast "Đã gửi đề xuất cho người thuê. Điều khoản hiện tại chưa thay đổi." | AP:69,74-78,141-143 | POST amendments/preview, POST amendments
C-224 | Banner dialog: "Dự kiến áp dụng {d}" | "Áp dụng sau khi hai bên ký đủ" + ". Giữ nguyên hóa đơn đã phát hành và giao dịch ban đầu. Cọc tăng/giảm tạo khoản chênh lệch riêng sau ngày hiệu lực; cần bên nhận xác nhận nhận tiền."; "Lý do: …" | AP:142 | —
C-225 | Bảng so sánh: cột "Nội dung | Đang áp dụng | Đề xuất mới" (thay bản đã ký: "Phụ lục đã ký trước đó" | "Nội dung bản thay thế"); mobile = thẻ xếp dọc; format tiền/chế độ phạt/ân hạn 0 "Không thêm ngày ân hạn sau deadline (quy tắc hệ thống)" | AP:24-33,62-67 | —
C-226 | Người nhận + REQUESTED: dialog "Đề xuất điều chỉnh hợp đồng"; ghi chú "Nội dung cần chỉnh lại hoặc lý do từ chối"; checkbox "Tôi đã đọc và đồng ý với đúng nội dung đề xuất này. Phụ lục chỉ áp dụng sau khi ký đủ và đến ngày hiệu lực."; nút "Từ chối"/"Yêu cầu chỉnh lại" (disable note<10; "Ghi rõ lý do hoặc nội dung cần sửa (ít nhất 10 ký tự).") / "Đồng ý nội dung" (disable !consent) → "Đã đồng ý nội dung. Chủ nhà ký trước, sau đó người thuê ký." / "Đã lưu phản hồi."; trường hợp khác chỉ nút "Đóng"; không đóng được khi busy | AP:83-87,141-144 | POST decision APPROVE/REJECT/REQUEST_CHANGES
C-227 | Dialog khách "Bạn muốn điều chỉnh điều gì?" / "Nêu mong muốn để chủ nhà xem xét và soạn đề xuất cụ thể. Bạn được duyệt lại trước khi ký; không phản hồi đúng hạn thì yêu cầu đóng lại."; "Nội dung đề nghị" (≤2000, placeholder "Ví dụ: Tôi mong giảm tiền thuê từ 2 triệu xuống 1 triệu/tháng, từ kỳ tháng sau…"), "Minh chứng (không bắt buộc)"; "Hủy", "Gửi yêu cầu cho chủ nhà" (disable <10; "Nội dung yêu cầu cần ít nhất 10 ký tự."); toast "Đã gửi mong muốn cho chủ nhà. Chưa thay đổi điều khoản hợp đồng."; `requestId` UUID tạo khi mở dialog | AP:94-98,146 | POST amendments/tenant-requests

### 3.14 Ký: chế độ INTERNAL (`ContractSignaturePanel`, khi `signatureMode !== "SMARTCA"`)

C-230 | ACTIVE: "Hợp đồng giao kết thành công và đang có hiệu lực" / "Hai bên đã hoàn tất xác nhận thỏa thuận trên nền tảng HomeSpace"; "Xác nhận Bên A (Chủ nhà):" `landlordConfirmedAt` (in chuỗi thô) ‖ "Đã xác nhận nội dung"; "Xác nhận Bên B (Người thuê):" `signedAt` ‖ "Đã xác nhận ký" | SP | —
C-231 | `!signingAllowed` & DRAFT/PENDING_REVIEW: `blockedReason` ‖ "Chưa đủ điều kiện ký. Xem tiến trình nhận nhà phía trên." | SP | —
C-232 | CN + DRAFT: "Xác nhận gửi bản hợp đồng cho người thuê"; notice "Trước khi gửi hợp đồng"/"Vui lòng rà soát kỹ các điều khoản và bản xem trước trước khi gửi. Sau khi gửi, bản hợp đồng sẽ được chuyển sang trạng thái chờ người thuê xác nhận ký."; checkbox "Tôi xác nhận nội dung hợp đồng và đồng ý gửi bản này cho người thuê."; "Chế độ xác nhận hợp đồng nội bộ HomeSpace"; nút "Xác nhận và gửi người thuê"/"Đang gửi..." (disable !checkbox ‖ !canSend ‖ sending ‖ !CONTRACT_MANAGE; tooltip "Bổ sung đủ dữ liệu và kết xuất file xem trước trước khi gửi" / "Vui lòng tích chọn đồng ý trước khi gửi") | SP | POST send
C-233 | Khách + PENDING_REVIEW: "Xác nhận ký hợp đồng thuê" + chip "Chế độ xác nhận hợp đồng nội bộ - chưa tích hợp chữ ký số."; notice "Trước khi chấp thuận"/"Bạn đã hoàn tất thanh toán ban đầu. Vui lòng tải/xem lại văn bản hợp đồng trước khi xác nhận chấp thuận."; checkbox "Tôi đã đọc và đồng ý với toàn bộ nội dung hợp đồng và các phụ lục."; "Việc bấm xác nhận có giá trị xác lập quan hệ thuê nhà chính thức giữa hai bên."; nút "Xác nhận ký hợp đồng"/"Đang ký hợp đồng..." (disable !checkbox ‖ signing ‖ !CONTRACT_SIGN; tooltip "Vui lòng đọc và tích chọn đồng ý trước khi ký") | SP | POST sign
C-234 | CN + PENDING_REVIEW: "Đã gửi hợp đồng cho người thuê" / "Bạn đã xác nhận lúc {landlordConfirmedAt}. Đang chờ người thuê rà soát văn bản và hoàn tất xác nhận ký hợp đồng."; trạng thái/vai khác → không hiện gì | SP | —

### 3.15 Ký số SmartCA (`SmartCaSignaturePanel`; dùng cho HĐ thuê/phụ lục/gia hạn, và B-099 cho HĐ cọc)

Props: `{contract, state, isLandlord, isTenant, hasReadyPdf, signingAllowed=true, blockedReason, onUpdated}`. `myTurn` = (CN & status `DRAFT`) ‖ (khách & `TENANT_SIGNATURE_PENDING`). `pending` = request hiện hành ∈ CREATED, PENDING_USER_CONFIRMATION, PROVIDER_SIGNED, EMBEDDING. Request hiện hành = bản cục bộ (khi `state.activeRequest` chưa đổi tham chiếu) ‖ `state.activeRequest`. Nhánh xét **theo đúng thứ tự** C-240…C-247.

C-240 | EXPIRED/CLOSED/TERMINATED/CANCELLED: "Hợp đồng đã hết thời hạn thuê. Tiếp tục hoàn tất hóa đơn, bàn giao và hoàn cọc bên dưới; không cần ký lại hợp đồng gốc." / "Hợp đồng đã hoàn tất quyết toán. PDF đã ký được giữ nguyên để tra cứu." / "Hợp đồng đã chấm dứt. Không còn bước chờ ký số." / "Hợp đồng đã hủy. Không còn bước chờ ký số." | SCA:106-112 | —
C-241 | `!smartCaEnabled`: "Chế độ SmartCA đã được chọn nhưng kết nối VNPT chưa bật trên máy chủ. Vui lòng liên hệ quản trị viên." | SCA:113-117 | —
C-242 | ACTIVE: AMENDMENT "Hai bên đã ký đủ phụ lục. Xem trạng thái và ngày áp dụng ở bảng điều chỉnh phía trên." / khác "Hai bên đã ký số. Hãy tải PDF hoàn chỉnh để kiểm tra chữ ký." | SCA:119-123 | —
C-243 | FAILED và (!myTurn ‖ `failureCode==="PROVIDER_STATE_UNKNOWN"`): "{failureReason ‖ Xử lý chữ ký số thất bại.} Không gửi yêu cầu ký mới cho tới khi giao dịch cũ được đối soát." | SCA:125-129 | —
C-244 | REJECTED/EXPIRED/CANCELLED và !myTurn: `failureReason` ‖ "Yêu cầu ký đã kết thúc mà chưa có chữ ký. Hãy tải lại trạng thái hợp đồng để tiếp tục." + "Tải lại trạng thái hợp đồng" (lỗi toast "Chưa tải lại được hợp đồng.") | SCA:130-135 | —
C-245 | `!signingAllowed && !pending`: `blockedReason` ‖ "Chưa đủ điều kiện ký. Xem tiến trình nhận nhà phía trên." | SCA:136-138 | —
C-246 | `!myTurn && !pending`: CN + TENANT_SIGNATURE_PENDING "Chủ nhà đã ký số. Đang chờ người thuê ký cùng bản PDF."; khác "Hợp đồng đang chờ bên còn lại hoàn tất bước ký số." | SCA:140-146 | —
C-247 | Khung ký: "Ký số {hợp đồng cọc|phụ lục|hợp đồng} bằng VNPT SmartCA"; "Rà soát PDF trước khi gửi yêu cầu. Ứng dụng SmartCA xác nhận giao dịch; HomeSpace sẽ đóng gói và kiểm tra chữ ký trên PDF." | SCA:148-155 | —
C-248 | Đang chờ: CREATED/PENDING_USER_CONFIRMATION "Đang chờ bạn xác nhận trên ứng dụng VNPT SmartCA"; PROVIDER_SIGNED/EMBEDDING "Đã nhận kết quả ký; đang xác minh và lưu PDF"; "Mã tài liệu để đối chiếu trên app: {docId}"; "Trạng thái được đồng bộ bởi máy chủ ngay cả khi bạn đóng trang này."; nút "Kiểm tra ngay" | SCA:156-163 | POST signatures/{id}/refresh
C-249 | Poll refresh 5 s khi pending và app hiển thị (single-flight); lỗi im lặng đặt "Chưa đồng bộ được trạng thái ký số. Hãy kiểm tra lại; lỗi kết nối không có nghĩa yêu cầu đã bị từ chối."; bấm tay thêm toast "Không thể kiểm tra trạng thái ký số." (ưu tiên message BE) | SCA:57-83 | POST refresh
C-250 | Kết quả: SIGNED → toast "Chữ ký số đã được xác minh và lưu vào PDF hợp đồng."; mọi trạng thái ngoài pending → `onUpdated()` | SCA:63-72 | —
C-251 | Request cũ REJECTED/EXPIRED/FAILED/CANCELLED & vẫn đến lượt: hộp vàng `failureReason` ‖ "Yêu cầu ký chưa hoàn tất. Vui lòng kiểm tra trước khi thử lại." | SCA:165-166 | —
C-252 | `!hasReadyPdf`: "Cần kết xuất PDF của bản sửa đổi hiện tại trước khi ký." | SCA:167 | —
C-253 | "Chọn chứng thư SmartCA"/"Đang tải..." (disable busy ‖ !hasReadyPdf ‖ !CONTRACT_SIGN); 1 chứng thư → tự chọn; 0 → toast warning "Không tìm thấy chứng thư SmartCA hợp lệ cho CCCD của bạn."; lỗi "Không thể tải chứng thư SmartCA."; dropdown "Chọn chứng thư" mỗi dòng "{subject} — {serialNumber}" | SCA:85-93,168-172 | GET signatures/certificates
C-254 | Checkbox "Tôi đã đọc bản PDF và đồng ý ký số hợp đồng này."; nút "Gửi yêu cầu ký tới SmartCA" (disable busy ‖ !pdf ‖ !serial ‖ !consent ‖ !CONTRACT_SIGN); không dialog xác nhận | SCA:173-176 | POST signatures/initiate `{certificateSerial, consent:true}`
C-255 | Gửi xong: toast info "Đã gửi yêu cầu. Mở ứng dụng VNPT SmartCA trên điện thoại để xác nhận." + `onUpdated`; lỗi "Không thể gửi yêu cầu ký số." rồi vẫn `onUpdated` (nuốt lỗi thứ hai) | SCA:95-108 | —
C-256 | Giữ consent/serial/certificates/busy khi trang refresh signed-state (không remount panel) | DV:170-172 | —

### 3.16 Tài liệu & lịch sử tệp (`ContractDocumentSection`)

C-260 | Khối "Hợp đồng & các lần điều chỉnh" (neo `contract-document-history`); HĐ gốc có dữ liệu phụ lục: notice 4 biến thể: rút ngắn "Thời hạn thuê hiện tại theo phụ lục chấm dứt sớm đã ký; hợp đồng gốc và các điều chỉnh trước đó được giữ nguyên." / ACTIVE có n áp dụng "Điều khoản hiện tại theo hợp đồng gốc và {n} lần điều chỉnh đã áp dụng. Các mục không thay đổi vẫn theo văn bản trước đó." / "Chưa có phụ lục nào được áp dụng; điều khoản hiện tại theo hợp đồng gốc." / không ACTIVE "Hồ sơ lưu trữ: các mốc dưới đây ghi lại những điều chỉnh đã được áp dụng, không có nghĩa hợp đồng vẫn đang có hiệu lực." | DS | —
C-261 | HĐ gốc có HĐ cọc liên kết: "Đang tải HĐ cọc liên kết…" / "Chưa tải được HĐ cọc liên kết. Hãy tải lại trang để xem đầy đủ nguồn gốc hồ sơ." (cả khi id không khớp); card "1. Hợp đồng cọc" trạng thái "Đã hoàn tất HĐ cọc"/"Đã ký đủ hai bên"/"Chưa hoàn tất ký"; "{số HĐ} · Ký đủ: {t}" / "Chưa có bản ký hoàn chỉnh"; tệp + blockchain proof | DS | depositAgreementService.get (B)
C-262 | Card HĐ đang xem: "2. Hợp đồng thuê"(có HĐ cọc)/"Hợp đồng gốc"/"Hợp đồng cọc"/"Phụ lục đang xem"/"Văn bản gia hạn đang xem"; "Đã ký đủ hai bên"/"Chưa hoàn tất ký"; "Hoàn tất ký: {t}" / "Bản soạn thảo / đang ký chưa phải bản ký hoàn chỉnh."; có phụ lục áp dụng "Hợp đồng gốc được giữ nguyên; đọc cùng các điều chỉnh đã áp dụng bên dưới." | DS | —
C-263 | Mỗi card chỉ hiện **1 tệp** = `visibleDocument(rows, signed, currentRevisionId)` (5.6): giai đoạn ("Word soạn thảo · Không phải bản ký" / "PDF đã ký đủ hai bên" / "PDF chủ nhà đã ký · Chưa đủ hai bên" / "PDF trước khi ký" / "PDF bản xem trước" / "Tài liệu lưu trữ"), tên ‖ "Tài liệu {type}", dung lượng (B/KB/MB 1 số lẻ vi-VN, "Chưa có dung lượng") " · Tạo lúc {t}" | DS; lib/contract-document-history.ts | —
C-264 | Không có tệp: đã ký "Chưa tải được bản PDF ký đủ hai bên. Các tệp soạn thảo không thay thế bản ký hoàn chỉnh." / "Chưa có tệp sẵn sàng cho phiên bản hợp đồng hiện tại."; trạng thái khác READY/STALE: "Tạo tệp chưa thành công"/"Đang tạo tài liệu…"; "Chưa có tệp để mở" | DS:FileActions | —
C-265 | Nút "Xem bản đã ký"/"Xem bản đang soạn / ký" (card chính; chỗ khác "Xem") và "Tải PDF đã ký"/"Tải về"; luôn `getDocument(id)` lấy URL mới (id+contractId khớp, READY/STALE); lỗi "Không mở được tệp. Vui lòng tải lại hồ sơ hoặc thử lại." / "Không mở được tài liệu."; 1 thao tác 1 lúc. (web-only "Trình duyệt chặn cửa sổ tải về…") | DS:action | GET documents/{id}; POST content
C-266 | DOCX: web "Xem" mở viewer docx-preview; **mobile (đã chốt)**: tải về, mở bằng app của máy (cả "Xem" và "Tải") | DS; PVC | GET documents/{id}
C-267 | "Quá trình ghi nhận và ký" (gập; mở mới tải): "Gửi đề xuất điều chỉnh", "Hai bên thống nhất nội dung" (proposal đóng: dùng nhãn trạng thái), "Chủ nhà đã ký số", "Người thuê đã ký số", "Hoàn tất ký đủ hai bên", "Ghi nhận áp dụng điều chỉnh"; "Đang tải mốc ký…"; "Không tải được các mốc ký. Không suy đoán chữ ký từ tên tệp." + "Thử lại mốc ký"; "Không có mốc chữ ký số đã xác minh cho phiên bản tài liệu này."; thời gian rỗng "Chưa ghi nhận thời điểm" | DS:SigningHistory | GET signatures/state
C-268 | Rút ngắn: card "Phụ lục chấm dứt sớm" "Đã ký đủ hai bên", "Mốc kết thúc mới: {d} lúc 00:00 (không bao gồm ngày này). Hợp đồng gốc vẫn là bản đã ký riêng ở trên.", "Đang tải PDF phụ lục…", "Chưa tải được PDF phụ lục đã ký." + "Tải lại"; tệp + proof | DS | getEffectiveDocument
C-269 | Lỗi/đang tải lịch sử phụ lục: "Chưa tải được lịch sử điều chỉnh; không thể xác định đầy đủ các phụ lục." + "Tải lại lịch sử điều chỉnh"; "Đang kiểm tra lịch sử điều chỉnh…" | DS | amendments
C-270 | Card phụ lục: "Điều chỉnh lần {n}" (đánh số theo thứ tự đã ký) / "Đề xuất điều chỉnh" + " — " + tiêu đề; trạng thái `amendmentDocumentStatus`; "Ký đủ: {t} · Áp dụng sau khi ký đủ và được hệ thống ghi nhận" / "Áp dụng từ|Dự kiến áp dụng: d"; chưa áp dụng "Đề xuất này không thay đổi điều khoản của hợp đồng." (đã đóng) / "Điều khoản đang áp dụng chưa thay đổi bởi đề xuất này." | DS:AmendmentDocumentCard | —
C-271 | "Xem thay đổi ({n} nội dung)": "Lý do:", bảng so sánh "Trước điều chỉnh" / "Sau điều chỉnh"|"Nội dung đề xuất", "Phản hồi:", mốc ký | DS | —
C-272 | Tệp phụ lục: "Đang tải tệp phụ lục…", "Không tải được lịch sử tệp phụ lục." + "Tải lại tệp phụ lục"; proof khi đã ký; APPROVED "Mở phụ lục để xem và ký"; không có agreement "Chưa tạo văn bản ký. Đề xuất và phản hồi được giữ trong lịch sử điều chỉnh."; CN canReplace "Chỉnh lại phụ lục" | DS | GET documents + contracts/{agreementId}
C-273 | "Đề xuất không được áp dụng ({n})" (REJECTED/WITHDRAWN/EXPIRED/SUPERSEDED); chân "Bản ký và các tệp cũ không bị ghi đè. Nội dung trên giao diện là bản tra cứu; không thay thế PDF đã ký của từng văn bản." | DS | —

### 3.17 Trình xem PDF (`ContractPdfViewerModal` + `Content`)

C-280 | Modal toàn màn (mobile: màn/Modal full, nút back đóng); nhãn "Xem hợp đồng: {fileName‖PDF}" | PVM | —
C-281 | PDF SIGNED_FINAL READY: **chỉ** hiển thị bytes từ `POST documents/{id}/content?download=false` (BE kiểm toàn vẹn), không dùng viewUrl; "Đang kiểm tra và tải PDF đã ký…" + "Đóng"; lỗi = message BE ‖ "Chưa xác thực được tài liệu. Vui lòng thử lại." / "Chưa tải được PDF đã kiểm tra. Hãy thử lại; lỗi kết nối không có nghĩa tài liệu bị sửa." + "Thử lại"; huỷ request khi đóng, xoá file tạm | PVM:SignedPdfContent; CS:20-41 | POST content
C-282 | PDF khác: dùng `viewUrl ‖ downloadUrl` | PVC | S3 URL
C-283 | Header: tên file (mặc định `Hop_dong_{TYPE}.{ext}`), chip loại, "Đã ký đủ hai bên"/"Chủ nhà đã ký"/"Chính thức"/"Bản xem trước" | PVC | —
C-284 | Điều khiển: "Trang trước"/"Trang sau" + "n / N", zoom 50–250% bước 15 (mặc định 115%), "Xoay 90°", chế độ cuộn liên tục/từng trang, nhãn "Trang n"; "Tải về", "Mở trong tab mới", toàn màn hình, "Đóng". Mobile: pinch zoom + số trang + Tải/chia sẻ + Đóng | PVC | —
C-285 | Tải "Đang nạp và kết xuất văn bản hợp đồng ({type})..."; lỗi "Không thể hiển thị tài liệu trực tiếp" + chi tiết ("Không thể tải nội dung tài liệu." / "Không thể đọc và hiển thị tệp DOCX này." / "Tải tệp DOCX thất bại (HTTP {s})") + "Mở liên kết ngoài", "Tải về" | PVC | —

### 3.18 Gia hạn (`ContractLifecyclePanel mode="renewal"`; mode settlement → D-123…D-141, không chép lại)

C-290 | Khung "Gia hạn thời gian thuê" + nút "Làm mới vòng đời hợp đồng"; "Đang tải…"; lỗi inline "Chưa tải được vòng đời hợp đồng." (ưu tiên BE, giữ data cũ) | LP:68-86,161-165 | GET lifecycle
C-291 | Single-flight refresh; mỗi lần đọc thành công gọi `onUpdated` (kể cả lúc mount); realtime `payment-changed` (mọi), `invoice-changed` (đúng/không contractId), `agreement-changed` (contractId, không id, hoặc id văn bản gia hạn). Không tự poll | LP:68-91 | —
C-292 | 3 mốc: "Mốc hết thời hạn thuê" "{endExclusive thô} · 00:00 (không bao gồm ngày này)", "Mở yêu cầu trước 30 ngày" {renewalOpensAt}, "Hạn ký đủ văn bản gia hạn" {renewalSignBy} (giờ VN, "—") | LP:167-172 | —
C-293 | Notice "Gia hạn thời gian thuê"/"Kéo dài thời hạn thuê, khác với dời hạn thanh toán; chỉ áp dụng sau đủ chữ ký SmartCA." + chi tiết "Gia hạn thời gian thuê (kéo dài hợp đồng) khác dời hạn thanh toán của một hóa đơn. Giữ nguyên giá/chính sách và cọc, tạo văn bản mới liên kết bản gốc; chỉ áp dụng sau đủ chữ ký SmartCA. Hạn ký trước ngày chốt công tơ kỳ cuối để không thiếu tiền thuê kỳ tiếp theo." | LP:173-175 | —
C-294 | Khách, `!canRequestRenewal && !closure`: nút xám "Gia hạn thời gian thuê" + 1 trong 3: "Mở yêu cầu từ {t} (30 ngày trước khi hết hạn)." (serverNow < opens) / "Đã hết thời gian yêu cầu/ký gia hạn; tiếp tục thanh toán chi phí kỳ cuối và bàn giao." (≥ signBy) / "Chưa thể gửi yêu cầu mới. Kiểm tra hồ sơ gia hạn hoặc phương án chấm dứt đang xử lý bên dưới." | LP:176-183 | —
C-295 | Khách, `canRequestRenewal`: (đề nghị cùng kỳ đã REJECTED/EXPIRED) "Đề nghị trước đã bị từ chối hoặc hết hạn. Bạn có thể gửi đề nghị mới trong thời gian cho phép; lịch sử trước đó được giữ nguyên."; "Gửi yêu cầu gia hạn thời gian thuê"; "Số tháng thêm" (1–36, mặc định 3); lý do ≤1000 placeholder "Nhu cầu tiếp tục thuê (ít nhất 10 ký tự)"; "Gửi yêu cầu gia hạn"; lỗi "Chọn 1–36 tháng và nhập lý do ít nhất 10 ký tự." | LP:99-102,184-190 | POST lifecycle/renewals
C-296 | Thẻ gia hạn: "Thêm {n} tháng · {Chờ chủ nhà duyệt / Chờ ký văn bản gia hạn / Đã ký đủ · Đã áp dụng / Chủ nhà từ chối / Đã hết hạn duyệt/ký}"; "Từ {startsOn} đến trước {endExclusive}. Hạn duyệt: {t} · Hạn ký: {t}"; note; "Chủ nhà phản hồi lúc {t}" | LP:22,191-195 | —
C-297 | CN + REQUESTED: "Duyệt & tạo văn bản" → confirm "Duyệt yêu cầu gia hạn thời gian thuê?" / "Hệ thống tạo văn bản gia hạn giữ nguyên giá và chính sách. Hợp đồng chưa kéo dài cho đến khi ký đủ hai bên." / "Duyệt & tạo văn bản"; "Từ chối" (không confirm, không lý do) | LP:196-199 | POST renewals/{id}/approve|reject
C-298 | Link "Mở văn bản gia hạn · xem PDF & ký SmartCA ↗" khi có agreementContractId và (CN ‖ agreementStatus TENANT_SIGNATURE_PENDING ‖ ACTIVE) → chi tiết HĐ con; khách APPROVED chưa tới lượt: "Chờ chủ nhà kết xuất PDF và ký trước; sau đó bạn sẽ ký trên văn bản đã có chữ ký chủ nhà." | LP:200-201 | —
C-299 | Thao tác (mutex): thành công "Đã cập nhật hồ sơ hợp đồng."; lỗi "Thao tác chưa thành công." (ưu tiên BE) | LP:92-98 | —

### 3.19 Bằng chứng blockchain (`ContractBlockchainProof`)

C-300 | Chỉ render cho PDF + SIGNED_FINAL + READY; tiêu đề "Bằng chứng blockchain"; nhãn: NOT_AVAILABLE "Chưa có bằng chứng blockchain", PENDING "Đang chờ ghi nhận blockchain", SUBMITTED "Đang chờ xác nhận blockchain", CONFIRMED "Đã ghi nhận trên blockchain", FAILED "Ghi nhận blockchain chưa thành công"; "Đang tải bằng chứng…"/"Chưa kiểm tra được bằng chứng"; nút "Kiểm tra lại" | BC | GET blockchain-proof
C-301 | Poll 8 s chỉ khi PENDING/SUBMITTED và app hiển thị; quay lại foreground tải lại; lỗi "Chưa tải được bằng chứng blockchain. Lỗi kết nối không có nghĩa PDF đã ký bị sai."; từ chối proof không khớp documentId/contractId/revisionId | BC | —
C-302 | Notice "Ghi nhận blockchain"/"Ghi nhận hash của đúng PDF đã ký đủ hai bên để đối chiếu về sau." / "…Tệp PDF được giữ riêng tư." | BC | —
C-303 | "PDF đang lưu": tự gọi integrity-check; "Đang kiểm tra tài liệu…"; MATCH "PDF đang lưu khớp bản đã ghi nhận trên blockchain." / MISMATCH "PDF đang lưu không khớp bản đã ký. Tệp này bị chặn xem/tải để đối soát." / PENDING "PDF khớp bản đã ký. Đang chờ xác nhận cuối cùng từ blockchain." / NOT_AVAILABLE "Chưa có dữ liệu đối chiếu cho PDF cũ. Tài liệu chưa được xác thực blockchain." / UNAVAILABLE "Tạm thời chưa xác thực được PDF. Lỗi kết nối không có nghĩa file bị sửa." / MISSING "Không tìm thấy PDF đang lưu. Hệ thống cần kiểm tra hoặc khôi phục tài liệu."; "Kiểm tra lúc: {t}"; lỗi "Chưa kiểm tra được PDF đang lưu. Hãy thử lại; lỗi kết nối không có nghĩa file không khớp." | BC | POST integrity-check
C-304 | NOT_AVAILABLE "Tài liệu này chưa có proof. PDF đã ký vẫn xem và tải bình thường."; FAILED "PDF đã ký vẫn được lưu. Hệ thống cần kiểm tra việc ghi nhận blockchain; bạn không cần ký hay thanh toán lại." | BC | —
C-305 | "Mạng: Ethereum Sepolia (testnet)" (chainId 11155111) / "Chưa xác định"; "Ghi nhận lúc:"; "Xem giao dịch trên Etherscan" (chỉ chain đó + tx `^0x[0-9a-fA-F]{64}$`) | BC; lib/contract-blockchain-proof.ts | —
C-306 | "Thông tin đối chiếu": "SHA-256 của PDF đã ký", "ID tài liệu trên blockchain", "Mã hồ sơ liên kết các văn bản", "Loại văn bản" (1 Hợp đồng cọc, 2 Hợp đồng thuê, 3 Phụ lục), "Mã giao dịch", "Block ghi nhận" (mobile: cho sao chép/chọn chữ) | BC | —
C-307 | CONFIRMED: "Đối chiếu PDF từ bên ngoài" (notice "Dùng cho bản hợp đồng nhận qua email, Zalo hoặc lưu trên máy. PDF đang lưu trên hệ thống được kiểm tra tự động ở trên."), "Chọn PDF để đối chiếu"/"Đang đối chiếu…", "Tính hash ngay trên máy bạn và chỉ gửi hash để đối chiếu, không upload PDF. Tối đa 20 MB."; "Tệp: {name}" | BC | POST blockchain-proof/verify
C-308 | Lỗi tệp: "Tệp đang trống. Hãy chọn bản PDF đã ký." / "Hãy chọn PDF không quá 20 MB để đối chiếu trong trình duyệt." / "Trình duyệt chưa hỗ trợ tính hash ở địa chỉ này. Hãy dùng HTTPS hoặc localhost."; kết quả: "Tệp khớp với hash đã ghi nhận trên blockchain." / "Tệp không khớp với hash đã ghi nhận. Hãy kiểm tra bạn đã chọn đúng PDF cuối đã ký." / "Chưa tìm thấy proof trên blockchain. Hãy làm mới bằng chứng trước khi đối chiếu lại." / "Kết quả không thuộc bằng chứng đang xem. Hãy tải lại và đối chiếu lại." / "Chưa đối chiếu được với blockchain. Hãy thử lại; lỗi kết nối không phải kết quả hash không khớp." | BC | —

### 3.20 Chung (toast lỗi, dialog, notice)

C-310 | `getApiErrorMessage`: `errors[]` ("field: message; …") → `message` → `detail` → `error.message` → mặc định "Đã xảy ra lỗi, vui lòng thử lại." (vì ưu tiên `error.message`, lỗi mạng sẽ hiện chuỗi tiếng Anh của axios thay cho fallback) | utils/apiError.ts | —
C-311 | `PolicyNotice` (1 dòng tóm tắt + dialog nội dung đầy đủ, nút "Đã hiểu"; text nhiều câu → danh sách đánh số) — component chung, mobile tạo 1 lần (Pha 1) | components/common/PolicyDialog.tsx | —
C-312 | Dialog xác nhận của phần C: C-099, C-204, C-212, C-218, C-220, C-297. `window.confirm` của web → `useDialog` trên mobile, giữ nguyên chữ | — | —

## 4. Bảng API

Tiền tố `/api/v1`. Envelope `{result}`; `GET contracts` trả `PageResponse` trực tiếp. BE: `hs-api-service/.../controller/contract/`; CC = `ContractController`, CSC = `ContractSignatureController`, CAC = `ContractAmendmentController`, CLC = `ContractLifecycleController`, BPC = `ContractBlockchainProofController`, DIC = `ContractDocumentIntegrityController`.

| # | Method & path | Params / body | Trường dùng / hiển thị | Lỗi & ghi chú | BE |
|---|---|---|---|---|---|
| 1 | GET `/contracts` | role, page(1), size=12, agreementKind (BE còn nhận status, billableOnly, includeDepositFallback) | result[], totalPages; id, contractNumber, status, agreementKind, createdAt, effectiveLeaseMonths, depositAgreementContractId | C-019; BE: chỉ HĐ gốc, sort createdAt desc, khách không thấy DRAFT chưa đủ điều kiện | CC:158; CSI:375-431 |
| 2 | GET `/contracts/{id}` | — | toàn bộ `ContractResponse` (types/contract.type.ts:144-169) | detail: toast + về list; landing: 400/403/404 = missing | CC:174 |
| 3 | GET `/contracts/by-rental-request/{rid}` | includeDepositFallback? | HĐ hoặc null | dùng bởi B và DepositSettlementPanel (D) | CC:133 |
| 4 | GET `/contracts/{id}/revision` | — | landlord, tenant, property, lease, financial, initialPayment, amenities, charges, equipments, policies, meters, specialTerms, systemTerms, additionalTerms, schemaVersion, revisionNumber, id | fail → rời trang | CC:182 |
| 5 | GET `/contracts/{id}/completeness` | — | revisionId, complete, totalFields, missingFields[{key,label}] | fail khi tải đầu → rời trang | CC:211 |
| 6 | GET `/contracts/{id}/listing-sync` | AbortSignal | sourceVersion, baseRevisionId, terms, differences, financialDifferences, leaseMessage | C-195 | CC:190 |
| 7 | PATCH `/contracts/{id}/revision` | C-096 | revision mới | 6072 `CONTRACT_DRAFT_STALE` (409) → conflict; CONTRACT_MANAGE; chủ nhà + DRAFT + không phải con | CC:199; CSI:557-576 |
| 8 | POST `/contracts/{id}/previews` | ?expectedRevisionId, timeout 95 s | document | C-097; CONTRACT_MANAGE | CC:221; CSI:862-873 |
| 9 | GET `/contracts/{id}/preview-status` | timeout 10 s | document hoặc null | SMARTCA chỉ trả PDF đúng fingerprint | CC:231; CSI:1046-1062 |
| 10 | POST `/contracts/{id}/send` | — | contract | INTERNAL only; CONTRACT_MANAGE | CC:241 |
| 11 | POST `/contracts/{id}/sign` | — | contract | INTERNAL only; CONTRACT_SIGN | CC:275 |
| 12 | GET `/contracts/{id}/documents` | — | id, contractId, revisionId, documentType, purpose, status, storageObjectId, fileName, fileSize, generatedAt, viewUrl, downloadUrl | | CC:284 |
| 13 | GET `/contracts/documents/{docId}` | — | như trên (URL mới) | luôn gọi lại trước khi mở/tải | CC:292 |
| 14 | GET `/contracts/{rootId}/effective-document` | chỉ khi `agreedEarlyEndExclusive` | document hoặc null | kiểm chéo thêm 2 GET (CS:212-226) | CC:300; CSI:1382-1417 |
| — | `getEffectiveDocument` (ghép) | contract → root → #14, hoặc `/amendments` + documents của từng ứng viên + #13 (CS:205-250) | PDF SIGNED_FINAL của revision đang áp dụng | chuỗi lỗi: "Không xác định được hợp đồng gốc để đối chiếu văn bản đang áp dụng." / "Phụ lục chấm dứt không khớp hợp đồng đang áp dụng." / "PDF đã ký không khớp phụ lục chấm dứt đang áp dụng." / "Chưa xác định được phiên bản hợp đồng đang áp dụng từ hệ thống." / "Tệp nhận được không khớp phiên bản hợp đồng đang áp dụng. Vui lòng tải lại hồ sơ." | |
| 15 | POST `/contracts/documents/{docId}/content` | ?download=bool, body null | bytes PDF thô (`application/vnd.homespace.verified-pdf`, header `X-Document-Integrity`) | lỗi là JSON trong blob → `message` | DIC:29-50 |
| 16 | GET `/contracts/{id}/signatures/state` | — | signatureMode, smartCaEnabled, activeRequest (mới nhất của vai mình), allRequests | tải đầu fail → rời trang | CSC:40; SCS:116-138 |
| 17 | GET `…/signatures/certificates` | — | serialNumber, subject | 6020, 6021, 6022, 6024 | CSC:51 |
| 18 | POST `…/signatures/initiate` | `{certificateSerial, consent:true}` | id, status, docId, signerRole, failureCode, failureReason | CONTRACT_SIGN; idempotent (trả request đang chờ); 6022 giữ CREATED; 6028, 6029, 6031 | CSC:64; SCS:159-206 |
| 19 | POST `…/signatures/{rid}/refresh` | — | như #18 | 6027 | CSC:93; SCS:220-239 |
| 20 | GET `/contracts/{id}/lifecycle` | — | endExclusive, renewalOpensAt, renewalSignBy, canRequestRenewal, serverNow, renewals[], closure, billing, canProposeClosure, heldDeposit, refundPayment, balancePayment | từ chối HĐ cọc/HĐ con; có ghi dữ liệu (sync) | CLC:26 |
| 21 | POST `…/lifecycle/renewals` | `{months,note}` | lifecycle | BE: khách; 1–36; note 10–1000; tổng ≤120 tháng | CLC:27; LCS:80-91 |
| 22 | POST `…/lifecycle/renewals/{rid}/approve\|reject` | — | lifecycle | chủ nhà, REQUESTED, chưa quá respondBy | CLC:30,33 |
| — | closure/propose, final-costs, accept, dispute | → D (D-128…D-141) | | | CLC:36-45 |
| 23 | GET `/contracts/{id}/amendments` | — | serverNow, canPropose, blockedReason, currentTermsRevisionId, currentTerms, availableDates, proposals[] | C-201 | CAC:18 |
| 24 | GET `…/amendments/draft` | — | payload hoặc null | lỗi bỏ qua | CAC:26 |
| 25 | PUT `…/amendments/draft` | AmendmentPayload `{requestId, baseRevisionId, previousProposalId?, tenantRequestId?, effectiveOn, reason, changes, evidenceIds}` | payload | ≤14 key, ≤100k ký tự | CAC:27 |
| 26 | DELETE `…/amendments/draft` | — | — | | CAC:28 |
| 27 | POST `…/amendments/preview` | payload | terms, comparison[{field,label,before,after}] | message BE hiển thị nguyên văn | CAC:20 |
| 28 | POST `…/amendments` | payload | ContractAmendments | idempotent theo requestId (UUID) | CAC:23 |
| 29 | POST `…/amendments/tenant-requests` | `{requestId, message, evidenceIds}` | ContractAmendments | khách; message 10–2000 | CAC:24 |
| 30 | POST `…/tenant-requests/{rid}/decision` | `{action: ACCEPT\|REJECT, note?}` | ContractAmendments | REJECT note 10–2000 | CAC:25 |
| 31 | POST `…/amendments/{pid}/decision` | `{action: APPROVE\|REJECT\|REQUEST_CHANGES\|WITHDRAW\|CANCEL, note}` | ContractAmendments | web luôn gửi note (có thể rỗng) | CAC:29 |
| — | GET `…/amendments/options` | — | — | khai báo trong service, không UI nào trong phần C gọi → không cần port | CAC:19 |
| 32 | GET `/contracts/documents/{docId}/blockchain-proof` | — | types/blockchain.type.ts | C-301 | BPC:20 |
| 33 | POST `…/blockchain-proof/verify` | `{documentHash:"0x…"}` | matches, registered, chainId, registryAddress, onChainDocumentId | | BPC:26 |
| 34 | POST `/contracts/documents/{docId}/integrity-check` | — | documentId, status, checkedAt | | DIC:23 |
| 35 | storage: POST `/storage/uploads` → PUT presigned → POST `/storage/{id}/complete`; GET `/storage/{id}/view-url` | purpose GENERAL, PRIVATE, referenceType `CONTRACT_AMENDMENT_EVIDENCE`, referenceId=contractId (closure: `CONTRACT_CLOSURE_EVIDENCE` → D) | storageId, url | "Minh chứng cần là ảnh JPG/PNG/WebP hoặc PDF, tối đa 15 MB/tệp." / "Không thể tải tệp {name} lên kho lưu trữ ({status})." | services/storage.service.ts:36-86 |
| 36 | GET `/public/banks` | cache trong phiên | bin, code, shortName, name | C-169 | (chưa đọc controller) |

Thuộc B (chỉ gọi, không kiểm kê lại): onboarding get/refresh, `depositAgreementService.get`, `rentalWorkflowService.documents`. `createDraft` (`POST /contracts`) dùng bởi B. Endpoint BE không được web phần C gọi: templates/*, applicable-templates, payment-breakdown, pay-mock, signatures/{id} GET và retry (CSC:79,108).

DTO ký: `dto/signature/{SignatureStateDto,SignatureRequestDto,CertificateOptionDto,InitiateSignatureRequest}.java`; BE `failureReason` dựng sẵn tiếng Việt cho REJECTED/EXPIRED, FAILED dùng `failureMessage` (SCS:1101-1115).

## 5. Logic thuần cần port nguyên văn

Port kèm test so với module web. "Tách" = logic đang nằm trong component, đưa ra `.ts` khi port.

| # | Nguồn web | Nội dung |
|---|---|---|
| 5.1 | `lib/rental-labels.ts` | `contractStatus`, `describeNextAction`, `TAB_OF`, COPY, `DETAIL_TABS`, tone (đổi class sang token semantic) — dùng chung A/B |
| 5.2 | `components/contract/page/timeline.ts`, `nextStep.ts` | `leaseTimeline`, `deriveNextStep`, `primaryLabel` (nguyên file) |
| 5.3 | Tách: LV:22-63 (`turnOf`, `primaryAction`, `hint`, `GROUPS`, `groupOf`); AP:19-23 (nhãn status phụ lục); AW `activeAmendment`; LP:22 `renewalLabels` | |
| 5.4 | Tách PO `feeAfterDays` | `days = min(5, max(0, late - grace))`; PER_DAY = amount×days, ONCE = days>0 ? amount : 0; cap>0 thì min(fee, cap) |
| 5.5 | Tách CH `BILLING_METHOD_LABELS`, EQ `formatHandoverCondition` (rỗng "Còn tốt"; BRAND_NEW "Mới 100%", GOOD "Còn tốt", NORMAL "Bình thường", USED_ACCEPTABLE "Cũ, còn dùng được", MINOR_DAMAGE "Hư hỏng nhẹ"; tiền tố + ghi chú) | |
| 5.6 | `lib/contract-document-history.ts` | nguyên file (`primaryDocument`, `visibleDocument`, `requiresVerifiedContent`, thời gian giờ VN, nhãn phụ lục, `appliedAmendment`, `verifiedSignatureTimes`) — B cũng dùng |
| 5.7 | `lib/contract-preview.ts` | `generateContractPreview` + `isUncertainPreviewError` (mã lỗi mạng axios; kiểm lại trên RN; `AbortSignal.throwIfAborted`/`reason` có thể thiếu trên Hermes → kiểm) |
| 5.8 | `lib/contract-initial-meters.ts`, `lib/contract-amendment-input.ts`, `lib/contract-field-state.ts` (bỏ class), `lib/contract-property-feature-labels.ts`, `lib/contract-amendment-comparison.ts` | nguyên file |
| 5.9 | `lib/contract-routes.ts`, `lib/payment-module.ts` (`safeResourceId`, `safeInvoiceSelectionId`, `paymentQuery`, `contractLandingTarget`) | chung với D; mobile ánh xạ path → route |
| 5.10 | `lib/contract-blockchain-proof.ts` | giữ `supportsContractProof`, `blockchainProofPending`, `blockchainTransactionUrl`; `hashPdfForProof` thay `crypto.subtle` bằng `expo-crypto` (đã cài), giữ 3 lỗi |
| 5.11 | `lib/agreement-preview.ts` (B), `lib/rental-onboarding-read.ts` (B), `lib/vnd-input.ts` (chung A), `lib/split-sentences.ts`, `utils/apiError.ts`, `lib/profile-gate.ts` | dùng chung, port 1 lần |
| 5.12 | Tách AW: `restoreTerms`, `scheduledSource`, cách tính `changes`, `hasChanges`, `changedGroupCount`, `financial`, `payload()` | **rủi ro cao nhất**: so JSON.stringify theo thứ tự key; BE so `changes` khi idempotent |
| 5.13 | `D/ContractDraftEditor.tsx` (`draftEditorValues`, `draftContentPatch`); DV:251-287,300-346 (cờ meter/dirty/locked, dựng payload PATCH); DV:220-247 (`latestDoc`, `hasReadyCurrentDocument`) | tách |
| 5.14 | CS `getEffectiveDocument` | nguyên thuật toán |
| 5.15 | `components/contract/detail/utils.tsx` (`str`, `isZeroDeposit`, `formatMoney` → "VNĐ"); DV:68-69 (`money` "đ", `isoDate`) | giữ đúng 2 kiểu hậu tố |
| 5.16 | `P/usePolledRead.ts`, `hooks/useAgreementChangeSync.ts`, `hooks/useDetailTab.ts` | `document.visibilityState` → AppState + focus màn; bus thông báo (B 1.2); tab → state/route param |
| — | `types/{contract,contract-amendment,contract-lifecycle,blockchain}.type.ts` | copy (Pha 1) |

## 6. Lệch Web ↔ Backend

Mobile theo web (Q3). WC-1, WC-2 nên báo user vì người dùng bị kẹt hoặc gặp lỗi. Kết luận từ đọc code, chưa chạy thử.

| ID | Lệch | Web | Backend |
|---|---|---|---|
| WC-1 | **Chủ nhà có thể kẹt ở `LANDLORD_SIGNATURE_PENDING`**: BE đổi status trước khi gọi VNPT; VNPT từ chối ngay (lỗi ≠ unavailable) thì request FAILED (`VNPT_REJECTED`) nhưng **không** trả HĐ về DRAFT (FAILED là terminal, poll không đụng). Web `myTurn` chủ nhà chỉ nhận `DRAFT` nên hiện "…Không gửi yêu cầu ký mới cho tới khi giao dịch cũ được đối soát." dù BE cho chủ nhà ký lại ở LSP; sửa nháp cũng bị chặn (cần DRAFT) | SCA:46-47,125-129 | SCS:186-197,523-525,948-958,1019; CSI:575 |
| WC-2 | FAILED có `providerSignatureValue` (lỗi nhúng PDF) bị BE cấm ký lại (6031 "Cần đối soát yêu cầu ký cũ với VNPT trước khi gửi lại."); web chỉ chặn theo `PROVIDER_STATE_UNKNOWN`, nên khách đang đến lượt vẫn thấy form, bấm mới nhận toast lỗi (initiate còn lấy chứng thư trước đó bình thường) | SCA:125,165 | SCS:413-424,898-915 |
| WC-3 | Bản đang áp dụng (không rút ngắn): web tự suy từ `/amendments` + documents, trong khi BE đã có `/effective-document` xử lý cả nhánh này (nguồn `termsResolver`). Hai cách có thể lệch khi quy tắc đổi | CS:228-250 | CSI:1405-1417 |
| WC-4 | `EXPIRED/CLOSED`: web vẫn render khối phụ lục/đề nghị; BE chặn mọi tạo mới ("Chỉ hợp đồng đang có hiệu lực mới được điều chỉnh.") nên nút disable + hiện `blockedReason` (không lỗi, chỉ thừa) | END:50,78-83 | ContractAmendmentService `blocked` |
| WC-5 | HĐ con `DRAFT` (gia hạn/phụ lục): `childStep` bỏ DRAFT nên trang con không có thẻ "bước tiếp theo" dù chủ nhà phải kết xuất + ký. BE coi DRAFT là lượt chủ nhà | NS:130-131 | SCS:1019 |
| WC-6 | Danh sách: HĐ cọc `DRAFT` phía chủ nhà hiện gợi ý "Bản nháp đang chờ bạn hoàn thiện." và nút "Mở hồ sơ" (không phải "Ký số") dù nhãn là "Chờ chủ nhà ký" và HĐ cọc không sửa được (BE `rejectDepositEdits`) | LV:28,35,50 | CSI:558; RL:40 |
| WC-7 | Web khai báo `agreementKind:"RENEWAL"` nhưng BE để `null` cho văn bản gia hạn (web đã fallback theo `parentContractId`; mobile giữ fallback) | types/contract.type.ts:156-157 | LCS:101-106 |
| WC-8 | `GET lifecycle` có tác dụng phụ (đồng bộ: hết hạn HĐ, đóng gia hạn quá hạn, huỷ HĐ con) dù web coi là đọc và poll 30 s | CPG:61 | LCS:77-79,405-436 |
| WC-9 | Nội bộ web (không phải BE): "Xem lịch sử tệp" ở HĐ cọc cuộn tới `contract-document-history` không tồn tại (C-151); nhánh "quản lý trên hợp đồng gốc" của tab payment không tới được (C-130); `ContractSignaturePanel` in `landlordConfirmedAt/signedAt` dạng ISO thô | HIS:67; PAY:26; SP | — |
| — | B-doc đã ghi (WB-*) lệch của onboarding/cọc, không lặp | | |

Khớp đã kiểm: quyền `CONTRACT_MANAGE` (revision/previews/send) và `CONTRACT_SIGN` (sign/initiate) (CC:144-275, CSC:63); lỗi 6072; validate gia hạn 1–36/10–1000; ghi chú phụ lục ≥10; minh chứng ≤5, jpeg/png/webp/pdf; hạn phản hồi/ký phụ lục 48 h (cấu hình, web chỉ hiển thị `respondBy/signBy`).

## 7. Mobile hiện có (sẽ thay thế)

| Chỗ | Hiện làm | Thiếu so với web |
|---|---|---|
| `src/screens/ManagementScreen.tsx:66,74` | Menu "Hợp đồng thuê" (web: "Hợp đồng đi thuê") và "Hợp đồng cho thuê" | tab cọc/thuê, chip nhóm |
| `src/services/managementApi.ts:146-154,344-360,397-405` | `GET /contracts?role=`; type chỉ 7 trường; thẻ: mã HĐ, "Thanh toán", "Ngày tạo", "Ngày ký" | không gửi `agreementKind`; thiếu nhãn loại, gợi ý lượt, nút hành động, poll |
| `ManagementScreen.tsx:152,218-228,364-382` + `managementApi.ts:667-672` | Liệt kê mọi document, mở `viewUrl/downloadUrl/storage view-url` bằng `Linking.openURL` | không GET chi tiết/revision/chữ ký; bản SIGNED_FINAL không đi qua `/content` có kiểm toàn vẹn |
| `managementApi.ts` `statusLabel` (~:175-205) | map trạng thái chung | `PENDING_REVIEW` hiện "Chờ kiểm duyệt" (web "Chờ xác nhận"), `EXPIRED` "Hết hạn", `CLOSED` "Đã kết thúc" (web "Đã đóng") |
| `src/lib/notification.ts:386-391` | `/dashboard/contracts/…` → `management-choice` (người dùng chọn vai) | mất id + `?tab`; cần bộ phân giải landing (1.3). `/dashboard/{landlord\|tenant}/contracts/{id}` cũng khớp sai: `second` là `landlord/tenant` nên → none |

Chưa có: trang chi tiết/tab, ký SmartCA, nháp, phụ lục, gia hạn, blockchain, trình xem PDF. Không có gì trong phần C đáng giữ ngoài cách tải + chia sẻ tệp (`components/chat/ChatDocument.tsx:35-66`, `services/billingApi.ts:78-93`).

## 8. Ghi chú thiết bị

### 8.1 Xem PDF trong app (đã chốt Q1)

**Đề xuất: `react-native-pdf-renderer@2.3.0` (ghim đúng bản).** Kiểm bằng `npm view`/`npm pack` ngày 25/11/2026:

| Tiêu chí | Kết quả |
|---|---|
| Phiên bản/bảo trì | 2.3.0 (12/08/2025); 3.0.0 và 3.0.1 mới phát hành **hôm nay** (25/11/2026) nên chưa dùng. MIT, 1 maintainer (rủi ro) |
| Tương thích | peer `react-native >=0.71` (app 0.81.5, `newArchEnabled=true`); gói 2.3.0 có `codegenConfig` (Fabric) + thư mục `newarch/oldarch` |
| Native | **cần build lại** (`npx expo run:android` / EAS), không chạy trên Expo Go; app đã có `expo-dev-client` |
| Config plugin | không cần (autolink); 0 dependency, dùng `PdfRenderer`/`PDFKit` của hệ điều hành |
| Giới hạn | chỉ nhận **file cục bộ** `file://` (hợp vì bản ký phải tải có token); có pinch zoom, cuộn nhiều trang, `onPageChange`, `onError`; README không nêu tìm/chọn chữ, xoay, mật khẩu |

Phương án thay: `react-native-pdf@7.0.5` + `@config-plugins/react-native-pdf@12.0.0` (peer `expo ^54`; bản 13+ cho SDK 55+) + `@config-plugins/react-native-blob-util` + `react-native-blob-util` **phải ghim 0.24.x** (bản mới nhất 1.1.1 đòi `react-native >=0.84`). Nhiều tính năng hơn nhưng thêm 4 gói. Chưa build thử gói nào: Pha 1 phải build Android và mở 1 PDF ký thật trước khi viết UI.

Cách dùng: PDF SIGNED_FINAL → axios `POST …/content` (giữ interceptor token), `responseType:"arraybuffer"` → ghi bằng `expo-file-system` vào cache → viewer; lỗi trả JSON trong body nhị phân phải decode lấy `message` (thay `Blob.text()`). BE cũng nhận GET (DIC:29) nếu POST nhị phân trục trặc. PDF khác: tải `viewUrl ?? downloadUrl` về cache rồi mở. Xoá file cache khi đóng. "Xoay 90°", chọn chế độ 1 trang, "Mở trong tab mới", toàn màn hình: bỏ (khác web, chờ duyệt).

### 8.2 DOCX và tải về

`expo-file-system` + `expo-sharing` (đã cài), theo mẫu `ChatDocument.tsx:35-66` (hộp "Mở hoặc lưu tài liệu") — không cần build lại. Share sheet cho chọn app mở/lưu; nếu user muốn mở thẳng (ACTION_VIEW) thì thêm `expo-intent-launcher` (native). Nút "Tải…" của PDF cũng đi share sheet. Tên: `fileName ?? "hop-dong-da-ky.pdf"`, bỏ ký tự đường dẫn.

### 8.3 SmartCA

- Web không có deep link sang app VNPT SmartCA; chỉ yêu cầu người dùng tự mở app. Trên cùng điện thoại: gửi yêu cầu → người dùng chuyển app → quay lại. Gọi `refresh` ngay khi AppState `active`, poll 5 s khi foreground; server tự poll nên không mất kết quả. Hạn giao dịch 5 phút.
- Không tự đặt URL scheme của SmartCA (không có nguồn trong repo).
- "Mã tài liệu để đối chiếu trên app: {docId}" nên cho sao chép/chọn chữ.
- Chữ "trên điện thoại"/"đóng trang này" giữ nguyên theo web trừ khi user duyệt đổi.

### 8.4 Bố cục

| Web | Mobile |
|---|---|
| Bảng tiện ích/phí/nội thất/đặc điểm/thanh toán ban đầu (`min-w` rộng, cuộn ngang) | mỗi dòng 1 thẻ nhãn–giá trị |
| Bảng soạn phụ lục `min-w-[680px]` | mỗi dòng 1 form card, nút xoá trong card |
| Bảng so sánh | dùng bản mobile web đã có (thẻ xếp dọc, AP:31) |
| 6 tab | thanh tab cuộn ngang (`DetailTabs` chung) |
| Thanh nổi Lưu/phụ lục | footer cố định trên safe area, tránh bàn phím |
| `<form>` + `reportValidity`, cuộn tới id | validate JS, lỗi dưới ô, cuộn theo ref (tự thay các ràng buộc C-168) |
| `beforeunload`, `keepMounted` | state nháp đặt trên tab; chặn back kèm `useDialog` khi dirty/đang soạn |
| Lịch chọn ngày chỉ bật ngày hợp lệ | danh sách `availableDates` dạng chọn 1 (ít code hơn, giữ chữ C-215/216) hoặc `react-native-ui-datepicker` (đã cài) |
| `window.open` minh chứng/Etherscan | `expo-web-browser` |
| `<input type=file>` | `expo-document-picker` (nhiều tệp, lọc MIME, check 15 MB / 20 MB) |
| `crypto.randomUUID`, `crypto.subtle` | `expo-crypto` |
| Poll theo `visibilityState` | AppState + màn đang focus; dừng khi màn bị che |
