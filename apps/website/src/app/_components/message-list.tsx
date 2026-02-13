'use client';

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChatBubble } from '@/components/ui/chat-bubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { Message } from '@/lib/chat/types';
import { MessageActions } from './message-actions';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  editingMessageId?: string | null;
  onStartEdit?: (message: Message) => void;
  onSubmitEdit?: (messageId: string, groupId: string, newContent: string) => void;
  onCancelEdit?: () => void;
  onDeleteMessage?: (messageId: string) => void;
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

function InlineEditForm({
  message,
  onSubmit,
  onCancel,
}: {
  message: Message;
  onSubmit: (messageId: string, groupId: string, newContent: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => {
      textareaRef.current?.focus();
      // Move cursor to end
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }, 0);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && trimmed !== message.content) {
      onSubmit(message.id, message.chatId, trimmed);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex max-w-[80%] flex-col gap-1.5">
      <form className="flex items-end gap-1.5" onSubmit={handleSubmit}>
        <Textarea
          className="max-h-32 min-h-10 resize-none rounded-md bg-primary/10 text-sm ring-2 ring-primary/30"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Edit your message..."
          ref={textareaRef}
          rows={1}
          value={value}
        />
        <div className="flex gap-1">
          <Button
            className="size-8"
            disabled={!value.trim()}
            size="icon"
            type="submit"
            variant="ghost"
          >
            <CheckIcon className="size-4" />
          </Button>
          <Button className="size-8" onClick={onCancel} size="icon" type="button" variant="ghost">
            <CloseIcon className="size-4" />
          </Button>
        </div>
      </form>
      <span className="px-1 text-[10px] text-muted-foreground">
        Press Escape to cancel · Enter to save
      </span>
    </div>
  );
}

interface MessageListItemProps {
  message: Message;
  previousMessage?: Message;
  editingMessageId?: string | null;
  onStartEdit?: (message: Message) => void;
  onSubmitEdit?: (messageId: string, groupId: string, newContent: string) => void;
  onCancelEdit?: () => void;
  onDeleteMessage?: (messageId: string) => void;
}

function MessageListItem({
  message,
  previousMessage,
  editingMessageId,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onDeleteMessage,
}: MessageListItemProps) {
  const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
  const isEditing = editingMessageId === message.id;

  return (
    <div>
      {showDateSeparator && <MessageDateSeparator date={message.timestamp} />}
      {message.isSystem ? (
        <div className="flex items-center justify-center py-1" id={`message-${message.id}`}>
          <span className="rounded-full bg-muted px-3 py-1 text-center text-muted-foreground text-xs">
            {message.content}
          </span>
        </div>
      ) : isEditing && onSubmitEdit && onCancelEdit ? (
        <div
          className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
          id={`message-${message.id}`}
        >
          <InlineEditForm message={message} onCancel={onCancelEdit} onSubmit={onSubmitEdit} />
        </div>
      ) : (
        <div className="group/message relative flex flex-col gap-1" id={`message-${message.id}`}>
          <div
            className={`flex items-center gap-1 ${message.isOwn ? 'justify-end' : 'justify-start'}`}
          >
            {message.isOwn && onStartEdit && onDeleteMessage && (
              <MessageActions
                onDelete={() => onDeleteMessage(message.id)}
                onEdit={() => onStartEdit(message)}
              />
            )}
            <ChatBubble
              authorName={!message.isOwn ? message.senderName || message.senderId : undefined}
              status={message.status}
              timestamp={message.timestamp}
              variant={message.isOwn ? 'own' : 'other'}
            >
              {message.content}
              {message.isEdited && <span className="ml-1 text-[10px] opacity-60">(edited)</span>}
            </ChatBubble>
          </div>
        </div>
      )}
    </div>
  );
}

export function MessageList({
  messages,
  isLoading = false,
  editingMessageId,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onDeleteMessage,
}: MessageListProps) {
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
        {messages.map((message, index) => (
          <MessageListItem
            editingMessageId={editingMessageId}
            key={message.id}
            message={message}
            onCancelEdit={onCancelEdit}
            onDeleteMessage={onDeleteMessage}
            onStartEdit={onStartEdit}
            onSubmitEdit={onSubmitEdit}
            previousMessage={messages[index - 1]}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
