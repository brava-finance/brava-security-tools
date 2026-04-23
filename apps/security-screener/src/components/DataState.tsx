import type { ReactNode } from 'react';

import { cn } from '../lib/format';

interface BaseProps {
  className?: string;
}

export function Loading({ className, label = 'Loading…' }: BaseProps & { label?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 card-raised px-4 py-3 text-xs text-[var(--color-text-muted)]',
        className
      )}
    >
      <span className='relative inline-flex h-2.5 w-2.5'>
        <span
          className='absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-70'
          style={{ animation: 'pulse-ring 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
        />
        <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]' />
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
        'rounded-xl border border-[color-mix(in_srgb,var(--color-bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] px-4 py-3 text-xs leading-relaxed text-[var(--color-bad)]',
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
        'rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-raised)]/40 px-4 py-6 text-center text-xs text-[var(--color-text-faint)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PartialWarning({ className }: BaseProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-warn)]',
        className
      )}
    >
      <span className='relative inline-flex h-1.5 w-1.5'>
        <span
          className='absolute inline-flex h-full w-full rounded-full bg-[var(--color-warn)] opacity-70'
          style={{ animation: 'pulse-ring 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
        />
        <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-warn)]' />
      </span>
      Some chains still loading
    </div>
  );
}
