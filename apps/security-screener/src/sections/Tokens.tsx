import { useMemo } from 'react';

import { Card } from '../components/Card';
import { ChainBadge } from '../components/ChainBadge';
import { Empty, ErrorPane, Loading, PartialWarning } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { useMultiDashboardData } from '../hooks/useSubgraphData';
import { CHAINS, type ViewId } from '../lib/config';
import { deriveTokens, tagChain } from '../lib/derive';
import type { ChainTagged, DerivedEntry, TokenMeta } from '../lib/derive';
import { formatRelative, formatTimestamp } from '../lib/format';

interface Props {
  view: ViewId;
}

// ActionBase / SendToken use this sentinel to mean "native gas token".
// IERC20Metadata() calls revert on it (no code), so the subgraph cannot
// enrich it — hardcode the label here instead.
const NATIVE_GAS_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function isNativeGasToken(address: string): boolean {
  return address.toLowerCase() === NATIVE_GAS_SENTINEL;
}

function incompleteReasonForToken(meta: TokenMeta): string | undefined {
  if (isNativeGasToken(meta.token)) return undefined;
  const missing: string[] = [];
  if (meta.tokenSymbol === undefined) missing.push('symbol');
  if (meta.tokenName === undefined) missing.push('name');
  if (meta.tokenDecimals === undefined) missing.push('decimals');
  if (missing.length === 0) return undefined;
  return `Needs review — missing ${missing.join(', ')}`;
}

const INCOMPLETE_ROW_CLASS =
  'bg-[color-mix(in_srgb,var(--color-warn)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-warn)_14%,transparent)]';

export function Tokens({ view }: Props) {
  const query = useMultiDashboardData(view);
  const isMulti = view === 'all';

  const rows = useMemo<Array<ChainTagged<DerivedEntry<TokenMeta>>>>(() => {
    const out: Array<ChainTagged<DerivedEntry<TokenMeta>>> = [];
    for (const { chain, data } of query.chains) {
      const active = deriveTokens(data).filter((e) => e.status === 'active');
      for (const e of tagChain(chain, active)) out.push(e);
    }
    return out.sort((a, b) => {
      const aLabel = (a.meta.tokenSymbol ?? a.meta.tokenName ?? a.meta.token).toLowerCase();
      const bLabel = (b.meta.tokenSymbol ?? b.meta.tokenName ?? b.meta.token).toLowerCase();
      if (aLabel !== bLabel) return aLabel.localeCompare(bLabel);
      if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
      return Number(b.grantedAt ?? 0) - Number(a.grantedAt ?? 0);
    });
  }, [query.chains]);

  if (query.chains.length === 0 && query.isLoading) {
    return <Loading label='Fetching active tokens…' />;
  }
  if (query.chains.length === 0 && query.error !== null) return <ErrorPane error={query.error} />;
  if (query.chains.length === 0) return <Empty>No data returned from subgraph.</Empty>;

  const reviewCount = rows.filter((r) => incompleteReasonForToken(r.meta) !== undefined).length;
  const actions = (
    <div className='flex items-center gap-2'>
      {query.isPartial && <PartialWarning />}
      {reviewCount > 0 && <Tag variant='warn'>{reviewCount} need review</Tag>}
    </div>
  );

  const columns: Array<Column<(typeof rows)[number]>> = [
    ...(isMulti
      ? [
          {
            key: 'chain',
            header: 'Chain',
            render: (r: (typeof rows)[number]) => <ChainBadge chain={r.chain} variant='short' />,
          } satisfies Column<(typeof rows)[number]>,
        ]
      : []),
    {
      key: 'symbol',
      header: 'Symbol',
      render: (r) => {
        const native = isNativeGasToken(r.meta.token);
        if (native) {
          return <span className='text-[var(--color-text)]'>ETH</span>;
        }
        if (r.meta.tokenSymbol !== undefined) {
          return <span className='text-[var(--color-text)]'>{r.meta.tokenSymbol}</span>;
        }
        return <span className='text-xs font-medium text-[var(--color-warn)]'>unresolved</span>;
      },
    },
    {
      key: 'name',
      header: 'Name',
      render: (r) => {
        const native = isNativeGasToken(r.meta.token);
        if (native) {
          return <span className='text-[var(--color-text-muted)]'>Native gas token</span>;
        }
        if (r.meta.tokenName !== undefined) {
          return <span className='text-[var(--color-text-muted)]'>{r.meta.tokenName}</span>;
        }
        return <span className='text-xs font-medium text-[var(--color-warn)]'>unresolved</span>;
      },
    },
    {
      key: 'decimals',
      header: 'Decimals',
      render: (r) => {
        const native = isNativeGasToken(r.meta.token);
        if (r.meta.tokenDecimals !== undefined) {
          return (
            <span className='mono text-xs text-[var(--color-text-muted)]'>
              {r.meta.tokenDecimals}
            </span>
          );
        }
        if (native) return <span className='text-[var(--color-text-faint)]'>—</span>;
        return <span className='text-xs font-medium text-[var(--color-warn)]'>unresolved</span>;
      },
    },
    {
      key: 'token',
      header: 'Address',
      render: (r) => <AddressLink chain={CHAINS[r.chain]} address={r.meta.token} />,
    },
    {
      key: 'at',
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
    <Card
      title={`Active tokens (${rows.length})`}
      subtitle='Tokens approved in the transaction registry — any not listed here cannot be moved through AdminVault-mediated transactions. Rows highlighted in amber are missing on-chain metadata and should be reviewed.'
      actions={actions}
      dense
    >
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.key}
        empty='No tokens registered.'
        rowClassName={(r) =>
          incompleteReasonForToken(r.meta) !== undefined ? INCOMPLETE_ROW_CLASS : undefined
        }
        rowTitle={(r) => incompleteReasonForToken(r.meta)}
      />
    </Card>
  );
}
