import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { keycloakConfig } from '@/config/env';
import {
  exchangeAuthorizationCode,
  isSignedIn,
  loginWithPassword as loginWithPasswordSession,
  restoreSession,
  signOut,
  subscribeSession,
} from '@/features/auth/session';
import { authScopes, discovery, redirectUri } from '@/lib/auth/discovery';

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  error: string | null;
  canLogin: boolean;
  login: () => Promise<void>;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const handledResponseRef = useRef<AuthSession.AuthSessionResult | null>(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: keycloakConfig.clientId,
      redirectUri,
      scopes: authScopes,
      usePKCE: true,
    },
    discovery
  );

  useEffect(() => {
    let mounted = true;

    restoreSession()
      .then((restored) => {
        if (mounted) setStatus(restored ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        if (mounted) setStatus('signedOut');
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () =>
      subscribeSession(() => {
        setStatus(isSignedIn() ? 'signedIn' : 'signedOut');
      }),
    []
  );

  useEffect(() => {
    // An authorization code is single-use, so each response must be exchanged once.
    if (!response || handledResponseRef.current === response) {
      return;
    }
    handledResponseRef.current = response;

    if (response.type === 'error') {
      setError(response.params.error_description ?? 'Đăng nhập thất bại');
      setStatus('signedOut');
      return;
    }

    if (response.type !== 'success') {
      setStatus('signedOut');
      return;
    }

    const codeVerifier = request?.codeVerifier;
    if (!codeVerifier) {
      setError('Thiếu code verifier của PKCE');
      setStatus('signedOut');
      return;
    }

    setStatus('loading');
    exchangeAuthorizationCode(response.params.code, codeVerifier)
      .then(() => {
        setError(null);
        setStatus('signedIn');
      })
      .catch((exchangeError: unknown) => {
        setError(exchangeError instanceof Error ? exchangeError.message : 'Đổi code thất bại');
        setStatus('signedOut');
      });
  }, [request, response]);

  const login = useCallback(async () => {
    setError(null);
    await promptAsync();
  }, [promptAsync]);

  const loginWithPassword = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      await loginWithPasswordSession(username, password);
    } catch (loginError: unknown) {
      setStatus('signedOut');
      throw loginError;
    }
  }, []);

  const logout = useCallback(async () => {
    setStatus('loading');
    await signOut();
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      error,
      canLogin: request !== null,
      login,
      loginWithPassword,
      logout,
    }),
    [error, login, loginWithPassword, logout, request, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
