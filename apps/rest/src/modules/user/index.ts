import { Elysia } from 'elysia';
import { requireAuth } from '../auth/guard';
import { UserModel } from './model';
import { UserService } from './service';

export const userRouter = new Elysia({ prefix: '/users' })
  .use(requireAuth)

  // Search users (for group creation / member selection)
  .get(
    '/search',
    async ({ query, user }) => {
      return UserService.searchUsers({
        query: query.q,
        limit: query.limit,
        offset: query.offset,
        excludeUserId: user.id,
      });
    },
    {
      query: UserModel.SearchQuery,
    },
  )

  // Get current user's profile
  .get('/me', async ({ user }) => {
    return UserService.getProfile(user.id);
  })

  // Get user by ID
  .get(
    '/:id',
    async ({ params, set }) => {
      const foundUser = await UserService.getUserById(params.id);
      if (!foundUser) {
        set.status = 404;
        return { error: 'Not Found', message: 'User not found' };
      }
      return foundUser;
    },
    {
      params: UserModel.UserIdParams,
    },
  );
