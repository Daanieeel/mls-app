import { t } from 'elysia';

export namespace UserModel {
  export const SearchQuery = t.Object({
    q: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 50, default: 20 })),
    offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
  });

  export const UserIdParams = t.Object({
    id: t.String(),
  });

  export const UserResponse = t.Object({
    id: t.String(),
    email: t.String(),
    name: t.Nullable(t.String()),
  });

  export const UsersResponse = t.Array(UserResponse);
}
