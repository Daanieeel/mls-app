'use client';

import { useCallback, useState } from 'react';
import type { Message } from '@/lib/chat/types';
import { useChatData } from '@/lib/chat/use-chat-data';
import { useWebSocket } from '@/lib/chat/use-websocket';
import { ChatHeader } from './chat-header';
import { ChatSidebar } from './chat-sidebar';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';

export function ChatContainer() {
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
  } = useChatData({ selectedChatId });

  // Handle incoming WebSocket messages (UserInboxItem from MLS protocol)
  const handleApplicationMessage = useCallback(
    (
      messageId: string,
      groupId: string,
      senderId: string,
      payload: string,
      timestamp: Date,
      _seqId?: number,
    ) => {
      // TODO: Decrypt the payload using MLS
      // For now, treat payload as plain text content
      const message: Message = {
        id: messageId, // Use the actual message ID from the database
        chatId: groupId,
        senderId, // Sender is stored in GlobalMessage.senderId, not encrypted
        content: payload, // TODO: This should be decrypted content
        timestamp,
        status: 'delivered',
        isOwn: false, // TODO: Compare senderId with current user's ID
      };
      addMessage(message);
    },
    [addMessage],
  );

  const handleEdit = useCallback(
    (_groupId: string, payload: string, messageId?: string) => {
      if (!messageId) return;
      // TODO: Decrypt the payload using MLS
      updateMessage({
        messageId,
        content: payload, // TODO: This should be decrypted content
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

  const { isConnected, sendMessage: wsSendMessage } = useWebSocket({
    onApplicationMessage: handleApplicationMessage,
    onEdit: handleEdit,
    onTombstone: handleTombstone,
  });

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!selectedChatId) return;

      // Add message optimistically to local state
      sendMessage(content);

      // TODO: Encrypt the content using MLS before sending
      // For now, send as plain text
      const encryptedPayload = content; // TODO: Replace with actual encryption
      wsSendMessage(selectedChatId, encryptedPayload);
    },
    [selectedChatId, sendMessage, wsSendMessage],
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

  const selectedChat = groups.find((chat) => chat.id === selectedChatId) ?? null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <ChatSidebar
        groups={groups}
        isOpen={isSidebarOpen}
        onSelectChat={handleSelectChat}
        onToggle={handleToggleSidebar}
        selectedChatId={selectedChatId}
      />

      {/* Main chat area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Chat header */}
        <ChatHeader group={selectedChat} isConnected={isConnected} />

        {/* Messages */}
        {selectedChatId ? (
          <>
            <MessageList isLoading={isLoadingMessages} messages={messages} />
            <MessageInput
              disabled={!isConnected}
              onSendMessage={handleSendMessage}
              placeholder={isConnected ? 'Type a message...' : 'Connecting to server...'}
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
