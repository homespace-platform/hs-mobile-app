# C. Giao diện đăng tin trên mobile

Nguồn chuẩn: `hs-web-app/app/dashboard/properties/new/**`. Không sửa `hs-web-app`, `hs-core-api` và các module logic của phần B.

**Trạng thái:** đã xong phần mã. **Chưa chạy trên điện thoại, trình giả lập hay backend thật.** Thay đổi sau review: [`review-xu-ly.md`](review-xu-ly.md).

## 1. Checklist bàn giao từ B

"Xong" nghĩa là đã nối trong mã, chưa nghiệm thu trên máy.

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| `useFeatureGate(LISTING_POST)` thay form bằng lý do khóa | Xong | Thiếu KYC thì có thêm nút "Xác minh danh tính" |
| KYC khi mở màn hình và khi lưu trả `kyc` | Xong, khác web | Hiện màn khóa / hộp thoại có nút gọi `startKyc`, không tự mở trình duyệt. Xác minh xong thì kiểm tra lại |
| Đang tải, lỗi tải, `notice`, màn khóa tin cho thuê ngoài | Xong | Màn khóa có "Nhân bản thành tin mới", "Xem chi tiết tin", "Quay lại danh sách tin" |
| Nối `duplicateFromId` | Xong | |
| Ba tiêu đề và banner nhân bản | Xong | |
| Wizard 6 bước (tạo, nhân bản), một trang (sửa), bước 6 sửa tại chỗ | Xong | |
| "Tiếp tục", stepper, chuyển bước và cuộn tới ô lỗi, cuộn đầu khi đổi bước | Xong | Cuộn tới ô lỗi trên cùng, không tự bật bàn phím |
| Catalog tải theo loại hình, chỉ nhận kết quả mới nhất, báo lỗi thay trường chính sách | Xong | Có nút "Tải lại chính sách" |
| Tiêu đề 150 ký tự, ngày từ hôm nay | Xong | |
| Khóa loại hình, xác nhận đổi loại hình, chọn chi nhánh | Xong | |
| 6 ảnh / 3 video, ảnh bìa, lỗi từng tệp | Xong | Mỗi tệp mới có trạng thái chờ / đang tải / đã tải; dòng tiến độ ở chân trang |
| Chi tiết theo `DETAIL_SECTIONS`, tài sản bàn giao, tiện ích | Xong | Tiện ích tự nhập chỉ hiện sau khi catalog tải xong |
| Giá, cọc, thương lượng, số tiền định dạng VND | Xong | |
| Chi phí theo `EXPENSE_CONTROLS`, phí khác | Xong | Luôn sửa được, kể cả khi chọn chi nhánh |
| Chính sách: quy định hệ thống, gợi ý, ghi chú | Xong | |
| Địa chỉ hồ sơ / mới / chi nhánh, tìm Vietmap | Xong | Có ô "Ghi chú vị trí" sau khi chọn địa chỉ mới (thêm lại sau review) |
| Lịch xem | Xong | |
| Sinh mô tả: kiểm tra trước, xác nhận thay thế, khóa ô, đổi chữ, hủy | Xong | |
| Một lần lưu tại một thời điểm, khóa form, `markUploaded` | Xong | Lỗi lưu có "Thử lại", chỉ tải tệp còn thiếu |
| `requiresEditReview`, xác nhận khi sửa | Xong | |
| `saved` / `error` / `externallyRented` | Xong | Sau khi lưu: nơi gọi giữ hành vi cũ (danh sách tải lại; từ trang chi tiết thì tải lại tin, bản sao thì về danh sách) |
| Hết lượt: banner, modal, tải lại gói | Xong một phần | Modal chọn lưu nháp hoặc gửi bản sửa theo trạng thái tin. **Không có "Mua thêm lượt"** vì mobile chưa có luồng mua lượt lẻ. "Mua gói" mở Trang chủ như danh sách tin |
| Không chặn nút gửi theo số lượt | Xong | |
| Xác nhận khi thoát chưa lưu | Xong | Chỉ hỏi khi người dùng đã sửa gì đó. Back trong wizard về bước trước; "Đóng" thoát |

## 2. Khác web có chủ ý

- Thẻ gói dùng lại `MembershipCard` của danh sách tin, chỉ hiện ở bước 1, bước 6 và màn sửa. Khi form đã sửa và hết lượt, nút mua trên thẻ mở modal hết lượt.
- Gợi ý tiêu đề ghi tối thiểu 15 ký tự (web ghi 10 nhưng kiểm tra 15). Gợi ý ảnh ghi 25MB theo giới hạn thật.
- Thanh mục cố định phía trên; stepper cuộn theo trang; chân trang ẩn khi bàn phím mở.
- Thông báo ngắn (kiểm tra lỗi, chi nhánh, mô tả) nằm ngay trên chân trang; lỗi lưu và lưu thành công dùng hộp thoại.
- Ô chọn mở bảng chọn toàn màn hình thay cho `<select>`.
- Như web, lỗi dưới ô nhập chỉ xóa ở lần kiểm tra tiếp theo.
- Ô tiền dùng `VndMoneyInput` (số nguyên đồng; giá và cọc trần 1.000 tỷ).

## 3. File

Mới, trong `src/components/listing-editor/`: `useListingEditor.ts`, `ui.tsx`, `BasicInfoSection`, `MediaField`, `DetailsSection`, `FurnishingAssets`, `AmenitiesSection`, `PoliciesSection`, `ExpensesSection`, `PricingSection`, `LocationSection`, `ViewingScheduleSection`, `DescriptionSection`, `EditorNav`, `EditorActions`, `QuotaModal` (các file `.tsx`).

Sửa:

- `src/screens/ListingDraftScreen.tsx` (viết lại). Giữ props cũ, thêm ba prop tùy chọn `onViewListing`, `onDuplicate`, `onOpenMembership`.
- `src/components/listing-manage/MyListingsScreen.tsx`, `src/screens/ListingDetailScreen.tsx`: truyền ba prop mới và `key`.
- `src/components/rental/contract/anchors.tsx`: thêm `scrollToFirst`.
- `src/components/rental/shared/VndMoneyInput.tsx`: thêm prop `error`.
- `src/services/managementApi.ts`: xóa `statusLabel`, `getManagementPage`, `performManagementAction` và kiểu đi kèm.
- `tests/api.test.cjs`: bỏ 4 ca của mã đã xóa. `tests/rental-cache.test.cjs`: trỏ sang `services/listingEditorApi.ts`. `tests/listing-editor.test.cjs`: thêm 1 ca cho `scrollToFirst`.

Xóa: `src/lib/listing-create.ts`, `listing-edit.ts`, `listing-draft.ts`.

Hai mục "Chưa xong" của phần A (sửa tin `RENTED`, nhân bản) được giải quyết bởi màn mới.

## 4. Kiểm tra đã chạy

- `npm run typecheck`: đạt.
- `npm run test:listing-editor` 28/28, `test:listing-manage` 9/9, `test:theme` 5/5, `test:api` 37/37.
- `node --test` cho `rental-cache`, `rental-money`, `rental-contract-detail`, `rental-contract-amendment`, `rental-ui`, `rental-nav`, `rental-requests`, `appointment-manage`: 136/136.
- `eslint` trên file giao diện đã đổi và `prettier` trên file mới: sạch.
- `npx expo export --platform android --no-bytecode` (offline, không nạp `.env`): đóng gói thành công. Đây chỉ là kiểm tra đóng gói.

## 5. Kịch bản thử trên điện thoại

Cần backend chạy, tài khoản đã KYC, và `EXPO_PUBLIC_WEB_BASE_URL` cho phần sinh mô tả.

1. Quản lý tin → "Đăng tin mới". Bấm "Tiếp tục" khi để trống: lỗi đỏ dưới ô, cuộn tới ô đầu tiên.
2. Bước 1: chọn chi nhánh rồi bỏ chọn; đổi loại hình (thử "Giữ nguyên" và "Đồng ý đổi"); chọn 2 ảnh, 1 video, thử video dài hơn 2 phút.
3. Bước 2-4: thêm tài sản, tiện ích tự nhập, đổi cách tính phí, thêm phí khác, đổi chính sách, chọn lịch xem. Kiểm tra bàn phím không che ô đang nhập.
4. Bước 5: tìm địa chỉ, thử cả địa chỉ hồ sơ; "Tạo mô tả AI" hai lần (lần hai phải hỏi thay thế).
5. Bước 6: bấm thanh mục, sửa tại chỗ, "Gửi duyệt"; xem tiến độ tải tệp. Tắt mạng giữa chừng, bật lại, "Thử lại".
6. Nút Back Android: ở bước 3 phải về bước 2; ở bước 1 phải hỏi khi đã nhập; trong bảng chọn chỉ đóng bảng.
7. Sửa tin đang hiển thị: không có "Lưu nháp", "Cập nhật & Gửi duyệt" có hộp xác nhận. Kiểm tra ảnh, phí, chính sách cũ còn nguyên.
8. Nhân bản một tin: tiêu đề có "(Bản sao)", mã phòng / mã căn trống, tin gốc không đổi.
9. Tài khoản hết lượt: gửi duyệt → modal → "Lưu nháp & Mua gói đăng tin" → tin nháp được lưu, mở Trang chủ.
10. Thử cả giao diện sáng, tối và màn hình hẹp (360 dp).

## 6. Rủi ro

- Cuộn tới ô lỗi (`measureLayout`), thanh mục tự đánh dấu theo vị trí cuộn, bàn phím trên Android tràn viền và iOS: chỉ kiểm được trên máy thật.
- Chọn nhiều video cùng lúc và đọc `duration` / `fileSize` phụ thuộc thiết bị.
- Cả form vẽ lại mỗi lần gõ; nếu máy yếu bị giật thì tách `memo` theo section.
- Android thu hồi app khi đang mở thư viện ảnh sẽ mất dữ liệu chưa lưu (màn cũ cũng vậy).
- Nếu app chuyển màn do bấm thông báo đẩy khi đang soạn, dữ liệu chưa lưu mất và không có hỏi lại (hành vi điều hướng sẵn có).
