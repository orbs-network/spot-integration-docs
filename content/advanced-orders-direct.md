# Advanced Orders · API Only

Integrate **Orbs Spot** without an Orbs SDK. Your app constructs the order, requests a wallet signature, submits it to **Order Sink** (the HTTP service that accepts and tracks orders), and sends on-chain cancellation transactions. The examples use TypeScript and Viem; the HTTP contracts also apply to other stacks.

This guide includes setup, order construction, submission, history, and cancellation in implementation order. If you do not need to implement protocol fields yourself, choose the [TypeScript SDK](/advanced-orders/typescript) or [React SDK](/advanced-orders/react).

## Quickstart

### Before You Start

This path requires no Orbs runtime package. Have a connected wallet, RPC reads/writes on the same chain, real token addresses and decimals, an input balance, gas for wallet transactions, and current market data for strategy validation. Use your existing wallet provider or library. The TypeScript examples illustrate wallet and contract operations with Viem; adapt those calls to your wallet setup. Initialize the account, chain, and wallet/RPC clients at the top of the create-order file. Supply the chain-specific wrapped-token address and a validated `OrderInput` from your host form.

Implement in this order: configuration fetch, strategy derivation, the `create-order-flow.ts` and `order-types.ts` files, history, then cancellation. The host owns strategy math, protocol field validation, HTTP requests, and wallet transactions.

Use your existing DEX partner ID, or `"external"`. Fetch its configuration for the connected chain; signing and approval use the returned protocol addresses. Orders spend ERC-20 tokens: when native currency is selected, wrap it first and use the chain’s wrapped-native address in the order.

The API-only integration uses these HTTP and on-chain operations:

| Operation | Contract |
| --- | --- |
| Fetch configuration | `GET https://order-sink-v2.orbs.network/config?partner={partner}&chain={chainId}` with `Accept: application/json`. |
| Create order | `POST https://order-sink-v2.orbs.network/orders/new` with JSON `{ signature, order, status: "pending" }`. `order` must be the exact EIP-712 message that produced `signature`. |
| Fetch history | `GET https://order-sink-v2.orbs.network/orders?swapper={account}&chainId={chainId}&partner={partner}`. Returns all matching v2 orders in one request. |
| Cancel | Send the on-chain transaction `cancel([metadata.repermitDigest])` to `domain.verifyingContract`; cancellation is not an Order Sink HTTP request. |

### Function Contracts

The two Create Order files are `create-order-flow.ts` and `order-types.ts`. They provide the following functions; equivalent HTTP and wallet operations can be implemented in another language.

| Function | Contract |
| --- | --- |
| `fetchDefaultPermitData(partnerId, chainId)` | Fetches and validates the partner-chain configuration; returns `PermitData` containing `domain`, `types`, `primaryType`, and the base `order`. |
| `buildOrderFromDerivedValues({ orderInput, permitData, inputTokenAddress })` | Validates the supplied configuration, amounts, schedule, freshness, slippage, and triggers, and returns `{ order, permitData }`. |
| `signOrder({ orderInput, permitData, inputTokenAddress })` | Builds the order, signs its EIP-712 payload, and returns `{ order, signature }`. |
| `submitOrdersSinkOrder({ orderInput, wTokenAddress })` | Validates configuration and order inputs before preparing funds, calls `signOrder`, and returns the accepted `OrderResponse`. Its internal `submitOrder(order, signature)` helper posts the unchanged signed message to Order Sink. |

Use your DEX partner ID in each `fetchDefaultPermitData` call for creation and cancellation, and the `partner` query parameter for history; use `"external"` if you do not have one. The host supplies the active account and chain to each operation.

The RePermit contract, reactor, executor, exchange adapter, and fee reference addresses come from the fetched partner configuration. Do not hardcode them in the integration.

## Fetch Config

Pass the user’s selected chain ID in the `chain` query parameter. `137` (Polygon) is only an example; update it when the selected network changes.

Every create-order attempt begins with `GET https://order-sink-v2.orbs.network/config?partner={partner}&chain={chainId}`. This returns the server-controlled `domain`, `types`, `primaryType`, and base `order` template used by the helpers in `create-order-flow.ts`. Encode the partner as a query value and fetch a fresh template for the active chain when preparing the order.

Preserve the returned domain and types unchanged. The helper rejects missing, malformed, or zero RePermit, spender, reactor, executor, and adapter addresses, a spender that differs from the reactor, or domain/witness chain IDs that differ from the connected chain. It also checks the EIP-712 domain and type-map structure, referral address, exchange share/data, and exclusivity setting. Zero is allowed for the optional referral address. The RePermit contract, reactor, executor, exchange adapter, and fee reference addresses must come from this response rather than local constants.


The Request tab shows the endpoint and header; use **Copy as cURL** to run it. The Response tab is an illustrative template with placeholder addresses. Always fetch the current response for your partner and chain.

| Response field | How to use it |
| --- | --- |
| `domain`, `types`, `primaryType` | Pass unchanged to the wallet when signing. |
| `order.spender`, `order.witness.reactor`, `executor`, `exchange`, `exclusivity` | Preserve the server-provided protocol and partner settings. |
| `order.permitted`, nonce, timing, input, output | Populate with the user's order values in the next step. Zero values are unfilled template fields. |
| `partner` | Partner name resolved by the service. |

Keep the response as `permitData`. The create-order flow fetches it once and reuses it for approval, building, and signing.

## Strategy Recipes

All amounts below are integer strings in token base units. Start from the trusted `/config` template, preserve its protocol and exchange fields, and fill only the strategy values. For one-fill strategies use `totalTrades = 1`, `witness.epoch = 0`, and `witness.input.amount = witness.input.maxAmount = permitted.amount`.

| Strategy | Required field rules |
| --- | --- |
| TWAP | Choose `totalTrades > 1`; set `permitted.amount = srcAmountPerFill × totalTrades`, `input.amount = srcAmountPerFill`, `input.maxAmount = permitted.amount`, and `epoch = fillDelaySeconds`. Require `0 < freshness < epoch`. Ensure `deadline >= start + epoch × (totalTrades - 1)`. Set both triggers to `"0"`; set `output.limit` to the minimum destination amount per fill, or `"0"` for market execution. |
| Limit | Use one fill and `epoch = 0`. Set `output.limit` to the required minimum destination amount; both triggers are `"0"`. The order remains eligible until `witness.deadline`. |
| Stop Loss | Use one fill and `epoch = 0`. Set `triggerLower` to the lower trigger amount per fill and `triggerUpper = "0"`. Set `output.limit` to the post-trigger minimum, or `"0"` for market execution. |
| Take Profit | Use one fill and `epoch = 0`. Set `triggerUpper` to the upper trigger amount per fill and `triggerLower = "0"`. Set `output.limit` to the post-trigger minimum, or `"0"` for market execution. |

For TWAP, calculate `srcAmountPerFill = totalInputAmount / totalTrades` with integer division, then set the actual signed total to `srcAmountPerFill × totalTrades`. Show that adjusted total before signing; the remainder stays in the wallet. For example, 1,000 USDC (6 decimals) over 3 fills becomes 333.333333 USDC per fill, a total of 999.999999 USDC, and a remainder of 0.000001 USDC. Reject a zero per-fill amount. The builder rejects totals that do not match this multiplication and deadlines that cannot accommodate the schedule.

Build the order close to signing time. The reference builder generates one nonce from the current Unix time in milliseconds and uses that same value for both `order.nonce` and `order.witness.nonce`. Preserve the complete built order unchanged through signing, submission, storage, and retry.

### Build the Form Input

`OrderInput` is the order data your host form calculates before calling `submitOrdersSinkOrder`. Amounts are **integer strings in token base units**, not human-readable decimals or USD values. Source amounts use the input token's decimals; output limits and triggers use the destination token's decimals. For example, 1 USDC with 6 decimals is `"1000000"`.

**TWAP example:** to spend 30 USDC in three trades of 10 USDC, pass `totalInputAmount: "30000000"`, `srcAmountPerFill: "10000000"`, and `totalTrades: 3`. Use `fillDelayMillis: 60000` and `freshnessSeconds: 30` for one-minute fills with a 30-second price-data window. Freshness must be positive and strictly less than the 60-second epoch. Each trade must meet the $10 minimum. Set both triggers to `"0"`, and choose a deadline that allows the full schedule.

For a single limit, stop-loss, or take-profit order, use `totalTrades: 1`, `fillDelayMillis: 0`, and the same source amount for `totalInputAmount` and `srcAmountPerFill`. Output limits and triggers describe **one fill**.

| Field | Meaning |
| --- | --- |
| `inputToken.address` | Source token selected in the host form. For native input, the flow wraps it and passes the resolved `wTokenAddress` to signing and order building. |
| `dstToken` | ERC-20 destination-token address. |
| `sourceIsNative` | `true` when the user selected native currency and the flow must wrap it before signing. |
| `totalInputAmount` | Complete order input as an integer source-token base-unit string. This becomes `permitted.amount` and `input.maxAmount`. |
| `srcAmountPerFill` | Source amount assigned to one fill, in source-token base units. |
| `dstMinAmountPerFill` | Minimum destination amount accepted for one fill, in destination-token base units. Use `"0"` when the strategy has no limit. |
| `deadlineMillis` | Absolute order deadline as Unix time in milliseconds. The helper converts it to Unix seconds. |
| `fillDelayMillis` | Delay between eligible fills in milliseconds. Use whole seconds; TWAP requires an interval longer than freshness. Single-fill orders use `0`. |
| `totalTrades` | Number of expected fills. Use a positive integer. `1` produces `witness.epoch = 0`. |
| `slippageBps` | Execution slippage as an integer from `0` to `5000` basis points; `100` means 1%. |
| `freshnessSeconds` | Positive integer price-data age in seconds. Defaults to `60`; for TWAP it must be strictly less than `fillDelayMillis / 1000`. Explicitly use `30` for a 60-second fill interval. |
| `triggerLower` | Stop-loss trigger output amount for one fill, in destination-token base units, not a USD price. Use `"0"` when unused. |
| `triggerUpper` | Take-profit trigger output amount for one fill, in destination-token base units, not a USD price. Use `"0"` when unused. |

## Create Order

The framework-neutral reference above contains the complete flow. `create-order-flow.ts` exports `submitOrdersSinkOrder()`, prepares funds, and includes the signing, order-building, and permit-data helpers at the bottom; `order-types.ts` defines the shared contracts. Set `account` and `chainId` at the top from the connected wallet, and refresh them when the account or network changes. Initialize `publicClient` and `walletClient` at the top using the connected wallet provider. Pass only `orderInput` and the wrapped-token address to the create flow. No React hooks are required.

Fetch configuration once per create-order attempt. Use that same `permitData` for the approval spender, pass it to `signOrder()`, and forward it to `buildOrderFromDerivedValues()` to construct the signed order.


1. Fetch and validate the partner and active-chain permit template. Validate token addresses, positive integer amounts, exact `totalInputAmount = srcAmountPerFill × totalTrades`, schedule, freshness, slippage, and triggers before any wrapping, approval, or signing. The builder rechecks these inputs immediately before signing.
2. Ensure the input is an ERC-20 token. If the user selected native currency, wrap it and replace it with the wrapped-native token before building the order. Then check allowance and approve RePermit for `order.permitted.amount` when allowance is insufficient. This API-only reference uses an exact allowance; use a maximum allowance only as an explicit host security decision.
3. Call `signOrder()` with `orderInput`, fetched `permitData` and resolved `inputTokenAddress` (the wrapped-token address for native input). It uses that template to build `signTypedDataArgs`, and signs the resulting order.
4. Submit the returned `order` unchanged as `{ signature, order, status: "pending" }` to `POST /orders/new`.
5. Require HTTP and API success, then keep the returned `signedOrder` for progress, history, fills, and cancellation.

Use the partner identifier provided by Orbs. If none was provided, send the exact value `"external"`. Token amounts must be integer strings in base units, the signer must match `order.witness.swapper`, and the active chain must match both the EIP-712 domain and witness chain IDs.

Do not recreate the EIP-712 domain, types, protocol contracts, or exchange fields locally. Do not rebuild or mutate the order after signing. Store the returned order hash for tracking and `metadata.repermitDigest` for cancellation.

`POST /orders/new` returns a success envelope containing `signedOrder`, or an API error. Preserve the returned order `hash`, service `metadata`, original `order`, `signature`, and timestamp. Transport success alone is insufficient: also require the response body's `success` value before treating creation as complete.

### Check Signing and Submission Results

Use these tables to inspect the signing request and accepted response produced by `submitOrdersSinkOrder()`. A wallet signature authorizes the order. A successful Order Sink response creates a trackable order; fills and cancellation happen later.

#### `signTypedDataArgs` Fields

| Field | Meaning |
| --- | --- |
| `account` | Connected wallet that owns the order and must equal `message.witness.swapper`. |
| `domain` | Server-controlled EIP-712 domain returned by default permit data. Its `verifyingContract` is also the ERC-20 allowance spender. |
| `types` | Complete ordered EIP-712 type map returned by default permit data. Pass it to the wallet unchanged. |
| `primaryType` | Root EIP-712 type returned by default permit data. Pass it to the wallet unchanged. |
| `message` | Fully populated RePermit order. Sign this object and submit the exact same object as `order`. |

#### Created Order Fields

| Field | Meaning |
| --- | --- |
| `hash` | Order Sink identifier used to track the created order. |
| `order` | Exact RePermit message that was signed and submitted. |
| `signature` | Complete EIP-712 wallet signature submitted with the order. |
| `timestamp` | Creation time assigned by Order Sink. |
| `metadata.status` | Current execution state, initially `"pending"`. |
| `metadata.repermitDigest` | On-chain digest required to cancel the order. Preserve it with the created order. |

## Fetch Order Sink Orders

Call `fetchOrders({ account, chainId, partner })` with the connected wallet context and the same partner ID used for submission. Use your existing DEX partner ID, or `"external"` if you do not have one.

The v2 history query contains only `swapper`, `chainId`, and `partner`. `swapper` is the order owner address, matching `order.witness.swapper`. Do not send `exchange`, `page`, or `limit`: v2 returns all matching orders in one request, so no page-fetching loop is needed. Fetching history does not require a configuration request to resolve an adapter.

Use the Request and Response tabs in the `Fetch Order History` reference. The Request tab shows the HTTP method, endpoint, and complete query parameters. The Response tab contains the successful `orders` JSON returned by Order Sink.

Important fields for consumers:

| Field | Description |
| --- | --- |
| `hash` | Order Sink order ID/hash. Store this for tracking. |
| `order` | Original signed RePermit order. |
| `metadata.status` | Order Sink status. `"pending"` and `"eligible"` are open states; `"completed"` is filled. |
| `metadata.description` | Additional status description. A cancelled order may be reported as `"cancelled by contract"` after the on-chain cancel is indexed. |
| `metadata.expectedChunks` | Expected number of fills/chunks. |
| `metadata.chunks` | Fill/chunk execution details, when available. |
| `metadata.lastPriceCheck` | Most recent time Order Sink evaluated the order's execution price. |
| `metadata.nextEligibleTime` | Earliest time the next fill may be attempted. |
| `metadata.repermitDigest` | Permit digest required for on-chain cancellation. Store this value. |
| `metadata.displayOnlyInputTokenPriceUSD` | Display-only USD price encoded as an 18-decimal fixed-point integer. Format it before display; never use it for execution math. |
| `signature` | Complete wallet signature authorizing the RePermit order. |
| `timestamp` | Time Order Sink accepted the order. |

The endpoint returns raw Order Sink objects. If you normalize them in your own service, keep the raw `metadata.repermitDigest`; it is needed to cancel the order.

## Cancel Order Sink Orders

Set the connected `account`, selected `chainId`, and Viem clients at the top of `cancel-order.ts`. Refresh that setup when the wallet connection changes. Call `cancelOrdersSinkOrder(order)` with the selected history item.

Cancelling a RePermit order is an on-chain transaction. Do not send a cancel request to Order Sink. The copyable example at the top resolves the trusted RePermit contract for the active wallet chain, submits `metadata.repermitDigest`, checks the receipt, and then refreshes history.

`orderSinkOrder` is one item from the submitted or fetched Order Sink response. The cancellation digest comes from `orderSinkOrder.metadata.repermitDigest`. Do not use the Order Sink `hash` as the cancel digest. Use the same `permitDataResponse.domain.verifyingContract` that was fetched for the order; retain that address with local order metadata if cancellation may happen later.

Cancellation flow:

1. Fetch the order from `https://order-sink-v2.orbs.network/orders`.
2. Read `metadata.repermitDigest`.
3. Ask the user or custody system to send a transaction to the RePermit contract.
4. Call `cancel([metadata.repermitDigest])`. Use `metadata.repermitDigest`, not the Order Sink `hash`.
5. Wait for the transaction receipt.
6. Refetch the same Order Sink endpoint until metadata reflects the cancelled state.

The transaction sender should be the same address that signed the original order. In the signed order this is `order.witness.swapper`.

## Operational Checklist

| Check | Action | Expected result | If it fails |
| --- | --- | --- | --- |
| Configuration | Fetch `/config` with the Orbs partner value or `"external"`; preserve its domain, types, protocol contracts, and exchange fields. | Domain and witness chain IDs equal the connected wallet chain. | Block signing and surface a partner/chain configuration error. |
| Strategy math | Apply the selected recipe with integer base-unit strings and one fresh shared nonce. | Total amount, per-fill amount, epoch, deadline, limit, and triggers satisfy the recipe invariants. | Keep review disabled and identify the invalid field. |
| Funding | Read allowance for signer → `domain.verifyingContract`; wrap native input and approve the complete amount when required. | Both receipts succeed and allowance covers `permitted.amount`. | Keep the order unsubmitted; show the reverted preparation step. |
| Signature | Set `witness.swapper` to the signer and sign the final message once. | The exact signed message is retained unchanged. | Discard the signature and rebuild from current state. |
| Submission | POST `{ signature, order, status: "pending" }` and require HTTP success plus `result.success`. | A `signedOrder` with hash and metadata is stored. | Show the API error without silently marking creation successful. |
| History | Fetch orders using the original account (`swapper`), `chainId`, and `partner`. | The UI receives the matching orders and keeps raw metadata. | Offer retry and preserve the last known list. |
| Cancellation | Resolve RePermit for the active wallet chain, call `cancel([metadata.repermitDigest])`, confirm the receipt, then refetch. | Order Sink eventually reports the terminal cancelled state. | Show the on-chain failure and leave the order open. |

Ready to launch when every row passes on each supported chain.

### End-to-End Acceptance Run

1. Resolve partner/chain configuration and validate the selected strategy’s amounts, schedule, limits, and triggers. Fill `OrderInput` with real token metadata and validated raw amounts; example addresses and response objects are not executable fixtures.
2. Include both implementation files: `create-order-flow.ts` and `order-types.ts`. Set the host account and chain ID at the top of the file. Initialize the Viem clients there using the connected wallet provider, and pass the correct wrapped-native address to `submitOrdersSinkOrder`.
3. Call `submitOrdersSinkOrder({ orderInput, wTokenAddress })` from one guarded confirmation handler. Start with insufficient allowance; verify RePermit approval confirms before the EIP-712 prompt. Repeat with native input to verify wrapping occurs first.
4. Require HTTP and API success, retain the returned `signedOrder`, and show “Order submitted”. Fetch history using the same `swapper`, `chainId`, and `partner`; match the returned order hash. Acceptance alone is not a fill.
5. Select an open order from history and call `cancelOrdersSinkOrder(order)`. Use its `metadata.repermitDigest`, confirm the transaction, then refresh until history reflects the result.
6. Reject signing and simulate a lost create response. Verify the first case never submits, while the second reconciles history before another attempt. Test wrong-chain/zero-address configuration, a mismatched chunk total, and freshness equal to or greater than the TWAP epoch. These cases must fail before wallet transactions or signing.

Use an explicitly funded development wallet for the live run. Choose an amount meeting partner requirements and a strategy you understand: execution can spend funds before you cancel. A successful cancellation does not reverse prior fills.
