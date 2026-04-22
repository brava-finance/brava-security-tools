import type { ReactNode } from 'react';

import { cn } from '../lib/format';

type TagVariant = 'ok' | 'warn' | 'bad' | 'neutral' | 'accent';

const VARIANT_CLASS: Record<TagVariant, string> = {
  ok: 'bg-[color-mix(in_srgb,var(--color-ok)_14%,transparent)] text-[var(--color-ok)] border-[color-mix(in_srgb,var(--color-ok)_30%,transparent)]',
  warn: 'bg-[color-mix(in_srgb,var(--color-warn)_14%,transparent)] text-[var(--color-warn)] border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)]',
  bad: 'bg-[color-mix(in_srgb,var(--color-bad)_14%,transparent)] text-[var(--color-bad)] border-[color-mix(in_srgb,var(--color-bad)_30%,transparent)]',
  accent:
    'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)] border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]',
  neutral: 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]',
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
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase',
        VARIANT_CLASS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
