import { Elysia } from 'elysia';
import { requireAuth } from '../auth/guard';
import { InboxModel } from './model';
import { InboxService } from './service';

export const inboxRouter = new Elysia({ prefix: '/inbox' })
  .use(requireAuth)

  /**
   * GET /inbox/sync
   * Fetch undelivered inbox items for the authenticated user.
   * This is used when a client comes online to sync messages received while offline.
   */
  .get(
    '/sync',
    async ({ query, user }) => {
      console.log('[Inbox] Sync request from user:', user.id, 'query:', query);
      try {
        const afterSeqId = query.afterSeqId ? BigInt(query.afterSeqId) : undefined;
        const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;

        const items = await InboxService.getUndeliveredItems({
          userId: user.id,
          afterSeqId,
          limit: Math.min(limit, 500), // Cap at 500 items per request
        });

        console.log('[Inbox] Sync returning', items.length, 'items');
        return {
          items,
          count: items.length,
          hasMore: items.length === Math.min(limit, 500),
        };
      } catch (error) {
        console.error('[Inbox] Sync error:', error);
        throw error;
      }
    },
    {
      query: InboxModel.SyncQuery,
    },
  )

  /**
   * POST /inbox/delivered
   * Mark inbox items as delivered (the client has received and processed them).
   */
  .post(
    '/delivered',
    async ({ body, user }) => {
      return InboxService.markAsDelivered({
        userId: user.id,
        itemIds: body.itemIds,
      });
    },
    {
      body: InboxModel.MarkDeliveredBody,
    },
  )

  /**
   * GET /inbox/latest
   * Get the latest seq_id for the user (useful for knowing sync status).
   */
  .get('/latest', async ({ user }) => {
    return InboxService.getLatestSeqId({
      userId: user.id,
    });
  });
