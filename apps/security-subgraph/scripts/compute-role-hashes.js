#!/usr/bin/env node
/*
 * Standalone helper: prints keccak256 of every role string declared in
 * packages/contracts/contracts/auth/Roles.sol.
 *
 * Run this whenever Roles.sol changes and mirror the output into
 * src/roles.ts.
 */

const { ethers } = require('ethers');

const names = [
  'OWNER_ROLE',
  'ROLE_MANAGER_ROLE',
  'FEE_PROPOSER_ROLE',
  'FEE_CANCELER_ROLE',
  'FEE_EXECUTOR_ROLE',
  'FEE_TAKER_ROLE',
  'POOL_PROPOSER_ROLE',
  'POOL_CANCELER_ROLE',
  'POOL_EXECUTOR_ROLE',
  'POOL_DISPOSER_ROLE',
  'ACTION_PROPOSER_ROLE',
  'ACTION_CANCELER_ROLE',
  'ACTION_EXECUTOR_ROLE',
  'ACTION_DISPOSER_ROLE',
  'TRANSACTION_PROPOSER_ROLE',
  'TRANSACTION_CANCELER_ROLE',
  'TRANSACTION_EXECUTOR_ROLE',
  'TRANSACTION_DISPOSER_ROLE',
];

for (const name of names) {
  console.log(`${name.padEnd(28)} ${ethers.id(name)}`);
}
