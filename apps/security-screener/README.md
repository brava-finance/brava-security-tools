# @brava/security-screener

Static React app that renders the Brava on-chain security screener.

- **Data source:** the Brava security subgraph (`apps/security-subgraph`) on Arbitrum, Base and Ethereum mainnet.
- **Backend:** none. No wallet, no analytics, no server. All fetches go directly to the subgraph endpoint the user points at.
- **Hosting:** built as a plain `dist/` folder you can serve from any static host or pin to IPFS.
- **Stack:** Vite + React 19 + TypeScript + Tailwind v4 + TanStack Query.

The screener deliberately avoids every large dependency (no Radix, no framer-motion, no `@brava/ui`) so that the shipped bundle stays small and easy to audit end-to-end.

## Sections

| Section           | What it shows                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard         | Current logger proxy implementation, proxy admin, proxy admin owner, active actions/pools/tokens/fee configs/roles, safe setup, delay value. |
| Pending proposals | Every `*Proposal` event that has not yet been granted, cancelled or removed, with a live countdown based on the current `delay`.             |
| Timeline          | Every indexed event across categories (actions, pools, fees, roles, tokens, proxy, safe, delay), filterable.                                 |
| Divergence check  | Compares role state as reported by the Logger vs native AccessControl events. Any mismatch ⇒ alert.                                          |
| Verify yourself   | Build commit, bundle sha256, anchor addresses per chain, reproducible-build instructions and a link to the GitHub release that pins the CID. |

## Local development

```bash
pnpm install
cp apps/security-screener/.env.example apps/security-screener/.env.local
# Fill in the Studio endpoints for each chain.
pnpm --filter @brava/security-screener dev
```

Then open <http://localhost:5180>.

You can also override subgraph endpoints at runtime (useful for IPFS pins that should be repointable without a rebuild):

```html
<script>
  window.__BRAVA_SCREENER__ = {
    subgraphs: {
      arbitrum: 'https://my-own-node.example/subgraphs/name/brava-security-arbitrum',
    },
  };
</script>
```

Place that block before the bundled `<script type="module">` tag in `index.html`.

## Production build + reproducible hashing

```bash
pnpm --filter @brava/security-screener build
pnpm --filter @brava/security-screener hash
```

`hash` walks `dist/` and prints a SHA-256 per file plus an aggregate hash over the whole directory.

### What is embedded in the bundle

The Verify-yourself section displays three values, all baked in at build time:

- `VITE_BUILD_COMMIT` — git rev of the build commit.
- `VITE_BUILD_TIME` — ISO timestamp of the build.
- `VITE_BUNDLE_HASH` — aggregate SHA-256 of an **un-embedded** build (see below).

Two values are deliberately **not** baked in and instead published out-of-band in the matching GitHub release:

- The IPFS CID. Embedding a hash of the bundle into the bundle would change the bundle and therefore the CID — there is no fixed point.
- The SHA-256 of the final pinned bundle. Same reason.

### What the release workflow does

`.github/workflows/release-screener.yml` fully automates the build, the attestation and the creation of a **draft** GitHub release. It does **not** pin to IPFS — that stays a manual step, because pinning providers change and we do not want a provider-specific secret in CI.

On tag push, the workflow:

1. Builds once with `VITE_BUILD_COMMIT=<commit>` and `VITE_BUILD_TIME=<commit committer date>` — this produces the **un-embedded** `dist/`. Its aggregate SHA-256 is what the UI displays as `Bundle SHA-256`.
2. Rebuilds with that aggregate exported as `VITE_BUNDLE_HASH`. This is the **pinned** `dist/`; its own SHA-256 is different by construction.
3. Packs the pinned `dist/` into a CAR using `ipfs-car` (version pinned in `package.json`) and computes the root CID.
4. Creates a **draft** GitHub release whose body lists the commit, `VITE_BUILD_TIME`, un-embedded `VITE_BUNDLE_HASH`, pinned-bundle SHA-256 and IPFS CID, and attaches `unembedded.hashes.txt`, `pinned.hashes.txt` and `screener.car` as release assets.

`workflow_dispatch` is wired up for dry runs too (Actions → Release security screener → Run workflow). Attestations are uploaded as workflow artifacts; no release is created.

### Cutting a release

The end-to-end flow is: tag push → workflow produces draft + CID → you pin the CAR locally → you verify the pin responds at the advertised CID → you publish the draft.

```bash
# 1. Tag + push. Sign the tag if you have GPG configured.
git tag -s screener-v2026.04.22 -m "release"
git push origin screener-v2026.04.22
# Wait for the workflow to finish. It leaves a DRAFT release on GitHub whose
# body advertises the IPFS CID but whose bytes are not pinned anywhere yet.

# 2. Pull the CAR and the advertised CID from the draft release.
TAG=screener-v2026.04.22
gh release download "$TAG" --pattern 'screener.car' --output /tmp/screener.car
CID=$(gh release view "$TAG" --json body --jq .body \
  | grep -oE 'bafy[a-z0-9]+' | head -n1)
echo "advertised CID: $CID"

# 3. Pin to whichever provider you use. Pick one.
#
#    Storacha / w3up (recommended — deterministic, CAR-aware):
w3 up --car /tmp/screener.car
#
#    Pinata (CLI or web UI; the web UI has a "CAR" upload toggle):
pinata upload /tmp/screener.car --cid-version 1
#
#    Your own kubo node:
ipfs dag import /tmp/screener.car
ipfs pin add "$CID"

# 4. Verify the pin is live at the exact CID the release body advertised.
#    This must return 200 and list index.html, assets/, etc.
curl -sS -o /dev/null -w "%{http_code}\n" "https://w3s.link/ipfs/$CID/"
curl -sS "https://w3s.link/ipfs/$CID/" | grep -i '<title>' || echo "content mismatch"
#
# (Substitute your preferred public gateway: dweb.link, ipfs.io, cloudflare-ipfs.com.)

# 5. Sanity check: reproduce the CID from the CAR you just pinned.
pnpm --filter @brava/security-screener exec ipfs-car roots /tmp/screener.car
# must equal $CID

# 6. Everything green? Publish the draft release.
gh release edit "$TAG" --draft=false
```

If step 4 or 5 fails, delete the draft (`gh release delete $TAG`) and investigate — do not publish. The most common cause of a CID mismatch is a pinning provider that chunks or wraps differently; uploading the `.car` file instead of the raw directory avoids that entirely, which is why the workflow ships the CAR.

### Providers known to preserve the CAR's CID

- **Storacha / web3.storage** via `w3 up --car` — preserves CID by construction.
- **Pinata** CAR upload (web UI has a toggle, or `pinata upload file.car`) — preserves CID.
- **kubo** via `ipfs dag import` + `ipfs pin add <CID>` — preserves CID.

Uploading the unpacked `dist/` directory to any of these will also usually produce the same CID (since `ipfs-car`'s defaults match kubo's), but the CAR path avoids any doubt.

### Why `VITE_BUILD_TIME` uses the commit's committer date

Anything baked into the bundle must be purely a function of the release commit, otherwise reviewers cannot reproduce it with just `git checkout <commit>`. The workflow sets `VITE_BUILD_TIME` to `git show -s --format=%cI HEAD`, so the attestation is stable for everyone.

### Why the subgraph URLs are hardcoded, not env-driven

Graph Studio endpoints are public and the screener's reproducibility depends on the bundle being a function of the commit alone. If `VITE_SUBGRAPH_*` were set during a release build, reviewers would need the same values to reproduce the bundle — that's an extra piece of trust for no gain.

Instead, the canonical URLs live in `src/lib/config.ts`. The `VITE_SUBGRAPH_*` env vars are still honored at build time so local devs can point specific chains at a different graph-node, but the release workflow explicitly refuses to build if any of them leak into the runner. For IPFS pins that need to be repointable without a rebuild (e.g. to fall over to a mirror), use the runtime override:

```html
<script>
  window.__BRAVA_SCREENER__ = {
    subgraphs: {
      arbitrum: 'https://my-own-node.example/subgraphs/name/brava-security-arbitrum',
    },
  };
</script>
```

Inject that block into a wrapper `index.html` served from your own infra; the IPFS-pinned bundle stays byte-identical.

## Ad-hoc IPFS pinning (without a release)

For experiments or staging pins, you do not need to cut a release — build locally and upload the `dist/` or a CAR of it:

```bash
pnpm --filter @brava/security-screener build
pnpm --filter @brava/security-screener exec \
  ipfs-car pack dist --output /tmp/screener.car
w3 up --car /tmp/screener.car
```

Only the tag-driven release flow above produces a reproducible, attested CID. Ad-hoc pins pick up your wall-clock `VITE_BUILD_TIME` and any `VITE_*` overrides from your shell, so their CID is not reproducible by a third party without your exact environment.

Point `security.brava.finance` (a tiny landing page on your own infra) at the current CID and publish verification instructions next to it. The screener itself never needs DNS.

## Updating data for the screener

If you change `apps/security-subgraph/schema.graphql`:

1. Add the new field(s) to `src/types/entities.ts`.
2. Add the same field(s) to the corresponding selection inside `src/lib/queries.ts`.
3. If the new field is a state transition, extend `src/lib/derive.ts`.
4. Render it in the matching section under `src/sections/`.

Keep the addresses in `src/lib/config.ts` in sync with `apps/security-subgraph/networks.json`.
