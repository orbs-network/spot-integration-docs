# Spot Integration Docs

Standalone documentation for integrating Orbs products into an existing DEX or swap application.

## Guides

- Liquidity Hub TypeScript SDK: quote comparison, execution, analytics, and fallback behavior.
- Liquidity Hub Direct API: raw quote, signing, submission, polling, and confirmation contracts.
- Advanced Orders API Only: Order Sink HTTP contracts, EIP-712 order construction, history, and cancellation without an Orbs package.
- Advanced Orders TypeScript SDK: framework-neutral form calculation, client initialization, order submission, history, and cancellation with `@orbs-network/spot-ui`.
- Advanced Orders React SDK: `SpotProvider`, focused hooks, execution lifecycle, and order history with `@orbs-network/spot-react`.

## Local Development

```bash
yarn install
yarn dev
```

Open [http://localhost:3004](http://localhost:3004). The root route redirects to the Liquidity Hub guide.

## Validation

```bash
yarn lint
yarn typecheck
yarn build
```

Guide content lives in `content/`. Each level-2 Markdown heading becomes a navigable step with a stable hash link.

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
