import Dexie, { type Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import type { GlobalMessage, Group, GroupWithMetadata } from "@/lib/types";
/**
 * Tracks the read state for each group (stored locally in IndexedDB)
 * This allows computing unread counts without modifying the backend schema
 */
export interface GroupReadState {
	groupId: string;
	/** Timestamp of when the user last read messages in this group */
	lastReadAt: Date;
	/** ID of the last read message (alternative tracking method) */
	lastReadMessageId?: string;
}

/**
 * Local message storage for offline access and unread counting
 */
export interface LocalMessage {
	id: string;
	groupId: string;
	senderId: string;
	content: string;
	createdAt: Date;
	/** Whether this message was sent by the current user */
	isOwn: boolean;
}

export class MyDexie extends Dexie {
	groups!: Table<Group>;
	globalMessages!: Table<GlobalMessage>;
	groupReadStates!: Table<GroupReadState>;
	localMessages!: Table<LocalMessage>;

	constructor() {
		super("MLS_APP_DB");
		this.version(1).stores({
			globalMessages: "&id, &nonce, senderId, createdAt, updatedAt",
			groups: "&id, name, createdById, createdAt, updatedAt",
		});
		this.version(2).stores({
			globalMessages: "&id, &nonce, senderId, createdAt, updatedAt",
			groups: "&id, name, createdById, createdAt, updatedAt",
			groupReadStates: "&groupId, lastReadAt",
			localMessages: "&id, groupId, senderId, createdAt, isOwn",
		});
	}
}

export const dexieDb = new MyDexie();

/**
 * Mark a group as read (updates the lastReadAt timestamp)
 */
export async function markGroupAsRead(groupId: string): Promise<void> {
	await dexieDb.groupReadStates.put({
		groupId,
		lastReadAt: new Date(),
	});
}

// ============================================================================
// Live Query Hooks - Reactive versions that auto-update when data changes
// ============================================================================

/**
 * Hook to get groups with computed metadata (unread count, last message, etc.)
 * Automatically updates when groups, messages, or read states change.
 */
export function useGroupsWithMetadata(): {
	groups: GroupWithMetadata[];
	isLoading: boolean;
} {
	const result = useLiveQuery(async () => {
		const groups = await dexieDb.groups.toArray();
		const readStates = await dexieDb.groupReadStates.toArray();
		const readStateMap = new Map(readStates.map((rs) => [rs.groupId, rs]));

		const groupsWithMetadata: GroupWithMetadata[] = await Promise.all(
			groups.map(async (group) => {
				const readState = readStateMap.get(group.id);
				const lastReadAt = readState?.lastReadAt ?? new Date(0);

				// Get unread count (messages after lastReadAt that aren't from current user)
				const unreadCount = await dexieDb.localMessages
					.where("groupId")
					.equals(group.id)
					.filter((msg) => msg.createdAt > lastReadAt && !msg.isOwn)
					.count();

				// Get last message
				const lastMessages = await dexieDb.localMessages
					.where("groupId")
					.equals(group.id)
					.reverse()
					.sortBy("createdAt");
				const lastMsg = lastMessages[0];

				return {
					...group,
					unreadCount,
					lastMessage: lastMsg?.content,
					lastMessageTime: lastMsg?.createdAt,
				};
			}),
		);

		return groupsWithMetadata;
	});

	return {
		groups:  result ?? [],
		isLoading: result === undefined,
	};
}

/**
 * Hook to get unread count for a specific group.
 * Automatically updates when messages or read state changes.
 */
export function useUnreadCount(groupId: string | null): number {
	const count = useLiveQuery(async () => {
		if (!groupId) return 0;

		const readState = await dexieDb.groupReadStates.get(groupId);
		const lastReadAt = readState?.lastReadAt ?? new Date(0);

		return dexieDb.localMessages
			.where("groupId")
			.equals(groupId)
			.filter((msg) => msg.createdAt > lastReadAt && !msg.isOwn)
			.count();
	}, [groupId]);

	return count ?? 0;
}

/**
 * Hook to get the last message for a group.
 * Automatically updates when messages change.
 */
export function useLastMessage(
	groupId: string | null,
): LocalMessage | undefined {
	return useLiveQuery(async () => {
		if (!groupId) return undefined;

		const messages = await dexieDb.localMessages
			.where("groupId")
			.equals(groupId)
			.reverse()
			.sortBy("createdAt");

		return messages[0];
	}, [groupId]);
}

/**
 * Hook to get messages for a specific group.
 * Automatically updates when messages change.
 */
export function useGroupMessages(groupId: string | null): {
	messages: LocalMessage[];
	isLoading: boolean;
} {
	const result = useLiveQuery(async () => {
		if (!groupId) return [];

		return dexieDb.localMessages
			.where("groupId")
			.equals(groupId)
			.sortBy("createdAt");
	}, [groupId]);

	return {
		messages: result ?? [],
		isLoading: result === undefined,
	};
}
