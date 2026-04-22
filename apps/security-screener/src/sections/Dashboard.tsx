import { useMemo } from 'react';

import { Card } from '../components/Card';
import { Empty, ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import type { SectionId } from '../components/SectionNav';
import { useDashboardData, useDivergenceData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import {
  deriveActions,
  deriveFees,
  derivePools,
  deriveRolesFromAccessControl,
  deriveRolesFromLogger,
  deriveTokens,
  latestDelaySeconds,
  latestLoggerImplementation,
  latestLoggerProxyAdmin,
  latestProxyAdminOwner,
  latestSafeSetupConfig,
} from '../lib/derive';
import type { DerivedEntry, FeeMeta } from '../lib/derive';
import { cn, formatBigIntBasis, formatDurationSeconds, formatTimestamp } from '../lib/format';

interface Props {
  chain: ChainId;
  onNavigate: (section: SectionId) => void;
}

interface SummaryStat {
  id: SectionId;
  label: string;
  value: string;
}

export function Dashboard({ chain, onNavigate }: Props) {
  const chainCfg = CHAINS[chain];
  const query = useDashboardData(chain);
  const divergence = useDivergenceData(chain);

  const stats = useMemo<SummaryStat[]>(() => {
    const d = query.data;
    const a = divergence.data;
    const fmt = (n: number | undefined): string => (n === undefined ? '—' : String(n));
    const activeCount = <T extends { status: string }>(xs: T[]): number =>
      xs.filter((x) => x.status === 'active').length;

    const actions = d === undefined ? undefined : activeCount(deriveActions(d));
    const pools = d === undefined ? undefined : activeCount(derivePools(d));
    const tokens = d === undefined ? undefined : activeCount(deriveTokens(d));
    const roles = a === undefined ? undefined : activeCount(deriveRolesFromAccessControl(a));
    const pending = d === undefined ? undefined : activeCountPending(d);
    return [
      { id: 'actions', label: 'Active actions', value: fmt(actions) },
      { id: 'pools', label: 'Active pools', value: fmt(pools) },
      { id: 'tokens', label: 'Active tokens', value: fmt(tokens) },
      { id: 'roles', label: 'Role members', value: fmt(roles) },
      { id: 'pending', label: 'Pending proposals', value: fmt(pending) },
    ];
  }, [query.data, divergence.data]);

  const activeFees = useMemo<Array<DerivedEntry<FeeMeta>>>(() => {
    if (query.data === undefined) return [];
    return deriveFees(query.data)
      .filter((e) => e.status === 'active')
      .sort((a, b) => Number(b.grantedAt ?? 0) - Number(a.grantedAt ?? 0));
  }, [query.data]);

  if (query.isLoading) return <Loading label='Fetching admin-vault state…' />;
  if (query.error !== null) return <ErrorPane error={query.error} />;
  if (query.data === undefined) return <Empty>No data returned from subgraph.</Empty>;

  return (
    <div className='grid gap-4'>
      <SummaryStrip stats={stats} onNavigate={onNavigate} />

      <ProxyState chain={chain} data={query.data} />

      <div className='grid gap-4 md:grid-cols-2'>
        <DelayCard delaySeconds={latestDelaySeconds(query.data)} />
        <ActiveFeesCompact chain={chain} entries={activeFees} />
      </div>

      <SafeSetupCard chain={chain} data={query.data} />

      <footer className='text-[11px] text-[var(--color-text-faint)]'>
        Data source: <span className='mono'>{chainCfg.subgraphUrl}</span>
      </footer>
    </div>
  );
}

function activeCountPending(d: NonNullable<ReturnType<typeof useDashboardData>['data']>): number {
  // Sum of all pending proposals across every registry the Pending tab shows,
  // so the dashboard counter matches what the user will see when they click in.
  let n = 0;
  n += deriveActions(d).filter((e) => e.status === 'pending').length;
  n += derivePools(d).filter((e) => e.status === 'pending').length;
  n += deriveTokens(d).filter((e) => e.status === 'pending').length;
  n += deriveFees(d).filter((e) => e.status === 'pending').length;
  n += deriveRolesFromLogger(d).filter((e) => e.status === 'pending').length;
  return n;
}

function SummaryStrip({
  stats,
  onNavigate,
}: {
  stats: SummaryStat[];
  onNavigate: (s: SectionId) => void;
}) {
  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
      {stats.map((s) => {
        const btnClass = cn(
          'group flex flex-col items-start gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-3 text-left transition-colors',
          'hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]'
        );
        return (
          <button
            key={s.id}
            type='button'
            className={btnClass}
            onClick={() => onNavigate(s.id)}
            aria-label={`View ${s.label}`}
          >
            <span className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)] group-hover:text-[var(--color-text-muted)]'>
              {s.label}
            </span>
            <span className='mono text-2xl text-[var(--color-text)]'>{s.value}</span>
          </button>
        );
      })}
    </div>
  );
}

function ProxyState({
  chain,
  data,
}: {
  chain: ChainId;
  data: NonNullable<ReturnType<typeof useDashboardData>['data']>;
}) {
  const chainCfg = CHAINS[chain];
  const upgrade = latestLoggerImplementation(data);
  const proxyAdminChange = latestLoggerProxyAdmin(data);
  const loggerAdminOwner = latestProxyAdminOwner(data, chainCfg.contracts.LoggerProxyAdmin);
  const safeDeploymentAdmin = chainCfg.contracts.SafeDeploymentProxyAdmin;
  const safeDeploymentOwner =
    safeDeploymentAdmin !== undefined
      ? latestProxyAdminOwner(data, safeDeploymentAdmin)
      : undefined;

  return (
    <Card title='Logger proxy' subtitle='Upgrade history and admin ownership for the logger proxy'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <Field label='Proxy address'>
          <AddressLink chain={chainCfg} address={chainCfg.contracts.LoggerProxy} short={false} />
        </Field>
        <Field label='Current implementation'>
          {upgrade === undefined ? (
            <span className='text-[var(--color-text-faint)]'>
              unknown (no Upgraded event indexed)
            </span>
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              <AddressLink chain={chainCfg} address={upgrade.implementation} />
              <Tag variant='accent'>last upgrade {formatTimestamp(upgrade.blockTimestamp)}</Tag>
              <TxLink chain={chainCfg} txHash={upgrade.txHash} />
            </div>
          )}
        </Field>
        <Field label='Current proxy admin'>
          {proxyAdminChange === undefined ? (
            <AddressLink chain={chainCfg} address={chainCfg.contracts.LoggerProxyAdmin} />
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              <AddressLink chain={chainCfg} address={proxyAdminChange.newAdmin} />
              <Tag variant='warn'>changed {formatTimestamp(proxyAdminChange.blockTimestamp)}</Tag>
              <TxLink chain={chainCfg} txHash={proxyAdminChange.txHash} />
            </div>
          )}
        </Field>
        <Field label='Proxy admin owner (LoggerProxyAdmin)'>
          {loggerAdminOwner === undefined ? (
            <span className='text-[var(--color-text-faint)]'>
              no OwnershipTransferred event indexed
            </span>
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              <AddressLink chain={chainCfg} address={loggerAdminOwner.newOwner} />
              <Tag variant='neutral'>since {formatTimestamp(loggerAdminOwner.blockTimestamp)}</Tag>
              <TxLink chain={chainCfg} txHash={loggerAdminOwner.txHash} />
            </div>
          )}
        </Field>
        {safeDeploymentAdmin !== undefined && (
          <Field label='Safe-deployment proxy admin'>
            {safeDeploymentOwner === undefined ? (
              <AddressLink chain={chainCfg} address={safeDeploymentAdmin} />
            ) : (
              <div className='flex flex-wrap items-center gap-2'>
                <AddressLink chain={chainCfg} address={safeDeploymentOwner.newOwner} />
                <Tag variant='neutral'>
                  since {formatTimestamp(safeDeploymentOwner.blockTimestamp)}
                </Tag>
                <TxLink chain={chainCfg} txHash={safeDeploymentOwner.txHash} />
              </div>
            )}
          </Field>
        )}
      </div>
    </Card>
  );
}

function DelayCard({ delaySeconds }: { delaySeconds: bigint | undefined }) {
  const pretty =
    delaySeconds === undefined ? undefined : formatDurationSeconds(Number(delaySeconds));
  return (
    <Card title='Proposal delay' subtitle='Time-lock that every admin-vault proposal must wait out'>
      {pretty === undefined ? (
        <span className='text-[var(--color-text-faint)]'>
          No delay change indexed yet (delay is contract default).
        </span>
      ) : (
        <span className='mono text-lg text-[var(--color-text)]'>{pretty}</span>
      )}
    </Card>
  );
}

function SafeSetupCard({
  chain,
  data,
}: {
  chain: ChainId;
  data: NonNullable<ReturnType<typeof useDashboardData>['data']>;
}) {
  const chainCfg = CHAINS[chain];
  const latest = latestSafeSetupConfig(data);
  return (
    <Card
      title='Safe setup registry'
      subtitle='Expected Safe configuration (modules / guard / fallback handler)'
    >
      {latest === undefined ? (
        <span className='text-[var(--color-text-faint)]'>No configuration set yet.</span>
      ) : (
        <div className='grid gap-2'>
          <Field label='Fallback handler'>
            <AddressLink chain={chainCfg} address={latest.fallbackHandler} />
          </Field>
          <Field label='Guard'>
            <AddressLink chain={chainCfg} address={latest.guard} />
          </Field>
          <Field label='Modules'>
            <div className='flex flex-wrap gap-2'>
              {latest.modules.length === 0 ? (
                <span className='text-[var(--color-text-faint)]'>none</span>
              ) : (
                latest.modules.map((m) => <AddressLink key={m} chain={chainCfg} address={m} />)
              )}
            </div>
          </Field>
          <Field label='Last updated'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='mono text-xs text-[var(--color-text-muted)]'>
                {formatTimestamp(latest.blockTimestamp)}
              </span>
              <Tag variant='neutral'>via {latest.source}</Tag>
              <TxLink chain={chainCfg} txHash={latest.txHash} />
            </div>
          </Field>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid gap-0.5'>
      <span className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>
        {label}
      </span>
      <div className='text-sm text-[var(--color-text)]'>{children}</div>
    </div>
  );
}

function ActiveFeesCompact({
  chain,
  entries,
}: {
  chain: ChainId;
  entries: Array<DerivedEntry<FeeMeta>>;
}) {
  const chainCfg = CHAINS[chain];
  const columns: Array<Column<(typeof entries)[number]>> = [
    {
      key: 'recipient',
      header: 'Recipient',
      render: (r) => <AddressLink chain={chainCfg} address={r.meta.recipient} />,
    },
    {
      key: 'min',
      header: 'Min',
      render: (r) => <span className='mono'>{formatBigIntBasis(r.meta.minBasis)}</span>,
    },
    {
      key: 'max',
      header: 'Max',
      render: (r) => <span className='mono'>{formatBigIntBasis(r.meta.maxBasis)}</span>,
    },
  ];
  return (
    <Card
      title={`Active fees (${entries.length})`}
      subtitle='Protocol fee bounds enforced on-chain'
    >
      <Table
        columns={columns}
        rows={entries}
        getRowKey={(r) => r.key}
        empty='No fee recipients configured.'
      />
    </Card>
  );
}
