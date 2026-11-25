# Pha 3.2 — vệ sinh tệp tạm nhạy cảm (RD-13, RC1-05)

Trạng thái: **xong phần code và test**; chưa kiểm trên thiết bị.

## Thư mục cache của bộ chọn (đọc từ mã thư viện đã cài)

| Thư viện                                         | Android                                                                                                                                                   | iOS                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| expo-image-picker 17                             | `context.cacheDir/ImagePicker/<uuid>.<ext>` (`ImagePickerUtils.createOutputFile`). Camera ghi tệp tạm rồi tự xoá; ảnh trả về là bản thứ hai cùng thư mục. | `Library/Caches/ImagePicker/` (`MediaHandler.generateUrl`)                     |
| expo-document-picker 14 (`copyToCacheDirectory`) | `context.cacheDir/DocumentPicker/<uuid>.<ext>`                                                                                                            | `Library/Caches/DocumentPicker/`. Xem mục "Chưa kiểm" về bản `asCopy` của iOS. |

## Kiểm kê: đường ghi → khi nào xoá (trước khi sửa)

| Đường ghi                                                                                                             | Nơi ghi trong cache               | Xoá trước Pha 3.2                        |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| `services/rental/files.ts` `saveBase64ToCache` / `blobToCacheFile` (PDF hợp đồng, PDF đã ký, PDF khiếu nại, biên lai) | `rental-<uuid>/`                  | tuỳ nơi gọi                              |
| `components/rental/contract/documentFiles.ts` `downloadUrlToCache` (PDF/DOCX)                                         | `contract-<uuid>/`                | ngay sau khi bảng chia sẻ trả về         |
| `services/billingApi.ts` `shareReceiptPdf`                                                                            | `homespace-receipt-<id>.pdf`      | không bao giờ                            |
| `RentalPaymentModal` `downloadQr` (VietQR: tài khoản, số tiền)                                                        | `VietQR_<ref>.png`                | không bao giờ                            |
| `EvidencePicker` (chứng cứ, chứng từ chuyển khoản)                                                                    | `ImagePicker/`, `DocumentPicker/` | không bao giờ                            |
| `ContractBlockchainProof` (PDF để đối chiếu hash)                                                                     | `DocumentPicker/`                 | ngay sau khi băm                         |
| Bộ chọn ngoài luồng thuê (hồ sơ, chat, tin đăng, chi nhánh, quản lý)                                                  | `ImagePicker/`, `DocumentPicker/` | không đổi; chỉ bị dọn khi kết thúc phiên |
| `ChatDocument`                                                                                                        | `chat-<uuid>/`                    | ngoài phạm vi, không đụng                |

## Quyết định

1. **Một thư mục.** Mọi tệp thuê do app ghi nằm ở `cache/rental-files/<uuid>/<tên>` (`src/services/rental/cache.ts`: `writeRentalFile`). Tên tệp và hành vi của nơi gọi giữ nguyên.
2. **Dọn khi hết phiên.** `clearSession` và `restoreSession` khi thiếu refresh token gọi `purgeSensitiveCache()` ngoài đường chờ đăng xuất. Hàm duyệt từng mục trong `rental-files/`, `ImagePicker/`, `DocumentPicker/` và các tệp kiểu cũ ở gốc cache. Mục đang dùng được đánh dấu để dọn sau khi thao tác kết thúc. Kết quả đọc thư mục đến muộn sau khi đăng nhập lại được bỏ qua để bảo vệ tệp của phiên mới.
3. **Ghi muộn.** Lượt tải xong sau khi phiên đã hết bị xoá ngay, kể cả khi tài khoản khác đã đăng nhập.
4. **An toàn đường dẫn.** Chỉ xoá bên trong cache app: bản sao của bộ chọn phải là tệp nằm ngay trong `ImagePicker/` hoặc `DocumentPicker/`; tệp thuê phải đúng `rental-files/<thư mục>/<tệp>`. Từ chối `..` (kể cả mã hoá), `?`, `#`, NUL, chuỗi mã hoá hỏng, `content://`, `ph://`.
5. **Chia sẻ.** Trên Android, ứng dụng nhận có thể tiếp tục đọc sau khi `shareAsync` trả về. Bản đã bàn giao được giữ thêm **10 phút** (`SHARED_COPY_TTL_MS`), kể cả khi đăng xuất. Lượt chia sẻ lỗi nhả tệp ngay. Timer JS có thể chạy muộn khi app ở nền.
6. **Bản sao của bộ chọn.** `EvidencePicker` dọn bản bị từ chối, đọc lỗi hoặc đến muộn. `useDiscardDroppedFiles` dọn bản sao khi nháp bỏ tệp. Gửi lỗi giữ bản sao để thử lại. Khi tệp còn đang được dùng, `withFileLease` giữ nó cho đến khi thao tác kết thúc. Luồng tải nhiều tệp giữ toàn bộ tệp ngay trước lần chờ đầu tiên.
7. **Bộ nhớ module.** `src/lib/session-end.ts` dọn cache hồ sơ (`userApi`) và cache Quản lý (`managementApi`). Khóa gửi yêu cầu tồn tại theo cặp tài khoản và tin đăng đến khi POST kết thúc, kể cả khi người dùng đăng nhập lại. Nháp liên hệ và điều hướng thuê nằm trong state của màn hình. `banksCache` là danh mục công khai.

| Đường ghi                                                      | Xoá sau Pha 3.2                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| PDF/DOCX qua `saveBase64ToCache`, `downloadUrlToCache`         | xong thao tác (trình xem đóng); đã chia sẻ thì sau 10 phút; chậm nhất khi hết phiên |
| `shareReceiptPdf`, VietQR                                      | sau 10 phút (lỗi: ngay); chậm nhất khi hết phiên                                    |
| `contractService.downloadDocument`                            | dọn ngay khi lỗi chia sẻ, giữ 10 phút sau khi chuyển tệp cho app nhận                 |
| Bản sao của `EvidencePicker`                                   | khi nháp bỏ tệp (mục 6); chậm nhất khi hết phiên                                    |
| Bản sao ở `ContractBlockchainProof`                            | ngay sau khi băm (nay kiểm đường dẫn)                                               |
| Bộ chọn ngoài luồng thuê, kể cả `ManagementScreen.chooseProof` | khi hết phiên                                                                       |

## Giới hạn

- App bị kill trong lúc còn phiên: timer 10 phút và nháp mất theo tiến trình; tệp còn lại đến lần hết phiên. Không dọn lúc mở app khi còn phiên vì app nhận chia sẻ có thể vẫn đang đọc.
- `ManagementScreen.chooseProof` (luồng cũ, do tác vụ 3.1 sửa) chưa dọn theo vòng đời nháp.
- Bấm vào thông báo đẩy khi đã đăng xuất: "last response" của `expo-notifications` còn ở native (chỉ có id; server vẫn kiểm quyền). Không đổi.
- Nếu phiên mới mở trong lúc hệ thống còn đang đọc thư mục, các mục cũ chưa được xác định sẽ được dọn ở lần purge kế tiếp.

## Chưa kiểm trên thiết bị

- Đường dẫn thật của bộ chọn trên Android/iOS khớp `FileSystem.cacheDirectory`. Nếu không khớp thì việc xoá từng bản sao bị bỏ qua (không xoá nhầm), còn dọn thư mục khi hết phiên dùng đường dẫn tự dựng.
- iOS: `UIDocumentPickerViewController(asCopy: true)` có thể để thêm một bản trong `tmp/` do hệ điều hành quản lý, ngoài cache của app; code này không đụng tới.
- Chia sẻ qua Gmail/Drive/Zalo đọc xong tệp trong 10 phút.

## Kiểm tra (26/11/2026)

| Lệnh                                                                                                                  | Kết quả                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                                                                                                    | sạch                                                                                                                                       |
| `node --test tests/rental-cache.test.cjs`                                                                             | 11/11                                                                                                                                      |
| `test:rental-api` / `rental-billing` / `rental-onboarding` / `rental-ui` / `rental-contract-signing` / `auth` / `api` | 15/15, 22/22, 27/27, 9/9, 20/20, 4/4, 47/47                                                                                                |
| thêm `rental-contract-amendment`, `rental-contract-detail`, `rental-requests`, `rental-logic`, `rental-nav`           | 20/20, 15/15, 28/28, 28/28, 16/16                                                                                                          |
| eslint, prettier (file đã sửa)                                                                                        | sạch, trừ 2 lỗi `__dirname` có sẵn trong `tests/api.test.cjs` (file này không chạy prettier vì vốn chưa định dạng; chỉ thêm một dòng stub) |

Đề xuất thêm script (chưa sửa `package.json`): `"test:rental-cache": "node --test tests/rental-cache.test.cjs"`.
