import { CHAINS, VIEW_META, VIEW_ORDER, type ViewId } from '../lib/config';
import { cn } from '../lib/format';

interface NetworkTabsProps {
  active: ViewId;
  onChange: (view: ViewId) => void;
}

// The `All` pill shows a tri-coloured dot to make it obvious it aggregates
// every indexed chain; single-chain pills use their own accent colour.
const ALL_CHAIN_COLORS: string[] = Object.values(CHAINS).map((c) => c.color);

export function NetworkTabs({ active, onChange }: NetworkTabsProps) {
  return (
    <div
      role='tablist'
      aria-label='Chain view'
      className='inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-1 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]'
    >
      {VIEW_ORDER.map((id) => {
        const meta = VIEW_META[id];
        const isActive = active === id;
        const isAll = id === 'all';
        const accent = isAll ? 'var(--color-accent)' : CHAINS[id].color;

        const buttonClass = cn(
          'group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
          isActive
            ? 'bg-[var(--color-bg-hover)] text-[var(--color-text)] shadow-[0_1px_2px_rgba(0,0,0,0.35)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]'
        );

        return (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={isActive}
            className={buttonClass}
            onClick={() => onChange(id)}
            style={isActive ? { boxShadow: `inset 0 0 0 1px ${accent}33` } : undefined}
          >
            {isAll ? <TriChainDot colors={ALL_CHAIN_COLORS} /> : <ChainDot color={accent} />}
            <span>{meta.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChainDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden='true'
      className='inline-block h-1.5 w-1.5 rounded-full'
      style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}22` }}
    />
  );
}

function TriChainDot({ colors }: { colors: string[] }) {
  // Three overlapping dots give the `All` button a clear visual cue that it
  // aggregates every chain.
  return (
    <span aria-hidden='true' className='relative inline-flex h-2 w-5 items-center'>
      {colors.map((c, i) => (
        <span
          key={c}
          className='absolute inline-block h-2 w-2 rounded-full'
          style={{
            left: `${i * 6}px`,
            backgroundColor: c,
            boxShadow: `0 0 0 1.5px var(--color-bg-raised)`,
          }}
        />
      ))}
    </span>
  );
}
