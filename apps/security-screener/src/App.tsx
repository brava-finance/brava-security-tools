import { useState } from 'react';

import { NetworkTabs } from './components/NetworkTabs';
import { SectionNav, type SectionId } from './components/SectionNav';
import { CHAINS, type ChainId } from './lib/config';
import { Actions } from './sections/Actions';
import { Dashboard } from './sections/Dashboard';
import { Divergence } from './sections/Divergence';
import { Pending } from './sections/Pending';
import { Pools } from './sections/Pools';
import { Roles } from './sections/Roles';
import { Timeline } from './sections/Timeline';
import { Tokens } from './sections/Tokens';
import { Verify } from './sections/Verify';

export function App() {
  const [chain, setChain] = useState<ChainId>('arbitrum');
  const [section, setSection] = useState<SectionId>('dashboard');

  return (
    <div className='mx-auto flex min-h-screen max-w-[1280px] flex-col gap-6 px-6 py-8'>
      <header className='flex flex-wrap items-center justify-between gap-4'>
        <div className='min-w-0'>
          <h1 className='text-2xl font-semibold tracking-tight'>Brava Security Screener</h1>
          <p className='mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]'>
            Static, IPFS-hostable view of the on-chain state of the Brava admin vault, roles and
            logger proxies, sourced exclusively from the open-source Brava security subgraph. Read
            the{' '}
            <a href='#verify' onClick={() => setSection('verify')}>
              Verify yourself
            </a>{' '}
            section before trusting anything you see here.
          </p>
        </div>
        <div className='flex flex-col items-end gap-2'>
          <NetworkTabs active={chain} onChange={setChain} />
          <span className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>
            chain id {CHAINS[chain].chainId}
          </span>
        </div>
      </header>

      <SectionNav active={section} onChange={setSection} />

      <main className='flex flex-col gap-6 pb-10'>
        {section === 'dashboard' && <Dashboard chain={chain} onNavigate={setSection} />}
        {section === 'actions' && <Actions chain={chain} />}
        {section === 'pools' && <Pools chain={chain} />}
        {section === 'tokens' && <Tokens chain={chain} />}
        {section === 'roles' && <Roles chain={chain} />}
        {section === 'pending' && <Pending chain={chain} />}
        {section === 'timeline' && <Timeline chain={chain} />}
        {section === 'divergence' && <Divergence chain={chain} />}
        {section === 'verify' && <Verify />}
      </main>

      <footer className='mt-auto border-t border-[var(--color-border-subtle)] pt-4 text-[11px] text-[var(--color-text-faint)]'>
        No backend. No wallet. No analytics. Source:{' '}
        <a
          href='https://github.com/brava-fi/monorepo/tree/main/apps/security-screener'
          target='_blank'
          rel='noreferrer'
        >
          github.com/brava-fi/monorepo/apps/security-screener
        </a>
      </footer>
    </div>
  );
}
