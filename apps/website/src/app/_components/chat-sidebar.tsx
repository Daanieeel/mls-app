"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { GroupWithMetadata } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChatListItem } from "./chat-list-item";

interface ChatSidebarProps {
	groups: GroupWithMetadata[];
	selectedChatId: string | null;
	onSelectChat: (chatId: string) => void;
	isOpen: boolean;
	onToggle: () => void;
}

export function ChatSidebar({
	groups,
	selectedChatId,
	onSelectChat,
	isOpen,
	onToggle,
}: ChatSidebarProps) {
	return (
		<>
			{/* Mobile overlay */}
			{isOpen && (
				<button
					aria-label="Close sidebar"
					className="fixed inset-0 z-40 cursor-default border-none bg-background/80 backdrop-blur-sm md:hidden"
					onClick={onToggle}
					type="button"
				/>
			)}

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-sidebar-border border-r bg-sidebar transition-transform duration-300 ease-in-out md:relative md:z-0 md:translate-x-0",
					isOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				{/* Header */}
				<div className="flex h-14 items-center justify-between px-4">
					<h2 className="font-semibold text-lg text-sidebar-foreground">
						Chats
					</h2>
					<Button
						aria-label="Close sidebar"
						className="md:hidden"
						onClick={onToggle}
						size="icon-sm"
						variant="ghost"
					>
						<X className="size-4" />
					</Button>
				</div>

				<Separator />

				{/* Chat list */}
				<ScrollArea className="flex-1">
					<div className="flex flex-col gap-1 p-2">
						{groups.map((group) => (
							<ChatListItem
								group={group}
								isSelected={group.id === selectedChatId}
								key={group.id}
								onClick={() => {
									onSelectChat(group.id);
									// Close sidebar on mobile after selection
									if (window.innerWidth < 768) {
										onToggle();
									}
								}}
							/>
						))}
					</div>
				</ScrollArea>
			</aside>

			{/* Mobile burger menu button */}
			<Button
				aria-label="Open sidebar"
				className={cn("fixed top-3 left-4 z-30 md:hidden", isOpen && "hidden")}
				onClick={onToggle}
				size="icon"
				variant="ghost"
			>
				<Menu className="size-5" />
			</Button>
		</>
	);
}
