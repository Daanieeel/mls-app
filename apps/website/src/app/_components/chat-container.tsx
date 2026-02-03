'use client';

import { useCallback, useState } from 'react';
import type { DeleteMessagePayload, Message, UpdateMessagePayload } from '@/lib/chat/types';
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

  // Handle incoming WebSocket messages
  const handleNewMessage = useCallback(
    (message: Message) => {
      addMessage(message);
    },
    [addMessage],
  );

  const handleUpdateMessage = useCallback(
    (payload: UpdateMessagePayload) => {
      updateMessage(payload);
    },
    [updateMessage],
  );

  const handleDeleteMessage = useCallback(
    (payload: DeleteMessagePayload) => {
      deleteMessage(payload);
    },
    [deleteMessage],
  );

  const { isConnected, sendMessage: wsSendMessage } = useWebSocket({
    onNewMessage: handleNewMessage,
    onUpdateMessage: handleUpdateMessage,
    onDeleteMessage: handleDeleteMessage,
  });

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!selectedChatId) return;

      // Add message optimistically to local state
      sendMessage(content);

      // Send via WebSocket
      wsSendMessage(selectedChatId, content);
    },
    [selectedChatId, sendMessage, wsSendMessage],
  );

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    // Mark the chat as read when selected
    markAsRead(chatId);
  }, [markAsRead]);

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
