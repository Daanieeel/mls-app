'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const scrollAreaVariants = cva('relative overflow-hidden', {
  variants: {
    orientation: {
      vertical: 'overflow-y-auto',
      horizontal: 'overflow-x-auto',
      both: 'overflow-auto',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});

interface ScrollAreaProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof scrollAreaVariants> {}

function ScrollArea({ className, orientation, children, ...props }: ScrollAreaProps) {
  return (
    <div
      className={cn(
        scrollAreaVariants({ orientation, className }),
        // Custom scrollbar styling
        'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40',
      )}
      data-slot="scroll-area"
      {...props}
    >
      {children}
    </div>
  );
}

export { ScrollArea, scrollAreaVariants };
