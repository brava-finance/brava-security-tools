#!/usr/bin/env node
// Walks apps/security-screener/dist, hashes every file, writes
// dist/dist-hashes.txt and prints the aggregate hash so CI / release
// automation can pin it alongside the IPFS CID.

import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(here, '..', 'dist');

async function walk(dir) {
  const entries = await readdir(dir);
  const results = [];
  for (const entry of entries) {
    const abs = join(dir, entry);
    const s = await stat(abs);
    if (s.isDirectory()) {
      results.push(...(await walk(abs)));
    } else {
      results.push(abs);
    }
  }
  return results;
}

async function main() {
  let files;
  try {
    files = await walk(distDir);
  } catch (err) {
    console.error(`Could not read ${distDir}. Did you run 'pnpm build' first?`);
    console.error(err.message);
    process.exit(1);
  }
  files.sort();

  const lines = [];
  const aggregate = createHash('sha256');

  for (const file of files) {
    if (file.endsWith('dist-hashes.txt')) continue;
    const buf = await readFile(file);
    const hash = createHash('sha256').update(buf).digest('hex');
    const rel = relative(distDir, file);
    lines.push(`${hash}  ${rel}`);
    aggregate.update(`${hash}  ${rel}\n`);
  }

  const aggregateHex = aggregate.digest('hex');
  const output = `# sha256 per file, sorted; final line is aggregate\n${lines.join('\n')}\n# aggregate: ${aggregateHex}\n`;
  await writeFile(join(distDir, 'dist-hashes.txt'), output);
  console.log(output);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
