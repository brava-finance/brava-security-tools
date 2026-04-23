import { Card } from '../components/Card';
import { ChainBadge } from '../components/ChainBadge';
import { AddressLink } from '../components/ExplorerLink';
import { CHAINS, CHAIN_ORDER } from '../lib/config';

interface VerifyInfo {
  buildCommit: string | undefined;
  buildTime: string | undefined;
  bundleHash: string | undefined;
}

function readVerifyInfo(): VerifyInfo {
  return {
    buildCommit: import.meta.env.VITE_BUILD_COMMIT,
    buildTime: import.meta.env.VITE_BUILD_TIME,
    bundleHash: import.meta.env.VITE_BUNDLE_HASH,
  };
}

const REPO_URL = 'https://github.com/brava-finance/brava-security-tools';
const RELEASES_URL = `${REPO_URL}/releases`;

function releaseUrlForCommit(commit: string | undefined): string {
  if (commit === undefined || commit.length === 0) return RELEASES_URL;
  // Link to the commit page; the matching release tag is reachable from there
  // and the release body lists the pinned IPFS CID.
  return `${REPO_URL}/commit/${commit}`;
}

export function Verify() {
  const info = readVerifyInfo();
  const releaseUrl = releaseUrlForCommit(info.buildCommit);

  return (
    <div className='grid gap-4'>
      <Card
        title='Verify this screener yourself'
        subtitle='Do not trust us — reproduce the build locally and compare against the values shown in This build below.'
      >
        <ol className='list-decimal space-y-3 pl-4 text-sm text-[var(--color-text)]'>
          <li>
            Clone <code className='mono'>github.com/brava-finance/brava-security-tools</code> at
            commit <code className='mono'>{info.buildCommit ?? 'unknown'}</code>.
          </li>
          <li>
            From the repo root, install dependencies, run a clean build (no{' '}
            <code className='mono'>VITE_BUNDLE_HASH</code> in the environment) and compute the
            aggregate hash of the resulting <code className='mono'>dist/</code>:
            <pre className='mt-2 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)]'>
              <code className='mono'>{`pnpm install\npnpm --filter @brava/security-screener build\npnpm --filter @brava/security-screener hash`}</code>
            </pre>
          </li>
          <li>
            Confirm the aggregate hash printed by the <code className='mono'>hash</code> script
            matches the <strong>Bundle SHA-256</strong> shown below. That value attests to the
            reproducible, un-embedded artifact for this commit — so a match means the JS, CSS and
            HTML served to you were produced from the exact source at{' '}
            <code className='mono'>{info.buildCommit ?? 'unknown'}</code>.
          </li>
          <li>
            To additionally prove that the <em>pinned</em> artifact you are currently loading is the
            one published by the release, look up the matching{' '}
            <a href={releaseUrl} target='_blank' rel='noreferrer'>
              GitHub release
            </a>{' '}
            — it lists the IPFS CID and the SHA-256 of the pinned <code className='mono'>dist/</code>.
            Rebuild once more with <code className='mono'>VITE_BUNDLE_HASH</code> set to the value
            above, then compute the CID and hash of the new <code className='mono'>dist/</code>:
            <pre className='mt-2 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)]'>
              <code className='mono'>{`VITE_BUNDLE_HASH=<value-above> pnpm --filter @brava/security-screener build\npnpm --filter @brava/security-screener hash\nnpx ipfs-car pack apps/security-screener/dist --output /tmp/screener.car\n# or, with a running kubo daemon:\nipfs add -rQ --cid-version 1 --only-hash apps/security-screener/dist`}</code>
            </pre>
            Both should match the values published in the release.
          </li>
        </ol>
        <p className='mt-4 text-xs text-[var(--color-text-faint)]'>
          Why is the IPFS CID not shown on this page? The CID is a hash of the bundle, so embedding
          it here would change the bundle and therefore the CID — there is no fixed point. The same
          is true of the SHA-256 of the pinned artifact. Both are published in the GitHub release
          instead, so the attestation stays honest. The <strong>Bundle SHA-256</strong> shown below
          is the hash of an <em>un-embedded</em> reproducible build — not of the bundle currently
          served to you.
        </p>
      </Card>

      <Card
        title='This build'
        actions={
          <a
            href={releaseUrl}
            target='_blank'
            rel='noreferrer'
            className='text-xs text-[var(--color-accent)] hover:underline'
          >
            View GitHub release →
          </a>
        }
      >
        <dl className='grid gap-3 sm:grid-cols-2'>
          <Row k='Commit' v={info.buildCommit ?? 'unknown (dev build)'} mono />
          <Row k='Built at' v={info.buildTime ?? 'unknown (dev build)'} mono />
          <Row k='Bundle SHA-256' v={info.bundleHash ?? 'unknown (dev build)'} mono breakable />
        </dl>
      </Card>

      <Card
        title='On-chain anchors'
        subtitle='Addresses embedded in this bundle. Everything else is derived from these.'
      >
        <div className='grid gap-4 lg:grid-cols-3'>
          {CHAIN_ORDER.map((id) => {
            const cfg = CHAINS[id];
            return (
              <div
                key={id}
                className='relative overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-raised)]/50 p-4'
              >
                <span
                  aria-hidden='true'
                  className='absolute inset-y-0 left-0 w-[3px]'
                  style={{
                    background: `linear-gradient(180deg, ${cfg.color}, ${cfg.color}00)`,
                  }}
                />
                <div className='mb-3 flex items-center gap-2'>
                  <ChainBadge chain={id} variant='short' />
                  <span className='text-[10px] text-[var(--color-text-faint)]'>
                    chain id {cfg.chainId}
                  </span>
                </div>
                <dl className='grid gap-1.5 text-xs'>
                  <Anchor k='Logger proxy' cfg={cfg} v={cfg.contracts.LoggerProxy} />
                  <Anchor k='Logger proxy admin' cfg={cfg} v={cfg.contracts.LoggerProxyAdmin} />
                  {cfg.contracts.SafeDeploymentProxyAdmin !== undefined && (
                    <Anchor
                      k='Safe deployment proxy admin'
                      cfg={cfg}
                      v={cfg.contracts.SafeDeploymentProxyAdmin}
                    />
                  )}
                  <Anchor k='Admin vault' cfg={cfg} v={cfg.contracts.AdminVault} />
                  <Anchor k='Safe setup registry' cfg={cfg} v={cfg.contracts.SafeSetupRegistry} />
                  <div className='mt-3 text-[10px] text-[var(--color-text-faint)]'>
                    Subgraph: <code className='mono break-all'>{cfg.subgraphUrl}</code>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title='Why you should not trust a single view of this data'>
        <ul className='list-disc space-y-2 pl-5 text-sm text-[var(--color-text-muted)]'>
          <li>
            The screener is static: it ships with no backend and renders only data fetched from the
            subgraph you point it at. Override the subgraph URL at runtime by setting{' '}
            <code className='mono'>window.__BRAVA_SCREENER__.subgraphs</code> before boot.
          </li>
          <li>
            The subgraph mappings are deterministic and open-sourced (
            <code className='mono'>apps/security-subgraph</code>). Anyone can spin up their own
            graph-node instance and confirm they produce the same entities.
          </li>
          <li>
            The Divergence section compares the Logger-sourced view with the native AccessControl
            events. If they ever disagree, treat the protocol as potentially compromised until
            cleared.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
  breakable,
}: {
  k: string;
  v: string;
  mono?: boolean;
  breakable?: boolean;
}) {
  const valueClass = `${mono === true ? 'mono ' : ''}${breakable === true ? 'break-all ' : ''}text-sm text-[var(--color-text)]`;
  return (
    <div className='grid gap-0.5'>
      <dt className='text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]'>{k}</dt>
      <dd className={valueClass}>{v}</dd>
    </div>
  );
}

function Anchor({
  k,
  cfg,
  v,
}: {
  k: string;
  cfg: (typeof CHAINS)[keyof typeof CHAINS];
  v: string;
}) {
  return (
    <div className='flex items-center justify-between gap-2'>
      <span className='text-[var(--color-text-muted)]'>{k}</span>
      <AddressLink chain={cfg} address={v} short={false} />
    </div>
  );
}
