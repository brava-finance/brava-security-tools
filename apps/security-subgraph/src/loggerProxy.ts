import { AdminChanged, Upgraded } from '../generated/LoggerProxy/ITransparentUpgradeableProxy';
import { LoggerProxyAdminChanged, LoggerUpgraded } from '../generated/schema';

export function handleLoggerUpgraded(event: Upgraded): void {
  const entity = new LoggerUpgraded(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.proxy = event.address;
  entity.implementation = event.params.implementation;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}

export function handleLoggerAdminChanged(event: AdminChanged): void {
  const entity = new LoggerProxyAdminChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.proxy = event.address;
  entity.previousAdmin = event.params.previousAdmin;
  entity.newAdmin = event.params.newAdmin;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}
