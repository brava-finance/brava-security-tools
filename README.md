# brava-security-tools

Open-source security tooling for the [Brava](https://brava.finance) protocol. Two packages:

- [`apps/security-subgraph`](./apps/security-subgraph) — a minimal, audit-focused subgraph that
  indexes every admin-vault event, proxy upgrade, proxy-admin ownership change and
  AccessControl role event on Arbitrum, Base and Ethereum mainnet.
- [`apps/security-screener`](./apps/security-screener) — a static, backend-less React app that
  reads the subgraph and renders current admin-vault state, pending proposals, a
  full event timeline, a role-divergence check (Logger vs AccessControl) and
  reproducible-build verification instructions. Builds to a `dist/` folder that can
  be served from any static host or pinned to IPFS.

## Why?

The subgraph is **the** immutable source of truth for the Brava admin surface.
Because the screener is static and reads the subgraph directly, anyone can:

- Re-deploy the subgraph to their own Graph Node, Studio account or the
  decentralized network and point the screener at it.
- Rebuild the screener from this repo and verify that the bundle hash matches
  what is pinned on IPFS.
- Compare Logger-emitted role events against the native OpenZeppelin
  `AccessControl` events and spot any divergence (e.g. the Logger has been
  upgraded to a silent implementation).

## Repo layout

```
apps/
  security-screener/     # Vite + React 19 + Tailwind v4; no backend, no analytics
  security-subgraph/     # AssemblyScript + The Graph; one manifest per chain
```

`apps/security-subgraph` is **excluded from the pnpm workspace** because
`graph codegen` conflicts with pnpm's hoisted `node_modules`. You run
`pnpm install` inside that folder separately.

## Quick start

```bash
# 1. Install both the screener (workspace) and the subgraph (excluded from
#    the workspace — needs --ignore-workspace so pnpm creates an isolated
#    node_modules instead of skipping the package) in one go:
pnpm run install:all

# 2. Run the screener against the public Graph Studio endpoints:
cp apps/security-screener/.env.example apps/security-screener/.env.local
# edit .env.local if you want to point at your own subgraph deployments
pnpm --filter @brava/security-screener dev
# open http://localhost:5180
```

`install:all` is a convenience wrapper — equivalent to running:

```bash
pnpm install                                                   # root + screener
pnpm --dir apps/security-subgraph install --ignore-workspace   # subgraph
```

See each package's README for detailed workflows:

- [`apps/security-screener/README.md`](./apps/security-screener/README.md)
- [`apps/security-subgraph/README.md`](./apps/security-subgraph/README.md)

## Running a full local stack

To sync the subgraph against a live chain on your own machine (Docker Compose
spins up one `graph-node` per chain plus a shared Postgres and IPFS):

```bash
cd apps/security-subgraph
cp .env.example .env            # add your own archive RPC URLs
pnpm local:up
pnpm create-local:arbitrum
pnpm deploy-local:arbitrum
# GraphQL playground: http://localhost:8000/subgraphs/name/brava/security-arbitrum/graphql
```

Then point the screener at the local subgraph:

```bash
# apps/security-screener/.env.local
VITE_SUBGRAPH_ARBITRUM=http://localhost:8000/subgraphs/name/brava/security-arbitrum
```

## Deploying to Graph Studio

Authenticate once:

```bash
cd apps/security-subgraph
graph auth --studio <your-deploy-key>
```

Then for each chain:

```bash
pnpm deploy:arbitrum   # or deploy:base, deploy:mainnet
```

## License

[MIT](./LICENSE).
