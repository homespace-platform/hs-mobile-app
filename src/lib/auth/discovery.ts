import type { DiscoveryDocument } from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

import { apiTransportUrl, keycloakConfig } from '@/config/env';

const oidcBaseUrl = `${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}/protocol/openid-connect`;

export const registrationEndpoint = `${oidcBaseUrl}/registrations`;

export const discovery: DiscoveryDocument = {
  authorizationEndpoint: `${oidcBaseUrl}/auth`,
  tokenEndpoint: apiTransportUrl(`${oidcBaseUrl}/token`),
  revocationEndpoint: apiTransportUrl(`${oidcBaseUrl}/revoke`),
  userInfoEndpoint: apiTransportUrl(`${oidcBaseUrl}/userinfo`),
  endSessionEndpoint: `${oidcBaseUrl}/logout`,
};

export const redirectUri = makeRedirectUri({
  scheme: 'homespace',
  path: 'oauth2redirect',
});

export const authScopes = ['openid', 'profile', 'email', 'offline_access'];

/** Keycloak login/registration pages are shown in Vietnamese, matching the app. */
export const authUiLocales = 'vi';

/**
 * Presentation of the system auth browser (Android Custom Tab / iOS ASWebAuthenticationSession).
 * createTask:false keeps the tab inside the app's task, so the homespace:// redirect brings
 * MainActivity (singleTask) back on top and the tab is gone instead of lingering in Recents.
 * The toolbar matches the white header of the HomeSpace Keycloak theme; it is a native
 * browser color, not an app theme token.
 */
export const authBrowserOptions = {
  createTask: false,
  showTitle: true,
  enableBarCollapsing: true,
  toolbarColor: '#ffffff',
} as const;
