# Integration Documentation Review

Updated: 16 November 2026.

The Spot guides and examples were compared with the local `../spot-ui` checkout at `2471c5d`: `packages/spot-ui`, `packages/spot-react`, their public source exports, READMEs, integration skills, and signing tests. Both package manifests declare version `2.2.4`. This review describes that local source rather than asserting which APIs are already published.

## Current integration model

- Swap and Advanced Orders share Spot partner configuration and public SDK client methods. The canonical swap guides are `/swap/shared` and `/swap`.
- Quotes use `client.getQuote` or standalone `getQuote` with exactly one of `inAmount` and `outAmount`. An output target resolves server-side to the fixed spend in `quote.request.inAmount`, retaining `quote.requestedOutAmount`. Route comparison and review preserve `minimumAmountOut` unchanged; `dexMinAmountOut` is an input-only local comparison threshold.
- Standalone `getTokenUsd({ tokenAddress, chainId, signal })` returns full-precision USD per token without client initialization or SDK caching. Synchronous `getSwapSlippage({ amountUsd, slippage })` consumes host-computed trade USD value; the host owns pricing fallback and automatic/custom policy.
- Swap wallet orchestration belongs to the host. Confirm wrapping and sufficient allowance, call `client.prepareSwap({ quote, account, signal })`, sign its exact EIP-712 payload inline, and call `client.submitSwap(prepared.order, originalSignature, { signal })`.
- Preparation reuses a quote with a valid receipt age through 20 seconds or refreshes the exact request. A lower minimum requires fresh review; swaps expire three minutes after final preparation. Freeze the final prepared quote in the review before signing.
- Submission returns an accepted order. The host retains the signed intent and accepted/latest order, polls `client.getOrder`, and shows swap success only for `OrderStatus.Completed`. Missing lookup results and uncertain acceptance require reconciliation before another execution or fallback.
- React swaps use SDK exports without a provider. `AdvancedOrdersProvider` supports only `OrderType.TWAP`, `LIMIT`, `STOP_LOSS`, and `TAKE_PROFIT`; `OrderVariant` identifies detailed protocol/history variants.
- The React provider uses six wallet methods, unified `errorFallback`, and explicit `checkOrderStatus` recovery. Advanced-order history uses `client.getOrders()` or provider hooks; cancellation remains a confirmed host-wallet transaction.
- Coding-agent handoffs and navigation use the three current skills: `spot-swap-integration`, `spot-advanced-orders-integration`, and `spot-advanced-orders-react-integration`. Bundles live under `dist/integration-skills/<skill-name>/`; verify `manifest.json.sdkVersion` against the resolved package. React swaps use the skill bundled with their core dependency.

## Documentation and downloads

There are seven guides and four generated integration downloads: Swap TypeScript, Advanced Orders TypeScript, Advanced Orders React, and Advanced Orders API Only. Perps remains API-only and has its own Markdown reference, also synchronized in this review against `perpetual-hub` checkout `1aa0d6435`; see `perps-review-findings.md` for its source contracts and read-only endpoint checks.

Downloads merge canonical source examples, resolve included imports, and retain host adapters as external requirements. React examples require the host data, wallet, translation, and currency adapters described in the guide; they are integration references rather than standalone applications.

Guide navigation, raw Markdown routes, search, sitemap, and the AI documentation corpus derive from the same guide registry. Previous swap URLs redirect to the current Spot guides, and the former React provider heading remains a hash alias.

## Verification

Run `yarn lint`, `yarn typecheck`, and `yarn build` after changing these guides. The checks cover internal links and aliases, framework boundaries, generated-source freshness, download bindings, Spot submission recovery, and advanced-order configuration, amount, schedule, and history contracts.

With the local SDK checkout available, also run:

```bash
SPOT_UI_SOURCE=../spot-ui node scripts/check-integration-downloads.mjs
```

This optional check validates generated examples and inline SDK imports/client members against the SDK's public source exports and types. External host adapters remain the consuming application's responsibility. The default portable check does not establish compatibility with an installed SDK version.

Mocked swap execution verifies receipt-dependent wallet sequencing, allowance rechecking, final review before signing, unchanged prepared order/signature submission, retained acceptance, and recovery after uncertain responses or obsolete wallet scope. These checks do not establish funded wallet execution or partner activation on every chain.

For this refresh, `yarn lint`, `yarn typecheck`, `yarn build`, and the optional local SDK source check passed. Lint reports four pre-existing warnings in saved `.playwright-cli` artifacts. Browser smoke checks verified the three current skill links, Swap quote/pricing content, and Perps trading/diagnostic content; Perps had no console errors or horizontal page overflow at a 390-pixel viewport. No live wallet signatures or funded transactions were exercised.
