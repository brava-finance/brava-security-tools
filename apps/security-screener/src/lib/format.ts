import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string | null | undefined, chars = 4): string {
  if (address === null || address === undefined || address.length < 2 + chars * 2) {
    return address ?? '';
  }
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function formatTimestamp(unixSeconds: string | number | bigint): string {
  const asNumber =
    typeof unixSeconds === 'bigint'
      ? Number(unixSeconds)
      : typeof unixSeconds === 'string'
        ? Number.parseInt(unixSeconds, 10)
        : unixSeconds;
  if (!Number.isFinite(asNumber)) return '—';
  const d = new Date(asNumber * 1000);
  return d.toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

export function formatRelative(unixSeconds: string | number | bigint, now = Date.now()): string {
  const asNumber =
    typeof unixSeconds === 'bigint'
      ? Number(unixSeconds)
      : typeof unixSeconds === 'string'
        ? Number.parseInt(unixSeconds, 10)
        : unixSeconds;
  if (!Number.isFinite(asNumber)) return '—';
  const diffSeconds = Math.floor(now / 1000) - asNumber;
  const abs = Math.abs(diffSeconds);
  const suffix = diffSeconds >= 0 ? ' ago' : ' from now';
  if (abs < 60) return `${abs}s${suffix}`;
  if (abs < 3600) return `${Math.floor(abs / 60)}m${suffix}`;
  if (abs < 86_400) return `${Math.floor(abs / 3600)}h${suffix}`;
  if (abs < 30 * 86_400) return `${Math.floor(abs / 86_400)}d${suffix}`;
  if (abs < 365 * 86_400) return `${Math.floor(abs / (30 * 86_400))}mo${suffix}`;
  return `${Math.floor(abs / (365 * 86_400))}y${suffix}`;
}

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const abs = Math.abs(seconds);
  if (abs < 60) return `${Math.floor(abs)}s`;
  if (abs < 3600) return `${Math.floor(abs / 60)}m ${Math.floor(abs % 60)}s`;
  if (abs < 86_400) {
    const hours = Math.floor(abs / 3600);
    const mins = Math.floor((abs % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  const days = Math.floor(abs / 86_400);
  const hours = Math.floor((abs % 86_400) / 3600);
  return `${days}d ${hours}h`;
}

export function formatBigIntBasis(basis: string | bigint, decimals = 2): string {
  const asBigInt = typeof basis === 'bigint' ? basis : BigInt(basis);
  const whole = asBigInt / 100n;
  const frac = asBigInt % 100n;
  if (decimals === 0) return `${whole}%`;
  const fracStr = frac.toString().padStart(2, '0').slice(0, decimals);
  return `${whole}.${fracStr}%`;
}

export function bytesToHex(value: string): string {
  if (value.startsWith('0x')) return value;
  return `0x${value}`;
}

export function explorerTxUrl(explorer: string, txHash: string): string {
  return `${explorer}/tx/${bytesToHex(txHash)}`;
}

export function explorerAddressUrl(explorer: string, address: string): string {
  return `${explorer}/address/${bytesToHex(address)}`;
}
