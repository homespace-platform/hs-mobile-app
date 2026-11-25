# Pha 2 — phần C1: ký, tài liệu, xem PDF, bằng chứng blockchain

Trạng thái: **XONG phần code** (chưa thử trên thiết bị, chưa chạy Metro/bundle). Web `hs-web-app` là chuẩn.

| Mục | ID | Trạng thái |
|---|---|---|
| `contract/ContractSignaturePanel.tsx` | C-230…C-234 | done |
| `contract/SmartCaSignaturePanel.tsx` | C-240…C-256 | done (C-256: màn chi tiết không được unmount panel khi đọc lại) |
| `pdf/PdfViewerModal.tsx` + `contract/ContractPdfViewerModal.tsx` | C-280…C-285 | done, trừ phần bỏ ở dưới |
| `contract/ContractBlockchainProof.tsx` | C-300…C-308 | done |
| `contract/ContractDocumentSection.tsx` + `AmendmentComparisonTable.tsx` | C-260…C-273 | done (cuộn tới neo là việc của màn chi tiết) |
| §3.20 | C-310, C-311 dùng chung; C-312 không có dialog xác nhận nào thuộc C1 | done |
| `contract/signingLogic.ts`, `documentFiles.ts`, `tests/rental-contract-signing.test.cjs` | | 11/11 |

## Cách dùng cho C2

Import từ `@/components/rental/contract/<File>`. Các component tự `key` theo `contract.id` (hoặc id tài liệu), không cần key ở ngoài.

### Panel ký (web `ContractDetailView.tsx:638-660`)
`signatureState?.signatureMode === 'SMARTCA' ? <SmartCaSignaturePanel/> : <ContractSignaturePanel/>`

- Chung: `contract`, `signingAllowed={Boolean(contract.parentContractId || onboarding?.canSign)}`, `blockedReason={onboarding?.message ?? 'Đang kiểm tra ngày bắt đầu thuê và trạng thái thanh toán…'}`, `isLandlord`, `isTenant`.
- `SmartCaSignaturePanel`: `state={signatureState}`, `hasReadyPdf={Boolean(readyToSign && documents.some(d => d.revisionId === revision.id && d.documentType === 'PDF' && d.status === 'READY'))}`, `onUpdated={afterUpdate}`.
- `ContractSignaturePanel`: `canSend={Boolean(completeness?.complete && readyToSign)}`, `sending`, `signing`, `onSend={handleSendToTenant}`, `onSign={handleSign}` (hai hàm này do màn viết theo web `:410-448`, gồm kiểm tra trạng thái, toast và `void afterUpdate()`). Promise phải kết thúc khi request xong: panel khoá bấm đúp theo promise đó.
- **C-256**: khi đọc lại trạng thái ký không được chuyển cả trang sang skeleton, nếu không consent/chứng thư bị mất.

### Đọc lại trạng thái ký (web `:173-213`): chỉ một lượt tại một thời điểm
`createSignedStateRefresh(read, apply)` trong `signingLogic.ts`:
```ts
const gate = useRef<ReturnType<typeof createSignedStateRefresh> | null>(null);
useEffect(() => {
  const mine = createSignedStateRefresh(
    () => Promise.all([contractService.getContract(id), contractService.getDocuments(id), contractService.getSignatureState(id)]),
    ([c, docs, state]) => { setContract(c); setDocuments(docs); setSignatureState(state); });
  gate.current = mine;
  return () => mine.dispose();
}, [id]);
// afterUpdate: try { await gate.current?.refresh() } catch { toast "Đã cập nhật, chưa tải lại được dữ liệu." } finally { syncTick; preActive && reloadOnboarding() }
```

### Tài liệu
`<ContractDocumentSection documents={documents} contract={contract} amendments={useAmendmentWorkspace()} onNavigate={onNavigate} />`
- `amendments: DocumentAmendmentWorkspace | null` = các trường `{perspective, data, error, load, editing, busy, savedDraft, start}` của workspace phụ lục (web đọc từ context). Không truyền khi HĐ gốc đã ACTIVE/EXPIRED/CLOSED/TERMINATED thì dòng "Đang kiểm tra lịch sử điều chỉnh…" đứng mãi (như web khi thiếu context) và không có thẻ phụ lục.
- Neo `contract-document-history`: muốn cuộn tới (C-151…) thì bọc `View onLayout` rồi cuộn bằng ref.
- Phải nằm trong `ScrollView` của màn. Nếu đặt trong `ModalShell` thì đặt trong children.
- Panel phụ lục dùng lại `AmendmentComparisonTable {rows, beforeLabel?, afterLabel?}`.

### Xem PDF và proof
- `ContractPdfViewerModal {isOpen, onClose, document}` (header dùng như web `ContractHeader.tsx:287`). PDF `SIGNED_FINAL` READY chỉ vẽ từ `POST …/content`; PDF khác tải `viewUrl ?? downloadUrl` về cache; DOCX/loại khác hiện sheet có nút "Tải về" mở bằng app của máy.
- `ContractBlockchainProof {document}` tự trả `null` nếu không phải PDF `SIGNED_FINAL` READY.

### Nơi đang mở được (đã kiểm bằng import)
- `ContractPdfViewerModal`: `AgreementDocumentActions` (thẻ yêu cầu thuê), `DepositAgreementPanel`, `WorkflowDocumentsPanel` (qua `RentalOnboardingPanel`, từ màn giữ chỗ và modal chi tiết yêu cầu).
- `SmartCaSignaturePanel`: `DepositAgreementPanel` (B-099), `WorkflowDocumentsPanel` (B-218).
- `ContractBlockchainProof`: `DepositAgreementPanel`.
- `ContractSignaturePanel`, `ContractDocumentSection`: **chưa ai mount**, chờ C2.

## Khác web
- Đã duyệt bỏ: xoay, chế độ từng trang, mở tab mới, toàn màn hình. Kèm theo đó không có nút Trang trước/sau và mức zoom %: pinch zoom, cuộn, số trang.
- DOCX không vẽ trong app: "Xem" và "Tải về" đều tải rồi mở bằng app của máy. Chuỗi "Không thể đọc và hiển thị tệp DOCX này." không dùng. Chuỗi web chặn popup không dùng.
- Màn lỗi viewer: "Tải về" là nút ở header (chỉ khi đã có tệp trên máy); "Mở liên kết ngoài" chỉ cho tài liệu không cần kiểm toàn vẹn.
- SmartCA: chọn chứng thư bằng danh sách radio (thấy đủ subject); quay lại app thì `refresh` ngay; `refresh` quá 60 s bị bỏ (client và RN không có timeout, nếu không khoá single-flight kẹt mãi); initiate thành công mà đọc lại lỗi thì hiện "Chưa tải lại được hợp đồng." thay vì báo gửi thất bại; serial không còn trong danh sách mới bị bỏ chọn.
- Tooltip của nút ký INTERNAL và lý do khoá quyền hiện thành chữ dưới nút.
- Chuỗi chỉ có trên mobile (cần user duyệt chữ): thông báo thiếu module PDF (`PdfViewerModal.tsx`, `MODULE_MISSING`), "Thiết bị chưa hỗ trợ mở hoặc lưu tài liệu.", tiêu đề hộp "Mở hoặc lưu tài liệu".
- WC-1, WC-2: theo web (chủ nhà chỉ ký lại ở `DRAFT`; FAILED lỗi nhúng PDF vẫn hiện form). WC-9: `landlordConfirmedAt`/`signedAt` in chuỗi thô như web.

## Cần người khác
- `package.json`: `"test:rental-contract-signing": "node --test tests/rental-contract-signing.test.cjs"`.
- `contract.service.refreshSmartCaSignature` (đóng băng) không nhận `signal`/timeout: request quá hạn vẫn chạy ngầm, kết quả bị bỏ.

## Kiểm tra
`npx tsc --noEmit` sạch; eslint + prettier file C1 sạch; test C1 11/11; `test:rental-logic` 28/28, `test:rental-nav` 11/11, `test:rental-api` 15/15, `test:rental-onboarding` 26/26, `test:theme` 5/5.

## Chưa kiểm trên thiết bị
Mở PDF thật (đã ký và chưa ký, tên có dấu/khoảng trắng); `UIManager.hasViewManagerConfig('RNPdfRendererView')` trả đúng trên bản build có và không có module (mới đọc mã RN Android); chọn PDF + hash bằng `expo-file-system` `File`; chia sẻ DOCX; chuyển sang app VNPT SmartCA rồi quay lại; modal chồng trên iOS (PDF mở từ ModalShell, hộp thoại khi viewer đang mở).

## Sửa sau review

Nguồn: `review-C1-codex.md`, `review-C1-xu-ly.md`. Cập nhật sau từng mục.

| Mã | Trạng thái |
|---|---|
| RC1-01 | đã sửa phía mobile (chỉ giảm rủi ro) |
| RC1-02 | đã sửa (khác web) |
| RC1-03 | đã sửa: lượt của mình đã `SIGNED` thì thay form bằng ô "đang đồng bộ" + nút tải lại; phản hồi tới sau khi rời hồ sơ hoặc thuộc giao dịch khác bị bỏ (một chuỗi mới cần duyệt) |
| RC1-04 | đã sửa: `refreshSmartCaSignature(..., {signal?, timeout?})` (tương thích ngược); panel truyền `timeout: 60_000` nên axios kết thúc request cùng lúc nhả khoá; bỏ `withDeadline`. Thay cho hai câu cũ về `refresh` 60 s ở "Khác web" và "Cần người khác" |
| RC1-05 | đã sửa: thư mục tạm bị xoá khi chia sẻ/mở xong hoặc lỗi (`openWithDeviceApps`, `shareSignedDocument`, tải lỗi); bản sao của picker được ghi nhận trước khi kiểm `alive`. **Còn sót:** `ContractHeader.tsx:108` (C2a) vẫn gọi `contractService.downloadDocument` (không dọn); đổi sang `shareSignedDocument` từ `./documentFiles` |
| RC1-06 | đã sửa trong trình xem dùng chung: PDF chưa ký (và DOCX) GET lại metadata theo `documentId` mỗi lần mở / "Thử lại", kiểm ID, hợp đồng, revision, trạng thái; "Mở liên kết ngoài" chỉ dùng URL vừa đọc |
| RC1-07 | đã sửa: hai câu "trình duyệt" đổi sang câu cho máy trong `verificationFailureMessage` (lib giữ chữ web vì `rental-logic` so khớp); hai chuỗi cần duyệt |
| RA-03 | đã sửa: "12.0" được nhận như ô số của web |
| RA-04 | đã sửa: khoá gửi theo người thuê (`sub` của token) + tin |
| RA-07 | đã sửa (`App.tsx`): mở quản lý từ chi tiết tin giữ `rentalStack`; thoát quản lý về tin, Back về danh sách yêu cầu. Android Back của chi tiết nhà để Pha 3 |
| RA-10 | đã sửa: link, ảnh, đậm trong code inline hoặc khối rào giữ nguyên chữ; dòng rào không vẽ. Còn: code inline trải nhiều dòng và khối thụt 4 dấu cách chưa nhận ra |

### Khác web (chờ duyệt): hai điểm an toàn khi ký
- **RC1-01.** Đồng ý ký (`SmartCaSignaturePanel`, `ContractSignaturePanel`, hook `useSigningConsent.tsx`) gắn với người ký + hợp đồng + revision + ID tệp nguồn của lượt ký (SmartCA: chủ nhà là PDF `PREVIEW`/`OFFICIAL`, người thuê là PDF `SIGNED_LANDLORD`; INTERNAL: tệp `PREVIEW`/`OFFICIAL`, kể cả DOCX). Một trong số đó đổi thì ô đồng ý tự bỏ tích; chưa xác định được tệp thì ô bị khoá. Trước khi gửi, app GET lại hợp đồng + danh sách văn bản (hai GET web đang dùng), khác là không gửi. Không thêm trường nào vào body. Panel tự đọc `getDocuments` nên mọi nơi mount được áp dụng mà không đổi props (thêm một GET mỗi lần host đọc lại, ví dụ nhịp 15 s của HĐ cọc).
- **Còn hở:** văn bản vẫn có thể đổi giữa lần GET cuối và POST; client không biết fingerprint để biết chắc server chọn tệp nào; tệp người dùng đã mở xem không được ghi nhận. Sửa triệt để cần backend nhận và kiểm `revisionId`/`documentId` dưới khoá.
- Chuỗi mới (cần duyệt chữ): trong `useSigningConsent.tsx`.
- **RC1-02** (`WorkflowDocumentsPanel`, `workflowRow`/`workflowPdf`). Có ID đích thì chỉ hiện tệp + nút ký khi khớp đúng ID, kể cả lúc danh sách đang tải hoặc GET lỗi (khi đó vẫn tự chọn bản khác từ danh sách được). PDF lọc theo hợp đồng, revision hiện tại và giai đoạn: đã ký đủ chỉ `SIGNED_FINAL`; lượt người thuê chỉ `SIGNED_LANDLORD`; còn lại `SIGNED_LANDLORD` → `OFFICIAL` → `PREVIEW`. Bỏ nhánh "PDF `READY` bất kỳ" của web. Notice mới đóng trình xem đang mở.
- `DepositAgreementPanel` không sửa (ngoài phạm vi lượt này); nút ký ở đó vẫn bị khoá theo nguồn của RC1-01.

### Kiểm tra sau khi sửa
`npx tsc --noEmit` sạch; eslint + prettier file đã đổi sạch. `rental-contract-signing` 18/18, `rental-requests` 28/28, `rental-api` 15/15, `rental-onboarding` 26/26, `rental-ui` 9/9, `api` 47/47, `rental-logic` 28/28, `rental-nav` 11/11, `theme` 5/5, `rental-contract-detail` 14/14. File C1 mới: `contract/useSigningConsent.tsx`. Props xuất ra của component C1 không đổi.

Test của hook/panel/`App.tsx` chỉ kiểm hàm thuần và đọc mã; chưa render. Chưa thử trên thiết bị: ô đồng ý và lần đọc lại trước khi gửi; `timeout` 60 s của refresh; đường RA-07; "Thử lại" khi URL hết hạn; và việc xoá bản tạm ngay khi bảng chia sẻ trả về (trên Android, app nhận mở trong task riêng có thể chưa đọc xong tệp; cần thử "Mở bằng" với Drive, Word, Zalo).
