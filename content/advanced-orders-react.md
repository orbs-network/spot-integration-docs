# Advanced Orders · React SDK

Use `@orbs-network/spot-react` when an existing React DEX wants provider-scoped Advanced Orders state and focused hooks. The host keeps its swap state, wallet access, components, styling, translations, routing, chain metadata, and modal shell. `SpotProvider` owns the calculated form, configured client, execution state, history, and cancellation state.

The package uses `@orbs-network/spot-ui` internally. Choose [API Only](/advanced-orders/direct) for a package-free protocol integration or the [TypeScript SDK](/advanced-orders/typescript) for a non-React/headless integration.

## Integration Resources

- [React SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react)
- [React SDK API](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-react/README.md)
- [Spot React integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-react-integration)
- [Reference React implementation](https://github.com/orbs-network/spot-ui/blob/master/apps/web/components/spot/spot-form.tsx)
- [Playground](https://orbs-spot.vercel.app/?tab=twap)

## Quickstart

Keep the existing DEX swap form as the source of truth and adapt these values into `SpotProvider`:

**Input token requirement:** The signed order always spends an ERC-20 token. `inputToken` may be the native asset selected by the user, but the host must also pass the connected chain's `wrappedNativeToken`. The SDK wraps native funds when necessary, then uses that wrapped ERC-20 for allowance, approval, and signing.

| Host value | Expected shape |
| --- | --- |
| Tokens | `Token` values with `address`, `symbol`, `decimals`, and optional `logoUrl`, including a host-supplied wrapped-native token. |
| Typed input | User-facing decimal string such as `"1.25"`. |
| Market quote | Current raw output-token amount for that complete input and token pair, plus loading/no-liquidity state. |
| Balance | Raw input-token integer string, or `undefined` while disconnected/loading. |
| USD prices | USD value of exactly one whole token. Input price is required but may be `undefined` while loading. |
| Wallet | Connected `chainId`, `account`, and five `walletInteractions` methods. |
| Product policy | Orbs-provided partner enum, positive `minTradeSizeUsd`, and `priceProtectionPercent`. |

Use `Partners.Unknown` unless Orbs provided a specific enum member. Never infer the partner from a name, hostname, or chain. Validate the connected chain for that partner; if unavailable, keep the form visible and replace only the submit area with the DEX's connect-wallet or switch-network control.

## Install the React SDK

Use the host's package manager. `@orbs-network/swap-ui` is an optional helper for review/progress UI and is not required by the headless React SDK.

```bash
npm install @orbs-network/spot-react@latest
# Optional UI helper:
npm install @orbs-network/swap-ui@latest

# or: pnpm add @orbs-network/spot-react@latest
# optional: pnpm add @orbs-network/swap-ui@latest

# or: yarn add @orbs-network/spot-react@latest
# optional: yarn add @orbs-network/swap-ui@latest
```

The host must provide React `^18 || ^19`. Zustand is internal; Viem, Wagmi, and Ethers are not package dependencies. The package publishes a `"use client"` entry for Next.js App Router.

## Configure SpotProvider

Memoize adapted tokens, the market quote, wallet interactions, and callbacks by their real dependencies. The small hooks below keep token conversion and quote freshness reusable without mirroring DEX state.

```tsx
"use client";

import { useMemo } from "react";
import {
  type Callbacks,
  type ClientErrorFallbackProps,
  type MarketQuote,
  Module,
  Partners,
  SpotProvider,
  type Token,
  type WalletInteractions,
} from "@orbs-network/spot-react";

type DexCurrency = {
  address: string;
  decimals: number;
  logoUrl?: string;
  symbol: string;
};

function useSpotToken(currency?: DexCurrency): Token | undefined {
  return useMemo(
    () =>
      currency
        ? {
            address: currency.address,
            symbol: currency.symbol,
            decimals: currency.decimals,
            logoUrl: currency.logoUrl,
          }
        : undefined,
    [currency],
  );
}

function useMarketQuote({
  inputAmountUi,
  inputToken,
  isQuoteLoading,
  outputToken,
  quotedInputAmountUi,
  quotedOutputAmountRaw,
}: {
  inputAmountUi: string;
  inputToken?: Token;
  isQuoteLoading: boolean;
  outputToken?: Token;
  quotedInputAmountUi?: string;
  quotedOutputAmountRaw?: string;
}): MarketQuote {
  return useMemo(() => {
    const shouldQuote = Boolean(inputAmountUi && inputToken && outputToken);
    const isStale = shouldQuote && quotedInputAmountUi !== inputAmountUi;
    const currentOutput =
      !shouldQuote || isStale ? undefined : quotedOutputAmountRaw;
    const isLoading = shouldQuote && (isStale || isQuoteLoading);

    return {
      quotedOutputAmountRaw: currentOutput,
      isLoading,
      noLiquidity: shouldQuote && !isLoading && !currentOutput,
    };
  }, [
    inputAmountUi,
    inputToken,
    isQuoteLoading,
    outputToken,
    quotedInputAmountUi,
    quotedOutputAmountRaw,
  ]);
}

function ClientErrorFallback({
  error,
  retry,
  isRetrying,
}: ClientErrorFallbackProps) {
  return (
    <div role="alert">
      <p>{getLocalizedErrorMessage(error)}</p>
      <button disabled={isRetrying} onClick={retry} type="button">
        {isRetrying ? "Retrying…" : "Retry configuration"}
      </button>
    </div>
  );
}

export function AdvancedOrderForm({ module }: { module: Module }) {
  const dex = useDexSpotAdapter();
  const inputToken = useSpotToken(dex.inputCurrency);
  const outputToken = useSpotToken(dex.outputCurrency);
  const wrappedNativeToken = useSpotToken(dex.wrappedNativeCurrency);
  const marketQuote = useMarketQuote({
    inputAmountUi: dex.inputAmountUi,
    inputToken,
    isQuoteLoading: dex.isQuoteLoading,
    outputToken,
    quotedInputAmountUi: dex.quotedInputAmountUi,
    quotedOutputAmountRaw: dex.quotedOutputAmountRaw,
  });

  const walletInteractions = useMemo<WalletInteractions>(
    () => createWalletInteractions(dex.wallet),
    [dex.wallet],
  );
  const callbacks = useMemo<Callbacks>(
    () => ({
      onWrapSuccess: () => dex.refetchBalances(),
      onOrderCreated: () => dex.refetchBalances(),
      onOrderFilled: () => dex.refetchBalances(),
      onOrdersProgressUpdate: () => dex.refetchBalances(),
      onCancelOrderSuccess: () => dex.refetchBalances(),
    }),
    [dex.refetchBalances],
  );

  // Replace Unknown only when Orbs provides the integration's partner enum.
  const partner = Partners.Unknown;

  return (
    <SpotProvider
      account={dex.account}
      callbacks={callbacks}
      chainId={dex.chainId}
      clientErrorFallback={ClientErrorFallback}
      displayFeePercent={0.25}
      inputAmountUi={dex.inputAmountUi}
      inputBalanceRaw={dex.inputBalanceRaw}
      inputToken={inputToken}
      inputTokenUsdPrice={dex.inputTokenUsdPrice}
      marketQuote={marketQuote}
      minTradeSizeUsd={5}
      module={module}
      outputToken={outputToken}
      outputTokenUsdPrice={dex.outputTokenUsdPrice}
      partner={partner}
      priceProtectionPercent={3}
      walletInteractions={walletInteractions}
      wrappedNativeToken={wrappedNativeToken}
    >
      <SpotFormContent />
    </SpotProvider>
  );
}
```

`marketQuote.quotedOutputAmountRaw` is the current DEX quote's raw output for the complete `inputAmountUi`, not a standalone per-token price. Omit it when the quote belongs to an older amount or token pair and keep `isLoading: true` until the current quote arrives.

For a native/wrapped-native pair, the provider derives the 1:1 relationship using the host-supplied `wrappedNativeToken`. `spot-react` has no network registry: the DEX also owns chain labels and explorer URLs.

| Prop | Contract |
| --- | --- |
| `partner` | Required `Partners` value. Use `Partners.Unknown` unless Orbs provides another member. |
| `module` | `TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`. |
| `inputAmountUi` | Required user-facing input decimal string. |
| `priceProtectionPercent` | Required percentage; `3` means 3%, not 3 basis points or swap slippage. |
| `minTradeSizeUsd` | Required positive USD threshold approved for the partner; there is no SDK default. |
| `marketQuote` | Required `{ quotedOutputAmountRaw?, isLoading?, noLiquidity? }` for the current DEX quote. |
| `walletInteractions` | Required five-method wallet adapter. |
| `wrappedNativeToken` | Required host-provided `Token`; pass `undefined` only before a chain is known. |
| `inputBalanceRaw` | Required raw balance; pass `undefined` while disconnected or loading. |
| `inputTokenUsdPrice` | Required one-token USD value; pass `undefined` while loading. |
| `chainId`, `account` | Current connected wallet chain and address. |
| `inputToken`, `outputToken` | Adapted selected token metadata. |
| `outputTokenUsdPrice` | Optional one-token output USD value used for display. |
| `displayFeePercent` | Optional display estimate only; it does not collect or subtract fees. |
| `callbacks` | Optional lifecycle and controlled-field observers. |
| `overrides` | Optional initial editable state under `overrides.state`. |
| `supportLegacyOrders` | Include supported v1 history alongside current v2 orders. Defaults to `false`. |
| `clientErrorFallback` | Host-styled, retryable client-initialization error UI. |
| `errorFallback` | Host-styled fallback for unexpected calculation/render failures. |

Changing module or token pair reapplies form defaults without rebuilding unrelated provider state. Partner or chain changes re-key the configured client. Active execution keeps a frozen form, token, chain, and prepared order snapshot.

## Implement Wallet Interactions

Implement all five methods with the host's wallet stack. Transaction methods must wait for a successful receipt, reject reverted transactions, and then return the hash.

```tsx
type DexWallet = ReturnType<typeof useDexSpotAdapter>["wallet"];

function createWalletInteractions(dexWallet: DexWallet): WalletInteractions {
  return {
    wrapNativeToken: async (amountRaw) => {
      const txHash = await dexWallet.wrapNativeToken(amountRaw);
      await dexWallet.waitForReceipt(txHash);
      return txHash;
    },

    approveToken: async ({ tokenAddress, amount, spenderAddress }) => {
      const txHash = await dexWallet.approveToken({
        tokenAddress,
        amount,
        spenderAddress,
      });
      await dexWallet.waitForReceipt(txHash);
      return txHash;
    },

    cancelOrder: async ({ contractAddress, abi, args }) => {
      const txHash = await dexWallet.writeContract({
        address: contractAddress,
        abi,
        functionName: "cancel",
        args,
      });
      await dexWallet.waitForReceipt(txHash);
      return txHash;
    },

    signOrder: ({ signerAddress, typedData }) =>
      dexWallet.signTypedData({ ...typedData, account: signerAddress }),

    getAllowance: ({ tokenAddress, spenderAddress }) =>
      dexWallet.getAllowance({ tokenAddress, spenderAddress }),
  };
}
```

The SDK chooses the spender, cancellation contract/ABI/arguments, signing account, and EIP-712 payload. Adapt those exact values instead of reconstructing them. Return the original complete `0x` signature without splitting or normalizing it.

When native input is selected, the SDK uses the required `wrappedNativeToken`, calls `wrapNativeToken()` for the complete amount, checks and approves its ERC-20 address, and prepares the signed order with that same address. After approval it rechecks allowance with a bounded retry to cover RPC propagation delay.

## Build with Focused Hooks

There is no aggregate `useSpot()` API. Let each component call only the focused hooks needed by the controls and values it renders. For example, this order settings component reads the calculated form, renders its current output, and connects editable trade-count, limit-price, and price-direction controls directly to their SDK actions:

```tsx
import {
  useLimitPrice,
  useOrderForm,
  useOutputAmount,
  usePriceDisplay,
  useTrades,
} from "@orbs-network/spot-react";

function AdvancedOrderSettings() {
  const form = useOrderForm();
  const { amount: outputAmount, isLoading: isOutputLoading } =
    useOutputAmount();
  const trades = useTrades();
  const limitPrice = useLimitPrice();
  const priceDisplay = usePriceDisplay();

  return (
    <section aria-labelledby="advanced-order-settings">
      <h2 id="advanced-order-settings">Order settings</h2>

      <p aria-live="polite">
        Estimated output: {isOutputLoading ? "Loading…" : outputAmount.ui}
      </p>

      <label>
        Number of trades
        <input
          max={trades.maxTrades}
          min={1}
          onChange={(event) => trades.onChange(Number(event.target.value))}
          type="number"
          value={trades.totalTrades}
        />
      </label>
      {trades.error ? (
        <p role="alert">{getLocalizedErrorMessage(trades.error)}</p>
      ) : null}

      {limitPrice.isEnabled ? (
        <label>
          Limit price
          <input
            onChange={(event) => limitPrice.onInputChange(event.target.value)}
            value={limitPrice.price ?? ""}
          />
        </label>
      ) : null}

      <button onClick={priceDisplay.onInvert} type="button">
        Show price as {priceDisplay.displayInputToken?.symbol} per{" "}
        {priceDisplay.displayOutputToken?.symbol}
      </button>

      {!form.canSubmit && form.errors.primary ? (
        <p role="alert">{getLocalizedErrorMessage(form.errors.primary)}</p>
      ) : null}
    </section>
  );
}
```

| Hook | What it does |
| --- | --- |
| `useOrderForm()` | Returns the authoritative calculated form shared by every panel, including readiness, validation, and protocol-ready values. |
| `useOutputAmount()` | Returns the calculated `{ raw, ui, usd }` output amount and whether its market quote is loading. |
| `useTrades()` | Returns the current and maximum trade counts, per-trade amounts, validation, and the action that updates trade count. |
| `useDuration()`, `useFillDelay()` | Return controlled schedule values, change actions, resolved milliseconds, and schedule validation. |
| `useLimitPrice()`, `useTriggerPrice()` | Return display and canonical prices, percentage controls, token direction, loading state, validation, and update actions. |
| `usePriceDisplay()` | Returns the current price direction, display tokens, market-order state, and the action that safely inverts entered prices. |
| `useDisclaimer()`, `useInputErrors()` | Return translation keys and interpolation arguments for product disclaimers and the current primary validation error. |
| `useSubmitButton()` | Returns the submit button's derived `disabled` and `loading` states. |
| `useExecution()` | Starts submission and exposes the exact phase, progress steps, errors, reset actions, tokens, chain, and wrap/approval hashes. |
| `useOrders()` | Enables provider-scoped history polling while mounted and returns categorized orders, loading state, errors, and `refetch()`. |
| `useHistoryOrder()`, `useCancelOrder()` | Return display-ready data for one order and the state/action for cancelling it. |
| `useClient()` | Returns the partner-and-chain-scoped initialized client, loading state, errors, and retry support. |

Every form amount uses `{ raw, ui, usd }`. Use `.ui` for editable values and convert `.raw` with the DEX's token amount formatter. Do not render raw integer strings directly.

An explicit TWAP trade count persists after amount changes. If it exceeds the newly calculated maximum, render `useTrades().error` or `useInputErrors()` and keep submission disabled; do not silently clamp it.

## Submit and Track Execution

Use `useExecution()` for the lifecycle and `useOrderForm()` for the frozen review details. The exact phase is `idle → preparing → wrapping → approving → signing → submitting → success`, with `failed` and `rejected` terminal branches.

```tsx
import {
  useExecution,
  useSubmitButton,
} from "@orbs-network/spot-react";

function AdvancedOrderActions() {
  const execution = useExecution();
  const { disabled, loading } = useSubmitButton();

  return (
    <>
      <button
        disabled={disabled || execution.isExecuting}
        onClick={() => execution.submitOrder()}
        type="button"
      >
        {loading ? "Creating order…" : "Create order"}
      </button>

      <OrderProgress
        phase={execution.phase}
        currentStep={execution.currentStep}
        currentStepIndex={execution.currentStepIndex}
        totalSteps={execution.totalSteps}
        error={execution.error}
      />
    </>
  );
}
```

The optional `@orbs-network/swap-ui` package can render the same review/progress flow, but it has its own presentation status contract. Keep any conversion to that package inside a small view adapter instead of mixing its status enum into application or Spot execution state.

Keep the accessible modal open while `isExecuting`. `returnToOrderForm()` dismisses a failed/rejected attempt while preserving the form and reusable completed wrap. `startNewOrder()` clears internal form/retry state after a terminal attempt; the host still clears its own input after success, ideally after the modal exit animation.

Callbacks are observers for analytics, notifications, controlled field synchronization, and balance refresh. Current field callbacks are `onOrderDurationChange`, `onTradeIntervalChange`, and `onTradeCountChange`. Refetch balances after wrap, creation, fills, progress updates, and cancellation. Callback failures never change a wallet or API result.

## Order History and Cancellation

`useOrders()` enables provider-scoped history fetching only while a consumer is mounted.

```tsx
import { useOrders } from "@orbs-network/spot-react";

function OpenOrdersList() {
  const { data: orders, isLoading, isRefetching, refetch } = useOrders();

  if (isLoading) return <p aria-live="polite">Loading orders…</p>;

  return (
    <section aria-busy={isRefetching}>
      <button onClick={() => void refetch()} type="button">
        Refresh
      </button>
      <ul>
        {(orders?.open ?? []).map((order) => (
          <li key={order.historyKey}>
            <OrderRow order={order} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Store `order.historyKey` as list/cache identity and look up the current object from `orders?.all ?? []`; legacy numeric IDs can collide across deployments. `order.id` remains the protocol display/cancellation value.

```tsx
import { OrderStatus, useCancelOrder } from "@orbs-network/spot-react";

function CancelOrderButton({ order }) {
  const { cancelOrder, disabled, isLoading } = useCancelOrder(order);

  if (order.status !== OrderStatus.Open) return null;

  return (
    <button disabled={disabled || isLoading} onClick={cancelOrder} type="button">
      {isLoading ? "Cancelling…" : "Cancel order"}
    </button>
  );
}
```

Use `useHistoryOrder(order, inputToken?, outputToken?)` for display-ready amounts and fills. Keep order lists, details, cancellation controls, and context-preserving portals under `SpotProvider`. For large histories, use the DEX's existing virtualization library.

Cancellation uses the initialized client for both v1 and v2 requests, waits for the host wallet method, and refreshes history. Explorer URLs remain host-owned.

## Integration Checklist

- Default to `Partners.Unknown`; use another enum only when Orbs supplies it.
- Pass the host's `wrappedNativeToken`; `spot-react` has no network registry.
- Pass required `inputBalanceRaw` and `inputTokenUsdPrice`, using `undefined` only while their values are unavailable.
- Keep current tokens, input, quote freshness, wallet state, controls, navigation, translations, and modal ownership in the DEX.
- Use `marketQuote.quotedOutputAmountRaw` only for the exact current amount and token pair.
- Use current prop names: `inputAmountUi`, `marketQuote`, `priceProtectionPercent`, `inputBalanceRaw`, and `*TokenUsdPrice`.
- Build UI with focused hooks and keep validation visible.
- Implement all wallet methods, wait for receipts, and preserve SDK-supplied request values and signature bytes.
- Keep one immutable execution active, close only at a terminal phase, and reset after the exit animation.
- Use `historyKey` for list identity and keep history/cancellation consumers inside provider scope.
