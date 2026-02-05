import { verifyJWT, type JWTPayload } from './jwt';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
  error?: string;
}

/**
 * Extract and verify the access token from WebSocket connection.
 * Token is passed via query parameter: ?token=<access_token>
 *
 * @param token - The access token from query parameter
 * @returns AuthResult with user info if authenticated
 */
export async function authenticateWebSocket(token: string | undefined): Promise<AuthResult> {
  if (!token) {
    return {
      user: null,
      isAuthenticated: false,
      error: 'No authentication token provided',
    };
  }

  // Verify the JWT - only accept access tokens for WebSocket connections
  const payload = await verifyJWT(token, 'access');

  if (!payload) {
    return {
      user: null,
      isAuthenticated: false,
      error: 'Invalid or expired access token',
    };
  }

  return {
    user: {
      id: payload.userId,
      email: payload.email,
    },
    isAuthenticated: true,
  };
}

/**
 * Type guard to check if auth result is authenticated
 */
export function isAuthenticated(
  auth: AuthResult,
): auth is AuthResult & { user: AuthUser; isAuthenticated: true } {
  return auth.isAuthenticated && auth.user !== null;
}
