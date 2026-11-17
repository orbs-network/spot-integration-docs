# Integration Documentation Review

Updated: 17 November 2026.

The Spot guides and examples were compared with a fresh GitHub `orbs-network/spot-ui` master snapshot at `9278795a70a152b5272e67dd469aab8e55d2b534`: `packages/spot-ui`, `packages/spot-react`, their public source exports, READMEs, integration skills, and signing tests. Both package manifests declare version `2.2.6`. The source working tree was clean; SDK dependencies were installed only in the temporary snapshot for validation. This review describes the selected source rather than asserting which APIs are already published.

The two commits since the previous review at `2471c5d45bd61dd5773b4c446397c56c7e0dec1a` change Swap signing slippage and add the Liquidity Hub migration handoff. Advanced Orders exports, provider/hooks, signing contracts, and API-only schemas did not change. The executable examples already pass the reviewed quote to preparation and sign the returned payload unchanged, so they require no code changes.

## Current integration model

- Swap and Advanced Orders share Spot partner configuration and public SDK client methods. The canonical swap guides are `/swap/shared` and `/swap`.
- Quotes use `client.getQuote` or standalone `getQuote` with exactly one of `inAmount` and `outAmount`. An output target resolves server-side to the fixed spend in `quote.request.inAmount`, retaining `quote.requestedOutAmount`. Route comparison and review preserve `minimumAmountOut` unchanged; `dexMinAmountOut` is an input-only local comparison threshold.
- Standalone `getTokenUsd({ tokenAddress, chainId, signal })` returns full-precision USD per token without client initialization or SDK caching. Synchronous `getSwapSlippage({ amountUsd, slippage })` consumes host-computed trade USD value; the host owns pricing fallback and automatic/custom policy.
- Swap wallet orchestration belongs to the host. Confirm wrapping and sufficient allowance, call `client.prepareSwap({ quote, account, signal })`, sign its exact EIP-712 payload inline, and call `client.submitSwap(prepared.order, originalSignature, { signal })`.
- Preparation reuses a quote with a valid receipt age through 20 seconds or refreshes the exact request. A lower minimum requires fresh review; swaps expire three minutes after final preparation. Freeze the final prepared quote in the review before signing.
- Swap preparation converts the reviewed percentage to signed integer basis points in `witness.slippage`, replacing the former fixed 500 bps rule: `0.5` percent becomes `50` bps and `2.345` percent rounds to `235` bps. The quoted minimum remains unchanged in `witness.output.limit`. Direct quote/preparation slippage may be zero; the optional automatic-policy helper still requires a positive baseline.
- Submission returns an accepted order. The host retains the signed intent and accepted/latest order, polls `client.getOrder`, and shows swap success only for `OrderStatus.Completed`. Missing lookup results and uncertain acceptance require reconciliation before another execution or fallback.
- React swaps use SDK exports without a provider. `AdvancedOrdersProvider` supports only `OrderType.TWAP`, `LIMIT`, `STOP_LOSS`, and `TAKE_PROFIT`; `OrderVariant` identifies detailed protocol/history variants.
- The React provider uses six wallet methods, unified `errorFallback`, and explicit `checkOrderStatus` recovery. Advanced-order history uses `client.getOrders()` or provider hooks; cancellation remains a confirmed host-wallet transaction.
- Coding-agent handoffs use the three integration skills: `spot-swap-integration`, `spot-advanced-orders-integration`, and `spot-advanced-orders-react-integration`. Existing Liquidity Hub swap paths also use `liquidity-hub-to-spot-swap-migration` for approval/signing changes, order-based settlement, and retained legacy recovery. Bundles live under `dist/integration-skills/<skill-name>/`; verify `manifest.json.sdkVersion` against the resolved package. Both swap skills ship with the core dependency used by React hosts. Repository manifests omit `sdkVersion`; packaging injects it from the corresponding package version.

## Documentation and downloads

There are seven guides and four generated integration downloads: Swap TypeScript, Advanced Orders TypeScript, Advanced Orders React, and Advanced Orders API Only. Perps remains API-only and has its own Markdown reference, last reviewed on 16 November 2026 against `perpetual-hub` checkout `1aa0d6435`; see `perps-review-findings.md` for its source contracts and read-only endpoint checks. This Spot refresh does not change that independent review.

Downloads merge canonical source examples, resolve included imports, and retain host adapters as external requirements. React examples require the host data, wallet, translation, and currency adapters described in the guide; they are integration references rather than standalone applications.

Guide navigation, raw Markdown routes, search, sitemap, and the AI documentation corpus derive from the same guide registry. Previous swap URLs redirect to the current Spot guides, and the former React provider heading remains a hash alias.

## Verification

Run `yarn lint`, `yarn typecheck`, and `yarn build` after changing these guides. The checks cover internal links and aliases, framework boundaries, generated-source freshness, download bindings, Spot submission recovery, and advanced-order configuration, amount, schedule, and history contracts.

For an SDK sync, also run against the selected source snapshot:

```bash
SPOT_UI_SOURCE=../spot-ui node scripts/check-integration-downloads.mjs
```

This check validates generated examples and inline SDK imports/client members against the SDK's public source exports and types. External host adapters remain the consuming application's responsibility. The default portable check does not establish compatibility with an installed SDK version. Type checks also do not validate prose about thresholds, units, or calculations; the slippage correction was established by comparing implementation and signing tests.

Mocked swap execution verifies receipt-dependent wallet sequencing, allowance rechecking, final review before signing, unchanged prepared order/signature submission, retained acceptance, and recovery after uncertain responses or obsolete wallet scope. These checks do not establish funded wallet execution or partner activation on every chain.

For this refresh, `yarn generate:integrations`, `yarn lint`, `yarn typecheck`, `yarn build`, the selected-source contract check, and `git diff --check` passed. Regeneration leaves all four canonical download modules unchanged. Lint reports four pre-existing warnings in saved `.playwright-cli` artifacts. All 73 upstream `client-manual-signing.test.ts` cases pass, including reviewed percentage conversion, rounding, zero, refreshed quotes, and unchanged submission.

Production-build browser checks verified the corrected Swap signing text, rendered code, optional migration links and navigation, and the integration download, which includes the updated guide comments and an unchanged canonical code body. Swap setup and shared integration options have no horizontal page overflow at a 390-pixel viewport, and the checked pages emitted no console errors. HTTP checks verified `/swap.md`, `/swap/llms.txt` and its alias with selected partner/chain context, `/llms-full.txt`, and updated sitemap metadata. No live wallet signatures or funded transactions were exercised.
