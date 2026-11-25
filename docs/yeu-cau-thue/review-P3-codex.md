# Review Pha 3 (Codex)

## Kết luận ngắn

**Chưa đạt yêu cầu giống web 100%.** Lỗi cần sửa trước là C-177. Dán số vào ô tiền đang có giá trị có thể lưu một số tiền khác mà không báo lỗi. Ngoài ra, có lỗi mất stack khi đi qua lịch hẹn, mất thông báo khi hộp 1010 đang mở và xoá tệp cache trước khi bên dùng tệp đọc xong.

TypeScript kiểm tra sạch. **263/263 test** trong 13 bộ đã chọn chạy qua trong một tiến trình. Hai ca dán sai số tiền được tái hiện bằng cách gọi trực tiếp `editVndText`. Rà soát chỉ đọc, không gọi mạng.

## Lỗi tìm thấy

### Nghiêm trọng

Chưa xác minh lỗi ở mức này.

### Cao

**R3-01 — C-177: Dán ở con trỏ có thể đổi số tiền âm thầm.** Đặt con trỏ trước `1.234` rồi dán `5.25`. Mobile nhận chuỗi `5.251.234`, coi dấu chấm là dấu phân nhóm và lưu `5.251.234 ₫`. Web từ chối clipboard `5.25` vì có phần thập phân. Dán `5.00` tại cùng vị trí lưu `5.001.234 ₫` trên mobile, trong khi web cho `51.234 ₫`. Cũng xác minh rằng dán `00` cuối `1.234` bị từ chối, và phím Delete trước dấu chấm của `12.345` xoá chữ số `2` thay vì `3` như web. [logic.ts:38](D:/Projects/homespace/hs-mobile-app/src/components/rental/shared/logic.ts:38), [VndMoneyInput.tsx:50](D:/Projects/homespace/hs-mobile-app/src/components/rental/shared/VndMoneyInput.tsx:50), [vnd-money-input.tsx:45](D:/Projects/homespace/hs-web-app/components/ui/vnd-money-input.tsx:45)

- **Cách sửa.** Xác định đoạn được chèn tại con trỏ hoặc vùng chọn, phân tích riêng đoạn đó rồi ghép các chữ số còn lại. Từ chối sự kiện mơ hồ trước khi đổi giá trị. Dùng vị trí con trỏ để phân biệt Delete và Backspace cạnh dấu phân nhóm. Thêm test cho các ca trên ở cả hai thứ tự sự kiện.

### Trung bình

**R3-02 — Xoá hoặc thay chứng từ có thể xoá tệp đang upload.** Chọn chứng từ A rồi bấm **Xoá** hoặc chọn tệp B trong lúc A đang tải. Các nút chỉ khoá khi `submitting`. Khi A rời state, hook xoá bản sao ngay, kể cả lúc upload A đang chờ URL upload và chưa mở tệp. Thời gian chờ 10 phút chỉ áp dụng khi component bị gỡ. Kiểm tra lượt chọn ngăn kết quả cũ ghi đè chứng từ mới, nhưng thao tác đọc tệp cũ vẫn có thể lỗi. [PaymentProofForm.tsx:115](D:/Projects/homespace/hs-mobile-app/src/components/rental/onboarding/PaymentProofForm.tsx:115), [useDiscardDroppedFiles.ts:18](D:/Projects/homespace/hs-mobile-app/src/components/rental/shared/useDiscardDroppedFiles.ts:18), [storage.service.ts:53](D:/Projects/homespace/hs-mobile-app/src/services/rental/storage.service.ts:53)

- **Cách sửa.** Giữ từng URI đến khi upload tương ứng hoàn tất hoặc xác nhận đã huỷ. Áp dụng cùng quy tắc khi thay, gỡ tệp và đóng màn.

**R3-03 — Đăng xuất xoá cả bản sao picker và tệp chia sẻ còn được dùng.** Nếu phiên hết hạn trong lúc đăng tin, chat hoặc đổi ảnh hồ sơ, purge xoá cả `ImagePicker/` và `DocumentPicker/`. Một upload đã có URL vẫn có thể chưa mở tệp cục bộ lúc đó. PDF hoặc QR đã chuyển cho ứng dụng khác cũng mất thời gian giữ 10 phút khi purge xoá `rental-files/`. Nếu ứng dụng nhận mở tệp sau thời điểm xoá, lần đọc sẽ thất bại. [session.ts:58](D:/Projects/homespace/hs-mobile-app/src/features/auth/session.ts:58), [cache.ts:92](D:/Projects/homespace/hs-mobile-app/src/services/rental/cache.ts:92), [cache.ts:111](D:/Projects/homespace/hs-mobile-app/src/services/rental/cache.ts:111), [storageApi.ts:64](D:/Projects/homespace/hs-mobile-app/src/services/storageApi.ts:64), [chatMediaApi.ts:106](D:/Projects/homespace/hs-mobile-app/src/services/chatMediaApi.ts:106)

- **Cách sửa.** Dọn các bản sao do ứng dụng theo dõi theo từng phiên và từng tệp. Đánh dấu tệp đang dùng để xoá khi thao tác kết thúc. Với chia sẻ, giữ thời hạn của bản sao đã bàn giao hoặc huỷ quyền truy cập theo hành vi đăng xuất được chọn rõ ràng. Tiếp tục chạy dọn tệp ngoài đường chờ đăng xuất.

**R3-04 — A-169: Hộp 1010 nuốt thông báo từ thao tác khác.** Chủ nhà có thể bắt đầu tạo hợp đồng cho yêu cầu A rồi duyệt yêu cầu B trong lúc A chờ kết xuất. Nếu B mở hộp 1010 trước, thông báo kết xuất hoặc lỗi riêng của A bị bỏ vì `AppDialog` chặn mọi thông báo không có nút riêng. Đóng hộp 1010 đặt lại `dialogRef`, nên mã không giữ trạng thái chặn vĩnh viễn. Thông báo đã bị bỏ cũng không hiện lại. [AppDialog.tsx:71](D:/Projects/homespace/hs-mobile-app/src/components/AppDialog.tsx:71), [use-onboarding.ts:57](D:/Projects/homespace/hs-mobile-app/src/lib/use-onboarding.ts:57), [useContractDraft.ts:44](D:/Projects/homespace/hs-mobile-app/src/components/rental/requests/useContractDraft.ts:44), [RentalRequestsScreen.tsx:314](D:/Projects/homespace/hs-mobile-app/src/screens/rental/RentalRequestsScreen.tsx:314)

- **Cách sửa.** Chỉ bỏ thông báo lỗi trùng từ chính request 1010 đã mở hộp. Giữ thông báo từ thao tác khác để hiện sau khi hộp đóng.

**R3-05 — Back từ lịch hẹn làm mất bài đăng và stack thuê lồng bên dưới.** Mở tin A → **Xem yêu cầu của tôi** → **Xem bài đăng** của yêu cầu B → mở lịch xem của B → **Xem tất cả lịch hẹn**. `openManagement` chuyển màn ở `App`, làm `ListingDetailScreen` bị gỡ cùng stack cục bộ và ID tin B. Back từ lịch hẹn dựng lại tin A. Người dùng mất cả tin B lẫn danh sách yêu cầu bên dưới. [ListingDetailScreen.tsx:93](D:/Projects/homespace/hs-mobile-app/src/screens/ListingDetailScreen.tsx:93), [ListingDetailScreen.tsx:231](D:/Projects/homespace/hs-mobile-app/src/screens/ListingDetailScreen.tsx:231), [BookingAppointmentModal.tsx:69](D:/Projects/homespace/hs-mobile-app/src/components/appointment/BookingAppointmentModal.tsx:69), [App.tsx:117](D:/Projects/homespace/hs-mobile-app/App.tsx:117), [App.tsx:252](D:/Projects/homespace/hs-mobile-app/App.tsx:252)

- **Cách sửa.** Giữ stack thuê và ID tin B ở nơi sống qua lần đổi màn, hoặc mở lịch hẹn trên cùng stack. Back cần đi theo thứ tự lịch hẹn → B → yêu cầu thuê → A.

**R3-06 — B-210/C-216: Tiêu đề tháng 1 có thể đi cùng lưới của tháng khác.** Khi chưa chọn ngày, mở lịch có khoảng hợp lệ kéo qua tháng 1 rồi chuyển tới tháng 1. `AppCalendar` truyền `month={0}` và `year`. Thư viện bỏ qua `0` ở bước khởi tạo. Hai effect tháng và năm sau đó tính từ cùng trạng thái ban đầu, và effect năm ghi lại tháng cũ. Với ngày hiện tại 26/11/2026 và đích tháng 1/2027, chuỗi cập nhật cho kết quả tháng 11/2027 dưới tiêu đề tháng 1/2027. Nếu tháng 1 là tháng cuối khoảng hợp lệ, nút **Tháng sau** đã khoá dù lưới tháng 1 chưa hiện. Test hiện tại thay picker bằng stub và chỉ kiểm tra prop `month`. [AppCalendar.tsx:157](D:/Projects/homespace/hs-mobile-app/src/components/appointment/AppCalendar.tsx:157), [datetime-picker.tsx:153](D:/Projects/homespace/hs-mobile-app/node_modules/react-native-ui-datepicker/src/datetime-picker.tsx:153), [datetime-picker.tsx:546](D:/Projects/homespace/hs-mobile-app/node_modules/react-native-ui-datepicker/src/datetime-picker.tsx:546), [datetime-picker.tsx:606](D:/Projects/homespace/hs-mobile-app/node_modules/react-native-ui-datepicker/src/datetime-picker.tsx:606), [rental-ui.test.cjs:283](D:/Projects/homespace/hs-mobile-app/tests/rental-ui.test.cjs:283)

- **Cách sửa.** Khởi tạo tháng và năm hiển thị cùng lúc, độc lập với ngày được chọn. Thêm test kiểm tra **lưới** tháng 1 khi chưa có ngày chọn và khi chuyển từ tháng 12.

**R3-07 — Lượt chạm thông báo cũ có thể ghi đè màn vừa mở.** Chạm thông báo A chưa đọc khi PATCH chậm, sau đó chạm thông báo B đã đọc. B mở ngay. Khi PATCH của A trả về, callback cũ vẫn điều hướng và thay toàn bộ stack thuê. Việc chờ PATCH đã có ở HEAD. Pha 3 đưa callback đó vào đường ghi đè stack mới. [NotificationsScreen.tsx:195](D:/Projects/homespace/hs-mobile-app/src/screens/NotificationsScreen.tsx:195), [App.tsx:109](D:/Projects/homespace/hs-mobile-app/App.tsx:109)

- **Cách sửa.** Chỉ cho lượt chạm mới nhất điều hướng khi trung tâm thông báo còn là màn nguồn. Vẫn cập nhật trạng thái đã đọc cho cả hai mục.

### Thấp

**R3-08 — Đăng xuất bỏ khoá khi POST tạo yêu cầu còn chạy.** Gửi yêu cầu, đăng xuất rồi đăng nhập lại cùng tài khoản trước khi POST cũ trả về. `submitLocks.clear()` cho phép phát POST thứ hai cho cùng tin. Backend khoá bản ghi tin và kiểm tra yêu cầu `PENDING`/`ACCEPTED`, nên trường hợp hai POST đồng thời này không chứng minh được tạo hai yêu cầu đang hoạt động. Lỗi xác minh được là phát hai POST và lần gửi sau có thể nhận lỗi trùng sau khi lần đầu đã thành công. [logic.ts:484](D:/Projects/homespace/hs-mobile-app/src/components/rental/requests/logic.ts:484), [useRentalRequestForm.ts:261](D:/Projects/homespace/hs-mobile-app/src/components/rental/requests/useRentalRequestForm.ts:261), [RentalRequestService.java:185](D:/Projects/homespace/hs-core-api/hs-listing-service/src/main/java/com/hs/listing/service/RentalRequestService.java:185)

- **Cách sửa.** Giữ khoá `người thuê + tin` đến khi POST kết thúc. Khoá đã có phạm vi theo tài khoản.

**R3-09 — C-283 vẫn thiếu nhãn loại tài liệu cạnh tiêu đề.** Khi mở PDF hợp đồng, mobile vẫn ghép `documentType` vào dòng phụ. Web hiển thị loại tài liệu cạnh tên tệp. [ContractPdfViewerModal.tsx:60](D:/Projects/homespace/hs-mobile-app/src/components/rental/contract/ContractPdfViewerModal.tsx:60), [ContractPdfViewerContent.tsx:154](D:/Projects/homespace/hs-web-app/components/contract/detail/ContractPdfViewerContent.tsx:154)

- **Cách sửa.** Truyền nhãn loại tài liệu cho header của trình xem và bỏ phần lặp khỏi dòng phụ.

## Gỡ code cũ: kết luận có xoá nhầm gì không

Không phát hiện tính năng ngoài thuê bị xoá nhầm khi đối chiếu HEAD. Tin của tôi vẫn gọi `/api/v1/listings/me`, giữ phân trang, kéo để làm mới và đổi trạng thái qua `PATCH /listings/{id}/status` với kiểm tra thao tác được phép. Chi nhánh dùng `BranchManagementScreen` và `branchApi`. Lịch hẹn dùng `appointmentApi` trực tiếp. Hội viên vẫn mở từ Home. Chấm đỏ lịch hẹn và yêu cầu thuê vẫn dùng `managementApi`. Kéo để làm mới **ở chi tiết tin trong màn quản lý** đã bị bỏ. Ở HEAD nhánh đó chỉ xoá lỗi hiển thị, không tải lại tin từ máy chủ.

Năm tệp bị xoá và `PolicyConsent` cũ không còn điểm gọi đang chạy. Mọi section thuê còn được chuyển qua `openManagement` đều đi vào `RentalNavigator`. Không phát hiện assertion cho luồng ngoài thuê đang chạy bị nới lỏng. Test CRUD chi nhánh, phân trang tin, khoá thao tác đổi trạng thái, huỷ lần tải lịch cũ và checkout hội viên vẫn còn. Test `canBookSlot` và `viewingPeriod` gọi các helper đã hết caller. Bộ test lịch hẹn đang dùng vẫn kiểm tra slot bị khoá, đổi ngày và đặt lại lịch.

## Đã kiểm và đạt

- **Thông báo và vai.** Đã đối chiếu các mẫu đường dẫn cố định từ producer cho yêu cầu thuê, hợp đồng và phụ lục, hoá đơn tháng, quyết toán cọc, khoản chuyển và khiếu nại. Yêu cầu nhận/gửi lấy vai từ URL, hợp đồng lấy vai từ các bên của hồ sơ, khoản chuyển kiểm tra người trả/người nhận. Lịch xem, tin đăng, tin tức và các đích ngoài thuê giữ cách xử lý từ HEAD. Push native chỉ có tín hiệu cập nhật và category. Luồng nhấn một mục vẫn cập nhật đã đọc và mở đích khi PATCH lỗi. Mở yêu cầu qua deep link cũng gọi `markRentalNoticeSeen` với vai tương ứng.
- **Back và chi tiết hợp đồng.** `ListingDetailScreen` dùng cùng callback cho Back Android và nút header ở màn tin. Các màn thuê có `ScreenHeader`, modal có `onRequestClose`, và Back ở màn thuê đầu tiên mở từ thông báo trả về trung tâm thông báo trong luồng thông thường. C-040 lấy `sub` từ phiên như web. C-070 đẩy route danh sách hoặc hợp đồng gốc và giữ xác nhận rời bản nháp.
- **Tệp và phiên.** Guard đường dẫn từ chối URI ngoài cache, `content://`, đường dẫn có `..` sau giải mã, URI hỏng và ký tự cắt đường dẫn. Chưa thấy caller thông thường xoá tệp gốc của người dùng. Purge chạy bất đồng bộ, lỗi xoá được bắt và không chặn đường đăng xuất.
- **B-110, B-142, B-203.** Phiếu chuyển khoản chờ định danh rồi mount theo khoá người xem/yêu cầu/khoản và trả quyền mở lại nếu tra định danh thất bại. Đóng phiếu trước khi tải QR xong chặn chia sẻ hoặc mở trình duyệt muộn. Picker đã gỡ không giao kết quả muộn. Lượt GET nối tiếp được hoãn khi app ở nền và chạy lại lúc `active`.
- **D-017, D-086, D-103.** Biên lai kiểm tra `%PDF-` trước khi mở trình xem. Dời hạn chốt dữ liệu của lần bấm, vẫn khoá gửi lại và giữ chữ nhập thêm. `complete`/`force` tải lại hợp đồng, lỗi tải chuyển về danh sách và các thao tác khác giữ đường refresh.
- **Chốt tiền và ký.** Luồng báo chuyển vẫn khoá gửi khi picker mở hoặc đang upload, ràng buộc chứng từ với khoản tiền, gửi `expectedAmount` và kiểm ID chứng từ trong phản hồi. Consent ký vẫn gắn với người ký, revision và tệp nguồn, rồi đọc lại trước khi gửi. Các khoá chỉnh bản nháp khi đang gửi vẫn hiện diện.
- **A-132 và font.** Các caller `PolicyNotice` ngoài thuê vẫn truyền chuỗi hợp lệ. Các màn có tóm tắt dài nằm trong vùng cuộn. Biên dịch NativeWind xác nhận `font-mono` sinh `monospace` cho Android và `Courier New` cho iOS. Test theme sáng và tối đều qua.

## Chưa kiểm được

- Chưa chạy trên Android/iOS. Còn cần xác nhận thứ tự sự kiện phím và vùng chọn, lưới lịch tháng 1, Back qua các lớp modal, push khi app đã tắt, chấm đỏ, trình đọc màn hình và font thực tế.
- Chưa kiểm tra symlink và cách chuẩn hoá URI trên thiết bị, bản sao `tmp/` của iOS, hoặc thời điểm ứng dụng nhận thực sự mở tệp chia sẻ. Các test cache dùng FileSystem giả lập.
- Không có dữ liệu thông báo triển khai để đối chiếu các `actionPath` tuỳ ý từ broadcast quản trị. Kết luận về bao phủ dựa trên mẫu producer trong repo.