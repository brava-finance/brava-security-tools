import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';

import { ActionEvent, AdminVaultEvent } from '../generated/Logger/Logger';
import {
  ActionCancel,
  ActionGrant,
  ActionProposal,
  ActionRemove,
  AdminVaultEventRaw,
  DelayChange,
  FeeCancel,
  FeeGrant,
  FeeProposal,
  GenericConfigSet,
  PoolCancel,
  PoolGrant,
  PoolProposal,
  PoolRemove,
  RoleCancelFromLogger,
  RoleGrantFromLogger,
  RoleProposalFromLogger,
  RoleRevokeFromLogger,
  SafeCreated,
  SafeSetupConfigUpdateFromLogger,
  TokenCancel,
  TokenGrant,
  TokenProposal,
  TokenRevoke,
  UnknownActionEvent,
  UnknownAdminVaultEvent,
} from '../generated/schema';
import {
  markActionRemoved,
  markPoolRemoved,
  markTokenRemoved,
  upsertActionOnGrant,
  upsertPoolOnGrant,
  upsertTokenOnGrant,
} from './aggregates';
import { resolveRoleName } from './roles';

// --- logId constants (see packages/contracts/contracts/docs/ADMIN_VAULT.md) -

// Category 01 = Action
const PROPOSE_ACTION = BigInt.fromI32(101);
const GRANT_ACTION = BigInt.fromI32(201);
const CANCEL_ACTION = BigInt.fromI32(301);
const REMOVE_ACTION = BigInt.fromI32(401);

// Category 02 = Pool
const PROPOSE_POOL = BigInt.fromI32(102);
const GRANT_POOL = BigInt.fromI32(202);
const CANCEL_POOL = BigInt.fromI32(302);
const REMOVE_POOL = BigInt.fromI32(402);

// Category 03 = Fee
const PROPOSE_FEE = BigInt.fromI32(103);
const GRANT_FEE = BigInt.fromI32(203);
const CANCEL_FEE = BigInt.fromI32(303);

// Category 04 = Role
const PROPOSE_ROLE = BigInt.fromI32(104);
const GRANT_ROLE = BigInt.fromI32(204);
const CANCEL_ROLE = BigInt.fromI32(304);
const REVOKE_ROLE = BigInt.fromI32(404);

// Category 05 = Generic admin config + delay
const GENERIC_CONFIG_SET = BigInt.fromI32(205);
const CHANGE_DELAY = BigInt.fromI32(400);

// Category 06 = Transaction / token
const PROPOSE_TOKEN = BigInt.fromI32(106);
const GRANT_TOKEN = BigInt.fromI32(206);
const CANCEL_TOKEN = BigInt.fromI32(306);
const REVOKE_TOKEN = BigInt.fromI32(406);

// Category 07 = Safe setup (via Logger; there is also a native event)
const SAFE_SETUP_CONFIG = BigInt.fromI32(107);

// Category 08 = Safe deployed for user
const SAFE_CREATED = BigInt.fromI32(108);

// --- ActionEvent sub-logIds (see ActionBase.LogType enum) -------------------

const BALANCE_UPDATE_INDEX: i32 = 1;
const BUY_COVER_INDEX: i32 = 2;
const SWAP_INDEX: i32 = 3;
const SEND_TOKEN_INDEX: i32 = 4;
const PULL_TOKEN_INDEX: i32 = 5;
const BUY_COVER_WITH_PREMIUM_INDEX: i32 = 9;

// --- ABI strings for Ethereum ABI decoder -----------------------------------

const ACTION_EVENT_ABI = '(bytes4,address)';
const REMOVE_ACTION_EVENT_ABI = '(bytes4)';
const POOL_EVENT_ABI = '(uint256,address)';
const FEE_EVENT_ABI = '(address,uint256,uint256)';
const ROLE_EVENT_ABI = '(bytes32,address)';
const TOKEN_EVENT_ABI = '(address)';
const DELAY_EVENT_ABI = '(uint256,uint256)';
const SAFE_SETUP_ABI = '(address,address[],address)';
const SAFE_CREATED_ABI = '(address,address)';
const GENERIC_CONFIG_ABI = '(string,uint8,address)';

// ----------------------------------------------------------------------------

export function handleAdminVaultEvent(event: AdminVaultEvent): void {
  writeRaw(event);

  const logId = event.params.logId;
  if (logId.equals(PROPOSE_ACTION)) handleActionProposal(event);
  else if (logId.equals(GRANT_ACTION)) handleActionGrant(event);
  else if (logId.equals(CANCEL_ACTION)) handleActionCancel(event);
  else if (logId.equals(REMOVE_ACTION)) handleActionRemove(event);
  else if (logId.equals(PROPOSE_POOL)) handlePool(event, 'PROPOSE');
  else if (logId.equals(GRANT_POOL)) handlePool(event, 'GRANT');
  else if (logId.equals(CANCEL_POOL)) handlePool(event, 'CANCEL');
  else if (logId.equals(REMOVE_POOL)) handlePool(event, 'REMOVE');
  else if (logId.equals(PROPOSE_FEE)) handleFee(event, 'PROPOSE');
  else if (logId.equals(GRANT_FEE)) handleFee(event, 'GRANT');
  else if (logId.equals(CANCEL_FEE)) handleFee(event, 'CANCEL');
  else if (logId.equals(PROPOSE_ROLE)) handleRole(event, 'PROPOSE');
  else if (logId.equals(GRANT_ROLE)) handleRole(event, 'GRANT');
  else if (logId.equals(CANCEL_ROLE)) handleRole(event, 'CANCEL');
  else if (logId.equals(REVOKE_ROLE)) handleRole(event, 'REVOKE');
  else if (logId.equals(PROPOSE_TOKEN)) handleToken(event, 'PROPOSE');
  else if (logId.equals(GRANT_TOKEN)) handleToken(event, 'GRANT');
  else if (logId.equals(CANCEL_TOKEN)) handleToken(event, 'CANCEL');
  else if (logId.equals(REVOKE_TOKEN)) handleToken(event, 'REVOKE');
  else if (logId.equals(SAFE_SETUP_CONFIG)) handleSafeSetupFromLogger(event);
  else if (logId.equals(SAFE_CREATED)) handleSafeCreated(event);
  else if (logId.equals(GENERIC_CONFIG_SET)) handleGenericConfig(event);
  else if (logId.equals(CHANGE_DELAY)) handleDelayChange(event);
  else handleUnknownAdminVault(event);
}

export function handleActionEvent(event: ActionEvent): void {
  // Action (user-facing) events are not part of the security screener's
  // core concern, but we keep an UnknownActionEvent bucket so the screener
  // can still display unusual / unrecognised types if they ever appear.
  const logId = event.params.logId;
  if (
    logId == BALANCE_UPDATE_INDEX ||
    logId == BUY_COVER_INDEX ||
    logId == SWAP_INDEX ||
    logId == SEND_TOKEN_INDEX ||
    logId == PULL_TOKEN_INDEX ||
    logId == BUY_COVER_WITH_PREMIUM_INDEX
  ) {
    // Known user-action event — not security-relevant for the screener.
    return;
  }
  const entity = new UnknownActionEvent(buildId(event));
  entity.caller = event.params.caller;
  entity.logId = logId;
  entity.data = event.params.data;
  entity.emitter = event.address;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

// --- helpers ----------------------------------------------------------------

function buildId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concatI32(event.logIndex.toI32());
}

function writeRaw(event: AdminVaultEvent): void {
  const entity = new AdminVaultEventRaw(buildId(event));
  entity.logId = event.params.logId;
  entity.data = event.params.data;
  entity.emitter = event.address;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

function decode(data: Bytes, abi: string): ethereum.Value | null {
  return ethereum.decode(abi, data);
}

// --- actions ----------------------------------------------------------------

function handleActionProposal(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, ACTION_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const entity = new ActionProposal(buildId(event));
  entity.actionId = tuple[0].toBytes();
  entity.actionAddress = tuple[1].toAddress();
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

function handleActionGrant(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, ACTION_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const actionId = tuple[0].toBytes();
  const actionAddress = tuple[1].toAddress();

  const entity = new ActionGrant(buildId(event));
  entity.actionId = actionId;
  entity.actionAddress = actionAddress;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();

  // Enrich the Action aggregate with on-chain metadata. Safe to call from
  // mainnet/testnets alike because every whitelisted action inherits
  // ActionBase and exposes pure protocolName()/actionType() views.
  upsertActionOnGrant(actionId, actionAddress, event);
}

function handleActionCancel(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, ACTION_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const entity = new ActionCancel(buildId(event));
  entity.actionId = tuple[0].toBytes();
  entity.actionAddress = tuple[1].toAddress();
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

function handleActionRemove(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, REMOVE_ACTION_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const actionId = tuple[0].toBytes();
  const entity = new ActionRemove(buildId(event));
  entity.actionId = actionId;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();

  markActionRemoved(actionId, event);
}

// --- pools ------------------------------------------------------------------

function handlePool(event: AdminVaultEvent, kind: string): void {
  const decoded = decode(event.params.data, POOL_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const id = buildId(event);
  const protocolId = tuple[0].toBigInt();
  const poolAddress = tuple[1].toAddress();

  if (kind == 'PROPOSE') {
    const e = new PoolProposal(id);
    e.protocolId = protocolId;
    e.poolAddress = poolAddress;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'GRANT') {
    const e = new PoolGrant(id);
    e.protocolId = protocolId;
    e.poolAddress = poolAddress;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
    upsertPoolOnGrant(protocolId, poolAddress, event);
  } else if (kind == 'CANCEL') {
    const e = new PoolCancel(id);
    e.protocolId = protocolId;
    e.poolAddress = poolAddress;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'REMOVE') {
    const e = new PoolRemove(id);
    e.protocolId = protocolId;
    e.poolAddress = poolAddress;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
    markPoolRemoved(protocolId, poolAddress, event);
  }
}

// --- fees -------------------------------------------------------------------

function handleFee(event: AdminVaultEvent, kind: string): void {
  const decoded = decode(event.params.data, FEE_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const id = buildId(event);
  const recipient = tuple[0].toAddress();
  const minBasis = tuple[1].toBigInt();
  const maxBasis = tuple[2].toBigInt();

  if (kind == 'PROPOSE') {
    const e = new FeeProposal(id);
    e.recipient = recipient;
    e.minBasis = minBasis;
    e.maxBasis = maxBasis;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'GRANT') {
    const e = new FeeGrant(id);
    e.recipient = recipient;
    e.minBasis = minBasis;
    e.maxBasis = maxBasis;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'CANCEL') {
    const e = new FeeCancel(id);
    e.recipient = recipient;
    e.minBasis = minBasis;
    e.maxBasis = maxBasis;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  }
}

// --- roles (Logger-sourced) -------------------------------------------------

function handleRole(event: AdminVaultEvent, kind: string): void {
  const decoded = decode(event.params.data, ROLE_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const id = buildId(event);
  const role = tuple[0].toBytes();
  const roleName = resolveRoleName(role);
  const account = tuple[1].toAddress();

  if (kind == 'PROPOSE') {
    const e = new RoleProposalFromLogger(id);
    e.role = role;
    e.roleName = roleName;
    e.account = account;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'GRANT') {
    const e = new RoleGrantFromLogger(id);
    e.role = role;
    e.roleName = roleName;
    e.account = account;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'CANCEL') {
    const e = new RoleCancelFromLogger(id);
    e.role = role;
    e.roleName = roleName;
    e.account = account;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'REVOKE') {
    const e = new RoleRevokeFromLogger(id);
    e.role = role;
    e.roleName = roleName;
    e.account = account;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  }
}

// --- tokens -----------------------------------------------------------------

function handleToken(event: AdminVaultEvent, kind: string): void {
  const decoded = decode(event.params.data, TOKEN_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const id = buildId(event);
  const token = tuple[0].toAddress();

  if (kind == 'PROPOSE') {
    const e = new TokenProposal(id);
    e.token = token;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'GRANT') {
    const e = new TokenGrant(id);
    e.token = token;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
    upsertTokenOnGrant(token, event);
  } else if (kind == 'CANCEL') {
    const e = new TokenCancel(id);
    e.token = token;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
  } else if (kind == 'REVOKE') {
    const e = new TokenRevoke(id);
    e.token = token;
    e.blockNumber = event.block.number;
    e.blockTimestamp = event.block.timestamp;
    e.txHash = event.transaction.hash;
    e.save();
    markTokenRemoved(token, event);
  }
}

// --- safe setup (Logger-sourced) --------------------------------------------

function handleSafeSetupFromLogger(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, SAFE_SETUP_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const entity = new SafeSetupConfigUpdateFromLogger(buildId(event));
  entity.fallbackHandler = tuple[0].toAddress();
  const addresses = tuple[1].toAddressArray();
  const modules = new Array<Bytes>(addresses.length);
  for (let i = 0; i < addresses.length; i++) {
    modules[i] = addresses[i];
  }
  entity.modules = modules;
  entity.guard = tuple[2].toAddress();
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

// --- safe created -----------------------------------------------------------

function handleSafeCreated(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, SAFE_CREATED_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const entity = new SafeCreated(buildId(event));
  entity.owner = tuple[0].toAddress();
  entity.safe = tuple[1].toAddress();
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

// --- generic config ---------------------------------------------------------

function handleGenericConfig(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, GENERIC_CONFIG_ABI);
  if (decoded == null) {
    // logId 205 is overloaded (TokenRegistry.setGasRefundToken uses it with a
    // single address payload). Fall back to raw if the `(string,uint8,address)`
    // decoder fails.
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const entity = new GenericConfigSet(buildId(event));
  entity.protocolName = tuple[0].toString();
  entity.actionType = tuple[1].toI32();
  entity.configAddress = tuple[2].toAddress();
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

// --- delay ------------------------------------------------------------------

function handleDelayChange(event: AdminVaultEvent): void {
  const decoded = decode(event.params.data, DELAY_EVENT_ABI);
  if (decoded == null) {
    handleUnknownAdminVault(event);
    return;
  }
  const tuple = decoded.toTuple();
  const entity = new DelayChange(buildId(event));
  entity.oldDelay = tuple[0].toBigInt();
  entity.newDelay = tuple[1].toBigInt();
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

// --- unknown fallback -------------------------------------------------------

function handleUnknownAdminVault(event: AdminVaultEvent): void {
  const entity = new UnknownAdminVaultEvent(buildId(event));
  entity.logId = event.params.logId;
  entity.data = event.params.data;
  entity.emitter = event.address;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}
