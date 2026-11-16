# Swap · TypeScript SDK

Add token swaps with **Orbs Spot**, using the same SDK as [Advanced Orders](/advanced-orders/shared). Your app supplies its form, wallet, receipt handling, and progress UI; the SDK provides quotes, signing payloads, submission, and status lookups.

The flow is: initialize a client, fetch a quote, confirm wrapping and allowance, prepare and sign the order, submit it, then track its fills.

## Install and Initialize

```bash
npm install @orbs-network/spot-ui
```

Create a client for your partner and connected chain, then reuse it:

```ts
import { createClient, Partners } from "@orbs-network/spot-ui";

const client = await createClient(Partners.External, 137);
```

Use your configured partner and chain in place of these sample values. `createClient` loads and validates the protocol configuration, including the approval spender and signing data. If configuration is unavailable, resolve it with [Orbs support](https://t.me/dTWAPSupportGroup).

Your app supplies wallet access, token metadata, balances, and the chain's wrapped-native-token address. React apps can import the same public SDK functions and types through `@orbs-network/spot-react`. Swaps use these client methods without a provider; `AdvancedOrdersProvider` is for TWAP, limit, stop-loss, and take-profit forms.

Inspect the installed package and lockfile before changing dependencies. Read the version-matched `node_modules/@orbs-network/spot-ui/dist/integration-skills/spot-swap-integration/SKILL.md` and its references; its adjacent `manifest.json.sdkVersion` must match the installed package. For a release without that bundle, use the [swap integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-swap-integration) from a matching release or checkout. Import SDK code only from the public package root; documentation under `dist` is safe to read. Keep a compatible installation and use the host's package manager.

## Fetch Quote

Copy the displayed quote example as `fetch-quote.ts` and pass the current swap inputs:

```ts
import { fetchSpotQuote } from "./fetch-quote";

const quote = await fetchSpotQuote(client, {
  inToken,
  outToken,
  inAmount,
  user: account,
  slippage: 0.5,
});
```

`fetchSpotQuote` forwards these inputs to `client.getQuote`. The client supplies its partner and chain; no wallet prompt is needed.

| Input | Meaning |
| --- | --- |
| `inToken`, `outToken` | Token addresses on the selected chain. Use the wrapped token for native input. |
| `inAmount` or `outAmount` | Exactly one positive integer string in the selected token's base units: a fixed input or a requested output target. |
| `user` | Connected account, or a preview account before connection. |
| `slippage` | Percentage from 0 through 50, inclusive: `0.5` means 0.5%. Rounded to integer basis points. |
| `dexMinAmountOut` | Optional local comparison threshold for input quotes, never sent to the API. A positive value requires the returned minimum to meet it; omitted, `"-1"`, or `"0"` adds no threshold. Output-target quotes allow only omitted or `"-1"`. |
| `signal` | Optional abort signal for obsolete quote requests. |

Display `quote.netAmountOut` and use **`quote.minimumAmountOut` unchanged** for review and execution. The returned minimum already includes slippage. Keep the complete quote, including its `request`, for preparation.

For output entry, call `client.getQuote({ inToken, outToken, outAmount, user: account, slippage })` without `inAmount`. Each call makes one server request for the actual pair; do not reverse tokens or search for the input client-side. The server resolves the fixed spend into `quote.request.inAmount` and preserves the original target in `quote.requestedOutAmount`. The protected minimum must cover that target. Capture the resolved input before wallet steps; execution does not increase it.

When another DEX route is available, compare protected minima for the same input and pair under your existing route and gas policy. `isSwapSupported({ tradeType, swapperAddress, recipient })` checks the fixed-input router contract and still rejects a router's `tradeType: "exact-output"`; output-target quoting is a separate path that resolves to fixed input before review. The signer receives the output. This helper does not validate balances or the quote.

Refresh quotes when inputs change and hide an old quote while its replacement loads. Standalone `getQuote({ chainId, partner, ...inputs })` is also available before client initialization. To disable analytics, configure `createClient(partner, chainId, { disableAnalytics: true })` and use `client.getQuote`; quote requests do not accept that option.

### USD Prices and Effective Slippage

Standalone `getTokenUsd({ tokenAddress, chainId, signal })` returns USD per whole token as a full-precision decimal string, without initializing a client. Supply the active chain explicitly and use the wrapped token address for native input. It normalizes the service's raw 18-decimal price independently of token decimals and ignores the rounded display price.

Resolve any required unit price in the host, calculate the total trade value with the host's decimal library, then call synchronous `getSwapSlippage({ amountUsd, slippage })` for automatic policy. The example uses `bignumber.js`; reuse an equivalent existing host library when available:

```ts
import BN from "bignumber.js";
import { getTokenUsd, getSwapSlippage } from "@orbs-network/spot-ui";

// Apply the host's timeout and fallback policy to this optional price read.
const unitPriceUsd = isUserCustomSlippage
  ? undefined
  : await getTokenUsd({ tokenAddress: inToken, chainId, signal }).catch(() => undefined);
signal?.throwIfAborted();
const amountUsd = unitPriceUsd === undefined
  ? undefined
  : new BN(inAmount).shiftedBy(-inputTokenDecimals).times(unitPriceUsd).toFixed();
const slippagePercent = isUserCustomSlippage
  ? dexSlippage
  : getSwapSlippage({ amountUsd, slippage: dexSlippage }).slippagePercent;
const pricedQuote = await client.getQuote({
  inToken, outToken, inAmount, user: account,
  slippage: slippagePercent, signal,
});
```

`amountUsd` is the total USD value as a decimal string or `undefined`, never a unit price or promise. For output entry, calculate it from the typed output amount, output-token decimals, and output-token unit price before requesting the quote. Keep quote amounts in integer base units and avoid conversion through JavaScript `Number`.

The helper always applies automatic policy: positive totals worth at most $100 use at least 1% without lowering a higher DEX baseline; larger totals retain the baseline. Missing, invalid, or nonpositive totals retain that baseline with undefined `amountUsd`. Its required `slippage` must round to at least one basis point and must not exceed 50%; invalid values, including zero, throw `INVALID_ARGUMENT`. Normalize empty or zero automatic settings to the host's positive default first. Custom mode bypasses both the helper and price read and passes the host-validated percentage directly to the quote.

The frozen result contains `slippagePercent`, integer `slippageBps`, and optional normalized `amountUsd`; the helper performs no fetching, caching, timers, or asynchronous work. Quote `inputAmountUsd` remains separate display metadata. Once quoted, display `quote.request.slippage`; freeze `prepared.quote.request.slippage` with the final output and minimum before signing.

Each `getTokenUsd` call makes a fresh request to the default production price service, independently of the client's endpoint or the demo's `devApi` flag. It accepts no `apiUrl`, shares no pending work or price cache, and its signal cancels that request. Direct failures throw `PRICE_LOOKUP_FAILED` or `INVALID_RESPONSE`; caller cancellation propagates. The host owns loading, timeout, fallback, and freshness policy. The demo bounds automatic price reads to 1,500 ms using a per-request controller, while other hosts choose their own limit.

## Submit Swap

Copy the displayed example as `submit-swap.ts`. It uses the host's wallet services, then the public client preparation and submission methods:

```ts
import { executeSpotSwap, type SwapAttempt } from "./submit-swap";

// Store at app scope for this review; keep it when a modal closes.
const attempt: SwapAttempt = {};
const acceptedOrder = await executeSpotSwap({
  client,
  quote,
  account,
  wallet,
  nativeInput,
  attempt,
  signal,
  assertCurrent: assertCapturedReviewIsCurrent,
  onPrepared: freezePreparedQuoteInReview,
});
```

`executeSpotSwap` resolves at acceptance. It retains `attempt.order` before returning; show a pending result and start your existing order-status polling. Show success and refresh balances only after a lookup returns `OrderStatus.Completed`.

### Host Wallet Services

`SwapWallet` in the example is a host-defined interface, not an SDK adapter. Bind it to the captured account and chain using your existing wallet library:

| Method | Contract |
| --- | --- |
| `getAllowance(token, spender)` | Return the raw ERC-20 allowance as an integer string. |
| `wrapNativeToken(amountRaw)` | Return the hash after a successful wrapping receipt. |
| `approveToken(token, spender, amountRaw)` | Approve this example's exact input amount and return the hash after a successful receipt. |
| `signTypedData({ ...typedData, account: signerAddress })` | Sign the unmodified prepared EIP-712 payload and return the original hex signature. |

Check allowance for **`client.spenderAddress`** before prompting. After approval, read it again: a confirmed hash alone does not prove that the wallet granted sufficient allowance. If the wallet reduced its approval cap, stop or retry according to host policy before signing. `ApprovalRequest.amount` is the exact required input; `approvalAmount` is a suggested cap that defaults to maximum uint256. The host may approve the exact amount instead.

The host owns live account/chain checks, balances and gas, receipt waiting, progress, retry policy, and duplicate guards. Call once per captured review under an execution lock. `assertCurrent` must reject obsolete scope before wallet prompts and submission. A failed attempt can leave confirmed wrapping or approval in place; inspect retained state before retrying wallet steps.

### Prepare, Sign, and Submit

After wallet prerequisites finish, `await client.prepareSwap({ quote, account, signal })` returns `prepared.order`, `signingRequest`, `approvalRequest`, final `quote`, and timestamps. A quote with a valid local receipt age from zero through 20 seconds is reused; older, invalid, or future receipt times refresh the resolved fixed input. For output targets this never repeats the target calculation or increases spending. A lower refreshed minimum throws `QUOTE_MINIMUM_DECREASED` and requires fresh review. Swaps expire three minutes after final preparation.

The signed order uses independent 500 bps oracle price protection in `witness.slippage`. The user's quote tolerance is enforced by the unchanged protected minimum in `witness.output.limit`; do not copy the quote percentage into the signed oracle field.

Quotes can remain live through wrapping and approval. Before opening the signature prompt, freeze the displayed amounts and slippage from `prepared.quote`. Submit the unchanged `prepared.order` and original signature through `client.submitSwap(prepared.order, signature, { signal })`. Preparation performs no wallet calls; submission does not wait for a fill.

For an existing DEX router, see the [typed router example](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/examples/router-swap.ts).

### Accepted Order and Settlement

Use your existing cancellable, serial poller to call `client.getOrder({ orderId: acceptedOrder.id, signal })`. This is one lookup, not a polling helper. `undefined` can mean the order is not indexed yet. Keep loading while the order is open and show success only for `OrderStatus.Completed`; handle `Cancelled` and `Expired` as separate terminal outcomes. A local deadline alone does not establish the service's terminal result.

Retain the prepared order, original signature, confirmed hashes, and accepted/latest order outside transient UI. A submission timeout may occur after acceptance; reconcile the original signed intent before another submission or DEX fallback. Aborting a request or stopping tracking cannot undo a confirmed transaction or cancel an accepted order.

## Errors and Recovery

Let SDK and wallet errors reach your existing error UI. The example does not automatically retry submissions.

| Outcome | App behavior |
| --- | --- |
| No quote or quote request failure | Retry through your quote policy or select another route before execution. |
| `QUOTE_MINIMUM_DECREASED` | Show a fresh quote for another review. |
| Wallet rejection or failed preparation | Preserve input and confirmed wallet actions; reassess scope before retrying. |
| Submission timeout or uncertain acceptance | Reconcile the original intent before submitting again or using a DEX fallback. |
| Cancelled or expired order | Show the terminal result and any fills. |
| Missing lookup, transient failure, or stopped tracking | Retain state and resume lookup; stopping tracking does not cancel the order. |

SDK failures expose `SpotError.code`, with optional `status`, `serviceCode`, and `cause`. `QuoteError` exposes `kind`, optional HTTP `status` and service `code`, and `retryable` (network errors, HTTP 429, or HTTP 5xx). Abort errors propagate unchanged. The host owns settlement error and retry policy.

## Operational Checklist

- Use the configured partner, connected chain, and current full-input quote.
- Keep effective slippage consistent between UI, quote, and prepared review.
- Preserve the quoted minimum without applying slippage again.
- Confirm wallet receipts and sufficient allowance before preparation.
- Sign and submit the same prepared order with its original signature.
- Retain recovery state and keep pending UI through settlement.
- Reconcile uncertain submission before another execution.
