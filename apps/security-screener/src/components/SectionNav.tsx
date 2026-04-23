import type { ReactElement } from 'react';

import { cn } from '../lib/format';

export type SectionId =
  | 'dashboard'
  | 'actions'
  | 'pools'
  | 'tokens'
  | 'roles'
  | 'pending'
  | 'timeline'
  | 'governance'
  | 'divergence'
  | 'verify';

export interface SectionDef {
  id: SectionId;
  label: string;
}

export const SECTIONS: SectionDef[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'actions', label: 'Actions' },
  { id: 'pools', label: 'Pools' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'roles', label: 'Roles' },
  { id: 'pending', label: 'Pending' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'governance', label: 'Governance' },
  { id: 'divergence', label: 'Divergence' },
  { id: 'verify', label: 'Verify' },
];

// Inline SVGs keep the bundle tiny and stay crisp at any zoom level. Each
// icon is a single outline path sized to match the 14px section nav text.
type IconKey = SectionId;
const ICONS: Record<IconKey, ReactElement> = {
  dashboard: (
    <path d='M3 12 12 4l9 8M5 10v10h14V10M10 20v-6h4v6' />
  ),
  actions: (
    <path d='M13 2 4 14h7l-1 8 9-12h-7l1-8Z' />
  ),
  pools: (
    <path d='M3 10c3 2 6-2 9 0s6-2 9 0M3 16c3 2 6-2 9 0s6-2 9 0M3 4c3 2 6-2 9 0s6-2 9 0' />
  ),
  tokens: (
    <>
      <circle cx='12' cy='12' r='8' />
      <path d='M12 7v10M9 10h5a2 2 0 0 1 0 4H9' />
    </>
  ),
  roles: (
    <>
      <circle cx='9' cy='8' r='3' />
      <path d='M2.5 20c.7-3.2 3.4-5 6.5-5s5.8 1.8 6.5 5' />
      <path d='M16 11a3 3 0 1 0 0-6' />
      <path d='M17 20c-.2-2-1.2-3.8-2.7-5' />
    </>
  ),
  pending: (
    <>
      <circle cx='12' cy='12' r='9' />
      <path d='M12 7v5l3 2' />
    </>
  ),
  timeline: (
    <>
      <path d='M4 6h16M4 12h10M4 18h16' />
      <circle cx='20' cy='12' r='2' />
    </>
  ),
  governance: (
    <>
      <path d='M4 21h16M6 21V9m12 12V9M4 9h16M10 9V5h4v4' />
      <path d='M9 13v4M15 13v4' />
    </>
  ),
  divergence: (
    <path d='M4 6h6l4 6-4 6H4M14 6h6l-4 6 4 6h-6' />
  ),
  verify: (
    <>
      <path d='M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z' />
      <path d='m9 12 2 2 4-4' />
    </>
  ),
};

function Icon({ id }: { id: IconKey }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      width='14'
      height='14'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      {ICONS[id]}
    </svg>
  );
}

interface SectionNavProps {
  active: SectionId;
  onChange: (section: SectionId) => void;
}

export function SectionNav({ active, onChange }: SectionNavProps) {
  return (
    <nav
      className='sticky top-0 z-10 -mx-6 flex flex-wrap gap-1 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/80 px-6 py-2 backdrop-blur'
      aria-label='Screener sections'
    >
      {SECTIONS.map((s) => {
        const isActive = s.id === active;
        const btnClass = cn(
          'group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-[var(--color-bg-hover)] text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text)]'
        );
        return (
          <button key={s.id} type='button' className={btnClass} onClick={() => onChange(s.id)}>
            <Icon id={s.id} />
            <span>{s.label}</span>
            {isActive && (
              <span
                aria-hidden='true'
                className='absolute inset-x-2 -bottom-[9px] h-[2px] rounded-full bg-[var(--color-accent)]'
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
