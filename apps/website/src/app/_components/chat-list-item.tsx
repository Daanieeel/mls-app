'use client';

import { Avatar } from '@/components/ui/avatar';
import type { GroupWithMetadata } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatListItemProps {
  group: GroupWithMetadata;
  isSelected: boolean;
  onClick: () => void;
}

function formatTime(date?: Date): string {
  if (!date) return '';

  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  if (diffInHours < 24 * 7) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function ChatListItem({ group, isSelected, onClick }: ChatListItemProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'cursor-pointer hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none',
        isSelected && 'bg-sidebar-accent',
      )}
      onClick={onClick}
      type="button"
    >
      <Avatar fallback={group.name} size="sm" src={group.avatarUrl} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate font-medium text-sidebar-foreground text-sm',
              group.unreadCount > 0 && 'font-semibold',
            )}
          >
            {group.name}
          </span>
          {group.lastMessageTime && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatTime(group.lastMessageTime)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-muted-foreground text-xs">
            {group.lastMessage ?? 'No messages yet'}
          </span>
          {group.unreadCount > 0 && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-[10px] text-primary-foreground">
              {group.unreadCount > 99 ? '99+' : group.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
