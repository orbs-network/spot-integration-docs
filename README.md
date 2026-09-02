# Spot Integration Docs

Standalone documentation for integrating Orbs products into an existing DEX or swap application.

## Guides

- Liquidity Hub: quote comparison, execution, analytics, and fallback behavior.
- Advanced Orders Direct API: Order Sink HTTP contracts, EIP-712 order construction, history, and cancellation.
- Advanced Orders React SDK: host prerequisites, `SpotProvider`, `useSpot()`, lifecycle, and order history.

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
