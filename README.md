# Orbs Integration Docs

Standalone documentation for integrating Orbs products into an existing DEX or swap application.

## Products

- **Swap (Orbs Liquidity Hub)** exchanges tokens on the same chain using a current quote. It sources liquidity from on-chain and off-chain providers and can be compared with an existing DEX route to select the higher protected minimum output. See the [Swap product overview](content/liquidity-hub-shared.md#product-overview).
- **Advanced Orders (Orbs Spot)** lets users schedule trades over time with TWAP or set price conditions with limit, stop-loss, and take-profit orders. Users submit a signed order, track its fills, and can cancel future execution. See the [Advanced Orders product overview](content/advanced-orders-shared.md#product-overview).
- **Perps (Perpetual Hub)** provides a partner API for server-side account signing, collateral, perpetual orders, account history, and live updates. See the [Perps API integration guide](content/perps-api.md).

The SDK and API guides below cover integration methods for these products.

## Guides

- Liquidity Hub TypeScript SDK: quote comparison, execution, analytics, and fallback behavior.
- Liquidity Hub Direct API: raw quote, signing, submission, polling, and confirmation contracts.
- Advanced Orders API Only: Order Sink HTTP contracts, EIP-712 order construction, history, and cancellation without an Orbs package.
- Advanced Orders TypeScript SDK: framework-neutral form calculation, client initialization, order submission, history, and cancellation with `@orbs-network/spot-ui`.
- Advanced Orders React SDK: `SpotProvider`, focused hooks, execution lifecycle, and order history with `@orbs-network/spot-react`.
- Perps Direct API: connection, EIP-712 signing and sessions, deposits and withdrawals, trading, account history, streaming, and reliability at `/perps/api`.

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
```

`yarn generate:integrations` regenerates the `.ts`/`.tsx` downloads after editing guide examples. The build runs it automatically; lint rejects stale generated sources and runs download binding and execution-behavior checks. Downloads merge the canonical code into one module; host adapters and package dependencies still come from the integrating application.

Guide content lives in `content/`. Each level-2 Markdown heading becomes a navigable step with a stable hash link.

`content/perps-api.md` imports the partner handoff from `orbs-network/perpetual-hub` under `docs/partner-integration/` (copied on 25 October 2026). The default examples use Global's production Arbitrum configuration (`global:42161`) from the shared partner registry, replacing the source handoff's Orbs staging values. The Global config, market, and risk endpoints were checked read-only on 25 October; this does not establish funded-flow acceptance. Source headings are nested under eight guide steps and local cross-links point to those steps. Perps uses its own lane configuration; Spot partner-query personalization does not apply. Use `/perps/api.md` for the complete Markdown reference; there is no generated TypeScript integration download for this API-only handoff.

## Documentation endpoints

- `/llms.txt` returns the complete documentation corpus as Markdown for AI tools.
- Append `.md` to a guide URL to open its raw Markdown source, for example `/liquidity-hub.md`.
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

Set `NEXT_PUBLIC_SITE_URL` to the canonical production origin when it differs from the Vercel production URL.
