# Expo Go

```
npm start

npm run start:tunnel
```

# Development build

```
npm run start:dev-client
```

# Checks

```
npm run typecheck
npm run lint
npm run test:theme
npm run test:auth
npm run test:api
```

# API coverage

Mobile screens use the gateway configured by `EXPO_PUBLIC_GATEWAY_BASE_URL`:

- Search listings by Vietmap city, category and keyword; browse pages, open details,
  save favorites, and record viewing history.
- Request viewing slots and rescheduling; manage appointments as tenant or landlord.
  Booking/rescheduling uses a two-step date/time picker and contact confirmation.
  The calendar disables past/closed days; changing dates automatically reloads
  slots and cancels the previous request. Morning/afternoon/evening slot buttons
  and the fixed footer show the selected time before anything is submitted.
  Both roles can switch between a month/week calendar (confirmed/completed
  appointments) and a vertical list of every status. Select a day for its schedule,
  then tap an appointment to open the existing details and actions.
  The vertical list filters All / Not viewed (pending or confirmed) / Completed.
- Estimate rental costs on the server, read the current reservation policy and
  submit/manage rental requests.
- View payments, bank details and QR codes; upload private proof before reporting
  a transfer; confirm, reject or dispute receipts according to actor and status.
- List owned properties/branches, change listing visibility, and read contracts
  and generated documents. Contract editing/signing and property creation are not
  part of the current mobile screens.
- Update profile/avatar/password, open KYC verification, and refresh its status.
- Search and paginate news; chat and attachment uploads use the existing services.

Notification preferences and help remain marked unavailable because there are no
corresponding backend endpoints. API tests mock HTTP and storage; they never submit
real rental requests or payment confirmations. Test those flows with dedicated
tenant/landlord accounts before release.

# Device testing

For Android Studio's emulator with services on this computer, keep the
`localhost` URLs in `.env` and set `EXPO_PUBLIC_ANDROID_API_HOST=10.0.2.2`.
In Android development builds, API calls and Keycloak token/refresh requests then
use the emulator's direct host address, so password login does not depend on ADB
port forwarding surviving an emulator/ADB restart. This override is ignored on
iOS, web and production builds; remote URLs are never rewritten.

Keycloak browser login/registration still uses its canonical `localhost` hostname.
For those browser flows, forward the service ports after starting the emulator:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:9000 tcp:9000
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8080 tcp:8080
npm run start:dev-client -- --clear
```

Repeat the port forwarding after reconnecting/restarting the emulator. This also
keeps Keycloak's `localhost` redirects and token issuer consistent with the web
and backend. Restart Metro after changing `.env` so the bundle gets the new URLs.

`npm run run:android`, `npm run android` and `npm run start:dev-client` now forward
the Metro port and localhost service ports from `.env` to connected Android devices
automatically. Start the emulator first. If you restart the emulator while Metro
is already running, reconnect without restarting Metro:

```powershell
npm run android:connect
```

Create `.env` from `.env.example` and replace `localhost` with the LAN IP of
the machine running Keycloak and the gateway when testing on a physical device.
Leave `EXPO_PUBLIC_ANDROID_API_HOST` empty on a physical device.
Use a Development Build for Keycloak OAuth redirects; Expo Go cannot use the
custom `homespace://` scheme reliably.

Login and registration reuse the web logo asset. Tap **Đăng ký ngay** on the login
screen to open the mobile registration screen, then **Tiếp tục đăng ký** for the
existing Keycloak registration form. It uses the configured mobile client and
`homespace://oauth2redirect` with S256 PKCE; successful authentication restores
the app session. Closing the browser keeps the registration screen available.
Keycloak must allow user registration and the mobile redirect URI. No separate
public registration API or administrator credentials are used by the app.

# Theme

`global.css` is the only source of app colors: `:root` defines light mode and
`.dark:root` defines dark mode. The app follows the device by default; choose
System / Light / Dark in Profile → Giao diện. The preference is saved on device.
After changing native appearance config, rebuild the development client.

Use semantic NativeWind classes for all current and future screens:

| Purpose                         | Classes                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| Page / card / inset             | `bg-background`, `bg-surface`, `bg-muted`                                   |
| Text / supporting / placeholder | `text-foreground`, `text-secondary`, `text-muted-foreground`, `text-subtle` |
| Border                          | `border-border`, `border-border-strong`                                     |
| Link / selected badge           | `text-primary`, `bg-primary-soft`, `border-primary`                         |
| Filled brand button / text      | `bg-brand`, `text-on-brand`                                                 |
| Neutral selected button / text  | `bg-inverse`, `text-on-inverse`                                             |
| Disabled button / text          | `bg-disabled`, `text-on-disabled`                                           |
| Status                          | `text-danger`, `bg-danger-soft` (also `success`, `warning`)                 |

Use `Icon` from `@/components/Icon` with `className="text-primary"` for Ionicons.
NativeWind's `ActivityIndicator` supports `className="text-primary"`; inputs use
`placeholder:text-subtle selection:text-primary`. Avoid hex values, palette
classes such as `bg-white`/`text-slate-900`, and per-screen `dark:` colors. Add a
semantic token in **both** CSS themes and `tailwind.config.js` if a new role is needed.
