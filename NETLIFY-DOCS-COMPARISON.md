# Netlify Documentation Comparison

Reviewed: 17 November 2026.

Site reviewed: <https://ornate-babka-2c796a.netlify.app/>.

Compared the site's full Markdown corpus and selected rendered pages with this repository's integration guides and the reviewed `spot-ui` source at `9278795a70a152b5272e67dd469aab8e55d2b534` (`@orbs-network/spot-ui` and `@orbs-network/spot-react` version `2.2.6`). Relevant Perps behavior was checked against backend implementation and tests.

The principal integration flows largely agree. The findings below identify incorrect guidance, inconsistent examples, and missing implementation details in the Netlify site. One shared documentation gap is identified explicitly. No project or site content was changed during the comparison.

Priority definitions:

- **P1:** Correct before relying on the affected integration instructions.
- **P2:** Correct to prevent broken examples, conflicting behavior, or incomplete handoffs.

## Confirmed errors and inconsistencies

### 1. P1 — Perps exact-price support is only partially documented

Affected pages:

- [Trading: snapping prices and quantities](https://ornate-babka-2c796a.netlify.app/dperps/api/trading#snap-prices-and-quantities-to-the-lane-filters)
- [Connection: numerical encoding](https://ornate-babka-2c796a.netlify.app/dperps/api/connection#numerical-encoding)
- [Signing: mapping REST payloads to signatures](https://ornate-babka-2c796a.netlify.app/dperps/api/signing#mapping-rest-payloads-to-signatures)

The trading guide applies `tickSize × 1e6` without restricting it to legacy-compatible prices. A tick of `0.00000001` becomes `0.01`, which cannot be used by the documented integer snapping algorithm. The connection guide still instructs readers to convert returned `1e18` prices down to `1e6`, and the signing explanation covers only the legacy conversion. This conflicts with the site's own exact-decimal request fields.

**Correction:** Distinguish legacy `price`/`stopPrice` integers at `1e6` from exact `priceDecimal`/`stopPriceDecimal` strings. Snap exact prices at `1e18`, sign those exact values at `1e18`, and use the `1e6` recipe only when the value and tick are exactly representable. Apply the same distinction to bracket legs and replacement requests.

Reference: [Numerical encoding and exact prices](content/perps-api.md#numerical-encoding), [Precision and snapping](content/perps-api.md#precision). Backend exact-price tests confirm support for values such as `0.00000951` and `1e-18`.

### 2. P1 — Swap signing slippage still describes the previous SDK behavior

Affected pages:

- [Swap quickstart](https://ornate-babka-2c796a.netlify.app/quickstart/swap)
- [Swap Aggregator overview](https://ornate-babka-2c796a.netlify.app/dspot/swap-aggregator)
- [Swap TypeScript SDK: quote freshness](https://ornate-babka-2c796a.netlify.app/dspot/swap-aggregator/typescript-sdk#how-quote-freshness-works)

These pages describe fixed or independent **500 bps** signed oracle protection. SDK `2.2.6` instead converts the reviewed quote percentage into signed `witness.slippage`.

**Correction:** Explain that `0.5` percent becomes `50` bps and `2.345` percent rounds to `235` bps. The quoted `minimumAmountOut` remains unchanged in `witness.output.limit`. Integrators must sign the prepared payload unchanged and must not substitute a fixed tolerance or apply slippage to the minimum again.

Reference: [Prepare, sign, and submit](content/swap.md#prepare-sign-and-submit). Confirmed against `client.ts`, `getSlippageBps`, and upstream manual-signing tests.

### 3. P2 — The gas guide has an obsolete React adapter and an incorrect approval default

Affected page: [Gas: what is free](https://ornate-babka-2c796a.netlify.app/concepts/gas).

The wallet example describes five methods and includes `getAllowance`. The current React `WalletInteractions` contract requires six methods:

- `shouldWrap`
- `shouldApprove`
- `wrapNativeToken`
- `approveToken`
- `signOrder`
- `cancelOrder`

The same page implies that exact approval is the SDK default. The SDK's suggested `approvalAmount` defaults to maximum uint256; the required `amount` is the exact input. Exact approval is a host policy. The site's quickstart forwards `approvalAmount`, so its behavior does not match the gas page's explanation.

**Correction:** Replace the adapter example with the current six-method contract. Separate the required allowance from the suggested approval cap, and explain how the host chooses exact or standing approval. Transaction methods must wait for successful receipts.

Reference: [Implement wallet interactions](content/advanced-orders-react.md#implement-wallet-interactions), [Prepare and submit an order](content/advanced-orders-sdk.md#prepare-and-submit-an-order).

### 4. P2 — The limit-order quickstart calls a Hook at module scope

Affected page: [Limit-order quickstart: progress and open orders](https://ornate-babka-2c796a.netlify.app/quickstart/limit-order#show-progress-and-open-orders).

The `OpenOrders.tsx` snippet places this outside a component:

```tsx
const { data: orders } = useOrders();
const openOrders = orders?.open ?? [];
```

Copying the snippet as a module causes an invalid Hook call.

**Correction:** Put the history Hook and list rendering inside a component mounted beneath `AdvancedOrdersProvider`. Give `CancelButton` an explicit order prop type in a complete TypeScript example.

Reference: [Order history and cancellation](content/advanced-orders-react.md#order-history-and-cancellation).

### 5. P2 — The Perps signing retry warning omits the same-request-ID exception

Affected pages:

- [Signing and session keys](https://ornate-babka-2c796a.netlify.app/dperps/api/signing)
- [Reliability: request IDs and retries](https://ornate-babka-2c796a.netlify.app/dperps/api/reliability#request-ids-and-retries)

The signing warning suggests that a new timestamp/signature can create a second order, without qualifying the `requestId`. The reliability page correctly permits re-signing the same order intent under the same ID.

**Correction:** State that same-ID order replay protection compares the economic intent and tolerates refreshed timestamps/signatures. A new request ID can create a new intent. Keep cancellation and withdrawal retry rules separate rather than generalizing order replay behavior to them.

Reference: [Request IDs and retries](content/perps-api.md#request-ids-and-retries). Confirmed against the backend order replay implementation.

### 6. P2 — TWAP SDK policy is mixed with raw protocol timing

Affected pages:

- [TWAP: chunks, intervals, and limits](https://ornate-babka-2c796a.netlify.app/dspot/twap#chunks-intervals-and-limits)
- [Recurring buys: interval controls](https://ornate-babka-2c796a.netlify.app/dspot/guides/twap-recurring#add-the-interval)

The TWAP page states a 60-second interval minimum, then teaches a React SDK integration. The recurring-buy guide leaves the actual limits as a `CONFIRM` placeholder.

**Correction:** Label the SDK form policies explicitly:

- Minimum interval: **five minutes**.
- Maximum order duration: **60 days**.
- Maximum trade count derives from the total input USD value and the host's positive per-trade `minTradeSizeUsd`.
- Duration must cover the scheduled fills, including `(trades − 1) × interval`, and satisfy the SDK minimum duration.

Do not globally replace raw API/protocol timing with SDK form policy. The API-only reference intentionally demonstrates a one-minute epoch.

Evidence: `spot-ui` order-form constants and schedule validation at the reviewed commit.

**Shared gap:** This repository's SDK guides surface schedule validation but would also benefit from an explicit table of these numerical limits.

### 7. P1 — Copied AI prompts point to pages unavailable on the current canonical domain

Affected pages: [Prompt library](https://ornate-babka-2c796a.netlify.app/ai/prompts) and the [homepage](https://ornate-babka-2c796a.netlify.app/).

Copied prompts direct agents to `https://docs.orbs.network/quickstart/limit-order.md`. During review, a real browser redirected that URL to `/v3/quickstart/limit-order.md` and displayed “Page Not Found.” The equivalent Netlify Markdown page works. Markdown directives also hardcode the future canonical domain.

**Correction:** Build preview prompts and reference URLs from the working preview origin until the production domain cutover is complete. Before claiming redirects are live, verify the actual destination pages, not just the redirect response.

This is a current preview/cutover issue; repeat the check after deployment or domain changes.

Reference: [Source-aware instruction URL generation](features/integration-agent/integration-agent.ts), [Documentation endpoints and sharing](README.md#documentation-endpoints).

## Missing or unfinished information

### Product-specific AI documents are claimed but absent

[llms.txt and Markdown](https://ornate-babka-2c796a.netlify.app/ai/llms-txt) says each tab has its own `llms.txt`. These preview endpoints returned **404**:

- `/dspot/llms.txt`
- `/dperps/llms.txt`
- `/api/llms.txt`

Root `/llms.txt` and `/llms-full.txt` returned **200**. Provide and link the scoped documents, or remove the availability claim. The page's `CONFIRM` marker about the full corpus is also stale because that file already works on the preview.

Reference: [Existing scoped handoffs](README.md#documentation-endpoints).

### Output-target swap execution is underexplained

The [Swap SDK guide](https://ornate-babka-2c796a.netlify.app/dspot/swap-aggregator/typescript-sdk#fetch-a-quote) mentions `outAmount` but omits the execution details already present in this repository:

- The server resolves the fixed spend into `quote.request.inAmount`.
- The original target remains in `quote.requestedOutAmount`.
- Capture the resolved input before wrapping, approval, and preparation.
- Output-target quotes and the router's unsupported `tradeType: "exact-output"` are different contracts.
- Output-target quotes allow only omitted or `"-1"` for `dexMinAmountOut`.

Reference: [Fetch quote](content/swap.md#fetch-quote).

### The legacy Swap HTTP flow is not a complete integration contract

The [API-only Swap guide](https://ornate-babka-2c796a.netlify.app/dspot/swap-aggregator/api) correctly labels its `hub.orbs.network`/Permit2 flow as legacy. However, it still leaves new-integration support, the exact `/swap-async` JSON body, and status-response fields unconfirmed.

Keep it clearly labeled as a legacy reference until those contracts and support status are verified. It should not be presented as a complete alternative to the current Spot SDK flow.

### Public editorial placeholders remain widespread

The downloaded full corpus contained **124 `[CONFIRM]` markers**. They include chain coverage, fee/revenue-share terms, support contacts, API contracts, security details, launch status, and AI-tool availability.

Resolve each item with an authoritative source or replace it with a clear statement of what is currently available and how to obtain missing partner-specific information. Unconfirmed commercial terms should not be invented. Remove obsolete markers where behavior is already demonstrable, such as the working root `/llms-full.txt` endpoint.

## Verification scope

- Read the site's full Markdown corpus and relevant page-specific Markdown.
- Checked key discrepancies in rendered HTML, including Swap slippage, Perps precision/retry guidance, and the canonical-domain destination used by copied AI prompts.
- Used SDK implementation, public contracts, and focused tests to resolve SDK behavior; used backend implementation/tests for the Perps findings.
- Verified the scoped AI endpoint responses with read-only HTTP requests.
- Verified that SDK version `2.2.6`, the advertised hosted agent skill, and the order MCP descriptor were real; these were not reported as errors.
- Did not execute every copied code example or exercise live wallets, signatures, deposits, withdrawals, or trades.

Suggested correction order: Perps precision and Swap slippage; React adapter/Hook examples; AI destinations; then the remaining inconsistencies and incomplete reference material.
