# Advanced Orders · TypeScript SDK

Use `@orbs-network/spot-ui` when the host needs Advanced Orders calculation and protocol operations without React. It is framework-neutral and works with Vue, Angular, Svelte, vanilla TypeScript, and server-side TypeScript while the host keeps ownership of UI, wallet access, state, caching, and routing.

The TypeScript and React SDKs share the same form calculation and configured client, so previews and submitted orders use one set of defaults, validation rules, prices, schedules, and execution values.

**Input token requirement:** The signed order always spends an ERC-20 token. If the user selects native currency, use the wrapped-native token supplied by the DEX, wrap the full input amount first, then approve and prepare the order with that wrapped token.

## Concepts

| Term | Meaning |
| --- | --- |
| Calculated form | The synchronous result of `calculateOrderForm()`. It is the single source for display values, protocol values, validation, and submission readiness. |
| Spot client | A partner- and chain-scoped client returned by `createClient()`. It owns configuration-dependent preparation, signing, submission, history, and cancellation requests. |
| Prepared order | The order, EIP-712 signing request, approval request, calculated form snapshot, and fresh execution timestamps returned by `client.prepareOrder()`. |
| Host adapter | Application code that maps the existing market, state, wallet, and transaction layers to SDK inputs. |

## Integration Resources

- [TypeScript SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-ui)
- [TypeScript SDK API](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/README.md)
- [Spot TypeScript integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-integration)
- [Playground](https://orbs-spot.vercel.app/?tab=twap&devMode=true)

## Quickstart

Install `@orbs-network/spot-ui`, create one client for the Orbs-provided partner and connected chain, derive the form from current DEX inputs, then prepare, sign, and submit one immutable attempt. Reuse the same client for history and cancellation.

The host owns controls, market data, quote freshness, wallet transactions, client caching, translations, modals, and polling. The SDK owns form defaults and validation, trusted partner configuration, order construction, submission, normalized history, and version-aware cancellation requests.

Before starting, confirm that the partner and chain are supported by `getPartnerChains(partner)`. Use `Partners.Unknown` unless Orbs provided a specific enum member. Never infer a partner from the DEX name or hostname, and never substitute a different chain.

## Install the TypeScript SDK

Use the package manager already used by the host application. Do not mix lockfiles.

```bash
npm install @orbs-network/spot-ui@latest
# or: pnpm add @orbs-network/spot-ui@latest
# or: yarn add @orbs-network/spot-ui@latest
```

The package has no React or wallet-library dependency. Import only from the package root; do not use `dist/*` or internal source paths.

## Initialize the Client

`createClient(partner, chainId)` validates support, fetches and validates the current RePermit configuration, and returns a new frozen client bound to that exact partner and chain.

```typescript
import { createClient, Partners } from "@orbs-network/spot-ui";

async function getSpotClient() {
  const chainId = 137;
  // Replace Unknown only when Orbs provides the integration's partner enum.
  const partner = Partners.Unknown;

  return createClient(partner, chainId);
}
```

Every call fetches configuration and there is no SDK-global cache. Reuse an in-flight promise or resolved client in the host data layer, keyed by partner and chain. Remove rejected promises so an explicit retry can initialize again, and invalidate the resource when either key changes.

The client exposes these read-only configuration values and operations:

| Member | What it represents |
| --- | --- |
| `client.partner` | The `Partners` value used for configuration and configured history requests. |
| `client.chainId` | The EVM chain captured by this client. Create or retrieve another keyed client when the wallet chain changes. |
| `client.rePermitData` | The validated, trusted RePermit configuration, including the EIP-712 domain/types, base order, and protocol addresses. Treat it as read-only. |
| `client.spenderAddress` | The RePermit verifying contract. Use it for ERC-20 allowance and approval; it is also the v2 cancellation contract. |
| `client.exchangeAddress` | The configured exchange adapter automatically included in this client's history requests. |
| `client.prepareOrder(params)` | Converts a submittable form snapshot into the exact protocol order, signing request, approval request, and fresh timestamps. It performs no wallet or network operation. |
| `client.signOrder(preparedOrder, signer)` | Gives the prepared EIP-712 request to the host signer and returns the unchanged `0x` signature. It does not submit the order. |
| `client.submitOrder(preparedOrder, signature)` | Submits that exact prepared order and signature once and returns a normalized `Order`. |
| `client.getAccountOrders({ account, ...options })` | Loads normalized history with this client's partner, chain, and exchange. Options include `signal`, zero-based `page`, positive `limit`, and `legacyOrders`. |
| `client.getCancelOrderRequest(order)` | Builds the correct v1 or v2 contract address, ABI, and arguments. The host wallet sends and confirms the transaction. |

Do not fetch or reconstruct RePermit configuration in host code. The client rejects chain mismatches and malformed or zero critical addresses before exposing approval, signing, history, or cancellation values.

## Calculate the Order Form

Use `calculateOrderForm()` as the only calculation entry point. It is synchronous and time-independent, so derive it from the exact primitive form and market inputs in the host's existing computed state or memoization layer. Store only editable inputs; do not copy the calculated result into writable state.

```typescript
import { calculateOrderForm, Module, type CalculateOrderFormParams } from "@orbs-network/spot-ui";

function getCalculatedOrderForm() {
  const params = {
    module: Module.TWAP,
    inputTokenDecimals: inputToken.decimals,
    outputTokenDecimals: outputToken.decimals,

    // Raw output-token quote for this complete input amount and token pair.
    quotedOutputAmountRaw,
    inputTokenUsdPrice,
    outputTokenUsdPrice,
    minTradeSizeUsd,
    priceProtectionPercent: 3,
    displayFeePercent,
    inputBalanceRaw,

    userInput: {
      inputAmountUi,
      isMarketOrder: true,
      tradeCount,
      tradeInterval,
      orderDuration,
      limitPriceUi,
      limitPricePercent,
      triggerPriceUi,
      triggerPricePercent,
      isPriceInverted,
    },
  } satisfies CalculateOrderFormParams;

  const form = calculateOrderForm(params);

  if (!form.canSubmit) {
    renderValidationError(form.errors.primary);
  }

  return form;
}
```

### Input Values

| Value | What it represents |
| --- | --- |
| `module` | `TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`. |
| `inputTokenDecimals` / `outputTokenDecimals` | Actual token decimal precision; zero is valid. |
| `quotedOutputAmountRaw` | Current output-token base-unit quote for the complete `userInput.inputAmountUi`. Omit it while the quote is loading or stale. |
| `inputTokenUsdPrice` / `outputTokenUsdPrice` | USD value of exactly one whole token, as decimal strings. |
| `minTradeSizeUsd` | Positive minimum USD value for one fill, approved for this partner/product. |
| `priceProtectionPercent` | Execution protection in percentage units; `3` means 3%, or 300 basis points. It is separate from the normal swap slippage setting. |
| `displayFeePercent` | Optional display-only estimate used for `form.fees`; it does not collect or subtract a fee. |
| `inputBalanceRaw` | Current input-token balance as an integer base-unit string. |
| `userInput.inputAmountUi` | User-entered decimal token amount, such as `"1.25"`. The SDK derives raw and USD values. |
| `userInput.isMarketOrder` | Whether the chosen strategy uses market execution. `Module.LIMIT` remains a limit order. |
| `tradeCount` | Explicit number of TWAP fills. Preserve a user selection across amount changes; surface validation instead of silently clamping it. |
| `tradeInterval` / `orderDuration` | Controlled `{ value, unit: TimeUnit }` values. The SDK resolves their millisecond forms and validates the schedule. |
| `limitPriceUi` / `triggerPriceUi` | User-entered price in the current display direction. |
| `limitPricePercent` / `triggerPricePercent` | Percentage offset used when no explicit corresponding price was entered. |
| `isPriceInverted` | Whether the displayed price direction is input-per-output. Protocol values remain canonical. |

Track the amount and token pair that produced the DEX quote. As soon as any of them changes, omit `quotedOutputAmountRaw` until the replacement quote arrives; never calculate from a previous quote or treat it as a one-token price.

### Returned Values

| Value | What it represents |
| --- | --- |
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
| `form.canSubmit` | Whether the form is ready and has no blocking error. Use this to gate submission. |

Use `.raw` only for wallet and protocol operations, `.ui` for editable token values, and the DEX's native amount formatter for final display. Use `invertPriceInput()` when the user changes price direction instead of only swapping labels.

## Prepare and Submit an Order

Treat one click as one immutable attempt and reject concurrent submissions. Capture the current form, tokens, account, chain, and client. For native input, obtain the chain's wrapped-native `Token` from DEX configuration, wrap the full amount, then use that ERC-20 address for allowance, approval, and order preparation.

This is a plain browser TypeScript example. It creates the Viem clients once at module scope from the active chain and injected wallet provider, while the host passes the connected account with the current order inputs. Replace the example Polygon chain with the chain selected in the wallet.

```typescript
import { isNativeAddress, type CalculatedOrderForm, type Token } from "@orbs-network/spot-ui";
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
  outputToken: Token;
  wrappedNativeToken: Token;
};

export async function submitAdvancedOrder({
  account,
  form,
  inputToken,
  outputToken,
  wrappedNativeToken,
}: SubmitAdvancedOrderParams) {
  const client = await getSpotClient();
  if (!form.canSubmit) throw new Error("Order form is not ready");

  const amount = form.inputAmount.raw;
  const sourceIsNative = isNativeAddress(inputToken.address);
  const orderInputToken = sourceIsNative ? wrappedNativeToken : inputToken;

  const tokenAddress = orderInputToken.address as Address;

  if (sourceIsNative) await wrapNativeToken(account, tokenAddress, amount);
  await approveTokenIfNeeded(account, tokenAddress, client.spenderAddress, amount);

  // Prepare late so the signed start, deadline, and nonce remain fresh.
  const preparedOrder = client.prepareOrder({
    form,
    inputTokenAddress: tokenAddress,
    outputTokenAddress: outputToken.address,
    swapperAddress: account,
  });

  const signature = await client.signOrder(
    preparedOrder,
    ({ signerAddress, typedData }) =>
      walletClient.signTypedData({
        ...typedData,
        account: signerAddress,
      }),
  );

  return client.submitOrder(preparedOrder, signature);
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

Run `prepareOrder()` after wrapping and approval, immediately before signing. It rejects `form.canSubmit === false`, stamps fresh `currentTimeMillis`, `deadlineMillis`, and a monotonic client nonce, and returns `order`, `signingRequest`, `approvalRequest`, `form`, and `values`. It does not recalculate the form or perform a wallet call.

Return the wallet's original `0x`-prefixed EIP-712 signature. Do not split it into `{ v, r, s }`, alter the recovery byte, or automatically retry an ambiguous submission. Reconcile recent history before preparing another order if the first request may have reached the service.

## Fetch and Cancel Orders

### Fetch Orders

Use the initialized client so partner, chain, and exchange remain aligned with submission. Omit `page` to fetch all available pages.

```typescript
async function fetchOrders() {
  return client.getAccountOrders({
    account,
    signal: abortController.signal,
  });
}
```

Use `historyKey` for UI and cache identity because legacy numeric IDs can repeat across contract deployments. Keep `order.id` for protocol display and cancellation. History values are raw integer strings; format them with the correct token decimals. Helpers such as `getOrderFillDelayMillis`, `getOrderExecutionRate`, `getOrderLimitPriceRate`, and `getTriggerPriceRate` normalize display data.

### Cancel Order

Pass the selected order returned by `fetchOrders()` to the same initialized client.

```typescript
import type { Order } from "@orbs-network/spot-ui";

async function cancelSelectedOrder(order: Order) {
  const request = client.getCancelOrderRequest(order);
  const txHash = await wallet.cancelOrder(request);
  await refreshOrders();
  return txHash;
}
```

`getCancelOrderRequest()` selects the correct v1 or v2 contract, ABI, and arguments. The host wallet must submit it on `client.chainId`, wait for a successful receipt, prevent duplicate prompts, and refresh normalized history afterward.

## Operational Checklist

- Use the partner enum supplied by Orbs; otherwise use `Partners.Unknown`.
- Confirm support with `getPartnerChains(partner)` and cache `createClient()` by partner and chain with a retry path.
- Keep the existing DEX controls, state, current quote, wallet, chain metadata, routing, and translations.
- Derive one `CalculatedOrderForm` from current inputs; never mirror it into editable state.
- Render field errors and `form.errors.primary`, and disable submission until `form.canSubmit`.
- Supply a current raw quote for the complete input amount and omit stale data.
- Supply the wrapped-native token from host chain configuration and wrap before approval when native is selected.
- Use `client.spenderAddress`, exact raw amounts, confirmed wallet writes, and bounded post-approval verification.
- Prepare immediately before signing and submit the same prepared order with the unchanged signature once.
- Key history by `order.historyKey`; use configured history and cancellation methods from the same client.
