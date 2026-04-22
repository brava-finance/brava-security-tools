import { useMemo } from 'react';

import { Card } from '../components/Card';
import { Empty, ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useDashboardData, useDivergenceData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import { deriveRolesFromAccessControl, deriveRolesFromLogger } from '../lib/derive';
import type { DerivedEntry, RoleMeta } from '../lib/derive';
import { formatRelative, formatTimestamp, shortAddress } from '../lib/format';

interface Props {
  chain: ChainId;
}

type GrantSource = 'delayed' | 'direct';

interface MemberRow {
  key: string;
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

export function Roles({ chain }: Props) {
  const chainCfg = CHAINS[chain];
  const dashboard = useDashboardData(chain);
  const divergence = useDivergenceData(chain);

  const groups = useMemo<RoleGroup[]>(() => {
    if (divergence.data === undefined) return [];

    // Index Logger-derived role entries by (role, account) so we can flag
    // members whose grant also flowed through the delay-protected Logger
    // pipeline (vs constructor/direct grants that bypass it).
    const loggerByKey = new Map<string, DerivedEntry<RoleMeta>>();
    if (dashboard.data !== undefined) {
      for (const e of deriveRolesFromLogger(dashboard.data)) loggerByKey.set(e.key, e);
    }

    const active = deriveRolesFromAccessControl(divergence.data).filter(
      (e) => e.status === 'active'
    );

    // Group by role hash; keep the most human-friendly roleName we see.
    const byRole = new Map<string, RoleGroup>();
    for (const e of active) {
      const key = e.meta.role.toLowerCase();
      const existing = byRole.get(key);
      const group: RoleGroup =
        existing ??
        ({
          role: e.meta.role,
          roleName: e.meta.roleName,
          members: [],
        } satisfies RoleGroup);

      const log = loggerByKey.get(e.key);
      const member: MemberRow = {
        key: e.key,
        account: e.meta.account,
        // Prefer the Logger-observed grant timestamp (the delay-protected
        // moment of grant) when available; fall back to the AC event.
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

    // Sort members inside each group by account for stable rendering, then
    // sort groups by roleName so the UI has a predictable top-to-bottom order.
    const out = Array.from(byRole.values());
    for (const g of out) {
      g.members.sort((a, b) => a.account.localeCompare(b.account));
    }
    out.sort((a, b) => a.roleName.localeCompare(b.roleName));
    return out;
  }, [dashboard.data, divergence.data]);

  const totalMembers = useMemo(
    () => groups.reduce((sum, g) => sum + g.members.length, 0),
    [groups]
  );

  const isLoading = dashboard.isLoading || divergence.isLoading;
  const error = dashboard.error ?? divergence.error;

  if (isLoading) return <Loading label='Fetching role membership…' />;
  if (error !== null) return <ErrorPane error={error} />;
  if (divergence.data === undefined) return <Empty>No data returned from subgraph.</Empty>;

  const columns: Array<Column<MemberRow>> = [
    {
      key: 'account',
      header: 'Account',
      render: (r) => <AddressLink chain={chainCfg} address={r.account} />,
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
          <AddressLink chain={chainCfg} address={r.grantedBy} />
        ) : (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ),
    },
    {
      key: 'grantedAt',
      header: 'Granted at',
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
          <TxLink chain={chainCfg} txHash={r.grantedTx} />
        ) : (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ),
    },
  ];

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-xs text-[var(--color-text-muted)]'>
          Current role membership on the AdminVault, sourced from OpenZeppelin AccessControl events
          (on-chain ground truth). Grants that also passed through the Logger's delay-protected
          pipeline are tagged <Tag variant='ok'>delay-protected</Tag>; grants that bypass the Logger
          (constructor initialisation, direct admin grants) are tagged{' '}
          <Tag variant='warn'>direct</Tag>.
        </p>
        <Tag variant='accent'>
          {groups.length} role{groups.length === 1 ? '' : 's'} · {totalMembers} member
          {totalMembers === 1 ? '' : 's'}
        </Tag>
      </div>

      {groups.length === 0 ? (
        <Empty>No active roles indexed for this chain.</Empty>
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
          >
            <Table columns={columns} rows={g.members} getRowKey={(r) => r.key} />
          </Card>
        ))
      )}
    </div>
  );
}
