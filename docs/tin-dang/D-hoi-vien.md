# D. Trang "Gói hội viên & Lượt đăng tin" trên mobile

Nguồn chuẩn: `hs-web-app` (`app/dashboard/membership/**`, `components/membership/*`, `lib/membership.ts`, `hooks/useMembershipPricing.ts`). Không sửa web và backend. Chưa thử trên máy thật.

## ETH đang tạm tắt trên mobile

Cờ `MOBILE_ETH_PAYMENT_ENABLED = false` trong `src/lib/membership.ts` (web vẫn dùng ETH). Code ETH giữ nguyên; đổi cờ thành `true` để bật lại.

- Hộp thanh toán gói và mua thêm lượt: SePay chọn sẵn; MetaMask vẫn hiện, mờ, không bấm được, ghi "Tạm tắt trên ứng dụng, vui lòng thanh toán trên web". Trang chủ mua qua cùng trang này.
- Chặn ngay ở hành động (`placeMembershipOrder`, `quoteMembershipEth`, `sendMembershipEth`): không tạo đơn ETH, không xin báo giá, không mở ví.
- Đơn ETH đang chờ: hướng dẫn tiếp tục trên web (kèm đường dẫn có mã đơn), vẫn hủy được như web.
- Mã giao dịch đã lưu trên máy vẫn tự đối soát; ô dán mã vẫn dùng được cho bản nháp chưa có mã.

Các dòng ETH trong bảng dưới mô tả hành vi khi cờ bật.

## Đối chiếu web → mobile

| Web | Mobile | Trạng thái |
|---|---|---|
| Menu và lối tắt dashboard "Gói hội viên & Lượt đăng" | `MembershipScreen` qua `ManagementScreen`; Back về nơi đã mở | Xong |
| Nút đầu trang: Quản lý tin đăng, Làm mới | Hai nút, thêm kéo để làm mới | Xong |
| Nút "Quản lý gói trong Dashboard", khối mời đăng nhập | Không áp dụng: app luôn đã đăng nhập, chỉ có một trang | Không làm |
| `MembershipStatusCard`: gói, hạn, lượt gói, đã dùng, lượt mua thêm và hạn, giữ chỗ, ngày hồi lượt Free, ADMIN không giới hạn | `MembershipStatusCard` | Xong |
| `MembershipPlanCard`: đang dùng, mua lại khi hết lượt, nâng cấp 24h theo báo giá, không hạ gói, từ chối của máy chủ, ADMIN kiểm thử | `getPlanCardState` + `MembershipPlanCard`, thẻ xếp dọc | Xong |
| Bảng giá dự phòng khi API gói lỗi | Hiện lỗi và nút "Thử lại", không hiện giá viết cứng (theo yêu cầu) | Khác web |
| `?tier=` mở sẵn hộp thanh toán, `?addon=1` | Prop `initialTier`, `initialAddon` | Xong |
| `MembershipCheckoutModal`: báo giá, cảnh báo thay gói, chọn cổng, đổi giá thì hủy đơn tạm, phản hồi sai thì hủy, quyền `MEMBERSHIP_PURCHASE` | `MembershipCheckoutModal` + `placeMembershipOrder` | Xong |
| `MembershipAddonModal`: 1..tối đa, tổng tiền, gợi ý Starter rẻ hơn, SePay và ETH | `MembershipAddonModal` (nút số thay cho ô chọn) | Xong |
| Thanh toán Sepolia ETH (đơn mới, giao dịch mới) | Tạm tắt theo yêu cầu, xem mục trên | Tắt |
| Một đơn chờ; lỗi 4018 có liên kết tới đơn; mã đơn lưu `sessionStorage` | Lưu `SecureStore` theo tài khoản (giữ nguyên khóa của bản cũ). Thêm khung "đơn thanh toán chưa hoàn tất" trên trang, thay cho lịch sử trình duyệt | Xong |
| Gửi biểu mẫu SePay (POST) sang cổng | WebView, chỉ chấp nhận `pay-sandbox.sepay.vn` và `pay.sepay.vn` như web | Xong |
| Trang `return`: hỏi trạng thái 15 lần/2,5 giây, kiểm tra lại, hủy có xác nhận, kết quả hủy, chi tiết đơn, hạn mức sau khi trả, nút theo trạng thái | `MembershipOrderScreen`; đọc lại khi app quay về hoặc có thông báo hội viên | Xong |
| Trang `eth`: kết nối ví, ký, báo giá, gửi, đối soát 8 giây, tiếp tục sau khi tải lại | Gộp vào `MembershipOrderScreen`. Ghi bản nháp trước khi mở MetaMask; chỉ lỗi từ chối (4001) mới cho gửi lại; mã giao dịch chỉ xóa khi đơn PAID; có ô dán mã giao dịch | Xong |
| `MembershipRules` | Accordion; số lượt và số ngày Free lấy từ API | Xong |
| `InsufficientQuotaModal` khi đăng lại tin | Hộp thoại trong `StatusChangeButton`: mua gói, mua thêm lượt, đóng | Xong |
| `InsufficientQuotaModal` trong trình soạn tin | `QuotaModal`: lưu rồi mua gói hoặc mua thêm lượt, xem mục dưới | Xong |
| Khối hội viên trang chủ (`LandlordCta`) | `MembershipSection` dùng chung thẻ gói; bấm gói mở trang mới. Không port 3 khối giới thiệu cuối | Xong một phần |
| Menu tài khoản | Ô gói hội viên bấm được, mở trang mới | Xong |
| Thông báo `/dashboard/membership`, `/return?orderId=` | Mở trang gói / đúng đơn | Xong |

## Nối trình soạn tin (đã làm)

- `QuotaModal` có thêm "Lưu nháp & Mua thêm lượt"; tin đã đăng (không lưu nháp được) hiện "Gửi bản sửa & Mua thêm lượt" và "Gửi bản sửa & Mua gói đăng tin". Bỏ hai câu nhắc "Trang chủ".
- `onOpenMembership(addon)` đi qua mọi nơi mở trình soạn: `MyListingsScreen`, `ListingDetailScreen` (tự mở trang gói, Back về tin), `MembershipScreen`.
- Chọn mua thêm lượt: lưu xong hỏi "Mua thêm lượt" / "Để sau" rồi mới rời (tránh hộp thông báo chồng lên hộp mua).
- Không mất dữ liệu đang nhập: chưa nhập gì thì rời thẳng; hết lượt thì lưu trước qua `QuotaModal`; còn lượt, hoặc chính việc gửi bản sửa bị từ chối vì hết lượt (không lưu được gì), thì trang gói mở đè lên trình soạn, Back trở lại biểu mẫu nguyên vẹn. Thẻ hội viên trong trình soạn có nút "Mua thêm lượt" khi hết lượt.
- Khác web: web rời trang khi bấm "Mua / Nâng cấp gói" lúc còn lượt; mobile giữ biểu mẫu.
- Như web, nếu bản nháp chưa đạt kiểm tra thì phải sửa lỗi trước khi "lưu rồi mua".
- Đã sửa lỗi 1 trong `review-gon-man-hinh-codex.md`: "Quản lý tin đăng" trên trang gói mở từ trình soạn đưa về danh sách tin (vẫn hỏi trước khi bỏ biểu mẫu), kể cả khi trình soạn mở từ chi tiết tin.

## File

Mới:
- `src/components/membership/`: `MembershipScreen`, `MembershipOrderScreen`, `MembershipStatusCard`, `MembershipPlanCard`, `MembershipCheckoutModal`, `MembershipAddonModal`, `MembershipRules`, `PaymentProviderPicker`, `PendingOrderNotice`, `useMembershipPricing`
- `src/lib/membership-order.ts`
- `tests/membership-screen.test.cjs`

Sửa:
- `src/lib/membership.ts`, `src/lib/membership-checkout.ts`, `src/lib/notification.ts`
- `src/services/membershipApi.ts`, `src/services/managementApi.ts`
- `src/screens/`: `HomeScreen`, `ManagementScreen`, `ManagementDashboardScreen`, `ListingDetailScreen` (1 dòng), `NotificationsScreen`
- `src/components/home/`: `MembershipSection`, `HomeDrawer`
- `src/components/listing-manage/`: `MyListingsScreen`, `MembershipCard`, `MyListingCard`, `StatusChangeButton`
- Trình soạn tin: `QuotaModal`, `useListingEditor`, `src/screens/ListingDraftScreen.tsx`, `src/lib/listing-editor.ts`, `tests/listing-editor.test.cjs`
- `package.json` (script `test:membership`), `tests/api.test.cjs`, `tests/listing-manage.test.cjs`, `tests/rental-nav.test.cjs`

Xóa: `src/components/home/MembershipCheckout.tsx`. `App.tsx`: chỉ thêm `membership` vào nơi quay lại của `openManagement` (Back từ danh sách tin về trang gói mở từ menu tài khoản). Không sửa `metamask-wallet*`.

## Kiểm tra đã chạy

- Lần cuối (sau khi nối trình soạn tin và xử lý review): `npm run typecheck` đạt; `test:listing-editor` (43), `test:membership` (16), `test:listing-manage` (11), `test:theme` (5), `test:api` (37), `test:rental-nav` (16) đạt.
- Xuất bundle Android offline (`expo export --platform android`, không nạp `.env`): thành công.
- Trước đó (chưa chạy lại): `test:push` (13), `test:rental-requests` (34).
- ESLint trên phần hội viên: 0 lỗi, 1 cảnh báo `exhaustive-deps` trong `useMembershipPricing`.
- Các lỗi 4, 5, 7, 8 chưa có test tự động.

## Kịch bản thử trên điện thoại

Dùng môi trường thử (SePay sandbox, ví MetaMask mạng Sepolia).

1. Tài khoản Free: Quản lý → "Gói hội viên & Lượt đăng". Xem lượt miễn phí, ngày hồi lượt, 4 thẻ gói, quy tắc; "Làm mới"; Back về dashboard. Lặp lại ở giao diện tối.
2. Tắt mạng rồi mở trang: có lỗi và "Thử lại", không có giá.
3. Mua Starter qua SePay: kiểm số tiền, thanh toán; trang kết quả tự đổi sang "Đã thanh toán", lượt cập nhật.
4. Tạo đơn SePay, đóng trang cổng, về trang gói: có khung đơn chờ. Mua gói khác: báo đã có đơn chờ, có liên kết. Hủy đơn, xác nhận.
5. Đang Starter: Pro hiện "Nâng cấp chỉ ..." trong 24 giờ; Starter còn lượt thì khóa; hết lượt thì "Mua lại Starter"; đang Pro thì Starter khóa.
6. Mua thêm lượt 1 và số tối đa qua SePay; số tối đa có gợi ý Starter (nếu tổng lớn hơn giá Starter).
7. ETH (đang tắt): ở cả hai hộp thanh toán, MetaMask mờ, không chọn được, có nhãn tạm tắt; SePay chọn sẵn.
8. Mở đơn ETH đang chờ (ví dụ bấm thông báo của đơn tạo trên web): có hướng dẫn sang web, không có nút kết nối ví; hủy theo quy tắc của máy chủ.
9. Nếu máy còn giao dịch ETH đã lưu từ bản trước: mở đơn chờ, mã giao dịch hiện và được đối soát. Khi bật lại cờ, thử thêm: gửi, từ chối trong MetaMask, tắt app sau khi xác nhận.
10. Hết lượt: Quản lý tin → đăng lại tin: hộp thoại mở đúng trang mua thêm lượt / mua gói; Back về danh sách.
11. Trang chủ: bấm một gói và ô gói trong menu tài khoản; Back về trang chủ.
12. Bấm thông báo kích hoạt gói: mở đúng đơn.
13. Tài khoản ADMIN: không giới hạn, không có mua thêm lượt, nút "Kiểm thử mua gói".
14. Trình soạn tin khi hết lượt: nhập dở, bấm "Mua thêm lượt" và "Mua / Nâng cấp gói": hộp lưu nháp hiện ra; thử cả hai nút mua và "Để sau".
15. Còn lượt, nhập dở, bấm "Mua / Nâng cấp gói" rồi Back: dữ liệu và ảnh đã chọn còn nguyên.
16. Sửa tin đã hết hạn khi hết lượt: "Gửi bản sửa & Mua thêm lượt" mở trang mua đè lên, Back về biểu mẫu.

## Rủi ro

- Luồng ETH trên mobile chưa từng thử trên máy; thử trước khi bật cờ.
- Trước đây app chỉ nhận cổng SePay sandbox; nay nhận cả cổng thật như web.
- Mã giao dịch nằm trên máy. Xóa dữ liệu app, cài lại hoặc đổi máy giữa lúc chờ đối soát thì app không đối soát được (web cũng vậy), cần vận hành xử lý. Trả trùng vẫn bị chặn bởi hợp đồng (`paidPayments`, hạn báo giá) và máy chủ.
- Đối soát chỉ chạy khi trang đơn đang mở. Mã dán tay chưa được xác nhận thì phải bấm lại, app không tự lưu.
- Như web, đơn SePay đã đóng trang cổng không mở lại biểu mẫu được: chờ hết hạn hoặc hủy.
- Đơn chờ tạo trên thiết bị khác không hiện ở khung đơn chờ.
- `src/components/listing-manage/**` được một người khác chỉnh giao diện cùng lúc; phần hội viên chỉ chèn sửa nhỏ, nên xem lại bản gộp.
- Trang gói mở đè lên trình soạn: nếu hệ điều hành tắt app khi đang ở app ngân hàng, biểu mẫu chưa lưu vẫn mất như mọi lúc khác.
- (Review 1, chưa sửa vì cần API backend) Máy chủ đã tạo đơn nhưng app mất phản hồi thì không có cách nào lấy lại mã đơn: người dùng phải đợi đơn hết hạn (15 phút) mới mua được. Cần API cho tài khoản tra đơn chờ của mình, hoặc trả mã đơn kèm lỗi `4018`.
- (Review 3, chưa sửa, giới hạn có từ luồng cũ của WebView) Android không gọi `onShouldStartLoadWithRequest` cho form `POST` sang host khác và cho tải tiếp nếu JS trả lời chậm quá 250 ms, nên danh sách host SePay không được bảo đảm cho mọi điều hướng. Muốn chặn chắc phải làm ở lớp native và thử trên máy.

## Xử lý review (`review-hoi-vien-codex.md`)

Kiểm tra lại bằng cách đọc mã trước khi sửa; các lỗi 2, 4-8 đều đúng với mã.

| # | Nội dung | Kết quả |
|---|---|---|
| 1 | Mất mã đơn khi mất phản hồi | Không sửa backend. Lỗi `4018` mà máy không có mã đơn nay nói rõ: có đơn đang chờ, hoàn tất hoặc hủy ở trình duyệt đã tạo, hoặc đợi hết hạn 15 phút |
| 2 | `PENDING` đến muộn ghi đè `PAID` | Đã sửa: `createOrderFeed` dùng chung một lần đọc, đơn đã kết thúc không quay lại chờ; đọc khi app trở lại luôn bắt đầu sau lần đang chạy; hủy/đối soát bỏ lần đọc cũ. Có test |
| 3 | WebView Android không chặn hết host | Không sửa, ghi ở Rủi ro |
| 4 | Kẹt ở trang SePay sau khi từ app ngân hàng về | Đã sửa: đọc đơn khi app trở lại/có thông báo cả khi đang mở SePay; đơn có kết quả thì đóng WebView |
| 5 | Chọn gói từ Trang chủ trên Expo Web bỏ qua chặn | Đã sửa: tự mở hộp thanh toán cũng qua `canPay()` |
| 6 | Đơn SePay `REVIEW` mất lối mở lại | Đã sửa: lưu riêng mã đơn `REVIEW` (không chặn mua mới, đơn mới không ghi đè), trang gói có khung mở lại. Chỉ giữ một đơn `REVIEW` gần nhất. Có test |
| 7 | Còn bấm được giá mua thêm cũ khi đang tải lại | Đã sửa: bỏ giá cũ đến khi có giá mới |
| 8 | Back từ "Quản lý tin đăng" không về trang gói mở từ Trang chủ | Đã sửa trong `HomeScreen`; sửa thêm trong `App.tsx` cho trang gói mở từ menu tài khoản ở các tab khác |
