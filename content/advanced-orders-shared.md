# Advanced Orders · Shared Reference

Shared details for API Only, TypeScript SDK, React SDK, and MCP Skill integrations of the Spot protocol.

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

Choose Advanced Orders when execution depends on time or price conditions. Choose [Swap](/liquidity-hub/shared#product-overview) when the user wants to exchange tokens from a current quote.

## Supported Chains

These 19 networks are listed in the [Spot configuration](https://github.com/orbs-network/spot/blob/master/config.json), checked on September 9, 2026. The numeric top-level keys identify chains; the `"*"` entry contains shared defaults and is not a network.

| Chain ID | Network |
| --- | --- |
| `1` | Ethereum |
| `10` | Optimism |
| `14` | Flare |
| `56` | BNB Chain |
| `130` | Unichain |
| `137` | Polygon |
| `143` | Monad |
| `146` | Sonic |
| `196` | X Layer |
| `999` | HyperEVM |
| `1329` | Sei |
| `4326` | MegaETH |
| `4663` | Robinhood Chain |
| `8453` | Base |
| `42161` | Arbitrum |
| `43114` | Avalanche |
| `59144` | Linea |
| `80094` | Berachain |
| `747474` | Katana |

Protocol coverage and partner availability are separate. Confirm the selected partner supports the connected chain before enabling order creation. SDK integrations use `getPartnerChains(partner)` and the initialized client; API-only integrations validate the partner-and-chain configuration response. Do not substitute another chain when the selected one is unsupported.

This is a documentation snapshot. Check the linked configuration for updates before enabling a new network.

### Development and Test Networks

The networks listed above are mainnets. These guides do not provide a verified testnet deployment. Before testing on another network, ask [Orbs integration support](https://t.me/dTWAPSupportGroup) for its availability and configuration. Use mocked HTTP and wallet responses for local UI and error-path tests; a live acceptance run on a listed network uses real tokens and gas.

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

No private key belongs in frontend configuration. The host wallet supplies signing and transaction access. See [Fees and Configuration](/advanced-orders/shared#fees-and-configuration) for partner and fee setup.

### Amounts and Units

| Value | Representation |
| --- | --- |
| Human input | Decimal string, for example `"1.25"`. |
| Raw token amount | Integer string in that token's base units: `"1250000"` for 1.25 tokens with 6 decimals. |
| SDK form timestamps/delays named `*Millis` | Milliseconds; use the SDK's preparation/conversion. |
| API-only signed schedule | Follow the strategy recipe's seconds conversion; do not send a millisecond timestamp as seconds. |
| API-only `slippageBps` | Basis points: `50` means 0.5%. This differs from Swap's percentage-valued `slippage`. |
| USD price inputs | Price of one whole token, not the price of one base unit. |

`priceProtectionPercent` uses percentage units in both SDKs: `0.5` means 0.5%. The SDK converts it to `slippageBps = priceProtectionPercent × 100`, which becomes signed `witness.slippage`; `0.5` therefore becomes `50`. Do not multiply an already-converted basis-point value again.

Use token-aware decimal parsing and integer arithmetic for protocol amounts. Do not assume input and output tokens share decimals. Example amounts illustrate units only; verify their USD value before submission.

### Minimum Trade Size

Set `minTradeSizeUsd` to any value of **10 or higher** in `calculateOrderForm()` or `SpotProvider`. The value is the minimum amount in USD for each individual trade: `10` sets a $10 minimum, while `25` sets a $25 minimum. There is no implicit default. For TWAP, this applies to each smaller trade, not the total order. For example, 10 trades with `minTradeSizeUsd` set to `25` require at least $250 of total input at the price used for validation.

### Choose an Integration

| Method | Choose it when |
| --- | --- |
| [API Only](/advanced-orders/direct) | An Orbs package cannot run in the target environment, or the host needs full ownership of HTTP and EIP-712 construction. The host calculates and validates strategy, amount, schedule, trigger, limit, nonce, and deadline fields. |
| [TypeScript SDK](/advanced-orders/typescript) | The host needs framework-neutral calculation and protocol operations while retaining its state and UI. Works with Vue, Angular, Svelte, vanilla TypeScript, and server-side TypeScript. |
| [React SDK](/advanced-orders/react) | A React application wants provider-scoped forms, execution, history, and cancellation hooks. Uses the TypeScript SDK internally. |
| [MCP Skill](https://github.com/orbs-network/spot/tree/master/skill) | An agent needs the published Spot skill and MCP integration resources. |

Prefer an SDK when possible: the TypeScript SDK provides framework-neutral control, while the React SDK also manages provider-scoped application state.

### Integration Resources


#### Try the Product

- [Playground](https://spot-app.orbs.com/?tab=twap)
- [Interactive Example](https://spot-app.orbs.com/?tab=twap&devMode=true)

#### API Only

- [Direct integration reference](https://github.com/orbs-network/spot-integration-docs)

#### TypeScript SDK

- [TypeScript SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui)
- [TypeScript SDK API](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/README.md)
- [Spot TypeScript integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-integration)

#### React SDK

- [React SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react)
- [Spot React integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-react-integration)
- [React SDK example: SpotProvider setup](https://github.com/orbs-network/spot-ui/blob/master/apps/web/components/spot/spot-form.tsx)
- [Orbs Spot example application](https://github.com/orbs-network/orbs-spot) — additional application example.
- [Swap UI execution helper](https://www.npmjs.com/package/@orbs-network/swap-ui)

#### Agents and Protocol Configuration

- [MCP Skill](https://github.com/orbs-network/spot/tree/master/skill)
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
| Calculated form | The synchronous result of `calculateOrderForm()`. It is the single source for display values, protocol values, validation, and submission readiness. |
| Spot client | A partner- and chain-scoped client returned by `createClient()`. It owns configuration-dependent preparation, signing, submission, history, and cancellation requests. |
| Prepared order | The order, EIP-712 signing request, approval request, calculated form snapshot, and fresh execution timestamps returned by `client.prepareOrder()`. |
| Host adapter | Application code that maps the existing market, state, wallet, and transaction layers to SDK inputs. |

### Integration Lifecycle

1. Resolve trusted configuration for the selected partner and connected chain.
2. Prepare the ERC-20 input funds, including wrapping native input and approving RePermit when required.
3. Build one order attempt, sign its EIP-712 payload, and submit the same signed order to Order Sink.
4. Fetch order history for the swapper, chain, and partner.
5. To cancel, submit the on-chain cancellation transaction, confirm its receipt, and refresh history.

The host owns wallet access and transaction confirmation. API-only integrations construct protocol fields directly; the SDKs provide preparation, submission, history, and cancellation requests. React adds provider-scoped state and execution handling.

Across SDK integrations, the host owns controls, market data, quote freshness, wallet transactions, translations, and modal presentation. The SDK owns form defaults and validation, trusted partner configuration, order construction, submission, normalized history, and version-aware cancellation requests. The TypeScript host manages client caching and polling; React manages the provider-scoped client and mounted history queries.

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
| React SDK | Configure `SpotProvider` with the partner and current chain; partner or chain changes re-key the configured client. |
| MCP Skill | Follow the [published skill](https://github.com/orbs-network/spot/tree/master/skill) for its configuration workflow. |

Continue with [API Only](/advanced-orders/direct), [TypeScript SDK](/advanced-orders/typescript), or [React SDK](/advanced-orders/react) for method-specific implementation details.
