# Chạy HomeSpace Mobile trên Windows và Samsung Remote Test Lab

Hướng dẫn này chạy bản Development Build từ máy Windows trên Samsung Remote Test Lab. Cấu hình kết nối được cấp riêng.

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
```

## 3. Build APK dev

Chạy bước này lần đầu sau khi clone hoặc khi cần build lại phần native. APK này dành cho thiết bị Android ARM64.

```powershell
npx expo prebuild --platform android --no-install
Push-Location android
try {
  .\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
} finally {
  Pop-Location
}
```

Sau khi thấy `BUILD SUCCESSFUL`, lấy APK tại `android/app/build/outputs/apk/debug/app-debug.apk`.

## 4. Kết nối Samsung và cài APK

Mở phiên Samsung Remote Test Lab, chạy `rdb.exe` ở một cửa sổ riêng, rồi bật **Remote Debug Bridge** trong phiên Samsung. Giữ cửa sổ RDB mở. Lấy số cổng từ dòng `RDB server listening on port:`. [Hướng dẫn RDB của Samsung](https://developer.samsung.com/remote-test-lab/blog/en/2022/07/13/connect-to-devices-on-remote-test-lab-using-rdb-in-android-studio)

Trong PowerShell đang ở repo, đổi `41813` thành cổng thực tế của phiên. Khi `adb devices -l` báo `device`, cài APK nếu phiên này chưa có HomeSpace.

```powershell
$serial = "localhost:42359"
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

| Nếu gặp | Cách xử lý |
| --- | --- |
| `No development build (com.homespace.mobile)` | Cài APK vào đúng thiết bị ở bước 4, chờ `Success`, rồi bấm **a** lại. |
| `adb devices -l` báo `offline` | Kiểm tra cổng RDB hiện tại, chạy `adb disconnect $serial` rồi `adb connect $serial`, sau đó chuyển tiếp lại cổng `4002`. |

Khi đổi phiên Samsung, lặp bước 4 và 5. Dùng lại APK đã build nếu phần native vẫn như cũ.
