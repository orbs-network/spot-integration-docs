# Swap · TypeScript SDK

[Shared Reference](/liquidity-hub/shared) — concepts, lifecycle, input tokens, chains, fees, partner configuration, and resources for every Swap integration.

This guide is for teams that want to add Orbs Liquidity Hub to an existing DEX, swap application, or trading service without adopting a specific UI framework.

Start with the shared [Integration Lifecycle](/liquidity-hub/shared#how-it-works); this guide implements it with the SDK.

The `@orbs-network/liquidity-hub-sdk` package is framework-neutral TypeScript and has no React dependency. The client, quote, route-selection, and full execution examples below work in any JavaScript or TypeScript application. React and Wagmi adapters are optional host concerns.

See [Choose an Integration](/liquidity-hub/shared#integration-options) for the SDK and Direct API comparison.

## Install and Initialize

Install the SDK and Viem:

```bash
npm install @orbs-network/liquidity-hub-sdk@latest viem
```

Create one Liquidity Hub client for the active chain and reuse it for quote and swap operations. Create a new client when the active chain changes; do not create a new client for every quote.

```js
import { createClient } from "@orbs-network/liquidity-hub-sdk";

// Replace "unknown" only with the partner name supplied by Orbs.
const partner = "unknown";

function createLiquidityHubClient(chainId) {
  return createClient({
    chainId,
    partner,
  });
}
```

`createClient()` returns a `LiquidityHubClient` synchronously. It rejects an invalid chain ID or empty partner, normalizes the partner to lowercase, and keeps one session scope for that client.

Use the `partner` name supplied by Orbs. If Orbs has not supplied one, use the lowercase string `"unknown"`.

The public client surface is intentionally small:

| Member | Purpose |
| --- | --- |
| `chainId` | Read-only chain bound to this client. |
| `partner` | Read-only normalized partner identifier. |
| `getQuote(args)` | Request and validate a wallet-bound quote. |
| `swap(quote, signature, dexRouterData?)` | Submit a fresh signed quote and resolve with its transaction hash. |

The SDK selects the standard chain endpoint when `apiUrl` is omitted. For a same-origin development proxy, pass a relative base path such as `apiUrl: "/api/liquidity-hub"`; it applies to quote, submission, and status requests. Keep any proxy development-only, use fixed upstream hosts, and allow only Liquidity Hub routes.

The Submit Swap reference initializes Viem `publicClient` and `walletClient` instances in the same file. They handle token reads, wallet transactions, EIP-712 signing, and receipt confirmation without requiring React or Wagmi.

For React, the source repository provides a two-file TanStack Query reference: [`liquidity-hub.ts`](https://github.com/orbs-network/spot-ui/blob/master/packages/liquidity-hub-ui/examples/react/liquidity-hub.ts) contains the framework-neutral client and execution flow, while [`liquidity-hub-react.tsx`](https://github.com/orbs-network/spot-ui/blob/master/packages/liquidity-hub-ui/examples/react/liquidity-hub-react.tsx) contains the provider, quote query, and swap mutation. Reuse an existing `QueryClientProvider` instead of adding a second provider. The [`best-trade-form.tsx`](https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx) production example shows how an application can compose its execution hook with `SwapFlow` for review, progress, failure, and success states.

See [Supported Chains](/liquidity-hub/shared#supported-chains) for the shared network list and requirements.

## Fetch Quote

Request quotes from the active-chain client with `liquidityHubClient.getQuote(quoteArgs)`, reusing the same client instance throughout the flow. Pass the host DEX route's current protected minimum into `fetchLiquidityHubQuote(account, dexMinAmountOut)`. The interactive Request tab shows the SDK call; the Direct API guide shows the equivalent HTTP request.

The input token cannot be native currency. `fromToken` must be an ERC-20 address. If the user selected the chain's native currency, request the quote with the wrapped token address and wrap the required funds before submission.

The SDK sends the `partner` configured on `createClient()`. Use the exact partner identifier supplied by Orbs; if Orbs has not supplied one, configure the lowercase string `"unknown"`. Do not invent or derive a partner value from the application name or hostname.

```ts
import type { LiquidityHubClient, Quote, QuoteArgs } from "@orbs-network/liquidity-hub-sdk";

export async function fetchLiquidityHubQuote(
  liquidityHub: LiquidityHubClient,
  quoteArgs: QuoteArgs,
): Promise<Quote> {
  return liquidityHub.getQuote(quoteArgs);
}
```

Quote request fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `fromToken` | Yes | ERC-20 source token address. Use the wrapped token address when the user selected a native asset. |
| `toToken` | Yes | Destination token address. |
| `inAmount` | Yes | Source amount as an integer base-unit string. |
| `dexMinAmountOut` | No, recommended | Current DEX route's slippage-adjusted executable minimum output, in destination-token base units. The SDK sends `"-1"` when this field is omitted or empty. You may pass `"-1"` explicitly when no DEX quote exists or both requests must start together. |
| `account` | Required for execution | User address that will sign and own the swap. |
| `slippage` | Yes | Percentage tolerance, such as `0.5` for 0.5%. |
| `signal` | No | `AbortSignal` used to cancel an obsolete quote request. |
| `timeout` | No | Quote timeout override in milliseconds. The SDK default is 10 seconds. |
| `inAmountUsd` | No | USD value of the source amount, used for diagnostics. |
| `disabled` | Deprecated | Prevent the request in host code instead of calling `getQuote()` with a disabled flag. |

The SDK supplies `partner`, encoded page metadata (`qs`), and session reuse internally from the active client. Direct API integrations must send those transport fields themselves.

Important quote response fields:

| Field | Purpose |
| --- | --- |
| `inToken` | ERC-20 source token used by the executable quote. |
| `outToken` | Destination token used by the quote. |
| `inAmount` | Source amount in base units. |
| `outAmount` | Quoted output before the final executable-minimum comparison. Use it for display only when appropriate. |
| `minAmountOut` | Liquidity Hub executable minimum output. Use this field for route selection. |
| `user` | Wallet address that requested, owns, and signs this quote. |
| `slippage` | Percentage tolerance applied when the quote was created. |
| `qs` | Opaque quote metadata. Preserve it unchanged. |
| `partner` | Orbs-provided partner identifier used for attribution. |
| `exchange` | Liquidity Hub execution source selected for this quote. Preserve it unchanged. |
| `sessionId` | Identifier used for swap submission and status polling. |
| `serializedOrder` | Opaque solver order. Preserve and submit it unchanged as part of the quote. |
| `eip712` | Wallet-ready EIP-712 payload. Pass it unchanged to the wallet's typed-data signer. |
| `permitData` | Legacy Permit2 representation retained in the response for compatibility. Preserve it with the quote, but use `eip712` for new signing integrations. |
| `userMinOutAmountWithGas` | User-protected minimum output after gas effects are included. |
| `outAmountWsMinusGas` | Slippage-adjusted output after subtracting the estimated gas value. |
| `outAmountWS` | Quoted output after applying slippage protection. |
| `gasAmountOut` | Estimated gas cost expressed in destination-token base units. |
| `referencePrice` | Reference market price recorded for diagnostics. |
| `amountOutUI` | Service comparison value retained for diagnostics. Do not use it for route selection. |
| `inTokenUsd` | Source-token USD reference price returned as service metadata. |
| `outTokenUsd` | Destination-token USD reference price returned as service metadata. |
| `timestamp` | Local quote time in milliseconds, used by `isFreshQuote`. |
| `error` | Optional service error field in the raw quote shape. `getQuote()` converts a service `error` into a rejected promise, so only fulfilled, error-free quotes are executable. |

Important `eip712` fields:

| Field | Purpose |
| --- | --- |
| `domain` | EIP-712 signing domain returned for this quote. |
| `types` | Complete EIP-712 type definitions. |
| `primaryType` | Root type signed by the wallet. |
| `message` | Complete message signed by the wallet. |

### Compare with a DEX Router (Optional)

Use this step only when Liquidity Hub runs alongside an existing DEX router. Liquidity-Hub-only integrations can continue directly to **Submit Swap**.

If the current DEX minimum output is already available, pass it as `dexMinAmountOut`. If both routes must start at the same time, pass `"-1"` and compare the two protected outputs after both settle. Use the public helper so malformed values safely lose route selection:

```ts
import { isLiquidityHubBetter } from "@orbs-network/liquidity-hub-sdk";

function selectLiquidityHubWhenBetter(quote, dexMinAmountOut) {
  if (!isLiquidityHubBetter(quote, dexMinAmountOut)) return false;

  selectLiquidityHubRoute(quote);
  return true;
}
```

`getQuote()` validates required response fields, integer amounts, both typed-data representations, and that the returned partner, tokens, input amount, and optional account match the request. It rejects malformed or mismatched payloads instead of exposing an executable quote.

Cancel in-flight requests when the account, chain, token pair, or input amount changes. The SDK's timeout aborts the underlying request, and caller cancellation remains an abort rather than a normal quote failure. For interactive applications, use the exported `FROM_AMOUNT_DEBOUNCE` value (300 milliseconds) and refresh an active quote using `DEFAULT_QUOTE_INTERVAL` (10 seconds).

## Submit Swap

The TypeScript tab in the reference above is the canonical flow and starts after the host has selected Liquidity Hub. It reuses the active-chain `liquidityHubClient` and creates the Viem `publicClient` and `walletClient` inside `executeLiquidityHubSwap()`. Call the function with the connected account, the host-selected input token address, the quote selected during the Fetch Quote stage, and a `refetchQuote` callback from the host quote layer. That callback is invoked only when the selected quote is no longer fresh. The function prepares funds, signs the selected or refreshed quote, submits it, confirms the returned transaction on-chain, and returns the successful Viem `TransactionReceipt`. It never submits a DEX transaction.

### Wrap and Approve

Liquidity Hub executes ERC-20 inputs. Pass the address originally selected in the host UI as `inputTokenAddress`, while requesting the quote with the wrapped token address when that selection is native. The Submit Swap example calls `isNativeAddress(inputTokenAddress)` itself. When wrapping is required, it calls the wrapped token's `deposit()` function through the Viem `WalletClient`, confirms it with the `PublicClient`, and continues with `quote.inToken`.

The SDK exports common native-token placeholder addresses through `nativeTokenAddresses`, but the host application must supply the correct wrapped token contract for the active chain.

Next, read the ERC-20 allowance where the owner is the connected account and the spender is `permit2Address`. When the allowance is below `quote.inAmount`, approve the exact amount and wait for a successful receipt. A larger or maximum allowance is an explicit product and security decision.

Complete both transactions before requesting a signature. If wrapping or approval fails, do not submit the Liquidity Hub quote.

### Refresh and Sign

Wrapping and approval can take long enough for the selected quote to expire. Immediately before signing, the reference checks `isFreshQuote(quote, 60)`. The 60-second window limits exposure to market-price and available-liquidity changes between quote selection and execution; after that window, the quoted output may no longer represent current executable conditions. If the quote has expired, the flow calls the host's `refetchQuote()` callback. That callback already owns the current token, amount, account, slippage, and DEX minimum inputs. The wallet signs the selected or refreshed quote once.

Use `quote.eip712` exactly as returned. The Submit Swap reference passes it unchanged to `walletClient.signTypedData()` together with the connected account.

The signature must belong to the same account passed to `getQuote()`. Submit the exact fresh quote object that produced `eip712`; changing the token, amount, user, slippage, or another quote field after signing invalidates the signature.

The host application owns route selection before this flow begins. Pass its selected Liquidity Hub quote into the TypeScript function; no DEX executor callback is required.

### Submit and Poll

Pass the same `quote` and `signature` to `liquidityHubClient.swap(quote, signature, dexRouterData)`. Reuse the active-chain client rather than constructing one for each operation. The optional `dexRouterData` value accepts `{ data?: Hex; to?: Address }` and may be `undefined` when no DEX router calldata exists. The SDK uses a hash returned directly by submission or polls status when processing is asynchronous, and rejects another `swap()` call while that client already has one in progress. Treat a rejected signature, validation response, backend error, or polling timeout as a failed Liquidity Hub execution.

### Confirm the Receipt

After receiving the hash, wait for a successful receipt with `publicClient.waitForTransactionReceipt()`. `executeLiquidityHubSwap()` returns that `TransactionReceipt`, so callers can read `receipt.transactionHash`, block details, logs, and gas usage without another lookup. The SDK has no second transaction-details method: the host owns receipt confirmation, replacements, confirmations, and revert handling.

Do not treat a wallet signature or an accepted submission request as confirmation. Wait for a successful receipt before updating the UI. If receipt confirmation fails after a hash was returned, reconcile the known hash rather than submitting a DEX fallback. The Submit Swap reference contains this complete sequence, so no separate submission fragment is needed.

For local diagnostics, setting `localStorage.lhDebug` to a non-empty value enables SDK console logging. Treat it as a local development escape hatch: never set it for users or persist it in production.

## Errors and Recovery

If Liquidity Hub cannot produce a usable quote, return the error to the host quote cycle. A DEX route may still win there, but the Liquidity Hub signing flow itself never submits another route.

If a Liquidity Hub swap fails after the user has already wrapped or approved, explain that those preparatory transactions may still have succeeded. Let the user retry with a fresh Liquidity Hub quote. When a native source asset has already been wrapped, keep the form state consistent with the wrapped balance or explicitly unwrap it before a later attempt.

Common quote failures include:

Errors containing `"not supported"`, `"no liquidity"`, `"tns"`, or `"ldv"` are terminal for the current query and are not retried automatically. Other failures, including timeouts, may retry up to 2 times and participate again in the next quote cycle.

| Error | Meaning and action |
| --- | --- |
| Contains `"not supported"` or `"tns"` | Pair or token is unsupported. Stop automatic retries until the quote inputs change. |
| Contains `"ldv"` | Input value is below the supported threshold. Stop polling and retries until the amount changes. |
| `"no liquidity"` | No solver filled this request. Do not automatically retry the same query; allow a later quote cycle or changed inputs to try again. |
| `"timeout"` | Quote request exceeded its timeout. Retry within the normal limit, then allow a later quote cycle to try again. |
| Other error or `quote.error` | Preserve the message for diagnostics, retry within the normal limit, and never treat the quote as executable while `error` is present. |

## Operational Checklist

| Check | Action | Expected result | If it fails |
| --- | --- | --- | --- |
| Client | Reuse one SDK client for the active chain and use the Orbs-provided partner name or `"unknown"`. | Quote requests use the same chain and partner. | Recreate the client after the chain changes. |
| Quote cycle | Request Liquidity Hub during the existing host quote cycle, pass `"-1"` when no DEX minimum exists, debounce inputs, and cancel obsolete requests. | The selected Liquidity Hub quote describes the current wallet, pair, amount, and chain. | Do not enter the Liquidity Hub execution flow. |
| Preparation | Wrap native input and approve `permit2Address`, checking both receipts. | Prepared ERC-20 balance and allowance cover `quote.inAmount`. | Explain which transaction reverted and stop submission. |
| Freshness | Refresh a stale quote immediately before signing. | Signing and submission use the same fresh quote object. | Do not submit a stale quote; request another quote and signature. |
| Submission | Submit the exact signed quote once and confirm the returned hash on-chain. | Receipt status is `success` before the UI reports completion. | After a hash exists, reconcile that hash and never start the DEX fallback. |
| Recovery | Exercise timeout, no-liquidity, stale, and lower-price cases. | Every case stops without submitting an invalid Liquidity Hub transaction. | Keep the flow blocked until a new valid quote is available. |

Ready to launch when every row passes on each supported chain.
