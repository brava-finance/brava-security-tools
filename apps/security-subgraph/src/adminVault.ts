import { RoleAdminChanged, RoleGranted, RoleRevoked } from '../generated/AdminVault/IAccessControl';
import {
  RoleAdminChange,
  RoleGrantFromAccessControl,
  RoleRevokeFromAccessControl,
} from '../generated/schema';
import { resolveRoleName } from './roles';

export function handleRoleGrantedFromAccessControl(event: RoleGranted): void {
  const entity = new RoleGrantFromAccessControl(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.role = event.params.role;
  entity.roleName = resolveRoleName(event.params.role);
  entity.account = event.params.account;
  entity.sender = event.params.sender;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

export function handleRoleRevokedFromAccessControl(event: RoleRevoked): void {
  const entity = new RoleRevokeFromAccessControl(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.role = event.params.role;
  entity.roleName = resolveRoleName(event.params.role);
  entity.account = event.params.account;
  entity.sender = event.params.sender;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

export function handleRoleAdminChangedFromAccessControl(event: RoleAdminChanged): void {
  const entity = new RoleAdminChange(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.role = event.params.role;
  entity.roleName = resolveRoleName(event.params.role);
  entity.previousAdminRole = event.params.previousAdminRole;
  entity.newAdminRole = event.params.newAdminRole;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}
