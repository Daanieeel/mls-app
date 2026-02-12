'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useApi, useAuth } from '@/lib/auth';
import {
  dexieDb,
  type LocalMessage,
  markGroupAsRead,
  useGroupMessages,
  useGroupsWithMetadata,
} from '@/lib/db';
import type { GroupWithMetadata } from '@/lib/types';
import { encryptOutgoingMessagePayload } from './mls';
import type { Message } from './types';

interface UpdateMessagePayload {
  messageId: string;
  content: string;
}

interface DeleteMessagePayload {
  messageId: string;
}

interface UseChatDataOptions {
  selectedChatId: string | null;
}

interface UseChatDataReturn {
  groups: GroupWithMetadata[];
  messages: Message[];
  isLoadingGroups: boolean;
  isLoadingMessages: boolean;
  isLoadingSession: boolean;
  isAuthenticated: boolean;
  sendMessage: (content: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (payload: UpdateMessagePayload) => void;
  deleteMessage: (payload: DeleteMessagePayload) => void;
  editMessageOnServer: (messageId: string, groupId: string, newContent: string) => Promise<void>;
  deleteMessageOnServer: (messageId: string) => Promise<void>;
  markAsRead: (groupId: string) => Promise<void>;
  refreshGroups: () => Promise<void>;
}

export function useChatData({ selectedChatId }: UseChatDataOptions): UseChatDataReturn {
  const { user, accessToken, isLoading: isLoadingSession } = useAuth();
  const api = useApi();

  const { groups: groupsWithMetadata, isLoading: isLoadingChats } = useGroupsWithMetadata();

  const { messages: localMessages, isLoading: isLoadingMessages } =
    useGroupMessages(selectedChatId);

  const messages: Message[] = useMemo(
    () =>
      localMessages.map((msg) => ({
        id: msg.id,
        chatId: msg.groupId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        timestamp: msg.createdAt,
        status: 'sent' as const,
        isOwn: msg.isOwn,
        isSystem: msg.isSystem,
        isEdited: msg.isEdited,
      })),
    [localMessages],
  );

  // Sync groups from the server into IndexedDB
  const refreshGroups = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.groups.index.get();
      if (data && Array.isArray(data)) {
        const groups = data as unknown as Array<{
          id: string;
          name: string;
          createdById: string;
          createdAt: string | Date;
          updatedAt: string | Date;
        }>;
        // Sync groups into IndexedDB
        await dexieDb.transaction('rw', dexieDb.groups, async () => {
          await dexieDb.groups.clear();
          await dexieDb.groups.bulkPut(
            groups.map((g) => ({
              id: g.id,
              name: g.name,
              createdById: g.createdById,
              createdAt:
                typeof g.createdAt === 'string' ? g.createdAt : new Date(g.createdAt).toISOString(),
              updatedAt:
                typeof g.updatedAt === 'string' ? g.updatedAt : new Date(g.updatedAt).toISOString(),
            })),
          );
        });
      }
    } catch (err) {
      console.error('Failed to sync groups:', err);
    }
  }, [user, api]);

  // Sync groups on mount and when user/token changes
  useEffect(() => {
    if (user && accessToken) {
      refreshGroups();
    }
  }, [user, accessToken, refreshGroups]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!selectedChatId) return;

      if (isLoadingSession || !user?.id) {
        console.warn('Cannot send message: session is loading or missing');
        return;
      }

      const tempId = `msg-${Date.now()}`;
      const newMessage: LocalMessage = {
        id: tempId,
        groupId: selectedChatId,
        senderId: user.id,
        content,
        createdAt: new Date(),
        isOwn: true,
      };

      // Optimistically add to local DB
      await dexieDb.localMessages.put(newMessage).catch(console.error);

      try {
        const encryptedPayload = await encryptOutgoingMessagePayload(selectedChatId, content);

        console.log('[useChatData] Sending message to REST API:', {
          groupId: selectedChatId,
          payloadLength: encryptedPayload.length,
          payloadPreview: encryptedPayload.substring(0, 80),
          originalContent: content.substring(0, 80),
        });

        // Send message through REST API so Kafka/Redis can distribute it
        const { data, error } = await api.messages.index.post({
          groupId: selectedChatId,
          payload: encryptedPayload,
          type: 'MSG',
          nonce: crypto.randomUUID(),
        });

        if (error) {
          console.error('Failed to send message:', error);
          return;
        }

        // Update the optimistic message with the server-assigned id.
        // The response is a CloudEvent — `data.id` is the CloudEvent UUID,
        // while `data.data.id` is the actual Prisma message ID used by the DB.
        const messageData =
          data && typeof data === 'object' && 'data' in data
            ? (data as { data?: { id?: string } }).data
            : null;
        const serverId =
          messageData?.id ??
          (data && typeof data === 'object' && 'id' in data
            ? String((data as { id: unknown }).id)
            : null);

        if (serverId) {
          await dexieDb.localMessages.delete(tempId);
          await dexieDb.localMessages.put({
            ...newMessage,
            id: serverId,
          });
        }
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    },
    [selectedChatId, user?.id, isLoadingSession, api],
  );

  const addMessage = useCallback((message: Message) => {
    const localMessage: LocalMessage = {
      id: message.id,
      groupId: message.chatId,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      createdAt: message.timestamp,
      isOwn: message.isOwn,
      isSystem: message.isSystem,
      isEdited: message.isEdited,
    };
    dexieDb.localMessages.put(localMessage).catch(console.error);
  }, []);

  const updateMessage = useCallback((payload: UpdateMessagePayload) => {
    dexieDb.localMessages
      .update(payload.messageId, { content: payload.content, isEdited: true })
      .catch(console.error);
  }, []);

  const deleteMessage = useCallback((payload: DeleteMessagePayload) => {
    dexieDb.localMessages.delete(payload.messageId).catch(console.error);
  }, []);

  const editMessageOnServer = useCallback(
    async (messageId: string, groupId: string, newContent: string) => {
      // Optimistically update local DB
      await dexieDb.localMessages
        .update(messageId, { content: newContent, isEdited: true })
        .catch(console.error);

      try {
        const encryptedPayload = await encryptOutgoingMessagePayload(groupId, newContent);

        const { error } = await api.messages({ id: messageId }).patch({
          payload: encryptedPayload,
          type: 'EDIT',
          nonce: crypto.randomUUID(),
          groupId,
        });

        if (error) {
          console.error('[useChatData] Failed to edit message on server:', error);
        }
      } catch (err) {
        console.error('[useChatData] Failed to edit message:', err);
      }
    },
    [api],
  );

  const deleteMessageOnServer = useCallback(
    async (messageId: string) => {
      // Optimistically remove from local DB
      await dexieDb.localMessages.delete(messageId).catch(console.error);

      try {
        const { error } = await api.messages({ id: messageId }).delete();

        if (error) {
          console.error('[useChatData] Failed to delete message on server:', error);
        }
      } catch (err) {
        console.error('[useChatData] Failed to delete message:', err);
      }
    },
    [api],
  );

  const markAsRead = useCallback(async (groupId: string) => {
    await markGroupAsRead(groupId);
  }, []);

  return {
    groups: groupsWithMetadata,
    messages,
    isLoadingGroups: isLoadingChats,
    isLoadingSession,
    isAuthenticated: !!user,
    isLoadingMessages,
    sendMessage,
    addMessage,
    updateMessage,
    deleteMessage,
    editMessageOnServer,
    deleteMessageOnServer,
    markAsRead,
    refreshGroups,
  };
}
