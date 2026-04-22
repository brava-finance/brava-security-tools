import { OwnershipTransferred } from '../generated/LoggerProxyAdmin/IProxyAdmin';
import { ProxyAdminOwnershipTransferred } from '../generated/schema';

export function handleProxyAdminOwnershipTransferred(event: OwnershipTransferred): void {
  writeProxyAdminOwnership(event, 'LoggerProxyAdmin');
}

export function handleSafeDeploymentProxyAdminOwnershipTransferred(
  event: OwnershipTransferred
): void {
  writeProxyAdminOwnership(event, 'SafeDeploymentProxyAdmin');
}

function writeProxyAdminOwnership(event: OwnershipTransferred, role: string): void {
  const entity = new ProxyAdminOwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.proxyAdmin = event.address;
  entity.role = role;
  entity.previousOwner = event.params.previousOwner;
  entity.newOwner = event.params.newOwner;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}
