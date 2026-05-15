import { useMemo, type ReactElement } from 'react';

import { Card } from '../components/Card';
import { ChainBadge } from '../components/ChainBadge';
import { Empty, ErrorPane, Loading, PartialWarning } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import type { SectionId } from '../components/SectionNav';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useMultiDashboardData, useMultiDivergenceData } from '../hooks/useSubgraphData';
import type { ChainResult } from '../hooks/useSubgraphData';
import { CHAINS, chainsForView, type ChainId, type ViewId } from '../lib/config';
import {
  currentProxyAdminAddress,
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
  latestSafeDeploymentImplementation,
  latestSafeDeploymentProxyAdmin,
  latestSafeSetupConfig,
  safeSnapshotFor,
  summarizeEndOwners,
  tagChain,
} from '../lib/derive';
import type {
  ChainTagged,
  DerivedEntry,
  FeeMeta,
  OwnerSafeSummary,
  ProxyOwnerRole,
} from '../lib/derive';
import type { DashboardResponse } from '../lib/queries';
import { cn, formatBigIntBasis, formatDurationSeconds, formatTimestamp } from '../lib/format';

interface Props {
  view: ViewId;
  onNavigate: (section: SectionId) => void;
}

interface SummaryStat {
  id: SectionId;
  label: string;
  value: string;
  loading: boolean;
  // Breakdown across the chains included in the current view. Hidden when the
  // view is a single chain (would be tautological).
  breakdown: Array<{ chain: ChainId; value: number | undefined }>;
  icon: 'actions' | 'pools' | 'tokens' | 'roles' | 'pending';
}

export function Dashboard({ view, onNavigate }: Props) {
  const dashboard = useMultiDashboardData(view);
  const divergence = useMultiDivergenceData(view);

  const viewChains = useMemo(() => chainsForView(view), [view]);
  const isMulti = view === 'all';

  const stats = useMemo<SummaryStat[]>(() => {
    const activeCount = <T extends { status: string }>(xs: T[]): number =>
      xs.filter((x) => x.status === 'active').length;

    const perChainActions = perChain(dashboard.chains, (d) => activeCount(deriveActions(d)));
    const perChainPools = perChain(dashboard.chains, (d) => activeCount(derivePools(d)));
    const perChainTokens = perChain(dashboard.chains, (d) => activeCount(deriveTokens(d)));
    const perChainRoles = perChain(divergence.chains, (d) =>
      activeCount(deriveRolesFromAccessControl(d))
    );
    const perChainPending = perChain(dashboard.chains, pendingCountFor);

    const sum = (b: Array<{ value: number | undefined }>): number | undefined => {
      let total = 0;
      let anyKnown = false;
      for (const x of b) {
        if (x.value !== undefined) {
          total += x.value;
          anyKnown = true;
        }
      }
      return anyKnown ? total : undefined;
    };

    const fmt = (n: number | undefined): string => (n === undefined ? '—' : String(n));
    const loading = dashboard.chains.length === 0 && dashboard.isLoading;
    const divLoading = divergence.chains.length === 0 && divergence.isLoading;

    const buildBreakdown = (
      data: Array<{ chain: ChainId; value: number | undefined }>
    ): Array<{ chain: ChainId; value: number | undefined }> => {
      // Fill in every chain from the current view so the UI has a stable,
      // non-shifting layout even while some chain queries are still in-flight.
      const map = new Map(data.map((d) => [d.chain, d.value] as const));
      return viewChains.map((c) => ({ chain: c, value: map.get(c) }));
    };

    return [
      {
        id: 'actions',
        label: 'Active actions',
        value: fmt(sum(perChainActions)),
        loading,
        breakdown: buildBreakdown(perChainActions),
        icon: 'actions',
      },
      {
        id: 'pools',
        label: 'Active pools',
        value: fmt(sum(perChainPools)),
        loading,
        breakdown: buildBreakdown(perChainPools),
        icon: 'pools',
      },
      {
        id: 'tokens',
        label: 'Active tokens',
        value: fmt(sum(perChainTokens)),
        loading,
        breakdown: buildBreakdown(perChainTokens),
        icon: 'tokens',
      },
      {
        id: 'roles',
        label: 'Role members',
        value: fmt(sum(perChainRoles)),
        loading: divLoading,
        breakdown: buildBreakdown(perChainRoles),
        icon: 'roles',
      },
      {
        id: 'pending',
        label: 'Pending proposals',
        value: fmt(sum(perChainPending)),
        loading,
        breakdown: buildBreakdown(perChainPending),
        icon: 'pending',
      },
    ];
  }, [dashboard.chains, dashboard.isLoading, divergence.chains, divergence.isLoading, viewChains]);

  const activeFees = useMemo<Array<ChainTagged<DerivedEntry<FeeMeta>>>>(() => {
    const out: Array<ChainTagged<DerivedEntry<FeeMeta>>> = [];
    for (const { chain, data } of dashboard.chains) {
      const entries = deriveFees(data)
        .filter((e) => e.status === 'active')
        .sort((a, b) => Number(b.grantedAt ?? 0) - Number(a.grantedAt ?? 0));
      for (const e of tagChain(chain, entries)) out.push(e);
    }
    return out;
  }, [dashboard.chains]);

  if (dashboard.chains.length === 0 && dashboard.isLoading) {
    return <Loading label='Fetching admin-vault state…' />;
  }
  if (dashboard.chains.length === 0 && dashboard.error !== null) {
    return <ErrorPane error={dashboard.error} />;
  }
  if (dashboard.chains.length === 0) return <Empty>No data returned from subgraph.</Empty>;

  return (
    <div className='grid gap-4'>
      <SummaryStrip stats={stats} onNavigate={onNavigate} isMulti={isMulti} />

      {dashboard.isPartial && (
        <div className='flex justify-end'>
          <PartialWarning />
        </div>
      )}

      <OwnerDivergenceBanner chains={dashboard.chains} onNavigate={onNavigate} />

      <ProxyStateGrid chains={dashboard.chains} isMulti={isMulti} />

      <div className='grid gap-4 md:grid-cols-2'>
        <DelayCard chains={dashboard.chains} isMulti={isMulti} />
        <ActiveFeesCompact entries={activeFees} isMulti={isMulti} />
      </div>

      <SafeSetupCard chains={dashboard.chains} isMulti={isMulti} />
    </div>
  );
}

function pendingCountFor(d: DashboardResponse): number {
  let n = 0;
  n += deriveActions(d).filter((e) => e.status === 'pending').length;
  n += derivePools(d).filter((e) => e.status === 'pending').length;
  n += deriveTokens(d).filter((e) => e.status === 'pending').length;
  n += deriveFees(d).filter((e) => e.status === 'pending').length;
  n += deriveRolesFromLogger(d).filter((e) => e.status === 'pending').length;
  return n;
}

function perChain<TData>(
  chains: Array<ChainResult<TData>>,
  compute: (d: TData) => number
): Array<{ chain: ChainId; value: number | undefined }> {
  return chains.map(({ chain, data }) => ({ chain, value: compute(data) }));
}

function SummaryStrip({
  stats,
  onNavigate,
  isMulti,
}: {
  stats: SummaryStat[];
  onNavigate: (s: SectionId) => void;
  isMulti: boolean;
}) {
  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
      {stats.map((s) => (
        <StatCard key={s.id} stat={s} onNavigate={onNavigate} isMulti={isMulti} />
      ))}
    </div>
  );
}

const STAT_ICONS: Record<SummaryStat['icon'], ReactElement> = {
  actions: <path d='M13 2 4 14h7l-1 8 9-12h-7l1-8Z' />,
  pools: <path d='M3 10c3 2 6-2 9 0s6-2 9 0M3 16c3 2 6-2 9 0s6-2 9 0M3 4c3 2 6-2 9 0s6-2 9 0' />,
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
    </>
  ),
  pending: (
    <>
      <circle cx='12' cy='12' r='9' />
      <path d='M12 7v5l3 2' />
    </>
  ),
};

function StatCard({
  stat,
  onNavigate,
  isMulti,
}: {
  stat: SummaryStat;
  onNavigate: (s: SectionId) => void;
  isMulti: boolean;
}) {
  const btnClass = cn(
    'group card-raised relative flex h-full flex-col items-start gap-2 px-4 py-3.5 text-left transition-all',
    'hover:border-[var(--color-accent)] hover:shadow-[0_0_0_1px_var(--color-accent-soft),0_12px_32px_-18px_rgba(124,196,255,0.35)]'
  );

  return (
    <button
      type='button'
      className={btnClass}
      onClick={() => onNavigate(stat.id)}
      aria-label={`View ${stat.label}`}
    >
      <span className='flex w-full items-center justify-between'>
        <span className='text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] group-hover:text-[var(--color-text-muted)]'>
          {stat.label}
        </span>
        <svg
          aria-hidden='true'
          viewBox='0 0 24 24'
          width='16'
          height='16'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='text-[var(--color-text-faint)] transition-colors group-hover:text-[var(--color-accent)]'
        >
          {STAT_ICONS[stat.icon]}
        </svg>
      </span>

      <span className='mono text-3xl font-semibold tracking-tight text-[var(--color-text)]'>
        {stat.loading ? <span className='text-[var(--color-text-faint)]'>…</span> : stat.value}
      </span>

      {isMulti && (
        <span className='mt-auto flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-[10px]'>
          {stat.breakdown.map((b) => (
            <span
              key={b.chain}
              className='flex items-center gap-1 text-[var(--color-text-faint)]'
              title={CHAINS[b.chain].label}
            >
              <span
                className='inline-block h-1.5 w-1.5 rounded-full'
                style={{ backgroundColor: CHAINS[b.chain].color }}
              />
              <span className='mono'>{b.value === undefined ? '…' : b.value}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function ProxyStateGrid({
  chains,
  isMulti,
}: {
  chains: Array<ChainResult<DashboardResponse>>;
  isMulti: boolean;
}) {
  // Single-chain view: one card per proxy stacked; multi-chain view: a grid
  // so each chain's proxy state can be inspected side by side. We render two
  // rows — Logger proxy and Safe-deployment proxy — because both are
  // TransparentUpgradeableProxies whose admin can be rotated independently.
  const gridClass = cn('grid gap-4', isMulti && chains.length > 1 ? 'lg:grid-cols-3' : '');
  return (
    <div className='grid gap-4'>
      <div className={gridClass}>
        {chains.map(({ chain, data }) => (
          <LoggerProxyCard key={chain} chain={chain} data={data} showHeader={isMulti} />
        ))}
      </div>
      <div className={gridClass}>
        {chains.map(({ chain, data }) => (
          <SafeDeploymentProxyCard key={chain} chain={chain} data={data} showHeader={isMulti} />
        ))}
      </div>
    </div>
  );
}

function LoggerProxyCard({
  chain,
  data,
  showHeader,
}: {
  chain: ChainId;
  data: DashboardResponse;
  showHeader: boolean;
}) {
  const chainCfg = CHAINS[chain];
  const upgrade = latestLoggerImplementation(data);
  const proxyAdminChange = latestLoggerProxyAdmin(data);
  // Resolve the *current* admin dynamically (from the most recent AdminChanged
  // event) and look up its owner. Filtering ownership events by the
  // bootstrap address in `contracts.LoggerProxyAdmin` misses rotations, which
  // is exactly the bug the ProxyAdmin template is designed to fix.
  const currentAdminAddress = currentProxyAdminAddress(
    data,
    'logger',
    chainCfg.contracts.LoggerProxyAdmin
  );
  const loggerAdminOwner = latestProxyAdminOwner(data, currentAdminAddress);

  return (
    <Card
      accent={chainCfg.color}
      title={
        <div className='flex items-center gap-2'>
          <span>Logger proxy</span>
          {showHeader && <ChainBadge chain={chain} variant='short' />}
        </div>
      }
      subtitle='Upgrade history and admin ownership for the logger proxy'
    >
      <div className='grid gap-3'>
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
        <Field label='Proxy admin owner (end owner)'>
          {loggerAdminOwner === undefined ? (
            <span className='text-[var(--color-text-faint)]'>
              no OwnershipTransferred event indexed
            </span>
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              <AddressLink chain={chainCfg} address={loggerAdminOwner.newOwner} />
              <SafeOwnerBadge data={data} owner={loggerAdminOwner.newOwner} />
              <Tag variant='neutral'>since {formatTimestamp(loggerAdminOwner.blockTimestamp)}</Tag>
              <TxLink chain={chainCfg} txHash={loggerAdminOwner.txHash} />
            </div>
          )}
        </Field>
      </div>
    </Card>
  );
}

function SafeDeploymentProxyCard({
  chain,
  data,
  showHeader,
}: {
  chain: ChainId;
  data: DashboardResponse;
  showHeader: boolean;
}) {
  const chainCfg = CHAINS[chain];
  const upgrade = latestSafeDeploymentImplementation(data);
  const proxyAdminChange = latestSafeDeploymentProxyAdmin(data);
  const currentAdminAddress = currentProxyAdminAddress(
    data,
    'safeDeployment',
    chainCfg.contracts.SafeDeploymentProxyAdmin
  );
  const adminOwner = latestProxyAdminOwner(data, currentAdminAddress);

  const hasAnyData =
    upgrade !== undefined || proxyAdminChange !== undefined || adminOwner !== undefined;

  return (
    <Card
      accent={chainCfg.color}
      title={
        <div className='flex items-center gap-2'>
          <span>Safe-deployment proxy</span>
          {showHeader && <ChainBadge chain={chain} variant='short' />}
        </div>
      }
      subtitle='Upgrade history and admin ownership for the safe-deployment proxy'
    >
      <div className='grid gap-3'>
        {!hasAnyData && (
          <div className='text-xs text-[var(--color-text-faint)]'>
            No safe-deployment proxy events indexed yet on this chain.
          </div>
        )}
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
            currentAdminAddress === undefined ? (
              <span className='text-[var(--color-text-faint)]'>
                unknown (no AdminChanged event indexed)
              </span>
            ) : (
              <AddressLink chain={chainCfg} address={currentAdminAddress} />
            )
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              <AddressLink chain={chainCfg} address={proxyAdminChange.newAdmin} />
              <Tag variant='warn'>changed {formatTimestamp(proxyAdminChange.blockTimestamp)}</Tag>
              <TxLink chain={chainCfg} txHash={proxyAdminChange.txHash} />
            </div>
          )}
        </Field>
        <Field label='Proxy admin owner (end owner)'>
          {adminOwner === undefined ? (
            <span className='text-[var(--color-text-faint)]'>
              no OwnershipTransferred event indexed
            </span>
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              <AddressLink chain={chainCfg} address={adminOwner.newOwner} />
              <SafeOwnerBadge data={data} owner={adminOwner.newOwner} />
              <Tag variant='neutral'>since {formatTimestamp(adminOwner.blockTimestamp)}</Tag>
              <TxLink chain={chainCfg} txHash={adminOwner.txHash} />
            </div>
          )}
        </Field>
      </div>
    </Card>
  );
}

interface DelayRow {
  chain: ChainId;
  // `undefined` here means we never saw a `DelayChange` event. Per protocol
  // design that's equivalent to the contract default of 0 (no delay), so we
  // surface it as such rather than as a benign "not indexed".
  hasDelay: boolean;
  pretty: string;
}

function DelayCard({
  chains,
  isMulti,
}: {
  chains: Array<ChainResult<DashboardResponse>>;
  isMulti: boolean;
}) {
  const rows: DelayRow[] = chains.map(({ chain, data }) => {
    const s = latestDelaySeconds(data);
    if (s === undefined || s === 0n) {
      return { chain, hasDelay: false, pretty: 'no delay set' };
    }
    return { chain, hasDelay: true, pretty: formatDurationSeconds(Number(s)) };
  });

  return (
    <Card
      title='Proposal delay'
      subtitle='Time-lock that every admin-vault proposal must wait out before it can be executed. "No delay set" means proposals can be executed immediately after being granted.'
    >
      {isMulti ? (
        <ul className='grid gap-2'>
          {rows.map((r) => (
            <li key={r.chain} className='flex items-center justify-between gap-3'>
              <ChainBadge chain={r.chain} variant='short' />
              <span
                className={cn(
                  'mono text-base',
                  r.hasDelay ? 'text-[var(--color-text)]' : 'text-[var(--color-bad)]'
                )}
              >
                {r.pretty}
              </span>
            </li>
          ))}
        </ul>
      ) : rows[0] !== undefined ? (
        <span
          className={cn(
            'mono text-2xl',
            rows[0].hasDelay ? 'text-[var(--color-text)]' : 'text-[var(--color-bad)]'
          )}
        >
          {rows[0].pretty}
        </span>
      ) : (
        <span className='text-[var(--color-text-faint)]'>no data</span>
      )}
    </Card>
  );
}

function SafeSetupCard({
  chains,
  isMulti,
}: {
  chains: Array<ChainResult<DashboardResponse>>;
  isMulti: boolean;
}) {
  return (
    <div className={cn('grid gap-4', isMulti && chains.length > 1 ? 'lg:grid-cols-3' : '')}>
      {chains.map(({ chain, data }) => {
        const chainCfg = CHAINS[chain];
        const latest = latestSafeSetupConfig(data);
        return (
          <Card
            key={chain}
            accent={chainCfg.color}
            title={
              <div className='flex items-center gap-2'>
                <span>Safe setup registry</span>
                {isMulti && <ChainBadge chain={chain} variant='short' />}
              </div>
            }
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
                      latest.modules.map((m) => (
                        <AddressLink key={m} chain={chainCfg} address={m} />
                      ))
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
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid gap-1'>
      <span className='text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]'>
        {label}
      </span>
      <div className='text-sm text-[var(--color-text)]'>{children}</div>
    </div>
  );
}

// Red banner shown when multiple distinct end-owners are observed across
// the active chains + proxy families. Normally every proxy should resolve
// to the same single Safe — any fan-out is either a half-finished rotation
// or a governance inconsistency that needs investigation.
function OwnerDivergenceBanner({
  chains,
  onNavigate,
}: {
  chains: Array<ChainResult<DashboardResponse>>;
  onNavigate: (section: SectionId) => void;
}) {
  const summaries = useMemo<OwnerSafeSummary[]>(() => {
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

  const distinctCount = summaries.length;
  const shouldWarn = distinctCount > 1;
  if (!shouldWarn) return null;

  const bannerTitle = `${distinctCount} distinct end-owners observed across proxies`;
  const handleInvestigate = () => onNavigate('governance');

  return (
    <div className='rounded-xl border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-col gap-1'>
          <div className='text-sm font-semibold text-[var(--color-bad)]'>{bannerTitle}</div>
          <div className='text-xs text-[var(--color-text-muted)]'>
            All proxies should normally be owned by the same Gnosis Safe. Mixed owners are
            either a half-finished rotation or a governance inconsistency.
          </div>
        </div>
        <button
          type='button'
          onClick={handleInvestigate}
          className='rounded-lg border border-[color-mix(in_srgb,var(--color-bad)_40%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--color-bad)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-bad)_15%,transparent)]'
        >
          Investigate in Governance →
        </button>
      </div>
    </div>
  );
}

// Safe-status badge rendered next to a proxy admin's owner address. Green
// when `getOwners()` + `getThreshold()` returned OK at snapshot time (or a
// governance event later confirmed it), red when both probes failed and we
// have no subsequent evidence — in which case the owner is probably an EOA,
// an unsupported Safe version, or some other contract that warrants review.
function SafeOwnerBadge({ data, owner }: { data: DashboardResponse; owner: string | undefined }) {
  if (owner === undefined) return null;
  const snapshot = safeSnapshotFor(data, owner);
  if (snapshot === undefined) {
    return <Tag variant='warn'>Safe status unknown</Tag>;
  }
  if (snapshot.isLikelySafe) {
    const version = snapshot.safeVersion !== null ? ` v${snapshot.safeVersion}` : '';
    const threshold = snapshot.threshold;
    const ownerCount = snapshot.owners.length;
    const thresholdLabel = ownerCount > 0 ? `${threshold}/${ownerCount}` : threshold;
    return (
      <Tag variant='ok'>
        Gnosis Safe{version} · {thresholdLabel}
      </Tag>
    );
  }
  return <Tag variant='bad'>Not a recognised Safe</Tag>;
}

function ActiveFeesCompact({
  entries,
  isMulti,
}: {
  entries: Array<ChainTagged<DerivedEntry<FeeMeta>>>;
  isMulti: boolean;
}) {
  const columns: Array<Column<(typeof entries)[number]>> = [
    ...(isMulti
      ? [
          {
            key: 'chain',
            header: 'Chain',
            render: (r: (typeof entries)[number]) => <ChainBadge chain={r.chain} variant='short' />,
          } satisfies Column<(typeof entries)[number]>,
        ]
      : []),
    {
      key: 'recipient',
      header: 'Recipient',
      render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.meta.recipient} />,
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
      dense
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
