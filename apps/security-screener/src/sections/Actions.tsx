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
import { deriveActions, tagChain } from '../lib/derive';
import type { ActionMeta, ChainTagged, DerivedEntry } from '../lib/derive';
import { formatRelative, formatTimestamp, shortAddress } from '../lib/format';

interface Props {
  view: ViewId;
}

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

export function Actions({ view }: Props) {
  const query = useMultiDashboardData(view);
  const isMulti = view === 'all';

  const rows = useMemo<Array<ChainTagged<DerivedEntry<ActionMeta>>>>(() => {
    const out: Array<ChainTagged<DerivedEntry<ActionMeta>>> = [];
    for (const { chain, data } of query.chains) {
      const active = deriveActions(data).filter((e) => e.status === 'active');
      for (const e of tagChain(chain, active)) out.push(e);
    }
    return out.sort((a, b) => {
      // Group by protocol, then by action type, then most-recently-granted first.
      const ap = a.meta.protocolName ?? '\uFFFF';
      const bp = b.meta.protocolName ?? '\uFFFF';
      if (ap !== bp) return ap.localeCompare(bp);
      const at = a.meta.actionTypeName ?? '\uFFFF';
      const bt = b.meta.actionTypeName ?? '\uFFFF';
      if (at !== bt) return at.localeCompare(bt);
      if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
      return Number(b.grantedAt ?? 0) - Number(a.grantedAt ?? 0);
    });
  }, [query.chains]);

  if (query.chains.length === 0 && query.isLoading) {
    return <Loading label='Fetching active actions…' />;
  }
  if (query.chains.length === 0 && query.error !== null) return <ErrorPane error={query.error} />;
  if (query.chains.length === 0) return <Empty>No data returned from subgraph.</Empty>;

  const reviewCount = rows.filter((r) => incompleteReasonForAction(r.meta) !== undefined).length;

  const actions = (
    <div className='flex items-center gap-2'>
      {query.isPartial && <PartialWarning />}
      {reviewCount > 0 && <Tag variant='warn'>{reviewCount} need review</Tag>}
    </div>
  );

  const unresolvedNotice =
    reviewCount > 0 ? (
      <div className='border-b border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-warn)_6%,transparent)] px-4 py-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]'>
        <div className='mb-1 flex items-center gap-2'>
          <Tag variant='warn'>{reviewCount} unresolved</Tag>
          <span className='font-medium text-[var(--color-text)]'>What does "unresolved" mean?</span>
        </div>
        <p>
          An action shows up as unresolved when the screener couldn't read its
          <span className='mono'> protocolName </span> or
          <span className='mono'> actionType </span> via the standard ActionBase interface — usually
          because it's a custom action contract or one that doesn't follow the Brava interface.
          These rows do <strong>not</strong> imply the action is being executed; they just mean the
          screener can't categorise it from on-chain metadata alone.
        </p>
        <p className='mt-1'>
          The Brava team treats every unresolved action as an alert: it gets manually investigated
          and, in most cases, removed from the AdminVault whitelist. If an attacker controlled an
          unresolved action contract, the action would still be subject to the same delay and
          owner-Safe approval flow as any other; this row exists so users can independently verify
          that follow-up has happened. Cross-check the implementation address on the explorer
          before assuming anything.
        </p>
      </div>
    ) : null;

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
          <AddressLink chain={CHAINS[r.chain]} address={r.meta.actionAddress} />
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
    <Card
      title={`Active actions (${rows.length})`}
      subtitle='Whitelisted action implementations callable by AdminVault. Protocol and type are resolved at index time via ActionBase.protocolName() and ActionBase.actionType() on the implementation contract. Rows highlighted in amber are missing on-chain metadata and should be reviewed.'
      actions={actions}
      dense
    >
      {unresolvedNotice}
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
