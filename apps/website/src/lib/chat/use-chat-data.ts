"use client";

import { useCallback, useMemo } from "react";
import {
	dexieDb,
	type LocalMessage,
	markGroupAsRead,
	useGroupMessages,
	useGroupsWithMetadata,
} from "@/lib/db";
import type { GroupWithMetadata } from "@/lib/types";
import { useSession } from "@/server/better-auth/client";
import type { Message } from "./types";

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
	markAsRead: (groupId: string) => Promise<void>;
}

export function useChatData({
	selectedChatId,
}: UseChatDataOptions): UseChatDataReturn {
	const { data: session, isPending: isLoadingSession } = useSession();

	const { groups: groupsWithMetadata, isLoading: isLoadingChats } =
		useGroupsWithMetadata();

	const { messages: localMessages, isLoading: isLoadingMessages } =
		useGroupMessages(selectedChatId);

	const messages: Message[] = useMemo(
		() =>
			localMessages.map((msg) => ({
				id: msg.id,
				chatId: msg.groupId,
				senderId: msg.senderId,
				content: msg.content,
				timestamp: msg.createdAt,
				status: "sent" as const,
				isOwn: msg.isOwn,
			})),
		[localMessages],
	);

	const sendMessage = useCallback(
		(content: string) => {
			if (!selectedChatId) return;

			// Don't allow sending until session is ready and we have a user id
			if (isLoadingSession || !session?.user?.id) {
				console.warn("Cannot send message: session is loading or missing");
				// TODO: Show user feedback
				return;
			}

			const newMessage: LocalMessage = {
				id: `msg-${Date.now()}`,
				groupId: selectedChatId,
				senderId: session.user.id,
				content,
				createdAt: new Date(),
				isOwn: true,
			};

			dexieDb.localMessages.put(newMessage).catch(console.error);

			// TODO: Send Message to REST Endpoint
			// TODO: update message's id and timestamp based on server response
		},
		[selectedChatId, session?.user?.id, isLoadingSession],
	);

	const addMessage = useCallback((message: Message) => {
		const localMessage: LocalMessage = {
			id: message.id,
			groupId: message.chatId,
			senderId: message.senderId,
			content: message.content,
			createdAt: message.timestamp,
			isOwn: message.isOwn,
		};
		dexieDb.localMessages.put(localMessage).catch(console.error);
	}, []);

	const updateMessage = useCallback((payload: UpdateMessagePayload) => {
		dexieDb.localMessages
			.update(payload.messageId, { content: payload.content })
			.catch(console.error);
	}, []);

	const deleteMessage = useCallback((payload: DeleteMessagePayload) => {
		dexieDb.localMessages.delete(payload.messageId).catch(console.error);
	}, []);

	// Mark a group as read
	const markAsRead = useCallback(async (groupId: string) => {
		await markGroupAsRead(groupId);
	}, []);

	return {
		groups: groupsWithMetadata,
		messages,
		isLoadingGroups: isLoadingChats,
		isLoadingSession,
		isAuthenticated: !!session?.user,
		isLoadingMessages,
		sendMessage,
		addMessage,
		updateMessage,
		deleteMessage,
		markAsRead,
	};
}
