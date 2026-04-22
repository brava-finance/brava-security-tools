import { useMemo } from 'react';

import { Card } from '../components/Card';
import { Empty, ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Tag } from '../components/Tag';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { useDashboardData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import { deriveTokens } from '../lib/derive';
import type { DerivedEntry, TokenMeta } from '../lib/derive';
import { formatRelative, formatTimestamp } from '../lib/format';

interface Props {
  chain: ChainId;
}

// ActionBase / SendToken use this sentinel to mean "native gas token".
// IERC20Metadata() calls revert on it (no code), so the subgraph cannot
// enrich it — hardcode the label here instead.
const NATIVE_GAS_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function isNativeGasToken(address: string): boolean {
  return address.toLowerCase() === NATIVE_GAS_SENTINEL;
}

// Token is flagged for review if name/symbol/decimals weren't resolvable at
// grant time (non-ERC20 contract, no code, or reverting). The native-gas
// sentinel is deliberately excluded — it always fails IERC20Metadata and is
// expected to be unresolved.
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

export function Tokens({ chain }: Props) {
  const chainCfg = CHAINS[chain];
  const query = useDashboardData(chain);

  const rows = useMemo<Array<DerivedEntry<TokenMeta>>>(() => {
    if (query.data === undefined) return [];
    return deriveTokens(query.data)
      .filter((e) => e.status === 'active')
      .sort((a, b) => {
        const aLabel = (a.meta.tokenSymbol ?? a.meta.tokenName ?? a.meta.token).toLowerCase();
        const bLabel = (b.meta.tokenSymbol ?? b.meta.tokenName ?? b.meta.token).toLowerCase();
        if (aLabel !== bLabel) return aLabel.localeCompare(bLabel);
        return Number(b.grantedAt ?? 0) - Number(a.grantedAt ?? 0);
      });
  }, [query.data]);

  if (query.isLoading) return <Loading label='Fetching active tokens…' />;
  if (query.error !== null) return <ErrorPane error={query.error} />;
  if (query.data === undefined) return <Empty>No data returned from subgraph.</Empty>;

  const reviewCount = rows.filter((r) => incompleteReasonForToken(r.meta) !== undefined).length;
  const reviewBadge = reviewCount > 0 ? <Tag variant='warn'>{reviewCount} need review</Tag> : null;

  const columns: Array<Column<(typeof rows)[number]>> = [
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
      render: (r) => <AddressLink chain={chainCfg} address={r.meta.token} />,
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
      title={`Active tokens (${rows.length})`}
      subtitle='Tokens approved in the transaction registry — any not listed here cannot be moved through AdminVault-mediated transactions. Rows highlighted in amber are missing on-chain metadata and should be reviewed.'
      actions={reviewBadge}
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
