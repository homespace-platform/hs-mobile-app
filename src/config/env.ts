import { Platform } from 'react-native';
import { deviceUrl } from '@/lib/device-url';

export const apiTransportUrl = (value: string) =>
  deviceUrl(
    value,
    __DEV__ && Platform.OS === 'android' ? process.env.EXPO_PUBLIC_ANDROID_API_HOST : undefined
  );

export const keycloakConfig = {
  baseUrl: process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL ?? 'http://localhost:9000',
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'homespace-platform',
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'homespace-id',
};

export const gatewayBaseUrl = apiTransportUrl(
  process.env.EXPO_PUBLIC_GATEWAY_BASE_URL ?? 'http://localhost:8080'
);
