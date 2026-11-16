# Advanced Orders · Overview & Setup

Start here if you are new to Advanced Orders. This page explains the product and the app data you need before writing integration code.

1. Read **Product Overview** to confirm this is the behavior you need.
2. Work through the setup requirements in this guide. Here, **host app** means the application you are adding Orbs to.
3. Choose one implementation guide: [React SDK](/advanced-orders/react) for React apps, [TypeScript SDK](/advanced-orders/typescript) for other JavaScript/TypeScript apps, or [API Only](/advanced-orders/direct) when you need to construct protocol requests yourself. You do not need to complete every method.

Keep this page available for chain, amount-unit, fee, and lifecycle details as you build.

## Product Overview

### What Are Advanced Orders?

Advanced Orders lets users define **when and under what conditions tokens should be exchanged**, using the Orbs Spot protocol. Instead of executing a swap from a current quote, a user signs an order with a schedule or price condition. The order is submitted to the Order Sink service and can fill as its execution conditions are met. A fill is an executed trade that spends some or all of the order's input tokens.

Use this product to add scheduled trades and conditional orders to a DEX or trading application. The API Only, TypeScript SDK, and React SDK integrations expose the same product with different levels of help for order calculation, submission, and application state.

### Order Types

| Type | What it does | Example user intent |
| --- | --- | --- |
| TWAP (time-weighted average price) | Splits a total amount into smaller trades spaced over time, spreading execution across multiple fills. An optional limit can require a minimum output per fill. | “Exchange 1,000 USDC for WETH in 10 trades of 100 USDC, spaced 10 minutes apart.” |
| Limit | Waits until the input can be exchanged for at least the user-specified minimum output before the order expires. | “Exchange 1 WETH only if I can receive at least 3,000 USDC.” |
| Stop Loss | Makes an order eligible when the lower price trigger is reached. The order can use market execution or a separate minimum output after triggering. | “Trigger a sale of my WETH if its price falls to my lower threshold.” |
| Take Profit | Makes an order eligible when the upper price trigger is reached. The order can use market execution or a separate minimum output after triggering. | “Trigger a sale of my WETH if its price rises to my target.” |

These examples explain behavior, not recommended trading settings. A trigger makes an order eligible for execution; it does not guarantee a fill at the trigger price. Available liquidity, the order's execution constraints, and its deadline still matter. TWAP fills may execute at different prices, and an order can remain partially filled or unfilled.

### Example User Journey

A user selects TWAP, chooses a token pair, and sets the total amount, number of trades, interval, and deadline. Your app previews the schedule, prepares token permissions, and asks the user to sign the order. Once the service accepts it, show “Order submitted.” Track individual fills and remaining progress in order history, and let the user cancel future execution. Cancellation does not undo completed fills.

### What You Build

Your application provides the strategy controls, token and price data, wallet connection, order review, history, and cancellation interface. The protocol and order service handle the signed order lifecycle; the SDKs help prepare orders and access that lifecycle. A successful submission is the beginning of tracking, not proof that the trade has completed.

Choose Advanced Orders when execution depends on time or price conditions. Choose [Swap](/swap/shared) when the user wants to exchange tokens from a current quote. Both use Orbs Spot: the same TypeScript client provides quote access, swap preparation, advanced-order submission, history, and cancellation. React advanced orders use `AdvancedOrdersProvider`; swaps use the client directly in the host's existing wallet flow.

## Supported Chains

Availability is specific to the selected partner and connected chain. Initialize `createClient(partner, chainId)` and require its configuration to resolve before enabling submission. In React, `AdvancedOrdersProvider` performs this initialization and exposes failures through `useClient()` and `errorFallback`. API-only integrations validate the partner-and-chain configuration response described in [Fetch Config](/advanced-orders/direct#fetch-config).

The SDK has no network registry. The host supplies chain labels, RPC endpoints, explorers, token metadata, and the wrapped-native token. Keep the selected chain when configuration is unavailable and show the configuration error; do not substitute a different chain or partner.

## Integration Options

### Before You Start

| Requirement | Supplied by | Ready when |
| --- | --- | --- |
| Partner | Your existing DEX partner ID, or `"external"` / `Partners.External` | Partner configuration is available for the connected chain. |
| RPC, chain, account | Host wallet/network layer | Reads, writes, signer, and configured client use the same chain and account. |
| Tokens and wrapped-native token | Host token registry | Addresses and decimals are correct for that chain. |
| Input balance and gas | Host balance layer / connected wallet | The full input is available, with gas for wrapping, approval, and later cancellation. |
| Market data | Host quote and price layers | Quote output describes the complete current input amount and pair; stale values are excluded. |
| Strategy and validation | Host form; SDK calculation where used | Amount, schedule, limit, trigger, and deadline pass the chosen strategy's validation. |
| Protocol addresses and fee reference | Trusted partner configuration / SDK | RePermit, reactor, and exchange adapter are resolved rather than guessed. |
| History UI | Host application | The user can find a submitted order, inspect progress, and request cancellation. |

No private key belongs in frontend configuration. The host wallet supplies signing and transaction access. Use your existing DEX partner ID, or `"external"` / `Partners.External`, and obtain protocol addresses from its configuration. Fee estimates shown in your UI must follow the agreed partner terms; they do not change the signed execution amounts.

If the application has no trading services, build the missing host layer for the requested order types: wallet connection, a verified chain/token registry, raw balances, current quotes and one-token USD prices, and review/progress controls. An existing router is unnecessary; `client.getQuote` can supply the market quote, with its current `netAmountOut` mapped to the advanced form's `quotedOutputAmountRaw`. Keep loading/failed balances unavailable rather than displaying a fabricated zero. Preserve native gas and normalize native input to the chain's verified wrapped token. Reuse the existing app's framework, wallet, state, and numeric libraries.

Verify the actual host RPC/proxy chain, native and ERC-20 catalog entries, balance reads, price coverage, and quote invalidation independently. Successful protocol initialization or a loaded token list alone does not establish host chain support. If configuration remains unavailable, finish independent host work, keep submission unavailable, and provide [Orbs support](https://t.me/dTWAPSupportGroup) with a sanitized draft containing the partner, chain, package version, and read-only error code/status. Never substitute another partner or hard-code protocol addresses.

### Amounts and Units

| Value | Representation |
| --- | --- |
| Human input | Decimal string, for example `"1.25"`. |
| Raw token amount | Integer string in that token's base units: `"1250000"` for 1.25 tokens with 6 decimals. |
| SDK form timestamps/delays named `*Millis` | Milliseconds; use the SDK's preparation/conversion. |
| API-only signed schedule | Follow the strategy recipe's seconds conversion; do not send a millisecond timestamp as seconds. |
| API-only `slippageBps` | Basis points: `50` means 0.5%. This differs from Swap's percentage-valued `slippage`. |
| USD price inputs | Price of one whole token, not the price of one base unit. |

`priceProtectionPercent` must be finite and between 0 and 50 inclusive in both SDKs. It uses percentage units: `0.5` means 0.5%. The SDK converts it to `slippageBps = priceProtectionPercent × 100`, which becomes signed `witness.slippage`; `0.5` therefore becomes `50`. Do not multiply an already-converted basis-point value again.

Use token-aware decimal parsing and integer arithmetic for protocol amounts. Do not assume input and output tokens share decimals. Example amounts illustrate units only; verify their USD value before submission.

### Minimum Trade Size

Set a finite positive `minTradeSizeUsd` in `calculateOrder()` or `AdvancedOrdersProvider` according to your host application's minimum-trade policy. The value is the minimum amount in USD for each individual trade: `10` sets a $10 minimum, while `25` sets a $25 minimum. There is no implicit default. For TWAP, this applies to each smaller trade, not the total order. For example, 10 trades with `minTradeSizeUsd` set to `25` require at least $250 of total input at the price used for validation.

### Choose an Integration

| Method | Choose it when |
| --- | --- |
| [API Only](/advanced-orders/direct) | An Orbs package cannot run in the target environment, or the host needs full ownership of HTTP and EIP-712 construction. The host calculates and validates strategy, amount, schedule, trigger, limit, nonce, and deadline fields. |
| [TypeScript SDK](/advanced-orders/typescript) | The host needs framework-neutral calculation and protocol operations while retaining its state and UI. Works with Vue, Angular, Svelte, vanilla TypeScript, and server-side TypeScript. |
| [React SDK](/advanced-orders/react) | A React application wants provider-scoped forms, execution, history, and cancellation hooks. Uses the TypeScript SDK internally. |

Prefer an SDK when possible: the TypeScript SDK provides framework-neutral control, while the React SDK also manages provider-scoped application state.

For coding agents, choose the skill matching the requested surface:

| Surface | Version-matched installed skill |
| --- | --- |
| [Swaps](/swap), including React without a provider | `node_modules/@orbs-network/spot-ui/dist/integration-skills/spot-swap-integration/SKILL.md` |
| Advanced Orders TypeScript | `node_modules/@orbs-network/spot-ui/dist/integration-skills/spot-advanced-orders-integration/SKILL.md` |
| Advanced Orders React provider/hooks | `node_modules/@orbs-network/spot-react/dist/integration-skills/spot-advanced-orders-react-integration/SKILL.md` |

Check each skill's adjacent `manifest.json.sdkVersion` against the installed package and read only the references needed for the request. If an older release has no bundle, use a matching release or checkout of the repository skill. Documentation under `dist` may be read; SDK code imports use the public package root. Preserve compatible installed versions and add only requested order types and history surfaces.

### Integration Resources


#### Try the Product

- [Developer link](https://swap.orbs.network/dev?tab=twap) — uses the Advanced Orders TypeScript SDK.
- [Spot App source on GitHub](https://github.com/orbs-network/orbs-spot)

#### API Only

- [Direct integration reference](https://github.com/orbs-network/spot-integration-docs)

#### TypeScript SDK

- [Spot App example application](https://swap.orbs.network/dev?tab=twap) — [source on GitHub](https://github.com/orbs-network/orbs-spot).
- [TypeScript SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui)
- [TypeScript SDK API](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/README.md)
- [Spot Advanced Orders TypeScript integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-advanced-orders-integration)

#### React SDK

- [React SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react)
- [Spot Advanced Orders React integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-advanced-orders-react-integration)
- [React SDK example: AdvancedOrdersProvider setup](https://github.com/orbs-network/spot-ui/blob/master/apps/web/components/spot/spot-form.tsx)
- [Spot UI React SDK example application](https://github.com/orbs-network/spot-ui)
- [Swap UI execution helper](https://www.npmjs.com/package/@orbs-network/swap-ui)

#### Protocol Configuration

- [Protocol configuration](https://github.com/orbs-network/spot/blob/master/config.json)

## How It Works

### Concepts


#### Protocol Concepts

| Term | Meaning |
| --- | --- |
| Order Sink | Off-chain service that accepts signed RePermit orders and exposes them through the orders API. |
| RePermit | On-chain contract used for token authorization and cancellation. Users approve this contract to spend the source token. |
| Reactor | Contract encoded as the signed permit `spender`. It is part of the signed order and is not the ERC-20 allowance spender. |
| Swapper | User address that owns the order. This must be the EIP-712 signer and is stored at `order.witness.swapper`. |
| RePermit digest | Order cancellation digest returned by Order Sink as `metadata.repermitDigest`. This is passed to the RePermit `cancel(bytes32[])` function. |


#### SDK Concepts

The TypeScript and React SDKs share the same form calculation and configured client. Previews and submitted orders use the same defaults, validation rules, prices, schedules, and execution values.

| Term | Meaning |
| --- | --- |
| Order type / variant | `OrderType` selects `TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`. `OrderVariant` identifies the detailed protocol mode in `form.values.orderVariant` and history `order.type`. |
| Calculated form | The synchronous result of `calculateOrder()` for those four advanced types. It is the single source for display values, protocol values, validation, and submission readiness. `calculateOrderForm()` remains a compatibility alias. |
| Spot client | A partner- and chain-scoped client returned by `createClient()`. It provides `getQuote()`, configuration-dependent preparation, signing requests, submission, history, and cancellation requests. |
| Prepared order | The order, EIP-712 signing request, approval request, calculated form snapshot, and fresh execution timestamps returned by `client.prepareOrder()`. |
| Host adapter | Application code that maps the existing market, state, wallet, and transaction layers to SDK inputs. |

### Integration Lifecycle

1. Resolve trusted configuration for the selected partner and connected chain.
2. Prepare the ERC-20 input funds, including wrapping native input and approving RePermit when required.
3. Build one order attempt, sign its EIP-712 payload, and submit the same signed order to Order Sink.
4. Fetch order history for the swapper and chain, always sending the partner ID as `exchange`, not `partner`, in the HTTP query.
5. To cancel, submit the on-chain cancellation transaction, confirm its receipt, and refresh history.

The host owns wallet access and transaction confirmation. API-only integrations construct protocol fields directly; the SDKs provide preparation, submission, history, and cancellation requests. React adds provider-scoped state and execution handling.

Across SDK integrations, the host owns controls, market data, quote freshness, wallet transactions, translations, and modal presentation. The SDK owns form defaults and validation, trusted partner configuration, order construction, submission, normalized history, and version-aware cancellation requests. The TypeScript host manages client caching and polling; React manages the provider-scoped client and mounted history queries. Configured history uses `client.getOrders({ account })` and returns `{ orders, legacyLoaded }`; omitting `account` includes all wallets for that partner and chain.

### Test the EIP-712 Payload Before Signing

During integration, use the [EIP-712 Order Preview](https://playground.orbs.network/developers/eip712) to inspect an order before requesting a wallet signature. Paste the unsigned typed-data JSON, including `domain`, `types`, `primaryType`, and `message`, then select **Preview order**. Check what the order sells, what it receives, and when it can execute against the intended form values. You can also select **Load example** to try the preview first.

Open **Technical details** to inspect the underlying fields and checks for typed-data structure, slippage range, agreement between the permit and order, order timing, and input amounts. Pasting JSON alone does not compare the payload against your app's order form or SDK configuration; the preview indicates when that comparison context is missing.

The preview reads order values in your browser; it does not sign, place, or change an order. Use it to check the payload your integration builds before continuing with the normal signing and submission flow.

### Wallet Actions and Completion

| Stage | User action / transport | Completion signal |
| --- | --- | --- |
| Configuration and preview | HTTP / local calculation | Partner-chain configuration and current form are valid. |
| Wrap, if needed | On-chain wallet transaction | Successful receipt for the full required input. |
| Approve RePermit, if needed | On-chain ERC-20 transaction | Successful receipt and sufficient allowance to RePermit, not the reactor. |
| Sign prepared order | EIP-712 wallet signature | Exact prepared message and original signature are retained together. |
| Submit order | Order Sink HTTP request | Service acceptance means “Order submitted”; it does not mean the order has filled. |
| Track execution | History queries | Render actual fills and current order state from history. |
| Cancel | On-chain wallet transaction, then history refresh | Confirm the cancellation receipt; show that history is refreshing until it reflects the result. |

Do not show “Trade complete” when order creation succeeds. Scheduled and conditional orders may remain unfilled. A cancellation request is not complete when the wallet returns a hash, and fills already executed are not undone by cancellation.

### Errors and Recovery

| Situation | Host behavior |
| --- | --- |
| Unsupported partner/chain or invalid configuration | Block preparation and show the configuration problem; do not substitute another network. |
| Missing balance, price, quote, or invalid strategy | Identify the unavailable/invalid input and keep submission disabled. |
| User rejects a wallet prompt | Stop that attempt, retain editable form values, and let the user explicitly retry. |
| Wrap or approval reverts | Stop before signing; identify the failed transaction. Re-read balances and allowance on retry. |
| Account or chain changes before submission | Invalidate the attempt and recalculate/reprepare for the new context. Do not reuse its signature. |
| Submission response is lost or times out | Treat acceptance as unknown. Check recent history for the original account, chain, and order before creating a new attempt. Do not automatically generate another nonce and submit again. |
| Accepted order has no fills yet | Show its actual pending/open state and strategy conditions; do not promise an execution time. |
| Cancellation receipt succeeds but history lags | Preserve the hash, show confirmation plus pending history refresh, and retry reads without sending another cancellation. |

Retain the original account, chain, returned order identity, and any transaction hashes for reconciliation. API-only integrations also retain the returned cancellation metadata; SDK integrations retain the normalized order. Do not put signatures or full signed payloads into routine analytics logs.

### Input Tokens

Signed orders spend ERC-20 tokens only. Never use a native-token placeholder in the signed order. The host supplies the connected chain's wrapped-native token and prepares the full input amount before approval and signing.

| Integration | Native input handling |
| --- | --- |
| API Only / TypeScript SDK | Wrap the full input amount, confirm the receipt, then approve and prepare the order using the wrapped ERC-20 address. |
| React SDK | `inputToken` may be the selected native asset. Supply `wrappedNativeToken`; the execution flow wraps when needed and uses the wrapped ERC-20 for approval and signing. |

## Fees and Configuration

If your DEX already has a partner ID, use it. Otherwise, use `"external"`; you do not need to request a partner ID to start integrating. In the TypeScript and React SDKs, use the matching `Partners` enum member for your DEX, or `Partners.External` if you do not have a partner ID.


### Fees

Fee configuration is shared across integration methods. The [Spot configuration](https://github.com/orbs-network/spot/blob/master/config.json) contains fee contract addresses; these addresses are not fee percentages. The integration documentation does not establish a universal rate. Confirm applicable terms with Orbs for the selected partner and chain.

| Detail | How to handle it |
| --- | --- |
| Fee reference | Preserve the fee reference supplied by the trusted partner configuration and signed order template. Do not hardcode or replace it. |
| `displayFeePercent` | Optional estimate for the TypeScript and React form layers. It does not collect or subtract a fee. |
| `form.fees` | Display estimate exposed as `raw`, `ui`, `usd`, and `percentage`. Do not treat it as the source of the protocol's fee configuration. |
| Wallet gas | Wrapping, approval, and on-chain cancellation incur network transaction costs separately from a displayed order fee. |

A missing display estimate does not establish that an order has no fees. Show estimates consistently with the partner's confirmed terms.

### Partner Configuration

For API requests, use your existing DEX partner ID, or `"external"` if you do not have one. In the TypeScript and React SDKs, use the matching `Partners` enum member, or `Partners.External`. You do not need to request a new partner ID. Never infer the identifier from a DEX name, hostname, or chain.

| Integration | Configuration |
| --- | --- |
| API Only | Fetch `GET https://order-sink-v2.orbs.network/config?partner={partner}&chain={chainId}`. Preserve the returned domain, types, protocol addresses, adapter, and fee reference. |
| TypeScript SDK | Initialize `createClient(partner, chainId)` and reuse the client for that partner and chain. |
| React SDK | Configure `AdvancedOrdersProvider` with the partner and current chain; partner or chain changes re-key the configured client. |

Continue with [API Only](/advanced-orders/direct), [TypeScript SDK](/advanced-orders/typescript), or [React SDK](/advanced-orders/react) for method-specific implementation details.
