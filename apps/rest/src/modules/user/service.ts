import { prisma } from '@repo/database';

export abstract class UserService {
  /**
   * Search users by name or email (excludes the requesting user)
   */
  static async searchUsers({
    query,
    limit = 20,
    offset = 0,
    excludeUserId,
  }: {
    query?: string;
    limit?: number;
    offset?: number;
    excludeUserId: string;
  }) {
    const where = {
      id: { not: excludeUserId },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' as const } },
              { email: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    return prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
      },
      take: limit,
      skip: offset,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a user by ID
   */
  static async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  /**
   * Get the current authenticated user's profile
   */
  static async getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }
}
