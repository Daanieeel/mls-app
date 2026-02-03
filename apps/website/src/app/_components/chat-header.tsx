'use client';

import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { Chat } from '@/lib/chat/types';

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

interface ChatHeaderProps {
  chat: Chat | null;
  isConnected: boolean;
}

export function ChatHeader({ chat, isConnected }: ChatHeaderProps) {
  if (!chat) {
    return (
      <div className="flex h-14 items-center px-4 md:px-6">
        <span className="text-muted-foreground text-sm">Select a chat to start messaging</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        {/* Spacer for mobile burger menu */}
        <div className="w-8 md:hidden" />

        <Avatar fallback={chat.name} size="sm" src={chat.avatarUrl} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{chat.name}</span>
            {chat.isGroup && <UsersIcon className="size-4 shrink-0 text-muted-foreground" />}
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`size-1.5 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-muted-foreground'
              }`}
            />
            <span className="text-[10px] text-muted-foreground">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      <Separator />
    </>
  );
}
