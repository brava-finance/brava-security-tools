import { useMemo } from 'react';

import { Card } from '../components/Card';
import { ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useDashboardData, useDivergenceData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import {
  computeRoleDivergence,
  deriveRolesFromAccessControl,
  deriveRolesFromLogger,
} from '../lib/derive';
import type { RoleDivergence, RoleDivergenceReport } from '../lib/derive';
import { formatRelative, formatTimestamp } from '../lib/format';

interface Props {
  chain: ChainId;
}

const EMPTY_REPORT: RoleDivergenceReport = { drift: [], acOnly: [], loggerOnly: [] };

export function Divergence({ chain }: Props) {
  const chainCfg = CHAINS[chain];
  const dashboard = useDashboardData(chain);
  const divergence = useDivergenceData(chain);

  const report = useMemo<RoleDivergenceReport>(() => {
    if (dashboard.data === undefined || divergence.data === undefined) return EMPTY_REPORT;
    return computeRoleDivergence(
      deriveRolesFromLogger(dashboard.data),
      deriveRolesFromAccessControl(divergence.data)
    );
  }, [dashboard.data, divergence.data]);

  const isLoading = dashboard.isLoading || divergence.isLoading;
  const error = dashboard.error ?? divergence.error;

  // Two-sided comparison columns — only useful for genuine drift.
  const driftColumns: Array<Column<RoleDivergence>> = [
    {
      key: 'role',
      header: 'Role',
      render: (r) => <span className='mono text-xs'>{r.roleName}</span>,
    },
    {
      key: 'account',
      header: 'Account',
      render: (r) => <AddressLink chain={chainCfg} address={r.account} />,
    },
    {
      key: 'logger',
      header: 'Logger view',
      render: (r) => (
        <div className='flex flex-col gap-1'>
          <StatusTag status={r.loggerStatus} />
          {r.loggerLastAt !== undefined && (
            <span
              className='text-[10px] text-[var(--color-text-faint)]'
              title={formatTimestamp(r.loggerLastAt)}
            >
              {formatRelative(r.loggerLastAt)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'ac',
      header: 'AccessControl view',
      render: (r) => (
        <div className='flex flex-col gap-1'>
          <StatusTag status={r.accessControlStatus} />
          {r.accessControlLastAt !== undefined && (
            <span
              className='text-[10px] text-[var(--color-text-faint)]'
              title={formatTimestamp(r.accessControlLastAt)}
            >
              {formatRelative(r.accessControlLastAt)}
            </span>
          )}
        </div>
      ),
    },
  ];

  // One-sided (acOnly) — show the AC grant details without the "missing vs
  // active" comparison that would look alarming.
  const acOnlyColumns: Array<Column<RoleDivergence>> = [
    {
      key: 'role',
      header: 'Role',
      render: (r) => <span className='mono text-xs'>{r.roleName}</span>,
    },
    {
      key: 'account',
      header: 'Account',
      render: (r) => <AddressLink chain={chainCfg} address={r.account} />,
    },
    {
      key: 'granted',
      header: 'Granted',
      render: (r) =>
        r.accessControlLastAt === undefined ? (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ) : (
          <span title={formatTimestamp(r.accessControlLastAt)}>
            {formatRelative(r.accessControlLastAt)}
          </span>
        ),
    },
    {
      key: 'grantedBy',
      header: 'Granted by',
      render: (r) =>
        r.accessControlSender !== undefined ? (
          <AddressLink chain={chainCfg} address={r.accessControlSender} />
        ) : (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ),
    },
    {
      key: 'tx',
      header: 'Tx',
      render: (r) =>
        r.accessControlLastTx !== undefined ? (
          <TxLink chain={chainCfg} txHash={r.accessControlLastTx} />
        ) : (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ),
    },
  ];

  // One-sided (loggerOnly) — inverse of above. Phantom Logger events with no
  // AC counterpart.
  const loggerOnlyColumns: Array<Column<RoleDivergence>> = [
    {
      key: 'role',
      header: 'Role',
      render: (r) => <span className='mono text-xs'>{r.roleName}</span>,
    },
    {
      key: 'account',
      header: 'Account',
      render: (r) => <AddressLink chain={chainCfg} address={r.account} />,
    },
    {
      key: 'status',
      header: 'Logger status',
      render: (r) => <StatusTag status={r.loggerStatus} />,
    },
    {
      key: 'last',
      header: 'Last Logger event',
      render: (r) =>
        r.loggerLastAt === undefined ? (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ) : (
          <span title={formatTimestamp(r.loggerLastAt)}>{formatRelative(r.loggerLastAt)}</span>
        ),
    },
    {
      key: 'tx',
      header: 'Tx',
      render: (r) =>
        r.loggerLastTx !== undefined ? (
          <TxLink chain={chainCfg} txHash={r.loggerLastTx} />
        ) : (
          <span className='text-[var(--color-text-faint)]'>—</span>
        ),
    },
  ];

  const hasDrift = report.drift.length > 0;
  const hasAcOnly = report.acOnly.length > 0;
  const hasLoggerOnly = report.loggerOnly.length > 0;

  let driftBody: React.ReactNode;
  if (isLoading) {
    driftBody = <Loading label='Comparing Logger vs AccessControl…' />;
  } else if (error !== null) {
    driftBody = <ErrorPane error={error} />;
  } else if (!hasDrift) {
    driftBody = (
      <div className='flex items-center gap-2'>
        <Tag variant='ok'>clean</Tag>
        <span className='text-xs text-[var(--color-text-muted)]'>
          No role has conflicting Logger and AccessControl history.
        </span>
      </div>
    );
  } else {
    driftBody = <Table columns={driftColumns} rows={report.drift} getRowKey={(r) => r.key} />;
  }

  const showAcOnlyCard = !isLoading && error === null && hasAcOnly;
  const showLoggerOnlyCard = !isLoading && error === null && hasLoggerOnly;

  return (
    <div className='grid gap-4'>
      <Card
        title='Role drift (Logger vs AccessControl)'
        subtitle='Real disagreements between the Logger-derived view and AdminVault ground truth. Any row here means the two sources have seen conflicting activity for the same (role, account) — investigate immediately.'
      >
        {driftBody}
      </Card>

      {showAcOnlyCard && (
        <Card
          title={`Granted via AccessControl only (${report.acOnly.length})`}
          subtitle='Role holders whose grant never flowed through the Logger. Expected for the AdminVault constructor (initial deploy emits a batch of RoleGranted events) and for any direct admin grants that skip the delay-protected flow. Listed here for auditability.'
        >
          <Table columns={acOnlyColumns} rows={report.acOnly} getRowKey={(r) => r.key} />
        </Card>
      )}

      {showLoggerOnlyCard && (
        <Card
          title={`Logger events without AccessControl counterpart (${report.loggerOnly.length})`}
          subtitle='Logger recorded role activity but AdminVault AccessControl never emitted the matching event. Unexpected — likely indicates a phantom Logger event and is worth investigating.'
        >
          <Table columns={loggerOnlyColumns} rows={report.loggerOnly} getRowKey={(r) => r.key} />
        </Card>
      )}
    </div>
  );
}

function StatusTag({
  status,
}: {
  status: RoleDivergence['loggerStatus'] | RoleDivergence['accessControlStatus'];
}) {
  switch (status) {
    case 'active':
      return <Tag variant='ok'>active</Tag>;
    case 'pending':
      return <Tag variant='warn'>pending</Tag>;
    case 'cancelled':
      return <Tag variant='neutral'>cancelled</Tag>;
    case 'removed':
      return <Tag variant='bad'>removed</Tag>;
    case 'missing':
    default:
      return <Tag variant='bad'>missing</Tag>;
  }
}
