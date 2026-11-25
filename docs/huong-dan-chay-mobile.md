# Chạy HomeSpace Mobile trên Windows và Samsung Remote Test Lab

Hướng dẫn này chạy bản Development Build từ máy Windows trên Samsung Remote Test Lab. Cấu hình kết nối được cấp riêng.

## Tóm tắt: setup máy mới

1. Cài Git, Node.js LTS, JDK 21, Android Studio (mục 1).
2. `git clone` rồi `npm ci` (mục 2).
3. Thêm `.env` và `google-services.json` vào thư mục gốc `hs-mobile-app` (mục 2b). Hai file này không có trong git.
4. `npx expo prebuild --platform android --clean --no-install`, rồi `.\gradlew.bat :app:assembleDebug ...` (mục 3).
5. Cài APK, chạy Metro (mục 4 và 5).
6. Thử thông báo đẩy (mục 6).

## 1. Chuẩn bị máy mới

Cài Git, Node.js LTS, JDK và Android Studio. Trong **Android Studio → SDK Manager**, cài **Android SDK Platform 36**, **Platform-Tools** và **Build-Tools**. Bản dev đã được build với JDK 21. Lần đầu, Gradle có thể tải thêm NDK và CMake nếu license SDK đã được chấp nhận. [Cài Android SDK trên Windows](https://docs.expo.dev/workflow/android-studio-emulator/#windows)

Mở PowerShell. Nếu SDK ở thư mục khác, dùng đường dẫn trong ô **Android SDK Location** của Android Studio.

```powershell
if (-not $env:ANDROID_HOME) {
  $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$env:Path = "$(Join-Path $env:ANDROID_HOME 'platform-tools');$env:Path"
node --version
java -version
adb version
```

## 2. Clone và cài dependencies

Tại thư mục cha bạn muốn lưu dự án, chạy:

```powershell
git clone https://github.com/homespace-platform/hs-mobile-app.git
cd hs-mobile-app
npm ci
# Kiểm tra đang dùng bản mới có thông báo đẩy (phải thấy dòng expo-notifications)
Select-String -Path package.json -Pattern "expo-notifications"
```

Nếu lệnh `Select-String` không in ra gì, bản code trên máy này còn cũ: chạy `git pull` (hoặc nhờ người phát triển push code mới lên GitHub) rồi `npm ci` lại.

## 2b. Hai file không có trong git (bắt buộc với máy mới)

Cả hai file đều bị git bỏ qua, nên clone về sẽ **không có**. Phải copy từ máy đã chạy được, hoặc tạo lại như sau.

| File                   | Đặt ở                       | Cách có                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env`                 | thư mục gốc `hs-mobile-app` | Copy từ `.env.example` rồi điền: `EXPO_PUBLIC_GATEWAY_BASE_URL`, `EXPO_PUBLIC_KEYCLOAK_BASE_URL`, `EXPO_PUBLIC_KEYCLOAK_REALM`, `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID`, `EXPO_PUBLIC_REALTIME_ORIGIN`. `EXPO_PUBLIC_ANDROID_API_HOST` chỉ dành cho emulator của Android Studio, **để trống** khi chạy trên Samsung. `EXPO_PUBLIC_WEB_BASE_URL` tùy chọn. Thiết bị trên Samsung Remote Test Lab **không** nối được `localhost` của máy bạn, nên các địa chỉ này phải là địa chỉ server. |
| `google-services.json` | thư mục gốc `hs-mobile-app` | Firebase Console → project `homespace-dev-f20fa` → Project settings → Your apps → app Android `com.homespace.mobile` → **Download google-services.json**. File này không phải bí mật cao nhưng đừng đưa lên git hay chat công khai.                                      |

`EXPO_PUBLIC_REALTIME_ORIGIN` (ví dụ `https://mobile.homespace.id.vn`) phải có trong `NOTIFICATION_REALTIME_ORIGINS` của notification-service, nếu không chuông và chat không cập nhật tức thì khi đang mở app (thông báo đẩy khi tắt app vẫn chạy).

`google-services.json` chỉ chứa cấu hình **phía app** (mã project, mã app, khóa API của app), không chứa khóa bí mật của server. Khác với file tài khoản dịch vụ (service account) hoặc `FIREBASE_PRIVATE_KEY` của backend, tuyệt đối không bao giờ đưa các thứ đó lên git. Hiện file này đang được git bỏ qua (`.gitignore`) nên mỗi máy phải tự chép. Nếu sau này quyết định commit file này lên repo, hãy bỏ dòng `google-services.json` khỏi `.gitignore`, và nên giới hạn khóa API trong Google Cloud Console theo app Android (tên gói `com.homespace.mobile`) để người ngoài có xem được file cũng không dùng được khóa.

Hai file này tác động khác nhau:

- `google-services.json` được **đóng vào APK lúc build**. Thiếu file này lúc build thì app không lấy được token thông báo đẩy. Máy chỉ cài APK (không build) thì không cần file này.
- `.env` được **Metro nạp lúc chạy** (`npx expo start`). Máy chạy Metro cần `.env` đúng, dù APK được build ở máy khác. Đổi `.env` thì chạy lại Metro bằng `npx expo start --dev-client --localhost --port 4002 -c` để xóa cache.

## 3. Build APK dev

Chạy bước này lần đầu sau khi clone hoặc khi cần build lại phần native. Phải build lại khi: thêm hoặc đổi `google-services.json`, đổi `app.json` / `app.config.js`, hoặc thêm thư viện native (ví dụ `expo-notifications`). Chỉ sửa code JS thì không cần. APK này dành cho thiết bị Android ARM64.

Thêm `--clean` cho `prebuild` sau khi đổi cấu hình native để thư mục `android/` (git bỏ qua) được tạo lại sạch. Thư mục `android/` do `prebuild` sinh ra, nên khi build lỗi khó hiểu bạn có thể **xóa hẳn thư mục `android/`** rồi chạy lại hai bước dưới đây; lần build sau sẽ lâu hơn vì Gradle tải lại cache.

```powershell
npx expo prebuild --platform android --clean --no-install
Push-Location android
try {
  .\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
} finally {
  Pop-Location
}
```

Trước khi build Gradle, kiểm tra file Firebase đã được chép vào project Android (nếu thiếu, build vẫn thành công nhưng app **không** nhận được thông báo đẩy):

```powershell
Test-Path android\app\google-services.json   # phải ra True
```

Sau khi thấy `BUILD SUCCESSFUL`, lấy APK tại `android/app/build/outputs/apk/debug/app-debug.apk`.

## 4. Kết nối Samsung và cài APK

Mở phiên Samsung Remote Test Lab, chạy `rdb.exe` ở một cửa sổ riêng, rồi bật **Remote Debug Bridge** trong phiên Samsung. Giữ cửa sổ RDB mở. Lấy số cổng từ dòng `RDB server listening on port:`. [Hướng dẫn RDB của Samsung](https://developer.samsung.com/remote-test-lab/blog/en/2022/07/13/connect-to-devices-on-remote-test-lab-using-rdb-in-android-studio)

Trong PowerShell đang ở repo, đổi `localhost:30193` trong lệnh bên dưới thành cổng thực tế của phiên (dòng `RDB server listening on port:`). Khi `adb devices -l` báo `device`, cài APK nếu phiên này chưa có HomeSpace.

```powershell
$serial = "localhost:35910"
adb disconnect $serial
adb connect $serial
adb -s $serial shell echo OK
adb devices -l
adb -s $serial install -r .\android\app\build\outputs\apk\debug\app-debug.apk
adb -s $serial reverse tcp:4002 tcp:4002
```

## 5. Mở HomeSpace

```powershell
npx expo start --dev-client --localhost --port 4002
```

Khi Metro báo **Using development build**, bấm **a**. Giữ Metro và RDB mở trong lúc test.

## 6. Thử thông báo đẩy khi tắt app

Cần: APK được build **sau khi** có `google-services.json` (bước 2b và 3), backend notification-service chạy bản mới với `PUSH_ENABLED=true` và khóa Firebase.

1. Đăng nhập trong app, bấm **Cho phép** khi hỏi quyền thông báo (Android 13 trở lên bắt buộc).
2. Vào **Hồ sơ → Cài đặt → Thông báo**. Thẻ "Thông báo trên thiết bị này" phải báo đã đăng ký.
3. Vuốt tắt app khỏi danh sách gần đây.
4. Từ web, dùng tài khoản khác nhắn tin cho tài khoản đang đăng nhập trên máy. Thông báo "Bạn có tin nhắn mới." phải hiện ở khay máy. Chạm vào thì mở tab Tin nhắn.

Giới hạn của Android: bấm **Force stop** trong cài đặt app sẽ chặn mọi thông báo đẩy cho tới lần mở app tiếp theo. Một số hãng (Xiaomi, Oppo, Huawei) có trình tiết kiệm pin chặn thông báo, cần cho phép app chạy nền. iOS chưa được hỗ trợ.

| Nếu gặp                                                      | Cách xử lý                                                                                                                                                                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No development build (com.homespace.mobile)`                | Cài APK vào đúng thiết bị ở bước 4, chờ `Success`, rồi bấm **a** lại.                                                                                                                                                                     |
| Thẻ thông báo không báo đăng ký, hoặc không có thông báo đẩy | Kiểm tra APK được build **sau khi** có `google-services.json`, đã bấm **Cho phép** quyền thông báo, backend chạy bản mới. Nếu vẫn không được, gửi log notification-service và `status`, `errorCode` trong bảng `notification_deliveries`. |
| Chuông và chat không cập nhật ngay khi đang mở app           | Kiểm tra `EXPO_PUBLIC_REALTIME_ORIGIN` trong `.env`, origin đó có trong `NOTIFICATION_REALTIME_ORIGINS` của server, rồi chạy lại Metro với `-c`.                                                                                          |
| `adb devices -l` báo `offline`                               | Kiểm tra cổng RDB hiện tại, chạy `adb disconnect $serial` rồi `adb connect $serial`, sau đó chuyển tiếp lại cổng `4002`.                                                                                                                  |

Khi đổi phiên Samsung, lặp bước 4 và 5. Dùng lại APK đã build nếu phần native vẫn như cũ.
