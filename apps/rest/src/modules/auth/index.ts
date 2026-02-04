import { Elysia } from 'elysia';
import {
  RegisterBody,
  LoginBody,
  RefreshBody,
  LogoutBody,
  AuthResponse,
  RefreshResponse,
  MessageResponse,
  ErrorResponse,
} from './model';
import { AuthService } from './service';

export const authRouter = new Elysia({ prefix: '/auth' })
  .post(
    '/register',
    async ({ body, set }) => {
      const { email, password, name } = body;

      // Check if user already exists
      const existingUser = await AuthService.findUserByEmail(email);

      if (existingUser) {
        set.status = 409;
        return {
          error: 'Conflict',
          message: 'User with this email already exists',
        };
      }

      // Create user
      const user = await AuthService.createUser({ email, password, name });

      // Generate access and refresh tokens
      const { accessToken, refreshToken } =
        await AuthService.generateTokenPair(user);

      set.status = 201;
      return {
        accessToken,
        refreshToken,
        user,
      };
    },
    {
      body: RegisterBody,
      response: {
        201: AuthResponse,
        409: ErrorResponse,
      },
    },
  )
  .post(
    '/login',
    async ({ body, set }) => {
      const { email, password } = body;

      // Find user by email
      const user = await AuthService.findUserByEmail(email);

      if (!user) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Invalid email or password',
        };
      }

      // Verify password
      const isValidPassword = await AuthService.verifyPassword(
        user.password_hash,
        password,
      );

      if (!isValidPassword) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Invalid email or password',
        };
      }

      // Generate access and refresh tokens
      const { accessToken, refreshToken } =
        await AuthService.generateTokenPair(user);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    },
    {
      body: LoginBody,
      response: {
        200: AuthResponse,
        401: ErrorResponse,
      },
    },
  )
  .post(
    '/refresh',
    async ({ body, set }) => {
      const { refreshToken } = body;

      // Verify the refresh token JWT
      const payload = await AuthService.validateRefreshToken(refreshToken);

      if (!payload) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Invalid or expired refresh token',
        };
      }

      // Check if refresh token exists in database and is not revoked
      const storedToken =
        await AuthService.getStoredRefreshToken(refreshToken);

      if (!storedToken || storedToken.revokedAt) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Refresh token has been revoked',
        };
      }

      // Check if token has expired
      if (storedToken.expiresAt < new Date()) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Refresh token has expired',
        };
      }

      // Revoke the old refresh token (rotate tokens)
      await AuthService.revokeRefreshToken(storedToken.id);

      // Generate new token pair
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await AuthService.generateTokenPair(storedToken.user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    },
    {
      body: RefreshBody,
      response: {
        200: RefreshResponse,
        401: ErrorResponse,
      },
    },
  )
  .post(
    '/logout',
    async ({ body, set }) => {
      const { refreshToken } = body;

      // Verify the refresh token JWT
      const payload = await AuthService.validateRefreshToken(refreshToken);

      if (!payload) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Invalid refresh token',
        };
      }

      // Revoke the refresh token
      const storedToken =
        await AuthService.getStoredRefreshToken(refreshToken);

      if (storedToken && !storedToken.revokedAt) {
        await AuthService.revokeRefreshToken(storedToken.id);
      }

      return {
        message: 'Successfully logged out',
      };
    },
    {
      body: LogoutBody,
      response: {
        200: MessageResponse,
        401: ErrorResponse,
      },
    },
  )
  .post(
    '/logout-all',
    async ({ body, set }) => {
      const { refreshToken } = body;

      // Verify the refresh token JWT
      const payload = await AuthService.validateRefreshToken(refreshToken);

      if (!payload) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Invalid refresh token',
        };
      }

      // Revoke all refresh tokens for this user
      await AuthService.revokeAllUserRefreshTokens(payload.userId);

      return {
        message: 'Successfully logged out from all devices',
      };
    },
    {
      body: LogoutBody,
      response: {
        200: MessageResponse,
        401: ErrorResponse,
      },
    },
  );
