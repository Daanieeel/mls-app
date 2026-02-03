'use client';

import { useCallback, useEffect, useState } from 'react';
import { CURRENT_USER_ID, PLACEHOLDER_CHATS, PLACEHOLDER_MESSAGES } from './placeholder-data';
import type { Chat, DeleteMessagePayload, Message, UpdateMessagePayload } from './types';

interface UseChatDataOptions {
  selectedChatId: string | null;
}

interface UseChatDataReturn {
  chats: Chat[];
  messages: Message[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  sendMessage: (content: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (payload: UpdateMessagePayload) => void;
  deleteMessage: (payload: DeleteMessagePayload) => void;
}

export function useChatData({ selectedChatId }: UseChatDataOptions): UseChatDataReturn {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // TODO: Replace with actual IndexedDB fetch
  useEffect(() => {
    const loadChats = async () => {
      setIsLoadingChats(true);
      try {
        // TODO: Fetch from IndexedDB

        // TODO: Fetch missed chats from backend

        // For now, use placeholder data
        await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate loading
        setChats(PLACEHOLDER_CHATS);
      } catch (error) {
        console.error('Failed to load chats:', error);
      } finally {
        setIsLoadingChats(false);
      }
    };

    loadChats();
  }, []);

  // TODO: Replace with actual IndexedDB fetch for messages
  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        // TODO: Fetch from IndexedDB

        // TODO: Fetch missed messages from backend

        // For now, use placeholder data
        await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate loading
        setMessages(PLACEHOLDER_MESSAGES[selectedChatId] ?? []);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedChatId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!selectedChatId) return;

      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        chatId: selectedChatId,
        senderId: CURRENT_USER_ID,
        content,
        timestamp: new Date(),
        status: 'sending',
        isOwn: true,
      };

      setMessages((prev) => [...prev, newMessage]);

      // TODO: Send Message to REST Endpoint

      // TODO: Save to IndexedDB

      // Simulate message being sent
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === newMessage.id ? { ...msg, status: 'sent' as const } : msg)),
        );
      }, 500);
    },
    [selectedChatId],
  );

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });

    // Update chat's last message
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === message.chatId
          ? {
              ...chat,
              lastMessage: message.content,
              lastMessageTime: message.timestamp,
              unreadCount: message.isOwn ? chat.unreadCount : chat.unreadCount + 1,
            }
          : chat,
      ),
    );

    // TODO: Save to IndexedDB
  }, []);

  const updateMessage = useCallback((payload: UpdateMessagePayload) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === payload.messageId ? { ...msg, content: payload.content } : msg,
      ),
    );

    // TODO: Update in IndexedDB
  }, []);

  const deleteMessage = useCallback((payload: DeleteMessagePayload) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== payload.messageId));

    // TODO: Delete from IndexedDB
  }, []);

  return {
    chats,
    messages,
    isLoadingChats,
    isLoadingMessages,
    sendMessage,
    addMessage,
    updateMessage,
    deleteMessage,
  };
}
