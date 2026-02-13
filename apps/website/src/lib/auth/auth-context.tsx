'use client';

import { createApiClient } from '@repo/api';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | null;
}

// ============================================================================
// Storage helpers
// ============================================================================

const STORAGE_KEY = 'mls_auth';

function persistAuth(state: {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // SSR or storage unavailable
  }
}

function loadAuth(): {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // SSR or storage unavailable
  }
}

// ============================================================================
// JWT helpers
// ============================================================================

/** Decode a JWT payload without verification (client-side only). */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1] as string;
    const padded =
      payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** Returns true if the token expires within the given buffer (default 60 s). */
function isTokenExpiringSoon(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp - Math.floor(Date.now() / 1000) < bufferSeconds;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = 'localhost:3001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: true,
  });

  const refreshingRef = useRef<Promise<string | null> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- token refresh logic ------------------------------------------------

  const refreshAccessToken = useCallback(
    async (currentRefreshToken: string): Promise<string | null> => {
      try {
        const client = createApiClient(API_BASE);
        const { data, error } = await client.auth.refresh.post({
          refreshToken: currentRefreshToken,
        });

        if (error || !data) {
          // Refresh failed – force sign-out
          clearAuth();
          setState({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
          });
          return null;
        }

        const refreshData = data as {
          accessToken: string;
          refreshToken: string;
        };

        setState((prev) => {
          if (!prev.user) return prev;
          const newState = {
            user: prev.user,
            accessToken: refreshData.accessToken,
            refreshToken: refreshData.refreshToken,
          };
          persistAuth(newState);
          return { ...newState, isLoading: false };
        });

        return refreshData.accessToken;
      } catch {
        clearAuth();
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isLoading: false,
        });
        return null;
      }
    },
    [],
  );

  /** Schedule the next automatic refresh based on the token's exp. */
  const scheduleRefresh = useCallback(
    (accessToken: string, currentRefreshToken: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      const payload = decodeJwtPayload(accessToken);
      if (!payload?.exp) return;

      // Refresh 60 s before expiry, but at least 5 s from now
      const msUntilRefresh = Math.max(
        (payload.exp - Math.floor(Date.now() / 1000) - 60) * 1000,
        5_000,
      );

      refreshTimerRef.current = setTimeout(() => {
        refreshAccessToken(currentRefreshToken);
      }, msUntilRefresh);
    },
    [refreshAccessToken],
  );

  // ---- getAccessToken (with eager refresh) ---------------------------------

  const getAccessToken = useCallback((): string | null => {
    const { accessToken, refreshToken: rt } = state;
    if (!accessToken || !rt) return accessToken;

    // If the token is about to expire, kick off a background refresh
    if (isTokenExpiringSoon(accessToken)) {
      if (!refreshingRef.current) {
        refreshingRef.current = refreshAccessToken(rt).finally(() => {
          refreshingRef.current = null;
        });
      }
    }

    return accessToken;
  }, [state, refreshAccessToken]);

  // Load persisted auth on mount
  useEffect(() => {
    const saved = loadAuth();
    if (saved) {
      // If the access token is already expired, refresh before exposing it
      if (isTokenExpiringSoon(saved.accessToken, 0)) {
        // Keep isLoading true and set user so the UI can show a loading state
        setState({
          user: saved.user,
          accessToken: null,
          refreshToken: saved.refreshToken,
          isLoading: true,
        });
        refreshAccessToken(saved.refreshToken).then((newToken) => {
          if (!newToken) {
            // Refresh failed — clear everything
            setState({
              user: null,
              accessToken: null,
              refreshToken: null,
              isLoading: false,
            });
          }
          // On success, refreshAccessToken already updated state
        });
      } else {
        setState({
          user: saved.user,
          accessToken: saved.accessToken,
          refreshToken: saved.refreshToken,
          isLoading: false,
        });
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [refreshAccessToken]);

  // Schedule proactive refresh whenever tokens change
  useEffect(() => {
    if (state.accessToken && state.refreshToken) {
      scheduleRefresh(state.accessToken, state.refreshToken);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [state.accessToken, state.refreshToken, scheduleRefresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const client = createApiClient(API_BASE);
      const { data, error } = await client.auth.login.post({ email, password });

      if (error || !data) {
        return {
          success: false,
          error: (error as { message?: string })?.message || 'Login failed',
        };
      }

      const authData = data as {
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      };
      const newState = {
        user: authData.user,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      };

      persistAuth(newState);
      setState({ ...newState, isLoading: false });
      return { success: true };
    } catch (_err) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const client = createApiClient(API_BASE);
      const { data, error } = await client.auth.register.post({
        email,
        password,
        ...(name ? { name } : {}),
      });

      if (error || !data) {
        return {
          success: false,
          error: (error as { message?: string })?.message || 'Registration failed',
        };
      }

      const authData = data as {
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      };
      const newState = {
        user: authData.user,
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
      };

      persistAuth(newState);
      setState({ ...newState, isLoading: false });
      return { success: true };
    } catch (_err) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (state.refreshToken) {
        const client = createApiClient(API_BASE);
        await client.auth.logout.post({ refreshToken: state.refreshToken });
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth();
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
      });
    }
  }, [state.refreshToken]);

  const value = useMemo(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      getAccessToken,
    }),
    [state, signIn, signUp, signOut, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/**
 * Shorthand session hook compatible with the existing useChatData API
 */
export function useSession() {
  const auth = useAuth();
  return {
    data: auth.user ? { user: auth.user } : null,
    isPending: auth.isLoading,
  };
}
