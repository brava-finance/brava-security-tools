import type {
  ActionAggregateEntity,
  ActionEntity,
  DelayChangeEntity,
  FeeEntity,
  GenericConfigSetEntity,
  LoggerProxyAdminChangedEntity,
  LoggerUpgradedEntity,
  PoolAggregateEntity,
  PoolEntity,
  ProxyAdminOwnershipTransferredEntity,
  RoleAdminChangeEntity,
  RoleFromAccessControlEntity,
  RoleFromLoggerEntity,
  SafeDeploymentProxyAdminChangedEntity,
  SafeDeploymentUpgradedEntity,
  SafeEventEntity,
  SafeSetupConfigUpdateEntity,
  SafeSnapshotEntity,
  TokenAggregateEntity,
  TokenEntity,
} from '../types/entities';

export interface DashboardResponse {
  actionProposals: ActionEntity[];
  actionGrants: ActionEntity[];
  actionCancels: ActionEntity[];
  actionRemoves: Array<
    Pick<ActionEntity, 'id' | 'actionId' | 'blockNumber' | 'blockTimestamp' | 'txHash'>
  >;

  poolProposals: PoolEntity[];
  poolGrants: PoolEntity[];
  poolCancels: PoolEntity[];
  poolRemoves: PoolEntity[];

  feeProposals: FeeEntity[];
  feeGrants: FeeEntity[];
  feeCancels: FeeEntity[];

  roleProposalsFromLogger: RoleFromLoggerEntity[];
  roleGrantsFromLogger: RoleFromLoggerEntity[];
  roleCancelsFromLogger: RoleFromLoggerEntity[];
  roleRevokesFromLogger: RoleFromLoggerEntity[];

  tokenProposals: TokenEntity[];
  tokenGrants: TokenEntity[];
  tokenCancels: TokenEntity[];
  tokenRevokes: TokenEntity[];

  delayChanges: DelayChangeEntity[];
  genericConfigSets: GenericConfigSetEntity[];

  loggerUpgradeds: LoggerUpgradedEntity[];
  loggerProxyAdminChangeds: LoggerProxyAdminChangedEntity[];
  safeDeploymentUpgradeds: SafeDeploymentUpgradedEntity[];
  safeDeploymentProxyAdminChangeds: SafeDeploymentProxyAdminChangedEntity[];
  proxyAdminOwnershipTransferreds: ProxyAdminOwnershipTransferredEntity[];

  // End-owner Gnosis Safe tracking. Each distinct address that ever appeared
  // as the newOwner of a ProxyAdmin gets a snapshot row (populated via on-chain
  // try_ calls at first observation) and an event stream covering subsequent
  // owner/threshold/guard/fallback-handler rotations.
  safeSnapshots: SafeSnapshotEntity[];
  safeEvents: SafeEventEntity[];

  safeSetupConfigUpdates: SafeSetupConfigUpdateEntity[];

  // Enriched aggregates (Action/Pool/Token + protocol join) computed at index
  // time via on-chain `try_` calls. `active: true` rows reflect the current
  // live whitelist; historical rows are reachable through the event streams
  // above.
  actions: ActionAggregateEntity[];
  pools: PoolAggregateEntity[];
  tokenEntities: TokenAggregateEntity[];
}

const BASE_FIELDS = `id blockNumber blockTimestamp txHash`;

// Intentionally fetches "a lot" per chain in a single round-trip. The screener
// is bounded by the actual number of admin-vault events (hundreds at most),
// not by regular user traffic, so this stays tiny.
export const DASHBOARD_QUERY = `query Dashboard($first: Int!) {
  actionProposals: actionProposals(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} actionId actionAddress
  }
  actionGrants: actionGrants(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} actionId actionAddress
  }
  actionCancels: actionCancels(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} actionId actionAddress
  }
  actionRemoves: actionRemoves(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} actionId
  }

  poolProposals: poolProposals(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} protocolId poolAddress
  }
  poolGrants: poolGrants(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} protocolId poolAddress
  }
  poolCancels: poolCancels(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} protocolId poolAddress
  }
  poolRemoves: poolRemoves(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} protocolId poolAddress
  }

  feeProposals: feeProposals(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} recipient minBasis maxBasis
  }
  feeGrants: feeGrants(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} recipient minBasis maxBasis
  }
  feeCancels: feeCancels(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} recipient minBasis maxBasis
  }

  roleProposalsFromLogger: roleProposalFromLoggers(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} role roleName account
  }
  roleGrantsFromLogger: roleGrantFromLoggers(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} role roleName account
  }
  roleCancelsFromLogger: roleCancelFromLoggers(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} role roleName account
  }
  roleRevokesFromLogger: roleRevokeFromLoggers(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} role roleName account
  }

  tokenProposals: tokenProposals(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} token
  }
  tokenGrants: tokenGrants(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} token
  }
  tokenCancels: tokenCancels(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} token
  }
  tokenRevokes: tokenRevokes(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} token
  }

  delayChanges: delayChanges(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} oldDelay newDelay
  }
  genericConfigSets: genericConfigSets(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} protocolName actionType configAddress
  }

  loggerUpgradeds: loggerUpgradeds(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} proxy implementation
  }
  loggerProxyAdminChangeds: loggerProxyAdminChangeds(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} proxy previousAdmin newAdmin
  }
  safeDeploymentUpgradeds: safeDeploymentUpgradeds(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} proxy implementation
  }
  safeDeploymentProxyAdminChangeds: safeDeploymentProxyAdminChangeds(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} proxy previousAdmin newAdmin
  }
  proxyAdminOwnershipTransferreds: proxyAdminOwnershipTransferreds(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} proxyAdmin role previousOwner newOwner
  }

  safeSnapshots: safeSnapshots(first: $first, orderBy: firstIndexedAt, orderDirection: desc) {
    id safe owners threshold isLikelySafe safeVersion
    firstIndexedAt firstIndexedBlock firstIndexedTx roles
  }
  safeEvents: safeEvents(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} safe kind owner threshold guard fallbackHandler
  }

  safeSetupConfigUpdates: safeSetupConfigUpdates(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} fallbackHandler modules guard source
  }

  # Aggregate entities written by on-chain try_ calls at grant time. We fetch
  # both active and removed rows (orderBy grantedAt) so the UI can render a
  # history view if needed; first: $first mirrors the other collections.
  actions: actions(first: $first, orderBy: grantedAt, orderDirection: desc) {
    id actionId actionAddress protocolName actionType actionTypeName displayName
    active grantedAt grantedTx removedAt removedTx
  }
  pools: pools(first: $first, orderBy: grantedAt, orderDirection: desc) {
    id protocolId poolAddress tokenName tokenSymbol tokenDecimals displayName
    active grantedAt grantedTx removedAt removedTx
    protocol { id protocolId name }
  }
  tokenEntities: tokens(first: $first, orderBy: grantedAt, orderDirection: desc) {
    id token tokenName tokenSymbol tokenDecimals displayName
    active grantedAt grantedTx removedAt removedTx
  }
}`;

export interface DivergenceResponse {
  roleGrantsFromAccessControl: RoleFromAccessControlEntity[];
  roleRevokesFromAccessControl: RoleFromAccessControlEntity[];
  roleAdminChanges: RoleAdminChangeEntity[];
}

export const DIVERGENCE_QUERY = `query Divergence($first: Int!) {
  roleGrantsFromAccessControl: roleGrantFromAccessControls(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} role roleName account sender
  }
  roleRevokesFromAccessControl: roleRevokeFromAccessControls(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} role roleName account sender
  }
  roleAdminChanges: roleAdminChanges(first: $first, orderBy: blockNumber, orderDirection: desc) {
    ${BASE_FIELDS} role roleName previousAdminRole newAdminRole
  }
}`;
