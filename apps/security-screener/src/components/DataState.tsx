import type { ReactNode } from 'react';

import { cn } from '../lib/format';

interface BaseProps {
  className?: string;
}

export function Loading({ className, label = 'Loading…' }: BaseProps & { label?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-raised)] px-3 py-2 text-xs text-[var(--color-text-muted)]',
        className
      )}
    >
      <span className='relative inline-flex h-2 w-2'>
        <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-50' />
        <span className='relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]' />
      </span>
      {label}
    </div>
  );
}

export function ErrorPane({ className, error }: BaseProps & { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      className={cn(
        'rounded-md border border-[color-mix(in_srgb,var(--color-bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] px-3 py-2 text-xs text-[var(--color-bad)]',
        className
      )}
    >
      <strong className='font-semibold'>Subgraph error:</strong> {message}
    </div>
  );
}

export function Empty({ className, children }: BaseProps & { children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-text-faint)]',
        className
      )}
    >
      {children}
    </div>
  );
}
