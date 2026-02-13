import { t } from 'elysia';

export namespace InboxModel {
  export const SyncQuery = t.Object({
    /** Optional: Only return items with seq_id greater than this value */
    afterSeqId: t.Optional(t.String()),
    /** Optional: Limit the number of returned items (default: 100) */
    limit: t.Optional(t.String()),
  });

  export const MarkDeliveredBody = t.Object({
    /** Array of inbox item IDs to mark as delivered */
    itemIds: t.Array(t.String()),
  });
}
