import type { api } from "@repo/api"

//TODO: get from elysia eden
export type Group = {
    id: string;
    name: string;
    createdById: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Extended Group type with UI-specific computed fields
 * These fields are computed locally from IndexedDB, not stored in the backend
 */
export type GroupWithMetadata = Group & {
    /** Preview of the last message in the group */
    lastMessage?: string;
    /** Timestamp of the last message */
    lastMessageTime?: Date;
    /** Number of unread messages (computed from local read state) */
    unreadCount: number;
    /** Avatar URL for the group */
    avatarUrl?: string;
}

export type GlobalMessage = {
    id: string;
    nonce: string;
    senderId: string;
    payload: string;
    createdAt: string;
    updatedAt: string;
}