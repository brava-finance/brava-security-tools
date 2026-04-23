import { CHAINS, type ChainId } from '../lib/config';
import { cn } from '../lib/format';

interface ChainBadgeProps {
  chain: ChainId;
  // `full` includes the full label, `short` uses the compact label, `dot` is
  // a coloured dot only (useful in dense table cells).
  variant?: 'full' | 'short' | 'dot';
  className?: string;
}

// Small, chain-coloured chip used in tables, timeline entries and stat
// footers. Keeps multi-chain rows readable at a glance without having to
// look at an address column.
export function ChainBadge({ chain, variant = 'short', className }: ChainBadgeProps) {
  const cfg = CHAINS[chain];
  if (variant === 'dot') {
    return (
      <span
        aria-label={cfg.label}
        title={cfg.label}
        className={cn('inline-block h-2 w-2 rounded-full', className)}
        style={{ backgroundColor: cfg.color, boxShadow: `0 0 0 2px ${cfg.color}22` }}
      />
    );
  }
  const label = variant === 'full' ? cfg.label : cfg.shortLabel;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        className
      )}
      style={{
        color: cfg.color,
        backgroundColor: `${cfg.color}14`,
        borderColor: `${cfg.color}33`,
      }}
      title={cfg.label}
    >
      <span
        aria-hidden='true'
        className='inline-block h-1.5 w-1.5 rounded-full'
        style={{ backgroundColor: cfg.color }}
      />
      {label}
    </span>
  );
}
