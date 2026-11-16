# Advanced Orders · React SDK

Add scheduled or price-based trades to an existing **React app**. `@orbs-network/spot-react` supplies state and hooks; you build the controls and connect your wallet and market data. It uses the Orbs Spot protocol.

Use `AdvancedOrdersProvider` for TWAP, limit, stop-loss, and take-profit forms. Swaps use the [Spot swap SDK flow](/swap) through this package's SDK re-exports: the host wraps and approves, calls `client.prepareSwap()`, signs inline, submits with `client.submitSwap()`, and polls status. Swaps have no provider or calculated order form.

Follow this guide in order; setup requirements and implementation details are included as you need them. The goal is to create one order, track its fills in history, and cancel an open order. Order creation does not mean the trade has filled.

## Quickstart

### Implementation Order

Install the packages, implement the provider and wallet adapter, then add the form, review/progress screens, and history. The code is split into named files; later steps supply some of the imports used in earlier ones.

### React SDK Examples

- [React SDK example in spot-ui](https://github.com/orbs-network/spot-ui/tree/master/apps/web/components/spot) — form, order submission, history, and cancellation components.
- [AdvancedOrdersProvider setup example](https://github.com/orbs-network/spot-ui/blob/master/apps/web/components/spot/spot-form.tsx).

### Before You Start

Set a finite positive `minTradeSizeUsd` on `AdvancedOrdersProvider` according to the host's minimum-trade policy, for example `10`, `25`, or `50`. This is the minimum amount in USD for each individual trade. For example, `minTradeSizeUsd: 25` means every trade must be worth at least $25. For TWAP orders, each smaller trade must meet this minimum; it is not the total order amount.

Have these app values available before connecting the SDK:

- A connected wallet account and chain, with RPC reads and wallet transactions on that same chain.
- Input/output token addresses and decimals, plus the chain’s wrapped-native token.
- The input-token balance, gas balance, a current quote for the full input amount, and token USD prices.
- Your existing DEX partner enum, or `Partners.External`. The provider must initialize successfully for that partner and chain before submission.

The installation commands below list the packages to add. Your existing wallet, token registry, quote, balance, and price sources supply these values.

Mount one `AdvancedOrdersProvider` around the form, submission dialog, and history consumers. The wallet adapter needs six methods: decide whether wrapping is needed, check whether approval is needed, wrap native input, approve tokens, sign an order, and cancel an order. The following steps implement these operations before connecting the form and submission dialog. The SDK supplies provider state and execution orchestration; your app supplies wallet access, data, controls, and presentation.

### Install the React SDK

Use your app’s package manager. The SDK is headless: it supplies state and behavior. The full dialog example also imports `@orbs-network/swap-ui` and `@radix-ui/react-dialog`; install those if copying it. Use your existing wallet provider or library to implement `walletInteractions`. The wallet adapter example illustrates this with Viem and Wagmi v3; adapt its calls to your wallet setup.

```bash
npm install @orbs-network/spot-react
# Optional UI helper:
npm install @orbs-network/swap-ui @radix-ui/react-dialog

# or: pnpm add @orbs-network/spot-react
# optional: pnpm add @orbs-network/swap-ui @radix-ui/react-dialog

# or: yarn add @orbs-network/spot-react
# optional: yarn add @orbs-network/swap-ui @radix-ui/react-dialog
```

The copied UI also imports `lucide-react` for icons. Install it if your app does not already use it.

The wallet adapter examples target **Wagmi v3**, including `useConnection`. Wagmi v2 applications should adapt their existing `useAccount`-based wallet layer to the same `walletInteractions` contract. Wagmi is supplied by the host and is not required by the headless SDK.

The host must provide React `^18 || ^19`. Zustand is internal; Viem, Wagmi, and Ethers are not package dependencies. The package publishes a `"use client"` entry for Next.js App Router.

Inspect installed exports, React peers, and lockfile versions before adding or changing dependencies. Read `node_modules/@orbs-network/spot-react/dist/integration-skills/spot-advanced-orders-react-integration/SKILL.md` and compare its adjacent `manifest.json.sdkVersion` with the installed package. For an older release without a bundle, use the [Advanced Orders React integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-advanced-orders-react-integration) from a matching release or checkout. Read only the references needed for the requested form, execution, or history surface. SDK code imports remain public-package-root-only; reading bundled documentation under `dist` is allowed.

Provider-free swaps follow `spot-swap-integration`, bundled in the resolved `@orbs-network/spot-ui` dependency at `dist/integration-skills/spot-swap-integration/SKILL.md`. A separate core install is unnecessary. Framework-neutral advanced forms use `spot-advanced-orders-integration`. If the host lacks trading services, build the missing wallet, verified chain/token registry, balances, quote/price resources, and UI described in [Overview & Setup](/advanced-orders/shared#integration-options), keeping an existing application's stack and the requested scope.

## Configure AdvancedOrdersProvider

`OrderType` selects the advanced form: `TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`. `OrderVariant` identifies a detailed protocol/history variant; it appears as `form.values.orderVariant` and `order.type`, and includes historical swaps.

Create `advanced-order-form.tsx` to connect host values to one provider. The component imports `use-wallet-interactions.ts` and `spot-form-content.tsx`, which you will add in the following steps. Keep the provider, form, submission dialog, and history under the same React tree. Memoize adapted tokens, wallet interactions, and callbacks by their real dependencies.

```tsx title="advanced-order-form.tsx"
"use client";

import { useMemo } from "react";
import { type Callbacks, type SpotErrorFallbackProps, type MarketQuote, OrderType, Partners, AdvancedOrdersProvider, type Token } from "@orbs-network/spot-react";
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
  return useMemo(
    () => ({
      quotedOutputAmountRaw: dex.isQuoteLoading ? undefined : dex.quotedOutputAmountRaw,
      isLoading: dex.isQuoteLoading,
      noLiquidity: dex.noLiquidity,
    }),
    [dex.quotedOutputAmountRaw, dex.isQuoteLoading, dex.noLiquidity],
  );
}

function ErrorFallback({
  error,
  retry,
  isRetrying,
}: SpotErrorFallbackProps) {
  return (
    <div role="alert">
      <p>{error.message}</p>
      <button disabled={isRetrying} onClick={retry} type="button">
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

export function AdvancedOrderForm({ orderType }: { orderType: OrderType }) {
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

  // Use Partners.External, or the partner provided by the Orbs team.
  const partner = Partners.External;

  return (
    <AdvancedOrdersProvider
      account={dex.account}
      callbacks={callbacks}
      chainId={dex.chainId}
      errorFallback={ErrorFallback}
      // Optional display estimate; fee collection is configured separately.
      displayFeePercent={0.25}
      inputAmountUi={dex.inputAmountUi}
      inputBalanceRaw={dex.inputBalanceRaw}
      inputToken={inputToken}
      inputTokenUsdPrice={dex.inputTokenUsdPrice}
      marketQuote={marketQuote}
      minTradeSizeUsd={10}
      orderType={orderType}
      outputToken={outputToken}
      outputTokenUsdPrice={dex.outputTokenUsdPrice}
      partner={partner}
      priceProtectionPercent={3}
      walletInteractions={walletInteractions}
      wrappedNativeToken={wrappedNativeToken}
    >
      <SpotFormContent />
    </AdvancedOrdersProvider>
  );
}
```

### Check Provider Inputs

**Checkpoint:** once the wallet adapter and form components are in place, render the provider with the connected account, active chain, real tokens, balance, and quote. Loading or missing data must keep submission disabled; a configuration failure must show a retry action.

`marketQuote.quotedOutputAmountRaw` is the current DEX quote's raw output for the complete `inputAmountUi`, not a standalone per-token price. `useDexDerivedData()` must withhold stale output, keep `isQuoteLoading: true` until the current amount and pair's quote arrives, and expose `noLiquidity` only for that request. If the host obtains Spot quotes, map the current `quote.netAmountOut` to `quotedOutputAmountRaw`.

`MarketQuote` contains only `quotedOutputAmountRaw`, `isLoading`, and `noLiquidity`. Pass token USD prices through the separate provider props. The provider derives amounts and prices from this bridge; the original `SwapQuote` remains in the host's provider-free swap flow.

For a native/wrapped-native pair, the provider derives the 1:1 relationship using the host-supplied `wrappedNativeToken`. `spot-react` has no network registry: the DEX also owns chain labels and explorer URLs.

| Prop | Contract |
| --- | --- |
| `partner` | Required `Partners` value. Use `Partners.External` unless Orbs provides another member. |
| `orderType` | Required `OrderType`: `TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`. |
| `inputAmountUi` | Required user-facing input decimal string. |
| `priceProtectionPercent` | Required finite percentage from 0 through 50; `3` means 3% signed oracle protection. |
| `minTradeSizeUsd` | Required finite positive minimum amount in USD for each individual trade, set by the host; there is no SDK default. For TWAP, it applies to each smaller trade. |
| `marketQuote` | Required current quote state with optional `quotedOutputAmountRaw`, `isLoading`, and `noLiquidity`. |
| `walletInteractions` | Required six-method wallet adapter. |
| `wrappedNativeToken` | Required host-provided `Token`; pass `undefined` only before a chain is known. |
| `inputBalanceRaw` | Required raw balance; pass `undefined` while disconnected or loading. |
| `inputTokenUsdPrice` | Required prop containing a one-token USD value or `undefined`. Provide the unit price for USD readiness; `MarketQuote` has no USD-total fields. |
| `chainId`, `account` | Current connected wallet chain and address. |
| `inputToken`, `outputToken` | Adapted selected token metadata. |
| `outputTokenUsdPrice` | Optional one-token output USD value used for display. |
| `displayFeePercent` | Optional display estimate only; it does not collect or subtract fees. |
| `callbacks` | Optional lifecycle and controlled-field observers. |
| `overrides` | Optional initial editable state under `overrides.state`. |
| `supportLegacyOrders` | Include supported v1 history alongside current v2 orders. Defaults to `false`. |
| `errorFallback` | A `ComponentType<SpotErrorFallbackProps>` for retryable initialization and calculation/render failures. |
| `disableAnalytics` | Optional client analytics opt-out; defaults to `false`. |

Changing order type or token pair reapplies form defaults without rebuilding unrelated provider state. During active or unconfirmed execution, the reset waits until the attempt finishes or the user explicitly calls `startNewOrder()`. Changing `overrides.state` updates future reset defaults without wiping current fields. Partner or chain changes re-key the configured client. Active execution keeps a frozen form, token, chain, and prepared order snapshot. Initialization retries twice before rendering `errorFallback` alongside the mounted children; the fallback receives `error`, async `retry`, and `isRetrying`.

When native input is selected, the SDK uses the required `wrappedNativeToken`, calls `shouldWrap()` before `wrapNativeToken()` for the complete amount, checks and approves its ERC-20 address, and prepares the signed order with that same address. After each approval receipt it calls `shouldApprove()` again and can request a second approval if needed. Keep RPC allowance reads current; a transaction hash alone does not prove enough allowance was granted.

## Implement Wallet Interactions

Create `use-wallet-interactions.ts`, imported by the provider in the previous step. Implement all six methods: `shouldWrap`, `shouldApprove`, `wrapNativeToken`, `approveToken`, `signOrder`, and `cancelOrder`. Reads and signatures are different from transactions: wrap, approve, and cancel must wait for successful receipts.

```ts title="use-wallet-interactions.ts"
"use client";

import { useCallback, useMemo } from "react";
import type { WalletInteractions } from "@orbs-network/spot-react";
import { erc20Abi, parseAbi, type Address, type Hash } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import { useDexDerivedData } from "./use-dex-derived-data";

const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

export function useWalletInteractions(): WalletInteractions {
  // The host identifies native input using its existing currency model.
  const { inputIsNative, wrappedNativeCurrency } = useDexDerivedData();
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

  const shouldWrap = useCallback<WalletInteractions["shouldWrap"]>(
    () => inputIsNative,
    [inputIsNative],
  );

  const shouldApprove = useCallback<WalletInteractions["shouldApprove"]>(
    async ({ tokenAddress, spenderAddress, amount }) => {
      if (!publicClient || !account) throw new Error("Connect a wallet first");

      const allowance = await publicClient.readContract({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, spenderAddress],
      });
      return allowance < BigInt(amount);
    },
    [account, publicClient],
  );

  return useMemo(
    () => ({
      approveToken,
      cancelOrder,
      shouldWrap,
      shouldApprove,
      signOrder,
      wrapNativeToken,
    }),
    [approveToken, cancelOrder, shouldWrap, shouldApprove, signOrder, wrapNativeToken],
  );
}
```

`useWalletInteractions()` adapts Wagmi's connected wallet and public clients into all six methods required by `AdvancedOrdersProvider`. Transaction callbacks wait for successful receipts before returning their hashes. The SDK supplies the spender, cancellation contract/ABI/arguments, signing account, and EIP-712 payload; forward those exact values instead of reconstructing them. Return the complete `0x` signature unchanged. `shouldApprove()` compares live allowance with the exact required `request.amount`, including after approval receipts. `request.approvalAmount` is a suggested cap, defaulting to maximum uint256; this example deliberately approves the exact `amount` instead. Do not mutate the SDK request. `inputIsNative` comes from the host currency model and must describe the captured input selection.

Import `WalletInteractions`, `AllowanceRequest`, `GetAllowanceProps`, `WalletInteractionError`, and `WalletInteractionErrorCode` from `@orbs-network/spot-react` when needed. React preserves `WRAP_FAILED`, `APPROVAL_FAILED`, and `INSUFFICIENT_ALLOWANCE` classifications; these belong to the React host layer rather than the core `SpotErrorCode` union. Core `Eip712TypedData`, `OrderSigningRequest`, and `ApprovalRequest` remain protocol-preparation types re-exported by React. False `shouldWrap`/`shouldApprove` results skip writes; invoked transaction callbacks must return confirmed hashes and throw on failure.

To test the EIP-712 payload during integration, copy the `typedData` received by `walletInteractions.signOrder()` before calling `walletClient.signTypedData()`. Paste it as JSON, including `domain`, `types`, `primaryType`, and `message`, into the [EIP-712 Order Preview](https://playground.orbs.network/developers/eip712) and select **Preview order**. Check the displayed amounts and execution conditions before signing. The preview does not sign or submit the order.

## Build with Focused Hooks

Let each component call the focused hooks for its controls. These files adapt the reference app's trade, schedule, trigger/limit-price, and feedback panels to the current SDK. `useTranslations()` is the DEX's translation hook; it resolves the SDK's error keys and interpolation arguments using the host's messages.

```tsx title="order-settings.tsx"
import { OrderType, useLimitPrice, useOrderForm, useOutputAmount, usePriceDisplay, useTrades } from "@orbs-network/spot-react";
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

      {form.orderType === OrderType.TWAP && <label>
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

      {form.orderType !== OrderType.LIMIT && (
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

### Add Schedule and Trigger Controls

Create `schedule-and-trigger.tsx` for the selected order type. TWAP uses a delay between trades; the other types use an order duration. Stop-loss and take-profit also need a trigger price. Keep these components inside `AdvancedOrdersProvider` so validation and price direction stay consistent.

```tsx title="schedule-and-trigger.tsx"
"use client";

import { OrderType, TimeUnit, useDuration, useFillDelay, useOrderForm, useTriggerPrice } from "@orbs-network/spot-react";
import { useTranslations } from "./use-translations";

export function ScheduleSettings() {
  const { orderType } = useOrderForm();
  const duration = useDuration();
  const interval = useFillDelay();
  const t = useTranslations();
  const isTwap = orderType === OrderType.TWAP;
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
  const { orderType } = useOrderForm();
  const trigger = useTriggerPrice();
  const t = useTranslations();

  if (orderType !== OrderType.STOP_LOSS && orderType !== OrderType.TAKE_PROFIT) return null;

  return (
    <fieldset>
      <legend>{orderType === OrderType.STOP_LOSS ? "Stop-loss trigger" : "Take-profit trigger"}</legend>
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

### Assemble the Order Form

Create `spot-form-content.tsx` to compose the controls. Its dialog and history imports are implemented in the following steps; add all referenced files before expecting the full example to compile. Your existing token selectors and amount input remain owned by your app.

```tsx title="spot-form-content.tsx"
"use client";

import { useState } from "react";
import { ORBS_TWAP_FAQ_URL, useDisclaimer, useExecution } from "@orbs-network/spot-react";
import { AdvancedOrderSettings } from "./order-settings";
import { ScheduleSettings, TriggerPriceSettings } from "./schedule-and-trigger";
import { SubmitOrderDialog } from "./submit-order-dialog";
import { OrdersList } from "./orders-list";
import { useTranslations } from "./use-translations";

export function SpotFormContent() {
  const [showOrders, setShowOrders] = useState(false);
  const disclaimer = useDisclaimer();
  const execution = useExecution();
  const t = useTranslations();

  return (
    <>
      <AdvancedOrderSettings />
      <ScheduleSettings />
      <TriggerPriceSettings />
      <SubmitOrderDialog />
      {execution.hasUnconfirmedExecutions && (
        <button
          disabled={execution.isCheckingOrderStatus}
          onClick={() => execution.checkOrderStatus()}
          type="button"
        >
          {execution.isCheckingOrderStatus ? "Checking previous orders…" : "Check unresolved orders"}
        </button>
      )}
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
| `useSubmitButton()` | Returns derived `disabled`, `loading`, and actionable `disabledReason` states. |
| `useExecution()` | Starts submission and exposes the exact phase, progress steps, errors, reset actions, tokens, chain, and wrap/approval hashes. |
| `useOrders()` | Enables provider-scoped history polling while mounted and returns categorized orders, loading state, errors, and `refetch()`. |
| `useHistoryOrder()`, `useCancelOrder()` | Return display-ready data for one order and the state/action for cancelling it. |
| `useClient()` | Returns the partner-and-chain-scoped initialized client, loading state, errors, and retry support. |

Every form amount uses `{ raw, ui, usd }`. Use `.ui` for editable values and convert `.raw` with the DEX's token amount formatter. Do not render raw integer strings directly.

An explicit TWAP trade count persists after amount changes. If it exceeds the newly calculated maximum, render `useTrades().error` or `useInputErrors()` and keep submission disabled; do not silently clamp it.

## Submit and Track Execution

Mount `SubmitOrderDialog` inside `AdvancedOrdersProvider`. The review button opens the modal; only its confirm button calls `submitOrder()`. These three files adapt the review, progress, and custom result panels from [the spot-ui submission example](https://github.com/orbs-network/spot-ui/blob/master/apps/web/components/spot/submit-order-dialog.tsx) to the current React SDK.

These snippets use the current SDK's focused hooks and keep the host in control of modal presentation.

### Submission API

The public [execution hook](https://github.com/orbs-network/spot-ui/blob/master/packages/spot-react/src/hooks/use-execution.ts) exposes advanced-order submission and recovery. Advanced orders finish creation at acceptance; later fills appear in history.

| API | Arguments and result |
| --- | --- |
| `useExecution().submitOrder()` | Takes no arguments and returns `void`. Starts the provider's current order attempt. |
| `useExecution().checkOrderStatus()` | Takes no arguments and returns `void`. Checks visible and retained background attempts without signing or submitting. |
| `useExecution().startNewOrder()` | Returns `boolean`. Opens a fresh form while retaining active or unconfirmed attempts for independent recovery. |
| Host `walletInteractions.signOrder(request)` | Receives the SDK's signing request and returns the wallet signature. Preserve its typed data and signer. |
| `client.submitOrder(preparedOrder.order, signature)` | Receives only the signed protocol order and signature; returns a normalized `Order`. React runs this operation for you. |

Pass tokens, account, chain, market data, wallet interactions, and `callbacks` through `AdvancedOrdersProvider`; do not pass them to `execution.submitOrder()`. The click handler below explicitly invokes `execution.submitOrder()` without forwarding the React click event.

Do not await `execution.submitOrder()` to detect completion or attach `.then()` / `.catch()` to it. Read `isExecuting`, `isSuccess`, `isFailed`, `isRejected`, `isUnconfirmed`, and `error` from `useExecution()`. For host side effects, use provider `callbacks.onOrderCreated(order)`, `onOrderFilled(order)`, `onSubmitOrderFailed(error)`, and `onSubmitOrderRejected()`. `onOrderCreated` means service acceptance. Advanced orders report success at acceptance. An unconfirmed attempt retains its captured payload and blocks another submission for that visible attempt. The explicit `startNewOrder()` action detaches it into background recovery and opens an independent form; the original order may still complete.


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
      if (execution.startNewOrder()) setInputAmount("");
    } else if (execution.isFailed || execution.isRejected) {
      execution.returnToOrderForm();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button disabled={disabled && !execution.isUnconfirmed} type="button">
          {execution.isUnconfirmed ? "Check order status" : loading ? "Preparing quote…" : "Review order"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-background p-6 text-foreground shadow-xl"
          onCloseAutoFocus={resetAfterClose}
          onEscapeKeyDown={(event: KeyboardEvent) => {
            if (!execution.canDismiss) event.preventDefault();
          }}
          onInteractOutside={(event: { preventDefault(): void }) => {
            if (!execution.canDismiss) event.preventDefault();
          }}
        >
          <Dialog.Title className="sr-only">Advanced order</Dialog.Title>
          <Dialog.Description className="sr-only">
            Review the order, confirm wallet requests, and follow its progress.
          </Dialog.Description>

          <OrderFlow />

          {(execution.isExecuting || execution.isUnconfirmed) && (
            <button
              onClick={() => {
                if (execution.startNewOrder()) {
                  setInputAmount("");
                  setOpen(false);
                }
              }}
              type="button"
            >
              Create another order
            </button>
          )}
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

### Build the Review Screen

Create `order-review.tsx`. Show the calculated amounts, schedule, and price conditions before the user confirms. This screen starts the attempt; it must disappear while that attempt is executing.

```tsx title="order-review.tsx"
"use client";

import { useState } from "react";
import { SwapFlow } from "@orbs-network/swap-ui";
import { DISCLAIMER_URL, OrderType, useExecution, useOrderForm, useSubmitButton } from "@orbs-network/spot-react";

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
    [OrderType.TWAP]: "TWAP",
    [OrderType.LIMIT]: "Limit",
    [OrderType.STOP_LOSS]: "Stop loss",
    [OrderType.TAKE_PROFIT]: "Take profit",
  };

  return (
    <section className="w-full space-y-4">
      <h2>Review {orderNames[form.orderType]} order</h2>
      <SwapFlow.Main
        fromTitle="Pay"
        toTitle="Estimated output"
        inUsd={form.inputAmount.usd ? "$" + form.inputAmount.usd : undefined}
        outUsd={form.outputAmount.usd ? "$" + form.outputAmount.usd : undefined}
      />

      <dl>
        <dt>Duration from final preparation</dt>
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
      <button disabled={!accepted || disabled} onClick={() => execution.submitOrder()} type="button">
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

## Show Execution Progress

Create `order-flow.tsx`, which the dialog imports. It chooses the review, wallet progress, success, or failure view from `useExecution()`. `OrderReview` comes from the preceding submission section.

```tsx title="order-flow.tsx"
"use client";

import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { SwapFlow, SwapStatus } from "@orbs-network/swap-ui";
import { ExecutionPhase, Steps, type SpotExecutionData, type Token, useExecution, useOrderForm } from "@orbs-network/spot-react";
import { useConfig } from "wagmi";
import type { Chain } from "viem";
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
        Main: execution.isUnconfirmed ? <OrderUnconfirmed /> : execution.isExecuting ? <OrderProgress /> : <OrderReview />,
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
    case ExecutionPhase.SETTLING:
      return {
        title: "Checking order status",
        message: "Reconciling the retained attempt with the order service.",
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
            <p>Reviewed output estimate: {form.outputAmount.ui} {execution.outputToken?.symbol}</p>
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

function OrderUnconfirmed() {
  const execution = useExecution();

  return (
    <div role="status" className="w-full space-y-4">
      <h2>Order status unconfirmed</h2>
      <p>{execution.error?.message || "The service has not confirmed the outcome. This order may still complete; check its status or explicitly create another order."}</p>
      {execution.orderId && <p>Order ID: {execution.orderId}</p>}
      <button disabled={execution.isCheckingOrderStatus} onClick={() => execution.checkOrderStatus()} type="button">
        {execution.isCheckingOrderStatus ? "Checking…" : "Check status"}
      </button>
      <WrappedFundsNotice />
      <ExecutionTransactions />
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
  const explorer = chains.find((chain: Chain) => chain.id === chainId)?.blockExplorers?.default.url;
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

### Handle Completion and Retry

**Checkpoint:** after confirming once, the UI follows wallet preparation, signing, and service submission. Show “Order created” after acceptance, then use history for fill progress. On rejection or failure, preserve the useful form state and offer an explicit return to review.

| Execution condition | Modal content |
| --- | --- |
| `phase === ExecutionPhase.IDLE` | Token preview, duration/prices/trade details, disclaimer, and submit button. |
| `phase === ExecutionPhase.PREPARING` | Allowance check and step-plan loading UI. |
| `phase === ExecutionPhase.WRAPPING` | Native-to-ERC-20 wrap instructions and transaction confirmation. |
| `phase === ExecutionPhase.APPROVING` | Approval instructions and allowance confirmation. |
| `phase === ExecutionPhase.SIGNING` | Wallet EIP-712 signature prompt. |
| `phase === ExecutionPhase.SUBMITTING` | Waiting for service acceptance; no additional wallet confirmation. |
| `phase === ExecutionPhase.SETTLING` | Checking acceptance of the exact retained attempt. |
| `isSuccess` | Advanced-order acceptance summary; fills remain available in history. |
| `isUnconfirmed` | Retained attempt with an uncertain outcome; offer `checkOrderStatus()` and history. An explicit new-order action detaches it for background recovery. |
| `isFailed` or `isRejected` | Custom error or declined-request screen, completed transaction links, and back-to-review action. |

`SwapFlow` selects `Success` or `Failed` using `getSwapUiStatus()`. Otherwise, `Main` explicitly chooses the unconfirmed recovery screen, active progress, or idle review. `StepLayout`, `Loader`, token-logo slots, and the success/failure icons provide the custom UI; the status conversion stays inside this view adapter.

The SDK builds `executionSteps`: wrapping appears only when needed, approval appears only when allowance is insufficient, and signing/submission share the create-order step. Use its zero-based `currentStepIndex` and `totalSteps`. `useOrderForm()` and the tokens/chain from `useExecution()` retain the active attempt’s snapshot while the DEX’s inputs change.

All close paths respect `canDismiss`. After the dialog exits, success calls `startNewOrder()` and clears the host input; failure or rejection calls `returnToOrderForm()` and preserves the editable form. A confirmed wrap remains real; refetch native/wrapped balances before retrying. Form resets clear visible wrap snapshots, and a receipt never establishes the current spendable balance. “Back to review” performs the latter reset while keeping the modal open. If the host uses another dialog, connect the same reset to its exit-complete callback. Use the host’s number formatter and translations for production display.

`canDismiss` also permits closing an unconfirmed result. Keep its provider and attempt mounted, leave the input intact, and expose a way to reopen recovery or history. Closing alone preserves active or unconfirmed state. If the user explicitly chooses to create another order, call `startNewOrder()` and clear the host input only when it returns `true`; captured attempts continue independently. Keep a recovery action visible whenever `hasUnconfirmedExecutions` is true. Provider unmount stops its tasks. A wallet-scope change quietly dismisses obsolete wallet work before submission; submitted or uncertain attempts retain their recovery state. Never automatically retry a timed-out submission or execute a fallback route while acceptance is uncertain.

Callbacks are observers for notifications, field synchronization, and balance refresh. Refetch balances after wrap, creation, fills, progress updates, and cancellation. Callback failures never change a wallet or API result.

`returnToOrderForm()` returns `false` during active or unconfirmed execution; `startNewOrder()` rejects stale callbacks. Success keeps submission disabled with `order-completed` until explicit reset. A failed status lookup or absent history leaves acceptance uncertain even after the signed deadline. Disable recovery actions while `isCheckingOrderStatus` is true and keep the provider mounted so detached callbacks and history updates can complete.

## Order History and Cancellation

`useOrders()` enables provider-scoped history fetching while mounted. The list and detail files follow the reference app’s filters, selected-order view, fill list, and cancellation feedback. Keep them under `AdvancedOrdersProvider`, including when the DEX renders them in a modal or portal.

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

### Show Order Details and Cancel

Create `order-details.tsx`, imported by the history list. Pass the selected history object, not a newly constructed order. Use the order’s token metadata to display fills and let `useCancelOrder()` track the cancellation transaction.

```tsx title="order-details.tsx"
"use client";

import { OrderStatus, type Order, useCancelOrder, useHistoryOrder } from "@orbs-network/spot-react";
import { useConfig } from "wagmi";
import type { Chain } from "viem";
import { useCurrency } from "./use-currency";

export function OrderDetails({ order }: { order: Order }) {
  // Resolve metadata for this order, not the tokens currently selected to swap.
  const inputToken = useCurrency(order.srcTokenAddress);
  const outputToken = useCurrency(order.dstTokenAddress);
  const details = useHistoryOrder(order, inputToken, outputToken);
  const cancellation = useCancelOrder(order);
  const { chains } = useConfig();
  const explorer = chains.find((chain: Chain) => chain.id === order.chainId)?.blockExplorers?.default.url;

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

Store `historyKey` as list/selection identity and resolve the current object from `orders.all`; legacy IDs can collide across deployments. `id` remains the protocol display/cancellation value. `useCancelOrder()` handles the wallet request, cancellation state, and cache update; it exposes errors and the confirmed hash without an extra host refetch parameter. `disabled` also checks the connected account, chain, partner, and initialized client against the selected order. Cancellation state is shared by `historyKey`, so repeated clicks cannot create duplicate transactions. Confirmed cancellation updates history immediately; a failed background refresh does not turn it into a failed cancellation. For large histories, reuse the DEX’s existing virtualization library.

## Integration Checklist

- Default to `Partners.External`; use another enum only when Orbs supplies it.
- Pass the host's `wrappedNativeToken`; `spot-react` has no network registry.
- Pass required `inputBalanceRaw` and `inputTokenUsdPrice`, using `undefined` only while their values are unavailable.
- Keep current tokens, input, quote freshness, wallet state, controls, navigation, translations, and modal ownership in the DEX.
- Use `marketQuote.quotedOutputAmountRaw` only for the exact current amount and token pair. Keep provider-free swaps in the host wallet flow.
- Use current prop names: `inputAmountUi`, `marketQuote`, `priceProtectionPercent`, `inputBalanceRaw`, and `*TokenUsdPrice`.
- Build UI with focused hooks and keep validation visible.
- Implement all wallet methods, wait for receipts, and preserve SDK-supplied request values and signature bytes.
- Keep each attempt immutable, respect `canDismiss`, and reset definitive results after the exit animation. Use explicit `startNewOrder()` to detach an active or unconfirmed attempt, and retain a `checkOrderStatus()` action for background recovery.
- Use `historyKey` for list identity and keep history/cancellation consumers inside provider scope.

### End-to-End Acceptance Run

1. Render `AdvancedOrderForm` with an `OrderType` such as `OrderType.TWAP`. Assemble it with `useWalletInteractions`, the form controls, `SubmitOrderDialog`, and `OrdersList` from the files created during this guide. Preserve the relative imports between the displayed files.
2. Replace host-specific wallet/data imports with your application's sources. Use real active-chain tokens and a current full-amount quote. Confirm connect-wallet, unsupported-network, loading, and validation states are visible before testing submission.
3. Open review and verify it reflects the current calculated form. Confirm once; with insufficient allowance, expect approval to complete before signing. For native input, expect wrapping first. With sufficient allowance, the approval prompt is skipped.
4. Keep the attempt immutable while execution is active. Display successful submission separately from fill completion, then verify the submitted order appears in provider-scoped history.
5. Cancel a selected open order through the history flow. Confirm the wallet transaction receipt and refresh the order state; do not mark it cancelled just because a transaction hash exists.
6. Reject each wallet prompt and test rapid repeated confirmation clicks. Verify repeated clicks start only one visible attempt, with an actionable error and explicit retry path. Use “Create another order” to detach an unresolved attempt, then verify “Check unresolved orders” still recovers it. Change account/chain before starting a new attempt and verify provider data follows the new context.

Use a funded development wallet for live ERC-20/native-input tests, with an amount satisfying the partner's minimums. Live orders may fill and spend funds; use mocked wallet/service failures for repeatable recovery checks.
