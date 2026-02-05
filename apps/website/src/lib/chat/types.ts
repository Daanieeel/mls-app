/**
 * Chat-related types and interfaces
 */

import { z } from 'zod';

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
 * Zod Schemas for WebSocket Messages (MLS Protocol)
 */

// Crypto payload validation for Base64/Hex encoded strings
const CryptoPayloadSchema = z
  .string()
  .min(1, 'Payload cannot be empty')
  .max(1024 * 512, 'Payload exceeds 512KB safety limit')
  .regex(
    /^[A-Za-z0-9\-_+/]+={0,2}$|^[0-9a-fA-F]+$/,
    'Payload must be valid Base64/Base64Url or Hex encoding',
  );

// Base WebSocket message schema with common fields
const BaseWebSocketMessageSchema = z.object({
  group_id: z.string().uuid('Group ID must be a valid UUID'),
  payload: CryptoPayloadSchema,
  seq_id: z.number().int().nonnegative().optional(),
  timestamp: z.coerce.date().optional(),
  message_id: z.string().optional(),
  sender_id: z.string().optional(),
});

/**
 * WELCOME event: User/device added to a group
 * Contains encrypted group state and keys for the new member
 */
export const WelcomeMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal('WELCOME'),
  payload: CryptoPayloadSchema.min(32, 'Welcome blob must be at least 32 bytes'),
});

/**
 * COMMIT event: Group topology/state changed
 * Examples: member added/removed, device revoked, group updated
 */
export const CommitMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal('COMMIT'),
});

/**
 * MSG event: Standard encrypted application message
 * Contains user content (text, media metadata, etc.)
 */
export const ApplicationMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal('MSG'),
  nonce: z
    .string()
    .regex(
      /^[0-9a-fA-F]{24}$|^[A-Za-z0-9+/]{16}==$|^[A-Za-z0-9+/]{22}==$/,
      'Nonce must be a valid 12-byte or 16-byte encoded string',
    )
    .optional(),
});

/**
 * TOMBSTONE event: Message deletion marker
 * Indicates a message was deleted (soft delete)
 */
export const TombstoneMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal('TOMBSTONE'),
  message_id: z.string().optional(),
});

/**
 * EDIT event: Message content update
 * References a previous message with new content
 */
export const EditMessageSchema = BaseWebSocketMessageSchema.extend({
  type: z.literal('EDIT'),
  message_id: z.string().optional(),
});

/**
 * Connection event schemas (non-MLS, connection management)
 */
export const ConnectionEstablishedSchema = z.object({
  type: z.literal('connection:established'),
});

export const ConnectionErrorSchema = z.object({
  type: z.literal('connection:error'),
  error: z.string().optional(),
});

/**
 * Discriminated union of all MLS WebSocket message types
 */
export const MLSWebSocketMessageSchema = z.discriminatedUnion('type', [
  WelcomeMessageSchema,
  CommitMessageSchema,
  ApplicationMessageSchema,
  TombstoneMessageSchema,
  EditMessageSchema,
]);

/**
 * All possible WebSocket messages including connection events
 */
export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  WelcomeMessageSchema,
  CommitMessageSchema,
  ApplicationMessageSchema,
  TombstoneMessageSchema,
  EditMessageSchema,
  ConnectionEstablishedSchema,
  ConnectionErrorSchema,
]);

/**
 * TypeScript types inferred from Zod schemas
 */
export type WelcomeMessage = z.infer<typeof WelcomeMessageSchema>;
export type CommitMessage = z.infer<typeof CommitMessageSchema>;
export type ApplicationMessage = z.infer<typeof ApplicationMessageSchema>;
export type TombstoneMessage = z.infer<typeof TombstoneMessageSchema>;
export type EditMessage = z.infer<typeof EditMessageSchema>;
export type MLSWebSocketMessage = z.infer<typeof MLSWebSocketMessageSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

/**
 * WebSocket event type union
 */
export type WebSocketEventType = WebSocketMessage['type'];
