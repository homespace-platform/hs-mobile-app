# Pha 2D — Hoá đơn & thanh toán (tiến độ)

Chủ: agent D. File sở hữu: `src/components/rental/billing/**`, `src/screens/rental/{PaymentHistoryScreen,ComplaintScreen,PaymentLinkScreen}.tsx`, `tests/rental-billing.test.cjs`.

Trạng thái: **XONG phần code** (chưa chạy trên thiết bị).

## Tiến độ

| Thành phần | ID | Trạng thái |
|---|---|---|
| logic.ts (luật nút, kiểm dữ liệu, khoá chống bấm đôi), common.tsx | D-022, D-035, D-065, D-073, D-087, D-129, D-136 | xong |
| DepositLedgerSummary | D-125, B-100…B-103 | xong |
| PaymentReceiptActions | D-015…D-019, B-070 | xong |
| MeterReading | D-053, D-063, biến thể supplement | xong |
| PaymentExtensionPanel | D-080…D-089 | xong |
| OverdueActionsPanel (+ chấm dứt kiểu cũ, chỉ hiện hồ sơ có sẵn) | D-090…D-106 | xong |
| UnilateralTerminationPanel | D-110…D-117 | xong |
| MonthlyInvoicesSection + InvoiceCard / InvoiceDraftForm / InvoiceTransferBlock | D-020…D-079 | xong trừ D-020 (xem dưới) |
| SettlementPaymentPanel (+ DepositAdjustmentPayments) | D-121, D-142…D-145 | xong |
| ContractLifecyclePanel (settlement) + FinalCostsForm, ClosureProposalForm, ClosureProposalView | D-124…D-141 | xong |
| DepositSettlementPanel | D-120, D-122, D-123 | xong |
| ComplaintPanel, ComplaintHistory | D-150…D-165 | xong |
| PaymentHistoryScreen | D-001…D-013 | xong |
| ComplaintScreen | S7 | xong |
| PaymentLinkScreen | S8, RB-05 (phần màn) | xong |
| Đồng bộ | D-180…D-183 | xong (hook Pha 1) |
| tests/rental-billing.test.cjs | — | 17/17 |

## ID chưa làm đủ

| ID | Thiếu | Lý do |
|---|---|---|
| D-020 | không tự cuộn tới khối hoá đơn | ScrollView thuộc màn C; section có `nativeID="monthly-invoices"` |
| D-032 | route chỉ được ghi khi màn C truyền `onSelectInvoice` | `PaymentTab` đang gắn chưa truyền |
| D-014 | không có chọn vai | vai lấy từ route (`side`) |
| RB-05 | chạm thông báo chưa mở `payment-lookup` | nối thông báo thuộc Pha 3 |

## Gắn component

| Component | Nơi gắn | Prop |
|---|---|---|
| MonthlyInvoicesSection | C `PaymentTab` (đã gắn) | thiếu tùy chọn **mới** `onSelectInvoice?: (invoiceId) => void` → C: `onNavigate({...route, tab: 'payment', section: 'monthly', invoice: id}, {replace: true})` |
| DepositSettlementPanel | C `PaymentTab` (đã gắn) | đủ |
| ComplaintPanel | C `EndTab` (đã gắn), MIS, `ComplaintScreen` | đủ |
| DepositLedgerSummary, PaymentReceiptActions | B (đã gắn) | không đổi |
| ContractLifecyclePanel, SettlementPaymentPanel | chỉ trong billing | `ContractLifecyclePanel {contractId, isLandlord, onUpdated?, showLedger?, onNavigate}` |

Yêu cầu với màn cha: `onUpdated` phải tải lại im lặng (không unmount) vì panel quyết toán gọi nó sau mỗi lần đọc; ScrollView `keyboardShouldPersistTaps="handled"`. `ContractDetailScreen` hiện đáp ứng cả hai (đã đọc mã, chưa chạy).

## Khác web / lỗi web

Chốt an toàn mobile thêm (web cùng lỗi, quy trình giữ nguyên):

1. Xác nhận / từ chối chứng từ: đọc lại khoản sau hộp thoại; khác trạng thái, số tiền, giờ báo hoặc danh sách chứng từ thì không gửi, báo `Khoản chuyển khoản đã thay đổi; hãy tải lại.` Web chỉ gửi `paymentId` (`MonthlyInvoicesSection.tsx:269-277`, `SettlementPaymentPanel.tsx:55-58,81`). **Chưa nguyên tử**: backend cần nhận ID lần báo chuyển (RB-03).
2. Lý do từ chối ở quyết toán gắn với đúng lần báo chuyển (`SettlementPaymentPanel.tsx:24,80-81`).
3. Quyết toán: xoá tệp sau khi gửi. Web giữ state `proof`; sau khi bị từ chối, ô chọn tệp trống nhưng nút vẫn gửi tệp cũ (`SettlementPaymentPanel.tsx:23,34-45,72-73`).
4. Báo chuyển hoá đơn: thêm kiểm cùng khoản và còn chờ chuyển (như SPP); khoá từ lúc kiểm số tiền; rời màn trong lúc upload thì không báo (`MonthlyInvoicesSection.tsx:246-267`).
5. Mọi nút gửi bị khoá khi bộ chọn tệp còn mở (RB-01).
6. Bản nháp đối soát gắn với phiên bản đề xuất (`ContractLifecyclePanel.tsx:61-62,134-140,297`: web gửi lý do/tệp cũ cho phiên bản mới).
7. Bản nháp khiếu nại ghim vào hồ sơ đang soạn. Web: bấm `Tải lại` có thể đổi `current` và gửi nháp sang hồ sơ khác (`ComplaintPanel.tsx:35,41-46,106`).

Khác do điện thoại:

- Chọn kỳ: dải thẻ cuộn ngang. Chọn hồ sơ khiếu nại: nút xếp dọc.
- `Tải PDF` mở bảng chia sẻ, tên `{receiptNumber}.pdf`, xoá tệp sau 30 giây. Xem PDF bỏ câu `Có thể in bằng thanh công cụ PDF.`.
- Chứng từ mở bằng `expo-web-browser`; bỏ `Vui lòng cho phép mở cửa sổ để xem chứng cứ.` PDF căn cứ đã ký mở trong trình xem (tiêu đề là nhãn liên kết).
- Chọn tệp: ảnh / chụp / PDF; kiểm theo MIME đã chuẩn hoá (WD-12); lỗi hiện dưới ô chọn.
- Chỉ số công tơ: bàn phím gõ `,`, gửi số thập phân; chỉ `.` coi như trống.
- Lý do khoá của quyền khiếu nại hiện thành chữ.
- Tiền ngoại tệ trên phiếu in mã tiền tệ (Hermes không có dữ liệu Intl).
- `PaymentLinkScreen`: khoản của mình nhưng không có trang xử lý thì chỉ hiện số tiền và nội dung chuyển khoản; không thấy thì có nút `Tải lại`.
- Giữ như web dù đáng lưu ý: WD-2, WD-3, WD-15.

## Kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | sạch |
| eslint + prettier file của D | 0 lỗi, 0 cảnh báo |
| `node --test tests/rental-billing.test.cjs` | 17/17 |
| `test:rental-logic` / `rental-nav` / `rental-api` / `rental-onboarding` | 28/28 · 11/11 · 15/15 · 26/26 |

Đề xuất cho chủ `package.json`: `"test:rental-billing": "node --test tests/rental-billing.test.cjs"`.

Test chạy song song mã web: thông điệp trạng thái hoá đơn, điều kiện QR / báo chuyển / xác nhận / biên lai, `canIssue`, kiểm chỉ số, quy tắc quá hạn và dời hạn, quyết toán (người trả, tiêu đề), trạng thái hoá đơn cuối, nút đồng ý quyết toán, kiểm đề xuất và chi phí bổ sung, hành động khiếu nại, và mọi chuỗi tiếng Việt có mặt (chỉ kiểm có mặt, không kiểm vị trí). Đơn phương chấm dứt và phân trang biên lai kiểm bằng bảng viết tay.

## Chưa kiểm

Chưa chạy trên thiết bị: giao diện, modal chồng, bàn phím, chọn/chụp/tải tệp, trình xem và chia sẻ PDF (cần bản dev có module native), mở trình duyệt, QR, realtime/poll. Phần nối component (khoá khi bộ chọn mở, ghim bản nháp, xoá tệp cache) chỉ đối chiếu mã. File tạm PDF khi xem được trình xem xoá lúc đóng (thư mục rỗng còn lại); tệp bộ chọn do hệ thống chép vào cache không bị xoá chủ động (Pha 3).

## Sửa sau review (`review-D-codex.md`)

### RD-03 — đã sửa (kiểm lại: đúng)

- Chứng từ lưu kèm ảnh chụp ID khoản, số tiền, bên nhận (ID + ngân hàng, số tài khoản, tên) và nội dung chuyển khoản, lấy theo dữ liệu đang hiện lúc mở bộ chọn (`logic.ts`: `transferStamp`, `bindProof`, `proofFor`). Dùng chung cho hoá đơn tháng và quyết toán qua `ProofField`.
- Dữ liệu đổi: tệp bị bỏ khỏi ô, phải chọn lại. Bộ chọn từ chối / lỗi tệp thay thế: xoá tệp cũ (`onError`). Huỷ bộ chọn thì giữ tệp.
- Lần đọc lại trước khi tải tệp cũng so nội dung chuyển khoản và tài khoản nhận (`sameTransfer`). `expectedAmount` giữ nguyên.

Khác web (chờ duyệt): toàn bộ chốt trên. Chuỗi mới chỉ có ở mobile: `Thông tin khoản chuyển đã thay đổi. Vui lòng chọn lại chứng từ.`

### RD-07 — đã sửa (kiểm lại: đúng, lỗi mobile)

- Ô ngày giữ nguyên chuỗi gõ / dán, bỏ `maxLength` (cắt chuỗi dán cũng đổi giá trị). Chỉ chuỗi toàn chữ số mới thành số (`parseDays`), rồi qua `daysValid` (1–30) như web.
- Dời hạn thanh toán: sai thì báo `Chọn 1–30 ngày và nhập lý do từ 10 đến 1000 ký tự.` (chữ web). Khiếu nại đơn phương: nút khoá như web (web không có chữ lỗi ở đây).
- Sửa sau đối chiếu (D-087): nay nhận đúng như web (`1e1`, `7.0` hợp lệ).

### RD-09 — đã sửa (kiểm lại: đúng, web cũng lỗi)

- Bản nháp gắn `caseId` + `revision` + thao tác (`logic.ts`: `complaintDraftStale`) từ lúc gõ chữ đầu, mở bộ chọn tệp hoặc chọn thao tác.
- Sau khi tải lại, một trong ba khác đi: giữ chữ và tệp, tiêu đề vẫn là thao tác của bản nháp, khoá gửi tới khi bấm `Chọn lại: …` trên bản mới. Ô soạn vẫn hiện cả khi hồ sơ không còn thao tác nào. Chọn lại thao tác không phải trao đổi thì gỡ tệp (chỉ trao đổi gửi được tệp).

Khác web (chờ duyệt): toàn bộ chốt trên. Chuỗi mới chỉ có ở mobile: `Hồ sơ hoặc thao tác đã thay đổi. Nội dung vẫn được giữ; hãy đối chiếu hồ sơ và chọn lại thao tác trước khi gửi.`, `Chọn thao tác không phải trao đổi sẽ gỡ tệp đính kèm.`, `Chọn lại: {tên thao tác}`.

### RD-11 — đã sửa (kiểm lại: đúng)

- Backend trả thành công cho khoản đã `TRANSFER_REPORTED` mà không gắn tệp mới (`PaymentRequestService.java:461-464`). Phản hồi có `evidences[].storageObjectId`.
- `sendTransferProof` chỉ coi là xong khi `evidences` có đúng `storageId` vừa tải. Không có: ném lỗi, giữ lựa chọn, không báo thành công, tải lại khoản (hoá đơn: `execute` đã tải lại; quyết toán: tải lại sau mọi lỗi báo chuyển).

Khác web (chờ duyệt): chốt trên. Web không có chữ cho trường hợp này, chuỗi mới chỉ có ở mobile: `Máy chủ không ghi nhận tệp vừa gửi cho khoản chuyển này. Hãy xem chứng từ đã được ghi nhận trước khi thao tác tiếp.`

Chưa sửa (ngoài phạm vi): `components/rental/onboarding/RentalPaymentModal.tsx` cũng gọi `reportTransfer` (cọc / khoản ban đầu), chưa kiểm phản hồi theo tệp.

### RD-12 — đã sửa (kiểm lại: đúng)

- `StorageLinks` / `useOpenStorage`: có URL rồi mới kiểm lại màn còn mở và tệp còn trong danh sách đang hiện; không thì bỏ, không báo lỗi. `RentalNavigator` chỉ gắn màn trên cùng nên rời màn = component bị gỡ.
- Chứng cứ khiếu nại: bỏ nếu đã đóng cửa sổ, đổi hồ sơ hoặc rời màn.
- `Tải PDF`: kiểm thêm sau khi đổi tên tệp, rời màn thì xoá tệp tạm, không mở bảng chia sẻ. Còn khe rất ngắn trong `sharePdf` (chờ `Sharing.isAvailableAsync`, `services/rental/files.ts` ngoài phạm vi sửa).
- PDF xem trong `PdfViewerModal` đã tự bỏ và xoá tệp đến muộn (không đổi).

### Kiểm tra sau khi sửa

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | sạch |
| eslint + prettier file đã sửa | sạch |
| `test:rental-billing` / `rental-ui` / `rental-onboarding` / `rental-logic` | 21/21 · 9/9 · 26/26 · 28/28 |

Test mới chỉ phủ hàm trong `logic.ts` (RD-03, RD-07, RD-09, RD-11). Phần nối component (bộ chọn từ chối tệp, nút chọn lại, tải lại sau lỗi, toàn bộ RD-12) chỉ đọc mã; chưa chạy trên thiết bị.

## Sửa sau đối chiếu (`audit-D-codex.md`)

Cập nhật sau từng mục. Chưa chạy trên thiết bị.

| ID | Kết quả |
|---|---|
| D-004 | Đã sửa: vùng skeleton thêm trạng thái busy |
| D-008 | Đã sửa: hai hàng như web; số lẻ theo mã tiền (0 / 2 / 3, theo CLDR), vẫn in mã tiền thay ký hiệu |
| D-010 | Đã thêm font-mono cho số biên lai và mã chuyển khoản (xem D-070 về font Android) |
| D-015 | Đã sửa: spinner chỉ ở nút Xem cho cả hai thao tác |
| D-017 | Đã sửa: tải và kiểm %PDF- trước khi mở trình xem; khối này giữ tệp và xoá khi đóng / rời màn |
| D-087, D-113 | Đã sửa: parseDays nhận đúng dạng số của input type=number rồi Number(); chữ gõ giữ nguyên. Thay câu "Chặt hơn web" ở RD-07. Ô tháng gia hạn (ContractRenewalPanel) dùng chung hàm này, web cũng là type=number |
| D-180 | Đã sửa: đang ở nền thì MIS không chạy lượt kế; lượt đọc khi quay lại đến từ tín hiệu khôi phục (một lần) |
| D-026 | Đã sửa: số tiền trong banner in đậm |
| D-031 | Đã sửa: bỏ vai alert, công bố polite |
| D-063, D-128 | Đã sửa: kết quả tiêu thụ in đậm ở cả hai biến thể. Khoá ô của D-128: giữ (xem Khác web) |
| D-064 | Không đổi code, giữ khoá (xem Khác web) |
| D-070 | Đã sửa: InfoRow thêm prop tuỳ chọn mono. tailwind.config.js đặt lại fontFamily.mono vì preset NativeWind cho Android giá trị "mono" |
| D-071, D-142 | Đã sửa: QR 180 x 180 |
| D-086 | Đã mở khoá ô số ngày và lý do: yêu cầu đang gửi đã giữ sẵn giá trị, thành công không xoá hai ô |
| D-103 | Đã sửa: sau complete / force mở lại chi tiết hợp đồng (load; lỗi thì về danh sách); các thao tác khác giữ refresh |
| D-130 | Đã sửa: số tiền cọc in đậm trong tóm tắt và nội dung |
| D-133 | Đã sửa: khối bàn giao công bố polite |
| D-153 | Đã sửa: nút đóng hiện chữ "Đóng"; chọn hồ sơ dùng ChoiceButton (có trạng thái selected) |
| D-158 | Đã sửa: Dropdown thêm prop tuỳ chọn disabled |
| B-014 | "Xử lý ngay" ở ReservationWorkspaceScreen thêm link: true |
| D-117 | Báo cáo đối chiếu thiếu: không đổi code. Trở lại app thì connections.ts:136-139 phát notifications:changed; tín hiệu khôi phục (invoice-changed không id) làm MIS đọc lại sau 250 ms, panel nhận dữ liệu mới; ContractDetailScreen cũng đọc lại hợp đồng (agreement-changed). Thêm lượt đọc riêng sẽ đọc trùng. Poll 30 giây chỉ chạy khi app đang mở |

### Khác web (giữ sau đối chiếu)

- D-064: bản nháp đối soát vẫn khoá thêm / xoá / sửa phí phát sinh (và chỉ số) khi đang gửi. Gửi xong, MIS bỏ dấu "đã sửa" của hoá đơn rồi nạp lại bản nháp từ máy chủ, nên chữ gõ trong lúc chờ sẽ mất mà không báo (web cho gõ và có lỗi này).
- D-128: form chi phí bổ sung vẫn khoá ô khi đang gửi vì gửi xong thì xoá trắng cả form.
