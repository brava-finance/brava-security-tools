import { useMemo, useState } from 'react';

import { Card } from '../components/Card';
import { Empty, ErrorPane, Loading } from '../components/DataState';
import { AddressLink, TxLink } from '../components/ExplorerLink';
import { Tag } from '../components/Tag';
import { useDashboardData, useDivergenceData } from '../hooks/useSubgraphData';
import { CHAINS, type ChainId } from '../lib/config';
import {
  cn,
  formatBigIntBasis,
  formatRelative,
  formatTimestamp,
  shortAddress,
} from '../lib/format';

type Category = 'action' | 'pool' | 'fee' | 'role' | 'token' | 'proxy' | 'safe' | 'delay';

interface TimelineEvent {
  id: string;
  // Raw subgraph entity id = `txHash || logIndex (LE)`, used only for sorting so
  // that events within the same block respect on-chain log order (later log
  // index, e.g. grant following propose in the same tx, shows as more recent).
  sortKey: string;
  category: Category;
  kind: string;
  summary: React.ReactNode;
  blockNumber: string;
  blockTimestamp: string;
  txHash: string;
}

interface Props {
  chain: ChainId;
}

const CATEGORY_LABEL: Record<Category, string> = {
  action: 'Action',
  pool: 'Pool',
  fee: 'Fee',
  role: 'Role',
  token: 'Token',
  proxy: 'Proxy',
  safe: 'Safe',
  delay: 'Delay',
};

const CATEGORY_VARIANT: Record<Category, 'ok' | 'warn' | 'bad' | 'accent' | 'neutral'> = {
  action: 'accent',
  pool: 'accent',
  fee: 'warn',
  role: 'ok',
  token: 'accent',
  proxy: 'bad',
  safe: 'warn',
  delay: 'warn',
};

export function Timeline({ chain }: Props) {
  const chainCfg = CHAINS[chain];
  const dashboard = useDashboardData(chain);
  const divergence = useDivergenceData(chain);

  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => new Set(Object.keys(CATEGORY_LABEL) as Category[])
  );

  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = [];
    const d = dashboard.data;
    // Captures the subgraph entity id so the final sort can break same-block
    // ties by on-chain log order (see TimelineEvent.sortKey).
    const push = (
      prefix: string,
      e: { id: string; blockNumber: string; blockTimestamp: string; txHash: string },
      category: Category,
      kind: string,
      summary: React.ReactNode
    ): void => {
      events.push({
        id: `${prefix}-${e.id}`,
        sortKey: e.id,
        category,
        kind,
        summary,
        blockNumber: e.blockNumber,
        blockTimestamp: e.blockTimestamp,
        txHash: e.txHash,
      });
    };
    // Enrichment lookup maps from the aggregate entities: the subgraph
    // resolves protocol/type/token names at grant time via on-chain try_
    // calls, and we reuse them here so the timeline reads as "Grant action
    // AaveV3 · DEPOSIT" instead of "Grant action 0x12ab…".
    const actionLabelById = new Map<string, string>();
    const poolLabelByKey = new Map<string, string>();
    if (d !== undefined) {
      for (const a of d.actions) {
        if (a.displayName !== null) {
          actionLabelById.set(a.actionId.toLowerCase(), a.displayName);
        }
      }
      for (const p of d.pools) {
        const key = `${p.protocolId}:${p.poolAddress.toLowerCase()}`;
        if (p.displayName !== null) {
          poolLabelByKey.set(key, p.displayName);
        }
      }
    }
    const actionLabel = (actionId: string): string | undefined =>
      actionLabelById.get(actionId.toLowerCase());
    const poolLabel = (protocolId: string, poolAddress: string): string | undefined =>
      poolLabelByKey.get(`${protocolId}:${poolAddress.toLowerCase()}`);
    if (d !== undefined) {
      const actionTag = (actionId: string): React.ReactNode => {
        const label = actionLabel(actionId);
        if (label === undefined) return <code>{shortAddress(actionId, 4)}</code>;
        return (
          <>
            <strong className='text-[var(--color-text)]'>{label}</strong>{' '}
            <code
              className='text-[10px] text-[var(--color-text-faint)]'
              title={`action id ${actionId}`}
            >
              {shortAddress(actionId, 4)}
            </code>
          </>
        );
      };
      const poolTag = (protocolId: string, poolAddress: string): React.ReactNode => {
        const label = poolLabel(protocolId, poolAddress);
        const link = <AddressLink chain={chainCfg} address={poolAddress} />;
        if (label === undefined) return link;
        return (
          <>
            <strong className='text-[var(--color-text)]'>{label}</strong> ({link})
          </>
        );
      };

      for (const e of d.actionProposals)
        push(
          'ap',
          e,
          'action',
          'propose',
          <span>
            Propose action {actionTag(e.actionId)}
            {e.actionAddress !== undefined ? (
              <>
                {' '}
                → <AddressLink chain={chainCfg} address={e.actionAddress} />
              </>
            ) : null}
          </span>
        );
      for (const e of d.actionGrants)
        push('ag', e, 'action', 'grant', <span>Grant action {actionTag(e.actionId)}</span>);
      for (const e of d.actionCancels)
        push('ac', e, 'action', 'cancel', <span>Cancel action {actionTag(e.actionId)}</span>);
      for (const e of d.actionRemoves)
        push('ar', e, 'action', 'remove', <span>Remove action {actionTag(e.actionId)}</span>);

      for (const e of d.poolProposals)
        push(
          'pp',
          e,
          'pool',
          'propose',
          <span>Propose pool {poolTag(e.protocolId, e.poolAddress)}</span>
        );
      for (const e of d.poolGrants)
        push(
          'pg',
          e,
          'pool',
          'grant',
          <span>Grant pool {poolTag(e.protocolId, e.poolAddress)}</span>
        );
      for (const e of d.poolCancels)
        push(
          'pc',
          e,
          'pool',
          'cancel',
          <span>Cancel pool {poolTag(e.protocolId, e.poolAddress)}</span>
        );
      for (const e of d.poolRemoves)
        push(
          'pr',
          e,
          'pool',
          'remove',
          <span>Remove pool {poolTag(e.protocolId, e.poolAddress)}</span>
        );

      for (const e of d.feeProposals)
        push(
          'fp',
          e,
          'fee',
          'propose',
          <span>
            Propose fee {formatBigIntBasis(e.minBasis)}–{formatBigIntBasis(e.maxBasis)} →{' '}
            <AddressLink chain={chainCfg} address={e.recipient} />
          </span>
        );
      for (const e of d.feeGrants)
        push(
          'fg',
          e,
          'fee',
          'grant',
          <span>
            Grant fee {formatBigIntBasis(e.minBasis)}–{formatBigIntBasis(e.maxBasis)} →{' '}
            <AddressLink chain={chainCfg} address={e.recipient} />
          </span>
        );
      for (const e of d.feeCancels)
        push(
          'fc',
          e,
          'fee',
          'cancel',
          <span>
            Cancel fee → <AddressLink chain={chainCfg} address={e.recipient} />
          </span>
        );

      for (const e of d.roleProposalsFromLogger)
        push(
          'rp',
          e,
          'role',
          'propose',
          <span>
            Propose role <code>{e.roleName}</code> →{' '}
            <AddressLink chain={chainCfg} address={e.account} />
          </span>
        );
      for (const e of d.roleGrantsFromLogger)
        push(
          'rg',
          e,
          'role',
          'grant',
          <span>
            Grant role <code>{e.roleName}</code> →{' '}
            <AddressLink chain={chainCfg} address={e.account} />
          </span>
        );
      for (const e of d.roleCancelsFromLogger)
        push(
          'rc',
          e,
          'role',
          'cancel',
          <span>
            Cancel role proposal <code>{e.roleName}</code> →{' '}
            <AddressLink chain={chainCfg} address={e.account} />
          </span>
        );
      for (const e of d.roleRevokesFromLogger)
        push(
          'rr',
          e,
          'role',
          'revoke',
          <span>
            Revoke role <code>{e.roleName}</code> ←{' '}
            <AddressLink chain={chainCfg} address={e.account} />
          </span>
        );

      // AccessControl-sourced role events (ground truth on-chain). Without
      // these the timeline misses every constructor / direct grant that
      // bypasses the Logger (e.g. the initial deploy emits ~20 grants through
      // AccessControl only).
      const ac = divergence.data;
      if (ac !== undefined) {
        for (const e of ac.roleGrantsFromAccessControl)
          push(
            'acg',
            e,
            'role',
            'grant (AccessControl)',
            <span>
              Grant role <code>{e.roleName}</code> →{' '}
              <AddressLink chain={chainCfg} address={e.account} /> by{' '}
              <AddressLink chain={chainCfg} address={e.sender} />
            </span>
          );
        for (const e of ac.roleRevokesFromAccessControl)
          push(
            'acr',
            e,
            'role',
            'revoke (AccessControl)',
            <span>
              Revoke role <code>{e.roleName}</code> ←{' '}
              <AddressLink chain={chainCfg} address={e.account} /> by{' '}
              <AddressLink chain={chainCfg} address={e.sender} />
            </span>
          );
        for (const e of ac.roleAdminChanges)
          push(
            'aca',
            e,
            'role',
            'admin-change',
            <span>
              Role <code>{e.roleName}</code> admin changed{' '}
              <code>{shortAddress(e.previousAdminRole, 4)}</code> →{' '}
              <code>{shortAddress(e.newAdminRole, 4)}</code>
            </span>
          );
      }

      for (const e of d.tokenProposals)
        push(
          'tp',
          e,
          'token',
          'propose',
          <span>
            Propose token <AddressLink chain={chainCfg} address={e.token} />
          </span>
        );
      for (const e of d.tokenGrants)
        push(
          'tg',
          e,
          'token',
          'grant',
          <span>
            Grant token <AddressLink chain={chainCfg} address={e.token} />
          </span>
        );
      for (const e of d.tokenCancels)
        push(
          'tc',
          e,
          'token',
          'cancel',
          <span>
            Cancel token <AddressLink chain={chainCfg} address={e.token} />
          </span>
        );
      for (const e of d.tokenRevokes)
        push(
          'tr',
          e,
          'token',
          'revoke',
          <span>
            Revoke token <AddressLink chain={chainCfg} address={e.token} />
          </span>
        );

      for (const e of d.loggerUpgradeds)
        push(
          'lu',
          e,
          'proxy',
          'upgrade',
          <span>
            Logger proxy upgraded → <AddressLink chain={chainCfg} address={e.implementation} />
          </span>
        );
      for (const e of d.loggerProxyAdminChangeds)
        push(
          'la',
          e,
          'proxy',
          'admin-changed',
          <span>
            Logger proxy admin changed <AddressLink chain={chainCfg} address={e.previousAdmin} /> →{' '}
            <AddressLink chain={chainCfg} address={e.newAdmin} />
          </span>
        );
      for (const e of d.proxyAdminOwnershipTransferreds)
        push(
          'po',
          e,
          'proxy',
          'owner-changed',
          <span>
            {e.role} owner: <AddressLink chain={chainCfg} address={e.previousOwner} /> →{' '}
            <AddressLink chain={chainCfg} address={e.newOwner} />
          </span>
        );

      for (const e of d.safeSetupConfigUpdates)
        push(
          'ss',
          e,
          'safe',
          'config-updated',
          <span>
            Safe setup config updated (guard <AddressLink chain={chainCfg} address={e.guard} />,
            fallback <AddressLink chain={chainCfg} address={e.fallbackHandler} />,{' '}
            {e.modules.length} module
            {e.modules.length === 1 ? '' : 's'}) via {e.source}
          </span>
        );

      for (const e of d.delayChanges)
        push(
          'dc',
          e,
          'delay',
          'delay-changed',
          <span>
            Delay changed {e.oldDelay}s → {e.newDelay}s
          </span>
        );
    }
    return events.sort((a, b) => {
      const diff = BigInt(b.blockNumber) - BigInt(a.blockNumber);
      if (diff !== 0n) return diff < 0n ? -1 : 1;
      // sortKey is the raw subgraph entity id (`txHash || logIndex` little-
      // endian), so desc lexicographic order puts higher-logIndex events (e.g.
      // grant) ahead of earlier ones (e.g. propose) within the same tx/block.
      return b.sortKey.localeCompare(a.sortKey);
    });
  }, [chainCfg, dashboard.data, divergence.data]);

  const visible = useMemo(
    () => allEvents.filter((e) => activeCategories.has(e.category)),
    [allEvents, activeCategories]
  );

  const toggleCategory = (cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (dashboard.isLoading) return <Loading label='Fetching timeline…' />;
  if (dashboard.error !== null) return <ErrorPane error={dashboard.error} />;
  if (dashboard.data === undefined) return <Empty>No data returned from subgraph.</Empty>;

  return (
    <Card
      title={`Timeline (${visible.length} of ${allEvents.length})`}
      subtitle='All admin-vault and proxy-level events, most recent first'
      actions={
        <div className='flex flex-wrap gap-1'>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => {
            const isActive = activeCategories.has(cat);
            const btnClass = cn(
              'rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors',
              isActive
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'
            );
            return (
              <button
                key={cat}
                type='button'
                className={btnClass}
                onClick={() => toggleCategory(cat)}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            );
          })}
        </div>
      }
    >
      {visible.length === 0 ? (
        <Empty>No events match the selected filters.</Empty>
      ) : (
        <ol className='flex flex-col gap-2'>
          {visible.map((e) => (
            <li
              key={e.id}
              className='flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg)] px-3 py-2'
            >
              <Tag variant={CATEGORY_VARIANT[e.category]}>{CATEGORY_LABEL[e.category]}</Tag>
              <span className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>
                {e.kind}
              </span>
              <div className='min-w-0 flex-1 break-words text-sm text-[var(--color-text)]'>
                {e.summary}
              </div>
              <div className='flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]'>
                <span title={formatTimestamp(e.blockTimestamp)}>
                  {formatRelative(e.blockTimestamp)}
                </span>
                <TxLink chain={chainCfg} txHash={e.txHash} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
