/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUBGRAPH_ARBITRUM?: string;
  readonly VITE_SUBGRAPH_BASE?: string;
  readonly VITE_SUBGRAPH_MAINNET?: string;
  readonly VITE_BUILD_COMMIT?: string;
  readonly VITE_BUILD_TIME?: string;
  readonly VITE_BUNDLE_HASH?: string;
  readonly VITE_IPFS_CID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
