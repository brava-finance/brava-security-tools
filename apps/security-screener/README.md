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
| Verify yourself   | Build commit, bundle sha256, IPFS CID, anchor addresses per chain, reproducible-build instructions.                                          |

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

`hash` walks `dist/`, prints a SHA-256 per file plus an aggregate hash, and writes `dist/dist-hashes.txt`. The Verify-yourself section displays `VITE_BUILD_COMMIT`, `VITE_BUILD_TIME`, `VITE_BUNDLE_HASH` and `VITE_IPFS_CID`, all baked in at build time. The release pipeline should:

1. Run `pnpm --filter @brava/security-screener build`.
2. Compute `aggregate = sha256(sorted sha256 per file)` and export it as `VITE_BUNDLE_HASH`.
3. Publish `dist/` to IPFS and export the CID as `VITE_IPFS_CID`.
4. Rebuild with those env vars in place so the embedded values match what users see after the pin.
5. Push the build commit to a signed release tag and publish `dist-hashes.txt` alongside it.

## Deploying to IPFS

```bash
pnpm --filter @brava/security-screener build
npx ipfs-deploy apps/security-screener/dist
# or: w3 up apps/security-screener/dist
```

Point `security.brava.finance` (a tiny landing page on your own infra) at the current CID and publish verification instructions next to it. The screener itself never needs DNS.

## Updating data for the screener

If you change `apps/security-subgraph/schema.graphql`:

1. Add the new field(s) to `src/types/entities.ts`.
2. Add the same field(s) to the corresponding selection inside `src/lib/queries.ts`.
3. If the new field is a state transition, extend `src/lib/derive.ts`.
4. Render it in the matching section under `src/sections/`.

Keep the addresses in `src/lib/config.ts` in sync with `apps/security-subgraph/networks.json`.
