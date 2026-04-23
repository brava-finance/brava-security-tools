import { DataSourceContext } from '@graphprotocol/graph-ts';

import {
  AdminChanged,
  Upgraded,
} from '../generated/SafeDeploymentProxy/ITransparentUpgradeableProxy';
import { SafeDeploymentProxyAdminChanged, SafeDeploymentUpgraded } from '../generated/schema';
import { ProxyAdmin } from '../generated/templates';

export function handleSafeDeploymentUpgraded(event: Upgraded): void {
  const entity = new SafeDeploymentUpgraded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.proxy = event.address;
  entity.implementation = event.params.implementation;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

export function handleSafeDeploymentAdminChanged(event: AdminChanged): void {
  const entity = new SafeDeploymentProxyAdminChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.proxy = event.address;
  entity.previousAdmin = event.params.previousAdmin;
  entity.newAdmin = event.params.newAdmin;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();

  // Auto-follow admin rotations: same pattern as the logger proxy. The role
  // context tag lets the template handler distinguish these from logger
  // admin events even though they share the ProxyAdminOwnershipTransferred
  // entity.
  const context = new DataSourceContext();
  context.setString('role', 'SafeDeploymentProxyAdmin');
  ProxyAdmin.createWithContext(event.params.newAdmin, context);
}
