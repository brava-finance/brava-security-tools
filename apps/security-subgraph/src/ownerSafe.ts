import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';

import {
  AddedOwner,
  ChangedFallbackHandler,
  ChangedGuard,
  ChangedThreshold,
  RemovedOwner,
} from '../generated/templates/OwnerSafe/ISafe';
import { SafeEvent, SafeSnapshot } from '../generated/schema';

const KIND_ADDED_OWNER = 'AddedOwner';
const KIND_REMOVED_OWNER = 'RemovedOwner';
const KIND_CHANGED_THRESHOLD = 'ChangedThreshold';
const KIND_CHANGED_GUARD = 'ChangedGuard';
const KIND_CHANGED_FALLBACK_HANDLER = 'ChangedFallbackHandler';

export function handleSafeAddedOwner(event: AddedOwner): void {
  writeSafeEvent(
    event.address,
    KIND_ADDED_OWNER,
    event.params.owner,
    null,
    null,
    null,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex
  );
  applyOwnerDelta(event.address, event.params.owner, true);
  markConfirmedSafe(event.address);
}

export function handleSafeRemovedOwner(event: RemovedOwner): void {
  writeSafeEvent(
    event.address,
    KIND_REMOVED_OWNER,
    event.params.owner,
    null,
    null,
    null,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex
  );
  applyOwnerDelta(event.address, event.params.owner, false);
  markConfirmedSafe(event.address);
}

export function handleSafeChangedThreshold(event: ChangedThreshold): void {
  writeSafeEvent(
    event.address,
    KIND_CHANGED_THRESHOLD,
    null,
    event.params.threshold,
    null,
    null,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex
  );
  const snapshot = SafeSnapshot.load(event.address as Bytes);
  if (snapshot !== null) {
    snapshot.threshold = event.params.threshold;
    snapshot.save();
  }
  markConfirmedSafe(event.address);
}

export function handleSafeChangedGuard(event: ChangedGuard): void {
  writeSafeEvent(
    event.address,
    KIND_CHANGED_GUARD,
    null,
    null,
    event.params.guard,
    null,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex
  );
  markConfirmedSafe(event.address);
}

export function handleSafeChangedFallbackHandler(event: ChangedFallbackHandler): void {
  writeSafeEvent(
    event.address,
    KIND_CHANGED_FALLBACK_HANDLER,
    null,
    null,
    null,
    event.params.handler,
    event.block.number,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex
  );
  markConfirmedSafe(event.address);
}

function writeSafeEvent(
  safe: Address,
  kind: string,
  owner: Address | null,
  threshold: BigInt | null,
  guard: Address | null,
  fallbackHandler: Address | null,
  blockNumber: BigInt,
  blockTimestamp: BigInt,
  txHash: Bytes,
  logIndex: BigInt
): void {
  const entity = new SafeEvent(txHash.concatI32(logIndex.toI32()));
  entity.safe = safe;
  entity.kind = kind;
  entity.owner = owner;
  entity.threshold = threshold;
  entity.guard = guard;
  entity.fallbackHandler = fallbackHandler;
  entity.blockNumber = blockNumber;
  entity.blockTimestamp = blockTimestamp;
  entity.txHash = txHash;
  entity.save();
}

// Maintain the rolling owner list on the snapshot so the frontend can render
// "current owners" without replaying the entire event stream. Idempotent:
// adding an already-present owner or removing an absent owner is a no-op.
function applyOwnerDelta(safe: Address, owner: Address, add: boolean): void {
  const snapshot = SafeSnapshot.load(safe as Bytes);
  if (snapshot === null) return;

  const owners = snapshot.owners;
  const target = owner as Bytes;
  let idx = -1;
  for (let i = 0; i < owners.length; i++) {
    if (owners[i].equals(target)) {
      idx = i;
      break;
    }
  }

  if (add && idx < 0) {
    owners.push(target);
    snapshot.owners = owners;
    snapshot.save();
    return;
  }
  if (!add && idx >= 0) {
    const next: Bytes[] = [];
    for (let i = 0; i < owners.length; i++) {
      if (i != idx) next.push(owners[i]);
    }
    snapshot.owners = next;
    snapshot.save();
  }
}

// If we ever observe a Safe event on an address whose initial `try_` probe
// failed (eg. the contract was self-destructed and redeployed, or the probe
// raced with deployment), upgrade its snapshot to `isLikelySafe: true` so the
// UI stops red-flagging it.
function markConfirmedSafe(safe: Address): void {
  const snapshot = SafeSnapshot.load(safe as Bytes);
  if (snapshot === null) return;
  if (snapshot.isLikelySafe) return;
  snapshot.isLikelySafe = true;
  snapshot.save();
}
