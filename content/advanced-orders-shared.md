# Advanced Orders · Shared Reference

Shared details for API Only, TypeScript SDK, React SDK, and MCP Skill integrations of the Spot protocol.

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

## Integration Options

### Choose an Integration

| Method | Choose it when |
| --- | --- |
| [API Only](/advanced-orders/direct) | An Orbs package cannot run in the target environment, or the host needs full ownership of HTTP and EIP-712 construction. The host calculates and validates strategy, amount, schedule, trigger, limit, nonce, and deadline fields. |
| [TypeScript SDK](/advanced-orders/typescript) | The host needs framework-neutral calculation and protocol operations while retaining its state and UI. Works with Vue, Angular, Svelte, vanilla TypeScript, and server-side TypeScript. |
| [React SDK](/advanced-orders/react) | A React application wants provider-scoped forms, execution, history, and cancellation hooks. Uses the TypeScript SDK internally. |
| [MCP Skill](https://github.com/orbs-network/spot/tree/master/skill) | An agent needs the published Spot skill and MCP integration resources. |

Prefer an SDK when possible: the TypeScript SDK provides framework-neutral control, while the React SDK also manages provider-scoped application state.

### Integration Resources

- [Playground](https://orbs-spot.vercel.app/?tab=twap)
- [Direct integration reference](https://github.com/orbs-network/spot-integration-docs)
- [TypeScript SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui)
- [TypeScript SDK API](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/README.md)
- [Spot TypeScript integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-integration)
- [Playground](https://orbs-spot.vercel.app/?tab=twap&devMode=true)
- [React SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react)
- [Spot React integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-react-integration)
- [Reference React implementation](https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx)
- [Swap UI execution helper](https://www.npmjs.com/package/@orbs-network/swap-ui)
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
4. Fetch order history for the swapper, chain, and exchange adapter.
5. To cancel, submit the on-chain cancellation transaction, confirm its receipt, and refresh history.

The host owns wallet access and transaction confirmation. API-only integrations construct protocol fields directly; the SDKs provide preparation, submission, history, and cancellation requests. React adds provider-scoped state and execution handling.

Across SDK integrations, the host owns controls, market data, quote freshness, wallet transactions, translations, and modal presentation. The SDK owns form defaults and validation, trusted partner configuration, order construction, submission, normalized history, and version-aware cancellation requests. The TypeScript host manages client caching and polling; React manages the provider-scoped client and mounted history queries.

### Input Tokens

Signed orders spend ERC-20 tokens only. Never use a native-token placeholder in the signed order. The host supplies the connected chain's wrapped-native token and prepares the full input amount before approval and signing.

| Integration | Native input handling |
| --- | --- |
| API Only / TypeScript SDK | Wrap the full input amount, confirm the receipt, then approve and prepare the order using the wrapped ERC-20 address. |
| React SDK | `inputToken` may be the selected native asset. Supply `wrappedNativeToken`; the execution flow wraps when needed and uses the wrapped ERC-20 for approval and signing. |

## Fees and Configuration

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

Use the exact partner identifier supplied by Orbs, or `"unknown"` when none was supplied. Never infer it from a DEX name, hostname, or chain. In the TypeScript and React SDKs, use `Partners.Unknown` unless Orbs supplied a specific enum member.

| Integration | Configuration |
| --- | --- |
| API Only | Fetch `GET https://order-sink-v2.orbs.network/config?partner={partner}&chain={chainId}`. Preserve the returned domain, types, protocol addresses, adapter, and fee reference. |
| TypeScript SDK | Initialize `createClient(partner, chainId)` and reuse the client for that partner and chain. |
| React SDK | Configure `SpotProvider` with the partner and current chain; partner or chain changes re-key the configured client. |
| MCP Skill | Follow the [published skill](https://github.com/orbs-network/spot/tree/master/skill) for its configuration workflow. |

Continue with [API Only](/advanced-orders/direct), [TypeScript SDK](/advanced-orders/typescript), or [React SDK](/advanced-orders/react) for method-specific implementation details.
