// Mirrors apps/security-subgraph/schema.graphql. Kept narrow: only fields the
// frontend actually renders. If you add fields here, also add them to the
// corresponding selection in src/lib/queries.ts.

export interface BaseEvent {
  id: string;
  blockNumber: string;
  blockTimestamp: string;
  txHash: string;
}

export interface ActionEntity extends BaseEvent {
  actionId: string;
  actionAddress?: string;
}

export interface PoolEntity extends BaseEvent {
  protocolId: string;
  poolAddress: string;
}

export interface FeeEntity extends BaseEvent {
  recipient: string;
  minBasis: string;
  maxBasis: string;
}

export interface RoleFromLoggerEntity extends BaseEvent {
  role: string;
  roleName: string;
  account: string;
}

export interface RoleFromAccessControlEntity extends BaseEvent {
  role: string;
  roleName: string;
  account: string;
  sender: string;
}

export interface RoleAdminChangeEntity extends BaseEvent {
  role: string;
  roleName: string;
  previousAdminRole: string;
  newAdminRole: string;
}

export interface TokenEntity extends BaseEvent {
  token: string;
}

export interface DelayChangeEntity extends BaseEvent {
  oldDelay: string;
  newDelay: string;
}

export interface LoggerUpgradedEntity extends BaseEvent {
  proxy: string;
  implementation: string;
}

export interface LoggerProxyAdminChangedEntity extends BaseEvent {
  proxy: string;
  previousAdmin: string;
  newAdmin: string;
}

export interface ProxyAdminOwnershipTransferredEntity extends BaseEvent {
  proxyAdmin: string;
  role: string;
  previousOwner: string;
  newOwner: string;
}

export interface SafeSetupConfigUpdateEntity extends BaseEvent {
  fallbackHandler: string;
  modules: string[];
  guard: string;
  source: string;
}

export interface GenericConfigSetEntity extends BaseEvent {
  protocolName: string;
  actionType: number;
  configAddress: string;
}

// --- Enriched aggregates ----------------------------------------------------
// Written by the subgraph at grant time via `try_` contract calls on the
// action implementation / pool address. Fields may be null/-1 when the
// on-chain contract does not conform to the expected ABI; the UI falls back
// to the raw id in those cases.

export interface ProtocolAggregateEntity {
  id: string;
  protocolId: string;
  name: string | null;
}

export interface ActionAggregateEntity {
  id: string;
  actionId: string;
  actionAddress: string;
  protocolName: string | null;
  // -1 if the ActionBase.actionType() call reverted.
  actionType: number;
  actionTypeName: string | null;
  displayName: string | null;
  active: boolean;
  grantedAt: string;
  grantedTx: string;
  removedAt: string | null;
  removedTx: string | null;
}

export interface PoolAggregateEntity {
  id: string;
  protocolId: string;
  protocol: ProtocolAggregateEntity | null;
  poolAddress: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  // -1 if the IERC20Metadata.decimals() call reverted.
  tokenDecimals: number;
  displayName: string | null;
  active: boolean;
  grantedAt: string;
  grantedTx: string;
  removedAt: string | null;
  removedTx: string | null;
}

export interface TokenAggregateEntity {
  id: string;
  token: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  // -1 if the IERC20Metadata.decimals() call reverted.
  tokenDecimals: number;
  displayName: string | null;
  active: boolean;
  grantedAt: string;
  grantedTx: string;
  removedAt: string | null;
  removedTx: string | null;
}
