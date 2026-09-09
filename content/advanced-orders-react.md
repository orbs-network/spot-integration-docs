# Advanced Orders · React SDK

Use `@orbs-network/spot-react` when an existing React DEX wants provider-scoped Advanced Orders state and focused hooks. The host keeps its swap state, wallet access, components, styling, translations, routing, chain metadata, and modal shell. `SpotProvider` owns the calculated form, configured client, execution state, history, and cancellation state.

The package uses `@orbs-network/spot-ui` internally. Choose [API Only](/advanced-orders/direct) for a package-free protocol integration or the [TypeScript SDK](/advanced-orders/typescript) for a non-React/headless integration.

## Integration Resources

- [React SDK package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react)
- [Spot React integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-react-integration)
- [Reference React implementation](https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx)
- [Swap UI execution helper](https://www.npmjs.com/package/@orbs-network/swap-ui)
- [Playground](https://orbs-spot.vercel.app/?tab=twap&devMode=true)

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

Memoize adapted tokens, the market quote, wallet interactions, and callbacks by their real dependencies. Keep the wallet adapter in its own hook so the provider stays focused on composing host values. The tabs show the two files together.

```tsx title="advanced-order-form.tsx"
"use client";

import { useMemo } from "react";
import { type Callbacks, type ClientErrorFallbackProps, type MarketQuote, Module, Partners, SpotProvider, type Token } from "@orbs-network/spot-react";
import { useDexDerivedData } from "./use-dex-derived-data";
import { useWalletInteractions } from "./use-wallet-interactions";
import { SpotFormContent } from "./spot-form-content";

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

function useMarketQuote(): MarketQuote {
  const dex = useDexDerivedData();
  return {
    quotedOutputAmountRaw: dex.quotedOutputAmountRaw,
    isLoading: dex.isQuoteLoading,
    noLiquidity: dex.noLiquidity,
  };
}

function ClientErrorFallback({
  error,
  retry,
  isRetrying,
}: ClientErrorFallbackProps) {
  return (
    <div role="alert">
      <p>{error.message}</p>
      <button disabled={isRetrying} onClick={retry} type="button">
        {isRetrying ? "Retrying…" : "Retry configuration"}
      </button>
    </div>
  );
}

export function AdvancedOrderForm({ module }: { module: Module }) {
  const dex = useDexDerivedData();
  const inputToken = useSpotToken(dex.inputCurrency);
  const outputToken = useSpotToken(dex.outputCurrency);
  const wrappedNativeToken = useSpotToken(dex.wrappedNativeCurrency);
  const marketQuote = useMarketQuote();
  const walletInteractions = useWalletInteractions();
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

```ts title="use-wallet-interactions.ts"
"use client";

import { useCallback, useMemo } from "react";
import type { WalletInteractions } from "@orbs-network/spot-react";
import { erc20Abi, parseAbi, type Address, type Hash } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import { useDexDerivedData } from "./use-dex-derived-data";

const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

export function useWalletInteractions(): WalletInteractions {
  const { wrappedNativeCurrency } = useDexDerivedData();
  const wrappedNativeAddress = wrappedNativeCurrency?.address;
  const { address: account } = useConnection();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const waitForSuccess = useCallback(
    async (txHash: Hash): Promise<Hash> => {
      if (!publicClient) throw new Error("Public client is unavailable");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      return txHash;
    },
    [publicClient],
  );

  const wrapNativeToken = useCallback<WalletInteractions["wrapNativeToken"]>(
    async (amountRaw) => {
      if (!walletClient || !wrappedNativeAddress) {
        throw new Error("Connect a wallet on a supported chain first");
      }

      const txHash = await walletClient.writeContract({
        account: walletClient.account,
        address: wrappedNativeAddress as Address,
        abi: wrappedNativeAbi,
        functionName: "deposit",
        value: BigInt(amountRaw),
        chain: walletClient.chain,
      });
      return waitForSuccess(txHash);
    },
    [waitForSuccess, walletClient, wrappedNativeAddress],
  );

  const approveToken = useCallback<WalletInteractions["approveToken"]>(
    async ({ tokenAddress, amount, spenderAddress }) => {
      if (!walletClient) throw new Error("Connect a wallet first");

      const txHash = await walletClient.writeContract({
        account: walletClient.account,
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddress, BigInt(amount)],
        chain: walletClient.chain,
      });
      return waitForSuccess(txHash);
    },
    [waitForSuccess, walletClient],
  );

  const cancelOrder = useCallback<WalletInteractions["cancelOrder"]>(
    async ({ contractAddress, abi, args }) => {
      if (!walletClient) throw new Error("Connect a wallet first");

      const txHash = await walletClient.writeContract({
        account: walletClient.account,
        address: contractAddress as Address,
        abi,
        functionName: "cancel",
        args,
        chain: walletClient.chain,
      });
      return waitForSuccess(txHash);
    },
    [waitForSuccess, walletClient],
  );

  const signOrder = useCallback<WalletInteractions["signOrder"]>(
    async ({ signerAddress, typedData }) => {
      if (!walletClient) throw new Error("Connect a wallet first");

      return walletClient.signTypedData({
        ...typedData,
        message: { ...typedData.message },
        account: signerAddress,
      });
    },
    [walletClient],
  );

  const getAllowance = useCallback<WalletInteractions["getAllowance"]>(
    async ({ tokenAddress, spenderAddress }) => {
      if (!publicClient || !account) throw new Error("Connect a wallet first");

      const allowance = await publicClient.readContract({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, spenderAddress],
      });
      return allowance.toString();
    },
    [account, publicClient],
  );

  return useMemo(
    () => ({
      approveToken,
      cancelOrder,
      getAllowance,
      signOrder,
      wrapNativeToken,
    }),
    [approveToken, cancelOrder, getAllowance, signOrder, wrapNativeToken],
  );
}
```

`useWalletInteractions()` adapts Wagmi's connected wallet and public clients into all five operations required by `SpotProvider`. Transaction callbacks wait for successful receipts before returning their hashes. The SDK supplies the spender, cancellation contract/ABI/arguments, signing account, and EIP-712 payload; forward those exact values instead of reconstructing them. Return the complete `0x` signature unchanged.

`marketQuote.quotedOutputAmountRaw` is the current DEX quote's raw output for the complete `inputAmountUi`, not a standalone per-token price. `useDexDerivedData()` should omit stale output, keep `isQuoteLoading: true` until the current quote arrives, and expose `noLiquidity` only for the active amount and token pair.

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

When native input is selected, the SDK uses the required `wrappedNativeToken`, calls `wrapNativeToken()` for the complete amount, checks and approves its ERC-20 address, and prepares the signed order with that same address. After approval it rechecks allowance with a bounded retry to cover RPC propagation delay.

## Build with Focused Hooks

Let each component call the focused hooks for its controls. These files adapt the reference app's trade, schedule, trigger/limit-price, and feedback panels to the current SDK. `useTranslations()` is the DEX's translation hook; it resolves the SDK's error keys and interpolation arguments using the host's messages.

```tsx title="order-settings.tsx"
import { Module, useLimitPrice, useOrderForm, useOutputAmount, usePriceDisplay, useTrades } from "@orbs-network/spot-react";
import { useTranslations } from "./use-translations";

export function AdvancedOrderSettings() {
  const t = useTranslations();
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

      {form.module === Module.TWAP && <label>
        Number of trades
        <input
          max={trades.maxTrades}
          min={1}
          onChange={(event) => trades.onChange(Number(event.target.value))}
          type="number"
          value={trades.totalTrades}
        />
      </label>}
      {trades.error ? (
        <p role="alert">{t(trades.error.type, trades.error.args)}</p>
      ) : null}

      {form.module !== Module.LIMIT && (
        <label>
          <input type="checkbox" checked={limitPrice.isEnabled} onChange={limitPrice.toggle} />
          Use a limit price
        </label>
      )}
      {limitPrice.isEnabled ? (
        <label>
          Limit price
          <input
            onChange={(event) => limitPrice.onInputChange(event.target.value)}
            value={limitPrice.price.ui}
          />
        </label>
      ) : null}

      <button onClick={priceDisplay.onInvert} type="button">
        Show price as {priceDisplay.displayInputToken?.symbol} per{" "}
        {priceDisplay.displayOutputToken?.symbol}
      </button>

      {!form.canSubmit && form.errors.primary ? (
        <p role="alert">{t(form.errors.primary.type, form.errors.primary.args)}</p>
      ) : null}
    </section>
  );
}
```

```tsx title="schedule-and-trigger.tsx"
"use client";

import { Module, TimeUnit, useDuration, useFillDelay, useOrderForm, useTriggerPrice } from "@orbs-network/spot-react";
import { useTranslations } from "./use-translations";

export function ScheduleSettings() {
  const { module } = useOrderForm();
  const duration = useDuration();
  const interval = useFillDelay();
  const t = useTranslations();
  const isTwap = module === Module.TWAP;
  const value = isTwap ? interval.fillDelay : duration.duration;
  const onInputChange = isTwap ? interval.onInputChange : duration.onInputChange;
  const onUnitSelect = isTwap ? interval.onUnitSelect : duration.onUnitSelect;
  const error = isTwap ? interval.error : duration.error;
  const units = [
    { label: "Minutes", value: TimeUnit.Minutes },
    { label: "Hours", value: TimeUnit.Hours },
    { label: "Days", value: TimeUnit.Days },
  ];

  return (
    <fieldset>
      <legend>{isTwap ? "Trade interval" : "Order duration"}</legend>
      <label>
        Value
        <input
          type="number"
          min={0}
          value={value.value ?? ""}
          onChange={(event) => onInputChange(event.target.value)}
        />
      </label>
      <label>
        Unit
        <select
          value={value.unit}
          onChange={(event) => onUnitSelect(Number(event.target.value) as TimeUnit)}
        >
          {units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
        </select>
      </label>
      {error && <p role="alert">{t(error.type, error.args)}</p>}
    </fieldset>
  );
}

export function TriggerPriceSettings() {
  const { module } = useOrderForm();
  const trigger = useTriggerPrice();
  const t = useTranslations();

  if (module !== Module.STOP_LOSS && module !== Module.TAKE_PROFIT) return null;

  return (
    <fieldset>
      <legend>{module === Module.STOP_LOSS ? "Stop-loss trigger" : "Take-profit trigger"}</legend>
      <p>1 {trigger.displayInputToken?.symbol} in {trigger.displayOutputToken?.symbol}</p>
      <label>
        Trigger price
        <input inputMode="decimal" value={trigger.price.ui} onChange={(event) => trigger.onInputChange(event.target.value)} />
      </label>
      <label>
        Difference from market (%)
        <input inputMode="decimal" value={trigger.percentage} onChange={(event) => trigger.onPercentageChange(event.target.value)} />
      </label>
      <button onClick={trigger.onReset} type="button">Reset trigger</button>
      {trigger.error && <p role="alert">{t(trigger.error.type, trigger.error.args)}</p>}
    </fieldset>
  );
}
```

```tsx title="spot-form-content.tsx"
"use client";

import { useState } from "react";
import { ORBS_TWAP_FAQ_URL, useDisclaimer } from "@orbs-network/spot-react";
import { AdvancedOrderSettings } from "./order-settings";
import { ScheduleSettings, TriggerPriceSettings } from "./schedule-and-trigger";
import { SubmitOrderDialog } from "./submit-order-dialog";
import { OrdersList } from "./orders-list";
import { useTranslations } from "./use-translations";

export function SpotFormContent() {
  const [showOrders, setShowOrders] = useState(false);
  const disclaimer = useDisclaimer();
  const t = useTranslations();

  return (
    <>
      <AdvancedOrderSettings />
      <ScheduleSettings />
      <TriggerPriceSettings />
      <SubmitOrderDialog />
      {disclaimer && (
        <p>
          {t(disclaimer)}{" "}
          <a href={ORBS_TWAP_FAQ_URL} target="_blank" rel="noreferrer">Learn more</a>
        </p>
      )}
      <button aria-expanded={showOrders} onClick={() => setShowOrders(!showOrders)} type="button">
        {showOrders ? "Hide order history" : "Show order history"}
      </button>
      {showOrders && <OrdersList />}
    </>
  );
}
```

The provider renders `SpotFormContent` alongside the host’s existing token/amount inputs. Mounting the history panel activates its shared polling; closing it removes that consumer. The submission modal and any portal-based history UI stay under the same provider.

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

Mount `SubmitOrderDialog` inside `SpotProvider`. The review button opens the modal; only its confirm button calls `submitOrder()`. These three files adapt the review, progress, and custom result panels from [orbs-spot’s submission UI](https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/submit-order.tsx) to the current React SDK.

The linked app currently uses the older `useSpot()` API. These snippets preserve its modal behavior using the current SDK's focused hooks.

The modal example uses Radix Dialog, as the reference app does. Reuse the DEX’s existing accessible dialog and icons, or install `@radix-ui/react-dialog` and `lucide-react` to use these files directly. The utility classes assume the host’s Tailwind styles and theme tokens. `useDexDerivedData().setInputAmount()` is the existing DEX input setter; every order-specific component and helper is shown below.

```tsx title="submit-order-dialog.tsx"
"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useExecution, useSubmitButton } from "@orbs-network/spot-react";
import { useDexDerivedData } from "./use-dex-derived-data";
import { OrderFlow } from "./order-flow";

export function SubmitOrderDialog() {
  const [open, setOpen] = useState(false);
  const execution = useExecution();
  const { disabled, loading } = useSubmitButton();
  const { setInputAmount } = useDexDerivedData();

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && !execution.canDismiss) return;
    setOpen(nextOpen);
  };

  // Radix calls this after the closing content unmounts, including its exit
  // animation. Keep the result visible until then; no guessed timeout is needed.
  const resetAfterClose = () => {
    if (execution.isSuccess) {
      execution.startNewOrder();
      setInputAmount("");
    } else if (execution.isFailed || execution.isRejected) {
      execution.returnToOrderForm();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button disabled={disabled} type="button">
          {loading ? "Preparing quote…" : "Review order"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-background p-6 text-foreground shadow-xl"
          onCloseAutoFocus={resetAfterClose}
          onEscapeKeyDown={(event) => {
            if (!execution.canDismiss) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (!execution.canDismiss) event.preventDefault();
          }}
        >
          <Dialog.Title className="sr-only">Advanced order</Dialog.Title>
          <Dialog.Description className="sr-only">
            Review the order, confirm wallet requests, and follow its progress.
          </Dialog.Description>

          <OrderFlow />

          <Dialog.Close asChild>
            <button disabled={!execution.canDismiss} type="button">
              {execution.isSuccess ? "Done" : "Close"}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

```tsx title="order-flow.tsx"
"use client";

import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { SwapFlow, SwapStatus } from "@orbs-network/swap-ui";
import { ExecutionPhase, Steps, type SpotExecutionData, type Token, useExecution, useOrderForm } from "@orbs-network/spot-react";
import { useConfig } from "wagmi";
import { OrderReview } from "./order-review";

export function OrderFlow() {
  const execution = useExecution();
  const form = useOrderForm();

  return (
    <SwapFlow
      inAmount={form.inputAmount.ui}
      outAmount={form.outputAmount.ui}
      inToken={execution.inputToken}
      outToken={execution.outputToken}
      swapStatus={getSwapUiStatus(execution)}
      currentStepIndex={execution.currentStepIndex}
      totalSteps={execution.totalSteps}
      components={{
        // Main covers review and every active phase. Results replace it.
        Main: execution.isExecuting ? <OrderProgress /> : <OrderReview />,
        Success: <OrderSuccess />,
        Failed: <OrderFailure />,
        SrcTokenLogo: <TokenLogo token={execution.inputToken} />,
        DstTokenLogo: <TokenLogo token={execution.outputToken} />,
        Loader: <LoaderCircle aria-hidden="true" className="size-10 animate-spin motion-reduce:animate-none" />,
        SuccessIcon: <Check aria-hidden="true" className="size-10 text-green-600" />,
        FailedIcon: <TriangleAlert aria-hidden="true" className="size-10 text-red-600" />,
      }}
    />
  );
}

// Only this view adapter knows about swap-ui's presentation enum.
function getSwapUiStatus(execution: SpotExecutionData): SwapStatus | undefined {
  if (execution.isSuccess) return SwapStatus.SUCCESS;
  if (execution.isFailed || execution.isRejected) return SwapStatus.FAILED;
  if (execution.isExecuting) return SwapStatus.LOADING;
  return undefined;
}

function OrderProgress() {
  const execution = useExecution();
  const steps = execution.executionSteps ?? [];
  const stepLabels = {
    [Steps.WRAP]: "Wrap native input",
    [Steps.APPROVE]: "Approve input token",
    [Steps.CREATE]: "Create order",
  };
  const progress = getProgressContent(execution.phase);
  const activeIndex = execution.currentStepIndex ?? 0;

  return (
    <div role="status" aria-live="polite" className="w-full space-y-4">
      <SwapFlow.StepLayout
        title={progress.title}
        body={<p>{progress.message}</p>}
      />
      <ol aria-label="Order creation steps">
        {steps.map((step, index) => (
          <li key={step} aria-current={index === activeIndex ? "step" : undefined}>
            {index < activeIndex ? "✓ " : (index + 1) + ". "}
            {stepLabels[step]}
          </li>
        ))}
      </ol>
      <ExecutionTransactions />
    </div>
  );
}

function getProgressContent(phase: ExecutionPhase) {
  switch (phase) {
    case ExecutionPhase.PREPARING:
      return {
        title: "Preparing order",
        message: "Checking token allowance and calculating the required steps.",
      };
    case ExecutionPhase.WRAPPING:
      return {
        title: "Wrap native input",
        message: "Confirm wrapping in your wallet, then wait for confirmation. The order spends the wrapped ERC-20 token.",
      };
    case ExecutionPhase.APPROVING:
      return {
        title: "Approve input token",
        message: "Approve the SDK-provided spender in your wallet. Waiting for the transaction and updated allowance.",
      };
    case ExecutionPhase.SIGNING:
      return {
        title: "Sign order",
        message: "Review and sign the EIP-712 order in your wallet.",
      };
    case ExecutionPhase.SUBMITTING:
      return {
        title: "Submitting order",
        message: "Your signature is ready. Waiting for the order service to accept the order.",
      };
    default:
      return { title: "Order progress", message: "" };
  }
}

function OrderSuccess() {
  const execution = useExecution();
  const form = useOrderForm();

  return (
    <div role="status" className="w-full space-y-4">
      <SwapFlow.StepLayout
        title="Order created"
        body={
          <>
            <p>{form.inputAmount.ui} {execution.inputToken?.symbol}</p>
            <p>Estimated output: {form.outputAmount.ui} {execution.outputToken?.symbol}</p>
            <p>Your order was accepted. Follow its fills in order history.</p>
          </>
        }
      />
      <WrappedFundsNotice />
      <ExecutionTransactions />
    </div>
  );
}

function OrderFailure() {
  const execution = useExecution();

  return (
    <div role="alert" className="w-full space-y-4">
      <SwapFlow.StepLayout
        title={execution.isRejected ? "Wallet request declined" : "Order creation failed"}
        body={
          <>
            <p>{execution.error?.message || "Review the order and try again."}</p>
            {execution.error?.code ? <p>Error code: {execution.error.code}</p> : null}
            <WrappedFundsNotice />
          </>
        }
      />
      <ExecutionTransactions />
      <button onClick={() => execution.returnToOrderForm()} type="button">
        Back to review
      </button>
    </div>
  );
}

function WrappedFundsNotice() {
  const { wrapTxHash } = useExecution();
  if (!wrapTxHash) return null;

  return <p>The native-token wrap completed. Closing this dialog does not undo it.</p>;
}

function ExecutionTransactions() {
  const { chainId, wrapTxHash, approvalTxHash } = useExecution();
  const { chains } = useConfig();
  // Use the frozen execution chain, even if the connected wallet has changed.
  const explorer = chains.find((chain) => chain.id === chainId)?.blockExplorers?.default.url;
  const transactions = [
    { label: "Wrap transaction", hash: wrapTxHash },
    { label: "Approval transaction", hash: approvalTxHash },
  ].filter((transaction) => transaction.hash);

  return (
    <ul>
      {transactions.map(({ label, hash }) => (
        <li key={hash}>
          {explorer ? (
            <a href={explorer + "/tx/" + hash} target="_blank" rel="noreferrer">
              {label}
            </a>
          ) : (
            <span>{label}: {hash}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function TokenLogo({ token }: { token?: Token }) {
  return token?.logoUrl ? (
    <img src={token.logoUrl} alt="" width={32} height={32} className="rounded-full" />
  ) : (
    <span aria-hidden="true">{token?.symbol?.slice(0, 1)}</span>
  );
}
```

```tsx title="order-review.tsx"
"use client";

import { useState } from "react";
import { SwapFlow } from "@orbs-network/swap-ui";
import { DISCLAIMER_URL, Module, useExecution, useOrderForm, useSubmitButton } from "@orbs-network/spot-react";

export function OrderReview() {
  const [accepted, setAccepted] = useState(false);
  const execution = useExecution();
  const form = useOrderForm();
  const { disabled, loading } = useSubmitButton();
  const input = execution.inputToken?.symbol;
  const output = execution.outputToken?.symbol;
  const priceInput = form.isInverted ? output : input;
  const priceOutput = form.isInverted ? input : output;
  const orderNames = {
    [Module.TWAP]: "TWAP",
    [Module.LIMIT]: "Limit",
    [Module.STOP_LOSS]: "Stop loss",
    [Module.TAKE_PROFIT]: "Take profit",
  };

  return (
    <section className="w-full space-y-4">
      <h2>Review {orderNames[form.module]} order</h2>
      <SwapFlow.Main
        fromTitle="Pay"
        toTitle="Estimated output"
        inUsd={form.inputAmount.usd ? "$" + form.inputAmount.usd : undefined}
        outUsd={form.outputAmount.usd ? "$" + form.outputAmount.usd : undefined}
      />

      <dl>
        <dt>Duration from submission</dt>
        <dd>{formatDuration(form.schedule.durationMillis)}</dd>

        {form.triggerPrice.enabled && (
          <>
            <dt>Trigger price</dt>
            <dd>1 {priceInput} = {form.triggerPrice.display.ui} {priceOutput}</dd>
          </>
        )}
        {!form.values.isMarketOrder && (
          <>
            <dt>Limit price</dt>
            <dd>1 {priceInput} = {form.limitPrice.display.ui} {priceOutput}</dd>
          </>
        )}
        <dt>{form.trades.totalTrades > 1 ? "Minimum received per trade" : "Minimum received"}</dt>
        <dd>{form.trades.minOutputAmountPerTrade.ui} {output}</dd>

        {form.trades.totalTrades > 1 && (
          <>
            <dt>Number of trades</dt>
            <dd>{form.trades.totalTrades}</dd>
            <dt>Input per trade</dt>
            <dd>{form.trades.inputAmountPerTrade.ui} {input}</dd>
            <dt>Trade interval</dt>
            <dd>{formatDuration(form.schedule.fillDelayMillis)}</dd>
          </>
        )}
        {form.fees.percentage > 0 && (
          <>
            <dt>Estimated fee ({form.fees.percentage}%)</dt>
            <dd>{form.fees.ui} {output}</dd>
          </>
        )}
      </dl>

      <label>
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        {" "}I accept the{" "}
        <a href={DISCLAIMER_URL} target="_blank" rel="noreferrer">order disclaimer</a>
      </label>
      <button disabled={!accepted || disabled} onClick={execution.submitOrder} type="button">
        {loading ? "Preparing order…" : "Submit order"}
      </button>
    </section>
  );
}

function formatDuration(milliseconds: number): string {
  if (milliseconds >= 86_400_000) return (milliseconds / 86_400_000) + " days";
  if (milliseconds >= 3_600_000) return (milliseconds / 3_600_000) + " hours";
  return (milliseconds / 60_000) + " minutes";
}
```

| Execution condition | Modal content |
| --- | --- |
| `phase === ExecutionPhase.IDLE` | Token preview, duration/prices/trade details, disclaimer, and submit button. |
| `phase === ExecutionPhase.PREPARING` | Allowance check and step-plan loading UI. |
| `phase === ExecutionPhase.WRAPPING` | Native-to-ERC-20 wrap instructions and transaction confirmation. |
| `phase === ExecutionPhase.APPROVING` | Approval instructions and allowance confirmation. |
| `phase === ExecutionPhase.SIGNING` | Wallet EIP-712 signature prompt. |
| `phase === ExecutionPhase.SUBMITTING` | Waiting for service acceptance; no additional wallet confirmation. |
| `isSuccess` | Custom order-created summary. Creation success does not mean the order is filled. |
| `isFailed` or `isRejected` | Custom error or declined-request screen, completed transaction links, and back-to-review action. |

`SwapFlow` selects `Success` or `Failed` using `getSwapUiStatus()`. Otherwise, `Main` explicitly chooses progress while `isExecuting` and review while idle. This keeps the confirm button and review details out of every active and terminal screen. `StepLayout`, `Loader`, token-logo slots, and the success/failure icons provide the custom UI; the only status conversion is inside this view adapter.

The SDK builds `executionSteps`: wrapping appears only when needed, approval appears only when allowance is insufficient, and signing/submission share the create-order step. Use its zero-based `currentStepIndex` and `totalSteps`. `useOrderForm()` and the tokens/chain from `useExecution()` retain the active attempt’s snapshot while the DEX’s inputs change.

All close paths respect `canDismiss`. After the dialog exits, success calls `startNewOrder()` and clears the host input; failure or rejection calls `returnToOrderForm()` and preserves the form and reusable completed wrap. “Back to review” performs the latter reset while keeping the modal open. If the host uses another dialog, connect the same reset to its exit-complete callback. Use the host’s number formatter and translations for production display.

Callbacks are observers for notifications, field synchronization, and balance refresh. Refetch balances after wrap, creation, fills, progress updates, and cancellation. Callback failures never change a wallet or API result.

## Order History and Cancellation

`useOrders()` enables provider-scoped history fetching while mounted. The list and detail files follow the reference app’s filters, selected-order view, fill list, and cancellation feedback. Keep them under `SpotProvider`, including when the DEX renders them in a modal or portal.

```tsx title="orders-list.tsx"
"use client";

import { useState } from "react";
import { useOrders } from "@orbs-network/spot-react";
import { useConnection } from "wagmi";
import { OrderDetails } from "./order-details";

export function OrdersList() {
  const { address } = useConnection();
  const { data: orders, error, isLoading, isRefetching, refetch } = useOrders();
  const filters = ["all", "open", "completed", "cancelled", "expired"] as const;
  const [filter, setFilter] = useState<(typeof filters)[number]>("open");
  const [selectedKey, setSelectedKey] = useState<string>();

  // Resolve from all orders so a background update or cancellation refreshes
  // the open details even when that order leaves the selected filter.
  const selectedOrder = orders?.all.find((order) => order.historyKey === selectedKey);

  if (!address) return <p>Connect a wallet to view orders.</p>;
  if (isLoading) return <p role="status">Loading orders…</p>;

  return (
    <section aria-label="Order history" aria-busy={isRefetching}>
      {error && <p role="alert">{error.message}</p>}
      <button disabled={isRefetching} onClick={() => void refetch()} type="button">
        {isRefetching ? "Refreshing…" : "Refresh"}
      </button>
      {selectedOrder ? (
        <>
          <button onClick={() => setSelectedKey(undefined)} type="button">Back to orders</button>
          <OrderDetails key={selectedOrder.historyKey} order={selectedOrder} />
        </>
      ) : (
        <>
          <label>
            Filter orders
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              {filters.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <ul>
            {(orders?.[filter] ?? []).map((order) => (
              <li key={order.historyKey}>
                <button onClick={() => setSelectedKey(order.historyKey)} type="button">
                  {order.type} · {order.id} · {order.status}
                </button>
                <progress aria-label="Order fill progress" max={100} value={order.progress} />
              </li>
            ))}
          </ul>
          {!error && orders?.[filter].length === 0 && <p>No {filter} orders.</p>}
        </>
      )}
    </section>
  );
}
```

```tsx title="order-details.tsx"
"use client";

import { OrderStatus, type Order, useCancelOrder, useHistoryOrder } from "@orbs-network/spot-react";
import { useConfig } from "wagmi";
import { useCurrency } from "./use-currency";

export function OrderDetails({ order }: { order: Order }) {
  // Resolve metadata for this order, not the tokens currently selected to swap.
  const inputToken = useCurrency(order.srcTokenAddress);
  const outputToken = useCurrency(order.dstTokenAddress);
  const details = useHistoryOrder(order, inputToken, outputToken);
  const cancellation = useCancelOrder(order);
  const { chains } = useConfig();
  const explorer = chains.find((chain) => chain.id === order.chainId)?.blockExplorers?.default.url;

  if (!details || !inputToken || !outputToken) return <p role="status">Loading token details…</p>;

  return (
    <article>
      <h3>{inputToken.symbol} → {outputToken.symbol}</h3>
      <p>Status: {order.status}</p>
      <dl>
        <dt>Order ID</dt><dd>{order.id}</dd>
        <dt>Input amount</dt><dd>{details.inputAmount.ui} {inputToken.symbol}</dd>
        <dt>Input filled</dt><dd>{details.inputAmountFilled.ui} {inputToken.symbol}</dd>
        <dt>Output received</dt><dd>{details.outputAmountFilled.ui} {outputToken.symbol}</dd>
        <dt>Fill progress</dt><dd>{details.progress}%</dd>
        <dt>Minimum output per trade</dt><dd>{details.minOutputAmountPerTrade.ui} {outputToken.symbol}</dd>
      </dl>
      <details>
        <summary>Fills ({details.fills.length})</summary>
        <ul>
          {details.fills.map((fill, index) => (
            <li key={fill.txHash + "-" + index}>
              {fill.inputAmount.ui} {inputToken.symbol} → {fill.outputAmount.ui} {outputToken.symbol}
              {" "}{explorer ? (
                <a href={explorer + "/tx/" + fill.txHash} target="_blank" rel="noreferrer">View fill</a>
              ) : <span>{fill.txHash}</span>}
            </li>
          ))}
        </ul>
      </details>

      {order.status === OrderStatus.Open && !cancellation.isSuccess && (
        <button
          disabled={cancellation.disabled || cancellation.isLoading}
          onClick={() => void cancellation.cancelOrder()}
          type="button"
        >
          {cancellation.isLoading ? "Cancelling…" : "Cancel order"}
        </button>
      )}
      {cancellation.error && <p role="alert">{cancellation.error}</p>}
      {cancellation.isSuccess && <p role="status">Order cancelled.</p>}
      {explorer && cancellation.txHash && (
        <a href={explorer + "/tx/" + cancellation.txHash} target="_blank" rel="noreferrer">Cancellation transaction</a>
      )}
    </article>
  );
}
```

`useCurrency(address)` is the host’s token-registry hook, returning metadata with `address`, `symbol`, `decimals`, and optional `logoUrl` for the active chain. Its lookup must use the history order’s token addresses. This lets `useHistoryOrder()` format raw amounts and fills correctly even when the swap form displays another pair.

Store `historyKey` as list/selection identity and resolve the current object from `orders.all`; legacy IDs can collide across deployments. `id` remains the protocol display/cancellation value. `useCancelOrder()` handles the wallet request, cancellation state, and cache update; it exposes errors and the confirmed hash without an extra host refetch parameter. For large histories, reuse the DEX’s existing virtualization library.

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
