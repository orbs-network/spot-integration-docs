# Swap · Overview & Setup

Start here if you are new to Swap. This page explains the product and the app data you need before writing integration code.

1. Read **Product Overview** to confirm this is the behavior you need.
2. Work through the setup requirements in this guide. Here, **host app** means the application you are adding Orbs to.
3. Choose one implementation guide: [TypeScript SDK](/liquidity-hub) for JavaScript/TypeScript apps (including React), or [Direct API](/liquidity-hub/direct) when you need to implement the HTTP flow yourself. You do not need to complete every method.

Keep this page available for chain, amount-unit, fee, and lifecycle details as you build.

## Product Overview

### What Is Swap?

Swap lets a user exchange one token for another on the same blockchain using a current quote. It is powered by **Orbs Liquidity Hub**, a service that requests quotes from on-chain and off-chain liquidity providers, called solvers, and coordinates execution of the selected quote.

Use it to add swaps to an application or improve routing in an existing decentralized exchange (DEX). When the application already has a DEX router, request both quotes and select the route with the higher protected minimum output: the least amount of the destination token the user agrees to receive. Keep the existing DEX route available when Liquidity Hub has no usable quote or does not improve that minimum.

### Example User Journey

A user wants to exchange 100 USDC for WETH. Your app requests a Liquidity Hub quote and, if available, its existing DEX quote for the same inputs. It compares their protected minimum outputs, shows the selected route for review, and asks the user to authorize the swap. Show success after confirming the on-chain transaction receipt.

### What You Build

Your application provides the token and amount inputs, wallet connection, quote display, route selection, and transaction status. Liquidity Hub provides the quote and signed-swap submission service. The TypeScript SDK and Direct API are two ways to integrate this same product; neither requires replacing your application's interface.

Choose Swap for a trade the user wants to execute from a current quote. Choose [Advanced Orders](/advanced-orders/shared) when the user wants to split a trade over time or wait for a price condition.

## Supported Chains

Network reference: [Liquidity Hub chain routing](https://github.com/orbs-network/spot-ui/blob/master/packages/liquidity-hub-ui/src/lib/util.ts), checked September 15, 2026. Confirm current deployment availability with Orbs before enabling a chain. Use these networks for Swap integrations through the TypeScript SDK or Direct API.

| Chain ID | Network |
| --- | --- |
| `1` | Ethereum |
| `56` | BNB Chain |
| `137` | Polygon |
| `146` | Sonic |
| `250` | Fantom |
| `1101` | Polygon zkEVM |
| `8453` | Base |
| `42161` | Arbitrum |
| `59144` | Linea |
| `81457` | Blast |


Before enabling a network, provide its wrapped-native-token address and wallet/RPC support for sending and confirming transactions. Both integration methods use the active chain ID; a listed network does not guarantee a quote for every token pair or amount.

## Integration Options

### Before You Start

Collect these values before wiring either integration. Contract and token addresses must belong to the selected chain.

| Requirement | Supplied by | Ready when |
| --- | --- | --- |
| Partner identifier | Your existing DEX partner ID, or `"external"` | The same value is used for quotes and execution. |
| Chain and RPC | Host wallet/network configuration | Wallet writes and RPC reads target the same supported chain. |
| Token addresses and decimals | Host token registry | Both tokens resolve on that chain; the wrapped-native address is known. |
| Account and wallet | Host wallet connection | The account can send transactions and sign EIP-712 typed data. Never put a private key in frontend configuration. |
| Spendable balance and gas | Connected wallet | The account can fund the input amount and any wrap/approval transactions. |
| Current quote inputs | Host swap form and quote layer | Account, chain, pair, amount, and slippage describe the same form snapshot. |
| Fee presentation | Partner terms agreed with Orbs | Display agreed partner fees and preparation gas costs; do not invent a fixed rate or change the quote’s signed amounts. |

### Amounts and Units

Send token amounts as integer base-unit strings. For a token with 6 decimals, `"1.25"` in the form becomes `"1250000"` in the request; for 18 decimals it becomes `"1250000000000000000"`. Use token-aware decimal parsing rather than JavaScript floating-point multiplication. Format output amounts using the output token's decimals, which may differ from the input token's.

Swap quote `slippage` uses percentage units: `0.5` means 0.5%. Compare both routes in output-token base units. Example amounts here demonstrate encoding; they do not establish a minimum trade size or guarantee liquidity.

### Choose an Integration

Swap uses Liquidity Hub to improve an existing DEX quote with on-chain and off-chain solver liquidity. The host selects the route before execution.

| Method | Choose it when |
| --- | --- |
| [TypeScript SDK](/liquidity-hub) | The application can run JavaScript or TypeScript. The framework-neutral client manages quotes, submission, and polling; React is optional. |
| [Direct API](/liquidity-hub/direct) | The SDK cannot run in the target environment, or the host needs full ownership of HTTP requests, signing, polling, and recovery. |

### Integration Resources

- [Playground](https://swap.orbs.com/)
- [Interactive Example](https://swap.orbs.com/?devMode=true)
- [Liquidity Hub Integration Skill](https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-integration) — implementation workflow and package guardrails for coding agents.
- [Liquidity Hub SDK and examples](https://github.com/orbs-network/spot-ui/tree/master/packages/liquidity-hub-ui)
- [React example application](https://github.com/orbs-network/spot-ui/blob/master/apps/web/components/best-trade-form.tsx)
- [Orbs Spot example application](https://github.com/orbs-network/orbs-spot) — additional application example.
- [Quote request implementation](https://github.com/orbs-network/spot-ui/blob/master/packages/liquidity-hub-ui/src/lib/quote.ts)
- [Swap submission and polling implementation](https://github.com/orbs-network/spot-ui/blob/master/packages/liquidity-hub-ui/src/lib/swap.ts)

## How It Works

### Concepts

| Term | Meaning |
| --- | --- |
| Liquidity Hub | Orbs optimization layer that requests liquidity from on-chain and off-chain solvers. It is used only when it improves the user's executable result. |
| Permit2 | Token permission contract that receives ERC-20 allowance for Liquidity Hub swaps. The current address is `0x000000000022D473030F116dDEE9F6B43aC78BA3`. |
| Quote signing data | `quote.eip712` is the wallet-ready typed-data payload. Pass its domain, types, primary type, and message unchanged to the wallet signer. |
| Partner | Use your existing DEX partner ID, or `"external"` if you do not have one. |
| Session ID | Quote session identifier returned by Liquidity Hub and carried through swap submission and status polling. |
| Liquidity Hub API | Chain-aware quote and execution service used by the SDK and Direct API. Requests include the active `chainId`. |
| Protected output | `minAmountOut`, an integer in output-token base units used to compare protected minimums across routes. |
| Signed quote | The complete quote plus a wallet signature over its EIP-712 data. Do not edit quote fields after signing. |

### Integration Lifecycle

1. Configure the active chain and partner using the SDK client or API origin.
2. Request a quote during the existing DEX quote cycle.
3. When running alongside a DEX router, compare protected minimum output and select the better route.
4. Wrap native input when required, then approve Permit2 for the ERC-20 source token.
5. Refresh a stale selected quote, sign its unchanged `eip712` payload, and submit the signed quote. Resolve a transaction hash through submission or status polling.
6. Confirm a successful on-chain receipt before reporting completion.

The host owns wallet access, route selection, and receipt confirmation. The SDK manages transport and polling; Direct API integrations implement those operations themselves.

### Wallet Actions and Completion

| Stage | User action / transport | What must happen before continuing |
| --- | --- | --- |
| Fetch quote | HTTP; no wallet prompt | A current, validated quote is selected. |
| Wrap native input, if needed | On-chain wallet transaction | The wrapping receipt succeeds. |
| Approve Permit2, if needed | On-chain ERC-20 transaction | The approval receipt succeeds and allowance covers the input. |
| Sign quote | EIP-712 wallet signature | Keep the exact quote that was signed. A signature alone does not execute the swap. |
| Submit and locate transaction | Service request; SDK handles transport/polling when used | Retain the session ID and resulting transaction hash. |
| Confirm swap | RPC receipt lookup | Receipt status is successful before showing “Swap complete”. |

The host must disable repeated confirmation clicks, stop using stale quotes when inputs change, and handle wallet rejection at each prompt. Keep the account and chain fixed for one attempt; if either changes before signing or submission, stop and obtain a fresh quote. After submission, reconcile against the original chain and account.

### Recovery State to Retain

Keep the original account, chain, session ID, and any known transaction hash available while the operation is unresolved. A status timeout is not proof that no swap occurred. Resume status/receipt checks before offering another execution. Do not automatically submit a DEX fallback after a potentially accepted Swap submission. Keep signed payloads out of ordinary analytics and error logs.

### Input Tokens

Quotes and execution use an ERC-20 input address. When the user selects native currency, request a quote for the chain's wrapped-native token and wrap funds before signing. The host supplies the wrapped-native address and confirms wrapping and approval receipts.

## Fees and Configuration

If your DEX already has a partner ID, use it. Otherwise, use `"external"`; you do not need to request a partner ID to start integrating.


### Fees

The existing Swap documentation does not specify a universal fee percentage. Confirm the applicable fee terms with Orbs for your partner configuration before displaying a fixed rate.

Use the executable amounts returned in the quote. When comparing Swap with a host DEX route, compare `quote.minAmountOut` with the DEX's protected minimum for the same input, chain, and slippage. Do not adjust the quote's signed amounts using a separate display estimate.

Wrapping and ERC-20 approval are wallet transactions. Account for their network gas costs separately from any swap fee when showing the transaction review.

### Partner Configuration

Use your existing DEX partner ID, or `"external"` if you do not have one. Keep the partner and active chain consistent across quotes and execution.

| Integration | Configuration |
| --- | --- |
| TypeScript SDK | Create one client for the active chain and reuse it. Recreate it when the chain changes. |
| Direct API | Use `https://hub.orbs.network` and pass the active `chainId` in endpoint query parameters. |

Continue with the [TypeScript SDK](/liquidity-hub) or [Direct API](/liquidity-hub/direct) for request and execution details.
