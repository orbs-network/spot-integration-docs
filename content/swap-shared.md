# Swap · Overview & Setup

Use **Orbs Spot** to quote and execute token swaps on the same chain. Spot also powers [Advanced Orders](/advanced-orders/shared), so both features share the SDK, partner configuration, token permissions, signing, and order service.

Read the product and setup requirements below, then follow the [TypeScript SDK guide](/swap). Your **host app** is the application you are adding Spot to; it supplies wallet access, tokens, balances, and the user interface.

## Product Overview

### What Is Swap?

A Spot swap exchanges a fixed input amount using a current quote. The user can enter an input amount or an output target; output-target quoting resolves the required fixed spend before review. The quote includes a protected minimum output: the least amount of the destination token the user agrees to receive. The user signs a short-lived order, the service accepts it, and the application tracks that order until the swap fills or reaches another outcome.

Use Spot as the swap source in a new application or add it to an existing DEX router's quote competition. When comparing routes, use their protected minimum outputs for the same inputs and keep the host's existing gas policy. A route without a usable quote does not enter execution.

Spot executes **fixed input with the signer as recipient**. `getQuote` accepts exactly one `inAmount` or `outAmount`; an output target returns its resolved input in `quote.request.inAmount` and target in `quote.requestedOutAmount`. Review and freeze that spend before wallet steps. The existing `isSwapSupported` router check still rejects `tradeType: "exact-output"`; alternate recipients remain unsupported.

### Example User Journey

A user enters 100 USDC to exchange for WETH. The host requests a Spot quote and any existing DEX quote, compares protected minima, and shows the selected route. If Spot is selected, the app prepares token permissions, requests an EIP-712 signature, and submits the signed order. It shows “Swap pending” after acceptance and “Swap complete” after the order fills.

### What You Build

The host keeps its amount input, token selector, wallet connection, quote cache, route selection, review, and progress UI. Spot provides quotes, signing payloads, submission, and individual status lookups. The host owns wrapping, approval, signing, receipt waiting, and settlement polling. You do not need another form or a React provider to add a router source.

Choose Swap for a trade from a current quote. Choose [Advanced Orders](/advanced-orders/shared) for a schedule or price condition. Both use `@orbs-network/spot-ui`; React applications can use the same public helpers through `@orbs-network/spot-react` and keep swaps in their existing form and wallet flow. Its advanced-order provider is covered separately.

## Supported Chains

Initialize the **selected partner and chain** with `await createClient(partner, chainId)`. The client loads and validates its protocol configuration. Available pairs and amounts still depend on the current quote.

Use the host's chain and token registry for RPC endpoints, explorer links, token decimals, and wrapped-native addresses. The Spot SDK does not supply a network registry. Keep wallet writes, reads, tokens, and client configuration on the same chain. Resolve missing partner activation with [Orbs support](https://t.me/dTWAPSupportGroup) before enabling submission.

## Integration Options

### Before You Start

| Requirement | Supplied by | Ready when |
| --- | --- | --- |
| Partner and chain | Host integration configuration | `createClient` successfully loads the actual partner/chain configuration. |
| Account, wallet, and RPC | Host wallet/network layer | The account can sign typed data and send/confirm transactions on that chain. |
| Tokens and decimals | Host token registry | Input, output, and wrapped-native addresses are known for the selected chain. |
| Balance and gas | Host balance layer | Input funds and gas cover any required wrapping and approval. |
| Current quote inputs | Host swap form | Pair, raw amount and direction, slippage, and quote-request user describe one current snapshot. |
| Recovery state | Host app/store | A submitted order can remain pending and be reconciled after transient UI closes. |

Use the application's existing wallet and signer. Protocol addresses come from the client configuration.

When starting without trading services, build only the missing wallet connection, verified chain/token registry, native and ERC-20 balances, quote lifecycle, and review/progress UI needed by the requested flow. `client.getQuote` can supply market quotes directly; another router or aggregator is unnecessary. Keep a real zero balance distinct from loading or failed reads, invalidate obsolete resources when account/chain/pair changes, and preserve native gas when deciding the maximum input. Token-list availability alone does not establish RPC, balance, quote, or price coverage.

### Amounts and Units

| Value | Representation |
| --- | --- |
| Typed amount | Decimal string, for example `"1.25"`. |
| Raw token amount | Integer base-unit string: `"1250000"` for 1.25 tokens with 6 decimals. |
| Quote `slippage` | Percentage: `0.5` means 0.5%; the SDK converts it to `50` integer basis points for the quote API and signed `witness.slippage`. |
| `minimumAmountOut` | Returned output-token base units; preserve unchanged. |
| `quote.receivedAt`, `prepared.values` timestamps, accepted `Order.deadline` | Unix milliseconds. |
| `prepared.order.deadline` | Protocol seconds in the signed payload. Preserve the SDK value unchanged. |
| Quote USD totals | Optional decimal strings for the complete quoted amount. |

Use the host's token-aware decimal parser and formatter instead of floating-point multiplication. These conversion helpers are not exported by the SDK. Input and output tokens may have different decimals. Slippage is already reflected in the returned minimum; do not apply it twice.

### Choose an Integration

| Path | Choose it when |
| --- | --- |
| [TypeScript SDK](/swap) | Add Spot to an existing quote/router flow or build a framework-neutral swap integration. No provider or calculated form is required. |
| React application | Import the same public client methods from `@orbs-network/spot-react` and follow the [TypeScript SDK guide](/swap). Swaps have no provider. |
| [Order API reference](/advanced-orders/direct) | Inspect the shared order configuration, signing, submission, lookup, and cancellation contracts. Swap quotes and preparation in this guide use the Spot SDK. |

The React package re-exports the core SDK helpers. Router-only React applications can use those helpers without mounting `AdvancedOrdersProvider` or installing a separate core package. That provider supports advanced orders only.

Use the installed version-matched skill at `node_modules/@orbs-network/spot-ui/dist/integration-skills/spot-swap-integration/SKILL.md` when available, and compare its adjacent `manifest.json.sdkVersion` with the installed package. React swaps follow the same swap skill; the two advanced-order skills cover separate form/provider workflows. Read documentation under `dist` without importing SDK code from private paths.

For an existing `@orbs-network/liquidity-hub-sdk` swap path, also follow the migration handoff at `node_modules/@orbs-network/spot-ui/dist/integration-skills/liquidity-hub-to-spot-swap-migration/SKILL.md`, using the same package-version check. React hosts resolve it through their core dependency. It covers replacing legacy allowances, signing, submission, and settlement together while preserving the host's resolved slippage, staged wallet actions, and recovery for pending legacy attempts. If that release lacks the bundle, use the [repository migration handoff](https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-to-spot-swap-migration) after checking its contracts against the installed release.

### Integration Resources

- [Spot TypeScript SDK and examples](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui)
- [Existing-router swap example](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/examples/router-swap.ts)
- [Quote and inline-signing example](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/examples/swap.ts)
- [Spot React SDK](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react)
- [Spot swap integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-swap-integration) — applies to TypeScript and React swaps without a provider.
- [Liquidity Hub to Spot migration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-to-spot-swap-migration) — for replacing an existing Liquidity Hub swap integration.
- [Example application](https://swap.orbs.network/?module=swap)

## How It Works

### Concepts

| Term | Meaning |
| --- | --- |
| Spot client | Validated protocol configuration and methods for one partner and chain. |
| Quote | Output amounts plus a frozen request identity; it is not a signing payload. |
| Protected minimum | `quote.minimumAmountOut`, preserved for review, comparison, and the signed order. |
| Configured spender | `client.spenderAddress`, the RePermit contract that receives the input-token allowance. |
| Prepared swap | An exact protocol order, EIP-712 signing request, approval metadata, and fresh timestamps. |
| Accepted intent | A submitted signed order that may still await a fill. |
| Settlement | Confirmation of completion or another order outcome using its ID, chain, and deadline. |

### Integration Lifecycle

1. Initialize and reuse the client for the selected partner and chain.
2. Request one quote for the full input or output target. Review the resolved fixed input; compare protected minima when another matching route is available.
3. Check allowance for `client.spenderAddress`, confirm host wrapping and approval when needed, then read allowance again.
4. Call `client.prepareSwap({ quote, account, signal })`, freeze the final quote in the review, and sign its unmodified `signingRequest.typedData` using `signerAddress`.
5. Submit the exact `prepared.order` and original signature with `client.submitSwap`. Retain the accepted order and poll `client.getOrder({ orderId, signal })` through the host's existing status service. Show success after `OrderStatus.Completed`.

The SDK reuses quotes within its default 20-second window or refreshes their resolved fixed input before signing, including for output targets. It never increases spending. A lower refreshed minimum requires another review. Swaps expire three minutes after final preparation, after wrapping and approval. The reviewed quote percentage sets signed `witness.slippage` in integer basis points, and the quoted minimum remains unchanged in signed `witness.output.limit`. The SDK owns quote and prepared-order validation; the host owns wallet actions, receipt confirmation, context checks, duplicate guards, and polling.

### Wallet Actions and Completion

| Stage | User action / transport | Required before continuing |
| --- | --- | --- |
| Fetch quote | HTTP, no wallet prompt | Current inputs and a validated quote. |
| Wrap native input, if needed | Wallet transaction | Successful receipt. |
| Approve configured spender, if needed | ERC-20 wallet transaction | Successful receipt and confirmed sufficient allowance. |
| Final preparation | SDK refresh and order construction | The reviewed minimum remains protected. |
| Sign | EIP-712 signature | Original signature and the exact matching order. |
| Submit | Order-service request | Retain the accepted order snapshot; acceptance is pending execution. |
| Track | Serial order lookups | `OrderStatus.Completed` before displaying swap success. |

The execution account signs and receives the output. A quote may use a disconnected preview account; pass the connected account separately as `account` to preparation. Keep your existing balance and account/chain handling, and disable duplicate confirmation while the swap is pending.

### Recovery State to Retain

Store confirmed transaction hashes, the prepared order, original signature, and accepted/latest order at app/store scope so recovery survives a dialog closing. `client.getOrder` makes one lookup using the client's captured chain and endpoint. A missing result can mean indexing is pending; keep tracking until a known terminal result or an explicit host timeout policy.

A submission timeout may occur after acceptance. Reconcile that intent before submitting again or using a DEX fallback. Stopping tracking does not cancel an order. Keep the app loading through settlement. Quote displays may update through wrapping and approval; freeze the final prepared quote before signing.

### Native Input

Quote the host's wrapped-native token when native currency is selected. The host wraps the full input and waits for a successful receipt, approves the configured spender if needed, then prepares the swap. The SDK does not wrap tokens or open wallet prompts.

## Fees and Configuration

### Fees

Use the executable amounts returned by the quote. `netAmountOut` is the net output and `minimumAmountOut` is its protected minimum; do not subtract slippage or a display fee again. Confirm partner fee terms with Orbs before showing a fixed rate. Wrapping and approval have separate network gas costs that belong in the host's review.

Quote USD totals are optional decimal strings for the complete amount. Standalone `getTokenUsd({ tokenAddress, chainId, signal })` returns USD per whole token from the default production price service. If the host needs automatic slippage policy, compute the total USD amount with its decimal library and pass it to synchronous `getSwapSlippage({ amountUsd, slippage })`. Custom mode selects its percentage directly. Use the effective percentage for both display and quote requests. See [USD prices and slippage](/swap#fetch-quote). Router integrations can reuse their resolved auto/custom slippage and keep their existing trade and gas policy.

### Partner Configuration

Use your existing partner's `Partners` enum member, or `Partners.External` where available. `await createClient(partner, chainId)` resolves the spender, signing data, and adapter for that pair.

The SDK uses order-sink v2 for quotes and signed orders. Client configuration, quoting, submission, and lookups use the captured service; URL query parameters in your page do not select another backend.

Continue with the [TypeScript SDK](/swap) for swaps in any framework, including React. Use the [React advanced-order guide](/advanced-orders/react) for provider-managed TWAP, limit, stop-loss, and take-profit forms.
