# Spot Integration for Ginco Wallet

This guide is for integrating Spot order creation, submission, fetching, and cancellation into Ginco Wallet.
The integration has five core operations:

1. Build a RePermit EIP-712 order with `buildRePermitOrderData`.
2. Ask the user, wallet, or custody system to sign that EIP-712 typed data.
3. Submit the signed order to Order Sink with `submitOrder`, or POST the same payload directly.
4. Fetch orders from Order Sink by `swapper`, `chainId`, and the Ginco adapter.
5. Cancel an order on-chain by calling RePermit `cancel(bytes32[])` with `metadata.repermitDigest`.

## Concepts

| Term | Meaning |
| --- | --- |
| Order Sink | Off-chain service that accepts signed RePermit orders and exposes them through the orders API. |
| RePermit | On-chain contract used for token authorization and cancellation. Users approve this contract to spend the source token. |
| Reactor | Contract encoded as the signed permit `spender`. It is part of the signed order and is not the ERC-20 allowance spender. |
| Swapper | User address that owns the order. This must be the EIP-712 signer and is stored at `order.witness.swapper`. |
| RePermit digest | Order cancellation digest returned by Order Sink as `metadata.repermitDigest`. This is passed to the RePermit `cancel(bytes32[])` function. |

## Integration Examples

- [Live demo](https://ginco-spot.vercel.app/)
- [spot-ui web app](https://github.com/orbs-network/spot-ui/blob/master/apps/web)
- [orbs-network/orbs-spot](https://github.com/orbs-network/orbs-spot)

## Function Contracts

This document describes the behavior of two functions. Your implementation can be in Java, Python, TypeScript, Go, or any other stack.

`buildRePermitOrderData(...)` builds the EIP-712 payload the user signs. It returns:

| Field | Purpose |
| --- | --- |
| `domain` | EIP-712 domain. Uses `name: "RePermit"`, `version: "1"`, the order chain ID, and the RePermit contract as `verifyingContract`. |
| `types` | EIP-712 type definitions for the RePermit witness order. |
| `primaryType` | Always `"RePermitWitnessTransferFrom"`. |
| `order` | The message the user signs and the same order object later sent to Order Sink. |

`submitOrder(order, signature)` sends the signed order to Order Sink. It posts:

```json
{
  "signature": { "v": "0x1b", "r": "0x...", "s": "0x..." },
  "order": { "...": "the signed RePermitOrder" },
  "status": "pending"
}
```

Your integration must know the RePermit contract, reactor, executor, exchange adapter, and fee reference addresses for the relevant partner and chain.

## Partner Config

Every integration must provide a partner config before building orders. These values are not discovered from Order Sink at submit time; they must be supplied by the integrating team for the chain and partner they support.

| Config value | Used in signed payload | Meaning |
| --- | --- | --- |
| `repermit` | `domain.verifyingContract` | RePermit contract address. Users approve this contract for ERC-20 allowance, and cancellations are sent to this contract. |
| `reactor` | `order.spender`, `order.witness.reactor` | Reactor contract address. This is the signed permit spender and the reactor encoded in the Spot witness. |
| `executor` | `order.witness.executor` | Executor address authorized for order execution. |
| `adapter` | `order.witness.exchange.adapter` | Exchange adapter address for the partner integration. |
| `fee` | `order.witness.exchange.ref` | Fee or referral reference address encoded into the signed exchange metadata. |

Ginco config object:

```ts
const config = {
  wm: "0x0005d5cE0dB57e5BE3b2b8b6FeB75f0ccd015000",
  repermit: "0x00002a9C4D9497df5Bd31768eC5d30eEf5405000",
  cosigner: "0x000ECFa392ecDEfEE6e2a5C095d39B7A32f1E000",
  reactor: "0x000000b33fE4fB9d999Dd684F79b110731c3d000",
  executor: "0x000642A0966d9bd49870D9519f76b5cf823f3000",
  refinery: "0x000E474c0D7084EAA35A501035E73269f4b009A5",
  adapter: "0x96604C3E846BBa75c43B5518bd076851e5484197",
  type: "universal",
  fee: "0xCf2eB80A89A69aB17e295aeF033Ffe9564736155",
  partner: "ginco",
};
```

The config must match the `chainId` in both `domain.chainId` and `order.witness.chainid`. A mismatched config can produce a signature that Order Sink rejects or an order that cannot execute.

## Prerequisites

Before signing and submitting:

- The user must be on the same `chainId` used in the order.
- Token amounts must be integer decimal strings in token base units, not human-readable decimals. For example, `1.5` tokens with 18 decimals is `"1500000000000000000"`.
- The signed source token must be an ERC-20 address. If the user starts with a native asset, wrap it first and use the wrapped token address in the signed order.
- The user must approve the signed source token for the RePermit contract with allowance at least `order.permitted.amount`.
- Do not confuse token allowance with the signed permit spender: ERC-20 allowance is granted to the RePermit contract, while `order.spender` is the reactor.
- The EIP-712 signer must match `order.witness.swapper`.

## Build the Order

`buildRePermitOrderData` should return the EIP-712 payload the user signs:

The contract addresses in the generated payload come from the partner config: `domain.verifyingContract` from `config.repermit`; `order.spender` and `order.witness.reactor` from `config.reactor`; `order.witness.executor` from `config.executor`; `order.witness.exchange.adapter` from `config.adapter`; and `order.witness.exchange.ref` from `config.fee`.

```js
{
  "domain": {
    "name": "RePermit",
    "version": "1",
    "chainId": 137,
    "verifyingContract": "0x00002a9C4D9497df5Bd31768eC5d30eEf5405000" // from config.repermit
  },
  "types": { "...": "see EIP712_TYPES below" },
  "primaryType": "RePermitWitnessTransferFrom",
  "order": {
    "permitted": {
      "token": "0xSourceToken...",
      "amount": "1000000000000000000"
    },
    "spender": "0x000000b33fE4fB9d999Dd684F79b110731c3d000", // from config.reactor
    "nonce": "1785273600000",
    "deadline": "1785878400",
    "witness": {
      "reactor": "0x000000b33fE4fB9d999Dd684F79b110731c3d000", // from config.reactor
      "executor": "0x000642A0966d9bd49870D9519f76b5cf823f3000", // from config.executor
      "exchange": {
        "adapter": "0x96604C3E846BBa75c43B5518bd076851e5484197", // from config.adapter
        "ref": "0xCf2eB80A89A69aB17e295aeF033Ffe9564736155", // from config.fee
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
const REPERMIT_PRIMARY_TYPE = "RePermitWitnessTransferFrom";

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
  slippage,
  account,
  srcAmountPerTrade,
  dstMinAmountPerTrade = "0",
  triggerAmountPerTrade = "0",
  module,
  freshnessSeconds = 60,
}) {
  const nonce = Date.now().toString();
  const epoch = Number.parseInt((fillDelayMillis / 1000).toFixed(0), 10);
  const deadline = toIntegerString(deadlineMillis / 1000);
  const freshness = freshnessSeconds;
  const start = Math.floor(Date.now() / 1000).toString();
  const limit = dstMinAmountPerTrade;
  const triggerLower =
    module === ORDER_MODULE.STOP_LOSS ? triggerAmountPerTrade : "0";
  const triggerUpper =
    module === ORDER_MODULE.TAKE_PROFIT ? triggerAmountPerTrade : "0";

  const order = {
    permitted: {
      token: srcToken,
      amount: srcAmount,
    },
    spender: "0x000000b33fE4fB9d999Dd684F79b110731c3d000", // from config.reactor
    nonce,
    deadline,
    witness: {
      reactor: "0x000000b33fE4fB9d999Dd684F79b110731c3d000", // from config.reactor
      executor: "0x000642A0966d9bd49870D9519f76b5cf823f3000", // from config.executor
      exchange: {
        adapter: "0x96604C3E846BBa75c43B5518bd076851e5484197", // from config.adapter
        ref: "0xCf2eB80A89A69aB17e295aeF033Ffe9564736155", // from config.fee
        share: 0,
        data: "0x",
      },
      swapper: account,
      nonce,
      start,
      deadline,
      chainid: chainId,
      exclusivity: 0,
      epoch,
      slippage,
      freshness,
      input: {
        token: srcToken,
        amount: srcAmountPerTrade,
        maxAmount: srcAmount,
      },
      output: {
        token: dstToken,
        limit: String(limit || "0"),
        triggerLower: String(triggerLower || "0"),
        triggerUpper: String(triggerUpper || "0"),
        recipient: account,
      },
    },
  };

  return {
    domain: {
      name: "RePermit",
      version: "1",
      chainId,
      verifyingContract: "0x00002a9C4D9497df5Bd31768eC5d30eEf5405000", // from config.repermit
    },
    types: EIP712_TYPES,
    primaryType: REPERMIT_PRIMARY_TYPE,
    order,
  };
}
```

The `types` value returned by the builder should be this exact `EIP712_TYPES` object:

```json
{
  "RePermitWitnessTransferFrom": [
    { "name": "permitted", "type": "TokenPermissions" },
    { "name": "spender", "type": "address" },
    { "name": "nonce", "type": "uint256" },
    { "name": "deadline", "type": "uint256" },
    { "name": "witness", "type": "Order" }
  ],
  "Exchange": [
    { "name": "adapter", "type": "address" },
    { "name": "ref", "type": "address" },
    { "name": "share", "type": "uint32" },
    { "name": "data", "type": "bytes" }
  ],
  "Input": [
    { "name": "token", "type": "address" },
    { "name": "amount", "type": "uint256" },
    { "name": "maxAmount", "type": "uint256" }
  ],
  "Order": [
    { "name": "reactor", "type": "address" },
    { "name": "executor", "type": "address" },
    { "name": "exchange", "type": "Exchange" },
    { "name": "swapper", "type": "address" },
    { "name": "nonce", "type": "uint256" },
    { "name": "start", "type": "uint256" },
    { "name": "deadline", "type": "uint256" },
    { "name": "chainid", "type": "uint256" },
    { "name": "exclusivity", "type": "uint32" },
    { "name": "epoch", "type": "uint32" },
    { "name": "slippage", "type": "uint32" },
    { "name": "freshness", "type": "uint32" },
    { "name": "input", "type": "Input" },
    { "name": "output", "type": "Output" }
  ],
  "Output": [
    { "name": "token", "type": "address" },
    { "name": "limit", "type": "uint256" },
    { "name": "triggerLower", "type": "uint256" },
    { "name": "triggerUpper", "type": "uint256" },
    { "name": "recipient", "type": "address" }
  ],
  "TokenPermissions": [
    { "name": "token", "type": "address" },
    { "name": "amount", "type": "uint256" }
  ]
}
```

`deadlineMillis`, `fillDelayMillis`, and `module` are builder inputs only. They are converted into the signed `deadline`, `epoch`, `triggerLower`, and `triggerUpper` fields; they are not sent as separate fields to Order Sink.

Do not mutate `order`, `domain`, `types`, or `primaryType` after signing. Any field change changes the signed digest.

## Signed Values

The user does not sign the builder input object. The user signs the EIP-712 payload returned by `buildRePermitOrderData`: `domain`, `types`, `primaryType`, and `order`.

Signed domain values:

| Signed value | Meaning |
| --- | --- |
| `domain.name` | Constant: `"RePermit"`. |
| `domain.version` | Constant: `"1"`. |
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
| `witness.exchange.share` | Fee share encoded in the signed exchange metadata. The current builder sets this to `0`. |
| `witness.exchange.data` | Extra adapter data bytes. The current builder sets this to `"0x"`, meaning no additional adapter data. |
| `witness.swapper` | User address that owns the order. This must match the EIP-712 signer. |
| `witness.nonce` | Same nonce value as top-level `nonce`. Keeping both values equal ties the Spot witness to the RePermit permit. |
| `witness.start` | Earliest order start time as a Unix timestamp in seconds, serialized as a decimal string. The current builder uses the current time when the order is built. |
| `witness.deadline` | Same expiry timestamp as top-level `deadline`, in seconds as a decimal string. |
| `witness.chainid` | EVM chain ID where the order is valid. This must match the EIP-712 domain chain. |
| `witness.exclusivity` | Exclusivity setting for execution. The current builder sets this to `0`. |
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

Order Sink expects the signature as an object with hex `v`, `r`, and `s` fields, not as a single signature string:

```json
{
  "v": "0x1b",
  "r": "0x...",
  "s": "0x..."
}
```

For a standard 65-byte ECDSA signature, send:

```text
r: first 32 bytes
s: next 32 bytes
v: final byte, encoded as hex such as "0x1b" or "0x1c"
```

For a compact EIP-2098 64-byte signature, recover `v` from the high bit of `s`, then clear that high bit from `s` before sending the signature to Order Sink.

Example signing flow:

```js
async function signOrder({ signer, orderInput }) {
  const orderData = buildRePermitOrderData(orderInput);

  const signature = await signer.signTypedData({
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
  "signature": { "v": "0x1b", "r": "0x...", "s": "0x..." },
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
  "signature": { "v": "0x1b", "r": "0x...", "s": "0x..." },
  "order": { "...": "the signed RePermitOrder" },
  "status": "pending"
}
```

A successful response contains `success: true` and a `signedOrder` object. Treat non-2xx responses, `success: false`, or a missing `signedOrder` as submission failures.

Example submit helper:

```js
async function submitOrder({ order, signature }) {
  const response = await fetch("https://order-sink-v2.orbs.network/orders/new", {
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

async function signAndSubmitOrder({ signer, orderInput }) {
  const { orderData, signature } = await signOrder({ signer, orderInput });

  return submitOrder({
    order: orderData.order,
    signature,
  });
}
```

`orderInput` is the object your backend or application passes to `buildRePermitOrderData`. It includes the partner `config` and the signed order values such as swapper, tokens, amounts, deadline, slippage, limits, and triggers. Do not send `orderInput` to Order Sink; only send the generated `orderData.order` with the user signature.

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

1. Build the EIP-712 payload.
2. Get the user signature over exactly that payload.
3. Split the signature into `{ v, r, s }` if needed.
4. POST `{ signature, order, status: "pending" }` to `/orders/new`.
5. Store the returned `signedOrder.hash` for tracking.
6. Store `signedOrder.metadata.repermitDigest` if present; this is the value used for cancellation.
7. Fetch the order from the Order Sink endpoint when you need the latest status, fills, or cancellation digest.

Order submission is not an on-chain transaction from the user. The user signs off-chain EIP-712 data, and Order Sink stores the signed order for execution.

## Fetch Order Sink Orders

Fetch RePermit orders from Order Sink with the swapper address, chain ID, and Ginco exchange adapter. The `swapper` query value is the order owner address, matching `order.witness.swapper`. The `exchange` query value should be the Ginco `config.adapter`.

```text
GET https://order-sink-v2.orbs.network/orders?swapper=0xUserAddress...&chainId=137&exchange=0x96604C3E846BBa75c43B5518bd076851e5484197
Accept: application/json
```

Example fetch helper:

```js
async function fetchOrderSinkOrders({ swapper, chainId }) {
  const response = await fetch(
    `https://order-sink-v2.orbs.network/orders?swapper=${swapper}&chainId=${chainId}&exchange=0x96604C3E846BBa75c43B5518bd076851e5484197`,
    {
      headers: { Accept: "application/json" },
    },
  );

  const payload = await response.json().catch(() => ({}));

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
address: 0x00002a9C4D9497df5Bd31768eC5d30eEf5405000
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

async function cancelOrder({ contractClient, orderSinkOrder, signer }) {
  const repermitDigest = orderSinkOrder.metadata?.repermitDigest;

  if (!repermitDigest) {
    throw new Error("Missing metadata.repermitDigest on Order Sink order");
  }

  return contractClient.writeContract({
    address: "0x00002a9C4D9497df5Bd31768eC5d30eEf5405000", // from config.repermit
    abi: REPERMIT_CANCEL_ABI,
    functionName: "cancel",
    args: [[repermitDigest]],
    account: signer,
  });
}
```

`orderSinkOrder` is one item from the submitted or fetched Order Sink response. The cancellation digest comes from `orderSinkOrder.metadata.repermitDigest`. Do not use the Order Sink `hash` as the cancel digest.

Cancellation flow:

1. Fetch the order from `https://order-sink-v2.orbs.network/orders`.
2. Read `metadata.repermitDigest`.
3. Ask the user or custody system to send a transaction to the RePermit contract.
4. Call `cancel([metadata.repermitDigest])`. Use `metadata.repermitDigest`, not the Order Sink `hash`.
5. Wait for the transaction receipt.
6. Refetch the same Order Sink endpoint until metadata reflects the cancelled state.

The transaction sender should be the same address that signed the original order. In the signed order this is `order.witness.swapper`.

## Operational Checklist

- Build the order close to signing time so `nonce`, `start`, and `deadline` are fresh.
- Use the exact same `order` object for signing and submission.
- Confirm allowance owner is the signer, spender is the RePermit contract, and allowance is at least `order.permitted.amount`.
- Confirm `witness.swapper` and the EIP-712 signer are the same address.
- Confirm all amounts are integer base-unit strings.
- Confirm `deadline` is in the future and `chainId` matches the connected chain.
- Store the returned order ID/hash from Order Sink for tracking and cancellation flows.
- Store `metadata.repermitDigest` from fetched orders; it is the digest passed to `cancel(bytes32[])`.
