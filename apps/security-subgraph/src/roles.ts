import { Bytes } from '@graphprotocol/graph-ts';

// keccak256 of each role constant declared in
// packages/contracts/contracts/auth/Roles.sol. Precomputed offline (see
// scripts/compute-role-hashes.js) to avoid doing keccak256 at mapping load
// time, which AssemblyScript doesn't support.

const DEFAULT_ADMIN_ROLE = Bytes.fromHexString(
  '0x0000000000000000000000000000000000000000000000000000000000000000'
);
const OWNER_ROLE = Bytes.fromHexString(
  '0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e'
);
const ROLE_MANAGER_ROLE = Bytes.fromHexString(
  '0x0f6ee822d2ee125e4ce6edbae6c10a76fa9fd4617e0399ab687226fa33442100'
);
const FEE_PROPOSER_ROLE = Bytes.fromHexString(
  '0x3f5fba3a1436af8b45aefdf26f89f5807959d0b316fbafd40b66ca527d0e49b3'
);
const FEE_CANCELER_ROLE = Bytes.fromHexString(
  '0x826af3bf5125b9a75b53766bdf167be999465a06ba11477e11639a49143bd734'
);
const FEE_EXECUTOR_ROLE = Bytes.fromHexString(
  '0x31ca2e68417c4c75d5434e529d2ad5f6fc83e9bbdb0f840ed95c2525b4b53cb5'
);
const FEE_TAKER_ROLE = Bytes.fromHexString(
  '0xa23dcad5e1437109ba80d5d43ce61b76c4ba71b990bb2fb30e4a25825b5722ac'
);
const POOL_PROPOSER_ROLE = Bytes.fromHexString(
  '0xe2c1d5a87694d73df1ee00dc4a0f486d83d77c51d700fea699a4db3d4f3c3c5b'
);
const POOL_CANCELER_ROLE = Bytes.fromHexString(
  '0xb090ffe716a3976b8bd0307087b831c863608a7b0889217af1a3bd6c18b8f3de'
);
const POOL_EXECUTOR_ROLE = Bytes.fromHexString(
  '0x72e2e10353a44bac613fb0efb863d5efcf21233daceb078cd60b9b439c34bc6b'
);
const POOL_DISPOSER_ROLE = Bytes.fromHexString(
  '0x9d48cb35069276177127c4c724db2665903a5bf9bfefebf62e7ce30dded73304'
);
const ACTION_PROPOSER_ROLE = Bytes.fromHexString(
  '0xb15e3077e7f51205b0d5d0054126c25ef95262bd0c35a00a0dc8a4c9a6553b4c'
);
const ACTION_CANCELER_ROLE = Bytes.fromHexString(
  '0x22275e60a6684a0d69c566c1f1659cb8bb5f893b39e0e971d6289561c8663fd0'
);
const ACTION_EXECUTOR_ROLE = Bytes.fromHexString(
  '0xadee834f4f5d01f5a91928686d239e53c5fe9aacf08de75b080e57b11d82e89c'
);
const ACTION_DISPOSER_ROLE = Bytes.fromHexString(
  '0x5c3c5b2faf1e3af313e082480f79d9f0248207ea9aa02755e0cae60568f86bd7'
);
const TRANSACTION_PROPOSER_ROLE = Bytes.fromHexString(
  '0x4bf52dc2c954981278ff6c74fd7abc8016e411aaaea43c0c70c3d11bba3c7de9'
);
const TRANSACTION_CANCELER_ROLE = Bytes.fromHexString(
  '0x124d70cd22f9afb5a50d2dae097ffad37d6e6cb6487d74061ef061ceaa0fdd70'
);
const TRANSACTION_EXECUTOR_ROLE = Bytes.fromHexString(
  '0xbc39e22ae17949978850c1ebfcfc5ce3aec62d7305fe0a77729f8f273e1b0ed9'
);
const TRANSACTION_DISPOSER_ROLE = Bytes.fromHexString(
  '0x1928ca9df04ffa6228863ec8e94d0b8aca7ef13127ad89b9eef5b48f90356019'
);

export function resolveRoleName(role: Bytes): string {
  if (role.equals(OWNER_ROLE)) return 'OWNER_ROLE';
  if (role.equals(DEFAULT_ADMIN_ROLE)) return 'DEFAULT_ADMIN_ROLE';
  if (role.equals(ROLE_MANAGER_ROLE)) return 'ROLE_MANAGER_ROLE';
  if (role.equals(FEE_PROPOSER_ROLE)) return 'FEE_PROPOSER_ROLE';
  if (role.equals(FEE_CANCELER_ROLE)) return 'FEE_CANCELER_ROLE';
  if (role.equals(FEE_EXECUTOR_ROLE)) return 'FEE_EXECUTOR_ROLE';
  if (role.equals(FEE_TAKER_ROLE)) return 'FEE_TAKER_ROLE';
  if (role.equals(POOL_PROPOSER_ROLE)) return 'POOL_PROPOSER_ROLE';
  if (role.equals(POOL_CANCELER_ROLE)) return 'POOL_CANCELER_ROLE';
  if (role.equals(POOL_EXECUTOR_ROLE)) return 'POOL_EXECUTOR_ROLE';
  if (role.equals(POOL_DISPOSER_ROLE)) return 'POOL_DISPOSER_ROLE';
  if (role.equals(ACTION_PROPOSER_ROLE)) return 'ACTION_PROPOSER_ROLE';
  if (role.equals(ACTION_CANCELER_ROLE)) return 'ACTION_CANCELER_ROLE';
  if (role.equals(ACTION_EXECUTOR_ROLE)) return 'ACTION_EXECUTOR_ROLE';
  if (role.equals(ACTION_DISPOSER_ROLE)) return 'ACTION_DISPOSER_ROLE';
  if (role.equals(TRANSACTION_PROPOSER_ROLE)) return 'TRANSACTION_PROPOSER_ROLE';
  if (role.equals(TRANSACTION_CANCELER_ROLE)) return 'TRANSACTION_CANCELER_ROLE';
  if (role.equals(TRANSACTION_EXECUTOR_ROLE)) return 'TRANSACTION_EXECUTOR_ROLE';
  if (role.equals(TRANSACTION_DISPOSER_ROLE)) return 'TRANSACTION_DISPOSER_ROLE';
  return 'UNKNOWN_ROLE:' + role.toHexString();
}
