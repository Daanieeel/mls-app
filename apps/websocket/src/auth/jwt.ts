import { env } from '@repo/env';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type TokenType = 'access' | 'refresh';

export interface JWTPayload {
  userId: string;
  email: string;
  type: TokenType;
  iat: number;
  exp: number;
}

async function getKey(): Promise<CryptoKey> {
  const secret = env.BETTER_AUTH_SECRET || 'development-secret-change-me';
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Verify a JWT token and return the payload if valid
 */
export async function verifyJWT(
  token: string,
  expectedType?: TokenType,
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    const key = await getKey();
    const signature = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature.buffer as ArrayBuffer,
      encoder.encode(`${headerB64}.${payloadB64}`),
    );

    if (!isValid) return null;

    const payload: JWTPayload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64)));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    // Check token type if specified
    if (expectedType && payload.type !== expectedType) return null;

    return payload;
  } catch {
    return null;
  }
}
