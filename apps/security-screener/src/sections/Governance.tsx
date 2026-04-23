import { useMemo, useState } from 'react';

import { Card } from '../components/Card';
import { ChainBadge } from '../components/ChainBadge';
import { Empty, ErrorPane, Loading, PartialWarning } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table, type Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useMultiDashboardData } from '../hooks/useSubgraphData';
import type { ChainResult } from '../hooks/useSubgraphData';
import { CHAINS, chainsForView, type ChainId, type ViewId } from '../lib/config';
import {
  adminTransfersForRole,
  safeCurrentState,
  safeEventsFor,
  summarizeEndOwners,
  type AdminTransferRow,
  type ChainTagged,
  type OwnerSafeSummary,
  type ProxyOwnerRole,
} from '../lib/derive';
import type { DashboardResponse } from '../lib/queries';
import { cn, formatRelative, formatTimestamp, shortAddress } from '../lib/format';
import type { SafeEventEntity, SafeEventKind } from '../types/entities';

interface Props {
  view: ViewId;
}

type GovernanceTab = 'transfers' | 'owner-safe';
type TransferFilter = ProxyOwnerRole | 'all';

const TAB_LABELS: Record<GovernanceTab, string> = {
  transfers: 'Admin transfers',
  'owner-safe': 'Owner safe',
};

const ROLE_LABEL: Record<TransferFilter, string> = {
  all: 'All proxies',
  LoggerProxyAdmin: 'Logger proxy admin',
  SafeDeploymentProxyAdmin: 'Safe-deployment proxy admin',
};

export function Governance({ view }: Props) {
  const dashboard = useMultiDashboardData(view);
  const [tab, setTab] = useState<GovernanceTab>('transfers');

  if (dashboard.isLoading) return <Loading />;
  if (dashboard.error !== null && dashboard.chains.length === 0) {
    return <ErrorPane error={dashboard.error} />;
  }

  return (
    <section className='flex flex-col gap-4'>
      {dashboard.error !== null && <PartialWarning />}
      <TabBar tab={tab} onChange={setTab} />
      {tab === 'transfers' && <AdminTransfersTab chains={dashboard.chains} view={view} />}
      {tab === 'owner-safe' && <OwnerSafeTab chains={dashboard.chains} view={view} />}
    </section>
  );
}

function TabBar({
  tab,
  onChange,
}: {
  tab: GovernanceTab;
  onChange: (t: GovernanceTab) => void;
}) {
  const tabs: GovernanceTab[] = ['transfers', 'owner-safe'];
  return (
    <div className='flex gap-1 border-b border-[var(--color-border-subtle)]'>
      {tabs.map((t) => {
        const isActive = t === tab;
        const btnClass = cn(
          'relative px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        );
        return (
          <button key={t} type='button' className={btnClass} onClick={() => onChange(t)}>
            {TAB_LABELS[t]}
            {isActive && (
              <span
                aria-hidden='true'
                className='absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--color-accent)]'
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- Admin transfers tab --------------------------------------------------

type TaggedTransferRow = ChainTagged<AdminTransferRow>;

function AdminTransfersTab({
  chains,
  view,
}: {
  chains: Array<ChainResult<DashboardResponse>>;
  view: ViewId;
}) {
  const [filter, setFilter] = useState<TransferFilter>('all');
  const chainIds = chainsForView(view);
  const isMulti = chainIds.length > 1;

  const rows = useMemo(() => {
    const out: TaggedTransferRow[] = [];
    for (const { chain, data } of chains) {
      for (const row of adminTransfersForRole(data, filter)) {
        out.push({ ...row, chain });
      }
    }
    out.sort((a, b) => {
      const diff = BigInt(b.blockNumber) - BigInt(a.blockNumber);
      if (diff > 0n) return 1;
      if (diff < 0n) return -1;
      return b.txHash.localeCompare(a.txHash);
    });
    return out;
  }, [chains, filter]);

  const columns: Array<Column<TaggedTransferRow>> = useMemo(() => {
    const base: Array<Column<TaggedTransferRow>> = [];
    if (isMulti) {
      base.push({
        key: 'chain',
        header: 'Chain',
        render: (r) => <ChainBadge chain={r.chain} variant='short' />,
        className: 'w-[84px]',
      });
    }
    base.push(
      {
        key: 'role',
        header: 'Role',
        render: (r) => <RoleTag role={r.role} />,
      },
      {
        key: 'admin',
        header: 'Proxy admin',
        render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.proxyAdmin} />,
      },
      {
        key: 'previous',
        header: 'Previous owner',
        render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.previousOwner} />,
      },
      {
        key: 'new',
        header: 'New owner',
        render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.newOwner} />,
      },
      {
        key: 'when',
        header: 'When',
        render: (r) => (
          <span className='whitespace-nowrap' title={formatTimestamp(r.blockTimestamp)}>
            {formatRelative(r.blockTimestamp)}
          </span>
        ),
      },
      {
        key: 'tx',
        header: 'Tx',
        render: (r) => <TxLink chain={CHAINS[r.chain]} txHash={r.txHash} />,
      }
    );
    return base;
  }, [isMulti]);

  const subtitle =
    filter === 'all'
      ? 'Every ProxyAdmin.OwnershipTransferred event observed on Brava proxies across the selected chains.'
      : `Ownership transfers on the ${ROLE_LABEL[filter].toLowerCase()} contract(s).`;

  return (
    <Card title='Admin ownership transfers' subtitle={subtitle}>
      <div className='flex flex-col gap-3'>
        <FilterPills filter={filter} onChange={setFilter} />
        <Table
          columns={columns}
          rows={rows}
          getRowKey={(r) => `${r.chain}:${r.key}`}
          empty={<Empty>No ownership transfers match the current filter.</Empty>}
        />
      </div>
    </Card>
  );
}

function FilterPills({
  filter,
  onChange,
}: {
  filter: TransferFilter;
  onChange: (next: TransferFilter) => void;
}) {
  const values: TransferFilter[] = ['all', 'LoggerProxyAdmin', 'SafeDeploymentProxyAdmin'];
  return (
    <div className='flex flex-wrap gap-1 text-xs'>
      {values.map((v) => {
        const isActive = v === filter;
        const cls = cn(
          'rounded-full border px-3 py-1 transition-colors',
          isActive
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]'
            : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text)]'
        );
        return (
          <button key={v} type='button' className={cls} onClick={() => onChange(v)}>
            {ROLE_LABEL[v]}
          </button>
        );
      })}
    </div>
  );
}

function RoleTag({ role }: { role: ProxyOwnerRole }) {
  const label = role === 'LoggerProxyAdmin' ? 'Logger' : 'Safe-deployment';
  const variant = role === 'LoggerProxyAdmin' ? 'accent' : 'warn';
  return <Tag variant={variant}>{label}</Tag>;
}

// ---- Owner safe tab -------------------------------------------------------

function OwnerSafeTab({
  chains,
  view,
}: {
  chains: Array<ChainResult<DashboardResponse>>;
  view: ViewId;
}) {
  const summaries = useMemo(() => {
    const perChain = chains.map(({ chain, data }) => ({
      chain,
      data,
      bootstraps: {
        LoggerProxyAdmin: CHAINS[chain].contracts.LoggerProxyAdmin,
        SafeDeploymentProxyAdmin: CHAINS[chain].contracts.SafeDeploymentProxyAdmin,
      } as Record<ProxyOwnerRole, string | undefined>,
    }));
    return summarizeEndOwners(perChain);
  }, [chains]);

  if (summaries.length === 0) {
    return (
      <Card title='Owner safes'>
        <Empty>
          No end-owner addresses observed yet. The subgraph discovers owners by following
          `ProxyAdmin.OwnershipTransferred` events — once it's synced past the bootstrap admin,
          owners will appear here.
        </Empty>
      </Card>
    );
  }

  const distinctCount = summaries.length;
  const viewChains = chainsForView(view);
  const firstChain = viewChains[0];
  const viewScope =
    viewChains.length > 1 || firstChain === undefined
      ? 'across all selected chains'
      : `on ${CHAINS[firstChain].label}`;
  const divergenceBadge =
    distinctCount > 1 ? (
      <Tag variant='bad'>
        {distinctCount} distinct end owners — normally there should be exactly one
      </Tag>
    ) : (
      <Tag variant='ok'>Single end owner {viewScope}</Tag>
    );

  return (
    <div className='flex flex-col gap-4'>
      <Card title='End-owner governance' subtitle={`ProxyAdmin owner discovered by following on-chain OwnershipTransferred events ${viewScope}.`}>
        <div className='flex items-center gap-2'>{divergenceBadge}</div>
      </Card>
      {summaries.map((s) => (
        <OwnerSafeCard key={s.address.toLowerCase()} summary={s} chains={chains} />
      ))}
    </div>
  );
}

function OwnerSafeCard({
  summary,
  chains,
}: {
  summary: OwnerSafeSummary;
  chains: Array<ChainResult<DashboardResponse>>;
}) {
  // Pick the Safe state from whichever chain has the richest snapshot/event
  // history for this address. Since the safe address is CREATE2-deterministic
  // the state is usually identical across chains, but we defensively pick the
  // most-recently-updated to cover split-horizon scenarios.
  const state = useMemo(() => {
    let best: ReturnType<typeof safeCurrentState> | undefined;
    let bestTs = -1n;
    for (const { data } of chains) {
      const s = safeCurrentState(data, summary.address);
      if (s === undefined) continue;
      const ts = BigInt(s.lastUpdatedTimestamp ?? '0');
      if (ts > bestTs) {
        best = s;
        bestTs = ts;
      }
    }
    return best;
  }, [chains, summary.address]);

  const eventsByChain: Array<ChainTagged<SafeEventEntity>> = useMemo(() => {
    const out: Array<ChainTagged<SafeEventEntity>> = [];
    for (const { chain, data } of chains) {
      for (const e of safeEventsFor(data, summary.address)) {
        out.push({ ...e, chain });
      }
    }
    out.sort((a, b) => {
      const diff = BigInt(b.blockNumber) - BigInt(a.blockNumber);
      if (diff > 0n) return 1;
      if (diff < 0n) return -1;
      return b.id.localeCompare(a.id);
    });
    return out;
  }, [chains, summary.address]);

  const anyChainCfg = CHAINS[summary.occurrences[0]?.chain ?? 'mainnet'];
  const safeBadge = state?.isLikelySafe ? (
    <Tag variant='ok'>
      Gnosis Safe{state.safeVersion !== null ? ` v${state.safeVersion}` : ''}
    </Tag>
  ) : (
    <Tag variant='bad'>Not a recognised Safe</Tag>
  );

  return (
    <Card
      title={
        <div className='flex flex-wrap items-center gap-2'>
          <AddressLink chain={anyChainCfg} address={summary.address} short={false} />
          {safeBadge}
        </div>
      }
      subtitle='End-owner governance — owners, threshold, and the timeline of changes'
    >
      <div className='grid gap-4'>
        <OccurrenceList summary={summary} />
        <CurrentStateBlock state={state} />
        <SafeEventTimeline events={eventsByChain} />
      </div>
    </Card>
  );
}

function OccurrenceList({ summary }: { summary: OwnerSafeSummary }) {
  return (
    <div className='flex flex-col gap-1.5'>
      <div className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>
        Owns
      </div>
      <div className='flex flex-wrap gap-1.5'>
        {summary.occurrences.map(({ chain, role }) => (
          <div
            key={`${chain}:${role}`}
            className='flex items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elev)]/40 px-2.5 py-1 text-xs'
          >
            <ChainBadge chain={chain} variant='short' />
            <span className='text-[var(--color-text-muted)]'>·</span>
            <span>{role === 'LoggerProxyAdmin' ? 'Logger admin' : 'Safe-deployment admin'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurrentStateBlock({
  state,
}: {
  state: ReturnType<typeof safeCurrentState> | undefined;
}) {
  if (state === undefined) {
    return (
      <div className='rounded-lg border border-[var(--color-border-subtle)] p-3 text-xs text-[var(--color-text-faint)]'>
        No Safe snapshot indexed yet. The subgraph captures one on first
        `OwnershipTransferred` after deployment; if the screener has been redeployed
        recently it may still be syncing.
      </div>
    );
  }
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <div>
        <div className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>
          Threshold
        </div>
        <div className='text-base font-medium text-[var(--color-text)]'>
          {state.threshold} of {state.owners.length}
        </div>
      </div>
      <div>
        <div className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>
          Owners
        </div>
        <div className='flex flex-col gap-1 text-xs'>
          {state.owners.length === 0 ? (
            <span className='text-[var(--color-text-faint)]'>none tracked</span>
          ) : (
            state.owners.map((o) => (
              <span key={o.toLowerCase()} className='font-mono text-[var(--color-text)]'>
                {shortAddress(o, 6)}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SafeEventTimeline({
  events,
}: {
  events: Array<ChainTagged<SafeEventEntity>>;
}) {
  const columns: Array<Column<ChainTagged<SafeEventEntity>>> = [
    {
      key: 'chain',
      header: 'Chain',
      render: (r) => <ChainBadge chain={r.chain} variant='short' />,
      className: 'w-[84px]',
    },
    {
      key: 'kind',
      header: 'Change',
      render: (r) => <SafeEventKindTag kind={r.kind} />,
    },
    {
      key: 'detail',
      header: 'Detail',
      render: (r) => <SafeEventDetail event={r} chainCfg={CHAINS[r.chain]} />,
    },
    {
      key: 'when',
      header: 'When',
      render: (r) => (
        <span className='whitespace-nowrap' title={formatTimestamp(r.blockTimestamp)}>
          {formatRelative(r.blockTimestamp)}
        </span>
      ),
    },
    {
      key: 'tx',
      header: 'Tx',
      render: (r) => <TxLink chain={CHAINS[r.chain]} txHash={r.txHash} />,
    },
  ];

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>
        Governance events
      </div>
      <Table
        columns={columns}
        rows={events}
        getRowKey={(r) => `${r.chain}:${r.id}`}
        empty={
          <Empty>
            No governance events observed yet. The initial owners/threshold above come from
            on-chain calls at snapshot time; changes indexed after that will appear here.
          </Empty>
        }
      />
    </div>
  );
}

const SAFE_EVENT_LABEL: Record<SafeEventKind, string> = {
  AddedOwner: 'Owner added',
  RemovedOwner: 'Owner removed',
  ChangedThreshold: 'Threshold changed',
  ChangedGuard: 'Guard changed',
  ChangedFallbackHandler: 'Fallback handler changed',
};

const SAFE_EVENT_VARIANT: Record<SafeEventKind, 'ok' | 'warn' | 'bad' | 'accent' | 'neutral'> = {
  AddedOwner: 'ok',
  RemovedOwner: 'warn',
  ChangedThreshold: 'warn',
  ChangedGuard: 'bad',
  ChangedFallbackHandler: 'bad',
};

function SafeEventKindTag({ kind }: { kind: SafeEventKind }) {
  return <Tag variant={SAFE_EVENT_VARIANT[kind]}>{SAFE_EVENT_LABEL[kind]}</Tag>;
}

function SafeEventDetail({
  event,
  chainCfg,
}: {
  event: SafeEventEntity;
  chainCfg: (typeof CHAINS)[ChainId];
}) {
  switch (event.kind) {
    case 'AddedOwner':
    case 'RemovedOwner':
      return event.owner !== null ? (
        <AddressLink chain={chainCfg} address={event.owner} />
      ) : (
        <span className='text-[var(--color-text-faint)]'>—</span>
      );
    case 'ChangedThreshold':
      return <span className='font-mono'>{event.threshold ?? '—'}</span>;
    case 'ChangedGuard':
      return event.guard !== null ? (
        <AddressLink chain={chainCfg} address={event.guard} />
      ) : (
        <span className='text-[var(--color-text-faint)]'>cleared</span>
      );
    case 'ChangedFallbackHandler':
      return event.fallbackHandler !== null ? (
        <AddressLink chain={chainCfg} address={event.fallbackHandler} />
      ) : (
        <span className='text-[var(--color-text-faint)]'>cleared</span>
      );
    default:
      return null;
  }
}
