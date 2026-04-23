import { useMemo } from 'react';

import { Card } from '../components/Card';
import { ChainBadge } from '../components/ChainBadge';
import { ErrorPane, Loading, PartialWarning } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useMultiDashboardData, useMultiDivergenceData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId, type ViewId } from '../lib/config';
import {
  computeRoleDivergence,
  deriveRolesFromAccessControl,
  deriveRolesFromLogger,
} from '../lib/derive';
import type { RoleDivergence, RoleDivergenceReport } from '../lib/derive';
import { formatRelative, formatTimestamp } from '../lib/format';

interface Props {
  view: ViewId;
}

type ChainReport = { chain: ChainId; report: RoleDivergenceReport };

export function Divergence({ view }: Props) {
  const dashboard = useMultiDashboardData(view);
  const divergence = useMultiDivergenceData(view);
  const isMulti = view === 'all';

  const reports = useMemo<ChainReport[]>(() => {
    const out: ChainReport[] = [];
    for (const { chain, data } of divergence.chains) {
      const dashData = dashboard.chains.find((c) => c.chain === chain)?.data;
      if (dashData === undefined) continue;
      out.push({
        chain,
        report: computeRoleDivergence(
          deriveRolesFromLogger(dashData),
          deriveRolesFromAccessControl(data)
        ),
      });
    }
    return out;
  }, [dashboard.chains, divergence.chains]);

  const isLoading =
    dashboard.chains.length === 0 &&
    divergence.chains.length === 0 &&
    (dashboard.isLoading || divergence.isLoading);
  const error = dashboard.error ?? divergence.error;

  if (isLoading) return <Loading label='Comparing Logger vs AccessControl…' />;
  if (reports.length === 0 && error !== null) return <ErrorPane error={error} />;

  const totals = {
    drift: reports.reduce((s, r) => s + r.report.drift.length, 0),
    acOnly: reports.reduce((s, r) => s + r.report.acOnly.length, 0),
    loggerOnly: reports.reduce((s, r) => s + r.report.loggerOnly.length, 0),
  };

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          {totals.drift === 0 ? (
            <Tag variant='ok'>no drift</Tag>
          ) : (
            <Tag variant='bad'>{totals.drift} drift rows</Tag>
          )}
          <Tag variant='neutral'>{totals.acOnly} AC-only</Tag>
          <Tag variant='neutral'>{totals.loggerOnly} logger-only</Tag>
        </div>
        {(dashboard.isPartial || divergence.isPartial) && <PartialWarning />}
      </div>

      {reports.map(({ chain, report }) => (
        <ChainReportBlock key={chain} chain={chain} report={report} showHeader={isMulti} />
      ))}
    </div>
  );
}

function ChainReportBlock({
  chain,
  report,
  showHeader,
}: {
  chain: ChainId;
  report: RoleDivergenceReport;
  showHeader: boolean;
}) {
  const chainCfg = CHAINS[chain];
  const hasDrift = report.drift.length > 0;
  const hasAcOnly = report.acOnly.length > 0;
  const hasLoggerOnly = report.loggerOnly.length > 0;

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

  const driftBody = hasDrift ? (
    <Table columns={driftColumns} rows={report.drift} getRowKey={(r) => r.key} />
  ) : (
    <div className='px-4 py-3 flex items-center gap-2'>
      <Tag variant='ok'>clean</Tag>
      <span className='text-xs text-[var(--color-text-muted)]'>
        No role has conflicting Logger and AccessControl history.
      </span>
    </div>
  );

  return (
    <div className='grid gap-3'>
      <Card
        accent={chainCfg.color}
        title={
          <div className='flex items-center gap-2'>
            <span>Role drift (Logger vs AccessControl)</span>
            {showHeader && <ChainBadge chain={chain} variant='short' />}
          </div>
        }
        subtitle='Real disagreements between the Logger-derived view and AdminVault ground truth. Any row here means the two sources have seen conflicting activity for the same (role, account) — investigate immediately.'
        dense
      >
        {driftBody}
      </Card>

      {hasAcOnly && (
        <Card
          accent={chainCfg.color}
          title={
            <div className='flex items-center gap-2'>
              <span>Granted via AccessControl only ({report.acOnly.length})</span>
              {showHeader && <ChainBadge chain={chain} variant='short' />}
            </div>
          }
          subtitle='Role holders whose grant never flowed through the Logger. Expected for the AdminVault constructor (initial deploy emits a batch of RoleGranted events) and for any direct admin grants that skip the delay-protected flow. Listed here for auditability.'
          dense
        >
          <Table columns={acOnlyColumns} rows={report.acOnly} getRowKey={(r) => r.key} />
        </Card>
      )}

      {hasLoggerOnly && (
        <Card
          accent={chainCfg.color}
          title={
            <div className='flex items-center gap-2'>
              <span>Logger events without AccessControl counterpart ({report.loggerOnly.length})</span>
              {showHeader && <ChainBadge chain={chain} variant='short' />}
            </div>
          }
          subtitle="Logger recorded role activity but AdminVault AccessControl never emitted the matching event. Unexpected — likely indicates a phantom Logger event and is worth investigating."
          dense
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
