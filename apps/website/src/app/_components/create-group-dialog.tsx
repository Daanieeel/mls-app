'use client';

import { Check, Search, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApi, useAuth } from '@/lib/auth';
import { createWelcomeForNewGroup, reKeyGroupState } from '@/lib/chat/mls';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface KeyPackagesClaimBatchApi {
  'claim-batch': {
    post: (body: { userIds: string[] }) => Promise<{
      data?: Array<{ userId: string; keyPackage: { payload: string } | null }>;
    }>;
  };
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated?: () => void;
}

export function CreateGroupDialog({ open, onOpenChange, onGroupCreated }: CreateGroupDialogProps) {
  const api = useApi();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced user search
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.users.search.get({
          query: { q: searchQuery || undefined, limit: 20 },
        });
        if (data) {
          setSearchResults(data as User[]);
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, open, api]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setGroupName('');
      setSearchQuery('');
      setSelectedUsers([]);
      setSearchResults([]);
      setError(null);
    }
  }, [open]);

  const toggleUser = useCallback((user: User) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.id === user.id);
      if (isSelected) return prev.filter((u) => u.id !== user.id);
      return [...prev, user];
    });
  }, []);

  const removeUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const isSelected = useCallback(
    (userId: string) => selectedUsers.some((u) => u.id === userId),
    [selectedUsers],
  );

  const getInitials = (user: User) => {
    if (user.name) {
      return user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedUsers.length === 0) return;

    setIsCreating(true);
    setError(null);

    try {
      if (!user?.id) {
        setError('Missing authenticated user context');
        return;
      }

      const keyPackagesApi = (api as unknown as { 'key-packages'?: KeyPackagesClaimBatchApi })[
        'key-packages'
      ];
      if (!keyPackagesApi) {
        setError('Key package API unavailable');
        return;
      }

      const claimResponse = await keyPackagesApi['claim-batch'].post({
        userIds: selectedUsers.map((selectedUser) => selectedUser.id),
      });

      const claimed = claimResponse?.data ?? [];

      const missing = claimed.filter((entry) => !entry.keyPackage).map((entry) => entry.userId);
      if (missing.length > 0) {
        setError('Some users do not have uploaded MLS key packages yet');
        return;
      }

      const tempGroupId = crypto.randomUUID();
      const welcomePayload = await createWelcomeForNewGroup({
        groupId: tempGroupId,
        creatorUserId: user.id,
        memberKeyPackagePayloads: claimed
          .map((entry) => entry.keyPackage?.payload)
          .filter((payload): payload is string => Boolean(payload)),
      });

      const { data: createdGroup, error: apiError } = await api.groups.index.post({
        options: {
          name: groupName.trim(),
          memberIds: selectedUsers.map((u) => u.id),
        },
        welcomeMessage: {
          payload: welcomePayload,
          nonce: crypto.randomUUID().replace(/-/g, ''),
          type: 'WELCOME',
        },
      });

      if (apiError || !createdGroup) {
        setError('Failed to create group');
        return;
      }

      // Re-key the MLS state from the temp UUID to the server-assigned group ID
      const serverGroupId = (createdGroup as { id: string }).id;
      reKeyGroupState(tempGroupId, serverGroupId);

      onGroupCreated?.();
      onOpenChange(false);
    } catch (_err) {
      setError('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>Name your group and select members to add</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Group name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              required
              value={groupName}
            />
          </div>

          {/* User search */}
          <div className="flex flex-col gap-2">
            <Label>Members</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email..."
                value={searchQuery}
              />
            </div>
          </div>

          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => (
                <Badge className="gap-1 pr-1" key={user.id} variant="secondary">
                  <span className="max-w-24 truncate">{user.name || user.email}</span>
                  <button
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    onClick={() => removeUser(user.id)}
                    type="button"
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* User list */}
          <ScrollArea className="max-h-48">
            <div className="flex flex-col gap-0.5">
              {isSearching && searchResults.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  {searchQuery ? 'No users found' : 'Start typing to search users'}
                </div>
              ) : (
                searchResults.map((user) => {
                  const selected = isSelected(user.id);
                  return (
                    <button
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                        'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                        selected && 'bg-accent',
                      )}
                      key={user.id}
                      onClick={() => toggleUser(user)}
                      type="button"
                    >
                      <Avatar fallback={getInitials(user)} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-sm">
                          {user.name || 'No name'}
                        </span>
                        <span className="truncate text-muted-foreground text-xs">{user.email}</span>
                      </div>
                      {selected && (
                        <div className="flex size-5 items-center justify-center rounded-full bg-primary">
                          <Check className="size-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <DialogClose render={<Button size="default" variant="outline" />}>Cancel</DialogClose>
            <Button
              disabled={isCreating || !groupName.trim() || selectedUsers.length === 0}
              size="default"
              type="submit"
            >
              {isCreating ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
