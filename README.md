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
```

# Device testing

For Android Studio's emulator with services on this computer, keep the
`localhost` URLs in `.env` and forward the service ports after starting the emulator:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:9000 tcp:9000
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8080 tcp:8080
npm run start:dev-client -- --clear
```

Repeat the port forwarding after reconnecting/restarting the emulator. This also
keeps Keycloak's `localhost` redirects and token issuer consistent with the web
and backend. Restart Metro after changing `.env` so the bundle gets the new URLs.

Create `.env` from `.env.example` and replace `localhost` with the LAN IP of
the machine running Keycloak and the gateway when testing on a physical device.
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
