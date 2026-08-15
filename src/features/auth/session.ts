import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { keycloakConfig } from '@/config/env';
import { authScopes, discovery, redirectUri } from '@/lib/auth/discovery';

const REFRESH_TOKEN_KEY = 'homespace.refreshToken';

let tokens: AuthSession.TokenResponse | null = null;
let refreshPromise: Promise<AuthSession.TokenResponse | null> | null = null;

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isSignedIn = () => tokens !== null;

const persistRefreshToken = async (value: string | null) => {
  try {
    if (value) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, value);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch {
    // SecureStore is not available on every platform; session then lives only in memory.
  }
};

const readRefreshToken = async () => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

const applyTokens = async (next: AuthSession.TokenResponse) => {
  tokens = next;
  await persistRefreshToken(next.refreshToken ?? null);
  notify();
};

export const clearSession = async () => {
  tokens = null;
  await persistRefreshToken(null);
  notify();
};

export const exchangeAuthorizationCode = async (code: string, codeVerifier: string) => {
  const next = await AuthSession.exchangeCodeAsync(
    {
      clientId: keycloakConfig.clientId,
      code,
      redirectUri,
      extraParams: { code_verifier: codeVerifier },
    },
    discovery
  );

  await applyTokens(next);
};

export const restoreSession = async () => {
  const storedRefreshToken = await readRefreshToken();
  if (!storedRefreshToken) {
    return false;
  }

  try {
    const next = await AuthSession.refreshAsync(
      {
        clientId: keycloakConfig.clientId,
        refreshToken: storedRefreshToken,
        scopes: authScopes,
      },
      discovery
    );
    await applyTokens(next);
    return true;
  } catch {
    await clearSession();
    return false;
  }
};

const runRefresh = async () => {
  const current = tokens;
  if (!current?.refreshToken) {
    await clearSession();
    return null;
  }

  try {
    const next = await current.refreshAsync({ clientId: keycloakConfig.clientId }, discovery);
    await applyTokens(next);
    return next;
  } catch {
    await clearSession();
    return null;
  }
};

export const getAccessToken = async (forceRefresh = false) => {
  if (!tokens) {
    return null;
  }

  if (!forceRefresh && !tokens.shouldRefresh()) {
    return tokens.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;
  return refreshed?.accessToken ?? null;
};

export const signOut = async () => {
  const idToken = tokens?.idToken;
  const refreshToken = tokens?.refreshToken;

  await clearSession();

  if (refreshToken) {
    try {
      await AuthSession.revokeAsync(
        {
          clientId: keycloakConfig.clientId,
          token: refreshToken,
          tokenTypeHint: AuthSession.TokenTypeHint.Refresh,
        },
        discovery
      );
    } catch {
      // Session is already dropped locally; a failed revoke must not block sign out.
    }
  }

  if (!discovery.endSessionEndpoint) {
    return;
  }

  const query = [
    `client_id=${encodeURIComponent(keycloakConfig.clientId)}`,
    `post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`,
    idToken ? `id_token_hint=${encodeURIComponent(idToken)}` : null,
  ]
    .filter(Boolean)
    .join('&');

  try {
    await WebBrowser.openAuthSessionAsync(
      `${discovery.endSessionEndpoint}?${query}`,
      redirectUri
    );
  } catch {
    // Keycloak SSO cookie may survive, but the app no longer holds any token.
  }
};
