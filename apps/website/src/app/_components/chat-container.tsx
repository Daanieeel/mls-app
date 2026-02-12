'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApi, useAuth } from '@/lib/auth';
import {
  decryptIncomingMessagePayload,
  ensureMlsKeyPackageBuffer,
  processWelcomeMessage,
} from '@/lib/chat/mls';
import type { Message } from '@/lib/chat/types';
import { useChatData } from '@/lib/chat/use-chat-data';
import { useSync } from '@/lib/chat/use-sync';
import { type SystemEventMeta, useWebSocket } from '@/lib/chat/use-websocket';
import { dexieDb } from '@/lib/db';
import { ChatHeader } from './chat-header';
import { ChatSidebar } from './chat-sidebar';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';

export function ChatContainer() {
  const api = useApi();
  const { getAccessToken, user } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    groups,
    messages,
    isLoadingGroups,
    isLoadingMessages,
    sendMessage,
    addMessage,
    updateMessage,
    deleteMessage,
    markAsRead,
    refreshGroups,
  } = useChatData({ selectedChatId });

  /** Build a human-readable system notification from event metadata. */
  const buildSystemNotification = useCallback(
    (meta: SystemEventMeta | undefined): string | null => {
      if (!meta?.cloudEventType) return null;

      const actor = meta.actorName ?? 'Someone';
      const target = meta.targetName ?? 'a user';
      const isSelf =
        (meta.targetId && meta.targetId === user?.id) ||
        (meta.actorName && meta.actorName === user?.name);

      switch (meta.cloudEventType) {
        case 'de.messenger.group.created':
          return `${actor} created this group`;
        case 'de.messenger.group.user.added':
          return isSelf && meta.targetId === user?.id
            ? `${actor} added you to this group`
            : `${actor} added ${target}`;
        case 'de.messenger.group.user.removed':
          return isSelf && meta.targetId === user?.id
            ? `${actor} removed you from this group`
            : `${actor} removed ${target}`;
        case 'de.messenger.group.left':
          return `${actor} left the group`;
        default:
          return null;
      }
    },
    [user?.id, user?.name],
  );

  /** Insert a system message into the local chat history. */
  const addSystemMessage = useCallback(
    (groupId: string, text: string) => {
      const systemMsg: Message = {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        chatId: groupId,
        senderId: 'system',
        content: text,
        timestamp: new Date(),
        status: 'delivered',
        isOwn: false,
        isSystem: true,
      };
      addMessage(systemMsg);
    },
    [addMessage],
  );

  useEffect(() => {
    if (!user?.id) return;
    ensureMlsKeyPackageBuffer(api, user.id);
  }, [api, user?.id]);

  // Handle incoming WebSocket messages (UserInboxItem from MLS protocol)
  const handleApplicationMessage = useCallback(
    async (
      messageId: string,
      groupId: string,
      senderId: string,
      payload: string,
      timestamp: Date,
      _seqId?: number,
    ) => {
      console.log('[ChatContainer] Received message:', {
        messageId,
        groupId,
        senderId,
        currentUserId: user?.id,
      });

      // Don't add the message if the sender is the current user (already added optimistically)
      if (user?.id && user.id === senderId) {
        console.log('[ChatContainer] Skipping own message received via WebSocket');
        return;
      }

      // Skip if this message is already stored locally (avoids re-decryption
      // with an advanced MLS ratchet state that would produce garbage)
      const existingMsg = await dexieDb.localMessages.get(messageId);
      if (existingMsg) {
        console.log('[ChatContainer] Skipping already-stored message:', messageId);
        return;
      }

      // Fetch sender's name from the database
      let senderName: string | undefined;
      try {
        // TODO: Replace with actual API call to fetch user details
        // For now, we'll use a placeholder
        const response = await fetch(`http://localhost:3001/users/${senderId}`, {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        });
        if (response.ok) {
          const userData = await response.json();
          senderName = userData.name || userData.email;
        }
      } catch (err) {
        console.warn('[ChatContainer] Failed to fetch sender name:', err);
      }

      console.log('[ChatContainer] Decrypting payload:', {
        payloadLength: payload.length,
        payloadPreview: payload.substring(0, 80),
        payloadIsBase64: /^[A-Za-z0-9+/]+={0,2}$/.test(payload),
      });

      let content: string;
      try {
        const decryptedContent = await decryptIncomingMessagePayload(groupId, payload);
        console.log('[ChatContainer] MLS decryptIncomingMessagePayload result:', {
          wasDecrypted: decryptedContent !== null,
          preview: decryptedContent?.substring(0, 80) ?? '(null — no MLS group state or not MLS)',
        });

        if (decryptedContent !== null) {
          content = decryptedContent;
        } else {
          // No MLS group state — decode single base64 layer.
          try {
            content = decodeURIComponent(escape(atob(payload)));
          } catch {
            content = atob(payload);
          }
          console.log('[ChatContainer] Fallback atob() result:', {
            contentPreview: content.substring(0, 80),
          });
        }
      } catch (err) {
        console.error('[ChatContainer] Failed to decode/decrypt payload:', err);
        // Last-resort fallback
        try {
          content = decodeURIComponent(escape(atob(payload)));
        } catch {
          content = payload;
        }
      }

      const message: Message = {
        id: messageId,
        chatId: groupId,
        senderId,
        senderName,
        content,
        timestamp,
        status: 'delivered',
        isOwn: false,
      };
      addMessage(message);
    },
    [addMessage, user?.id, getAccessToken],
  );

  const handleEdit = useCallback(
    async (groupId: string, payload: string, messageId?: string) => {
      if (!messageId) return;

      console.log('[ChatContainer] Handling EDIT:', {
        groupId,
        messageId,
        payloadLength: payload.length,
        payloadPreview: payload.substring(0, 80),
      });

      const decrypted = await decryptIncomingMessagePayload(groupId, payload);
      let content: string;
      if (decrypted !== null) {
        content = decrypted;
      } else {
        try {
          content = decodeURIComponent(escape(atob(payload)));
        } catch {
          content = payload;
        }
      }

      console.log('[ChatContainer] EDIT resolved content:', {
        contentPreview: content.substring(0, 80),
      });

      updateMessage({
        messageId,
        content,
      });
    },
    [updateMessage],
  );

  const handleTombstone = useCallback(
    (_groupId: string, _payloadd: string, messageId?: string) => {
      if (!messageId) return;
      deleteMessage({ messageId });
    },
    [deleteMessage],
  );

  const handleWelcome = useCallback(
    async (groupId: string, _payload: string, meta?: SystemEventMeta) => {
      console.log('[ChatContainer] Received WELCOME for group:', groupId, meta);

      try {
        if (user?.id) {
          await processWelcomeMessage({
            groupId,
            payloadBase64: _payload,
            userId: user.id,
          });
        }

        await refreshGroups();

        // Add a system notification to the chat history
        const text = buildSystemNotification(meta);
        if (text) {
          addSystemMessage(groupId, text);
        }

        console.log('[ChatContainer] Groups refreshed after WELCOME');
      } catch (err) {
        console.error('[ChatContainer] Failed to refresh groups after WELCOME:', err);
      }
    },
    [refreshGroups, user?.id, buildSystemNotification, addSystemMessage],
  );

  const handleCommit = useCallback(
    async (groupId: string, _payload: string, meta?: SystemEventMeta) => {
      console.log('[ChatContainer] Received COMMIT for group:', groupId, meta);

      // Refresh groups so the sidebar reflects membership changes
      await refreshGroups();

      // Add a system notification to the chat history
      const text = buildSystemNotification(meta);
      if (text) {
        addSystemMessage(groupId, text);
      }
    },
    [refreshGroups, buildSystemNotification, addSystemMessage],
  );

  // --- Sync handler for syncing when coming online ---
  const handleSyncMessage = useCallback(
    (message: Message) => {
      console.log('[ChatContainer] Synced message:', message.id);
      addMessage(message);
    },
    [addMessage],
  );

  const handleSyncWelcome = useCallback(
    async (groupId: string, _payload: string) => {
      console.log('[ChatContainer] Synced WELCOME for group:', groupId);
      await refreshGroups();
    },
    [refreshGroups],
  );

  const handleSyncCommit = useCallback(
    async (groupId: string, _payload: string) => {
      console.log('[ChatContainer] Synced COMMIT for group:', groupId);
      await refreshGroups();
    },
    [refreshGroups],
  );

  const handleSyncTombstone = useCallback(
    (_groupId: string, _payload: string, messageId?: string) => {
      if (!messageId) return;
      console.log('[ChatContainer] Synced TOMBSTONE for message:', messageId);
      deleteMessage({ messageId });
    },
    [deleteMessage],
  );

  const handleSyncEdit = useCallback(
    async (groupId: string, payload: string, messageId?: string) => {
      if (!messageId) return;
      console.log('[ChatContainer] Synced EDIT for message:', messageId);

      const decrypted = await decryptIncomingMessagePayload(groupId, payload);
      let content: string;
      if (decrypted !== null) {
        content = decrypted;
      } else {
        try {
          content = decodeURIComponent(escape(atob(payload)));
        } catch {
          content = payload;
        }
      }

      updateMessage({ messageId, content });
    },
    [updateMessage],
  );

  // Run background sync when coming online
  const { isSyncing } = useSync({
    onMessage: handleSyncMessage,
    onWelcome: handleSyncWelcome,
    onCommit: handleSyncCommit,
    onTombstone: handleSyncTombstone,
    onEdit: handleSyncEdit,
  });

  const { isConnected } = useWebSocket({
    accessToken: getAccessToken(),
    onWelcome: handleWelcome,
    onCommit: handleCommit,
    onApplicationMessage: handleApplicationMessage,
    onEdit: handleEdit,
    onTombstone: handleTombstone,
  });

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!selectedChatId) return;

      // Send message through REST API (handles optimistic local update + server call)
      sendMessage(content);
    },
    [selectedChatId, sendMessage],
  );

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setSelectedChatId(chatId);
      // Mark the chat as read when selected
      markAsRead(chatId);
    },
    [markAsRead],
  );

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleGroupCreated = useCallback(async () => {
    await refreshGroups();
  }, [refreshGroups]);

  const handleGroupLeft = useCallback(async () => {
    setSelectedChatId(null);
    await refreshGroups();
  }, [refreshGroups]);

  const handleMembersChanged = useCallback(async () => {
    await refreshGroups();
  }, [refreshGroups]);

  const selectedChat = groups.find((chat) => chat.id === selectedChatId) ?? null;

  // The user has a chat selected but it's no longer in their groups list
  // → they were removed from this group.
  const isRemovedFromSelectedChat = !!selectedChatId && !selectedChat && !isLoadingGroups;

  const inputDisabled = !isConnected || isRemovedFromSelectedChat;
  const inputPlaceholder = isRemovedFromSelectedChat
    ? 'You are no longer a member of this group'
    : isConnected
      ? 'Type a message...'
      : 'Connecting to server...';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <ChatSidebar
        groups={groups}
        isOpen={isSidebarOpen}
        onGroupCreated={handleGroupCreated}
        onSelectChat={handleSelectChat}
        onToggle={handleToggleSidebar}
        selectedChatId={selectedChatId}
      />

      {/* Main chat area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Chat header */}
        <ChatHeader
          group={selectedChat}
          isConnected={isConnected}
          isSyncing={isSyncing}
          onGroupLeft={handleGroupLeft}
          onMembersChanged={handleMembersChanged}
        />

        {/* Messages */}
        {selectedChatId ? (
          <>
            <MessageList isLoading={isLoadingMessages} messages={messages} />
            <MessageInput
              disabled={inputDisabled}
              onSendMessage={handleSendMessage}
              placeholder={inputPlaceholder}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                {isLoadingGroups
                  ? 'Loading chats...'
                  : 'Select a chat from the sidebar to start messaging'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
