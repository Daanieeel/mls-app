'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi, useAuth } from '@/lib/auth';
import { dexieDb } from '@/lib/db';
import { decryptIncomingMessagePayload, processWelcomeMessage } from './mls';
import type { Message } from './types';

interface SyncedInboxItem {
  id: string;
  seq_id: number;
  type: string;
  nonce: string;
  payload: string;
  messageId: string | null;
  groupId: string | null;
  senderId: string | null;
  senderName: string | null;
  createdAt: string | Date;
}

interface UseSyncOptions {
  /** Called when messages are synced (for adding to local state) */
  onMessage?: (message: Message) => void;
  /** Called when a WELCOME is synced (for processing MLS welcome) */
  onWelcome?: (groupId: string, payload: string) => void;
  /** Called when a COMMIT is synced */
  onCommit?: (groupId: string, payload: string) => void;
  /** Called when a TOMBSTONE is synced */
  onTombstone?: (groupId: string, payload: string, messageId?: string) => void;
  /** Called when an EDIT is synced */
  onEdit?: (groupId: string, payload: string, messageId?: string) => void;
  /** Whether sync is enabled (default: true) */
  enabled?: boolean;
}

interface UseSyncReturn {
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Whether initial sync has completed */
  hasSynced: boolean;
  /** Error from last sync attempt */
  syncError: string | null;
  /** Manually trigger a sync */
  sync: () => Promise<void>;
}

const SYNC_STORAGE_KEY = 'mls_last_sync_seq_id';

function getLastSyncedSeqId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(SYNC_STORAGE_KEY);
    return value ? Number.parseInt(value, 10) : null;
  } catch {
    return null;
  }
}

function setLastSyncedSeqId(seqId: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, String(seqId));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook to sync undelivered inbox items from the server when the user comes online.
 * Runs in the background on page load without blocking the UI.
 */
export function useSync(options: UseSyncOptions = {}): UseSyncReturn {
  const { onMessage, onWelcome, onCommit, onTombstone, onEdit, enabled = true } = options;

  const { user, accessToken } = useAuth();
  const api = useApi();

  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Use refs to avoid recreating the sync function on every render
  const onMessageRef = useRef(onMessage);
  const onWelcomeRef = useRef(onWelcome);
  const onCommitRef = useRef(onCommit);
  const onTombstoneRef = useRef(onTombstone);
  const onEditRef = useRef(onEdit);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onWelcomeRef.current = onWelcome;
    onCommitRef.current = onCommit;
    onTombstoneRef.current = onTombstone;
    onEditRef.current = onEdit;
  }, [onMessage, onWelcome, onCommit, onTombstone, onEdit]);

  const processInboxItem = useCallback(
    async (item: SyncedInboxItem) => {
      if (!user?.id) return;

      console.log('[useSync] Processing inbox item:', {
        type: item.type,
        groupId: item.groupId,
        messageId: item.messageId,
        seqId: item.seq_id,
      });

      switch (item.type) {
        case 'WELCOME': {
          if (item.groupId) {
            // Process the MLS welcome message
            await processWelcomeMessage({
              groupId: item.groupId,
              payloadBase64: item.payload,
              userId: user.id,
            });
            onWelcomeRef.current?.(item.groupId, item.payload);
          }
          break;
        }

        case 'COMMIT': {
          if (item.groupId) {
            onCommitRef.current?.(item.groupId, item.payload);
          }
          break;
        }

        case 'MSG': {
          if (!item.groupId || !item.messageId) break;

          // Skip if this is the current user's own message
          if (item.senderId === user.id) break;

          // Skip if this message is already stored locally (avoids re-decryption
          // with an advanced MLS ratchet state that would produce garbage)
          const existingMsg = await dexieDb.localMessages.get(item.messageId);
          if (existingMsg) {
            console.log('[useSync] Skipping already-stored message:', item.messageId);
            break;
          }

          // Decrypt the message payload
          let content: string;
          try {
            const decrypted = await decryptIncomingMessagePayload(item.groupId, item.payload);
            if (decrypted !== null) {
              content = decrypted;
            } else {
              // Fallback: decode single base64 layer
              try {
                content = decodeURIComponent(escape(atob(item.payload)));
              } catch {
                content = atob(item.payload);
              }
            }
          } catch (err) {
            console.warn('[useSync] Failed to decrypt message:', err);
            try {
              content = decodeURIComponent(escape(atob(item.payload)));
            } catch {
              content = item.payload;
            }
          }

          const message: Message = {
            id: item.messageId,
            chatId: item.groupId,
            senderId: item.senderId ?? 'unknown',
            senderName: item.senderName ?? undefined,
            content,
            timestamp: new Date(item.createdAt),
            status: 'delivered',
            isOwn: false,
          };

          onMessageRef.current?.(message);
          break;
        }

        case 'TOMBSTONE': {
          if (item.groupId) {
            onTombstoneRef.current?.(item.groupId, item.payload, item.messageId ?? undefined);
          }
          break;
        }

        case 'EDIT': {
          if (item.groupId) {
            onEditRef.current?.(item.groupId, item.payload, item.messageId ?? undefined);
          }
          break;
        }

        default:
          console.warn('[useSync] Unknown inbox item type:', item.type);
      }
    },
    [user?.id],
  );

  const sync = useCallback(async () => {
    if (!user?.id || !accessToken) {
      console.log('[useSync] Skipping sync: no user or token');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      console.log('[useSync] Starting sync...');

      // Fetch undelivered inbox items
      const response = await api.inbox.sync.get({ query: {} });

      if (response.error) {
        throw new Error('Failed to fetch inbox items');
      }

      const data = response.data as unknown as {
        items: SyncedInboxItem[];
        count: number;
        hasMore: boolean;
      };
      const { items, count, hasMore } = data;

      console.log(`[useSync] Fetched ${count} inbox items (hasMore: ${hasMore})`);

      if (items.length === 0) {
        console.log('[useSync] No items to sync');
        setHasSynced(true);
        return;
      }

      // Process each item
      const processedIds: string[] = [];
      let maxSeqId = getLastSyncedSeqId() ?? 0;

      for (const item of items) {
        await processInboxItem(item);
        processedIds.push(item.id);
        maxSeqId = Math.max(maxSeqId, item.seq_id);
      }

      // Mark items as delivered
      if (processedIds.length > 0) {
        await api.inbox.delivered.post({
          itemIds: processedIds,
        });
        console.log(`[useSync] Marked ${processedIds.length} items as delivered`);
      }

      // Update the last synced seq_id
      setLastSyncedSeqId(maxSeqId);

      // If there are more items, sync again
      if (hasMore) {
        console.log('[useSync] More items available, syncing again...');
        // Use setTimeout to avoid blocking the main thread
        setTimeout(() => sync(), 100);
        return;
      }

      console.log('[useSync] Sync complete');
      setHasSynced(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during sync';
      console.error('[useSync] Sync failed:', errorMessage);
      setSyncError(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, accessToken, api, processInboxItem]);

  // Run sync on mount and when user/token changes
  useEffect(() => {
    if (!enabled || !user?.id || !accessToken) return;

    // Run sync in the background (non-blocking)
    const timeoutId = setTimeout(() => {
      sync();
    }, 500); // Small delay to let the UI render first

    return () => clearTimeout(timeoutId);
  }, [enabled, user?.id, accessToken, sync]);

  return {
    isSyncing,
    hasSynced,
    syncError,
    sync,
  };
}
