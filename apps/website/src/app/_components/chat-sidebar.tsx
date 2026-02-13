"use client";

import { LogOut, Menu, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth';
import type { GroupWithMetadata } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChatListItem } from './chat-list-item';
import { CreateGroupDialog } from './create-group-dialog';
import { ThemeToggle } from './theme-toggle';

interface ChatSidebarProps {
  groups: GroupWithMetadata[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onGroupCreated?: () => void;
}

export function ChatSidebar({
  groups,
  selectedChatId,
  onSelectChat,
  isOpen,
  onToggle,
  onGroupCreated,
}: ChatSidebarProps) {
  const { user, signOut } = useAuth();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const getInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() ?? '?';
  };

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
          'fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-sidebar-border border-r bg-sidebar transition-transform duration-300 ease-in-out md:relative md:z-0 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4">
          <h2 className="font-semibold text-lg text-sidebar-foreground">Chats</h2>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              aria-label="Create group"
              onClick={() => setShowCreateGroup(true)}
              size="icon-sm"
              variant="ghost"
            >
              <Plus className="size-4" />
            </Button>
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
        </div>

				<Separator />

        {/* Chat list */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-2">
            {groups.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                No groups yet. Create one to get started!
              </div>
            ) : (
              groups.map((group) => (
                <ChatListItem
                  group={group}
                  isSelected={group.id === selectedChatId}
                  key={group.id}
                  onClick={() => {
                    onSelectChat(group.id);
                    if (window.innerWidth < 768) {
                      onToggle();
                    }
                  }}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* User profile & logout */}
        {user && (
          <div className="p-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  'cursor-pointer hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none',
                )}
              >
                <Avatar fallback={getInitials()} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-sidebar-foreground text-sm">
                    {user.name || 'No name'}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={4}>
                <div className="px-2 py-1.5">
                  <p className="font-medium text-xs">{user.name || user.email}</p>
                  <p className="text-[10px] text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </aside>

      {/* Mobile burger menu button */}
      <Button
        aria-label="Open sidebar"
        className={cn('fixed top-3 left-4 z-30 md:hidden', isOpen && 'hidden')}
        onClick={onToggle}
        size="icon"
        variant="ghost"
      >
        <Menu className="size-5" />
      </Button>

      {/* Create group dialog */}
      <CreateGroupDialog
        onGroupCreated={onGroupCreated}
        onOpenChange={setShowCreateGroup}
        open={showCreateGroup}
      />
    </>
  );
}
