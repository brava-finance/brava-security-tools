import { Address, BigInt, Bytes, dataSource, ethereum, log } from '@graphprotocol/graph-ts';

import { OwnershipTransferred as OwnershipTransferredFromLogger } from '../generated/LoggerProxyAdmin/IProxyAdmin';
import { OwnershipTransferred as OwnershipTransferredFromSafeDeployment } from '../generated/SafeDeploymentProxyAdmin/IProxyAdmin';
import { ISafe } from '../generated/LoggerProxyAdmin/ISafe';
import { OwnershipTransferred as OwnershipTransferredFromTemplate } from '../generated/templates/ProxyAdmin/IProxyAdmin';
import { ProxyAdminOwnershipTransferred, SafeSnapshot } from '../generated/schema';
import { OwnerSafe } from '../generated/templates';

const ROLE_LOGGER = 'LoggerProxyAdmin';
const ROLE_SAFE_DEPLOYMENT = 'SafeDeploymentProxyAdmin';

const ZERO_ADDRESS = Address.zero();

// Static bootstrap handlers — the admin that was live at startBlock. Once the
// owning proxy rotates to a different admin, the template handler below takes
// over for that new admin address.
export function handleLoggerProxyAdminOwnershipTransferred(
  event: OwnershipTransferredFromLogger
): void {
  writeProxyAdminOwnership(
    event.address,
    ROLE_LOGGER,
    event.params.previousOwner,
    event.params.newOwner,
    event.block,
    event.transaction,
    event.logIndex
  );
}

export function handleSafeDeploymentProxyAdminOwnershipTransferred(
  event: OwnershipTransferredFromSafeDeployment
): void {
  writeProxyAdminOwnership(
    event.address,
    ROLE_SAFE_DEPLOYMENT,
    event.params.previousOwner,
    event.params.newOwner,
    event.block,
    event.transaction,
    event.logIndex
  );
}

// Template handler — invoked for any ProxyAdmin dynamically created by a
// TransparentUpgradeableProxy `AdminChanged` event. Role is supplied by the
// spawning handler via DataSourceContext so we can distinguish logger vs
// safe-deployment rotations downstream.
export function handleProxyAdminOwnershipTransferredFromTemplate(
  event: OwnershipTransferredFromTemplate
): void {
  const context = dataSource.context();
  let role = context.getString('role');
  if (role.length === 0) {
    log.warning('ProxyAdmin template fired without role context at {}', [
      event.address.toHexString(),
    ]);
    role = 'UnknownProxyAdmin';
  }
  writeProxyAdminOwnership(
    event.address,
    role,
    event.params.previousOwner,
    event.params.newOwner,
    event.block,
    event.transaction,
    event.logIndex
  );
}

function writeProxyAdminOwnership(
  proxyAdmin: Address,
  role: string,
  previousOwner: Address,
  newOwner: Address,
  block: ethereum.Block,
  transaction: ethereum.Transaction,
  logIndex: BigInt
): void {
  const entity = new ProxyAdminOwnershipTransferred(
    transaction.hash.concatI32(logIndex.toI32())
  );
  entity.proxyAdmin = proxyAdmin;
  entity.role = role;
  entity.previousOwner = previousOwner;
  entity.newOwner = newOwner;
  entity.blockNumber = block.number;
  entity.blockTimestamp = block.timestamp;
  entity.txHash = transaction.hash;
  entity.save();

  // Skip renunciation (OZ Ownable emits OwnershipTransferred to the zero
  // address when renounceOwnership() is called). Nothing to index there.
  if (newOwner.equals(ZERO_ADDRESS)) return;

  // Discover + track the end-owner. If this is the first time we've seen this
  // address as an owner, snapshot its Gnosis Safe state (via try_ calls) and
  // spawn the OwnerSafe template so its governance events are indexed going
  // forward. Subsequent rotations that land on the same address simply append
  // the role to the existing snapshot — we never overwrite the initial state.
  ensureOwnerSafeTracked(newOwner, role, block, transaction);
}

function ensureOwnerSafeTracked(
  owner: Address,
  role: string,
  block: ethereum.Block,
  transaction: ethereum.Transaction
): void {
  const id = owner as Bytes;
  let snapshot = SafeSnapshot.load(id);

  if (snapshot === null) {
    snapshot = new SafeSnapshot(id);
    snapshot.safe = owner;
    snapshot.firstIndexedAt = block.timestamp;
    snapshot.firstIndexedBlock = block.number;
    snapshot.firstIndexedTx = transaction.hash;
    snapshot.roles = [role];

    // Probe the contract via `try_` bindings. If all three return OK we treat
    // it as a Gnosis Safe; if any fail the owner is probably an EOA, an older
    // Safe version, or something else that needs manual review.
    const safe = ISafe.bind(owner);
    const ownersResult = safe.try_getOwners();
    const thresholdResult = safe.try_getThreshold();
    const versionResult = safe.try_VERSION();

    if (!ownersResult.reverted && !thresholdResult.reverted) {
      const ownersArray = ownersResult.value;
      const ownersBytes: Bytes[] = [];
      for (let i = 0; i < ownersArray.length; i++) {
        ownersBytes.push(ownersArray[i] as Bytes);
      }
      snapshot.owners = ownersBytes;
      snapshot.threshold = thresholdResult.value;
      snapshot.isLikelySafe = true;
    } else {
      snapshot.owners = [];
      snapshot.threshold = BigInt.zero();
      snapshot.isLikelySafe = false;
    }

    snapshot.safeVersion = versionResult.reverted ? null : versionResult.value;

    // Spawn the OwnerSafe template regardless of whether the probe succeeded.
    // If it isn't actually a Safe the template will simply never fire — which
    // is itself a useful signal, and matches what `isLikelySafe: false` flags
    // on the snapshot.
    OwnerSafe.create(owner);
  } else {
    // Track every distinct role that points at this safe, so the UI can
    // render "this safe owns the logger admin on all three chains AND the
    // safe-deployment admin on mainnet" without an extra join.
    const existingRoles = snapshot.roles;
    let alreadyPresent = false;
    for (let i = 0; i < existingRoles.length; i++) {
      if (existingRoles[i] == role) {
        alreadyPresent = true;
        break;
      }
    }
    if (!alreadyPresent) {
      const nextRoles = existingRoles;
      nextRoles.push(role);
      snapshot.roles = nextRoles;
    }
  }

  snapshot.save();
}
