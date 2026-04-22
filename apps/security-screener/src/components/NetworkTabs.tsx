import { CHAINS, CHAIN_ORDER, type ChainId } from '../lib/config';
import { cn } from '../lib/format';

interface NetworkTabsProps {
  active: ChainId;
  onChange: (chain: ChainId) => void;
}

export function NetworkTabs({ active, onChange }: NetworkTabsProps) {
  return (
    <div
      role='tablist'
      className='inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-1'
    >
      {CHAIN_ORDER.map((id) => {
        const isActive = active === id;
        const tabClass = cn(
          'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          isActive
            ? 'bg-[var(--color-bg-hover)] text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        );
        return (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={isActive}
            className={tabClass}
            onClick={() => onChange(id)}
          >
            {CHAINS[id].label}
          </button>
        );
      })}
    </div>
  );
}
