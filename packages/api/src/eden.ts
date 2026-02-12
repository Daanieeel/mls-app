import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/rest';

export type ApiClient = ReturnType<typeof treaty<App>>;

export const createApiClient = (baseUrl: string, token?: string) => {
  return treaty<App>(baseUrl, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });
};

/**
 * Create a client with a dynamic token getter (for React hooks / auth state)
 */
export const createAuthenticatedClient = (baseUrl: string, getToken: () => string | null) => {
  return treaty<App>(baseUrl, {
    headers() {
      const token = getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
};

// Default client for backwards compatibility
export const api = createApiClient('localhost:3001');
