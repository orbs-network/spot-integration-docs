# Advanced Orders · API Only

## Quickstart

### Before You Start

Complete the shared [setup requirements](/advanced-orders/shared#integration-options). This path requires no Orbs runtime package, but the TypeScript examples use Viem for wallet and contract operations. Initialize the account, chain, and Viem clients at the top of the create-order file. Supply the chain-specific wrapped-token address and a validated `OrderInput` from your host form.

Implement in this order: configuration fetch, strategy derivation, the two [Create Order reference files](/advanced-orders/direct#create-order), history, then cancellation. The host owns strategy math, protocol field validation, HTTP requests, and wallet transactions.

Start with the shared [Partner Configuration](/advanced-orders/shared#fees-and-configuration) and [Input Tokens](/advanced-orders/shared#how-it-works) requirements, then implement these API operations.

The API-only integration uses these HTTP and on-chain operations:

| Operation | Contract |
| --- | --- |
| Fetch configuration | `GET https://order-sink-v2.orbs.network/config?partner={partner}&chain={chainId}` with `Accept: application/json`. |
| Create order | `POST https://order-sink-v2.orbs.network/orders/new` with JSON `{ signature, order, status: "pending" }`. `order` must be the exact EIP-712 message that produced `signature`. |
| Fetch history | `GET https://order-sink-v2.orbs.network/orders?swapper={account}&chainId={chainId}&exchange={adapter}&page=1&limit=100`. The adapter comes from the configuration response. |
| Cancel | Send the on-chain transaction `cancel([metadata.repermitDigest])` to `domain.verifyingContract`; cancellation is not an Order Sink HTTP request. |

### Function Contracts

The two Create Order files are `create-order-flow.ts` and `order-types.ts`. They provide the following functions; equivalent HTTP and wallet operations can be implemented in another language.

| Function | Contract |
| --- | --- |
| `fetchDefaultPermitData(partnerId, chainId)` | Fetches the partner-chain configuration; returns `PermitData` containing `domain`, `types`, `primaryType`, and the base `order`. |
| `buildOrderFromDerivedValues({ orderInput, permitData, inputTokenAddress })` | Uses the supplied permit data, validates the schedule, and returns `{ order, permitData }`. |
| `signOrder({ orderInput, permitData, inputTokenAddress })` | Builds the order, signs its EIP-712 payload, and returns `{ order, signature }`. |
| `submitOrdersSinkOrder({ orderInput, wTokenAddress })` | Prepares funds, calls `signOrder`, and returns the accepted `OrderResponse`. Its internal `submitOrder(order, signature)` helper posts the unchanged signed message to Order Sink. |

Use your DEX partner ID in each `fetchDefaultPermitData` call for creation, history, and cancellation; use `"external"` if you do not have one. The host supplies the active account and chain to each operation.

The RePermit contract, reactor, executor, exchange adapter, and fee reference addresses come from the fetched partner configuration. Do not hardcode them in the integration.

## Strategy Recipes

All amounts below are integer strings in token base units. Start from the trusted `/config` template, preserve its protocol and exchange fields, and fill only the strategy values. For one-fill strategies use `totalTrades = 1`, `witness.epoch = 0`, and `witness.input.amount = witness.input.maxAmount = permitted.amount`.

| Strategy | Required field rules |
| --- | --- |
| TWAP | Choose `totalTrades > 1`; set `permitted.amount = srcAmountPerFill × totalTrades`, `input.amount = srcAmountPerFill`, `input.maxAmount = permitted.amount`, and `epoch = fillDelaySeconds`. Ensure `deadline >= start + epoch × (totalTrades - 1)`. Set both triggers to `"0"`; set `output.limit` to the minimum destination amount per fill, or `"0"` for market execution. |
| Limit | Use one fill and `epoch = 0`. Set `output.limit` to the required minimum destination amount; both triggers are `"0"`. The order remains eligible until `witness.deadline`. |
| Stop Loss | Use one fill and `epoch = 0`. Set `triggerLower` to the lower trigger amount per fill and `triggerUpper = "0"`. Set `output.limit` to the post-trigger minimum, or `"0"` for market execution. |
| Take Profit | Use one fill and `epoch = 0`. Set `triggerUpper` to the upper trigger amount per fill and `triggerLower = "0"`. Set `output.limit` to the post-trigger minimum, or `"0"` for market execution. |

For TWAP, calculate `srcAmountPerFill = totalInputAmount / totalTrades` with integer division, then set the actual signed total to `srcAmountPerFill × totalTrades`. Show that adjusted total before signing; the remainder stays in the wallet. For example, 1,000 USDC (6 decimals) over 3 fills becomes 333.333333 USDC per fill, a total of 999.999999 USDC, and a remainder of 0.000001 USDC. Reject a zero per-fill amount. The builder rejects totals that do not match this multiplication and deadlines that cannot accommodate the schedule.

Build the order close to signing time. The live Spot builder generates one nonce from the current Unix time in milliseconds and uses that same value for both `order.nonce` and `order.witness.nonce`. Preserve the complete built order unchanged through signing, submission, storage, and retry.

## Fetch Config

Pass the user’s selected chain ID in the `chain` query parameter. `137` (Polygon) is only an example; update it when the selected network changes.

Every create-order attempt begins with `GET https://order-sink-v2.orbs.network/config?partner={partner}&chain={chainId}`. This returns the server-controlled `domain`, `types`, `primaryType`, and base `order` template used by the helpers in `create-order-flow.ts`. Encode the partner as a query value and fetch a fresh template for the active chain when preparing the order.

Preserve the returned domain and types unchanged. Reject the response when `domain.verifyingContract` or `order.witness.exchange.adapter` is missing or the zero address, or when either signed chain ID differs from the connected chain. The RePermit contract, reactor, executor, exchange adapter, and fee reference addresses must come from this response rather than local constants.


The Request tab shows the endpoint and header; use **Copy as cURL** to run it. The Response tab is an illustrative template with placeholder addresses. Always fetch the current response for your partner and chain.

| Response field | How to use it |
| --- | --- |
| `domain`, `types`, `primaryType` | Pass unchanged to the wallet when signing. |
| `order.spender`, `order.witness.reactor`, `executor`, `exchange`, `exclusivity` | Preserve the server-provided protocol and partner settings. |
| `order.permitted`, nonce, timing, input, output | Populate with the user's order values in the next step. Zero values are unfilled template fields. |
| `partner` | Partner name resolved by the service. |

Keep the response as `permitData`. The create-order flow fetches it once and reuses it for approval, building, and signing.

## Create Order

The framework-neutral reference above contains the complete flow. `create-order-flow.ts` exports `submitOrdersSinkOrder()`, prepares funds, and includes the signing, order-building, and permit-data helpers at the bottom; `order-types.ts` defines the shared contracts. Set `account` and `chainId` at the top from the connected wallet, and refresh them when the account or network changes. Initialize `publicClient` and `walletClient` at the top using the connected wallet provider. Pass only `orderInput` and the wrapped-token address to the create flow. No React hooks are required.

Fetch configuration once per create-order attempt. Use that same `permitData` for the approval spender, pass it to `signOrder()`, and forward it to `buildOrderFromDerivedValues()` to construct the signed order.


1. Fetch the default partner and active-chain permit template.
2. Ensure the input is an ERC-20 token. If the user selected native currency, wrap it and replace it with the wrapped-native token before building the order. Then check allowance and approve RePermit for `order.permitted.amount` when allowance is insufficient. This API-only reference uses an exact allowance; use a maximum allowance only as an explicit host security decision.
3. Call `signOrder()` with `orderInput`, fetched `permitData` and resolved `inputTokenAddress` (the wrapped-token address for native input). It uses that template to build `signTypedDataArgs`, and signs the resulting order.
4. Submit the returned `order` unchanged as `{ signature, order, status: "pending" }` to `POST /orders/new`.
5. Require HTTP and API success, then keep the returned `signedOrder` for progress, history, fills, and cancellation.

Use the partner identifier provided by Orbs. If none was provided, send the exact value `"external"`. Token amounts must be integer strings in base units, the signer must match `order.witness.swapper`, and the active chain must match both the EIP-712 domain and witness chain IDs.

Do not recreate the EIP-712 domain, types, protocol contracts, or exchange fields locally. Do not rebuild or mutate the order after signing. Store the returned order hash for tracking and `metadata.repermitDigest` for cancellation.

`POST /orders/new` returns a success envelope containing `signedOrder`, or an API error. Preserve the returned order `hash`, service `metadata`, original `order`, `signature`, and timestamp. Transport success alone is insufficient: also require the response body's `success` value before treating creation as complete.

### `OrderInput` Fields

`OrderInput` is the order data your host form calculates before calling `submitOrdersSinkOrder`. Amounts are **integer strings in token base units**, not human-readable decimals or USD values. Source amounts use the input token's decimals; output limits and triggers use the destination token's decimals. For example, 1 USDC with 6 decimals is `"1000000"`.

**TWAP example:** to spend 30 USDC in three trades of 10 USDC, pass `totalInputAmount: "30000000"`, `srcAmountPerFill: "10000000"`, and `totalTrades: 3`. A `fillDelayMillis` of `60000` spaces fills one minute apart. Each trade must meet the $10 minimum. Set both triggers to `"0"`, and choose a deadline that allows the full schedule.

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
| `fillDelayMillis` | Delay between eligible fills in milliseconds. The helper converts it to `witness.epoch` seconds. |
| `totalTrades` | Number of expected fills. Use a positive integer. `1` produces `witness.epoch = 0`. |
| `slippageBps` | Execution slippage in basis points; `100` means 1%. |
| `freshnessSeconds` | Maximum accepted age of execution price data in seconds. Use `60` unless Orbs explicitly supplied another value. |
| `triggerLower` | Stop-loss trigger output amount for one fill, in destination-token base units, not a USD price. Use `"0"` when unused. |
| `triggerUpper` | Take-profit trigger output amount for one fill, in destination-token base units, not a USD price. Use `"0"` when unused. |

### `signTypedDataArgs` Fields

| Field | Meaning |
| --- | --- |
| `account` | Connected wallet that owns the order and must equal `message.witness.swapper`. |
| `domain` | Server-controlled EIP-712 domain returned by default permit data. Its `verifyingContract` is also the ERC-20 allowance spender. |
| `types` | Complete ordered EIP-712 type map returned by default permit data. Pass it to the wallet unchanged. |
| `primaryType` | Root EIP-712 type returned by default permit data. Pass it to the wallet unchanged. |
| `message` | Fully populated RePermit order. Sign this object and submit the exact same object as `order`. |

### Created Order Fields

| Field | Meaning |
| --- | --- |
| `hash` | Order Sink identifier used to track the created order. |
| `order` | Exact RePermit message that was signed and submitted. |
| `signature` | Complete EIP-712 wallet signature submitted with the order. |
| `timestamp` | Creation time assigned by Order Sink. |
| `metadata.status` | Current execution state, initially `"pending"`. |
| `metadata.repermitDigest` | On-chain digest required to cancel the order. Preserve it with the created order. |

## Fetch Order Sink Orders

**Where does `exchange` come from?** First call [Fetch Config](/advanced-orders/direct#fetch-config) with your partner and selected chain. Read `order.witness.exchange.adapter` from its JSON response and pass that address as the `exchange` query parameter. The `0x8888…8888` address in the request example is a placeholder; replace it with the returned adapter address.

Call `fetchOrders({ account, chainId, page: 1, limit: 100 })` with the connected wallet context. `page` is **one-based for the raw API**; `limit` is a positive integer page size. The response retains `orders`, `page`, `limit`, `total`, and `totalPages`. Increment `page` until it reaches `totalPages`, or expose a Load more control. Use the response's actual page size if the service caps the requested limit. The SDK uses zero-based pages and performs this conversion internally.


Fetch RePermit orders from Order Sink with the swapper address, chain ID, and exchange adapter from the fetched template. The `swapper` query value is the order owner address, matching `order.witness.swapper`. The `exchange` query value should be `permitDataResponse.order.witness.exchange.adapter`.

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
| History | Fetch orders using the stored chain and adapter. | The UI receives the matching orders and keeps raw metadata. | Offer retry and preserve the last known list. |
| Cancellation | Resolve RePermit for the active wallet chain, call `cancel([metadata.repermitDigest])`, confirm the receipt, then refetch. | Order Sink eventually reports the terminal cancelled state. | Show the on-chain failure and leave the order open. |

Ready to launch when every row passes on each supported chain.

### End-to-End Acceptance Run

1. Resolve partner/chain configuration and select a strategy from [Strategy Recipes](/advanced-orders/direct#strategy-recipes). Fill `OrderInput` with real token metadata and validated raw amounts; example addresses and response objects are not executable fixtures.
2. Copy both [Create Order files](/advanced-orders/direct#create-order) together: `create-order-flow.ts` and `order-types.ts`. Set the host account and chain ID at the top of the file. Initialize the Viem clients there using the connected wallet provider, and pass the correct wrapped-native address to `submitOrdersSinkOrder`.
3. Call `submitOrdersSinkOrder({ orderInput, wTokenAddress })` from one guarded confirmation handler. Start with insufficient allowance; verify RePermit approval confirms before the EIP-712 prompt. Repeat with native input to verify wrapping occurs first.
4. Require HTTP and API success, retain the returned `signedOrder`, and show “Order submitted”. Fetch history using the same account, chain, and configured adapter; match the returned order hash. Acceptance alone is not a fill.
5. Select an open order from history and exercise [Cancel Order Sink Orders](/advanced-orders/direct#cancel-order-sink-orders). Use its `metadata.repermitDigest`, confirm the transaction, then refresh until history reflects the result.
6. Reject signing and simulate a lost create response. Verify the first case never submits, while the second reconciles history before another attempt. Test wrong-chain configuration and invalid strategy fields before enabling review.

Use an explicitly funded development wallet for the live run. Choose an amount meeting partner requirements and a strategy you understand: execution can spend funds before you cancel. A successful cancellation does not reverse prior fills.
