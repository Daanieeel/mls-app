import { prisma } from '@repo/database';

export abstract class InboxService {
  /**
   * Fetch undelivered inbox items for a user.
   * These are messages that were stored while the user was offline.
   */
  static async getUndeliveredItems({
    userId,
    afterSeqId,
    limit = 100,
  }: {
    userId: string;
    afterSeqId?: bigint;
    limit?: number;
  }) {
    const items = await prisma.userInboxItem.findMany({
      where: {
        receiverId: userId,
        deliveredAt: null, // Only undelivered items
        ...(afterSeqId !== undefined && {
          seq_id: {
            gt: afterSeqId,
          },
        }),
      },
      include: {
        message: {
          select: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        seq_id: 'asc',
      },
      take: limit,
    });

    // Transform items to return payload as string
    return items.map((item) => ({
      id: item.id,
      seq_id: Number(item.seq_id),
      type: item.type,
      nonce: item.nonce,
      payload: Buffer.from(item.payload).toString('utf-8'),
      messageId: item.messageId,
      groupId: item.groupId,
      senderId: item.senderId,
      senderName: item.message?.sender?.name ?? item.message?.sender?.email ?? null,
      createdAt: item.createdAt,
    }));
  }

  /**
   * Mark inbox items as delivered (client has received them).
   */
  static async markAsDelivered({
    userId,
    itemIds,
  }: {
    userId: string;
    itemIds: string[];
  }) {
    const result = await prisma.userInboxItem.updateMany({
      where: {
        id: {
          in: itemIds,
        },
        receiverId: userId, // Ensure the user owns these items
      },
      data: {
        deliveredAt: new Date(),
      },
    });

    return {
      updated: result.count,
    };
  }

  /**
   * Get the latest seq_id for a user (useful for knowing where to sync from).
   */
  static async getLatestSeqId({ userId }: { userId: string }) {
    const latest = await prisma.userInboxItem.findFirst({
      where: {
        receiverId: userId,
      },
      orderBy: {
        seq_id: 'desc',
      },
      select: {
        seq_id: true,
      },
    });

    return {
      latestSeqId: latest ? Number(latest.seq_id) : null,
    };
  }
}
