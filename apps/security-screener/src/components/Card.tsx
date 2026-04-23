import type { ReactNode } from 'react';

import { cn } from '../lib/format';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  // Optional coloured accent strip on the left edge — use to signal a card's
  // chain association or severity without adding a full badge.
  accent?: string;
  // Dense variant removes inner padding so tables can sit flush. The header
  // padding is preserved.
  dense?: boolean;
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  accent,
  dense = false,
}: CardProps) {
  const hasHeader = title !== undefined || subtitle !== undefined || actions !== undefined;
  const bodyClass = dense ? '' : 'px-4 py-3';
  return (
    <section
      className={cn(
        'relative card-raised overflow-hidden transition-colors hover:border-[var(--color-border)]',
        className
      )}
    >
      {accent !== undefined && (
        <span
          aria-hidden='true'
          className='absolute inset-y-0 left-0 w-[3px]'
          style={{
            background: `linear-gradient(180deg, ${accent}, ${accent}00)`,
          }}
        />
      )}
      {hasHeader && (
        <header className='flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3'>
          <div className='min-w-0'>
            {title !== undefined && (
              <h3 className='text-sm font-semibold tracking-tight text-[var(--color-text)]'>
                {title}
              </h3>
            )}
            {subtitle !== undefined && (
              <p className='mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]'>
                {subtitle}
              </p>
            )}
          </div>
          {actions !== undefined && (
            <div className='flex shrink-0 items-center gap-2'>{actions}</div>
          )}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
