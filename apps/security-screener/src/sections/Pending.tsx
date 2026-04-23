import { useEffect, useMemo, useState } from 'react';

import { Card } from '../components/Card';
import { ChainBadge } from '../components/ChainBadge';
import { Empty, ErrorPane, Loading, PartialWarning } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useMultiDashboardData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId, type ViewId } from '../lib/config';
import {
  deriveActions,
  deriveFees,
  derivePools,
  deriveRolesFromLogger,
  deriveTokens,
  latestDelaySeconds,
  tagChain,
} from '../lib/derive';
import type { ChainTagged, DerivedEntry } from '../lib/derive';
import type { DashboardResponse } from '../lib/queries';
import {
  formatBigIntBasis,
  formatDurationSeconds,
  formatTimestamp,
  shortAddress,
} from '../lib/format';

interface Props {
  view: ViewId;
}

export function Pending({ view }: Props) {
  const query = useMultiDashboardData(view);
  const isMulti = view === 'all';
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const delaysByChain = useMemo(() => {
    const map = new Map<ChainId, bigint | undefined>();
    for (const { chain, data } of query.chains) map.set(chain, latestDelaySeconds(data));
    return map;
  }, [query.chains]);

  const aggregated = useMemo(() => {
    const pending = <T,>(
      pick: (d: DashboardResponse) => Array<DerivedEntry<T>>
    ): Array<ChainTagged<DerivedEntry<T>>> => {
      const out: Array<ChainTagged<DerivedEntry<T>>> = [];
      for (const { chain, data } of query.chains) {
        const p = pick(data).filter((e) => e.status === 'pending');
        for (const e of tagChain(chain, p)) out.push(e);
      }
      return out;
    };
    return {
      actions: pending(deriveActions),
      pools: pending(derivePools),
      fees: pending(deriveFees),
      roles: pending(deriveRolesFromLogger),
      tokens: pending(deriveTokens),
    };
  }, [query.chains]);

  if (query.chains.length === 0 && query.isLoading) {
    return <Loading label='Fetching pending proposals…' />;
  }
  if (query.chains.length === 0 && query.error !== null) return <ErrorPane error={query.error} />;
  if (query.chains.length === 0) return <Empty>No data returned from subgraph.</Empty>;

  const delayPill = isMulti ? (
    <div className='flex flex-wrap gap-1'>
      {query.chains.map(({ chain }) => {
        const d = delaysByChain.get(chain);
        return (
          <Tag
            key={chain}
            variant='accent'
            className='flex items-center gap-1.5 normal-case tracking-normal'
          >
            <ChainBadge chain={chain} variant='dot' />
            <span>{d === undefined ? 'unknown' : formatDurationSeconds(Number(d))}</span>
          </Tag>
        );
      })}
    </div>
  ) : query.chains[0] !== undefined ? (
    (() => {
      const d = delaysByChain.get(query.chains[0].chain);
      return d === undefined ? (
        <Tag variant='warn'>delay unknown</Tag>
      ) : (
        <Tag variant='accent'>delay = {formatDurationSeconds(Number(d))}</Tag>
      );
    })()
  ) : null;

  const chainCol: Column<ChainTagged<DerivedEntry<unknown>>> = {
    key: 'chain',
    header: 'Chain',
    render: (r) => <ChainBadge chain={r.chain} variant='short' />,
  };

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-xs leading-relaxed text-[var(--color-text-muted)]'>
          A proposal is pending if it has been proposed but not yet granted, cancelled, or removed.
          Countdown is relative to the current delay.
        </p>
        <div className='flex items-center gap-2'>
          {query.isPartial && <PartialWarning />}
          {delayPill}
        </div>
      </div>

      <PendingCard
        title='Actions'
        rows={aggregated.actions}
        delaysByChain={delaysByChain}
        now={now}
        isMulti={isMulti}
        extraColumns={[
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
                <AddressLink chain={CHAINS[r.chain]} address={r.meta.actionAddress} />
              ) : (
                <span className='text-[var(--color-text-faint)]'>—</span>
              ),
          },
          {
            key: 'at',
            header: 'Proposed',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={CHAINS[r.chain]} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
        chainCol={chainCol}
      />

      <PendingCard
        title='Pools'
        rows={aggregated.pools}
        delaysByChain={delaysByChain}
        now={now}
        isMulti={isMulti}
        extraColumns={[
          {
            key: 'proto',
            header: 'Protocol ID',
            render: (r) => <span className='mono'>{shortAddress(r.meta.protocolId, 4)}</span>,
          },
          {
            key: 'pool',
            header: 'Pool',
            render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.meta.poolAddress} />,
          },
          {
            key: 'at',
            header: 'Proposed',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={CHAINS[r.chain]} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
        chainCol={chainCol}
      />

      <PendingCard
        title='Fees'
        rows={aggregated.fees}
        delaysByChain={delaysByChain}
        now={now}
        isMulti={isMulti}
        extraColumns={[
          {
            key: 'recipient',
            header: 'Recipient',
            render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.meta.recipient} />,
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
            header: 'Proposed',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
        ]}
        chainCol={chainCol}
      />

      <PendingCard
        title='Roles'
        rows={aggregated.roles}
        delaysByChain={delaysByChain}
        now={now}
        isMulti={isMulti}
        extraColumns={[
          {
            key: 'role',
            header: 'Role',
            render: (r) => <span className='mono'>{r.meta.roleName}</span>,
          },
          {
            key: 'account',
            header: 'Account',
            render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.meta.account} />,
          },
          {
            key: 'at',
            header: 'Proposed',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={CHAINS[r.chain]} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
        chainCol={chainCol}
      />

      <PendingCard
        title='Tokens'
        rows={aggregated.tokens}
        delaysByChain={delaysByChain}
        now={now}
        isMulti={isMulti}
        extraColumns={[
          {
            key: 'token',
            header: 'Token',
            render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.meta.token} />,
          },
          {
            key: 'at',
            header: 'Proposed',
            render: (r) => (r.proposedAt !== undefined ? formatTimestamp(r.proposedAt) : '—'),
          },
          {
            key: 'tx',
            header: 'Tx',
            render: (r) =>
              r.proposedTx !== undefined ? (
                <TxLink chain={CHAINS[r.chain]} txHash={r.proposedTx} />
              ) : (
                <span>—</span>
              ),
          },
        ]}
        chainCol={chainCol}
      />
    </div>
  );
}

interface PendingRowLike {
  key: string;
  chain: ChainId;
  proposedAt?: string;
}

interface PendingCardProps<TRow extends PendingRowLike> {
  title: string;
  rows: TRow[];
  delaysByChain: Map<ChainId, bigint | undefined>;
  now: number;
  isMulti: boolean;
  extraColumns: Array<Column<TRow>>;
  chainCol: Column<ChainTagged<DerivedEntry<unknown>>>;
}

function PendingCard<TRow extends PendingRowLike>({
  title,
  rows,
  delaysByChain,
  now,
  isMulti,
  extraColumns,
  chainCol,
}: PendingCardProps<TRow>) {
  const countdownColumn: Column<TRow> = {
    key: 'countdown',
    header: 'Executable in',
    render: (r) => {
      const delaySeconds = delaysByChain.get(r.chain);
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
  const columns: Array<Column<TRow>> = [
    ...(isMulti ? [chainCol as unknown as Column<TRow>] : []),
    ...extraColumns,
    countdownColumn,
  ];
  return (
    <Card title={`Pending ${title.toLowerCase()} (${rows.length})`} dense>
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.key}
        empty={`No pending ${title.toLowerCase()} proposals.`}
      />
    </Card>
  );
}
