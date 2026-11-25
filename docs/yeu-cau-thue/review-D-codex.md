# Review phần D (Codex)

## Kết luận ngắn

**Chưa đạt parity phần D.** Hợp đồng miễn cọc thiếu điểm vào để hai bên chốt bàn giao và quyết toán. Chạm thông báo chưa mở đúng hóa đơn, khoản thanh toán hoặc hồ sơ khiếu nại. Luồng tiền còn hai lỗi ưu tiên cao: có thể báo chuyển bằng chứng từ của số tiền cũ và có thể xác nhận hoặc từ chối một lần báo chuyển mới bằng quyết định dành cho lần trước.

Bộ test billing hiện có đạt **17/17** khi chạy trực tiếp bằng Node. Các lỗi bên dưới được xác minh bằng đường đi trong code. Báo cáo được trả dưới dạng Markdown trong cuộc trò chuyện, theo yêu cầu chỉ đọc.

## Lỗi tìm thấy

### Nghiêm trọng

Chưa xác minh lỗi ở mức này.

### Cao

#### RD-01 — Hợp đồng miễn cọc không có điểm vào để chốt bàn giao và quyết toán

**Kịch bản.** Hợp đồng miễn cọc hết hạn, các hóa đơn đã được xác nhận. Backend cho phép chủ nhà lập đề xuất và người thuê đồng ý để đóng hợp đồng hoặc tạo khoản trả thêm. Backend không tạo hợp đồng cọc cho hồ sơ miễn cọc. Mobile chỉ gắn màn quyết toán trong tab thanh toán của hợp đồng cọc, còn đường `section=deposit` của hồ sơ miễn cọc chuyển sang tab kết thúc, nơi chưa gắn màn này. Cả hai vai đều bị chặn. Web có cùng khoảng trống.

**Checklist:** S5, D-120–D-125, D-135–D-141, B-101. **Cách sửa:** Gắn panel quyết toán bằng ID hợp đồng thuê tại điểm đến `end` của hợp đồng gốc miễn cọc. Dùng các cờ quyền và trạng thái từ lifecycle để mở bước lập đề xuất, đồng ý, đối soát và trả thêm.

- Mobile [PaymentTab.tsx:91](D:/Projects/homespace/hs-mobile-app/src/components/rental/contract/PaymentTab.tsx:91), [payment-module.ts:74](D:/Projects/homespace/hs-mobile-app/src/lib/rental/payment-module.ts:74), [EndTab.tsx:184](D:/Projects/homespace/hs-mobile-app/src/components/rental/contract/EndTab.tsx:184)
- Web [PaymentTab.tsx:51](D:/Projects/homespace/hs-web-app/components/contract/page/PaymentTab.tsx:51), [payment-module.ts:43](D:/Projects/homespace/hs-web-app/lib/payment-module.ts:43), [EndTab.tsx:75](D:/Projects/homespace/hs-web-app/components/contract/page/EndTab.tsx:75)
- Backend [DepositAgreementService.java:162](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/deposit/DepositAgreementService.java:162), [ContractLifecycleService.java:250](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ContractLifecycleService.java:250)

#### RD-02 — Chạm thông báo làm mất đích xử lý

**Kịch bản.** Người thuê chạm thông báo đơn phương có hạn phản hồi 24 giờ hoặc chủ nhà chạm thông báo đã báo chuyển. Bộ điều hướng đang dùng đưa họ tới lịch sử thanh toán theo vai, bỏ `paymentId`, `section` và `invoice`. Thông báo quyết toán cũng rơi vào đường này. Thông báo khiếu nại chỉ mở hộp thoại nội dung. Bộ phân tích route mới đã có đủ các đích và `RentalNavigator` đã gắn các màn, nhưng trình xử lý chạm thông báo chưa gọi bộ phân tích đó.

**Checklist:** S3, S4, S7, S8, D-031, D-164, RB-05. **Cách sửa:** Nối bộ phân tích route mới vào thao tác mở thông báo, giữ đủ tham số đến màn đích và giữ bước đối chiếu người dùng với danh sách khoản thanh toán của họ. Kiểm thử thao tác chạm với cả hai vai.

- Mobile [NotificationsScreen.tsx:187](D:/Projects/homespace/hs-mobile-app/src/screens/NotificationsScreen.tsx:187), [notification.ts:386](D:/Projects/homespace/hs-mobile-app/src/lib/notification.ts:386), [deep-link.ts:108](D:/Projects/homespace/hs-mobile-app/src/lib/rental-nav/deep-link.ts:108), [RentalNavigator.tsx:68](D:/Projects/homespace/hs-mobile-app/src/screens/rental/RentalNavigator.tsx:68)
- Web [NotificationDropdown.tsx:227](D:/Projects/homespace/hs-web-app/components/notification/NotificationDropdown.tsx:227), [payments/page.tsx:105](D:/Projects/homespace/hs-web-app/app/dashboard/payments/page.tsx:105)

#### RD-03 — Chứng từ cũ có thể được gửi cho số tiền hóa đơn mới

**Kịch bản.** Người thuê chuyển 5.000.000 đ và chọn chứng từ. Làm mới nhận phí phạt, nâng cùng `paymentId` lên 5.050.000 đ. Mobile giữ tệp theo `paymentId`. Lần bấm tiếp theo dùng tệp đã chọn ở mức tiền cũ, kiểm tra mức tiền mới với server rồi gửi `expectedAmount: 5050000`. Backend đối chiếu `expectedAmount` với khoản hiện tại nên kiểm tra này vẫn qua. Web lưu tệp theo cùng cách. Trên mobile còn có một đường giữ tệp cũ khi chọn tệp thay thế bị lỗi, vì `ProofField` không xử lý `onError` của bộ chọn.

**Checklist:** D-071–D-075, D-143. **Cách sửa:** Gắn tệp với ảnh chụp thông tin khoản chuyển lúc chọn, gồm ID, số tiền, bên nhận và nội dung chuyển khoản. Khi thông tin thay đổi hoặc tệp thay thế bị từ chối, yêu cầu chọn lại trước khi gửi. Giữ kiểm tra `expectedAmount` phía server.

- Mobile [MonthlyInvoicesSection.tsx:269](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/MonthlyInvoicesSection.tsx:269), [MonthlyInvoicesSection.tsx:407](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/MonthlyInvoicesSection.tsx:407), [logic.ts:129](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:129), [common.tsx:197](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/common.tsx:197), [EvidencePicker.tsx:175](D:/Projects/homespace/hs-mobile-app/src/components/rental/shared/EvidencePicker.tsx:175)
- Web [MonthlyInvoicesSection.tsx:246](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:246), [MonthlyInvoicesSection.tsx:453](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:453)
- Backend [PaymentRequestService.java:470](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:470)

#### RD-04 — Xác nhận hoặc từ chối vẫn có thể áp vào lần báo chuyển mới

**Kịch bản.** Bên nhận duyệt chứng từ A trên một thiết bị. Mobile đọc lại và thấy A còn hiệu lực. Trước khi lệnh ghi được xử lý, cùng bên nhận từ chối A trên thiết bị khác và bên chuyển gửi B. Khoản tiền trở lại `TRANSFER_REPORTED`. Backend nhận quyết định theo `paymentId` và áp vào trạng thái hiện tại, nên B có thể bị xác nhận hoặc từ chối bằng quyết định dành cho A. Với khoản hoàn cọc, xác nhận cũng cập nhật sổ cọc và tạo biên lai. Đây là phần còn lại của RB-03 trên cả hóa đơn và quyết toán.

**Checklist:** D-076–D-077, D-144, RB-03. **Cách sửa:** API trả định danh lần báo chuyển hiện hành. Cả xác nhận và từ chối phải gửi định danh đó. Backend so sánh dưới cùng khóa giao dịch trước khi ghi và trả xung đột nếu lần báo đã đổi.

- Mobile [MonthlyInvoicesSection.tsx:302](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/MonthlyInvoicesSection.tsx:302), [SettlementPaymentPanel.tsx:100](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/SettlementPaymentPanel.tsx:100), [logic.ts:94](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:94)
- Web [MonthlyInvoicesSection.tsx:269](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:269), [SettlementPaymentPanel.tsx:55](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:55), [SettlementPaymentPanel.tsx:76](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:76)
- Backend [PaymentRequestService.java:566](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:566), [PaymentRequestService.java:710](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:710), [PaymentRequestService.java:741](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:741)

### Trung bình

#### RD-05 — Một lần chạm phát hành ngay hóa đơn bổ sung

**Kịch bản.** Chủ nhà đã nhập khoản bổ sung và chạm nhầm nút phát hành. Handler gửi thẳng `finalCosts`. Backend tạo hóa đơn `UNPAID`, tạo khoản thanh toán, gửi thông báo và có thể làm mất hiệu lực đề xuất quyết toán đã gửi. Web cũng phát hành bằng một lần bấm. Hóa đơn tháng thông thường đã có hộp xác nhận ở cả hai ứng dụng.

**Checklist:** D-067, D-128–D-129. **Cách sửa:** Nếu áp dụng yêu cầu xác nhận cho mọi lần phát hành, thêm hộp xác nhận ở cả web và mobile. Hiện các chỉ số, khoản bổ sung và hệ quả đối với đề xuất đang mở trước khi gửi. Checkbox bàn giao và đồng ý theo phiên bản của D-136/D-138 đã có.

- Mobile [FinalCostsForm.tsx:38](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/FinalCostsForm.tsx:38), [FinalCostsForm.tsx:112](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/FinalCostsForm.tsx:112)
- Web [ContractLifecyclePanel.tsx:141](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:141), [ContractLifecyclePanel.tsx:227](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:227)
- Backend [ContractLifecycleService.java:313](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ContractLifecycleService.java:313)

#### RD-06 — Thử lại hóa đơn bổ sung có thể tạo khoản thu thứ hai

**Kịch bản.** Server đã phát hành khoản bổ sung chỉ gồm một khoản phí, nhưng phản hồi bị mất. Chủ nhà rời màn và mở lại sau khi hóa đơn đó đã thanh toán, rồi nhập lại cùng khoản phí để thử lại. `requestId` cũ đã mất khi panel bị gỡ. Backend nhận ID mới, thấy không còn hóa đơn bổ sung chưa thanh toán và có thể phát hành lại khoản phí. Web cũng chỉ giữ ID thử lại trong bộ nhớ của panel.

**Checklist:** D-128–D-129. **Cách sửa:** Giữ định danh lần phát hành chưa rõ kết quả qua lần mở lại màn và đối chiếu với hóa đơn đã tạo. Dùng lại ID đó khi thử lại. Chỉ cấp ID mới khi người dùng bắt đầu một khoản bổ sung mới.

- Mobile [ContractLifecyclePanel.tsx:76](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ContractLifecyclePanel.tsx:76), [FinalCostsForm.tsx:44](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/FinalCostsForm.tsx:44), [logic.ts:565](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:565)
- Web [ContractLifecyclePanel.tsx:53](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:53), [ContractLifecyclePanel.tsx:155](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:155)
- Backend [ContractLifecycleService.java:281](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ContractLifecycleService.java:281)

#### RD-07 — Ô số ngày biến đầu vào sai thành một hạn hợp lệ khác

**Kịch bản.** Dán `1.5` vào ô số ngày làm mobile xóa dấu chấm và lưu `15`. Dán `-5` lưu `5`. Cả hai đều qua bước kiểm tra. Việc này ảnh hưởng yêu cầu của người thuê, dời hạn trực tiếp của chủ nhà và phương án dời hạn trong khiếu nại đơn phương. Web chuyển giá trị sang số rồi bác số âm và số không nguyên.

**Checklist:** D-086–D-087, D-113. **Cách sửa:** Giữ chuỗi gốc hoặc từ chối ký tự không hợp lệ. Chỉ chuyển thành số sau khi xác nhận toàn bộ chuỗi biểu diễn số nguyên từ 1 đến 30.

- Mobile [common.tsx:151](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/common.tsx:151), [PaymentExtensionPanel.tsx:64](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/PaymentExtensionPanel.tsx:64), [UnilateralTerminationPanel.tsx:243](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/UnilateralTerminationPanel.tsx:243)
- Web [PaymentExtensionPanel.tsx:45](D:/Projects/homespace/hs-web-app/components/contract/detail/PaymentExtensionPanel.tsx:45), [UnilateralTerminationPanel.tsx:77](D:/Projects/homespace/hs-web-app/components/contract/detail/UnilateralTerminationPanel.tsx:77)

#### RD-08 — Hóa đơn đang mở bỏ qua sự kiện báo chuyển và xác nhận

**Kịch bản.** Chủ nhà đang xem hóa đơn khi người thuê báo chuyển. Mobile đã chuyển sự kiện socket thành `payment-changed`, nhưng phần hóa đơn chỉ nghe `invoice-changed` và `agreement-changed`. Chủ nhà có thể chưa thấy nút duyệt. Tương tự, người thuê đang chờ xác nhận có thể chưa thấy biên lai sau khi chủ nhà xác nhận. Nhánh backend ghi nhận hóa đơn `PAID` thông thường không phát thêm sự kiện hóa đơn. Web có cùng bộ lọc.

**Checklist:** D-074, D-076, D-079, D-180–D-182. **Cách sửa:** Cho khối hóa đơn làm mới khi có `payment-changed` khớp các khoản đang hiển thị, hoặc làm mới danh sách đã được cấp quyền khi sự kiện thiếu ID. Dùng cơ chế gộp lượt tải hiện có.

- Mobile [MonthlyInvoicesSection.tsx:174](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/MonthlyInvoicesSection.tsx:174), [events.ts:68](D:/Projects/homespace/hs-mobile-app/src/lib/rental-sync/events.ts:68)
- Web [MonthlyInvoicesSection.tsx:159](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:159)
- Backend [PaymentRequestService.java:559](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:559), [PaymentRequestService.java:725](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:725), [MonthlyBillingService.java:1110](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/MonthlyBillingService.java:1110)

#### RD-09 — Tải lại khiếu nại có thể đổi thao tác của bản nháp

**Kịch bản.** Một bên đang soạn lý do **Đóng hồ sơ**, bên kia đóng hồ sơ trước. Bấm **Tải lại** giữ nguyên lý do nhưng thay bản ghi bằng revision mới. Với hồ sơ còn quyền mở lại, `activeAction` tự chuyển từ `CLOSE` sang `REOPEN`. Lần bấm tiếp theo gửi lý do đóng cho thao tác mở lại với revision mới hợp lệ. Ghim bản nháp theo ID đã chặn được việc chuyển sang hồ sơ khác, nhưng chưa chặn đổi revision hoặc thao tác trong cùng hồ sơ. Web cũng có lỗi này.

**Checklist:** D-159, D-162, D-165. **Cách sửa:** Gắn bản nháp với bộ `caseId`, `revision`, `action`. Khi tải lại thấy revision hoặc quyền thao tác thay đổi, giữ nội dung để người dùng đối chiếu, khóa gửi tới khi họ chọn lại thao tác trên revision mới.

- Mobile [ComplaintPanel.tsx:109](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ComplaintPanel.tsx:109), [ComplaintPanel.tsx:194](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ComplaintPanel.tsx:194), [logic.ts:643](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:643)
- Web [ComplaintPanel.tsx:35](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:35), [ComplaintPanel.tsx:65](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:65), [ComplaintPanel.tsx:106](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:106)
- Backend [ComplaintCaseService.java:287](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ComplaintCaseService.java:287)

#### RD-10 — Client chấp nhận chỉ số vượt giới hạn trước khi phát hành

**Kịch bản.** Nhập `1000000000,001` cho công tơ có tính phí trên hóa đơn bổ sung. Mobile chuyển dấu phẩy đúng nhưng vẫn POST. Backend bác chỉ số lớn hơn `1.000.000.000`. Với hóa đơn tháng, `1000000000000` qua kiểm tra hữu hạn và không lùi, trong khi cột chỉ số `precision=15, scale=3` chỉ chứa tối đa 12 chữ số nguyên. Web cũng thiếu giới hạn này ở client.

**Checklist:** D-063–D-067, D-129. **Cách sửa:** Kiểm tra giới hạn của từng endpoint trước hộp xác nhận và trước khi tạo `requestId`. Bổ sung kiểm tra miền giá trị trong backend hóa đơn tháng trước khi tính và lưu. Tính tiền tiếp tục dùng `BigDecimal` phía server.

- Mobile [MeterReading.tsx:44](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/MeterReading.tsx:44), [logic.ts:316](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:316), [logic.ts:523](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:523)
- Web [MeterReading.tsx:32](D:/Projects/homespace/hs-web-app/components/contract/detail/MeterReading.tsx:32), [MonthlyInvoicesSection.tsx:206](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:206), [ContractLifecyclePanel.tsx:141](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:141)
- Backend [MonthlyInvoice.java:39](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/model/MonthlyInvoice.java:39), [MonthlyBillingService.java:1455](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/MonthlyBillingService.java:1455), [ContractLifecycleService.java:616](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ContractLifecycleService.java:616)

#### RD-11 — Báo chuyển có thể báo thành công cho tệp chưa được gắn

**Kịch bản.** Bên chuyển bấm gửi trên hai thiết bị với hai tệp khác nhau. Cả hai lần đọc trước khi tải tệp đều thấy khoản còn chờ chuyển. Lần ghi thứ nhất gắn tệp A. Lần ghi thứ hai được trả thành công vì khoản đã ở `TRANSFER_REPORTED`, nhưng backend trả lần báo hiện có và không gắn tệp B. Mobile vẫn xóa lựa chọn B và báo đã cập nhật.

**Checklist:** D-073, D-143. **Cách sửa:** Kiểm tra phản hồi có chứng từ của chính lần gửi trước khi xóa tệp và báo thành công. Nếu phiên báo khác đã thắng, tải lại khoản và hiển thị chứng từ thực sự được ghi nhận.

- Mobile [logic.ts:129](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:129), [MonthlyInvoicesSection.tsx:285](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/MonthlyInvoicesSection.tsx:285), [SettlementPaymentPanel.tsx:82](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/SettlementPaymentPanel.tsx:82)
- Web [MonthlyInvoicesSection.tsx:262](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:262), [SettlementPaymentPanel.tsx:34](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:34)
- Backend [PaymentRequestService.java:450](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:450), [PaymentRequestService.java:539](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentRequestService.java:539)

### Thấp

#### RD-12 — Kết quả tải chứng từ đến muộn vẫn có thể mở trình xem

**Kịch bản.** Người dùng chạm xem chứng từ, rời hồ sơ khi URL riêng tư đang được cấp. Khi phản hồi đến, mobile vẫn mở trình duyệt vì chỉ kiểm lỗi, chưa kiểm hồ sơ hoặc màn còn mở. Với **Tải PDF**, đã có kiểm tra sau lúc tải, nhưng rời màn trong lúc đổi tên tệp vẫn có thể mở bảng chia sẻ. Web mở tab đích ngay lúc chạm đối với chứng cứ và dùng token trước khi mở hoặc tải biên lai.

**Checklist:** D-015–D-018, D-075, D-134, D-157. **Cách sửa:** Kiểm tra lại định danh màn và phiên ngay trước lúc mở trình duyệt hoặc bảng chia sẻ. Dọn tệp tạm khi bỏ kết quả.

- Mobile [common.tsx:42](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/common.tsx:42), [ComplaintPanel.tsx:250](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ComplaintPanel.tsx:250), [PaymentReceiptActions.tsx:63](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/PaymentReceiptActions.tsx:63)
- Web [ComplaintPanel.tsx:79](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:79), [PaymentReceiptActions.tsx:38](D:/Projects/homespace/hs-web-app/components/payment/PaymentReceiptActions.tsx:38)

#### RD-13 — Bản sao chứng từ do bộ chọn tạo thiếu vòng đời dọn dẹp

**Kịch bản.** Người dùng chọn PDF sao kê từ bộ chọn tài liệu, sau đó gỡ tệp, hủy bản nháp hoặc gửi xong. Bộ chọn đã sao chép tệp vào cache app. Các đường này chỉ bỏ tham chiếu trong state. Code chưa chủ động xóa bản sao do app tạo. Đây là lưu dữ liệu nhạy cảm quá vòng đời thao tác. Chưa có bằng chứng cache này đọc được từ ứng dụng khác.

**Checklist:** D-072–D-073, D-135, D-138, D-143, D-160. **Cách sửa:** Theo dõi bản sao thuộc cache của app và xóa khi tệp bị thay, gỡ hoặc bản nháp kết thúc. Giữ tệp đủ lâu để thử lại một lần gửi lỗi. Chỉ dọn bản sao do app tạo.

- Mobile [EvidencePicker.tsx:132](D:/Projects/homespace/hs-mobile-app/src/components/rental/shared/EvidencePicker.tsx:132), [EvidencePicker.tsx:213](D:/Projects/homespace/hs-mobile-app/src/components/rental/shared/EvidencePicker.tsx:213), [ComplaintPanel.tsx:153](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ComplaintPanel.tsx:153)
- Web [MonthlyInvoicesSection.tsx:453](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:453), [ComplaintPanel.tsx:129](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:129)

## Nhận định về lỗi web: kết quả xác minh

Số thứ tự dưới đây theo `phase2-D.md`. Báo cáo có sáu nhận định về lỗi web và một mục riêng về khóa bộ chọn.

| Mục | Kết quả xác minh |
|---|---|
| **1. Duyệt nhầm lần báo chuyển** | **Đúng.** Xác nhận và từ chối gửi theo `paymentId`. So sánh ảnh chụp khoản chuyển trên mobile chỉ thu hẹp cửa sổ tranh chấp. RD-04 còn hiệu lực. [MonthlyInvoicesSection.tsx:269](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:269), [SettlementPaymentPanel.tsx:55](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:55), [SettlementPaymentPanel.tsx:76](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:76) |
| **2. Lý do từ chối quyết toán theo nhầm lần báo** | **Đúng.** `reason` là state của panel theo ID khoản tiền. Từ chối A rồi nhận lần báo B trên cùng panel có thể làm lý do cũ hiện lại và đủ điều kiện gửi. Mobile khóa lý do theo dấu nhận diện lần báo. [SettlementPaymentPanel.tsx:24](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:24), [SettlementPaymentPanel.tsx:76](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:76), [ContractLifecyclePanel.tsx:313](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:313) |
| **3. Ô chọn tệp quyết toán trống, state vẫn giữ tệp cũ** | **Đúng.** Web giữ `proof` sau khi gửi. Ô chọn bị gỡ lúc chờ xác nhận rồi xuất hiện lại sau từ chối. Bấm gửi khi chưa chọn lại vẫn dùng `proof` cũ. Mobile xóa lựa chọn sau khi hoàn tất lần gửi. [SettlementPaymentPanel.tsx:23](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:23), [SettlementPaymentPanel.tsx:34](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:34), [SettlementPaymentPanel.tsx:71](D:/Projects/homespace/hs-web-app/components/contract/detail/SettlementPaymentPanel.tsx:71) |
| **4. Báo chuyển hóa đơn thiếu chốt trong lúc đọc và tải** | **Đúng.** Web chỉ so số tiền trước khi vào khóa ghi. Web kiểm tra màn còn sống sau GET, rồi gửi POST ngay sau upload. Mobile khóa từ lúc bắt đầu đọc và bỏ POST nếu màn đã bị gỡ trong lúc upload. Backend vẫn kiểm tra trạng thái và số tiền hiện hành. RD-03 và RD-11 là hai tình huống khác còn tồn tại. [MonthlyInvoicesSection.tsx:246](D:/Projects/homespace/hs-web-app/components/contract/detail/MonthlyInvoicesSection.tsx:246) |
| **5. Mọi nút gửi đều khóa khi bộ chọn tệp đang xử lý** | **Đúng với nút gửi của chính bộ chọn đã kiểm, sai nếu hiểu là mọi thao tác ghi.** Chẳng hạn, **Gửi yêu cầu đối soát** xét `picking`, còn **Đồng ý quyết toán** vẫn bật nếu người thuê đã tick đồng ý. Đây là kiểm tra mobile về RB-01. [ClosureProposalView.tsx:138](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ClosureProposalView.tsx:138), [ClosureProposalView.tsx:157](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ClosureProposalView.tsx:157) |
| **6. Nháp đối soát web có thể đi vào đề xuất mới** | **Đúng.** Khi đổi phiên bản, web đặt lại tick bàn giao và đồng ý, nhưng giữ lý do và tệp đối soát. Bấm gửi sau khi dữ liệu chuyển sang phiên bản mới sẽ lấy phiên bản mới cùng nội dung cũ. Mobile ghim nháp đối soát theo phiên bản. [ContractLifecyclePanel.tsx:54](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:54), [ContractLifecyclePanel.tsx:75](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:75), [ContractLifecyclePanel.tsx:134](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractLifecyclePanel.tsx:134) |
| **7. Tải lại khiếu nại web có thể đổi hồ sơ của bản nháp** | **Đúng.** Khi chưa chọn ID, `current` là hồ sơ đầu còn mở. Có hai hồ sơ A và B, đang soạn trên A, A được đóng ở thiết bị khác, rồi bấm tải lại. `current` có thể chuyển sang B trong khi lý do và tệp vẫn còn. Handler gửi ID và revision của B. Mobile ghim ID khi soạn hoặc mở bộ chọn. RD-09 là phần revision còn thiếu. [ComplaintPanel.tsx:34](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:34), [ComplaintPanel.tsx:41](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:41), [ComplaintPanel.tsx:62](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:62), [ComplaintPanel.tsx:106](D:/Projects/homespace/hs-web-app/components/complaint/ComplaintPanel.tsx:106) |

## Đã kiểm và khớp

- **Hóa đơn tháng.** Tải hóa đơn trước khi đọc khoản thanh toán, lọc `DRAFT` của người thuê ở cả client và server, chọn hóa đơn theo kỳ, hiện QR đúng vai và trạng thái, dùng giờ server cho hạn phát hành. Dấu phẩy thập phân được chuẩn hóa và chỉ số lùi bị chặn khi có chỉ số đầu kỳ. Điện và nước được tính ở backend bằng chênh lệch chỉ số nhân đơn giá đã ký. D-020 và D-032 đã có nối cuộn và ghi kỳ vào route trong code hiện tại. [MonthlyInvoicesSection.tsx:123](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/MonthlyInvoicesSection.tsx:123), [ContractDetailScreen.tsx:313](D:/Projects/homespace/hs-mobile-app/src/screens/rental/ContractDetailScreen.tsx:313), [MonthlyBillingService.java:431](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/MonthlyBillingService.java:431), [MonthlyBillingService.java:911](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/MonthlyBillingService.java:911)
- **Quá hạn và chấm dứt.** Đã đối chiếu điều kiện hiện theo vai, xác nhận cộng dồn, từ chối dời hạn, các bước chấm dứt cũ cho dữ liệu đã có và các bước đơn phương gửi `noticeId` cùng `expectedVersion`. Đã rà lời nhắc hủy/kết thúc và điểm gắn khiếu nại thuộc D-170/D-171. [OverdueActionsPanel.tsx:104](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/OverdueActionsPanel.tsx:104), [PaymentExtensionPanel.tsx:80](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/PaymentExtensionPanel.tsx:80), [UnilateralTerminationPanel.tsx:243](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/UnilateralTerminationPanel.tsx:243), [EndTab.tsx:23](D:/Projects/homespace/hs-mobile-app/src/components/rental/contract/EndTab.tsx:23)
- **Quyết toán có điểm vào qua hợp đồng cọc.** Đã lần từ hóa đơn cuối đến lập đề xuất, đối soát, đồng ý đúng phiên bản và khoản chuyển. Hoàn cọc do chủ nhà báo chuyển, người thuê duyệt. Khoản trả thêm đảo hai vai. Backend kiểm tra người thực hiện, trạng thái, phiên bản và số tiền trước khi tạo khoản. [DepositSettlementPanel.tsx:74](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/DepositSettlementPanel.tsx:74), [ClosureProposalView.tsx:126](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/ClosureProposalView.tsx:126), [logic.ts:454](D:/Projects/homespace/hs-mobile-app/src/components/rental/billing/logic.ts:454), [ContractLifecycleService.java:202](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ContractLifecycleService.java:202)
- **Lịch sử, biên lai và sổ cọc.** Đã đối chiếu phân trang 12 bản ghi, lọc theo vai/hợp đồng, polling 15 giây, điều kiện PDF `PENDING`/`FAILED`/`READY`, retry và kiểm tra `%PDF-`. B-070 dùng điều kiện `CONFIRMED && totalAmount > 0`. B-100–B-103 khớp nhánh chưa có sổ, miễn cọc, nhãn trạng thái và năm dòng số tiền. [PaymentHistoryScreen.tsx:61](D:/Projects/homespace/hs-mobile-app/src/screens/rental/PaymentHistoryScreen.tsx:61), [payment-receipt.service.ts:24](D:/Projects/homespace/hs-mobile-app/src/services/rental/payment-receipt.service.ts:24), [OnboardingPaymentCard.tsx:137](D:/Projects/homespace/hs-mobile-app/src/components/rental/onboarding/OnboardingPaymentCard.tsx:137), [DepositLedgerSummary.ts:19](D:/Projects/homespace/hs-mobile-app/src/lib/rental/DepositLedgerSummary.ts:19)
- **Quyền tệp và khiếu nại.** Upload đặt `PRIVATE` và gắn ID khoản tiền, hợp đồng hoặc yêu cầu thuê tương ứng. Các bộ kiểm tra backend đã đọc giới hạn quyền theo bên tham gia. Minh chứng đối soát và khiếu nại phải xuất hiện trong hồ sơ hoặc lịch sử mới được chia sẻ cho bên kia. PDF căn cứ đã ký được tìm theo đúng hợp đồng và `storageObjectId` đã lưu. [storage.service.ts:77](D:/Projects/homespace/hs-mobile-app/src/services/rental/storage.service.ts:77), [PaymentStorageAccessChecker.java:19](D:/Projects/homespace/hs-core-api/hs-payment-service/src/main/java/com/hs/payment/service/PaymentStorageAccessChecker.java:19), [ClosureEvidenceAccessChecker.java:21](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ClosureEvidenceAccessChecker.java:21), [ComplaintEvidenceAccessChecker.java:17](D:/Projects/homespace/hs-core-api/hs-contract-service/src/main/java/com/hs/contract/service/ComplaintEvidenceAccessChecker.java:17), [complaint.service.ts:11](D:/Projects/homespace/hs-mobile-app/src/services/rental/complaint.service.ts:11)

## Chưa kiểm được

- Chưa chạy thiết bị hoặc emulator để kiểm hành vi bộ chọn tệp, camera, bàn phím, PDF, bảng chia sẻ, giao diện sáng/tối và push khi mở app từ trạng thái tắt. Các cửa sổ tranh chấp được xác minh từ thứ tự xử lý trong code, chưa tái hiện với hai thiết bị hoặc backend đang chạy.
- Runner `node --test` bị sandbox chặn tạo tiến trình con (`spawn EPERM`). Chạy trực tiếp `node tests/rental-billing.test.cjs` đạt **17/17**. Bộ test này không dựng màn React Native hay thực thi giao dịch backend.
- Ngoài phạm vi review là các luồng hợp đồng và yêu cầu thuê mà agent khác đang sửa. Chỉ kiểm các điểm gắn và điều hướng cần thiết để xác minh phần D và những mục B được chỉ định.