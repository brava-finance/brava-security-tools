#!/usr/bin/env node
/*
 * Renders subgraph.yaml for a specific chain by merging
 * subgraph.template.yaml with the per-chain record in networks.json.
 *
 * Usage: node scripts/prepare.js <arbitrum|base|mainnet>
 */

const fs = require('fs');
const path = require('path');
const mustache = require('mustache');

const network = process.argv[2];
if (!network) {
  console.error('Usage: prepare.js <arbitrum|base|mainnet>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const networks = JSON.parse(fs.readFileSync(path.join(root, 'networks.json'), 'utf8'));
const cfg = networks[network];
if (!cfg) {
  console.error(`Unknown network: ${network}. Available: ${Object.keys(networks).join(', ')}`);
  process.exit(1);
}

const template = fs.readFileSync(path.join(root, 'subgraph.template.yaml'), 'utf8');

// Optional per-network startBlock override, used by the local docker-compose
// stack to skip multi-million-block historical sync during development.
// e.g. START_BLOCK_ARBITRUM=399000000 pnpm run prepare:arbitrum
const overrideEnv = `START_BLOCK_${network.toUpperCase()}`;
const overrideRaw = process.env[overrideEnv];
const overrideStartBlock =
  overrideRaw !== undefined && overrideRaw.length > 0
    ? Number.parseInt(overrideRaw, 10)
    : undefined;

function withOverride(source) {
  if (source === undefined || overrideStartBlock === undefined) return source;
  return { ...source, startBlock: Math.max(source.startBlock, overrideStartBlock) };
}

const view = {
  network,
  graphNetwork: cfg.graphNetwork,
  Logger: withOverride(cfg.Logger),
  LoggerProxy: withOverride(cfg.LoggerProxy),
  LoggerProxyAdmin: withOverride(cfg.LoggerProxyAdmin),
  SafeDeploymentProxyAdmin: withOverride(cfg.SafeDeploymentProxyAdmin),
  AdminVault: withOverride(cfg.AdminVault),
  SafeSetupRegistry: withOverride(cfg.SafeSetupRegistry),
  LoggerLegacyV1: cfg.LoggerLegacyV1,
  LoggerLegacyV2: cfg.LoggerLegacyV2,
  hasSafeDeploymentProxyAdmin: Boolean(cfg.SafeDeploymentProxyAdmin),
  hasLoggerLegacyV1: Boolean(cfg.LoggerLegacyV1),
  hasLoggerLegacyV2: Boolean(cfg.LoggerLegacyV2),
};

if (overrideStartBlock !== undefined) {
  console.log(`Using startBlock override ${overrideStartBlock} from ${overrideEnv}`);
}

mustache.escape = (v) => v;
const rendered = mustache.render(template, view);
fs.writeFileSync(path.join(root, 'subgraph.yaml'), rendered);

console.log(`Rendered subgraph.yaml for ${network} (${cfg.graphNetwork})`);
