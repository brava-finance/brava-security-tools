import { Card } from '../components/Card';
import { AddressLink } from '../components/ExplorerLink';
import { CHAINS, CHAIN_ORDER } from '../lib/config';

interface VerifyInfo {
  buildCommit: string | undefined;
  buildTime: string | undefined;
  bundleHash: string | undefined;
  ipfsCid: string | undefined;
}

function readVerifyInfo(): VerifyInfo {
  return {
    buildCommit: import.meta.env.VITE_BUILD_COMMIT,
    buildTime: import.meta.env.VITE_BUILD_TIME,
    bundleHash: import.meta.env.VITE_BUNDLE_HASH,
    ipfsCid: import.meta.env.VITE_IPFS_CID,
  };
}

export function Verify() {
  const info = readVerifyInfo();

  return (
    <div className='grid gap-4'>
      <Card
        title='Verify this screener yourself'
        subtitle='Do not trust us — reproduce the build locally.'
      >
        <ol className='list-decimal space-y-3 pl-4 text-sm text-[var(--color-text)]'>
          <li>
            Clone <code className='mono'>github.com/brava-fi/monorepo</code> at commit{' '}
            <code className='mono'>{info.buildCommit ?? 'unknown'}</code>.
          </li>
          <li>
            From the repo root, run:
            <pre className='mt-2 overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)]'>
              <code className='mono'>{`pnpm install\npnpm --filter @brava/security-screener build\nshasum -a 256 apps/security-screener/dist/index.html\nfind apps/security-screener/dist -type f -exec shasum -a 256 {} \\; | sort`}</code>
            </pre>
          </li>
          <li>
            Compare the SHA-256 of each file with the published{' '}
            <code className='mono'>dist-hashes.txt</code> committed in the release tag, and with the
            IPFS CID below.
          </li>
          <li>
            For an even stronger check, re-deploy the dist folder to your own IPFS node and confirm
            the resulting CID matches.
          </li>
        </ol>
      </Card>

      <Card title='This build'>
        <dl className='grid gap-2 sm:grid-cols-2'>
          <Row k='Commit' v={info.buildCommit ?? 'unknown (dev build)'} mono />
          <Row k='Built at' v={info.buildTime ?? 'unknown (dev build)'} mono />
          <Row k='Bundle SHA-256' v={info.bundleHash ?? 'unknown (dev build)'} mono breakable />
          <Row k='IPFS CID' v={info.ipfsCid ?? 'unknown (dev build)'} mono breakable />
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
              <div key={id} className='rounded-md border border-[var(--color-border-subtle)] p-3'>
                <h4 className='mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]'>
                  {cfg.label}
                </h4>
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
                  <div className='mt-2 text-[10px] text-[var(--color-text-faint)]'>
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
