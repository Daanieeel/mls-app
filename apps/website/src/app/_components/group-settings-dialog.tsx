'use client';

import { LogOut, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useApi, useAuth } from '@/lib/auth';
import { UserPickerDialog } from './user-picker-dialog';

interface GroupMember {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  userId: string;
  groupId: string;
  joinedAt: string | Date;
}

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  onGroupLeft?: () => void;
  onMembersChanged?: () => void;
}

export function GroupSettingsDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  onGroupLeft,
  onMembersChanged,
}: GroupSettingsDialogProps) {
  const api = useApi();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Fetch group members when dialog opens
  useEffect(() => {
    if (!open || !groupId) return;

    const fetchMembers = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.groups({ id: groupId }).get();
        if (data && 'members' in data) {
          setMembers((data as unknown as { members: GroupMember[] }).members);
        }
      } catch (err) {
        console.error('Failed to fetch group members:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [open, groupId, api]);

  const getInitials = (member: GroupMember) => {
    const name = member.user.name;
    if (name) {
      return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    return member.user.email.slice(0, 2).toUpperCase();
  };

  const handleAddUsers = useCallback(
    async (users: { id: string; email: string; name: string | null }[]) => {
      for (const user of users) {
        try {
          const placeholderPayload = btoa(JSON.stringify({ type: 'user_added', userId: user.id }));

          await api.groups({ id: groupId })['add-user'].post({
            targetId: user.id,
            commitMessage: {
              payload: placeholderPayload,
              nonce: crypto.randomUUID().replace(/-/g, ''),
              type: 'COMMIT',
            },
          });
        } catch (err) {
          console.error(`Failed to add user ${user.id}:`, err);
        }
      }

      // Refresh members
      const { data } = await api.groups({ id: groupId }).get();
      if (data && 'members' in data) {
        setMembers((data as unknown as { members: GroupMember[] }).members);
      }
      onMembersChanged?.();
    },
    [api, groupId, onMembersChanged],
  );

  const handleRemoveUser = useCallback(
    async (userId: string) => {
      try {
        const placeholderPayload = btoa(JSON.stringify({ type: 'user_removed', userId }));

        await api.groups({ id: groupId })['remove-user'].post({
          targetId: userId,
          commitMessage: {
            payload: placeholderPayload,
            nonce: crypto.randomUUID().replace(/-/g, ''),
            type: 'COMMIT',
          },
        });

        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        onMembersChanged?.();
      } catch (err) {
        console.error('Failed to remove user:', err);
      } finally {
        setRemovingUserId(null);
      }
    },
    [api, groupId, onMembersChanged],
  );

  const handleLeaveGroup = useCallback(async () => {
    try {
      const placeholderPayload = btoa(
        JSON.stringify({ type: 'user_left', userId: currentUser?.id }),
      );

      await api.groups({ id: groupId }).leave.post({
        payload: placeholderPayload,
        nonce: crypto.randomUUID().replace(/-/g, ''),
        type: 'COMMIT',
      });

      onOpenChange(false);
      onGroupLeft?.();
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  }, [api, groupId, currentUser, onOpenChange, onGroupLeft]);

  const existingMemberIds = members.map((m) => m.userId);

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4" />
              {groupName}
            </DialogTitle>
            <DialogDescription>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          {/* Members list */}
          <ScrollArea className="max-h-64">
            <div className="flex flex-col gap-0.5">
              {isLoading ? (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  Loading members...
                </div>
              ) : (
                members.map((member) => {
                  const isCurrentUser = member.userId === currentUser?.id;
                  return (
                    <div
                      className="flex items-center gap-3 rounded-md px-2 py-2"
                      key={member.userId}
                    >
                      <Avatar fallback={getInitials(member)} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-sm">
                          {member.user.name || 'No name'}
                          {isCurrentUser && (
                            <span className="ml-1 text-muted-foreground text-xs">(you)</span>
                          )}
                        </span>
                        <span className="truncate text-muted-foreground text-xs">
                          {member.user.email}
                        </span>
                      </div>
                      {!isCurrentUser && (
                        <Button
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setRemovingUserId(member.userId)}
                          size="icon-xs"
                          variant="ghost"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <Separator />

          <div className="flex flex-col gap-2">
            <Button
              className="w-full justify-start gap-2"
              onClick={() => setShowAddUser(true)}
              size="default"
              variant="outline"
            >
              <Plus className="size-3.5" />
              Add Members
            </Button>
            <Button
              className="w-full justify-start gap-2"
              onClick={() => setShowLeaveConfirm(true)}
              size="default"
              variant="destructive"
            >
              <LogOut className="size-3.5" />
              Leave Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add user picker */}
      <UserPickerDialog
        confirmLabel="Add to Group"
        description="Search and select users to add to the group"
        excludeUserIds={existingMemberIds}
        onConfirm={handleAddUsers}
        onOpenChange={setShowAddUser}
        open={showAddUser}
        title="Add Members"
      />

      {/* Remove user confirmation */}
      <AlertDialog onOpenChange={(o) => !o && setRemovingUserId(null)} open={!!removingUserId}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the group? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingUserId && handleRemoveUser(removingUserId)}
              variant="destructive"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave group confirmation */}
      <AlertDialog onOpenChange={setShowLeaveConfirm} open={showLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave &quot;{groupName}&quot;? You will no longer receive
              messages from this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} variant="destructive">
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
