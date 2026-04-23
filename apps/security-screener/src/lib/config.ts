export type ChainId = 'arbitrum' | 'base' | 'mainnet';

// The screener supports an aggregated "all chains" view in addition to the
// three per-chain views. Data sections treat `'all'` as "fetch every chain in
// parallel and tag each row with its origin chain".
export type ViewId = ChainId | 'all';

export interface ChainConfig {
  id: ChainId;
  label: string;
  shortLabel: string;
  // Accent colour used for the chain dot / badge / per-chain stat stripe.
  color: string;
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

// The production Graph Studio endpoints below are the canonical, public read
// endpoints for the three Brava security subgraphs (studio slug owner 89709).
// They are hardcoded on purpose: the screener is designed to be reproducible
// from the commit alone, so baking environment-dependent URLs would break
// that property.
//
// For local development against a different endpoint (e.g. the docker-compose
// graph-node stack, or a privately-deployed subgraph), set the matching
// `VITE_SUBGRAPH_*` env var in `.env.local` — it overrides the hardcoded URL
// at build time. For IPFS pins that need to be repointable without a rebuild,
// use the runtime `window.__BRAVA_SCREENER__.subgraphs` override instead.
//
// The contract addresses are duplicated from `apps/security-subgraph/networks.json`
// and must stay in sync.
export const CHAINS: Record<ChainId, ChainConfig> = {
  arbitrum: {
    id: 'arbitrum',
    label: 'Arbitrum One',
    shortLabel: 'Arbitrum',
    color: '#28a0f0',
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
      'https://api.studio.thegraph.com/query/89709/brava-security-arbitrum/version/latest'
    ),
  },
  base: {
    id: 'base',
    label: 'Base',
    shortLabel: 'Base',
    color: '#1652f0',
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
      'https://api.studio.thegraph.com/query/89709/brava-security-base/version/latest'
    ),
  },
  mainnet: {
    id: 'mainnet',
    label: 'Ethereum Mainnet',
    shortLabel: 'Ethereum',
    color: '#8a92b2',
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
      'https://api.studio.thegraph.com/query/89709/brava-security-ethereum/version/latest'
    ),
  },
};

export const CHAIN_ORDER: ChainId[] = ['arbitrum', 'base', 'mainnet'];

// Ordered list of views for the top-level network tabs. `'all'` is first so
// that fresh visitors land on the aggregated view by default.
export const VIEW_ORDER: ViewId[] = ['all', 'arbitrum', 'base', 'mainnet'];

export interface ViewMeta {
  id: ViewId;
  label: string;
  shortLabel: string;
  // Chains included in this view. For `'all'` this is every indexed chain.
  chains: ChainId[];
}

export const VIEW_META: Record<ViewId, ViewMeta> = {
  all: {
    id: 'all',
    label: 'All chains',
    shortLabel: 'All',
    chains: [...CHAIN_ORDER],
  },
  arbitrum: {
    id: 'arbitrum',
    label: CHAINS.arbitrum.label,
    shortLabel: CHAINS.arbitrum.shortLabel,
    chains: ['arbitrum'],
  },
  base: {
    id: 'base',
    label: CHAINS.base.label,
    shortLabel: CHAINS.base.shortLabel,
    chains: ['base'],
  },
  mainnet: {
    id: 'mainnet',
    label: CHAINS.mainnet.label,
    shortLabel: CHAINS.mainnet.shortLabel,
    chains: ['mainnet'],
  },
};

export function chainsForView(view: ViewId): ChainId[] {
  return VIEW_META[view].chains;
}

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
