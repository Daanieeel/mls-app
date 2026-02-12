'use client';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface NotificationProps {
  type: 'message' | 'edit' | 'delete' | 'group';
  title: string;
  content?: string;
  senderName?: string;
  groupName?: string;
  onClick?: () => void;
}

export function Notification({
  type,
  title,
  content,
  senderName,
  groupName,
  onClick,
}: NotificationProps) {
  const getIcon = () => {
    switch (type) {
      case 'message':
        return '💬';
      case 'edit':
        return '✏️';
      case 'delete':
        return '🗑️';
      case 'group':
        return '👥';
      default:
        return '📢';
    }
  };

  return (
    <button
      className={cn(
        'flex w-full items-start gap-3 rounded-lg bg-secondary/50 p-4 text-left transition-colors',
        'cursor-pointer backdrop-blur-sm hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring',
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex-shrink-0">
        {senderName ? (
          <Avatar fallback={senderName} size="default" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <span className="text-xl">{getIcon()}</span>
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm">{title}</p>
          {groupName && <span className="text-muted-foreground text-xs">in {groupName}</span>}
        </div>
        {content && <p className="line-clamp-2 text-muted-foreground text-sm">{content}</p>}
      </div>
    </button>
  );
}
