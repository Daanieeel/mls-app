'use client';

import { Check, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApi } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface UserPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (users: User[]) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Users to exclude from the search results */
  excludeUserIds?: string[];
  /** Allow selecting multiple users */
  multiple?: boolean;
  /** Minimum number of users to select */
  minSelection?: number;
}

export function UserPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Select Users',
  description = 'Search and select users to add',
  confirmLabel = 'Confirm',
  excludeUserIds = [],
  multiple = true,
  minSelection = 1,
}: UserPickerDialogProps) {
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.users.search.get({
          query: { q: searchQuery || undefined, limit: 20 },
        });
        if (data) {
          const filtered = (data as User[]).filter((u) => !excludeUserIds.includes(u.id));
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, open, api, excludeUserIds]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedUsers([]);
      setSearchResults([]);
    }
  }, [open]);

  const toggleUser = useCallback(
    (user: User) => {
      setSelectedUsers((prev) => {
        const isSelected = prev.some((u) => u.id === user.id);
        if (isSelected) {
          return prev.filter((u) => u.id !== user.id);
        }
        if (!multiple) {
          return [user];
        }
        return [...prev, user];
      });
    },
    [multiple],
  );

  const removeUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedUsers);
    onOpenChange(false);
  }, [selectedUsers, onConfirm, onOpenChange]);

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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            value={searchQuery}
          />
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
        <ScrollArea className="max-h-64">
          <div className="flex flex-col gap-0.5">
            {isSearching && searchResults.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
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
                      <span className="truncate font-medium text-sm">{user.name || 'No name'}</span>
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
            disabled={selectedUsers.length < minSelection}
            onClick={handleConfirm}
            size="default"
          >
            {confirmLabel}
            {selectedUsers.length > 0 && ` (${selectedUsers.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
