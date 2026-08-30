# Liquidity Hub Integration

This guide is for teams that want to add Orbs Liquidity Hub to an existing DEX, swap application, or trading service without adopting a specific UI framework.

Liquidity Hub is an optimization layer. Keep the existing DEX route, request a Liquidity Hub quote during the same quote cycle, and execute whichever route gives the user the better executable minimum output.

The integration has seven core operations:

1. Create one Liquidity Hub SDK client for the active chain.
2. Request a Liquidity Hub quote alongside the existing DEX quote.
3. Compare the two executable minimum outputs in token base units.
4. Wrap a native source asset when required.
5. Approve Permit2 to spend the ERC-20 source token.
6. Refresh the quote, sign its EIP-712 permit data, and submit the swap.
7. Confirm the transaction or fall back to the normal DEX route.

## Concepts

| Term | Meaning |
| --- | --- |
| Liquidity Hub | Orbs optimization layer that requests liquidity from on-chain and off-chain solvers. It is used only when it improves the user's executable result. |
| DEX route | The integrating application's existing router quote and swap path. It remains available whenever Liquidity Hub is unavailable or not better. |
| Executable minimum output | Minimum destination-token amount the route promises after its slippage rules. Compare `quote.minAmountOut` with the DEX route's minimum output. |
| Permit2 | Token permission contract that receives ERC-20 allowance for Liquidity Hub swaps. The current address is `0x000000000022D473030F116dDEE9F6B43aC78BA3`. |
| Quote permit data | EIP-712 payload returned at `quote.permitData`. The user signs this exact payload before submission. |
| Partner | Identifier provided by Orbs for the integrating DEX or application. Use `"unknown"` when Orbs has not provided one. |
| Session ID | Quote session identifier returned by Liquidity Hub and carried through swap submission and status polling. |

## Integration Resources

- [UI](https://orbs-spot.vercel.app)
- [Code](https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx)
- [Integration Skill](https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-integration)

## Install and Initialize

Install the plain JavaScript SDK and Viem. Neither requires React:

```bash
npm install @orbs-network/liquidity-hub-sdk viem
```

Create one Liquidity Hub client for the active chain and reuse it for quote and swap operations. Create a new client when the active chain changes; do not create a new client for every quote.

```js
import { constructSDK } from "@orbs-network/liquidity-hub-sdk";

const partner = "unknown"; // Replace with the identifier provided by Orbs.

function createLiquidityHubClient(chainId) {
  return constructSDK({
    chainId,
    partner,
  });
}

let liquidityHub = createLiquidityHubClient(137);

function changeChain(nextChainId) {
  liquidityHub = createLiquidityHubClient(nextChainId);
}
```

Use the stable lowercase `partner` value provided by Orbs. If Orbs has not provided a partner identifier, use the exact value `"unknown"`; do not invent one from the application name.

The transaction examples below use Viem directly. Create or reuse a `PublicClient` and `WalletClient` configured for the active chain. For example, in a browser application on Polygon:

```js
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "viem";
import { polygon } from "viem/chains";

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(),
});

const walletClient = createWalletClient({
  chain: polygon,
  transport: custom(window.ethereum),
});
```

Use the chain object and transports appropriate for the application's active network and environment.

Supported networks in the current SDK integration guide:

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

Before enabling a chain, confirm that the integrating application has the correct wrapped-native-token address and can send and confirm transactions on that chain.

## Request Quotes

Call `getQuote` during the same quote cycle as the existing DEX router. All token amounts are integer decimal strings in token base units, not display-formatted values.

```js
async function getLiquidityHubQuote({
  sdk,
  fromToken,
  toToken,
  inAmount,
  dexMinAmountOut,
  account,
  slippage,
  signal,
}) {
  return sdk.getQuote({
    fromToken,
    toToken,
    inAmount,
    dexMinAmountOut,
    account,
    slippage,
    signal,
  });
}
```

`slippage` is a percentage: `0.5` means 0.5%, not 50 basis points or `0.005`.

Quote request fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `fromToken` | Yes | ERC-20 source token address. Use the wrapped token address when the user selected a native asset. |
| `toToken` | Yes | Destination token address. |
| `inAmount` | Yes | Source amount as an integer base-unit string. |
| `dexMinAmountOut` | Recommended | Current DEX route's executable minimum output, in destination-token base units. |
| `account` | Required for execution | User address that will sign and own the swap. |
| `slippage` | Yes | Percentage tolerance, such as `0.5` for 0.5%. |
| `signal` | No | `AbortSignal` used to cancel an obsolete quote request. |
| `timeout` | No | Quote timeout override in milliseconds. The SDK default is 10 seconds. |

If the current DEX minimum output is already available, pass it as `dexMinAmountOut`. If both routes must start at exactly the same time, do not delay the Liquidity Hub request waiting for that value; omit it for that request and compare the two results after both settle.

```js
const [dexResult, liquidityHubResult] = await Promise.allSettled([
  getDexQuote(swapInput),
  getLiquidityHubQuote({
    sdk: liquidityHub,
    fromToken: swapInput.fromToken,
    toToken: swapInput.toToken,
    inAmount: swapInput.inAmount,
    dexMinAmountOut: swapInput.lastKnownDexMinAmountOut,
    account: swapInput.account,
    slippage: swapInput.slippage,
    signal: swapInput.signal,
  }),
]);
```

Cancel in-flight requests when the account, chain, token pair, or input amount changes. For interactive applications, debounce amount changes by about 300 milliseconds and refresh an active quote about every 10 seconds.

## Compare Routes

Compare `quote.minAmountOut` with the DEX route's executable minimum output. Both values must refer to the same destination token and use that token's base units.

```js
import { isFreshQuote } from "@orbs-network/liquidity-hub-sdk";

function chooseRoute({ dexQuote, liquidityHubQuote }) {
  if (!liquidityHubQuote || !isFreshQuote(liquidityHubQuote, 60)) {
    return { route: "dex", quote: dexQuote };
  }

  const liquidityHubMinimum = BigInt(liquidityHubQuote.minAmountOut);
  const dexMinimum = BigInt(dexQuote.minAmountOut);

  if (liquidityHubMinimum > dexMinimum) {
    return { route: "liquidity-hub", quote: liquidityHubQuote };
  }

  return { route: "dex", quote: dexQuote };
}
```

Do not compare `outAmount`, display-formatted values, floating-point numbers, or USD estimates. Those values can differ from the amount the route will actually guarantee.

Important quote response fields:

| Field | Purpose |
| --- | --- |
| `inToken` | ERC-20 source token used by the executable quote. |
| `outToken` | Destination token used by the quote. |
| `inAmount` | Source amount in base units. |
| `outAmount` | Quoted output before the final executable-minimum comparison. Use it for display only when appropriate. |
| `minAmountOut` | Liquidity Hub executable minimum output. Use this field for route selection. |
| `permitData` | EIP-712 typed data the user signs. |
| `sessionId` | Identifier used for swap submission and status polling. |
| `timestamp` | Local quote time in milliseconds, used by `isFreshQuote`. |
| `gasAmountOut` | Optional gas cost expressed in output-token terms. |

Treat a missing, failed, unsupported, or stale Liquidity Hub quote as a DEX-route result. Liquidity Hub is an optimization and must not disable the existing swap.

## Wrap and Approve

Liquidity Hub executes ERC-20 inputs. If the user selected a native source asset such as ETH, BNB, or POL, request the quote with the chain's wrapped token and wrap the native amount before approval and signing.

The SDK exports common native-token placeholder addresses through `nativeTokenAddresses`, but the integrating application must supply the correct wrapped token contract for the active chain.

```js
import {
  nativeTokenAddresses,
  permit2Address,
} from "@orbs-network/liquidity-hub-sdk";

function isNativeToken(address) {
  return nativeTokenAddresses.some(
    (nativeAddress) => nativeAddress.toLowerCase() === address.toLowerCase(),
  );
}
```

For a native source asset:

1. Call the wrapped token's payable `deposit()` function with `quote.inAmount` as the transaction value.
2. Wait for the wrap transaction to confirm.
3. Continue using `quote.inToken`, which should be the wrapped token address.

Then read the ERC-20 allowance where owner is the user and spender is `permit2Address`. Use Viem to submit and confirm both transactions:

```js
import { erc20Abi, parseAbi } from "viem";

const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

async function wrapNativeToken({
  publicClient,
  walletClient,
  account,
  quote,
}) {
  const hash = await walletClient.writeContract({
    account,
    address: quote.inToken,
    abi: wrappedNativeAbi,
    functionName: "deposit",
    value: BigInt(quote.inAmount),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Native token wrap reverted");
  }
}

async function ensurePermit2Allowance({
  publicClient,
  walletClient,
  account,
  quote,
}) {
  const allowance = await publicClient.readContract({
    address: quote.inToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, permit2Address],
  });

  if (allowance >= BigInt(quote.inAmount)) return;

  const hash = await walletClient.writeContract({
    account,
    address: quote.inToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [permit2Address, BigInt(quote.inAmount)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Permit2 approval reverted");
  }
}
```

The example approves the exact input amount. An integrating application may deliberately use a larger or maximum allowance to avoid repeated approvals, but that is a product and security decision that should be explicit.

Wait for both wrapping and approval transactions to confirm before requesting the signature.

## Refresh and Sign

Wrapping and approval can take long enough for the original quote to expire. Immediately before signing:

1. Request a new Liquidity Hub quote for the current account, chain, tokens, amount, and slippage.
2. Check `isFreshQuote(latestQuote, 60)`.
3. Confirm that `latestQuote.inToken` and `latestQuote.inAmount` still match the prepared swap.
4. Recompare `latestQuote.minAmountOut` with a current DEX minimum output.
5. Sign only if Liquidity Hub still wins.

The EIP-712 payload is returned at `quote.permitData`. Pass its fields to the wallet without reconstructing or mutating them:

```js
async function signLiquidityHubQuote({ walletClient, account, quote }) {
  return walletClient.signTypedData({
    account,
    domain: quote.permitData.domain,
    types: quote.permitData.types,
    primaryType: quote.permitData.primaryType,
    message: quote.permitData.values,
  });
}
```

The signature must belong to the same user passed to `getQuote`. Submit the exact fresh quote object that produced `permitData`; changing token, amount, user, slippage, or another quote field after signing invalidates the signature.

Example preparation flow using the same Viem clients:

```js
async function prepareLiquidityHubSwap({
  publicClient,
  walletClient,
  account,
  quote,
  sourceWasNative,
  getLatestQuote,
  getLatestDexQuote,
}) {
  if (sourceWasNative) {
    await wrapNativeToken({
      publicClient,
      walletClient,
      account,
      quote,
    });
  }

  await ensurePermit2Allowance({
    publicClient,
    walletClient,
    account,
    quote,
  });

  const [liquidityHubResult, dexResult] = await Promise.allSettled([
    getLatestQuote(),
    getLatestDexQuote(),
  ]);

  if (dexResult.status === "rejected") {
    throw dexResult.reason;
  }

  const latestDexQuote = dexResult.value;
  if (liquidityHubResult.status === "rejected") {
    return { route: "dex", quote: latestDexQuote };
  }

  const latestQuote = liquidityHubResult.value;
  const quoteMatchesPreparedSwap =
    latestQuote.inToken.toLowerCase() === quote.inToken.toLowerCase() &&
    latestQuote.inAmount === quote.inAmount &&
    latestQuote.user.toLowerCase() === account.toLowerCase();

  if (!quoteMatchesPreparedSwap) {
    return { route: "dex", quote: latestDexQuote };
  }

  const selected = chooseRoute({
    dexQuote: latestDexQuote,
    liquidityHubQuote: latestQuote,
  });

  if (selected.route !== "liquidity-hub") {
    return { route: "dex", quote: latestDexQuote };
  }

  const signature = await signLiquidityHubQuote({
    walletClient,
    account,
    quote: latestQuote,
  });

  return { route: "liquidity-hub", quote: latestQuote, signature };
}
```

## Execute and Confirm

Submit the accepted quote and signature with `sdk.swap`:

```js
const txHash = await liquidityHub.swap(
  acceptedQuote,
  signature,
  dexRouterData,
);
```

Arguments:

| Argument | Meaning |
| --- | --- |
| `acceptedQuote` | Exact fresh quote object used to create the signature. |
| `signature` | EIP-712 signature returned by the user's wallet. |
| `dexRouterData` | Optional `{ data, to }` containing DEX router calldata and destination for integrations that supply a fallback transaction. |

`swap` submits the signed quote to Liquidity Hub and polls until it receives an on-chain transaction hash. Treat a rejected signature, validation response, backend error, or polling timeout as a failed Liquidity Hub execution.

After receiving the transaction hash, wait for its on-chain receipt with the Viem `PublicClient` configured for the active chain:

```js
const receipt = await publicClient.waitForTransactionReceipt({
  hash: txHash,
});

if (receipt.status !== "success") {
  throw new Error("Liquidity Hub swap reverted");
}

console.log("Swap confirmed:", receipt.transactionHash);
```

Do not report success to the user only because the wallet produced a signature or `swap` accepted the request. Report success after `publicClient.waitForTransactionReceipt` returns a receipt whose status is `"success"`.

## Fallback and Errors

When the DEX route wins or Liquidity Hub cannot produce a usable quote, execute the normal DEX swap.

If a Liquidity Hub swap fails after the user has already wrapped or approved, explain that those preparatory transactions may still have succeeded. Offer a fresh quote or the normal DEX route instead of leaving the swap disabled. When a native source asset has already been wrapped, rebuild the DEX fallback for the wrapped token or explicitly unwrap it before using a native-token route.

Common quote failures include:

| Error | Meaning and action |
| --- | --- |
| `"no liquidity"` | No solver can fill the requested pair and amount. Use the DEX route. |
| `"tns"` | Token is not supported. Use the DEX route and stop retrying until inputs change. |
| `"ldv"` | Input value is below the supported threshold. Use the DEX route. |
| `"timeout"` | Quote request did not finish in time. Use the DEX route and allow a later quote cycle to retry. |

## Operational Checklist

- Use one SDK client for the active chain and recreate it only when the chain changes.
- Use the partner identifier provided by Orbs, or `"unknown"` when none was provided.
- Request Liquidity Hub and DEX routes in the same quote cycle.
- Pass `dexMinAmountOut` when the current DEX minimum is already available.
- Compare `quote.minAmountOut` and the DEX minimum with integer arithmetic.
- Never select a route by comparing `outAmount`, formatted amounts, or floating-point values.
- Debounce rapidly changing inputs and cancel obsolete quote requests.
- Refresh active quotes and verify freshness immediately before signing.
- Use the wrapped token address for a native source asset and confirm the wrap transaction.
- Check and, when needed, confirm ERC-20 allowance to `permit2Address`.
- Sign the exact `quote.permitData` payload and submit the same fresh quote object.
- Confirm the returned transaction hash with Viem's `publicClient.waitForTransactionReceipt`.
- Keep the existing DEX route available for every Liquidity Hub error or non-winning quote.
