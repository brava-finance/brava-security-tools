import { cn } from '../lib/format';

export type SectionId =
  | 'dashboard'
  | 'actions'
  | 'pools'
  | 'tokens'
  | 'roles'
  | 'pending'
  | 'timeline'
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
  { id: 'pending', label: 'Pending proposals' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'divergence', label: 'Divergence check' },
  { id: 'verify', label: 'Verify yourself' },
];

interface SectionNavProps {
  active: SectionId;
  onChange: (section: SectionId) => void;
}

export function SectionNav({ active, onChange }: SectionNavProps) {
  return (
    <nav className='flex flex-wrap gap-1 border-b border-[var(--color-border-subtle)] pb-2'>
      {SECTIONS.map((s) => {
        const isActive = s.id === active;
        const btnClass = cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-[var(--color-bg-hover)] text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text)]'
        );
        return (
          <button key={s.id} type='button' className={btnClass} onClick={() => onChange(s.id)}>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
