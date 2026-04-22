// Aggregate upserts that enrich per-event entities with on-chain-resolved
// metadata (protocol names, ERC-20 symbols, action type enum labels). Called
// from logger.ts after each propose/grant/remove event has been persisted.
//
// All contract calls use the `try_` bindings so they degrade silently when:
//   - the target contract reverts (e.g. a pool that does not implement
//     IERC20Metadata);
//   - the ABI does not match (legacy / non-standard implementations);
//   - the RPC node rejects the call.
// Missing metadata is stored as `null`; the frontend falls back to the raw
// id or address in that case.

import { BigInt, ByteArray, Bytes, Address, crypto, ethereum, log } from '@graphprotocol/graph-ts';

import { ActionBase } from '../generated/Logger/ActionBase';
import { IERC20Metadata } from '../generated/Logger/IERC20Metadata';
import { Action, Pool, Protocol, Token } from '../generated/schema';

// ActionBase enum labels. Order matches the Solidity enum in
// contracts/actions/ActionBase.sol — do not reorder.
const ACTION_TYPE_NAMES: string[] = [
  'DEPOSIT',
  'WITHDRAW',
  'SWAP',
  'COVER',
  'FEE',
  'TRANSFER',
  'CUSTOM',
];

// --- Protocol ---------------------------------------------------------------

// Canonical Protocol.id = the 32-byte little-endian representation of the
// uint256 protocolId. graph-ts stores BigInt as a little-endian Uint8Array
// internally (`class BigInt extends Uint8Array`), but the buffer length is
// variable: BigInt appends a 0x00 sign byte whenever the most-significant
// byte's top bit is set, producing 33 bytes instead of 32. That makes the
// naive `changetype<Bytes>` cast unstable — the same logical uint256 can
// produce different keys depending on whether it arrived via
// `BigInt.fromUnsignedBytes(keccak…)` or via `ethereum.decode`. We normalise
// to a fixed 32-byte LE buffer so both paths collide on the same entity id.
function protocolEntityId(protocolId: BigInt): Bytes {
  const raw = changetype<Bytes>(protocolId);
  const out = new Uint8Array(32);
  const copyLen = raw.length < 32 ? raw.length : 32;
  for (let i = 0; i < copyLen; i++) {
    out[i] = raw[i];
  }
  return changetype<Bytes>(out);
}

// Solidity convention used by AdminVault._protocolIdFromName:
//     uint256(keccak256(abi.encode(protocolName)))
// abi.encode(string) is NOT the same as the raw utf-8 bytes (that would be
// abi.encodePacked); it's the standard dynamic-string encoding:
//     <0x20 offset, 32 bytes> <length, 32 bytes> <utf-8 bytes, right-padded
//     to a 32-byte multiple>
// We must reproduce it exactly or the ids minted here will diverge from the
// ids decoded out of the AdminVault events, and actions/pools will never link
// to the same Protocol entity.
// graph-ts keccak256 returns big-endian; BigInt.fromUnsignedBytes expects
// little-endian, so we reverse in place.
function protocolIdFromName(name: string): BigInt {
  const nameBytes = ByteArray.fromUTF8(name);
  const nameLen = nameBytes.length;
  const paddedLen = nameLen === 0 ? 0 : (((nameLen - 1) / 32) | 0) * 32 + 32;
  const buf = new Uint8Array(64 + paddedLen);
  for (let i = 0; i < buf.length; i++) buf[i] = 0;
  // Offset word = 0x20 (right-aligned in the first 32 bytes).
  buf[31] = 0x20;
  // Length word = nameLen (right-aligned big-endian; length < 2^32 in practice).
  buf[60] = (nameLen >>> 24) & 0xff;
  buf[61] = (nameLen >>> 16) & 0xff;
  buf[62] = (nameLen >>> 8) & 0xff;
  buf[63] = nameLen & 0xff;
  for (let i = 0; i < nameLen; i++) buf[64 + i] = nameBytes[i];

  const hashBE = crypto.keccak256(changetype<ByteArray>(buf));
  const hashLE = Bytes.fromByteArray(hashBE);
  hashLE.reverse();
  return BigInt.fromUnsignedBytes(hashLE);
}

export function upsertProtocolFromName(name: string, event: ethereum.Event): Bytes {
  const protocolId = protocolIdFromName(name);
  const id = protocolEntityId(protocolId);
  let protocol = Protocol.load(id);
  if (protocol === null) {
    protocol = new Protocol(id);
    protocol.protocolId = protocolId;
    protocol.firstSeenAt = event.block.timestamp;
    protocol.firstSeenTx = event.transaction.hash;
  }
  // Name can arrive after the first pool grant (which only knows protocolId).
  // Always update to the latest observed name; protocols don't rename in
  // practice, but if the on-chain resolver returns a richer string later we
  // prefer that.
  protocol.name = name;
  protocol.save();
  return id;
}

export function upsertProtocolFromId(protocolId: BigInt, event: ethereum.Event): Bytes {
  const id = protocolEntityId(protocolId);
  let protocol = Protocol.load(id);
  if (protocol === null) {
    protocol = new Protocol(id);
    protocol.protocolId = protocolId;
    protocol.firstSeenAt = event.block.timestamp;
    protocol.firstSeenTx = event.transaction.hash;
    protocol.save();
  }
  return id;
}

// --- Action -----------------------------------------------------------------

function actionTypeLabel(typeId: i32): string | null {
  if (typeId < 0 || typeId >= ACTION_TYPE_NAMES.length) return null;
  return ACTION_TYPE_NAMES[typeId];
}

export function upsertActionOnGrant(
  actionId: Bytes,
  actionAddress: Address,
  event: ethereum.Event
): void {
  let action = Action.load(actionId);
  if (action === null) {
    action = new Action(actionId);
  }
  action.actionId = actionId;
  action.actionAddress = actionAddress;
  action.active = true;
  action.grantedAt = event.block.timestamp;
  action.grantedTx = event.transaction.hash;
  action.removedAt = null;
  action.removedTx = null;

  // Resolve protocolName + actionType via the ActionBase ABI. Both are pure
  // view functions on every production action, so this should succeed for
  // every real whitelisted implementation. We catch reverts defensively in
  // case the whitelist ever receives a non-conforming contract.
  const bound = ActionBase.bind(actionAddress);
  const nameCall = bound.try_protocolName();
  const typeCall = bound.try_actionType();

  let resolvedName: string | null = null;
  let resolvedType: i32 = -1;

  if (!nameCall.reverted) {
    resolvedName = nameCall.value;
    action.protocolName = resolvedName;
    // Seed the Protocol registry so pools referencing this protocolId can
    // resolve its name without another eth_call.
    upsertProtocolFromName(resolvedName, event);
  } else {
    action.protocolName = null;
    log.warning('ActionBase.protocolName() reverted for action {}', [actionAddress.toHexString()]);
  }

  if (!typeCall.reverted) {
    resolvedType = typeCall.value;
    action.actionType = resolvedType;
    action.actionTypeName = actionTypeLabel(resolvedType);
  } else {
    action.actionType = -1;
    action.actionTypeName = null;
    log.warning('ActionBase.actionType() reverted for action {}', [actionAddress.toHexString()]);
  }

  action.displayName = composeActionDisplayName(
    resolvedName,
    actionTypeLabel(resolvedType),
    actionAddress
  );
  action.save();
}

export function markActionRemoved(actionId: Bytes, event: ethereum.Event): void {
  const action = Action.load(actionId);
  if (action === null) return;
  action.active = false;
  action.removedAt = event.block.timestamp;
  action.removedTx = event.transaction.hash;
  action.save();
}

function composeActionDisplayName(
  protocolName: string | null,
  typeName: string | null,
  actionAddress: Address
): string {
  if (protocolName !== null && typeName !== null) {
    return protocolName + ' · ' + typeName;
  }
  if (protocolName !== null) return protocolName;
  if (typeName !== null) return typeName;
  return actionAddress.toHexString();
}

// --- Pool -------------------------------------------------------------------

function poolEntityId(protocolId: BigInt, poolAddress: Address): Bytes {
  return protocolEntityId(protocolId).concat(poolAddress);
}

export function upsertPoolOnGrant(
  protocolId: BigInt,
  poolAddress: Address,
  event: ethereum.Event
): void {
  const id = poolEntityId(protocolId, poolAddress);
  let pool = Pool.load(id);
  if (pool === null) {
    pool = new Pool(id);
  }
  pool.protocolId = protocolId;
  pool.protocol = upsertProtocolFromId(protocolId, event);
  pool.poolAddress = poolAddress;
  pool.active = true;
  pool.grantedAt = event.block.timestamp;
  pool.grantedTx = event.transaction.hash;
  pool.removedAt = null;
  pool.removedTx = null;

  // Most pools are ERC-20 wrapped yield tokens (aToken, ERC-4626 share, Sky
  // sUSDS, etc.). try_ the metadata calls so non-conforming pools simply get
  // null fields.
  const erc20 = IERC20Metadata.bind(poolAddress);
  const nameCall = erc20.try_name();
  const symbolCall = erc20.try_symbol();
  const decimalsCall = erc20.try_decimals();

  // AssemblyScript ternaries do not handle `x | null` well, so use explicit
  // nullable locals.
  let tokenName: string | null = null;
  if (!nameCall.reverted) tokenName = nameCall.value;
  let tokenSymbol: string | null = null;
  if (!symbolCall.reverted) tokenSymbol = symbolCall.value;
  let tokenDecimals: i32 = -1;
  if (!decimalsCall.reverted) tokenDecimals = decimalsCall.value;

  pool.tokenName = tokenName;
  pool.tokenSymbol = tokenSymbol;
  pool.tokenDecimals = tokenDecimals;

  // Re-read the protocol's name (if any) to compose a human label.
  const protoId = protocolEntityId(protocolId);
  const protocol = Protocol.load(protoId);
  let protoName: string | null = null;
  if (protocol !== null) protoName = protocol.name;

  pool.displayName = composePoolDisplayName(protoName, tokenSymbol, tokenName, poolAddress);
  pool.save();
}

export function markPoolRemoved(
  protocolId: BigInt,
  poolAddress: Address,
  event: ethereum.Event
): void {
  const id = poolEntityId(protocolId, poolAddress);
  const pool = Pool.load(id);
  if (pool === null) return;
  pool.active = false;
  pool.removedAt = event.block.timestamp;
  pool.removedTx = event.transaction.hash;
  pool.save();
}

function composePoolDisplayName(
  protocolName: string | null,
  tokenSymbol: string | null,
  tokenName: string | null,
  poolAddress: Address
): string {
  const tokenLabel = tokenSymbol !== null ? tokenSymbol : tokenName;
  if (protocolName !== null && tokenLabel !== null) {
    return protocolName + ' · ' + tokenLabel;
  }
  if (tokenLabel !== null) return tokenLabel;
  if (protocolName !== null) return protocolName;
  return poolAddress.toHexString();
}

// --- Token (transaction registry) ------------------------------------------

export function upsertTokenOnGrant(tokenAddress: Address, event: ethereum.Event): void {
  const id = changetype<Bytes>(tokenAddress);
  let token = Token.load(id);
  if (token === null) {
    token = new Token(id);
  }
  token.token = tokenAddress;
  token.active = true;
  token.grantedAt = event.block.timestamp;
  token.grantedTx = event.transaction.hash;
  token.removedAt = null;
  token.removedTx = null;

  // Tokens in the registry are ERC-20 addresses (plus the native-gas sentinel
  // 0xEeee…EEeE). The sentinel has no code and will revert; every real token
  // is expected to expose IERC20Metadata.
  const erc20 = IERC20Metadata.bind(tokenAddress);
  const nameCall = erc20.try_name();
  const symbolCall = erc20.try_symbol();
  const decimalsCall = erc20.try_decimals();

  let tokenName: string | null = null;
  if (!nameCall.reverted) tokenName = nameCall.value;
  let tokenSymbol: string | null = null;
  if (!symbolCall.reverted) tokenSymbol = symbolCall.value;
  let tokenDecimals: i32 = -1;
  if (!decimalsCall.reverted) tokenDecimals = decimalsCall.value;

  token.tokenName = tokenName;
  token.tokenSymbol = tokenSymbol;
  token.tokenDecimals = tokenDecimals;
  token.displayName = composeTokenDisplayName(tokenSymbol, tokenName, tokenAddress);
  token.save();
}

export function markTokenRemoved(tokenAddress: Address, event: ethereum.Event): void {
  const id = changetype<Bytes>(tokenAddress);
  const token = Token.load(id);
  if (token === null) return;
  token.active = false;
  token.removedAt = event.block.timestamp;
  token.removedTx = event.transaction.hash;
  token.save();
}

function composeTokenDisplayName(
  tokenSymbol: string | null,
  tokenName: string | null,
  tokenAddress: Address
): string {
  if (tokenSymbol !== null && tokenName !== null && tokenSymbol !== tokenName) {
    return tokenSymbol + ' (' + tokenName + ')';
  }
  if (tokenSymbol !== null) return tokenSymbol;
  if (tokenName !== null) return tokenName;
  return tokenAddress.toHexString();
}
