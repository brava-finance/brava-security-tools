import { useMemo } from 'react';

import { Card } from '../components/Card';
import { ChainBadge } from '../components/ChainBadge';
import { Empty, ErrorPane, Loading, PartialWarning } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useMultiDashboardData, useMultiDivergenceData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId, type ViewId } from '../lib/config';
import { deriveRolesFromAccessControl, deriveRolesFromLogger } from '../lib/derive';
import type { DerivedEntry, RoleMeta } from '../lib/derive';
import { formatRelative, formatTimestamp, shortAddress } from '../lib/format';

interface Props {
  view: ViewId;
}

type GrantSource = 'delayed' | 'direct';

interface MemberRow {
  key: string;
  chain: ChainId;
  account: string;
  grantedAt?: string;
  grantedBy?: string;
  grantedTx?: string;
  source: GrantSource;
}

interface RoleGroup {
  role: string;
  roleName: string;
  members: MemberRow[];
}

export function Roles({ view }: Props) {
  const dashboard = useMultiDashboardData(view);
  const divergence = useMultiDivergenceData(view);
  const isMulti = view === 'all';

  const groups = useMemo<RoleGroup[]>(() => {
    if (divergence.chains.length === 0) return [];

    // Build a per-chain Logger index so we can flag grants that also flowed
    // through the delay-protected Logger pipeline.
    const loggerByChainAndKey = new Map<string, DerivedEntry<RoleMeta>>();
    for (const { chain, data } of dashboard.chains) {
      for (const e of deriveRolesFromLogger(data)) {
        loggerByChainAndKey.set(`${chain}:${e.key}`, e);
      }
    }

    // Collapse (role, account) across chains into one group. Members are
    // chain-tagged so the UI can render a row per chain.
    const byRole = new Map<string, RoleGroup>();
    for (const { chain, data } of divergence.chains) {
      const active = deriveRolesFromAccessControl(data).filter((e) => e.status === 'active');
      for (const e of active) {
        const key = e.meta.role.toLowerCase();
        const group: RoleGroup = byRole.get(key) ?? {
          role: e.meta.role,
          roleName: e.meta.roleName,
          members: [],
        };

        const log = loggerByChainAndKey.get(`${chain}:${e.key}`);
        const member: MemberRow = {
          key: `${chain}:${e.key}`,
          chain,
          account: e.meta.account,
          ...((log?.grantedAt ?? e.lastEventAt) !== undefined
            ? { grantedAt: log?.grantedAt ?? e.lastEventAt }
            : {}),
          ...((log?.grantedTx ?? e.lastEventTx) !== undefined
            ? { grantedTx: log?.grantedTx ?? e.lastEventTx }
            : {}),
          ...(e.meta.sender !== undefined ? { grantedBy: e.meta.sender } : {}),
          source: log?.status === 'active' ? 'delayed' : 'direct',
        };
        group.members.push(member);
        byRole.set(key, group);
      }
    }

    const out = Array.from(byRole.values());
    for (const g of out) {
      g.members.sort((a, b) => {
        if (a.account !== b.account) return a.account.localeCompare(b.account);
        return a.chain.localeCompare(b.chain);
      });
    }
    out.sort((a, b) => a.roleName.localeCompare(b.roleName));
    return out;
  }, [dashboard.chains, divergence.chains]);

  const totalMembers = useMemo(
    () => groups.reduce((sum, g) => sum + g.members.length, 0),
    [groups]
  );

  const anyLoading = dashboard.isLoading || divergence.isLoading;
  const anyData = dashboard.chains.length > 0 || divergence.chains.length > 0;
  const error = dashboard.error ?? divergence.error;

  if (!anyData && anyLoading) return <Loading label='Fetching role membership…' />;
  if (!anyData && error !== null) return <ErrorPane error={error} />;
  if (divergence.chains.length === 0) return <Empty>No data returned from subgraph.</Empty>;

  const columns: Array<Column<MemberRow>> = [
    ...(isMulti
      ? [
          {
            key: 'chain',
            header: 'Chain',
            render: (r: MemberRow) => <ChainBadge chain={r.chain} variant='short' />,
          } satisfies Column<MemberRow>,
        ]
      : []),
    {
      key: 'account',
      header: 'Account',
      render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.account} />,
    },
    {
      key: 'source',
      header: 'Grant source',
      render: (r) =>
        r.source === 'delayed' ? (
          <span title='Granted via the delay-protected AdminVault flow (Logger observed it)'>
            <Tag variant='ok'>delay-protected</Tag>
          </span>
        ) : (
          <span title='Granted directly (constructor or admin call that bypasses the Logger)'>
            <Tag variant='warn'>direct</Tag>
          </span>
        ),
    },
    {
      key: 'grantedBy',
      header: 'Granted by',
      render: (r) =>
        r.grantedBy !== undefined ? (
          <AddressLink chain={CHAINS[r.chain]} address={r.grantedBy} />
        ) : (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ),
    },
    {
      key: 'grantedAt',
      header: 'Granted',
      render: (r) =>
        r.grantedAt === undefined ? (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ) : (
          <span title={formatTimestamp(r.grantedAt)}>{formatRelative(r.grantedAt)}</span>
        ),
    },
    {
      key: 'tx',
      header: 'Tx',
      render: (r) =>
        r.grantedTx !== undefined ? (
          <TxLink chain={CHAINS[r.chain]} txHash={r.grantedTx} />
        ) : (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ),
    },
  ];

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-xs leading-relaxed text-[var(--color-text-muted)]'>
          Current role membership on the AdminVault, sourced from OpenZeppelin AccessControl events
          (on-chain ground truth). Grants that also passed through the Logger's delay-protected
          pipeline are tagged <Tag variant='ok'>delay-protected</Tag>; grants that bypass the Logger
          (constructor initialisation, direct admin grants) are tagged{' '}
          <Tag variant='warn'>direct</Tag>.
        </p>
        <div className='flex items-center gap-2'>
          {(dashboard.isPartial || divergence.isPartial) && <PartialWarning />}
          <Tag variant='accent'>
            {groups.length} role{groups.length === 1 ? '' : 's'} · {totalMembers} member
            {totalMembers === 1 ? '' : 's'}
          </Tag>
        </div>
      </div>

      {groups.length === 0 ? (
        <Empty>No active roles indexed for this view.</Empty>
      ) : (
        groups.map((g) => (
          <Card
            key={g.role}
            title={
              <div className='flex flex-wrap items-baseline gap-2'>
                <span className='mono'>{g.roleName}</span>
                <Tag variant='neutral'>
                  {g.members.length} member{g.members.length === 1 ? '' : 's'}
                </Tag>
              </div>
            }
            subtitle={
              <span className='mono text-[10px] text-[var(--color-text-faint)]'>
                {shortAddress(g.role, 8)}
              </span>
            }
            dense
          >
            <Table columns={columns} rows={g.members} getRowKey={(r) => r.key} />
          </Card>
        ))
      )}
    </div>
  );
}
