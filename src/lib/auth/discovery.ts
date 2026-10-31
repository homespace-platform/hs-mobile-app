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
