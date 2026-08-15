export const keycloakConfig = {
  baseUrl: process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL ?? 'http://localhost:9000',
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'homespace-platform',
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'homespace-id',
};

export const gatewayBaseUrl =
  process.env.EXPO_PUBLIC_GATEWAY_BASE_URL ?? 'http://localhost:8080';
