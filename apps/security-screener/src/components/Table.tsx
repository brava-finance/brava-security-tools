import type { ReactNode } from 'react';

import { cn } from '../lib/format';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  // Optional header-only class (e.g. right-align a number column).
  headerClassName?: string;
}

interface TableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  empty?: ReactNode;
  className?: string;
  // Optional per-row class hook for flagging incomplete/suspicious rows
  // (e.g. unresolved protocol, missing on-chain metadata) so sections can
  // surface them for manual review without duplicating table markup.
  rowClassName?: (row: T) => string | undefined;
  rowTitle?: (row: T) => string | undefined;
}

export function Table<T>({
  columns,
  rows,
  getRowKey,
  empty,
  className,
  rowClassName,
  rowTitle,
}: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className='px-4 py-6 text-xs text-[var(--color-text-faint)]'>{empty ?? 'No rows'}</div>
    );
  }
  return (
    // Below `md`, allow the table to scroll horizontally inside its wrapper
    // — at that viewport the sticky header is a non-goal anyway. At `md`
    // and up we drop the scroll container entirely so `<thead>` can be
    // sticky relative to the page viewport (Card uses `overflow: clip` so
    // it doesn't establish a scroll container either).
    <div className={cn('max-md:overflow-x-auto', className)}>
      <table className='w-full text-left text-xs'>
        {/* Sticky header: stays glued to the top of the page viewport,
            offset just below the section-nav bar (~44px tall) so the
            column labels remain visible while scrolling long tables. */}
        <thead className='sticky top-11 z-[5] bg-[var(--color-bg-raised)] shadow-[inset_0_-1px_0_var(--color-border-subtle)] backdrop-blur'>
          <tr className='text-[var(--color-text-faint)]'>
            {columns.map((col) => (
              <th
                key={col.key}
                scope='col'
                className={cn(
                  'px-3 py-2.5 font-medium uppercase tracking-wide text-[10px]',
                  col.headerClassName ?? col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const extraRowClass = rowClassName?.(row);
            const title = rowTitle?.(row);
            return (
              <tr
                key={getRowKey(row)}
                title={title}
                className={cn(
                  'border-b border-[var(--color-border-subtle)] last:border-b-0 transition-colors hover:bg-[var(--color-bg-hover)]',
                  extraRowClass
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-2.5 align-top', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
