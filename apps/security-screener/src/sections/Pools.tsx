import { useMemo } from 'react';

import { Card } from '../components/Card';
import { Empty, ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Tag } from '../components/Tag';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { useDashboardData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import { derivePools } from '../lib/derive';
import type { DerivedEntry, PoolMeta } from '../lib/derive';
import { formatRelative, formatTimestamp } from '../lib/format';

interface Props {
  chain: ChainId;
}

// Matches the highlighting contract in Actions.tsx: a pool is "incomplete"
// when the subgraph could not resolve either the protocol name (no action
// whitelisted under the same protocolId — i.e. AdminVault points at an
// unreachable pool) or the token metadata (ERC-20 calls reverted at grant
// block — usually means no code at that address).
function incompleteReasonForPool(meta: PoolMeta): string | undefined {
  const missing: string[] = [];
  if (meta.protocolName === undefined) missing.push('protocol');
  if (meta.tokenSymbol === undefined && meta.tokenName === undefined)
    missing.push('token metadata');
  if (missing.length === 0) return undefined;
  return `Needs review — missing ${missing.join(', ')}`;
}

const INCOMPLETE_ROW_CLASS =
  'bg-[color-mix(in_srgb,var(--color-warn)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-warn)_14%,transparent)]';

export function Pools({ chain }: Props) {
  const chainCfg = CHAINS[chain];
  const query = useDashboardData(chain);

  const rows = useMemo<Array<DerivedEntry<PoolMeta>>>(() => {
    if (query.data === undefined) return [];
    return derivePools(query.data)
      .filter((e) => e.status === 'active')
      .sort((a, b) => {
        const ap = a.meta.protocolName ?? '\uFFFF';
        const bp = b.meta.protocolName ?? '\uFFFF';
        if (ap !== bp) return ap.localeCompare(bp);
        const as = a.meta.tokenSymbol ?? a.meta.tokenName ?? a.meta.poolAddress;
        const bs = b.meta.tokenSymbol ?? b.meta.tokenName ?? b.meta.poolAddress;
        return as.localeCompare(bs);
      });
  }, [query.data]);

  if (query.isLoading) return <Loading label='Fetching active pools…' />;
  if (query.error !== null) return <ErrorPane error={query.error} />;
  if (query.data === undefined) return <Empty>No data returned from subgraph.</Empty>;

  const reviewCount = rows.filter((r) => incompleteReasonForPool(r.meta) !== undefined).length;
  const reviewBadge = reviewCount > 0 ? <Tag variant='warn'>{reviewCount} need review</Tag> : null;

  const columns: Array<Column<(typeof rows)[number]>> = [
    {
      key: 'proto',
      header: 'Protocol',
      render: (r) =>
        r.meta.protocolName !== undefined ? (
          <span className='text-[var(--color-text)]'>{r.meta.protocolName}</span>
        ) : (
          <span
            className='mono text-xs font-medium text-[var(--color-warn)]'
            title={`Protocol id ${r.meta.protocolId}`}
          >
            unresolved
          </span>
        ),
    },
    {
      key: 'token',
      header: 'Token',
      render: (r) => {
        const symbol = r.meta.tokenSymbol;
        const name = r.meta.tokenName;
        if (symbol === undefined && name === undefined) {
          return <span className='text-xs font-medium text-[var(--color-warn)]'>unresolved</span>;
        }
        const primary = symbol ?? name ?? '';
        const secondary = symbol !== undefined && name !== undefined && symbol !== name ? name : '';
        return (
          <span className='flex flex-col leading-tight'>
            <span className='text-[var(--color-text)]'>{primary}</span>
            {secondary.length > 0 ? (
              <span className='text-[10px] text-[var(--color-text-faint)]'>{secondary}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'pool',
      header: 'Pool',
      render: (r) => <AddressLink chain={chainCfg} address={r.meta.poolAddress} />,
    },
    {
      key: 'at',
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
    <Card
      title={`Active pools (${rows.length})`}
      subtitle='Whitelisted deposit/withdraw targets. Protocol name is resolved from any action grant for the same protocolId; token name / symbol come from IERC20Metadata on the pool address at grant time. Rows highlighted in amber are missing on-chain metadata and should be reviewed.'
      actions={reviewBadge}
    >
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.key}
        empty='No pools whitelisted.'
        rowClassName={(r) =>
          incompleteReasonForPool(r.meta) !== undefined ? INCOMPLETE_ROW_CLASS : undefined
        }
        rowTitle={(r) => incompleteReasonForPool(r.meta)}
      />
    </Card>
  );
}
