import type { ReactNode } from 'react';

import { cn } from '../lib/format';

type TagVariant = 'ok' | 'warn' | 'bad' | 'neutral' | 'accent';

const VARIANT_CLASS: Record<TagVariant, string> = {
  ok: 'bg-[color-mix(in_srgb,var(--color-ok)_16%,transparent)] text-[var(--color-ok)] border-[color-mix(in_srgb,var(--color-ok)_35%,transparent)]',
  warn: 'bg-[color-mix(in_srgb,var(--color-warn)_16%,transparent)] text-[var(--color-warn)] border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)]',
  bad: 'bg-[color-mix(in_srgb,var(--color-bad)_16%,transparent)] text-[var(--color-bad)] border-[color-mix(in_srgb,var(--color-bad)_35%,transparent)]',
  accent:
    'bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[var(--color-accent)] border-[color-mix(in_srgb,var(--color-accent)_35%,transparent)]',
  neutral:
    'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
};

interface TagProps {
  variant?: TagVariant;
  children: ReactNode;
  className?: string;
}

export function Tag({ variant = 'neutral', children, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium tracking-wide uppercase',
        VARIANT_CLASS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
