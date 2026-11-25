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

// Public web origin used by KYC, membership checkout, and share links.
export const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim() || undefined;

// Mobile's own Origin for the notification socket (independent of the web URL). It must be listed in the
// notification-service NOTIFICATION_REALTIME_ORIGINS; without it that socket stays off (push + REST still work).
export const realtimeOrigin = process.env.EXPO_PUBLIC_REALTIME_ORIGIN?.trim() || undefined;
