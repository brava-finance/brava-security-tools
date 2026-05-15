import { useState } from 'react';

import { NetworkTabs } from './components/NetworkTabs';
import { SectionNav, type SectionId } from './components/SectionNav';
import { useMultiDashboardData } from './hooks/useSubgraphData';
import { VIEW_META, type ViewId } from './lib/config';
import { formatRelative, formatTimestamp } from './lib/format';
import { Actions } from './sections/Actions';
import { Dashboard } from './sections/Dashboard';
import { Divergence } from './sections/Divergence';
import { Governance } from './sections/Governance';
import { Pending } from './sections/Pending';
import { Pools } from './sections/Pools';
import { Roles } from './sections/Roles';
import { Timeline } from './sections/Timeline';
import { Tokens } from './sections/Tokens';
import { Verify } from './sections/Verify';

export function App() {
  const [view, setView] = useState<ViewId>('all');
  const [section, setSection] = useState<SectionId>('dashboard');
  // Surface "data last refreshed" in the header so users can tell at a glance
  // whether the site is alive or showing stale subgraph data. Sharing this
  // hook with the Dashboard is intentional — react-query deduplicates the
  // fetch, so this read is free.
  const headerData = useMultiDashboardData(view);
  const dataUpdatedAt = headerData.dataUpdatedAt;

  return (
    <div className='mx-auto flex min-h-screen max-w-[1280px] flex-col gap-6 px-6 py-8'>
      <header className='flex flex-col gap-5'>
        <div className='flex flex-wrap items-start justify-between gap-6'>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-3'>
              <img
                src={`${import.meta.env.BASE_URL}logos/brava-full-dark-mode.svg`}
                alt='Brava'
                width={203}
                height={32}
                className='h-8 w-auto select-none'
                draggable={false}
              />
              <span
                aria-hidden='true'
                className='hidden h-6 w-px bg-[var(--color-border)] sm:inline-block'
              />
              <span className='text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)]'>
                Security Screener
              </span>
            </div>
            <p className='mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]'>
              Static, IPFS-hostable view of the on-chain state of the Brava admin vault, roles and
              logger proxies — sourced exclusively from the open-source Brava security subgraph.
              Read the{' '}
              <a href='#verify' onClick={() => setSection('verify')}>
                Verify yourself
              </a>{' '}
              section before trusting anything you see here.
            </p>
          </div>
          <div className='flex flex-col items-end gap-2'>
            <NetworkTabs active={view} onChange={setView} />
            <span className='text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]'>
              viewing {VIEW_META[view].label}
            </span>
            <DataFreshness
              updatedAtMs={dataUpdatedAt}
              isLoading={headerData.isLoading}
              isPartial={headerData.isPartial}
            />
          </div>
        </div>
      </header>

      <SectionNav active={section} onChange={setSection} />

      <main className='flex flex-col gap-6 pb-10'>
        {section === 'dashboard' && <Dashboard view={view} onNavigate={setSection} />}
        {section === 'actions' && <Actions view={view} />}
        {section === 'pools' && <Pools view={view} />}
        {section === 'tokens' && <Tokens view={view} />}
        {section === 'roles' && <Roles view={view} />}
        {section === 'pending' && <Pending view={view} />}
        {section === 'timeline' && <Timeline view={view} />}
        {section === 'governance' && <Governance view={view} />}
        {section === 'divergence' && <Divergence view={view} />}
        {section === 'verify' && <Verify />}
      </main>

      <footer className='mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] pt-4 text-[11px] text-[var(--color-text-faint)]'>
        <span>No backend. No wallet. No analytics.</span>
        <span>
          Source:{' '}
          <a
            href='https://github.com/brava-finance/brava-security-tools'
            target='_blank'
            rel='noreferrer'
          >
            github.com/brava-finance/brava-security-tools
          </a>
        </span>
      </footer>
    </div>
  );
}

function DataFreshness({
  updatedAtMs,
  isLoading,
  isPartial,
}: {
  updatedAtMs: number | undefined;
  isLoading: boolean;
  isPartial: boolean;
}) {
  if (isLoading && updatedAtMs === undefined) {
    return (
      <span className='text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]'>
        data: fetching…
      </span>
    );
  }
  if (updatedAtMs === undefined) {
    return (
      <span className='text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]'>
        data: unknown
      </span>
    );
  }
  // Anything within the last ~5s gets a "just now" label rather than the raw
  // "0s ago" — the latter reads as if the data hasn't moved, which is
  // confusing right after a fetch completes.
  const ageMs = Date.now() - updatedAtMs;
  const seconds = Math.floor(updatedAtMs / 1000);
  const label = ageMs < 5_000 ? 'just now' : formatRelative(seconds);
  return (
    <span
      className='text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]'
      title={`Subgraph last responded at ${formatTimestamp(seconds)}`}
    >
      data updated {label}
      {isPartial ? ' · partial' : ''}
    </span>
  );
}
