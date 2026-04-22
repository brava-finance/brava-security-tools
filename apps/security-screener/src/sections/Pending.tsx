import { useEffect, useMemo, useState } from 'react';

import { Card } from '../components/Card';
import { Empty, ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useDashboardData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import {
  deriveActions,
  deriveFees,
  derivePools,
  deriveRolesFromLogger,
  deriveTokens,
  latestDelaySeconds,
} from '../lib/derive';
import {
  formatBigIntBasis,
  formatDurationSeconds,
  formatTimestamp,
  shortAddress,
} from '../lib/format';

interface Props {
  chain: ChainId;
}

export function Pending({ chain }: Props) {
  const chainCfg = CHAINS[chain];
  const query = useDashboardData(chain);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const delaySeconds = useMemo(
    () => (query.data !== undefined ? latestDelaySeconds(query.data) : undefined),
    [query.data]
  );

  if (query.isLoading) return <Loading label='Fetching pending proposals…' />;
  if (query.error !== null) return <ErrorPane error={query.error} />;
  if (query.data === undefined) return <Empty>No data returned from subgraph.</Empty>;

  const actionRows = deriveActions(query.data).filter((e) => e.status === 'pending');
  const poolRows = derivePools(query.data).filter((e) => e.status === 'pending');
  const feeRows = deriveFees(query.data).filter((e) => e.status === 'pending');
  const roleRows = deriveRolesFromLogger(query.data).filter((e) => e.status === 'pending');
  const tokenRows = deriveTokens(query.data).filter((e) => e.status === 'pending');

  const delayInfo =
    delaySeconds === undefined ? (
      <Tag variant='warn'>delay unknown</Tag>
    ) : (
      <Tag variant='accent'>delay = {formatDurationSeconds(Number(delaySeconds))}</Tag>
    );

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-xs text-[var(--color-text-muted)]'>
          A proposal is pending if it has been proposed but not yet granted, cancelled, or removed.
          Countdown is relative to the current delay.
        </p>
        {delayInfo}
      </div>

      <PendingCard
        title='Actions'
        rows={actionRows}
        delaySeconds={delaySeconds}
        now={now}
        columns={[
          {
            key: 'id',
            header: 'Action ID',
            render: (r) => <span className='mono'>{shortAddress(r.meta.actionId, 4)}</span>,
          },
          {
            key: 'impl',
            header: 'Implementation',
            render: (r) =>
              r.meta.actionAddress !== undefined ? (
                <AddressLink chain={chainCfg} address={r.meta.actionAddress} />
              ) : (
                <span className='text-[var(--color-text-faint)]'>—</span>
              ),
          },
          {
            key: 'at',
            header: 'Proposed at',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={chainCfg} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
      />

      <PendingCard
        title='Pools'
        rows={poolRows}
        delaySeconds={delaySeconds}
        now={now}
        columns={[
          {
            key: 'proto',
            header: 'Protocol ID',
            render: (r) => <span className='mono'>{r.meta.protocolId}</span>,
          },
          {
            key: 'pool',
            header: 'Pool',
            render: (r) => <AddressLink chain={chainCfg} address={r.meta.poolAddress} />,
          },
          {
            key: 'at',
            header: 'Proposed at',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={chainCfg} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
      />

      <PendingCard
        title='Fees'
        rows={feeRows}
        delaySeconds={delaySeconds}
        now={now}
        columns={[
          {
            key: 'recipient',
            header: 'Recipient',
            render: (r) => <AddressLink chain={chainCfg} address={r.meta.recipient} />,
          },
          {
            key: 'min',
            header: 'Min fee',
            render: (r) => <span className='mono'>{formatBigIntBasis(r.meta.minBasis)}</span>,
          },
          {
            key: 'max',
            header: 'Max fee',
            render: (r) => <span className='mono'>{formatBigIntBasis(r.meta.maxBasis)}</span>,
          },
          {
            key: 'at',
            header: 'Proposed at',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
        ]}
      />

      <PendingCard
        title='Roles'
        rows={roleRows}
        delaySeconds={delaySeconds}
        now={now}
        columns={[
          {
            key: 'role',
            header: 'Role',
            render: (r) => <span className='mono'>{r.meta.roleName}</span>,
          },
          {
            key: 'account',
            header: 'Account',
            render: (r) => <AddressLink chain={chainCfg} address={r.meta.account} />,
          },
          {
            key: 'at',
            header: 'Proposed at',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={chainCfg} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
      />

      <PendingCard
        title='Tokens'
        rows={tokenRows}
        delaySeconds={delaySeconds}
        now={now}
        columns={[
          {
            key: 'token',
            header: 'Token',
            render: (r) => <AddressLink chain={chainCfg} address={r.meta.token} />,
          },
          {
            key: 'at',
            header: 'Proposed at',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={chainCfg} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
      />
    </div>
  );
}

interface PendingRow {
  key: string;
  proposedAt?: string | undefined;
}

interface PendingCardProps<TRow extends PendingRow> {
  title: string;
  rows: TRow[];
  delaySeconds: bigint | undefined;
  now: number;
  columns: Array<Column<TRow>>;
}

function PendingCard<TRow extends PendingRow>({
  title,
  rows,
  delaySeconds,
  now,
  columns,
}: PendingCardProps<TRow>) {
  const countdownColumn: Column<TRow> = {
    key: 'countdown',
    header: 'Executable in',
    render: (r) => {
      if (r.proposedAt === undefined || delaySeconds === undefined) return <span>—</span>;
      const proposedAt = Number.parseInt(r.proposedAt, 10);
      const executableAt = proposedAt + Number(delaySeconds);
      const remaining = executableAt - now;
      if (remaining <= 0) {
        return <Tag variant='ok'>ready</Tag>;
      }
      return <Tag variant='warn'>{formatDurationSeconds(remaining)}</Tag>;
    },
  };
  return (
    <Card title={`Pending ${title.toLowerCase()} (${rows.length})`}>
      <Table
        columns={[...columns, countdownColumn]}
        rows={rows}
        getRowKey={(r) => r.key}
        empty={`No pending ${title.toLowerCase()} proposals.`}
      />
    </Card>
  );
}
