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

// The URLs below are the canonical, public read endpoints on the Graph
// Network decentralized gateway for the three Brava security subgraphs.
// They are hardcoded on purpose: the screener is designed to be reproducible
// from the commit alone, so baking environment-dependent URLs would break
// that property.
//
// The Graph Network gateway requires an API key on every request (see
// `GRAPH_API_KEY` below). The key is baked into the bundle as well, so that
// a walk-up visitor to the IPFS pin can query the subgraphs without any
// out-of-band configuration. This is deliberate — the key is public by
// design, and is expected to be domain-allow-listed + spend-capped in Graph
// Studio to make public distribution safe.
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
      'https://gateway.thegraph.com/api/subgraphs/id/9bFHQSS7GEHSUK6RtAzqRbzboN7c5AV4x3mTpHvwM4hH'
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
      'https://gateway.thegraph.com/api/subgraphs/id/JAJazEVcRxPzk5YLU1x38Gu4wo9L1aM8D2tAbHnQNYFE'
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
      'https://gateway.thegraph.com/api/subgraphs/id/ARRJqr8Jsm1mVe8t2JeX9y98QBpkR93HW245wystrBj7'
    ),
  },
};

// Public Graph Network API key. This key is intentionally committed to the
// repository and baked into the shipped bundle — the gateway requires an
// Authorization header on every request, and there is no practical way to
// distribute a static IPFS bundle that can query the gateway without
// embedding the key somewhere the browser can read it.
//
// Safety assumptions:
//   - The key is domain-allow-listed in Graph Studio to brava.finance hosts
//     (and public IPFS gateways we care about).
//   - The key has a monthly spending cap configured in Graph Studio.
//   - If the key is abused anyway, rotate it by committing a new value here
//     and cutting a new release.
//
// For local development you can override this with `VITE_GRAPH_API_KEY` in
// `.env.local` (e.g. a throwaway personal key), or at runtime via
// `window.__BRAVA_SCREENER__.graphApiKey` on an IPFS pin.
export const GRAPH_API_KEY: string = fallback(
  'VITE_GRAPH_API_KEY',
  '80fa4996f4472d9f285d197cb48666b2'
);

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
  graphApiKey?: string;
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

export function resolveGraphApiKey(): string {
  const override =
    typeof window === 'undefined' ? undefined : window.__BRAVA_SCREENER__?.graphApiKey;
  if (override !== undefined && override.length > 0) return override;
  return GRAPH_API_KEY;
}
