export type ChainId = 'arbitrum' | 'base' | 'mainnet';

export interface ChainConfig {
  id: ChainId;
  label: string;
  chainId: number;
  explorer: string;
  contracts: {
    Logger: string;
    LoggerProxy: string;
    LoggerProxyAdmin: string;
    AdminVault: string;
    SafeSetupRegistry: string;
    SafeDeploymentProxyAdmin?: string;
  };
  subgraphUrl: string;
}

const readEnv = (key: string): string | undefined => {
  const value = import.meta.env[key] as string | undefined;
  if (value === undefined || value.length === 0) return undefined;
  return value;
};

const fallback = (envKey: string, hardcoded: string): string => {
  const value = readEnv(envKey);
  if (value === undefined) return hardcoded;
  return value;
};

// The production-studio endpoints below are placeholders. Wire the real
// subgraph IDs via a `.env.production` or via a runtime `window.__BRAVA_SCREENER__`
// override (see `App.tsx`). The contract addresses are duplicated from
// `apps/security-subgraph/networks.json` and must stay in sync.
export const CHAINS: Record<ChainId, ChainConfig> = {
  arbitrum: {
    id: 'arbitrum',
    label: 'Arbitrum One',
    chainId: 42161,
    explorer: 'https://arbiscan.io',
    contracts: {
      Logger: '0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb',
      LoggerProxy: '0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb',
      LoggerProxyAdmin: '0x237E5d6CAf1ABc06B9A1a625FF04f8BC1b7F7e2c',
      AdminVault: '0x6340AD65c5CCdbAb2095aBBa89c4C42487978066',
      SafeSetupRegistry: '0x6b409911976012Cc947E0Bc0D8d7f5442D7e3410',
    },
    subgraphUrl: fallback(
      'VITE_SUBGRAPH_ARBITRUM',
      'https://api.studio.thegraph.com/query/brava/brava-security-arbitrum/version/latest'
    ),
  },
  base: {
    id: 'base',
    label: 'Base',
    chainId: 8453,
    explorer: 'https://basescan.org',
    contracts: {
      Logger: '0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb',
      LoggerProxy: '0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb',
      LoggerProxyAdmin: '0x237E5d6CAf1ABc06B9A1a625FF04f8BC1b7F7e2c',
      AdminVault: '0x6340AD65c5CCdbAb2095aBBa89c4C42487978066',
      SafeSetupRegistry: '0x6b409911976012Cc947E0Bc0D8d7f5442D7e3410',
    },
    subgraphUrl: fallback(
      'VITE_SUBGRAPH_BASE',
      'https://api.studio.thegraph.com/query/brava/brava-security-base/version/latest'
    ),
  },
  mainnet: {
    id: 'mainnet',
    label: 'Ethereum Mainnet',
    chainId: 1,
    explorer: 'https://etherscan.io',
    contracts: {
      Logger: '0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb',
      LoggerProxy: '0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb',
      LoggerProxyAdmin: '0xc37dbbcaf7b494875ef2d1e70d74a9763d48c3cb',
      SafeDeploymentProxyAdmin: '0x3253fFbFEC3606904b02784C7884F6E579e094a3',
      AdminVault: '0x6340AD65c5CCdbAb2095aBBa89c4C42487978066',
      SafeSetupRegistry: '0x6b409911976012Cc947E0Bc0D8d7f5442D7e3410',
    },
    subgraphUrl: fallback(
      'VITE_SUBGRAPH_MAINNET',
      'https://api.studio.thegraph.com/query/brava/brava-security-ethereum/version/latest'
    ),
  },
};

export const CHAIN_ORDER: ChainId[] = ['arbitrum', 'base', 'mainnet'];

export interface RuntimeOverride {
  subgraphs?: Partial<Record<ChainId, string>>;
}

declare global {
  interface Window {
    __BRAVA_SCREENER__?: RuntimeOverride;
  }
}

export function resolveSubgraphUrl(chain: ChainId): string {
  const override =
    typeof window === 'undefined' ? undefined : window.__BRAVA_SCREENER__?.subgraphs?.[chain];
  if (override !== undefined && override.length > 0) return override;
  return CHAINS[chain].subgraphUrl;
}
