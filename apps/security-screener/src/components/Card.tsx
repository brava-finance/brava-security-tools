import type { ReactNode } from 'react';

import { cn } from '../lib/format';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, actions, children, className }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] overflow-hidden',
        className
      )}
    >
      {(title !== undefined || subtitle !== undefined || actions !== undefined) && (
        <header className='flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3'>
          <div className='min-w-0'>
            {title !== undefined && (
              <h3 className='text-sm font-semibold text-[var(--color-text)]'>{title}</h3>
            )}
            {subtitle !== undefined && (
              <p className='mt-0.5 text-xs text-[var(--color-text-muted)]'>{subtitle}</p>
            )}
          </div>
          {actions !== undefined && (
            <div className='flex shrink-0 items-center gap-2'>{actions}</div>
          )}
        </header>
      )}
      <div className='px-4 py-3'>{children}</div>
    </section>
  );
}
