import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/rest';

export const createApiClient = (baseUrl: string) => {
  return treaty<App>(baseUrl);
};

// Default client for backwards compatibility
export const api = createApiClient('localhost:3001');
