import { Elysia } from 'elysia';
import { prisma } from '@repo/database';
import { verifyJWT } from './jwt';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Auth guard plugin for Elysia.
 * Extracts the bearer token (access token) from the Authorization header,
 * verifies the JWT, and makes the user available in the context.
 */
export const authGuard = new Elysia({ name: 'auth-guard', seed: 'auth-guard' })
  .derive({ as: 'global' }, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        user: null as AuthUser | null,
        isAuthenticated: false as const,
      };
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    // Only accept access tokens for API authentication
    const payload = await verifyJWT(token, 'access');

    if (!payload) {
      return {
        user: null as AuthUser | null,
        isAuthenticated: false as const,
      };
    }

    // Fetch user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return {
        user: null as AuthUser | null,
        isAuthenticated: false as const,
      };
    }

    return {
      user: user as AuthUser,
      isAuthenticated: true as const,
    };
  });

/**
 * Protected route guard that requires authentication.
 * Use this as a plugin for routes that need authentication.
 * Only accepts access tokens (not refresh tokens).
 */
export const requireAuth = new Elysia({ name: 'require-auth', seed: 'require-auth' })
  .derive({ as: 'scoped' }, async ({ request, error }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(401, { error: 'Unauthorized', message: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    // Only accept access tokens for API authentication
    const payload = await verifyJWT(token, 'access');

    if (!payload) {
      return error(401, { error: 'Unauthorized', message: 'Invalid or expired access token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return error(401, { error: 'Unauthorized', message: 'User not found' });
    }

    return {
      user: user as AuthUser,
      isAuthenticated: true as const,
    };
  });
