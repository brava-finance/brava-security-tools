import { Bytes } from '@graphprotocol/graph-ts';

import { CurrentConfigurationUpdated } from '../generated/SafeSetupRegistry/ISafeSetupRegistry';
import { SafeSetupConfigUpdate } from '../generated/schema';

export function handleCurrentConfigurationUpdated(event: CurrentConfigurationUpdated): void {
  const entity = new SafeSetupConfigUpdate(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.fallbackHandler = event.params.fallbackHandler;
  const modulesAddrs = event.params.modules;
  const modules = new Array<Bytes>(modulesAddrs.length);
  for (let i = 0; i < modulesAddrs.length; i++) {
    modules[i] = modulesAddrs[i];
  }
  entity.modules = modules;
  entity.guard = event.params.guard;
  entity.source = 'SafeSetupRegistry.CurrentConfigurationUpdated';
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash;
  entity.save();
}
