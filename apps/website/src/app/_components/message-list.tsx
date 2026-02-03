'use client';

import { useRef } from 'react';

import { ChatBubble } from '@/components/ui/chat-bubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Message } from '@/lib/chat/types';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

function MessageDateSeparator({ date }: { date: Date }) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);

  return (
    <div className="flex items-center gap-4 py-4">
      <div className="h-px flex-1 bg-border" />
      <span className="text-muted-foreground text-xs">{formattedDate}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function shouldShowDateSeparator(current: Message, previous?: Message): boolean {
  if (!previous) return true;

  const currentDate = new Date(current.timestamp);
  const previousDate = new Date(previous.timestamp);

  return (
    currentDate.getDate() !== previousDate.getDate() ||
    currentDate.getMonth() !== previousDate.getMonth() ||
    currentDate.getFullYear() !== previousDate.getFullYear()
  );
}

export function MessageList({ messages, isLoading = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  if (lastMessageId !== lastMessageIdRef.current) {
    lastMessageIdRef.current = lastMessageId;
    // Use setTimeout to ensure the DOM has updated
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground text-sm">
          No messages yet. Start the conversation!
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4 md:px-6">
      <div className="flex flex-col gap-3 py-4">
        {messages.map((message, index) => {
          const previousMessage = messages[index - 1];
          const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

          return (
            <div key={message.id}>
              {showDateSeparator && <MessageDateSeparator date={message.timestamp} />}
              <ChatBubble
                status={message.status}
                timestamp={message.timestamp}
                variant={message.isOwn ? 'own' : 'other'}
              >
                {message.content}
              </ChatBubble>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
