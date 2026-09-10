# Swap · Direct API

[Shared Reference](/liquidity-hub/shared) — concepts, lifecycle, input tokens, chains, fees, partner configuration, and resources for every Swap integration.

Use this guide when the host application needs to integrate Liquidity Hub over HTTP and will own request cancellation, quote freshness, Permit2 approval, EIP-712 signing, and status polling itself.

See [Choose an Integration](/liquidity-hub/shared#integration-options) for the SDK comparison and [Integration Lifecycle](/liquidity-hub/shared#how-it-works) for the shared execution sequence.

## Quickstart

Liquidity Hub exposes one public API origin: `https://hub.orbs.network`. Hardcode it in every request, use it for every supported chain, and pass the active `chainId` in each endpoint's query string.

Do not accept an API origin from user input or replace it based on the chain. Send and receive JSON. Apply a 10-second timeout to quote requests and abort obsolete requests when the account, chain, pair, or input amount changes.

## Fetch Quote

Send `POST /quote?chainId={chainId}` when the swap input changes. The request and response panel above shows the raw HTTP contract.

The input token cannot be native currency. `inToken` must always be an ERC-20 address. If the user selected the chain's native currency, quote with the wrapped token address and wrap the required funds before submission.

Set `partner` to the exact partner identifier supplied by Orbs. If Orbs has not supplied one, send the lowercase string `"unknown"`. Do not invent or derive a partner value from the application name or hostname.

Raw API request fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `inToken` | Yes | ERC-20 source token. Use the wrapped token address when the user selected native currency. |
| `outToken` | Yes | Destination token address. |
| `inAmount` | Yes | Source amount as an integer base-unit string. |
| `outAmount` | Recommended | Host DEX route's slippage-adjusted minimum output. Send `"-1"` when no DEX minimum is available yet. |
| `user` | Required for execution | Connected account from the host wallet hook, such as Wagmi's `useAccount()`. |
| `slippage` | Yes | Percentage tolerance, such as `0.5` for 0.5%. |
| `partner` | Yes | Stable lowercase partner identifier supplied by Orbs; otherwise `"unknown"`. |
| `qs` | No | URI-encoded source-page query or hash used for diagnostics. Send an empty string when unavailable. |
| `sessionId` | No | Previous Liquidity Hub session when refreshing the same account, pair, and amount. |

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
| `timestamp` | Quote time in milliseconds, used for freshness checks. |
| `error` | Optional service error metadata retained with the complete quote. |

Important `eip712` fields:

| Field | Purpose |
| --- | --- |
| `domain` | EIP-712 signing domain returned for this quote. |
| `types` | Complete EIP-712 type definitions. |
| `primaryType` | Root type signed by the wallet. |
| `message` | Complete message signed by the wallet. |

Reject a non-2xx or non-JSON response. Preserve the response as an opaque quote: fields such as `serializedOrder`, `eip712`, `permitData`, `qs`, `exchange`, `sessionId`, and `timestamp` must reach submission unchanged. Use the wallet-ready `eip712` payload for signing; `permitData` is retained only for legacy compatibility.

API-only integrations must validate required string and integer fields, both typed-data representations, and that the returned partner, tokens, input amount, and account match the request. Reject malformed or mismatched payloads instead of exposing an executable quote.

Debounce typed amount changes by about 300 milliseconds and refresh an active quote about every 10 seconds. Retry transient quote failures at most twice. Treat errors containing `"not supported"`, `"tns"`, `"no liquidity"`, or `"ldv"` as terminal for the current query; retry after the relevant quote inputs change or during a later quote cycle.

### Compare with a DEX Router (Optional)

Use this step only when Liquidity Hub runs alongside an existing DEX router. Liquidity-Hub-only integrations can continue directly to **Submit Swap**.

Request both routes for the same input tokens, amount, account, chain, and slippage. Then compare:

- Liquidity Hub: `quote.minAmountOut`
- DEX router: its slippage-adjusted minimum amount out

Both values must be integer strings in destination-token base units. Select the route with the higher minimum amount out. Do not compare formatted display amounts or the unprotected quoted output.

## Submit Swap

The separate **Fetch Quote** section shows where `quote` comes from. The **Submit Swap** example verifies Permit2 allowance, approves the ERC-20 input when needed, refreshes a stale quote, and then uses that exact quote through signing, submission, status polling, and receipt confirmation.

### Wrap and Approve

Liquidity Hub cannot execute a native input token. If the user selected native currency, wrap it first and request a fresh quote using the wrapped token address. Then read the source token allowance for the connected account with Permit2 as spender. When the allowance is below `quote.inAmount`, approve enough to cover the quote and wait for a successful receipt before signing.

### Refresh and Sign

Pause background quote polling before wallet operations. Pass the host quote layer's `refetchQuote` callback to `submitLiquidityHubSwap()`. Immediately before signing, the example compares `Date.now()` with `quote.timestamp`; after 60 seconds it awaits that callback and uses the returned quote for signing, submission, and status polling. When using a DEX router alongside Liquidity Hub, confirm that the refreshed quote still has the better protected minimum.

Sign the wallet-ready `quote.eip712` payload exactly as returned. Its `domain`, `types`, `primaryType`, and `message` fields can be passed directly to the wallet library. The full flow below includes the signature request.

Read `account` from the host wallet hook, such as Wagmi's `useAccount()`, and use it as `user` when requesting the quote, reading allowance, signing, submitting, and polling status. Submit the same quote object that produced the signature; changing the account, tokens, amount, slippage, or any opaque service field invalidates the signed request.

### Submit and Poll

Submit the complete, unchanged quote to `POST /swap-async?chainId={chainId}` with the wallet `signature`. Add `dexTx` only when the host has router calldata that Liquidity Hub must receive.

Start submission and poll `POST /swap/status/{sessionId}?chainId={chainId}` with `{ user }` concurrently. If submission returns `txHash`, use it immediately; otherwise the submitted-hash promise adopts the polling promise. Racing both paths returns the first available hash while still surfacing submission failures.

### Confirm the Receipt

Receiving `txHash` from the previous step means Liquidity Hub has submitted a transaction. It does **not** prove that the transaction succeeded.

Get the receipt from the active chain. If the receipt is not available yet, retry after a short delay. When `receipt.status` is `"success"`, the swap is complete. No additional Liquidity Hub API request is required.

Do not automatically repeat a signed submission. Disable duplicate user actions while execution is pending and surface a definitive backend `error` immediately.

## Errors and Recovery

| Failure | Direct API behavior |
| --- | --- |
| Quote timeout or transient network failure | Abort the obsolete request or retry at most twice, then let the host DEX route continue. |
| Unsupported-token (`"not supported"` or `"tns"`), no-liquidity, or low-value (`"ldv"`) response | Stop automatic retries for the current query until the relevant quote inputs change or a later quote cycle begins. |
| Liquidity Hub does not beat the DEX | Execute the existing DEX route; do not ask for a Liquidity Hub signature. |
| User rejects wrap, approval, or signature | Stop execution. Explain which wallet action was cancelled. |
| Submission validation error | Surface the service error and require a completely fresh quote before retrying. |
| Status or receipt timeout | Retain the session ID and transaction hash, then verify the receipt again on the active chain. |

## Operational Checklist

| Check | Expected result |
| --- | --- |
| Endpoint | The API origin is `https://hub.orbs.network` and `chainId` matches the connected wallet network. |
| Quote | Account, tokens, amount, slippage, partner, and DEX minimum describe the current form state. |
| Selection | When a DEX router is present, compare both routes' integer minimum-amount-out values. |
| Preparation | Native input is wrapped and Permit2 allowance covers the signed quote amount. |
| Freshness | Background polling is paused and the signed quote is no older than 60 seconds. |
| Submission | The complete, unchanged quote and matching signature are sent once. |
| Confirmation | The on-chain receipt succeeds before the UI reports completion. |
| Recovery | Every wallet or service failure leaves the form in a recoverable state. |

If the host cannot own every item in this checklist, use the SDK integration instead.
