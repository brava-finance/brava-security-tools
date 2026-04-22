import type {
  ActionAggregateEntity,
  ActionEntity,
  DelayChangeEntity,
  FeeEntity,
  LoggerProxyAdminChangedEntity,
  LoggerUpgradedEntity,
  PoolAggregateEntity,
  PoolEntity,
  ProxyAdminOwnershipTransferredEntity,
  RoleFromAccessControlEntity,
  RoleFromLoggerEntity,
  SafeSetupConfigUpdateEntity,
  TokenAggregateEntity,
  TokenEntity,
} from '../types/entities';

import type { DashboardResponse, DivergenceResponse } from './queries';

// Sort helper: subgraph already returns blockNumber DESC, but we mix collections
// so we re-sort to get a strict chronological order per key.
function byBlockAsc<T extends { blockNumber: string; txHash: string }>(a: T, b: T): number {
  const ab = BigInt(a.blockNumber);
  const bb = BigInt(b.blockNumber);
  if (ab < bb) return -1;
  if (ab > bb) return 1;
  return a.txHash.localeCompare(b.txHash);
}

type ProposalEventKind = 'propose' | 'grant' | 'cancel' | 'remove' | 'revoke';

export interface DerivedEntry<TMeta> {
  key: string;
  meta: TMeta;
  status: 'active' | 'pending' | 'cancelled' | 'removed';
  proposedAt?: string;
  proposedTx?: string;
  grantedAt?: string;
  grantedTx?: string;
  lastEventKind: ProposalEventKind;
  lastEventAt: string;
  lastEventTx: string;
}

interface StreamEvent<TMeta> {
  key: string;
  kind: ProposalEventKind;
  meta: TMeta;
  blockNumber: string;
  blockTimestamp: string;
  txHash: string;
}

function buildDerived<TMeta>(events: Array<StreamEvent<TMeta>>): Array<DerivedEntry<TMeta>> {
  const sorted = [...events].sort(byBlockAsc);
  const map = new Map<string, DerivedEntry<TMeta>>();

  for (const ev of sorted) {
    const existing = map.get(ev.key);
    const base: DerivedEntry<TMeta> = existing ?? {
      key: ev.key,
      meta: ev.meta,
      status: 'pending',
      lastEventKind: ev.kind,
      lastEventAt: ev.blockTimestamp,
      lastEventTx: ev.txHash,
    };

    base.meta = ev.meta;
    base.lastEventKind = ev.kind;
    base.lastEventAt = ev.blockTimestamp;
    base.lastEventTx = ev.txHash;

    switch (ev.kind) {
      case 'propose':
        base.status = 'pending';
        base.proposedAt = ev.blockTimestamp;
        base.proposedTx = ev.txHash;
        break;
      case 'grant':
        base.status = 'active';
        base.grantedAt = ev.blockTimestamp;
        base.grantedTx = ev.txHash;
        break;
      case 'cancel':
        base.status = 'cancelled';
        break;
      case 'remove':
      case 'revoke':
        base.status = 'removed';
        break;
    }

    map.set(ev.key, base);
  }

  return Array.from(map.values());
}

// ---- Actions ---------------------------------------------------------------

// Fields enriched by the subgraph at grant time via on-chain try_ calls
// against ActionBase(actionAddress). `protocolName`/`actionTypeName` are null
// and `actionType` is -1 if the contract does not conform (which should never
// happen for production actions but is tolerated by the subgraph).
export interface ActionMeta {
  actionId: string;
  actionAddress?: string | undefined;
  protocolName?: string | undefined;
  actionType?: number | undefined;
  actionTypeName?: string | undefined;
  displayName?: string | undefined;
}

function toActionEnrichment(
  a: ActionAggregateEntity
): Pick<ActionMeta, 'protocolName' | 'actionType' | 'actionTypeName' | 'displayName'> {
  return {
    ...(a.protocolName !== null ? { protocolName: a.protocolName } : {}),
    // -1 is the subgraph's "unresolved" sentinel for the pure-i32 field; treat
    // it as "no type info available" on the UI side.
    ...(a.actionType !== -1 ? { actionType: a.actionType } : {}),
    ...(a.actionTypeName !== null ? { actionTypeName: a.actionTypeName } : {}),
    ...(a.displayName !== null ? { displayName: a.displayName } : {}),
  };
}

export function deriveActions(d: DashboardResponse): Array<DerivedEntry<ActionMeta>> {
  const enrichmentByActionId = new Map<
    string,
    Pick<ActionMeta, 'protocolName' | 'actionType' | 'actionTypeName' | 'displayName'>
  >();
  for (const a of d.actions) {
    enrichmentByActionId.set(a.actionId.toLowerCase(), toActionEnrichment(a));
  }

  const key = (e: ActionEntity): string => e.actionId.toLowerCase();
  const meta = (e: ActionEntity): ActionMeta => ({
    actionId: e.actionId,
    actionAddress: e.actionAddress,
    ...enrichmentByActionId.get(e.actionId.toLowerCase()),
  });
  const events: Array<StreamEvent<ActionMeta>> = [
    ...d.actionProposals.map((e) => ({
      key: key(e),
      kind: 'propose' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.actionGrants.map((e) => ({
      key: key(e),
      kind: 'grant' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.actionCancels.map((e) => ({
      key: key(e),
      kind: 'cancel' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.actionRemoves.map((e) => ({
      key: e.actionId.toLowerCase(),
      kind: 'remove' as const,
      meta: {
        actionId: e.actionId,
        ...enrichmentByActionId.get(e.actionId.toLowerCase()),
      },
      ...base(e),
    })),
  ];
  return buildDerived(events);
}

// ---- Pools -----------------------------------------------------------------

// Fields enriched by the subgraph at grant time via try_ calls on
// IERC20Metadata(poolAddress) plus a Protocol join. All optional: non-ERC-20
// pools / unresolved protocols simply leave these undefined.
export interface PoolMeta {
  protocolId: string;
  poolAddress: string;
  protocolName?: string | undefined;
  tokenName?: string | undefined;
  tokenSymbol?: string | undefined;
  tokenDecimals?: number | undefined;
  displayName?: string | undefined;
}

function toPoolEnrichment(
  p: PoolAggregateEntity
): Pick<PoolMeta, 'protocolName' | 'tokenName' | 'tokenSymbol' | 'tokenDecimals' | 'displayName'> {
  const protocolName = p.protocol?.name ?? null;
  return {
    ...(protocolName !== null ? { protocolName } : {}),
    ...(p.tokenName !== null ? { tokenName: p.tokenName } : {}),
    ...(p.tokenSymbol !== null ? { tokenSymbol: p.tokenSymbol } : {}),
    ...(p.tokenDecimals !== -1 ? { tokenDecimals: p.tokenDecimals } : {}),
    ...(p.displayName !== null ? { displayName: p.displayName } : {}),
  };
}

function poolKeyFromProtocolAndAddress(protocolId: string, poolAddress: string): string {
  return `${protocolId}:${poolAddress.toLowerCase()}`;
}

export function derivePools(d: DashboardResponse): Array<DerivedEntry<PoolMeta>> {
  const enrichmentByKey = new Map<
    string,
    Pick<PoolMeta, 'protocolName' | 'tokenName' | 'tokenSymbol' | 'tokenDecimals' | 'displayName'>
  >();
  for (const p of d.pools) {
    enrichmentByKey.set(
      poolKeyFromProtocolAndAddress(p.protocolId, p.poolAddress),
      toPoolEnrichment(p)
    );
  }

  const key = (e: PoolEntity): string => poolKeyFromProtocolAndAddress(e.protocolId, e.poolAddress);
  const meta = (e: PoolEntity): PoolMeta => ({
    protocolId: e.protocolId,
    poolAddress: e.poolAddress,
    ...enrichmentByKey.get(key(e)),
  });
  const events: Array<StreamEvent<PoolMeta>> = [
    ...d.poolProposals.map((e) => ({
      key: key(e),
      kind: 'propose' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.poolGrants.map((e) => ({
      key: key(e),
      kind: 'grant' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.poolCancels.map((e) => ({
      key: key(e),
      kind: 'cancel' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.poolRemoves.map((e) => ({
      key: key(e),
      kind: 'remove' as const,
      meta: meta(e),
      ...base(e),
    })),
  ];
  return buildDerived(events);
}

// ---- Fees ------------------------------------------------------------------

export interface FeeMeta {
  recipient: string;
  minBasis: string;
  maxBasis: string;
}

export function deriveFees(d: DashboardResponse): Array<DerivedEntry<FeeMeta>> {
  const key = (e: FeeEntity): string => e.recipient.toLowerCase();
  const meta = (e: FeeEntity): FeeMeta => ({
    recipient: e.recipient,
    minBasis: e.minBasis,
    maxBasis: e.maxBasis,
  });
  const events: Array<StreamEvent<FeeMeta>> = [
    ...d.feeProposals.map((e) => ({
      key: key(e),
      kind: 'propose' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.feeGrants.map((e) => ({ key: key(e), kind: 'grant' as const, meta: meta(e), ...base(e) })),
    ...d.feeCancels.map((e) => ({
      key: key(e),
      kind: 'cancel' as const,
      meta: meta(e),
      ...base(e),
    })),
  ];
  return buildDerived(events);
}

// ---- Roles (Logger-sourced) -----------------------------------------------

export interface RoleMeta {
  role: string;
  roleName: string;
  account: string;
}

export function deriveRolesFromLogger(d: DashboardResponse): Array<DerivedEntry<RoleMeta>> {
  const key = (e: RoleFromLoggerEntity): string =>
    `${e.role.toLowerCase()}:${e.account.toLowerCase()}`;
  const meta = (e: RoleFromLoggerEntity): RoleMeta => ({
    role: e.role,
    roleName: e.roleName,
    account: e.account,
  });
  const events: Array<StreamEvent<RoleMeta>> = [
    ...d.roleProposalsFromLogger.map((e) => ({
      key: key(e),
      kind: 'propose' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.roleGrantsFromLogger.map((e) => ({
      key: key(e),
      kind: 'grant' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.roleCancelsFromLogger.map((e) => ({
      key: key(e),
      kind: 'cancel' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.roleRevokesFromLogger.map((e) => ({
      key: key(e),
      kind: 'revoke' as const,
      meta: meta(e),
      ...base(e),
    })),
  ];
  return buildDerived(events);
}

// ---- Roles (AccessControl-sourced) ----------------------------------------

export function deriveRolesFromAccessControl(
  d: DivergenceResponse
): Array<DerivedEntry<RoleMeta & { sender?: string }>> {
  const key = (e: RoleFromAccessControlEntity): string =>
    `${e.role.toLowerCase()}:${e.account.toLowerCase()}`;
  const meta = (e: RoleFromAccessControlEntity): RoleMeta & { sender?: string } => ({
    role: e.role,
    roleName: e.roleName,
    account: e.account,
    sender: e.sender,
  });
  const events: Array<StreamEvent<RoleMeta & { sender?: string }>> = [
    ...d.roleGrantsFromAccessControl.map((e) => ({
      key: key(e),
      kind: 'grant' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.roleRevokesFromAccessControl.map((e) => ({
      key: key(e),
      kind: 'revoke' as const,
      meta: meta(e),
      ...base(e),
    })),
  ];
  return buildDerived(events);
}

// ---- Tokens ---------------------------------------------------------------

export interface TokenMeta {
  token: string;
  // Populated from the Token aggregate entity (enriched at index time via
  // IERC20Metadata try_ calls). Missing when the token predates enrichment or
  // the on-chain contract does not expose the metadata extension.
  tokenName?: string;
  tokenSymbol?: string;
  // Only set when the on-chain decimals() call succeeded.
  tokenDecimals?: number;
  displayName?: string;
}

function toTokenEnrichment(
  t: TokenAggregateEntity
): Pick<TokenMeta, 'tokenName' | 'tokenSymbol' | 'tokenDecimals' | 'displayName'> {
  return {
    ...(t.tokenName !== null ? { tokenName: t.tokenName } : {}),
    ...(t.tokenSymbol !== null ? { tokenSymbol: t.tokenSymbol } : {}),
    ...(t.tokenDecimals !== -1 ? { tokenDecimals: t.tokenDecimals } : {}),
    ...(t.displayName !== null ? { displayName: t.displayName } : {}),
  };
}

export function deriveTokens(d: DashboardResponse): Array<DerivedEntry<TokenMeta>> {
  const enrichmentByAddress = new Map<
    string,
    Pick<TokenMeta, 'tokenName' | 'tokenSymbol' | 'tokenDecimals' | 'displayName'>
  >();
  for (const t of d.tokenEntities) {
    enrichmentByAddress.set(t.token.toLowerCase(), toTokenEnrichment(t));
  }

  const key = (e: TokenEntity): string => e.token.toLowerCase();
  const meta = (e: TokenEntity): TokenMeta => ({
    token: e.token,
    ...enrichmentByAddress.get(e.token.toLowerCase()),
  });
  const events: Array<StreamEvent<TokenMeta>> = [
    ...d.tokenProposals.map((e) => ({
      key: key(e),
      kind: 'propose' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.tokenGrants.map((e) => ({
      key: key(e),
      kind: 'grant' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.tokenCancels.map((e) => ({
      key: key(e),
      kind: 'cancel' as const,
      meta: meta(e),
      ...base(e),
    })),
    ...d.tokenRevokes.map((e) => ({
      key: key(e),
      kind: 'revoke' as const,
      meta: meta(e),
      ...base(e),
    })),
  ];
  return buildDerived(events);
}

// ---- Proxy state ----------------------------------------------------------

export function latestDelaySeconds(d: DashboardResponse): bigint | undefined {
  const sorted = [...d.delayChanges].sort(byBlockAsc);
  const last = sorted.at(-1);
  if (last === undefined) return undefined;
  return BigInt(last.newDelay);
}

export function latestLoggerImplementation(d: DashboardResponse): LoggerUpgradedEntity | undefined {
  const sorted = [...d.loggerUpgradeds].sort(byBlockAsc);
  return sorted.at(-1);
}

export function latestLoggerProxyAdmin(
  d: DashboardResponse
): LoggerProxyAdminChangedEntity | undefined {
  const sorted = [...d.loggerProxyAdminChangeds].sort(byBlockAsc);
  return sorted.at(-1);
}

export function latestProxyAdminOwner(
  d: DashboardResponse,
  proxyAdmin: string
): ProxyAdminOwnershipTransferredEntity | undefined {
  const filtered = d.proxyAdminOwnershipTransferreds.filter(
    (e) => e.proxyAdmin.toLowerCase() === proxyAdmin.toLowerCase()
  );
  const sorted = filtered.sort(byBlockAsc);
  return sorted.at(-1);
}

export function latestSafeSetupConfig(
  d: DashboardResponse
): SafeSetupConfigUpdateEntity | undefined {
  const sorted = [...d.safeSetupConfigUpdates].sort(byBlockAsc);
  return sorted.at(-1);
}

export function allDelayChanges(d: DashboardResponse): DelayChangeEntity[] {
  return [...d.delayChanges].sort(byBlockAsc);
}

// ---- Divergence -----------------------------------------------------------

export interface RoleDivergence {
  key: string;
  role: string;
  roleName: string;
  account: string;
  loggerStatus: DerivedEntry<RoleMeta>['status'] | 'missing';
  loggerLastAt?: string;
  loggerLastTx?: string;
  accessControlStatus: DerivedEntry<RoleMeta & { sender?: string }>['status'] | 'missing';
  accessControlLastAt?: string;
  accessControlLastTx?: string;
  // Sender of the most recent AccessControl event for this role/account. For
  // constructor grants this is the AdminVault itself (msg.sender during
  // deployment == the deployer executing the constructor, but OZ passes
  // msg.sender at the time the RoleGranted event is emitted — which for
  // constructor-time grants is whoever deployed the contract).
  accessControlSender?: string;
}

export interface RoleDivergenceReport {
  // Logger and AccessControl both have history for this role/account but they
  // disagree. These are the actually alarming rows.
  drift: RoleDivergence[];
  // AccessControl has a history (typically an active grant) but the Logger has
  // none at all — almost always the constructor / a direct admin call that
  // bypasses the delay-protected Logger flow. Surfaced for visibility, not as
  // a bug.
  acOnly: RoleDivergence[];
  // The inverse: Logger recorded activity but AccessControl has nothing. This
  // is rare and would indicate a Logger-only phantom event.
  loggerOnly: RoleDivergence[];
}

export function computeRoleDivergence(
  logger: Array<DerivedEntry<RoleMeta>>,
  accessControl: Array<DerivedEntry<RoleMeta & { sender?: string }>>
): RoleDivergenceReport {
  const loggerByKey = new Map<string, DerivedEntry<RoleMeta>>();
  const acByKey = new Map<string, DerivedEntry<RoleMeta & { sender?: string }>>();
  for (const e of logger) loggerByKey.set(e.key, e);
  for (const e of accessControl) acByKey.set(e.key, e);

  const keys = new Set<string>([...loggerByKey.keys(), ...acByKey.keys()]);
  const drift: RoleDivergence[] = [];
  const acOnly: RoleDivergence[] = [];
  const loggerOnly: RoleDivergence[] = [];

  for (const key of keys) {
    const log = loggerByKey.get(key);
    const ac = acByKey.get(key);
    const meta = log?.meta ?? ac?.meta;
    if (meta === undefined) continue;

    const row: RoleDivergence = {
      key,
      role: meta.role,
      roleName: meta.roleName,
      account: meta.account,
      loggerStatus: log?.status ?? 'missing',
      ...(log?.lastEventAt !== undefined ? { loggerLastAt: log.lastEventAt } : {}),
      ...(log?.lastEventTx !== undefined ? { loggerLastTx: log.lastEventTx } : {}),
      accessControlStatus: ac?.status ?? 'missing',
      ...(ac?.lastEventAt !== undefined ? { accessControlLastAt: ac.lastEventAt } : {}),
      ...(ac?.lastEventTx !== undefined ? { accessControlLastTx: ac.lastEventTx } : {}),
      ...(ac?.meta.sender !== undefined ? { accessControlSender: ac.meta.sender } : {}),
    };

    // Pure one-sided cases (the Logger or AccessControl has zero events) are
    // *expected* in practice: initial roles are granted in the AdminVault
    // constructor (AccessControl only). Bucket them separately so they don't
    // drown out genuine drift.
    if (log === undefined && ac?.status === 'active') {
      acOnly.push(row);
      continue;
    }
    if (ac === undefined && log?.status === 'active') {
      loggerOnly.push(row);
      continue;
    }

    // Real drift: both sides have opinions and they disagree. Pending Logger
    // proposals (not yet granted via AccessControl) are expected and excluded.
    const logStatusActive = log?.status === 'active';
    const logStatusRemoved = log?.status === 'removed';
    const acStatusActive = ac?.status === 'active';
    const acStatusRemoved = ac?.status === 'removed';

    const isDrift =
      (logStatusActive && acStatusRemoved) ||
      (acStatusActive && logStatusRemoved) ||
      (log?.status === 'cancelled' && acStatusActive);

    if (isDrift) drift.push(row);
  }

  return { drift, acOnly, loggerOnly };
}

// ---- Helpers ---------------------------------------------------------------

function base(e: { blockNumber: string; blockTimestamp: string; txHash: string }): {
  blockNumber: string;
  blockTimestamp: string;
  txHash: string;
} {
  return { blockNumber: e.blockNumber, blockTimestamp: e.blockTimestamp, txHash: e.txHash };
}
