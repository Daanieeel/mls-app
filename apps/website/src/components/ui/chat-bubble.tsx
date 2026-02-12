'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const chatBubbleVariants = cva('relative break-words rounded-2xl px-4 py-2 text-sm', {
  variants: {
    variant: {
      own: 'rounded-br-md bg-primary text-primary-foreground',
      other: 'rounded-bl-md bg-muted text-foreground',
    },
    status: {
      sending: 'opacity-70',
      sent: 'opacity-100',
      delivered: 'opacity-100',
      read: 'opacity-100',
      failed: 'opacity-50',
    },
  },
  defaultVariants: {
    variant: 'other',
    status: 'sent',
  },
});

interface ChatBubbleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleVariants> {
  timestamp?: Date;
  showTimestamp?: boolean;
  authorName?: string;
}

function ChatBubble({
  className,
  variant,
  status,
  timestamp,
  showTimestamp = true,
  authorName,
  children,
  ...props
}: ChatBubbleProps) {
  const formattedTime = timestamp
    ? new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(timestamp)
    : null;

  return (
    <div
      className={cn(
        'flex min-w-0 max-w-[80%] flex-col gap-1',
        variant === 'own' ? 'items-end' : 'items-start',
      )}
      data-slot="chat-bubble"
    >
      <div className={cn(chatBubbleVariants({ variant, status, className }))} {...props}>
        {children}
      </div>
      {showTimestamp && (formattedTime || authorName) && (
        <div className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {authorName && <span>{authorName}</span>}
          {authorName && formattedTime && <span className="size-0.5 rounded-full bg-current" />}
          {formattedTime && <span>{formattedTime}</span>}
        </div>
      )}
    </div>
  );
}

export { ChatBubble, chatBubbleVariants };
