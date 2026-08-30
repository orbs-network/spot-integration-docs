# Advanced Orders Integration

This guide is for teams that want to create Spot advanced orders from any application or service.
The integration has six core operations:

1. Fetch the partner-and-chain RePermit configuration from Order Sink.
2. Build a RePermit EIP-712 order from that server-provided template.
3. Ask the user, wallet, or custody system to sign that EIP-712 typed data.
4. Submit the signed order to Order Sink.
5. Fetch orders from Order Sink for the swapper, chain ID, and adapter.
6. Cancel an order on-chain when needed.

## Concepts

| Term | Meaning |
| --- | --- |
| Order Sink | Off-chain service that accepts signed RePermit orders and exposes them through the orders API. |
| RePermit | On-chain contract used for token authorization and cancellation. Users approve this contract to spend the source token. |
| Reactor | Contract encoded as the signed permit `spender`. It is part of the signed order and is not the ERC-20 allowance spender. |
| Swapper | User address that owns the order. This must be the EIP-712 signer and is stored at `order.witness.swapper`. |
| RePermit digest | Order cancellation digest returned by Order Sink as `metadata.repermitDigest`. This is passed to the RePermit `cancel(bytes32[])` function. |

## Integration Resources

- [UI](https://orbs-spot.vercel.app/?tab=twap)
- [Code](https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx)
- [Integration Skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-react-integration)

## Function Contracts

This document describes the behavior of three functions. Your implementation can be in Java, Python, TypeScript, Go, or any other stack.

The JavaScript signing and transaction examples use Viem `WalletClient` and `PublicClient` methods directly; they do not require React.

`fetchRePermitData(partner, chainId)` fetches the server-controlled EIP-712 domain, types, primary type, and order template for one partner and chain.

`buildRePermitOrderData(...)` builds the EIP-712 payload the user signs. It returns:

| Field | Purpose |
| --- | --- |
| `domain` | EIP-712 domain returned by the config API. Pass it through unchanged. |
| `types` | EIP-712 type definitions returned by the config API. Pass them through unchanged. |
| `primaryType` | EIP-712 primary type returned by the config API. Currently `"RePermitWitnessTransferFrom"`. |
| `order` | The message the user signs and the same order object later sent to Order Sink. |

`submitOrder(order, signature)` sends the signed order to Order Sink. It posts:

```json
{
  "signature": "0xWalletSignature...",
  "order": { "...": "the signed RePermitOrder" },
  "status": "pending"
}
```

The RePermit contract, reactor, executor, exchange adapter, and fee reference addresses come from the fetched partner configuration. Do not hardcode them in the integration.

## Fetch Partner Config

Fetch the configuration before building an order. The production endpoint is:

```text
GET https://order-sink-v2.orbs.network/config?partner=<partner>&chain=<chainId>
Accept: application/json
```

Use the partner identifier provided by Orbs. If Orbs has not provided one, send the exact value `"unknown"`; do not derive or invent a partner identifier from the application name.

This framework-independent production helper follows the current `spot-ui` request shape:

```js
const ORDER_SINK_URL = "https://order-sink-v2.orbs.network";

async function fetchRePermitData(partner, chainId) {
  const query = new URLSearchParams({
    partner,
    chain: String(chainId),
  });
  const response = await fetch(`${ORDER_SINK_URL}/config?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Failed to fetch RePermit data for partner "${partner}" on chain ${chainId}: ${response.status}${message ? ` ${message}` : ""}`,
    );
  }

  return response.json();
}
```

The response is a `RePermitData` template:

| Response field | Purpose |
| --- | --- |
| `domain` | EIP-712 domain, including the chain ID and RePermit contract at `verifyingContract`. |
| `types` | Complete EIP-712 type definitions. Pass these through unchanged. |
| `primaryType` | EIP-712 primary type. Pass it through unchanged. |
| `order` | Partner-and-chain order template containing the reactor, executor, exchange adapter, fee reference, and default fields. |
| `partner` | Optional server-side partner label. |

The integration-owned fields are filled into a copy of `permitData.order`; server-controlled contract and exchange fields remain unchanged:

| API response path | Used for |
| --- | --- |
| `domain.verifyingContract` | RePermit allowance spender and cancellation contract. |
| `order.spender` | Signed RePermit spender. |
| `order.witness.reactor` | Reactor encoded in the signed witness. |
| `order.witness.executor` | Authorized executor. |
| `order.witness.exchange.adapter` | Partner exchange adapter and order-history filter. |
| `order.witness.exchange.ref` | Fee or referral reference. |

Cache the response by `partner` and `chainId` if desired. Fetch a different template whenever either value changes. Before signing, confirm that both `permitData.domain.chainId` and `permitData.order.witness.chainid` equal the active `chainId`.

## Prerequisites

Before signing and submitting:

- The user must be on the same `chainId` used in the order.
- Token amounts must be integer decimal strings in token base units, not human-readable decimals. For example, `1.5` tokens with 18 decimals is `"1500000000000000000"`.
- The signed source token must be an ERC-20 address. If the user starts with a native asset, wrap it first and use the wrapped token address in the signed order.
- The user must approve the signed source token for `permitData.domain.verifyingContract` with allowance at least `order.permitted.amount`.
- Do not confuse token allowance with the signed permit spender: ERC-20 allowance is granted to the RePermit contract, while `order.spender` is the reactor.
- The EIP-712 signer must match `order.witness.swapper`.

## Build the Order

`buildRePermitOrderData` returns the EIP-712 payload the user signs. Start with the fetched `permitData` template and replace only the integration-owned order values.

The generated payload keeps `permitData.domain`, `permitData.types`, `permitData.primaryType`, `permitData.order.spender`, and the server-provided reactor, executor, and exchange fields unchanged.

```js
{
  "domain": {
    "name": "RePermit",
    "version": "1",
    "chainId": 137,
    "verifyingContract": "0xRePermit..." // from permitData.domain
  },
  "types": { "...": "from permitData.types" },
  "primaryType": "RePermitWitnessTransferFrom",
  "order": {
    "permitted": {
      "token": "0xSourceToken...",
      "amount": "1000000000000000000"
    },
    "spender": "0xReactor...", // from permitData.order
    "nonce": "1785273600000",
    "deadline": "1785878400",
    "witness": {
      "reactor": "0xReactor...", // from permitData.order.witness
      "executor": "0xExecutor...", // from permitData.order.witness
      "exchange": {
        "adapter": "0xAdapter...", // from permitData.order.witness.exchange
        "ref": "0xFeeReference...", // from permitData.order.witness.exchange
        "share": 0,
        "data": "0x"
      },
      "swapper": "0xUserAddress...",
      "nonce": "1785273600000",
      "start": "1785273600",
      "deadline": "1785878400",
      "chainid": 137,
      "exclusivity": 0,
      "epoch": 300,
      "slippage": 50,
      "freshness": 60,
      "input": {
        "token": "0xSourceToken...",
        "amount": "250000000000000000",
        "maxAmount": "1000000000000000000"
      },
      "output": {
        "token": "0xDestinationToken...",
        "limit": "120000000",
        "triggerLower": "0",
        "triggerUpper": "0",
        "recipient": "0xUserAddress..."
      }
    }
  }
}
```

Example implementation adapted from `spot-ui`'s `buildRePermitOrderData`:

```js
const ORDER_MODULE = {
  STOP_LOSS: "STOP_LOSS",
  TAKE_PROFIT: "TAKE_PROFIT",
};

function toIntegerString(value) {
  if (value === undefined || value === null || value === "" || value === "NaN") {
    return "0";
  }

  return Math.round(Number(value)).toString();
}

function buildRePermitOrderData({
  chainId,
  srcToken,
  dstToken,
  srcAmount,
  deadlineMillis,
  fillDelayMillis,
  totalTrades,
  slippageBps,
  account,
  srcAmountPerTrade,
  dstMinAmountPerTrade = "0",
  triggerAmountPerTrade = "0",
  permitData,
  module,
  freshnessSeconds = 60,
}) {
  if (
    permitData.domain.chainId !== chainId ||
    permitData.order.witness.chainid !== chainId
  ) {
    throw new Error("Partner config does not match the active chain");
  }

  const currentTimeMillis = Date.now();
  const nonce = currentTimeMillis.toString();
  const epoch =
    !totalTrades || totalTrades === 1
      ? 0
      : Number.parseInt((fillDelayMillis / 1000).toFixed(0), 10);
  const deadline = toIntegerString(deadlineMillis / 1000);
  const freshness = freshnessSeconds;
  const start = Math.floor(currentTimeMillis / 1000).toString();
  const limit = dstMinAmountPerTrade;
  const triggerLower =
    module === ORDER_MODULE.STOP_LOSS ? triggerAmountPerTrade : "0";
  const triggerUpper =
    module === ORDER_MODULE.TAKE_PROFIT ? triggerAmountPerTrade : "0";

  const order = {
    ...permitData.order,
    permitted: {
      ...permitData.order.permitted,
      token: srcToken,
      amount: srcAmount,
    },
    nonce,
    deadline,
    witness: {
      ...permitData.order.witness,
      swapper: account,
      nonce,
      start,
      deadline,
      epoch,
      slippage: slippageBps,
      freshness,
      input: {
        ...permitData.order.witness.input,
        token: srcToken,
        amount: srcAmountPerTrade,
        maxAmount: srcAmount,
      },
      output: {
        ...permitData.order.witness.output,
        token: dstToken,
        limit: String(limit || "0"),
        triggerLower: String(triggerLower || "0"),
        triggerUpper: String(triggerUpper || "0"),
        recipient: account,
      },
    },
  };

  return {
    ...permitData,
    order,
  };
}
```

Do not recreate the EIP-712 domain or type definitions locally. Return `domain`, `types`, and `primaryType` from the API response unchanged.

`deadlineMillis`, `fillDelayMillis`, `totalTrades`, and `module` are builder inputs only. They are converted into the signed `deadline`, `epoch`, `triggerLower`, and `triggerUpper` fields; they are not sent as separate fields to Order Sink. For a single-fill order, `epoch` is `0`.

Do not mutate `order`, `domain`, `types`, or `primaryType` after signing. Any field change changes the signed digest.

## Signed Values

The user does not sign the builder input object. The user signs the EIP-712 payload returned by `buildRePermitOrderData`: `domain`, `types`, `primaryType`, and `order`.

Signed domain values:

| Signed value | Meaning |
| --- | --- |
| `domain.name` | Server-provided EIP-712 domain name. Currently `"RePermit"`. |
| `domain.version` | Server-provided EIP-712 domain version. Currently `"1"`. |
| `domain.chainId` | The chain where the order is valid. |
| `domain.verifyingContract` | The RePermit contract address. |

Signed order values:

| Signed value | Meaning |
| --- | --- |
| `order.permitted` | Source token and total permitted source amount. |
| `order.spender` | Reactor address. |
| `order.nonce` | Generated unique permit nonce. |
| `order.deadline` | Order expiry in Unix seconds. |
| `order.witness` | Full Spot order details: reactor, executor, exchange metadata, swapper, timing, chain, slippage, input token/amounts, output token/limits/triggers, and recipient. |

## Generated Order Fields

The returned `order` is a `RePermitOrder`. This is the object signed by the user and later sent to Order Sink as the `order` field.

| Field | Description |
| --- | --- |
| `permitted.token` | Source ERC-20 token address that RePermit is allowed to transfer. If the user started with a native asset, this should be the wrapped token address. |
| `permitted.amount` | Total source token amount authorized by the signed permit, in source-token base units. |
| `spender` | Reactor address allowed to spend the permitted tokens through RePermit. This is not the ERC-20 allowance spender; ERC-20 allowance is granted to the RePermit contract. |
| `nonce` | Unique permit nonce as a decimal string. The builder currently uses the current Unix time in milliseconds. It prevents two otherwise identical orders from sharing the same permit digest. |
| `deadline` | Permit and order expiry time as a Unix timestamp in seconds, serialized as a decimal string. After this time the order should not execute. |

### Witness Fields

`witness` is the Spot-specific order data attached to the RePermit signature. The user signs it together with `permitted`, `spender`, `nonce`, and `deadline`.

| Field | Description |
| --- | --- |
| `witness.reactor` | Reactor contract address. The reactor is the contract that validates and processes the order. |
| `witness.executor` | Executor address authorized for order execution. |
| `witness.exchange.adapter` | Exchange adapter address. This tells the execution system which adapter/integration should be used for routing fills. |
| `witness.exchange.ref` | Fee or referral reference address. It is part of the signed exchange metadata. |
| `witness.exchange.share` | Fee share supplied by `permitData.order.witness.exchange` and preserved by the builder. |
| `witness.exchange.data` | Extra adapter data bytes supplied by `permitData.order.witness.exchange` and preserved by the builder. |
| `witness.swapper` | User address that owns the order. This must match the EIP-712 signer. |
| `witness.nonce` | Same nonce value as top-level `nonce`. Keeping both values equal ties the Spot witness to the RePermit permit. |
| `witness.start` | Earliest order start time as a Unix timestamp in seconds, serialized as a decimal string. The current builder uses the current time when the order is built. |
| `witness.deadline` | Same expiry timestamp as top-level `deadline`, in seconds as a decimal string. |
| `witness.chainid` | EVM chain ID where the order is valid. This must match the EIP-712 domain chain. |
| `witness.exclusivity` | Server-provided exclusivity setting preserved from `permitData.order.witness`. |
| `witness.epoch` | Minimum delay between fills, in seconds. For a one-fill order this is usually `0`. |
| `witness.slippage` | Slippage tolerance in basis points. For example, `50` means `0.5%` and `100` means `1%`. |
| `witness.freshness` | Quote/oracle freshness window in seconds. Defaults to `60` unless Orbs explicitly gives the integration a different value. |
| `witness.input.token` | Source token address for each fill. This should match `permitted.token`. |
| `witness.input.amount` | Source amount per fill/chunk, in source-token base units. |
| `witness.input.maxAmount` | Maximum total source amount the order may consume, in source-token base units. This should match `permitted.amount`. |
| `witness.output.token` | Destination token address the user wants to receive. |
| `witness.output.limit` | Minimum destination amount required per fill, in destination-token base units. Use `"0"` for market-style execution. |
| `witness.output.triggerLower` | Stop-loss trigger amount, in destination-token base units. It is non-zero only for stop-loss orders; otherwise it is `"0"`. |
| `witness.output.triggerUpper` | Take-profit trigger amount, in destination-token base units. It is non-zero only for take-profit orders; otherwise it is `"0"`. |
| `witness.output.recipient` | Address that receives the destination tokens. |

### Output Limit And Trigger Rules

The builder reduces limit and trigger intent into three signed output fields:

| Signed field | Rule |
| --- | --- |
| `witness.output.limit` | Minimum destination amount per fill, in destination-token base units. If no limit is required, sign `"0"`. |
| `witness.output.triggerLower` | Stop-loss trigger threshold. For stop-loss orders, sign the trigger amount here. For all other orders, sign `"0"`. |
| `witness.output.triggerUpper` | Take-profit trigger threshold. For take-profit orders, sign the trigger amount here. For all other orders, sign `"0"`. |

Only the final signed fields above are part of the order. There are no additional order-type or helper trigger fields in the EIP-712 message or in the Order Sink request body.

When serializing these values, use plain integer decimal strings. Avoid scientific notation, decimal points, or locale formatting.

## Sign the EIP-712 Data

The user signs the returned EIP-712 payload with their wallet, custody system, or signing service:

```json
{
  "domain": { "...": "domain returned by buildRePermitOrderData" },
  "types": { "...": "types returned by buildRePermitOrderData" },
  "primaryType": "RePermitWitnessTransferFrom",
  "message": { "...": "order returned by buildRePermitOrderData" }
}
```

The signed message must be exactly `order`, using the returned `domain`, `types`, and `primaryType`. The signer address must match `order.witness.swapper`.

Order Sink expects the complete `0x`-prefixed hex signature returned by the wallet. Do not split it into `{ v, r, s }` fields.

Example signing helper:

```js
async function signOrder({ walletClient, account, orderInput }) {
  const orderData = buildRePermitOrderData(orderInput);

  const signature = await walletClient.signTypedData({
    account,
    domain: orderData.domain,
    types: orderData.types,
    primaryType: orderData.primaryType,
    message: orderData.order,
  });

  return {
    orderData,
    signature,
  };
}
```

`orderInput` is passed to `buildRePermitOrderData`, and the returned `orderData.order` is the exact message the user signs.

## Submit to Order Sink

`submitOrder(order, signature)` sends:

```json
{
  "signature": "0xWalletSignature...",
  "order": { "...": "the signed RePermitOrder" },
  "status": "pending"
}
```

Implement `submitOrder` as an HTTP POST:

```text
POST https://order-sink-v2.orbs.network/orders/new
Content-Type: application/json
Accept: application/json

{
  "signature": "0xWalletSignature...",
  "order": { "...": "the signed RePermitOrder" },
  "status": "pending"
}
```

A successful response contains `success: true` and a `signedOrder` object. Treat non-2xx responses, `success: false`, or a missing `signedOrder` as submission failures.

Example submit helper:

```js
const ORDER_SINK_URL = "https://order-sink-v2.orbs.network";

async function submitOrder({ order, signature }) {
  const response = await fetch(`${ORDER_SINK_URL}/orders/new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      signature,
      order,
      status: "pending",
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.success || !payload.signedOrder) {
    throw new Error(payload.message || response.statusText || "Order submit failed");
  }

  return payload.signedOrder;
}

async function signAndSubmitOrder({
  partner,
  chainId,
  walletClient,
  account,
  orderInput,
}) {
  const permitData = await fetchRePermitData(partner, chainId);
  const { orderData, signature } = await signOrder({
    walletClient,
    account,
    orderInput: {
      ...orderInput,
      account,
      chainId,
      permitData,
    },
  });

  return submitOrder({
    order: orderData.order,
    signature,
  });
}
```

`orderInput` contains the integration-owned values such as swapper, tokens, amounts, deadline, slippage in basis points, limits, and triggers. Add the `permitData` returned by the config API before calling `buildRePermitOrderData`. Do not send `orderInput` or the untouched template to Order Sink; send only the generated `orderData.order` with the user signature.

Successful response shape:

```json
{
  "success": true,
  "signedOrder": {
    "hash": "0xOrderHash...",
    "order": { "...": "RePermitOrder" },
    "signature": "0x...",
    "timestamp": "2026-08-04T12:00:00.000Z",
    "metadata": {
      "status": "pending",
      "repermitDigest": "0xPermitDigest..."
    }
  }
}
```

Submit flow:

1. Fetch `permitData` for the partner and chain.
2. Build the EIP-712 payload from that template.
3. Get the user signature over exactly that payload.
4. POST the complete hex signature with `{ signature, order, status: "pending" }` to `/orders/new`.
5. Store the returned `signedOrder.hash` for tracking.
6. Store `signedOrder.metadata.repermitDigest` if present; this is the value used for cancellation.
7. Fetch the order from the Order Sink endpoint when you need the latest status, fills, or cancellation digest.

Order submission is not an on-chain transaction from the user. The user signs off-chain EIP-712 data, and Order Sink stores the signed order for execution.

## Fetch Order Sink Orders

Fetch RePermit orders from Order Sink with the swapper address, chain ID, and exchange adapter from the fetched template. The `swapper` query value is the order owner address, matching `order.witness.swapper`. The `exchange` query value should be `permitData.order.witness.exchange.adapter`.

```text
GET https://order-sink-v2.orbs.network/orders?swapper=0xUserAddress...&chainId=137&exchange=<permitData.order.witness.exchange.adapter>
Accept: application/json
```

Example fetch helper:

```js
const ORDER_SINK_URL = "https://order-sink-v2.orbs.network";

async function fetchOrderSinkOrders({ swapper, chainId, permitData }) {
  const query = new URLSearchParams({
    swapper,
    chainId: String(chainId),
    exchange: permitData.order.witness.exchange.adapter,
  });

  const response = await fetch(`${ORDER_SINK_URL}/orders?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !Array.isArray(payload.orders)) {
    throw new Error(payload.message || response.statusText || "Order fetch failed");
  }

  return payload.orders;
}
```

Successful responses contain an `orders` array:

```json
{
  "orders": [
    {
      "hash": "0xOrderHash...",
      "order": { "...": "RePermitOrder" },
      "signature": "0x...",
      "timestamp": "2026-08-04T12:00:00.000Z",
      "metadata": {
        "status": "pending",
        "description": "",
        "expectedChunks": 4,
        "repermitDigest": "0xPermitDigest...",
        "chunks": []
      }
    }
  ]
}
```

Important fields for consumers:

| Field | Description |
| --- | --- |
| `hash` | Order Sink order ID/hash. Store this for tracking. |
| `order` | Original signed RePermit order. |
| `metadata.status` | Order Sink status. `"pending"` and `"eligible"` are open states; `"completed"` is filled. |
| `metadata.description` | Additional status description. A cancelled order may be reported as `"cancelled by contract"` after the on-chain cancel is indexed. |
| `metadata.expectedChunks` | Expected number of fills/chunks. |
| `metadata.chunks` | Fill/chunk execution details, when available. |
| `metadata.repermitDigest` | Permit digest required for on-chain cancellation. Store this value. |

The endpoint returns raw Order Sink objects. If you normalize them in your own service, keep the raw `metadata.repermitDigest`; it is needed to cancel the order.

## Cancel Order Sink Orders

Cancelling a RePermit order is an on-chain transaction. Do not send a cancel request to Order Sink. Instead, call the RePermit contract from the order owner address.

Contract:

```text
address: permitData.domain.verifyingContract
function: cancel(bytes32[] digests)
digests: [metadata.repermitDigest]
```

Minimal ABI fragment:

```json
[
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "digests",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
]
```

Example cancel helper:

```js
const REPERMIT_CANCEL_ABI = [
  {
    type: "function",
    name: "cancel",
    inputs: [{ name: "digests", type: "bytes32[]" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

async function cancelOrder({
  publicClient,
  walletClient,
  permitData,
  orderSinkOrder,
  account,
}) {
  const repermitDigest = orderSinkOrder.metadata?.repermitDigest;

  if (!repermitDigest) {
    throw new Error("Missing metadata.repermitDigest on Order Sink order");
  }

  const hash = await walletClient.writeContract({
    address: permitData.domain.verifyingContract,
    abi: REPERMIT_CANCEL_ABI,
    functionName: "cancel",
    args: [[repermitDigest]],
    account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Order cancellation reverted");
  }

  return hash;
}
```

`orderSinkOrder` is one item from the submitted or fetched Order Sink response. The cancellation digest comes from `orderSinkOrder.metadata.repermitDigest`. Do not use the Order Sink `hash` as the cancel digest. Use the same `permitData.domain.verifyingContract` that was fetched for the order; retain that address with local order metadata if cancellation may happen later.

Cancellation flow:

1. Fetch the order from `https://order-sink-v2.orbs.network/orders`.
2. Read `metadata.repermitDigest`.
3. Ask the user or custody system to send a transaction to the RePermit contract.
4. Call `cancel([metadata.repermitDigest])`. Use `metadata.repermitDigest`, not the Order Sink `hash`.
5. Wait for the transaction receipt.
6. Refetch the same Order Sink endpoint until metadata reflects the cancelled state.

The transaction sender should be the same address that signed the original order. In the signed order this is `order.witness.swapper`.

## Operational Checklist

- Fetch `permitData` from `/config` for the active partner and chain; use `"unknown"` if Orbs did not provide a partner identifier, and do not hardcode contract or exchange addresses.
- Confirm `permitData.domain.chainId` and `permitData.order.witness.chainid` match the connected chain.
- Preserve the API-provided domain, types, primary type, spender, reactor, executor, and exchange fields.
- Build the order close to signing time so `nonce`, `start`, and `deadline` are fresh.
- Use the exact same `order` object for signing and submission.
- Confirm allowance owner is the signer, spender is `permitData.domain.verifyingContract`, and allowance is at least `order.permitted.amount`.
- Confirm `witness.swapper` and the EIP-712 signer are the same address.
- Confirm all amounts are integer base-unit strings.
- Confirm `deadline` is in the future and `chainId` matches the connected chain.
- Store the returned order ID/hash from Order Sink for tracking and cancellation flows.
- Retain the fetched adapter and RePermit contract address with local order metadata for later history and cancellation operations.
- Store `metadata.repermitDigest` from fetched orders; it is the digest passed to `cancel(bytes32[])`.
