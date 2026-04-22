# @brava/security-subgraph

Minimal, audit-focused subgraph that indexes every protocol-level security
event across Arbitrum, Base and Ethereum mainnet. It is the immutable data
source behind [`@brava/security-screener`](../security-screener).

The subgraph:

- Indexes only security-relevant events (admin vault, proxy upgrades,
  proxy-admin ownership, role changes, safe-setup config changes, token
  registry changes, delay changes).
- Runs on every chain Brava is deployed on.
- Indexes the `LoggerProxy` address as both a `Logger` **and** a
  `TransparentUpgradeableProxy` — the latter is what lets us catch someone
  upgrading the logger to silence admin event emission.
- Cross-records role changes from two independent sources (Logger-derived
  events and OpenZeppelin `AccessControl`-derived events) so the screener
  UI can flag divergences.

## Tracked contracts (same addresses on all chains unless noted)

| Contract                       | Address                                      | Events indexed                     |
| ------------------------------ | -------------------------------------------- | ---------------------------------- |
| `Logger` (proxy)               | `0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb` | `AdminVaultEvent`, `ActionEvent`   |
| `LoggerProxy` (same)           | `0x7c4F19cA61a2F0d80cF1312afbdCDAB241281BFb` | `Upgraded`, `AdminChanged`         |
| `LoggerProxyAdmin`             | arb/base: `0x237E5d6…`, mainnet: `0xc37dbb…` | `OwnershipTransferred`             |
| `SafeDeploymentPxAdmin`        | mainnet only: `0x3253fFb…`                   | `OwnershipTransferred`             |
| `AdminVault`                   | `0x6340AD65c5CCdbAb2095aBBa89c4C42487978066` | `RoleGranted/Revoked/AdminChanged` |
| `SafeSetupRegistry`            | `0x6b409911976012Cc947E0Bc0D8d7f5442D7e3410` | `CurrentConfigurationUpdated`      |

Start blocks live in [`networks.json`](./networks.json) and can be lowered
per-chain via `START_BLOCK_<CHAIN>` environment variables when running against
the local Docker Compose stack (useful for fast dev iteration).

## Local workflow

```bash
# Install deps. This package is excluded from the root pnpm workspace (see
# "Excluded from the pnpm workspace" below), so `pnpm install` from here
# has to be told to ignore the parent workspace — otherwise pnpm walks up,
# finds the workspace, sees this package is not listed, and skips it.
pnpm install --ignore-workspace

# (Or from the repo root: `pnpm run install:all` installs both.)

# Render subgraph.yaml from subgraph.template.yaml + networks.json:
pnpm prepare:arbitrum
# or pnpm prepare:base / pnpm prepare:mainnet

# Generate AssemblyScript types + validate the WASM build:
pnpm build:arbitrum

# Deploy to Graph Studio (requires `graph auth --studio <deploy-key>` first):
pnpm deploy:arbitrum
```

The three-step `prepare → codegen → build` sequence is wrapped in the
`build:<network>` scripts for convenience.

## Full local indexing stack

`docker-compose.yml` spins up one `graph-node` per chain, a shared Postgres
(with a separate database per chain), and a single IPFS node so you can index
mainnet events on your own hardware:

```bash
cp .env.example .env
# fill in ARBITRUM_RPC_URL, BASE_RPC_URL, MAINNET_RPC_URL with your own
# archive RPCs (public nodes will rate-limit; Alchemy/Infura/Tenderly work)

pnpm local:up

pnpm create-local:arbitrum
pnpm deploy-local:arbitrum

# GraphQL playground: http://localhost:8000/subgraphs/name/brava/security-arbitrum/graphql
# Indexing status:    http://localhost:8030/graphql
```

Equivalent scripts exist for `base` (ports `8100 / 8130`) and `mainnet`
(ports `8200 / 8230`).

## Schema overview

All per-event entities are immutable. The schema deliberately has **no derived
current state** for events — the screener frontend reconstructs current state
from the event stream. Aggregate entities (`Action`, `Pool`, `Protocol`,
`Token`) are mutable and enriched at index time with on-chain metadata
(`protocolName()`, `actionType()`, `name()`, `symbol()`, `decimals()`) via
`try_` contract calls.

Entities:

- `AdminVaultEventRaw` / `UnknownAdminVaultEvent` — catch-alls for every
  logger admin event, including any the screener doesn't know about yet.
- `ActionProposal`/`Grant`/`Cancel`/`Remove`
- `PoolProposal`/`Grant`/`Cancel`/`Remove`
- `FeeProposal`/`Grant`/`Cancel`
- `RoleProposalFromLogger`/`GrantFromLogger`/`CancelFromLogger`/`RevokeFromLogger`
- `RoleGrantFromAccessControl`/`RevokeFromAccessControl`/`RoleAdminChange`
- `TokenProposal`/`Grant`/`Cancel`/`Revoke`
- `SafeSetupConfigUpdate` + `SafeSetupConfigUpdateFromLogger`
- `SafeCreated` — new Brava user safe provisioned
- `GenericConfigSet` — logId 205 (e.g. `setActionConfig`, `setGasRefundToken`)
- `DelayChange` — change to the global AdminVault delay
- `LoggerUpgraded`, `LoggerProxyAdminChanged`,
  `ProxyAdminOwnershipTransferred`
- `Action`, `Pool`, `Protocol`, `Token` — mutable aggregates with the latest
  on-chain-resolved metadata for each granted entry.

## Updating role hashes

If the `AdminVault` role set ever changes, rerun:

```bash
node scripts/compute-role-hashes.js
```

and mirror the output into `src/roles.ts`.

## Excluded from the pnpm workspace

This package is intentionally excluded from the pnpm workspace in
[`../../pnpm-workspace.yaml`](../../pnpm-workspace.yaml) because
`graph codegen` conflicts with pnpm's hoisted `node_modules`. Run
`pnpm install` inside this directory, not at the repo root.
