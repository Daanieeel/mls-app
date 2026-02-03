/**
 * Chat-related types and interfaces
 */

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  isOwn: boolean;
}

export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  avatarUrl?: string;
  isGroup: boolean;
}

export interface ChatUser {
  id: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
}

/**
 * WebSocket event types for group/chat events
 */
export type WebSocketEventType =
  | 'message:new'
  | 'message:update'
  | 'message:delete'
  | 'group:member_joined'
  | 'group:member_left'
  | 'group:updated'
  | 'typing:start'
  | 'typing:stop'
  | 'connection:established'
  | 'connection:error';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: Date;
}

export interface NewMessagePayload {
  message: Message;
}

export interface UpdateMessagePayload {
  messageId: string;
  chatId: string;
  content: string;
}

export interface DeleteMessagePayload {
  messageId: string;
  chatId: string;
}

export interface GroupMemberPayload {
  chatId: string;
  userId: string;
  userName: string;
}

export interface TypingPayload {
  chatId: string;
  userId: string;
  userName: string;
}
