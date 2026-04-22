import { useMemo } from 'react';

import { Card } from '../components/Card';
import { Empty, ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Tag } from '../components/Tag';
import { Table } from '../components/Table';
import type { Column } from '../components/Table';
import { useDashboardData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import { deriveActions } from '../lib/derive';
import type { ActionMeta, DerivedEntry } from '../lib/derive';
import { formatRelative, formatTimestamp, shortAddress } from '../lib/format';

interface Props {
  chain: ChainId;
}

// Keys mirror ActionBase.ActionType values. Used for light colouring only —
// the canonical names come from the subgraph.
type ActionTypeTagVariant = 'ok' | 'warn' | 'bad' | 'accent' | 'neutral';

function variantForActionType(label: string | undefined): ActionTypeTagVariant {
  switch (label) {
    case 'DEPOSIT':
      return 'ok';
    case 'WITHDRAW':
      return 'warn';
    case 'SWAP':
      return 'accent';
    case 'FEE':
      return 'bad';
    default:
      return 'neutral';
  }
}

// A row is "incomplete" when any field that the subgraph normally resolves via
// on-chain calls came back null/undefined. These rows deserve a manual look —
// either the contract doesn't implement ActionBase, has no code at grant time,
// or was added to AdminVault under a protocol name that doesn't match any
// deployed action. The screener surfaces them with a warn-tinted row so they
// can be triaged without having to scan every entry.
function incompleteReasonForAction(meta: ActionMeta): string | undefined {
  const missing: string[] = [];
  if (meta.protocolName === undefined) missing.push('protocolName');
  if (meta.actionTypeName === undefined) missing.push('actionType');
  if (meta.actionAddress === undefined) missing.push('implementation');
  if (missing.length === 0) return undefined;
  return `Needs review — missing ${missing.join(', ')}`;
}

const INCOMPLETE_ROW_CLASS =
  'bg-[color-mix(in_srgb,var(--color-warn)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-warn)_14%,transparent)]';

export function Actions({ chain }: Props) {
  const chainCfg = CHAINS[chain];
  const query = useDashboardData(chain);

  const rows = useMemo<Array<DerivedEntry<ActionMeta>>>(() => {
    if (query.data === undefined) return [];
    return deriveActions(query.data)
      .filter((e) => e.status === 'active')
      .sort((a, b) => {
        // Group by protocol, then by action type, then most-recently-granted first.
        const ap = a.meta.protocolName ?? '\uFFFF';
        const bp = b.meta.protocolName ?? '\uFFFF';
        if (ap !== bp) return ap.localeCompare(bp);
        const at = a.meta.actionTypeName ?? '\uFFFF';
        const bt = b.meta.actionTypeName ?? '\uFFFF';
        if (at !== bt) return at.localeCompare(bt);
        return Number(b.grantedAt ?? 0) - Number(a.grantedAt ?? 0);
      });
  }, [query.data]);

  if (query.isLoading) return <Loading label='Fetching active actions…' />;
  if (query.error !== null) return <ErrorPane error={query.error} />;
  if (query.data === undefined) return <Empty>No data returned from subgraph.</Empty>;

  const reviewCount = rows.filter((r) => incompleteReasonForAction(r.meta) !== undefined).length;
  const reviewBadge = reviewCount > 0 ? <Tag variant='warn'>{reviewCount} need review</Tag> : null;

  const columns: Array<Column<(typeof rows)[number]>> = [
    {
      key: 'protocol',
      header: 'Protocol',
      render: (r) =>
        r.meta.protocolName !== undefined ? (
          <span className='text-[var(--color-text)]'>{r.meta.protocolName}</span>
        ) : (
          <span className='mono text-xs font-medium text-[var(--color-warn)]'>unresolved</span>
        ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) =>
        r.meta.actionTypeName !== undefined ? (
          <Tag variant={variantForActionType(r.meta.actionTypeName)}>{r.meta.actionTypeName}</Tag>
        ) : (
          <Tag variant='warn'>unresolved</Tag>
        ),
    },
    {
      key: 'id',
      header: 'Action ID',
      render: (r) => (
        <code
          className='text-[var(--color-text-muted)]'
          title={`Full action id: ${r.meta.actionId}`}
        >
          {shortAddress(r.meta.actionId, 4)}
        </code>
      ),
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
    <Card
      title={`Active actions (${rows.length})`}
      subtitle='Whitelisted action implementations callable by AdminVault. Protocol and type are resolved at index time via ActionBase.protocolName() and ActionBase.actionType() on the implementation contract. Rows highlighted in amber are missing on-chain metadata and should be reviewed.'
      actions={reviewBadge}
    >
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.key}
        empty='No actions are currently whitelisted.'
        rowClassName={(r) =>
          incompleteReasonForAction(r.meta) !== undefined ? INCOMPLETE_ROW_CLASS : undefined
        }
        rowTitle={(r) => incompleteReasonForAction(r.meta)}
      />
    </Card>
  );
}
