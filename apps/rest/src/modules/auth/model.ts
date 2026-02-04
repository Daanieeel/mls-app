import { t } from 'elysia';

export const RegisterBody = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
  name: t.Optional(t.String()),
});

export const LoginBody = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String(),
});

export const RefreshBody = t.Object({
  refreshToken: t.String(),
});

export const LogoutBody = t.Object({
  refreshToken: t.String(),
});

export const AuthResponse = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  user: t.Object({
    id: t.String(),
    email: t.String(),
    name: t.Nullable(t.String()),
  }),
});

export const RefreshResponse = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
});

export const MessageResponse = t.Object({
  message: t.String(),
});

export const ErrorResponse = t.Object({
  error: t.String(),
  message: t.String(),
});
