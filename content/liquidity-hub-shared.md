# Swap · Shared Reference

Shared details for the TypeScript SDK and Direct API integrations. Use this reference for concepts, lifecycle, input requirements, chains, fees, partner configuration, and integration resources.

## Supported Chains

Use these networks for Swap integrations through the TypeScript SDK or Direct API.

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

### Choose an Integration

Swap uses Liquidity Hub to improve an existing DEX quote with on-chain and off-chain solver liquidity. The host selects the route before execution.

| Method | Choose it when |
| --- | --- |
| [TypeScript SDK](/liquidity-hub) | The application can run JavaScript or TypeScript. The framework-neutral client manages quotes, submission, and polling; React is optional. |
| [Direct API](/liquidity-hub/direct) | The SDK cannot run in the target environment, or the host needs full ownership of HTTP requests, signing, polling, and recovery. |

### Integration Resources

- [Playground](https://orbs-spot.vercel.app)
- [Interactive Example](https://orbs-spot.vercel.app/?devMode=true)
- [Liquidity Hub Integration Skill](https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-integration) — implementation workflow and package guardrails for coding agents.
- [Liquidity Hub SDK and examples](https://github.com/orbs-network/spot-ui/tree/master/packages/liquidity-hub-ui)
- [Production React implementation](https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx)
- [Quote request implementation](https://github.com/orbs-network/spot-ui/blob/master/packages/liquidity-hub-ui/src/lib/quote.ts)
- [Swap submission and polling implementation](https://github.com/orbs-network/spot-ui/blob/master/packages/liquidity-hub-ui/src/lib/swap.ts)

## How It Works

### Concepts

| Term | Meaning |
| --- | --- |
| Liquidity Hub | Orbs optimization layer that requests liquidity from on-chain and off-chain solvers. It is used only when it improves the user's executable result. |
| Permit2 | Token permission contract that receives ERC-20 allowance for Liquidity Hub swaps. The current address is `0x000000000022D473030F116dDEE9F6B43aC78BA3`. |
| Quote signing data | `quote.eip712` is the wallet-ready typed-data payload. Pass its domain, types, primary type, and message unchanged to the wallet signer. |
| Partner | Partner name supplied by Orbs. If Orbs has not supplied one, use `"unknown"`. |
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

### Input Tokens

Quotes and execution use an ERC-20 input address. When the user selects native currency, request a quote for the chain's wrapped-native token and wrap funds before signing. The host supplies the wrapped-native address and confirms wrapping and approval receipts.

## Fees and Configuration

### Fees

The existing Swap documentation does not specify a universal fee percentage. Confirm the applicable fee terms with Orbs for your partner configuration before displaying a fixed rate.

Use the executable amounts returned in the quote. When comparing Swap with a host DEX route, compare `quote.minAmountOut` with the DEX's protected minimum for the same input, chain, and slippage. Do not adjust the quote's signed amounts using a separate display estimate.

Wrapping and ERC-20 approval are wallet transactions. Account for their network gas costs separately from any swap fee when showing the transaction review.

### Partner Configuration

Use the partner identifier supplied by Orbs, or `"unknown"` when none was supplied. Keep the partner and active chain consistent across quotes and execution.

| Integration | Configuration |
| --- | --- |
| TypeScript SDK | Create one client for the active chain and reuse it. Recreate it when the chain changes. |
| Direct API | Use `https://hub.orbs.network` and pass the active `chainId` in endpoint query parameters. |

Continue with the [TypeScript SDK](/liquidity-hub) or [Direct API](/liquidity-hub/direct) for request and execution details.
