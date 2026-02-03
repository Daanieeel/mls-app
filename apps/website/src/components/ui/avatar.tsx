'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const avatarVariants = cva('relative flex shrink-0 overflow-hidden rounded-full', {
  variants: {
    size: {
      xs: 'size-6',
      sm: 'size-8',
      default: 'size-10',
      lg: 'size-12',
      xl: 'size-14',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  fallback?: string;
}

function Avatar({ className, size, src, alt, fallback, ...props }: AvatarProps) {
  const initials = fallback
    ? fallback
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  return (
    <div className={cn(avatarVariants({ size, className }))} data-slot="avatar" {...props}>
      {src ? (
        <div
          aria-label={alt ?? 'Avatar'}
          className="aspect-square size-full bg-center bg-cover"
          role="img"
          style={{ backgroundImage: `url(${src})` }}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted font-medium text-muted-foreground text-xs">
          {initials}
        </div>
      )}
    </div>
  );
}

export { Avatar, avatarVariants };
