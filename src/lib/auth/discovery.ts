import type { DiscoveryDocument } from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

import { keycloakConfig } from '@/config/env';

const oidcBaseUrl = `${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}/protocol/openid-connect`;

export const discovery: DiscoveryDocument = {
  authorizationEndpoint: `${oidcBaseUrl}/auth`,
  tokenEndpoint: `${oidcBaseUrl}/token`,
  revocationEndpoint: `${oidcBaseUrl}/revoke`,
  userInfoEndpoint: `${oidcBaseUrl}/userinfo`,
  endSessionEndpoint: `${oidcBaseUrl}/logout`,
};

export const redirectUri = makeRedirectUri({
  scheme: 'homespace',
  path: 'oauth2redirect',
});

export const authScopes = ['openid', 'profile', 'email', 'offline_access'];
