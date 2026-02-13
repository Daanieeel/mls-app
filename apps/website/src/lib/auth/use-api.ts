'use client';

import { type ApiClient, createAuthenticatedClient } from '@repo/api';
import { useMemo } from 'react';
import { useAuth } from './auth-context';

const API_BASE = 'localhost:3001';

/**
 * Hook that returns a type-safe, authenticated Eden API client.
 * Automatically injects the current user's access token.
 */
export function useApi(): ApiClient {
  const { getAccessToken } = useAuth();

  return useMemo(() => createAuthenticatedClient(API_BASE, getAccessToken), [getAccessToken]);
}
