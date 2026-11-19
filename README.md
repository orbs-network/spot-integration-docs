# Orbs Integration Docs

Standalone documentation for integrating Orbs products into an existing DEX or swap application.

## Products

- **Swap (Orbs Spot)** exchanges tokens on the same chain using a Spot quote and a signed order. Compare its protected minimum output with an existing DEX route, submit the selected order, and track it until filled. See the [Swap product overview](content/swap-shared.md#product-overview).
- **Advanced Orders (Orbs Spot)** lets users schedule trades over time with TWAP or set price conditions with limit, stop-loss, and take-profit orders. Users submit a signed order, track its fills, and can cancel future execution. See the [Advanced Orders product overview](content/advanced-orders-shared.md#product-overview).
- **Perps (Perpetual Hub)** provides a partner API for server-side account signing, collateral, perpetual orders, account history, and live updates. See the [Perps API integration guide](content/perps-api.md).

The SDK and API guides below cover integration methods for these products.

## Guides

- Spot Swap TypeScript SDK: quotes, route comparison, configured approvals, prepared-order signing, submission, and settlement tracking with `@orbs-network/spot-ui`. React apps use the same client methods through `@orbs-network/spot-react`, without a swap provider. The host owns wallet steps, receipts, and status polling.
- Advanced Orders API Only: Order Sink HTTP contracts, EIP-712 order construction, history, and cancellation without an Orbs package.
- Advanced Orders TypeScript SDK: framework-neutral form calculation, client initialization, order submission, history, and cancellation with `@orbs-network/spot-ui`.
- Advanced Orders React SDK: `AdvancedOrdersProvider`, `OrderType`, focused hooks, execution lifecycle, and order history with `@orbs-network/spot-react`.
- Perps Direct API: connection, EIP-712 signing and sessions, deposits and withdrawals, trading, account history, streaming, and reliability at `/perps/api`.

The Spot handoffs follow GitHub `spot-ui` master at `9278795a70a152b5272e67dd469aab8e55d2b534` (both SDK manifests `2.2.6`, reviewed 17 November 2026). This identifies the reviewed source, not which APIs are already published to npm. Use the skill bundled with the installed SDK version and verify `manifest.json.sdkVersion` before adapting examples:

| Integration | Bundled skill |
| --- | --- |
| Swap, including React hosts | `@orbs-network/spot-ui/dist/integration-skills/spot-swap-integration/SKILL.md` |
| Existing Liquidity Hub swap migration | `@orbs-network/spot-ui/dist/integration-skills/liquidity-hub-to-spot-swap-migration/SKILL.md` |
| Advanced Orders TypeScript | `@orbs-network/spot-ui/dist/integration-skills/spot-advanced-orders-integration/SKILL.md` |
| Advanced Orders React | `@orbs-network/spot-react/dist/integration-skills/spot-advanced-orders-react-integration/SKILL.md` |

Paths are relative to the resolved package under `node_modules`; React's swap skill ships with its `spot-ui` dependency. Older releases without the bundle need the named repository skill from a matching release or checkout. API-only guides do not require an SDK skill.

The Perps API has no SDK. Its integration skill lives in this repository at [`skills/perps-api-integration/SKILL.md`](skills/perps-api-integration/SKILL.md), with a condensed reference of the guide in `references/api-reference.md`. When `content/perps-api.md` changes, update that reference in the same change.

## Local Development

```bash
yarn install
yarn dev
```

Open [http://localhost:3001](http://localhost:3001). The root route shows the product and integration-method chooser. Start with Overview & Setup, then follow one SDK or API guide.

## Production deployment

With the Vercel CLI installed, sign in and deploy:

```bash
vercel login
yarn deploy
```

`yarn deploy` deploys the current working tree directly to production for Vercel project `prj_uMBZSztD2z9Oaoi0n4gMmznXj2cl`. It waits for the deployment to finish and logs out of Vercel afterward, including when deployment fails.

## Validation

```bash
yarn lint
yarn typecheck
yarn build
# Optional: validate downloads and inline SDK references against the local source.
SPOT_UI_SOURCE=../spot-ui node scripts/check-integration-downloads.mjs
```

`yarn generate:integrations` regenerates the `.ts`/`.tsx` downloads after editing guide examples. The build runs it automatically; lint rejects stale generated sources and runs download binding and execution-behavior checks. Downloads merge the canonical code into one module; host adapters and package dependencies still come from the integrating application.

Guide content lives in `content/`. Each level-2 Markdown heading becomes a navigable step with a stable hash link.

`content/perps-api.md` follows `orbs-network/perpetual-hub/docs/partner-integration/`, reviewed on 16 November 2026 against checkout `1aa0d6435` (handoff last changed at `f7a6ff4ce` on 7 November). Conflicting source prose was reconciled against the backend contracts for order-price precision, idempotent order retries, and REST/WebSocket fill identity. The default examples retain Global's production Arbitrum configuration (`global:42161`), replacing the source handoff's Orbs staging values. The Global config, market, and risk endpoints were checked read-only on 16 November; this does not establish funded-flow acceptance. Source headings are nested under eight guide steps and local cross-links point to those steps. Perps uses its own lane configuration; Spot partner-query personalization does not apply. Use `/perps/api.md` for the complete Markdown reference; there is no generated TypeScript integration download for this API-only handoff. See `perps-review-findings.md` for scope and verification details.

## Documentation endpoints

- `/llms.txt` is a compact index with one title, a quoted summary, and two link lists for integration instructions and documentation. The Swap instructions appear once at their canonical `/swap/llms.txt` URL.
- `/llms-full.txt` contains all canonical guides once, with nested headings and absolute links. Load this file when the full documentation corpus is needed.
- Each implementation path has a self-contained agent instructions document at `<guide>/llms.txt` (with `<guide>/llm.txt` as an alias). It includes the integration task, setup and implementation requirements, complete relevant guides, and their code examples. Share this URL with a coding agent to start that integration:
  - Swap: `/swap/llms.txt`
  - Advanced Orders React SDK: `/advanced-orders/react/llms.txt`
  - Advanced Orders TypeScript SDK: `/advanced-orders/typescript/llms.txt`
  - Advanced Orders API Only: `/advanced-orders/direct/llms.txt`
  - Perps Direct API: `/perps/api/llms.txt`
  - Advanced Orders method selection: `/advanced-orders/shared/llms.txt` includes shared product setup and links to the three implementation paths. Follow one path instead of downloading all three.
  - `/swap/shared/llms.txt` remains available for the Swap overview page; `/swap/llms.txt` is the indexed Swap handoff.
- Append `.md` to a guide URL to open its raw Markdown source, for example `/swap.md`.
- `/sitemap.xml` and `/robots.txt` are generated from the guide configuration.

To share partner-specific examples across the guides, append `partner` and
`chainId` to the guide URL, for example
`/advanced-orders/direct?partner=quickswap&chainId=137`. The page fetches that
partner's public Orders Sink configuration, validates it, and inserts its
protocol addresses into the API-only examples that need them. The resolved
partner and both signed chain IDs must match the URL before the page uses that
response. Partner context is managed with `nuqs`, stays in the URL as readers
move between guides and steps, and is forwarded to every interactive example.
Wallet and token addresses remain illustrative. If configuration is missing,
invalid, or unavailable, the page removes the managed `partner` and `chainId`
parameters and safely restores the sample examples. Canonical links put the
query before the step fragment
(`?partner=quickswap&chainId=137#fetch-partner-config`); links using the common
`#fetch-partner-config?partner=quickswap&chainId=137` ordering are normalized
automatically. Interactive-example links retain their existing `devMode` and
tab parameters while adding the validated partner and chain.

Every guide includes **Integrate with AI**. Choose Codex (desktop) or Claude (browser) to open a new composer with an integration-specific task prompt. Preview or copy the same prompt for other coding agents. Prompts link to the complete Markdown guides, include selected Spot partner/chain context, and keep API-only and Perps requirements separate. `yarn check:agents` validates guide coverage, context, and launch-link encoding.

Choose **Copy instructions link** in that menu to share the complete `llms.txt` document with any coding agent. Local pages use the current loopback origin and port for copied links, task prompts, and links inside the instructions documents, so an agent on the same machine can read unpublished changes. Public pages use the configured canonical site URL. Links preserve only the selected Spot `partner` and optional `chainId`, for example `/advanced-orders/direct/llms.txt?partner=quickswap&chainId=137`. The agent must still fetch and validate that partner's trusted protocol configuration before using it. Perps documents use their own lane configuration.

Set `NEXT_PUBLIC_SITE_URL` to the canonical production origin when it differs from the Vercel production URL.
