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
```

# Device testing

Create `.env` from `.env.example` and replace `localhost` with the LAN IP of
the machine running Keycloak and the gateway when testing on a physical device.
Use a Development Build for Keycloak OAuth redirects; Expo Go cannot use the
custom `homespace://` scheme reliably.
