import { Elysia, t } from 'elysia';
import { requireAuth } from '../auth/guard';
import { KeyPackageModel } from './model';
import { KeyPackageService } from './service';

export const keyPackageRouter = new Elysia({ prefix: '/key-packages' })
  .use(requireAuth)

  // Upload key packages for the current user
  .post(
    '/upload',
    async ({ body, user }) => {
      return KeyPackageService.uploadKeyPackages({
        userId: user.id,
        keyPackages: body.keyPackages,
      });
    },
    {
      body: KeyPackageModel.UploadBody,
    },
  )

  // Get count of available key packages for the current user
  .get('/count', async ({ user }) => {
    const count = await KeyPackageService.getKeyPackageCount({ userId: user.id });
    return { count };
  })

  // Claim a key package for a specific user (used when adding to group)
  .post(
    '/claim/:userId',
    async ({ params, set }) => {
      const keyPackage = await KeyPackageService.claimKeyPackage({
        targetUserId: params.userId,
      });

      if (!keyPackage) {
        set.status = 404;
        return { error: 'Not Found', message: 'No available key packages for this user' };
      }

      return keyPackage;
    },
    {
      params: KeyPackageModel.ClaimParams,
    },
  )

  // Claim key packages for multiple users (batch, for group creation)
  .post(
    '/claim-batch',
    async ({ body }) => {
      return KeyPackageService.claimKeyPackagesForUsers({
        userIds: body.userIds,
      });
    },
    {
      body: t.Object({
        userIds: t.Array(t.String(), { minItems: 1 }),
      }),
    },
  );
