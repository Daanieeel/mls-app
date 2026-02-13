'use client';

import { Settings, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { GroupWithMetadata } from '@/lib/types';
import { GroupSettingsDialog } from './group-settings-dialog';

interface ChatHeaderProps {
  group: GroupWithMetadata | null;
  isConnected: boolean;
  isSyncing?: boolean;
  onGroupLeft?: () => void;
  onMembersChanged?: () => void;
}

export function ChatHeader({
  group,
  isConnected,
  isSyncing,
  onGroupLeft,
  onMembersChanged,
}: ChatHeaderProps) {
  const [showSettings, setShowSettings] = useState(false);

  if (!group) {
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

        <Avatar fallback={group.name} size="sm" src={group.avatarUrl} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{group.name}</span>
            <Users className="size-4 shrink-0 text-muted-foreground" />
          </div>

          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`size-1.5 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-muted-foreground'
              }`}
            />
            <span className="text-[10px] text-muted-foreground">
              {isSyncing ? 'Syncing...' : isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        <Button
          aria-label="Group settings"
          onClick={() => setShowSettings(true)}
          size="icon-sm"
          variant="ghost"
        >
          <Settings className="size-4" />
        </Button>
      </div>

      <Separator />

      {group && (
        <GroupSettingsDialog
          groupId={group.id}
          groupName={group.name}
          onGroupLeft={onGroupLeft}
          onMembersChanged={onMembersChanged}
          onOpenChange={setShowSettings}
          open={showSettings}
        />
      )}
    </>
  );
}
