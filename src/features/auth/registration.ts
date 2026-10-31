import { AuthRequest, CodeChallengeMethod } from 'expo-auth-session';

import { keycloakConfig } from '@/config/env';
import { exchangeAuthorizationCode } from '@/features/auth/session';
import { authScopes, discovery, redirectUri, registrationEndpoint } from '@/lib/auth/discovery';

export async function registerWithKeycloak() {
  // A fresh state and PKCE verifier are required for each registration attempt.
  const request = new AuthRequest({
    clientId: keycloakConfig.clientId,
    redirectUri,
    scopes: authScopes,
    usePKCE: true,
    codeChallengeMethod: CodeChallengeMethod.S256,
    extraParams: { ui_locales: 'vi' },
  });
  const response = await request.promptAsync({
    ...discovery,
    authorizationEndpoint: registrationEndpoint,
  });

  if (response.type === 'cancel' || response.type === 'dismiss') return;
  if (response.type === 'error') {
    throw new Error(
      response.error?.message ?? response.params.error_description ?? 'Đăng ký thất bại'
    );
  }
  if (response.type !== 'success') {
    throw new Error('Cửa sổ xác thực đang bận. Vui lòng thử lại.');
  }
  if (!response.params.code || !request.codeVerifier) {
    throw new Error('Thiếu thông tin xác thực sau đăng ký. Vui lòng thử lại.');
  }
  await exchangeAuthorizationCode(response.params.code, request.codeVerifier);
}
