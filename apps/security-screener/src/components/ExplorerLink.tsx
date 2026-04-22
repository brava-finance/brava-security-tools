import type { ChainConfig } from '../lib/config';
import { bytesToHex, cn, explorerAddressUrl, explorerTxUrl, shortAddress } from '../lib/format';

interface AddressProps {
  chain: ChainConfig;
  address: string;
  label?: string;
  short?: boolean;
  className?: string;
}

export function AddressLink({ chain, address, label, short = true, className }: AddressProps) {
  const display = label ?? (short ? shortAddress(address) : bytesToHex(address));
  return (
    <a
      className={cn('mono text-xs', className)}
      href={explorerAddressUrl(chain.explorer, address)}
      target='_blank'
      rel='noreferrer noopener'
      title={bytesToHex(address)}
    >
      {display}
    </a>
  );
}

interface TxProps {
  chain: ChainConfig;
  txHash: string;
  short?: boolean;
  className?: string;
}

export function TxLink({ chain, txHash, short = true, className }: TxProps) {
  const display = short ? shortAddress(txHash, 6) : bytesToHex(txHash);
  return (
    <a
      className={cn('mono text-xs', className)}
      href={explorerTxUrl(chain.explorer, txHash)}
      target='_blank'
      rel='noreferrer noopener'
      title={bytesToHex(txHash)}
    >
      {display}
    </a>
  );
}
