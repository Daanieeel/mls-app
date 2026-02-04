import { hash, verify } from '@node-rs/argon2';
import { prisma } from '@repo/database';
import { signJWT, verifyJWT, REFRESH_TOKEN_EXPIRY_MS } from './jwt';

/**
 * Argon2 hashing configuration
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Authentication service handling user management and token operations
 */
export abstract class AuthService {
  /**
   * Hash a password using Argon2
   */
  static async hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    return verify(hash, password);
  }

  /**
   * Generate both access and refresh tokens for a user.
   * Stores the refresh token in the database for revocation support.
   */
  static async generateTokenPair(user: { id: string; email: string }) {
    // Generate access token (short-lived, 15 minutes)
    const accessToken = await signJWT({
      userId: user.id,
      email: user.email,
      type: 'access',
    });

    // Generate refresh token (long-lived, 7 days)
    const refreshToken = await signJWT({
      userId: user.id,
      email: user.email,
      type: 'refresh',
    });

    // Store refresh token in database for revocation support
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Find a user by email
   */
  static async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password_hash: true,
      },
    });
  }

  /**
   * Create a new user
   */
  static async createUser(data: {
    email: string;
    password: string;
    name?: string;
  }) {
    const passwordHash = await AuthService.hashPassword(data.password);

    return prisma.user.create({
      data: {
        email: data.email,
        password_hash: passwordHash,
        name: data.name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  /**
   * Get stored refresh token with user data
   */
  static async getStoredRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  /**
   * Revoke a refresh token by ID
   */
  static async revokeRefreshToken(tokenId: string) {
    return prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static async revokeAllUserRefreshTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Validate a refresh token
   */
  static async validateRefreshToken(refreshToken: string) {
    return verifyJWT(refreshToken, 'refresh');
  }
}
