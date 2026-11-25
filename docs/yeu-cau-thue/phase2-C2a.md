# Pha 2 — phần C2a: hợp đồng (landing, danh sách, chi tiết)

Web `hs-web-app` là chuẩn. `contract/` = `src/components/rental/contract/`.

Trạng thái: **XONG phần code** (chưa thử trên thiết bị, chưa chạy Metro/bundle).

| Mục | ID | Trạng thái |
|---|---|---|
| `screens/rental/ContractLandingScreen.tsx` | C-001…C-006 | done (C-006 do `normalizeRentalRoute` làm, không có chữ "Đang mở thanh toán & hóa đơn…") |
| `screens/rental/ContractListScreen.tsx` | C-010…C-029; C-030 gắn component B | done |
| `screens/rental/ContractDetailScreen.tsx`, `contract/useLeaseDraft.ts` | C-040…C-050, C-090…C-103, C-120…C-124, C-160…C-162 | done |
| `contract/ContractPage`, `ContractSummary`, `pageHooks` | C-051…C-065 | done |
| `contract/ContractHeader` (+ `DraftActionBar`) | C-070…C-086 | done (chuỗi chặn popup của C-078 bỏ) |
| `contract/DraftActionsCard`, `OverviewTab`, `PaymentTab`, `EndTab`, `HistoryTab` | C-104…C-152, D-170, D-171, D-020, D-032 | done |
| Section nội dung (đọc + soạn nháp), `fields`, `InlineAmendmentFields` | C-163…C-181, C-183…C-195 | done; nhánh phụ lục của C-174, C-176 đã viết nhưng chỉ tới được khi C2b bật `editing` |
| Bảng soạn phụ lục (default export của `InlineAmendmentFields`) | C-182 | **C2b** (placeholder) |
| §3.13 phụ lục, §3.18 gia hạn | | **C2b** (placeholder) |
| `contract/contractDetailLogic.ts`, `tests/rental-contract-detail.test.cjs` | | 14/14 |

File C1 đã sửa: **chỉ** `ContractDocumentSection.tsx`: import `./anchors` và bọc hai khối `contract-document-history`, `contract-blockchain-proof` bằng `<Anchor id=…>` (làm trước khi được báo có agent khác sửa file C1; agent đó phải giữ lại, nếu mất thì hai liên kết ở header chỉ đổi tab, không cuộn).

## Điểm mở rộng cho C2b

1. `contract/ContractAmendmentWorkspace.tsx`: mới có phần đọc (`data`, `error`, `load`, `savedDraft`, poll 30 s, realtime). Thêm state soạn thảo vào `useWorkspaceState` và type `AmendmentWorkspace` (luật thuần có sẵn ở `@/lib/rental/ContractAmendmentWorkspace`), thay `start` tạm, bỏ qua poll/sync khi `editing || busy`. `ContractDocumentSection` đã nhận workspace này.
2. `contract/InlineAmendmentFields.tsx`: viết lại default export `{group: rent|residents|charges|equipments|amenities|rules}`. Các section đã gọi đúng chỗ như web. `ContractTermFields`, `ContractEditField`, `BillingSystemRuleLabels` dùng được cho cả hai chế độ (`draft ?? amendment.editing`). Tiện ích/nội thất trong section chỉ đọc (đổi qua `listingSync`), như web.
3. `contract/ContractAmendmentPanel.tsx` `{contractId, actorId, perspective, agreementId?, onNavigate}`: đã gắn ở tab Kết thúc (`AmendmentSlot where="end"`), tab Nội dung khi `editing`, tab Ký số của HĐ phụ lục (`contractId` = HĐ gốc). Như web, phải tự bọc workspace khi `contractId` khác.
4. `contract/ContractRenewalPanel.tsx` `{contractId, isLandlord, onUpdated?, onNavigate}`: đã gắn ở `EndTab` với key `actorId:contractId`.
5. Thanh nổi phụ lục: đặt cạnh `DraftActionBar` trong biến `footer` của `ContractDetailScreen` (nằm trong workspace provider).
6. Chặn rời trang khi đang soạn phụ lục: hàm `leave` nằm **ngoài** provider; C2b phải đưa `editing` lên (component con trong provider gọi setter) rồi thêm vào điều kiện của `leave`.
7. Cuộn: bọc `<Anchor id="contract-amendment-actions">` rồi `useAnchors()?.scrollTo(...)`. Việc ép sang tab Nội dung khi `editing` đã có.

## Khác web

- HĐ cọc `DRAFT` phía chủ nhà: **không vẽ thanh nổi** (xem lỗi web 1; khớp parity-C §2.1).
- HĐ cọc: "Bằng chứng blockchain" chuyển sang tab Ký số (web: neo không tồn tại, bấm không có gì).
- Thanh nháp là footer cố định. Bảng → thẻ từng dòng (bỏ tiêu đề cột "Tên tiện ích", "Tên tài sản / Thiết bị"). Tooltip → chữ dưới nút.
- `reportValidity()` → `draftFieldErrors` (lỗi dưới ô + cuộn tới "Thông tin hai bên"). Chữ chỉ có trên mobile, cần user duyệt: "Email không hợp lệ.", "Số tài khoản gồm 1 đến 34 chữ số.", "Nhập số nguyên từ {min} đến {max}."
- Rời màn khi nháp chưa lưu (Back, liên kết sang màn khác, link KYC) hỏi trước; chữ mobile: "Rời trang?" / "Bỏ các chỉnh sửa chưa lưu trên trang này." / "Rời trang". Bấm tab dưới cùng của app hoặc app tự chuyển màn thì không chặn được (nháp mất).
- Thông báo của "Cập nhật dữ liệu từ bài đăng" được ghép vào hộp thoại kết quả kế tiếp (`useDialog` chỉ hiện một thông báo, cái sau đè cái trước; web xếp chồng toast).
- Ngân hàng dùng `BankPicker` sẵn có (tìm kiếm được): "{code} - {shortName}" + tên. Link KYC → `openSettings('account-security')` (sửa đợt cuối).
- `EndTab` truyền thêm `contractId={contract.id}` cho `RentalWorkflowPanel` early-exit (web EndTab không truyền; theo yêu cầu của B, chỉ dùng để lọc tín hiệu realtime). Landing truyền đúng như web.
- D-020: cuộn tới hoá đơn một lần khi màn mở với `section=monthly` (web cuộn theo hash `#monthly-invoices`). D-032: chọn kỳ thì replace route, không cuộn.
- Thẻ đăng nhập của landing chỉ hiện khi không đọc được phiên.

## Lỗi web phát hiện (chưa sửa web)

1. `ContractDetailView.tsx:490-494` + `ContractHeader.tsx:234`: HĐ cọc `DRAFT` của chủ nhà vẫn hiện thanh nổi; "Kết xuất file" không làm gì (`handleRender` thoát vì `revision` null, DV:297), "Gửi cho người thuê" luôn khoá.
2. `ContractDetailView.tsx:289-291`: còn lỗi chỉ số/phí thì mọi lần đổi tab bị kéo về "Nội dung hợp đồng" (đã port giống).
3. HĐ cọc đã ký: liên kết "Bằng chứng blockchain" ở header trỏ tới phần tử không tồn tại.

## Cần người khác

`package.json`: `"test:rental-contract-detail": "node --test tests/rental-contract-detail.test.cjs"`.

## Kiểm tra

`npx tsc --noEmit` sạch (gồm cả billing/); eslint + prettier file C2a sạch; test C2a 14/14; `rental-logic` 28/28, `rental-nav` 11/11, `rental-api` 15/15, `rental-onboarding` 26/26, `rental-contract-signing` 11/11, `theme` 5/5. Đã đối chiếu chuỗi tiếng Việt hai chiều với nguồn web (script tạm).

Đường vào (đọc mã): menu Quản lý "Hợp đồng cho thuê"/"Hợp đồng đi thuê" → danh sách → chi tiết; `AgreementDocumentActions`, `DepositAgreementPanel` dẫn tới chi tiết; "Xem hóa đơn" → landing → tab Thanh toán. Chạm thông báo chưa nối (Pha 3).

## Chưa kiểm trên thiết bị

Toàn bộ giao diện; cuộn tới neo (`measureLayout`), D-020; bàn phím với footer thanh nháp; hộp thoại rời trang với Back Android; chọn ngân hàng/ngày trong ScrollView; gọi backend thật (lưu, kết xuất, 6072, gửi). Tab mặc định đổi theo onboarding như web (C-045): khi bước tiếp theo đổi mà route chưa có `?tab=`, tab tự nhảy và panel đang mở bị unmount.

## Sửa sau review (đợt cuối)

Theo `review-C2-codex.md` / `review-C2-xu-ly.md`.

| # | Mã | Kết quả |
|---|---|---|
| 1 | RC2-01 | **Đã sửa (chỉ giảm rủi ro).** Nút "Gửi cho người thuê" ở thanh đáy đọc lại hợp đồng + tài liệu và so với revision/tệp đang hiện (`submitIfCurrent`, `readSigningSource` — cùng phép so với panel ký); chung một khoá single-flight với panel. Không thêm trường request; khe hở giữa lúc đọc và POST vẫn cần backend. |
| 2 | RC2-03 | **Đã sửa.** Bỏ hoặc chọn lại nguồn bài đăng (và mở phiên soạn mới) làm mất hiệu lực lượt đọc đang chạy, kể cả thông báo lỗi của nó. |
| 3 | RC2-05 | **Đã sửa.** Bỏ `maxLength={2}`; kiểm cả chuỗi đã gõ/dán (`parseDays`, chỉ chữ số) trong 1..36, câu lỗi như web. Chặt hơn web: `1e1`, `0x10` bị bác. |
| 4 | RC2-09 | **Đã sửa.** Link KYC mở `account-security` (`ProfileGateSection` thêm giá trị này), vẫn hỏi trước khi bỏ nháp. |
| 5 | RC2-10 | **Đã sửa.** Landing lỗi và link hoá đơn cũ có ID sai về danh sách theo vai của màn gọi (route gần nhất trong stack), không có thì theo vai đang chọn ở Quản lý (`stackSide`; sửa `routes.ts`, `RentalNavigator.tsx`, `App.tsx`, `ContractLandingScreen.tsx`). |
| 6 | RC2-12 | **Đã sửa.** Minh chứng phụ lục mở qua `useOpenStorage` (phần D): đóng hộp / rời màn / tệp không còn trong danh sách thì không mở, không báo lỗi. |
| 7 | RD-12 | **Đã sửa phần còn lại.** `sharePdf(uri, wanted?)` hỏi lại ngay trước `Sharing.shareAsync` (biên lai: keyed theo khoản và unmount cùng hộp nên `isAlive` đủ). Khiếu nại: mã phiên mở hộp/hồ sơ, mở lại cùng ID là phiên mới; kiểm ngay trước khi mở trình duyệt. |
| 8 | Báo thành công giả (onboarding) | **Đã sửa.** `createProofFlow.submit` chỉ trả khoản đã cập nhật khi `evidences` chứa đúng storage id vừa gửi (`assertProofRecorded`, tách từ helper RD-11 của billing, cùng câu `PROOF_NOT_RECORDED`). Thiếu: giữ tệp đã chọn, tải lại khoản, không đóng form, không báo thành công, không gọi `onPaymentSuccess`. Nếu sau khi tải lại khoản đã `TRANSFER_REPORTED` thì form tự ẩn. |
| 9 | RC1-05 | **Đã sửa.** `ContractHeader` tải PDF đã ký bằng `shareSignedDocument` (xoá bản tạm). |
| 10 | Ký bị chặn sau khi lưu nháp | **Đã sửa.** Lưu nháp tạo revision mới nhưng màn giữ `contract.currentRevisionId` cũ nên panel ký không thấy tệp; `useLeaseDraft.onSaved` cập nhật qua `withSavedRevision` (đúng hợp đồng, kể cả khi kết xuất sau đó lỗi). Giữ nguyên bộ lọc theo revision. |

### Khác web (chờ duyệt)

- Chứng từ onboarding: web báo "Đã gửi chứng từ…" với mọi phản hồi thành công, kể cả khi khoản đang giữ chứng từ của lần báo khác.
- RC2-03: web vẫn gán lại bản bài đăng đã bỏ khi phản hồi cũ về.
- RC2-01: web gửi thẳng theo ID hợp đồng. Mobile đọc lại trước khi gửi; nếu đã đổi thì hiện câu "Văn bản ký đã thay đổi…" kèm nút "Đóng" / "Tải lại"; không đọc được thì hiện "Chưa kiểm tra lại được văn bản sẽ ký…".

### Kiểm tra đợt cuối

`npx tsc --noEmit` sạch; eslint + prettier các file đã sửa sạch (`prettier -c tests/*.cjs` còn cảnh báo ở 8 file không sửa trong đợt này); mọi script `test*` trong `package.json` đều qua. Test thêm ở `rental-contract-signing`, `rental-contract-amendment`, `rental-nav`, `rental-billing`, `rental-onboarding` (một phần là kiểm chuỗi mã nguồn, không render component). `ListingDetailScreen.tsx` cũng truyền `role` cho `RentalNavigator`.

Chưa kiểm: thiết bị/emulator, Metro/bundle, backend thật (nút gửi sau khi lưu + kết xuất, bảng chia sẻ, mở trình duyệt, link KYC, nút quay về).

## Sửa sau đối chiếu

Theo `audit-C-codex.md`.

- **C-177 — đã sửa.** `VndMoneyInput` ghi lại vùng chọn (`onSelectionChange`) kể từ lần đổi trước; `editVndText` nhận ra thay thế vùng chọn > 1 ký tự và kiểm đoạn dán theo `parsePastedVnd`, ghép phần còn lại như web. Chịu được cả hai thứ tự sự kiện (vùng chọn trước/sau chữ). Chuỗi sự kiện mơ hồ (hai cách đọc cho hai số khác nhau) hoặc vùng chọn không khớp chữ: báo lỗi dán, không đoán; lần xoá kế tiếp chạy bình thường. Mọi ô tiền sửa được trong luồng thuê đều dùng component này (`ClosureProposalForm`, `FinalCostsForm`, `InvoiceDraftForm`, `ContractFinancialSection`, `ContractPoliciesSection`, `InlineAmendmentFields`); ngoại lệ "Tiền cọc đề xuất" (`RequestFormDetails`) lọc chữ số y như web (`RentalRequestModal.tsx:1063`), giữ nguyên. Test hồi quy ở `rental-ui`. Chưa thử thứ tự sự kiện trên thiết bị.
- **C-006 — đã sửa.** `navigateStack` giữ route `invoice-landing` hợp lệ; `RentalNavigator` hiện "Đang mở thanh toán & hóa đơn…" rồi replace sang đích cũ. ID sai vẫn ra `link-error`. Deep link vẫn chuẩn hoá thẳng (`deep-link.ts`, không đổi).
- **C-018 — không đổi (audit chưa đúng cho mobile).** "Đang tải hợp đồng…" của web là fallback Suspense quanh `useSearchParams` (chỉ hiện trước khi trang hydrate). Mobile nhận tham số đồng bộ, không có trạng thái chờ khởi tạo; lúc tải dữ liệu cả hai đều hiện "Đang tải…".
- **C-040 — đã sửa.** Dùng `useViewer` (subject của phiên, như landing web so với `landlordId`); bỏ lần đọc hồ sơ riêng và nút "Thử lại".
- **C-064 — đã sửa.** Thẻ có dòng phụ được giữ dù dòng chính là "—".
- **C-070 — đã sửa.** Nút về danh sách / hợp đồng gốc ở header đẩy route (web `router.push`).
- **C-164 — đã sửa cho ô nhập chữ/tiền/ngày.** `ContractEditField` cấp màu chữ theo trạng thái (`FieldTextColor` trong `FieldFrame`; `text-primary` / `text-success` / `text-foreground`).
- **C-176, C-182 — không đổi (giữ khoá khi bận).** Request có chụp payload lúc bấm, nhưng sửa trong lúc chờ vẫn mất im lặng: gửi phụ lục gửi `review.payload` rồi `stop()` bỏ giá trị mới; xem trước cũng vậy; lưu bản nháp chờ tải minh chứng rồi báo "Đã lưu" bằng giá trị cũ.
- **C-216 — đã sửa.** Lịch nhận `range` (tô ngày hợp lệ, giới hạn tháng, ẩn ngày ngoài tháng), giữ bộ lọc từng ngày; chưa chọn thì không tô ngày đầu là "đã chọn".
- **C-248 — đã sửa.** "Kiểm tra ngay" không khoá, không spinner; vẫn single-flight (`refreshFlight`).
- **C-283 — CHƯA sửa.** Header là `pdf/PdfViewerModal` (agent khác đang giữ, đợt này không sửa); cần thêm prop `badge?: string` vẽ chip cạnh tiêu đề, rồi `ContractPdfViewerModal` truyền `badge={doc.documentType}` và bỏ loại tài liệu khỏi `subtitle`.
- **C-295 — đã đạt, không đổi logic.** Panel gia hạn dùng `parseDays` của billing, nay đọc như ô số của web (D-087, agent khác sửa): "3.0" = 3, vẫn kiểm 1–36. Thay ghi chú RC2-05: `1e1` được nhận như web, `0x10` vẫn bị bác. Chỉ sửa comment và thêm ca test ở `rental-contract-amendment`.
- **C-311 — đã sửa.** `PolicyDialog` dùng `splitSentences` chung; có `children` thì không vẽ `text`. Không nơi gọi nào truyền cả hai.

### Khác web (đợt này)

- C-176/C-182: ô tiền thuê và đơn giá khoá khi workspace bận (web cho sửa).
- C-177: chuỗi sự kiện chọn/xoá mơ hồ bị báo lỗi dán thay vì đoán (vd. chọn tất cả, chạm trước số cuối của "10.000", xoá lùi: bị từ chối một lần).
- C-164: các ô chọn (ngân hàng, cách tính phí: `BankPicker`, `ChoiceButton`, `Dropdown`) không đổi màu chữ.
