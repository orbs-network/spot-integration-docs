# Advanced Orders · TypeScript SDK

Add scheduled or price-based trades using the framework-neutral **Orbs Spot** SDK. Despite its name, `@orbs-network/spot-ui` does not render a UI or require React. Your app supplies the form, wallet, and order history screen.

The same SDK also provides [Spot quotes and swaps](/swap). Reuse one partner- and chain-scoped client across these features. An existing DEX router uses `client.getQuote()`, host wrapping and approval, `client.prepareSwap()`, inline wallet signing, `client.submitSwap()`, and `client.getOrder()` status reads.

Follow this guide from setup to create one order, find it in history, track its fills, and cancel an open order. An accepted order may execute later; creation is not fill completion.

## Quickstart

### TypeScript SDK Example

[Spot App](https://swap.orbs.network/dev?tab=twap) uses the Advanced Orders TypeScript SDK. View the [Spot App source on GitHub](https://github.com/orbs-network/orbs-spot) for an application example.

### Before You Start

Pass a finite positive `minTradeSizeUsd` to `calculateOrder()` according to the host's minimum-trade policy, for example `10`, `25`, or `50`. This is the minimum amount in USD for each individual trade. For example, `minTradeSizeUsd: 25` means every trade must be worth at least $25. For TWAP orders, each smaller trade must meet this minimum; it is not the total order amount.

Before starting, have these app values ready:

- A connected wallet account/provider and RPC client on the same chain.
- Input/output token addresses and decimals, plus the chain’s wrapped-native token.
- The raw input-token balance, gas balance, a current quote for the full input amount, and token USD prices.
- Your existing DEX partner enum, or `Partners.External`. Client initialization must succeed for that partner and chain before submission.

Install the SDK using the commands below and reuse your existing wallet provider or library.

Build one `calculateOrder()` adapter, one guarded confirmation handler, and a history/cancellation view. The SDK prepares and submits protocol data; the host owns application state, current market data, wallet transactions, and polling.

### Implementation Order

Install `@orbs-network/spot-ui`, create one client for your existing DEX partner (or `Partners.External`) and connected chain, derive the form from current DEX inputs, then prepare, sign, and submit one immutable attempt. Use the same partner and chain for history and cancellation.

The client resolves protocol configuration and prepares the signing payload. Your app sends wrapping/approval transactions, waits for successful receipts, requests the signature, and tracks the accepted order through history. Keep the account, chain, and partner consistent throughout an attempt.

### Install the TypeScript SDK

Use the package manager already used by the host application. Do not mix lockfiles.

```bash
npm install @orbs-network/spot-ui
# or: pnpm add @orbs-network/spot-ui
# or: yarn add @orbs-network/spot-ui
```

Inspect the installed version and compatible public API before changing an existing installation. The wallet examples illustrate operations with Viem; adapt those calls to your existing wallet setup. The SDK itself has no React or wallet-library dependency. Import only from the package root; do not use `dist/*` or internal source paths.

Read the installed version-matched `node_modules/@orbs-network/spot-ui/dist/integration-skills/spot-advanced-orders-integration/SKILL.md` and the references needed for the requested form, execution, or history surface. Its adjacent `manifest.json.sdkVersion` must match the package. For an older release without a bundle, use the [Advanced Orders TypeScript integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-advanced-orders-integration) from a matching release or checkout. Reading documentation under `dist` is allowed. Swaps use the separate `spot-swap-integration` skill; React provider/hooks use `spot-advanced-orders-react-integration`.

### Initialize the Client

`createClient(partner, chainId)` validates support, fetches and validates the current RePermit configuration, and returns a new frozen client bound to that exact partner and chain.

Import `createClient` and `Partners` from `@orbs-network/spot-ui`, then call `const client = await createClient(Partners.External, chain.id)` inside your async operation. Use the connected wallet's chain and use `Partners.External` (`"external"`) or the partner provided by the Orbs team. The submission, history, and cancellation examples below include this call directly.

`createClient()` returns a new client while sharing validated configuration and in-flight requests through a bounded 60-second cache. Reuse clients or initialization promises in your host data layer by partner and chain; allow failed initialization to be retried.

**Checkpoint:** `createClient(partner, chainId)` resolves for the selected chain and partner. Surface configuration errors before enabling submission.

The client exposes these read-only configuration values and operations:

| Member | What it represents |
| --- | --- |
| `client.partner` | The `Partners` value used for configuration and configured history requests. |
| `client.chainId` | The EVM chain captured by this client. Create a new client when the wallet chain changes. |
| `client.apiUrl` | The trusted order-service endpoint captured at initialization. |
| `client.rePermitData` | The validated, trusted RePermit configuration, including the EIP-712 domain/types, base order, and protocol addresses. Treat it as read-only. |
| `client.spenderAddress` | The RePermit verifying contract. Use it for ERC-20 allowance and approval; it is also the v2 cancellation contract. |
| `client.exchangeAddress` | The configured exchange adapter used for order execution; it is not a v2 history query parameter. |
| `client.getQuote(params)` | Fetches one Spot quote for exactly one raw `inAmount` or `outAmount` using this client's partner and chain. Advanced form market data should describe the complete current input. |
| `client.prepareSwap({ quote, account, signal })` | Reuses or refreshes a reviewed swap quote, checks its protected minimum, and prepares fresh signing data. See [Swap](/swap). |
| `client.prepareOrder(params)` | Converts a submittable form snapshot into the exact protocol order, signing request, approval request, and fresh timestamps. It performs no wallet or network operation. |
| `preparedOrder.signingRequest` | Contains `signerAddress` and `typedData` for the host wallet to sign. The client does not expose a `signOrder()` method. |
| `client.submitOrder(preparedOrder.order, signature)` | Submits the exact signed protocol `order` and signature once and returns a normalized `Order`. |
| `client.getOrders({ account, ...options })` | Returns `{ orders, legacyLoaded }` for this client's partner and chain. Omit `account` to include all wallets. Options include `signal`, `getv1orders`, and `legacyOrders`; `page` and `limit` apply only to legacy TWAP history. |
| `client.getCancelOrderRequest(order)` | Builds the correct v1 or v2 contract address, ABI, and arguments. The host wallet sends and confirms the transaction. |

Do not fetch or reconstruct RePermit configuration in host code. The client rejects chain mismatches and malformed or zero critical addresses before exposing approval, signing, history, or cancellation values.

USD pricing is independent of the client: import standalone `getTokenUsd({ tokenAddress, chainId, signal })` from the package root. It returns a full-precision decimal string in USD per whole token, uses the default production price service, accepts no `apiUrl`, and makes a fresh request on every call. Use the wrapped address for native prices, keep raw token amounts separate, and apply the host's loading, cancellation, and fallback policy. React wallet types and `WalletInteractionError` belong to `@orbs-network/spot-react`; direct TypeScript integrations handle their own wallet errors.

## Calculate the Order Form

Use `calculateOrder()` as the calculation entry point; `calculateOrderForm()` remains a compatibility alias. It is synchronous and time-independent, so derive it from the exact primitive form and market inputs in the host's existing computed state or memoization layer. Store only editable inputs; do not copy the calculated result into writable state.

Use the exported `OrderType` enum: `TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`. `OrderVariant` identifies the detailed market/limit mode at `form.values.orderVariant` and in history at `order.type`. Swap previews use their quote directly and do not call this calculator.

```typescript title="calculate-order-form.ts"
import { calculateOrder, type CalculateOrderFormParams, type CalculatedOrderForm } from "@orbs-network/spot-ui";

export function getCalculatedOrderForm(params: CalculateOrderFormParams): CalculatedOrderForm {
  // Supply form inputs and current market data from the host application.
  // Render form.errors.primary when form.canSubmit is false.
  if (!Number.isFinite(params.minTradeSizeUsd) || params.minTradeSizeUsd <= 0) {
    throw new Error("minTradeSizeUsd must be positive");
  }
  return calculateOrder({
    // Strategy: OrderType.TWAP, LIMIT, STOP_LOSS, or TAKE_PROFIT.
    orderType: params.orderType,

    // Decimals from the host token registry (for example, USDC: 6, WETH: 18).
    inputTokenDecimals: params.inputTokenDecimals,
    outputTokenDecimals: params.outputTokenDecimals,

    // Quote for the full input amount, in output-token base units.
    // Leave undefined while loading or when the quote is stale.
    quotedOutputAmountRaw: params.quotedOutputAmountRaw,
    // Optional exact input USD total from the same current quote.
    inputAmountUsd: params.inputAmountUsd,

    // USD price of one whole token, supplied as decimal strings.
    inputTokenUsdPrice: params.inputTokenUsdPrice,
    outputTokenUsdPrice: params.outputTokenUsdPrice,

    // Positive minimum USD amount for each individual trade, set by the host.
    minTradeSizeUsd: params.minTradeSizeUsd,
    // Percentage units: 3 means 3%, not 3 basis points.
    priceProtectionPercent: params.priceProtectionPercent,
    // Optional display-only fee percentage; does not collect a fee.
    displayFeePercent: params.displayFeePercent,
    // Spendable input-token balance, as an integer base-unit string.
    inputBalanceRaw: params.inputBalanceRaw,

    userInput: {
      // User-entered token amount, for example "100" USDC.
      inputAmountUi: params.userInput.inputAmountUi,
      isMarketOrder: params.userInput.isMarketOrder,

      // TWAP schedule: count and { value, unit: TimeUnit } durations.
      tradeCount: params.userInput.tradeCount,
      tradeInterval: params.userInput.tradeInterval,
      orderDuration: params.userInput.orderDuration,

      // Price conditions in the user's selected display direction.
      limitPriceUi: params.userInput.limitPriceUi,
      limitPricePercent: params.userInput.limitPricePercent,
      triggerPriceUi: params.userInput.triggerPriceUi,
      triggerPricePercent: params.userInput.triggerPricePercent,
      isPriceInverted: params.userInput.isPriceInverted,
    },
  });
}

/*
Response: CalculatedOrderForm (returned synchronously, not an HTTP response).

Amount objects contain:
  { raw: string, ui: string, usd: string }
  raw = integer token base units, ui = human-readable token amount,
  usd = USD value. These strings avoid floating-point rounding.

{
  orderType,           // Selected strategy: TWAP, LIMIT, STOP_LOSS, TAKE_PROFIT.
  isInverted,          // Whether prices are displayed in the inverse direction.
  inputAmount: {
    raw, ui, usd,      // Total source amount.
    isEmpty,           // Whether the user has entered an input amount.
  },
  outputAmount: { raw, ui, usd }, // Calculated destination amount.
  marketPrice: { raw, ui, usd },  // Current market-price representations.
  trades: {
    totalTrades,       // Selected/calculated number of fills.
    maxTrades,         // Maximum fill count allowed by the calculation.
    inputAmountPerTrade: { raw, ui, usd },
    minOutputAmountPerTrade: { raw, ui, usd },
    triggerOutputAmountPerTrade: { raw, ui, usd },
    error,             // Optional trade-count validation error.
  },
  schedule: {
    totalTrades,
    fillDelay,         // Interval as { value, unit: TimeUnit }.
    fillDelayMillis,   // The same interval in milliseconds.
    duration,          // Order lifetime as { value, unit: TimeUnit }.
    durationMillis,    // The same lifetime in milliseconds.
    fillDelayError,    // Optional interval validation error.
    durationError,     // Optional duration validation error.
  },
  triggerPrice: {
    raw,               // Canonical trigger value for execution.
    typedValue,        // Optional price entered by the user.
    percentage,        // Percentage offset represented as a string.
    isTypedValue,      // Whether an explicit price was entered.
    enabled,           // Whether this strategy uses a trigger.
    display: { raw, ui, usd },
    error,             // Optional trigger-price validation error.
  },
  limitPrice: {
    raw, typedValue, percentage, isTypedValue,
    display: { raw, ui, usd },
    error,             // Optional limit-price validation error.
  },
  minOutputAmountTotal: { raw, ui, usd }, // Minimum output across all fills.
  tradePrice: { raw, ui, usd },          // Calculated execution price.
  fees: {
    raw, ui, usd, percentage, // Display-only fee estimate; does not collect fees.
  },
  values: {
    // Flattened calculated values consumed by order preparation.
    orderVariant, isMarketOrder, isTriggerPrice, slippageBps,
    totalTrades, fillDelay, fillDelayMillis, duration, durationMillis,
    inputAmount, outputAmount, inputAmountPerTrade,
    minOutputAmountPerTrade, minOutputAmountTotal, triggerOutputAmountPerTrade,
    tradePrice, marketPrice, limitPrice, triggerPrice,
    displayFeeAmount, displayFeePercent,
  },
  errors: {
    primary,           // Optional main InputError to show to the user.
    all,               // Array of all InputError values.
    minTradeSize, triggerPrice, limitPrice, trades,
    fillDelay, duration, balance, // Optional errors for individual fields.
  },
  isReady,             // Required calculation inputs are available.
  notReadyReason,      // Missing input, current quote, or input USD value.
  canSubmit,           // Ready and valid; use this to enable the submit action.
}
*/
```

`calculateOrder()` returns `CalculatedOrderForm` synchronously. The comment below the function explains the returned fields. Use `errors.primary` for the main validation message and `canSubmit` to enable submission. When `isReady` is false, `notReadyReason` identifies the missing prerequisite; ready but invalid forms use `errors` instead.

The example lists every `CalculateOrderFormParams` field explicitly. Supply values from the current host form and market data; optional fields may be `undefined` when unavailable or unused by the selected strategy.

### Validate Form Inputs

Before wiring a wallet action, check the calculation with real token decimals, balance, and a current quote. Show `form.errors.primary` and field errors, and enable confirmation only when `form.canSubmit` is true. `form.isReady` alone is insufficient.

#### Input Values

| Value | What it represents |
| --- | --- |
| `orderType` | An `OrderType` enum value: `TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`. |
| `inputTokenDecimals` / `outputTokenDecimals` | Actual token decimal precision; zero is valid. |
| `quotedOutputAmountRaw` | Current output-token base-unit quote for the complete `userInput.inputAmountUi`. Omit it while the quote is loading or stale. |
| `inputAmountUsd` | Optional input USD total from the same current quote. A positive total can provide readiness without an input-token unit price. Output USD estimates use `outputTokenUsdPrice`. |
| `inputTokenUsdPrice` / `outputTokenUsdPrice` | USD value of exactly one whole token, as decimal strings. |
| `minTradeSizeUsd` | Finite positive minimum amount in USD for each individual trade, set by the host. For TWAP, the configured minimum applies to each smaller trade. |
| `priceProtectionPercent` | Finite execution protection from 0 through 50 in percentage units; `3` means 3%, or 300 basis points. It is separate from the normal swap slippage setting. |
| `displayFeePercent` | Optional display-only estimate used for `form.fees`; it does not collect or subtract a fee. |
| `inputBalanceRaw` | Current input-token balance as an integer base-unit string. |
| `userInput.inputAmountUi` | User-entered decimal token amount, such as `"1.25"`. The SDK derives raw and USD values. |
| `userInput.isMarketOrder` | Whether the chosen strategy uses market execution. `OrderType.LIMIT` remains a limit order. |
| `userInput.tradeCount` | Explicit number of TWAP fills. Preserve a user selection across amount changes; surface validation instead of silently clamping it. |
| `userInput.tradeInterval` / `userInput.orderDuration` | Controlled `{ value, unit: TimeUnit }` values. The SDK resolves their millisecond forms and validates the schedule. |
| `userInput.limitPriceUi` / `userInput.triggerPriceUi` | User-entered price in the current display direction. |
| `userInput.limitPricePercent` / `userInput.triggerPricePercent` | Percentage offset used when no explicit corresponding price was entered. |
| `userInput.isPriceInverted` | Whether the displayed price direction is input-per-output. Protocol values remain canonical. |

Track the amount and token pair that produced the DEX quote. As soon as any of them changes, omit `quotedOutputAmountRaw` until the replacement quote arrives; never calculate from a previous quote or treat it as a one-token price.

Advanced orders derive their minimum output from the limit controls. A TWAP duration must cover its scheduled fills; the calculator reports a duration error when it is too short. Surface that error instead of signing a schedule that cannot finish.

#### Returned Values

| Value | What it represents |
| --- | --- |
| `form.orderType` / `form.values.orderVariant` | Selected advanced strategy and its detailed protocol mode. History preserves that mode as `order.type: OrderVariant`. |
| `form.inputAmount` | Total input as `{ raw, ui, usd }`, plus `isEmpty`. |
| `form.outputAmount` | Estimated total output as `{ raw, ui, usd }`. |
| `form.marketPrice` | Canonical market rate in raw, UI, and USD forms. |
| `form.trades` | Resolved/max trade counts, structured per-trade amounts, and trade-count validation. |
| `form.schedule` | Fill delay and duration in structured and millisecond forms, with schedule validation. |
| `form.triggerPrice` / `form.limitPrice` | Canonical `raw` rates, display-direction values, percentages, enabled/default state, and validation. |
| `form.minOutputAmountTotal` | Protected minimum output across the complete order as `{ raw, ui, usd }`. |
| `form.tradePrice` | Effective execution price as `{ raw, ui, usd }`. |
| `form.fees` | Display-only fee estimate as `{ raw, ui, usd, percentage }`. |
| `form.values` | Normalized raw execution values used by `prepareOrder()`. It intentionally contains no UI or USD fields. |
| `form.errors` | Ordered and field-specific `InputError` values, including `primary` and `all`. Translate `error.type` and interpolate `error.args` in the host. |
| `form.isReady` | Whether the minimum market inputs exist. It does not mean validation passed. |
| `form.notReadyReason` | Missing prerequisite when unready, such as `awaiting-quote` or `missing-usd-value`; absent when ready. |
| `form.canSubmit` | Whether the form is ready and has no blocking error. Use this to gate submission. |

Use `.raw` only for wallet and protocol operations, `.ui` for editable token values, and the DEX's native amount formatter for final display. Use `invertPriceInput()` when the user changes price direction instead of only swapping labels.

## Prepare and Submit an Order

The current [Spot client contract](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/src/lib/client.ts) accepts `client.submitOrder(order, signature, { signal })`: the first argument is a `RePermitOrder`, not the complete `PreparedOrder` wrapper, and the options argument is optional. Sign `preparedOrder.signingRequest` with the host wallet, then submit `preparedOrder.order` with that same signature. Do not reconstruct or mutate the signed order.

`submitOrder()` returns `Promise<Order>` and rejects on submission failure. By contrast, the React hook's `execution.submitOrder()` takes no arguments and reports progress through execution state and provider callbacks.

Treat one click as one immutable attempt and reject concurrent submissions. Capture the current form, tokens, account, chain, and client. For native input, obtain the chain's wrapped-native `Token` from DEX configuration, wrap the full amount, then use that ERC-20 address for allowance, approval, and order preparation.

This is a plain browser TypeScript example. It creates the Viem clients once at module scope from the active chain and injected wallet provider, while the host passes the connected account with the current order inputs. Replace the example Polygon chain with the chain selected in the wallet.

Create the SDK client with the active chain and your partner before preparing the order. Use `Partners.External` (`"external"`) or the partner provided by the Orbs team.

```typescript
import { createClient, Partners, type CalculatedOrderForm, type Order, type Token } from "@orbs-network/spot-ui";
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseAbi, type Address, type Hash } from "viem";
import { polygon } from "viem/chains";

// Use the Viem chain connected in the host wallet; Polygon is only an example.
const chain = polygon;
const publicClient = createPublicClient({ chain, transport: http() });
const walletProvider = (window as unknown as { ethereum: Parameters<typeof custom>[0] }).ethereum;
const walletClient = createWalletClient({ chain, transport: custom(walletProvider) });
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

type SubmitAdvancedOrderParams = {
  account: Address;
  form: CalculatedOrderForm;
  inputToken: Token;
  // Resolve native-asset identity using the host's token registry.
  inputIsNative: boolean;
  outputToken: Token;
  wrappedNativeToken: Token;
};

export async function submitAdvancedOrder({
  account,
  form,
  inputToken,
  inputIsNative,
  outputToken,
  wrappedNativeToken,
}: SubmitAdvancedOrderParams): Promise<Order> {
  if (!form.canSubmit) throw new Error("Order form is not ready");
  const reviewedForm = structuredClone(form);
  const amount = reviewedForm.inputAmount.raw;
  const tokenAddress = (inputIsNative ? wrappedNativeToken : inputToken).address as Address;
  const outputTokenAddress = outputToken.address;

  // Use Partners.External, or the partner provided by the Orbs team.
  const client = await createClient(Partners.External, chain.id);
  // Read allowance before opening the first wallet prompt.
  const alreadyApproved = await hasAllowance(account, tokenAddress, client.spenderAddress, amount);
  if (inputIsNative) await wrapNativeToken(account, tokenAddress, amount);
  if (!alreadyApproved) await approveTokenIfNeeded(account, tokenAddress, client.spenderAddress, amount);

  // Prepare late so the signed start, deadline, and nonce remain fresh.
  const preparedOrder = client.prepareOrder({
    form: reviewedForm,
    inputTokenAddress: tokenAddress,
    outputTokenAddress,
    account,
  });

  const { signerAddress, typedData } = preparedOrder.signingRequest;
  const signature = await walletClient.signTypedData({
    ...typedData,
    message: { ...typedData.message },
    account: signerAddress,
  });

  return client.submitOrder(preparedOrder.order, signature);
}

async function wrapNativeToken(account: Address, tokenAddress: Address, amount: string): Promise<void> {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: wrappedNativeAbi,
    functionName: "deposit",
    value: BigInt(amount),
    account,
    chain: walletClient.chain,
  });
  await waitForSuccessfulReceipt(hash);
}

async function approveTokenIfNeeded(account: Address, tokenAddress: Address, spenderAddress: Address, amount: string): Promise<void> {
  if (await hasAllowance(account, tokenAddress, spenderAddress, amount)) return;

  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [spenderAddress, BigInt(amount)],
    account,
    chain: walletClient.chain,
  });
  await waitForSuccessfulReceipt(hash);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await hasAllowance(account, tokenAddress, spenderAddress, amount)) return;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error("Confirmed approval was not observed by the RPC");
}

async function hasAllowance(account: Address, tokenAddress: Address, spenderAddress: Address, amount: string): Promise<boolean> {
  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spenderAddress],
  });
  return allowance >= BigInt(amount);
}

async function waitForSuccessfulReceipt(hash: Hash): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Wallet transaction reverted");
}
```

`walletClient` uses the injected wallet transport for `writeContract()` and `signTypedData()`. `publicClient` uses the active chain's RPC transport for `readContract()` and receipt confirmation. The host should expose the action only after the account and provider are ready on that chain. Wallet writes are not complete until `waitForTransactionReceipt()` returns a successful receipt. Re-read allowance with a small bounded retry after approval to tolerate RPC indexing lag.

Run `prepareOrder()` after wrapping and approval, immediately before signing. It rejects an invalid `orderType`, `form.canSubmit === false`, native input placeholders, and inconsistent execution values. It captures the form, stamps fresh `currentTimeMillis`, `deadlineMillis`, and a monotonic nonce shared across clients in the loaded SDK instance, and returns `order`, `signingRequest`, `approvalRequest`, `form`, and `values`. Advanced-order deadlines include a one-minute margin. It does not recalculate the form or perform a wallet call.

`approvalRequest.amount` is the exact required input; `approvalAmount` is the suggested cap, which defaults to the maximum uint256. This example approves only the required amount. Allowance must cover `amount`, regardless of the cap policy chosen by the host.

To test the EIP-712 payload before signing, paste `preparedOrder.signingRequest.typedData` as JSON into the [EIP-712 Order Preview](https://playground.orbs.network/developers/eip712) and select **Preview order**. Include `domain`, `types`, `primaryType`, and `message`; compare the displayed amounts and execution conditions with the intended order before calling `walletClient.signTypedData()`. The preview does not sign or submit the order.

Return the wallet's original `0x`-prefixed EIP-712 signature. Do not split it into `{ v, r, s }`, alter the recovery byte, or automatically retry an ambiguous submission. Reconcile recent history before preparing another order if the first request may have reached the service.

## Fetch and Cancel Orders

This step loads order history and cancels a selected order. Use the connected wallet's chain for both operations.

Both examples call the SDK's `createClient()` directly. Use `Partners.External` (`"external"`) or the partner provided by the Orbs team, and use the same partner for submission, history, and cancellation.

The examples use the active `chain` from your wallet setup. Cancellation also uses the connected `walletClient` and `waitForSuccessfulReceipt`, which must wait for the transaction receipt and reject if the transaction reverted.

### Fetch Orders

Initialize the client with the same partner and chain used for submission. The client queries order-sink v2 and the older order-sink service by default, using its partner ID as `exchange` and its chain. Do not construct history URLs yourself or add a page-fetching loop for the configured v2 lookup. The public `page` and `limit` options apply only to legacy TWAP history. Set `getv1orders: false` to omit the older order-sink service, or `legacyOrders: false` to omit legacy TWAP subgraphs; both default to `true`. `client.getOrders()` returns `{ orders, legacyLoaded }`; `legacyLoaded` is true only when a configured and requested legacy TWAP source succeeded, and false also covers a disabled or unavailable source. Omit `account` to query all wallets for this client's partner and chain.

```typescript
import { createClient, Partners } from "@orbs-network/spot-ui";
import type { Address } from "viem";

export async function fetchOrders(account: Address, signal?: AbortSignal) {
  // Use Partners.External, or the partner provided by the Orbs team.
  const client = await createClient(Partners.External, chain.id);
  return client.getOrders({ account, signal });
}
```

Destructure `const { orders, legacyLoaded } = await fetchOrders(account)` for the list and legacy-source status. Use `historyKey` for UI and cache identity because legacy numeric IDs can repeat across contract deployments. Keep `order.id` for protocol display and cancellation. History values are raw integer strings; format them with the correct token decimals. Helpers such as `getOrderFillDelayMillis`, `getOrderExecutionRate`, `getOrderLimitPriceRate`, and `getTriggerPriceRate` normalize display data.

### Cancel Order

Pass the selected order returned by `fetchOrders()` to a client initialized with the same partner and chain.

```typescript
import { createClient, Partners, type Order } from "@orbs-network/spot-ui";
import type { Address } from "viem";

export async function cancelSelectedOrder(order: Order, account: Address) {
  // Use Partners.External, or the partner provided by the Orbs team.
  const client = await createClient(Partners.External, chain.id);
  const request = client.getCancelOrderRequest(order);
  const txHash = await walletClient.writeContract({
    address: request.contractAddress as Address,
    abi: request.abi,
    args: request.args,
    functionName: "cancel",
    account,
    chain: walletClient.chain,
  });
  await waitForSuccessfulReceipt(txHash);
  const { orders, legacyLoaded } = await client.getOrders({ account });
  return { txHash, orders, legacyLoaded };
}
```

`getCancelOrderRequest()` selects the correct v1 or v2 contract, ABI, and arguments. The host wallet must submit it on `client.chainId`, wait for a successful receipt, prevent duplicate prompts, and refresh normalized history afterward.

## Operational Checklist

- Use the partner enum supplied by Orbs; otherwise use `Partners.External`.
- Confirm support by initializing `createClient(partner, chainId)` and surface configuration failures.
- Keep the existing DEX controls, state, current quote, wallet, chain metadata, routing, and translations.
- Derive one `CalculatedOrderForm` from current inputs; never mirror it into editable state.
- Render field errors and `form.errors.primary`, and disable submission until `form.canSubmit`.
- Supply a current raw quote for the complete input amount and omit stale data.
- Supply the wrapped-native token from host chain configuration and wrap before approval when native is selected.
- Use `client.spenderAddress`, exact raw amounts, confirmed wallet writes, and bounded post-approval verification.
- Prepare immediately before signing and submit the same prepared order with the unchanged signature once.
- Key history by `order.historyKey`; use history and cancellation methods with the same partner and chain.

### End-to-End Acceptance Run

1. Call `createClient(partner, chainId)` and verify it initializes for the intended partner and chain. Supply the actual connected chain instead of leaving the example Polygon chain hardcoded in wallet clients.
2. Keep the form-calculation adapter and `submitAdvancedOrder()` in the same module, or explicitly export/import their shared bindings. Provide real token metadata, current prices/quote, and account state; wait for `form.canSubmit`.
3. Connect `submitAdvancedOrder({ account, form, inputToken, inputIsNative, outputToken, wrappedNativeToken })` to one guarded confirm handler. Resolve `inputIsNative` from the host's token registry. Verify approval to `client.spenderAddress`, confirmed wallet writes, late preparation, signing, and submission.
4. Render “Order submitted” after acceptance, then fetch the account's orders with the same partner and chain. Use `historyKey` for UI identity and render actual fill progress separately from submission success.
5. Wire `getCancelOrderRequest(order)` to your wallet transaction adapter. The `cancelSelectedOrder()` example sends the wallet transaction, waits with `waitForSuccessfulReceipt()`, and returns refreshed orders. Update the displayed list from that result.
6. Test missing/stale quote inputs, rejected approval/signature, and a lost submission response. Ensure invalid forms cannot submit, concurrent clicks produce one attempt, and ambiguous submission triggers reconciliation rather than automatic resubmission.

Run ERC-20, already-approved, and native-input cases using a funded development wallet. The live flow can execute trades and incurs network costs; mocked failure cases do not establish successful settlement.
