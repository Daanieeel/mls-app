import { prisma } from '@repo/database';

export abstract class KeyPackageService {
  /**
   * Upload key packages for the current user
   */
  static async uploadKeyPackages({
    userId,
    keyPackages,
  }: {
    userId: string;
    keyPackages: { payload: string }[];
  }) {
    const data = keyPackages.map((kp) => ({
      userId,
      payload: Buffer.from(kp.payload, 'base64'),
    }));

    const result = await prisma.keyPackage.createMany({ data });
    return { uploaded: result.count };
  }

  /**
   * Claim (consume) one key package for a given user.
   * Marks it as used and returns it. Used when adding someone to a group.
   */
  static async claimKeyPackage({ targetUserId }: { targetUserId: string }) {
    // Find the oldest unused key package for this user
    const keyPackage = await prisma.keyPackage.findFirst({
      where: {
        userId: targetUserId,
        usedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!keyPackage) {
      return null;
    }

    // Mark it as used
    await prisma.keyPackage.update({
      where: { id: keyPackage.id },
      data: { usedAt: new Date() },
    });

    return {
      id: keyPackage.id,
      payload: Buffer.from(keyPackage.payload).toString('base64'),
      userId: keyPackage.userId,
    };
  }

  /**
   * Get count of available (unused) key packages for a user
   */
  static async getKeyPackageCount({ userId }: { userId: string }) {
    return prisma.keyPackage.count({
      where: {
        userId,
        usedAt: null,
      },
    });
  }

  /**
   * Claim key packages for multiple users at once (for group creation)
   */
  static async claimKeyPackagesForUsers({ userIds }: { userIds: string[] }) {
    const results: { userId: string; keyPackage: { id: string; payload: string } | null }[] = [];

    for (const userId of userIds) {
      const kp = await KeyPackageService.claimKeyPackage({ targetUserId: userId });
      results.push({
        userId,
        keyPackage: kp ? { id: kp.id, payload: kp.payload } : null,
      });
    }

    return results;
  }
}
