# Perps API Integration

Integrate Perpetual Hub into your app through REST, WebSocket updates, and on-chain collateral deposits. These examples run on your backend and do not require a Perpetual Hub SDK.

Start with the overview, then follow the connection, signing, funding, and trading steps in order. The default partner is `global` on Arbitrum One, using the production endpoints below. Use the assigned lane configuration consistently and confirm funding instructions with the Orbs team before depositing collateral.

## Overview & Setup

**API version:** v1  
**Guide updated:** 25 October 2026

**Default deployment:** Arbitrum One, Global lane (`global:42161`)

**Audience:** partner engineers integrating a server-side trading account

When no partner is specified, use `global`: REST `https://perps-api.orbs.network`, WebSocket `wss://perps-api.orbs.network/ws`, routing header `X-Partner-Chain-Key: global:42161`, and rollup contract `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102` for both the EIP-712 domain and deposits. See the [Global connection values and readiness notes](/perps/api#connection-and-conventions). This deployment uses real USDC on Arbitrum One; confirm funding instructions before the first deposit.

This guide explains how to integrate without the Perpetual Hub UI or a Perpetual Hub SDK. Use HTTPS for account and trading requests, WebSocket for live updates, and your chain's JSON-RPC interface for collateral deposits.

### Account model

Your integration operates one partner-controlled wallet address as one trading account within your assigned partner and chain. That account has one net position per symbol. All orders, collateral, fees, funding, profit/loss and liquidation exposure belong to that account.

Your customer accounting and any allocation across other trading providers remain in your system. Funding a customer balance in your system does not fund this trading account: collateral must be deposited separately into the assigned Perpetual Hub contract.

The wallet and signing service can run on your backend. No browser component is required. A registered session key supports routine trading and private streaming; withdrawals require the account wallet's signature.

Backend REST calls require no CORS headers or browser-origin allowlisting. Backend WebSocket connections must send an agreed, allowlisted `Origin` header. See [connection requirements](/perps/api#connection-and-conventions) before connecting.

### Read in this order

| Guide | What you implement |
|---|---|
| [01 — Connection and conventions](/perps/api#connection-and-conventions) | Onboarding values, routing, numerical units, market discovery |
| [02 — Signing and sessions](/perps/api#signing-and-sessions) | Exact typed-data definitions, session registration and renewal |
| [03 — Deposits and withdrawals](/perps/api#deposits-and-withdrawals) | Token approval, contract deposits, withdrawal requests and payout tracking |
| [04 — Trading](/perps/api#trading) | Market/limit orders, position closes, TP/SL, replacement, cancellation and leverage |
| [05 — Account and history](/perps/api#account-and-history) | Balances, positions, orders, fills, funding, transactions and request lookup |
| [06 — Market data and streaming](/perps/api#market-data-and-streaming) | Prices, funding rates, public/private subscriptions and reconnect handling |
| [07 — Reliability and acceptance](/perps/api#reliability-and-acceptance) | Errors, uncertain outcomes, reconciliation and integration test checklist |

### First successful integration

1. Receive the onboarding values listed in [connection](/perps/api#connection-and-conventions).
2. Verify `/api/v1/config`, obtain the enabled symbol list, and confirm the selected symbol's execution rules.
3. Register a session key with an account-wallet-signed login.
4. Subscribe to market data and authenticated account updates.
5. Approve collateral and call the deposit contract. Wait for the account API to show usable collateral.
6. Set leverage, submit a small order, and confirm the resulting position and fill history.
7. Exercise cancellation, protective TP/SL and replacement flows.
8. Close the position and reconcile fills, fees and funding.
9. Request a small withdrawal, track its lifecycle, and confirm the wallet receipt.

An HTTP success response is not interchangeable with a fill or a completed wallet transfer. Each guide identifies which result to wait for.

### Endpoint index

All paths below are relative to your assigned HTTPS base URL. Always send `X-Partner-Chain-Key`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/config` | Chain and collateral contract addresses |
| GET | `/api/v1/markets` | Market catalogue |
| GET | `/api/v1/risk-config` | Public leverage, margin-bracket and trading-fee information |
| POST | `/api/v1/auth/login` | Register or replace the account's session key |
| GET | `/api/v1/prices` | Latest cached mark-price values |
| GET | `/api/v1/market-data` | Display prices, 24-hour statistics and funding-rate information |
| GET | `/api/v1/leverage/allowed?symbol=SYMBOL` | Currently allowed leverage |
| POST | `/api/v1/leverage` | Change account leverage for a symbol |
| POST | `/api/v1/order` | Submit an order, bracket order or replacement |
| DELETE | `/api/v1/order/{orderId}` | Cancel an open order, with a signed JSON body |
| GET | `/api/v1/user/{address}` | Current account, positions, pending orders and withdrawals |
| GET | `/api/v1/user/{address}/portfolio` | Account valuation and summary |
| GET | `/api/v1/user/{address}/risk-preview?symbol=SYMBOL` | Informational risk preview |
| GET | `/api/v1/user/{address}/trades` | Executed fills |
| GET | `/api/v1/user/{address}/funding` | Recorded funding charges/credits |
| GET | `/api/v1/user/{address}/orders/history` | Order activity |
| GET | `/api/v1/user/{address}/transactions` | Deposits and withdrawal requests, including withdrawal progress |
| GET | `/api/v1/user/{address}/request/{requestId}` | Recorded submission outcome and available execution evidence |
| POST | `/api/v1/withdraw` | Request a collateral withdrawal |

WebSocket uses the separately supplied URL. Deposits use the collateral and deposit contracts; there is no REST deposit-submission endpoint in this integration.

### Scope of the examples

The deployment URLs, chain ID, partner key, contract and collateral addresses in [Connection](/perps/api#connection-and-conventions) are Global production values. Account addresses, IDs, timestamps, prices and other example response values remain illustrative. Supply your own account credentials and generate fresh timestamps/signatures at runtime. The example symbol `XRPUSDT` is usable only if enabled for your integration. Values are examples, not executable trading recommendations or guaranteed acceptance limits.

Examples show the fields relevant to each flow. Responses may contain additional fields; clients should tolerate them. Do not add undocumented request fields.

This guide forms a self-contained partner handoff. No other repository documentation is required to follow it.

## Connection and Conventions

### Global deployment: Arbitrum One

Use **`global`** as the default partner, with chain ID **`42161`** and partner-chain key **`global:42161`**. The literal partner ID `default` identifies a separate lane; it is not an alias for `global`. Route every request with `X-Partner-Chain-Key: global:42161` and use Global's contract below for both the EIP-712 signing domain and collateral deposits. When integrating an assigned partner, replace the complete lane configuration together: signatures, deposits and state are scoped to that partner and chain.

| Value | Global default | Use |
|---|---|---|
| HTTPS base URL | `https://perps-api.orbs.network` | Prefix for REST paths |
| WebSocket URL | `wss://perps-api.orbs.network/ws` | Complete streaming URL |
| Backend WebSocket Origin | Your agreed, allowlisted origin | Obtain approval for the exact origin before connecting; the environment example below uses `https://perps.orbs.network` |
| Partner ID | `global` | Default partner for these examples |
| Chain ID | `42161` | Arbitrum One |
| Partner-chain key | `global:42161` | REST routing and WebSocket subscription selection |
| EIP-712 verifying contract | `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102` | Global signature domain |
| Deposit contract | `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102` | Global rollup proxy on Arbitrum One |
| Collateral token | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Native USDC on Arbitrum |
| Collateral decimals | `6` | Token-native transfer encoding; verified with ERC-20 `decimals()` |
| Chain RPC URL | `https://arb1.arbitrum.io/rpc` | Public RPC; a partner-managed Arbitrum RPC may also be used |
| Account wallet | Your own account address | Account identity and wallet authorizations |
| Execution rules, withdrawal terms and request-rate budget | Confirm before launch | Obtain current per-symbol rules, fees, cooldown, traffic budget and support contact |

The deposit and verifying-contract addresses are the same here. Keep separate configuration names so a future assigned deployment cannot accidentally reuse an old signature domain. `GET /api/v1/config` does not return all integration values, including token decimals or complete execution filters.

Load these environment variables for the examples in this guide:

```bash
export API_BASE_URL='https://perps-api.orbs.network'
export WS_URL='wss://perps-api.orbs.network/ws'
export WS_ORIGIN='https://perps.orbs.network'
export PARTNER_ID='global'
export CHAIN_ID='42161'
export PARTNER_CHAIN_KEY='global:42161'
export VERIFYING_CONTRACT='0xd2c8793397036f6D2F60A93D3eB28295a3F1B102'
export DEPOSIT_CONTRACT='0xd2c8793397036f6D2F60A93D3eB28295a3F1B102'
export COLLATERAL_TOKEN='0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
export COLLATERAL_DECIMALS='6'
export RPC_URL='https://arb1.arbitrum.io/rpc'
```

Configure your own account/session signing credentials separately as described in [Signing](/perps/api#signing-and-sessions). Global uses real USDC on Arbitrum One. Keep `global:42161`, the Global contract, and the production endpoints together; do not mix them with another partner or staging deployment. Set `WS_ORIGIN` to the exact origin agreed and allowlisted for your backend. Use test-sized amounts and confirm funding instructions before the first deposit.

#### Deployment readiness

Read-only checks on 25 October 2026 against `https://perps-api.orbs.network` with `X-Partner-Chain-Key: global:42161` returned HTTP 200 from `/api/v1/config`, `/api/v1/markets`, and `/api/v1/risk-config`. Configuration returned chain `42161`, Global contract `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102`, and Arbitrum USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`, matching the shared Global partner configuration.

These public reads do not establish completed deposit, trade, withdrawal, or WebSocket acceptance. Confirm current funding instructions, the agreed origin, lane limits, and the integration acceptance plan before running funded flows. If a configuration endpoint returns an error, stop and resolve it rather than substituting a different lane.

### Route every request explicitly

```bash
curl --fail-with-body "$API_BASE_URL/api/v1/config" \
  -H "X-Partner-Chain-Key: $PARTNER_CHAIN_KEY"
```

For JSON writes, also send `Content-Type: application/json`. Keep routing, signatures, wallet identity and contract configuration consistent throughout a flow. Select a different partner or chain using a separately configured client context.

REST requests in this guide do not use an API-key header or bearer access token. Write authorizations are signatures in the request body; private WebSocket subscriptions have their own signed message. Login registers a signing session rather than returning a bearer token.

### Backend access and browser origins

REST examples in this guide run on your backend. Server-to-server REST requests need no `Origin` header, CORS override header, or browser-origin allowlisting. Continue to send the documented routing headers, JSON content type and operation signatures.

WebSocket connections have a separate origin check, including connections from your backend. Before connecting, agree an origin with us and have it allowlisted for the supplied endpoint. Configure your backend WebSocket client to send that exact value in the handshake's `Origin` header. Missing or unapproved origins are rejected. See the [streaming connection example](/perps/api#market-data-and-streaming).

If you later call REST directly from a browser, we must allowlist the browser application's actual origin, or you can route those calls through your backend. An origin includes the scheme, hostname and port when non-default, with no path or trailing slash; production and local development origins must be agreed separately. Browsers set `Origin` automatically and do not let application code override it. Sending `Access-Control-Allow-Origin` in a request does not override CORS; it is a server response header. Browser WebSocket connections likewise use the browser application's actual origin.

An allowed origin does not replace the documented wallet/session signatures or partner-chain routing.

### Verify public configuration

#### GET `/api/v1/config`

Global configuration response observed on 25 October 2026:

```json
{
  "chainId": 42161,
  "contractAddress": "0xd2c8793397036f6D2F60A93D3eB28295a3F1B102",
  "usdcAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
}
```

`contractAddress` is the assigned deposit contract. The field name `usdcAddress` is retained by the API, but its value is the configured collateral token and is **not a promise that the token is USDC or uses six decimals**. Compare it to your onboarding token address and verify the RPC chain ID before funding.

#### GET `/api/v1/markets`

Returns an array, not a `markets` envelope:

```json
[
  {
    "symbol": "SOLUSDT",
    "baseAsset": "SOL",
    "quoteAsset": "USDT",
    "displayName": "SOL/USDT",
    "pricePrecision": 4,
    "quantityPrecision": 2,
    "tickSize": "0.0100",
    "stepSize": "0.01",
    "minQty": "0.01",
    "minNotional": "5"
  }
]
```

Use exact symbol names.

`tickSize`, `stepSize`, `minQty` and `minNotional` are the execution filters enforced for your lane. They are decimal strings in quote units (`tickSize`, `minNotional`) and base units (`stepSize`, `minQty`). Every limit, stop and bracket price must be an exact multiple of `tickSize`; non-market order quantities must be an exact multiple of `stepSize` and at least `minQty`; exposure-increasing orders must have a notional of at least `minNotional`. Orders that break these rules are rejected with HTTP 400 `INVALID_REQUEST` and a message such as `order price violates symbol filters: price 118.7228 is off-grid for increment 0.0100`. Snap executable prices and non-market quantities before signing: they are inside your EIP-712 signature. Market execution retains its existing quantity normalization; the signed request itself is not rewritten.

`pricePrecision` and `quantityPrecision` are Binance **display** precisions and are not the tick or step. They often disagree: SOLUSDT reports `pricePrecision` 4 but a `tickSize` of 0.01, and BTCUSDT reports 2 but a `tickSize` of 0.10. Rounding a price to `pricePrecision` decimals produces off-grid prices. Always snap to `tickSize` and `stepSize`; use the precisions only for formatting.

On a successful response, the filter fields are omitted for a symbol when your lane has no configuration for it; such symbols are not tradable on your lane. If the lane config is unavailable, unreadable or malformed, the endpoint returns HTTP 503 `SYMBOL_FILTERS_UNAVAILABLE` with `Cache-Control: no-store`. Retry the request; do not treat this failure as an empty set of tradable markets or replace a previously valid catalogue with it. Filters change rarely (they follow Binance futures exchange rules); cache the response and refresh it hourly or when you reconnect. See [Trading](/perps/api#trading) for how to snap at the request scale.

#### GET `/api/v1/risk-config`

Returns `symbols`, keyed by symbol, and optional `feeTiers`:

```json
{
  "symbols": {
    "XRPUSDT": {
      "defaultLeverage": 5,
      "maxLeverage": 20,
      "mmBrackets": []
    }
  },
  "feeTiers": [
    { "tierLevel": 0, "totalFeeRateBps": 5 }
  ]
}
```

This abbreviated example omits bracket entries. Each bracket can include `maxNotional`, `mmrBps`, `cum` and `maxLeverage`; use the returned values rather than example leverage or fees. Read your account's fee tier and current leverage separately. An informational quote or risk preview is not a reservation of capacity or a promise that an order will be accepted.

### Numerical encoding

Use integer or decimal-string arithmetic. Never round monetary values through JavaScript floating-point numbers.

| Field family | Encoding | Example |
|---|---|---|
| Order request `quantity` and signed quantity | Integer string / `uint256`, scale `1e8` | `"500000000"` = 5 base units |
| Order request `price`, `stopPrice` and bracket prices | Integer string, scale `1e6` | `"2000000"` = price 2 |
| Signed order/bracket `price`, `stopPrice` and leg prices | `uint256`, scale `1e18` | JSON request price multiplied by `1e12` |
| Returned order, position and trade prices | Integer string, scale `1e18` | `"2000000000000000000"` = price 2 |
| Account balances, fees, PnL, funding amounts, REST withdrawal amounts | Integer string, scale `1e6` | `"50000000"` = 50 account units |
| Contract deposit/payout token amounts | Integer, token-native decimals | 50 tokens is `50 × 10^COLLATERAL_DECIMALS` |
| `/prices` mark price | Integer string, scale `1e6` | `"2000000"` = price 2 |
| `/api/v1/market-data` and `market_data` WebSocket prices/rates | Human-readable decimal strings | `"2.0000"`, funding rate `"0.0001"` |
| Leverage | Whole-number multiplier | `5` means 5× |
| Basis points (`Bps`) | Integer basis points | `5` = 0.05% |
| Timestamps | Unix milliseconds | Generate with `Date.now()` |
| REST order ID | Decimal string | Preserve `"123456"`; use `BigInt` when signing |

Do not send a returned `1e18` price unchanged into a new order request: convert it to `1e6` and verify the result is representable on the symbol's price grid.

Example conversions using the same integer conventions:

```javascript
import { parseUnits, formatUnits } from 'viem';

const quantity = parseUnits('5', 8);       // 500000000n
const requestPrice = parseUnits('2', 6);   // 2000000n
const withdrawal = parseUnits('10', 6);    // 10000000n
const displayedFillPrice = formatUnits(2000000000000000000n, 18);
```

Validate decimal precision before conversion; do not silently round a partner's requested size or price. JSON cannot encode a JavaScript `bigint` directly: convert numeric payload amounts to decimal strings. Keep timestamps and bounded small values such as leverage as JSON numbers where shown in the request schemas.

### Time and identifiers

Generate a fresh timestamp immediately before signing. Login, trading, cancellation, leverage and withdrawal timestamps must be no more than 30 seconds old and no more than 2 seconds ahead of service time. Initial WebSocket-auth timestamps allow a five-minute difference. Keep the signing host's clock synchronized.

Generate a distinct `requestId` for each new order, cancellation or withdrawal intent, for example with `crypto.randomUUID()`. Persist the exact signed payload and ID before submission. Reusing an ID is not a general-purpose idempotency guarantee; see [reliability](/perps/api#reliability-and-acceptance).

## Signing and Sessions

### Signer roles

| Action | Signer used in this guide |
|---|---|
| Register or replace a session | Account wallet |
| Create, cancel or replace an order; change leverage | Registered session key |
| Subscribe to account WebSocket channels | Registered session key |
| Withdraw collateral | Account wallet, not session key |
| ERC-20 approval and contract deposit | Funding wallet submitting the on-chain transaction |

The account wallet may sign trading actions directly, but a registered session is required for authenticated account streaming. The `user` in a trading message is always the account wallet address, not the session key's address.

One active session key is stored per account in a partner-chain context. Registering another replaces it. Coordinate session rotation across all backend workers, and reconnect private streams with the new key. The maximum registration duration is 14 days from the login timestamp; renew before expiration. This guide does not depend on a separate logout or session-revocation endpoint.

### EIP-712 domain and partner binding

Use the environment values from [connection](/perps/api#connection-and-conventions) to construct this domain:

```javascript
const domain = {
  name: 'ProtocolTEE',
  version: '1',
  chainId: BigInt(process.env.CHAIN_ID),
  verifyingContract: process.env.VERIFYING_CONTRACT,
};
```

`ProtocolTEE` is the literal protocol domain name required by the signature format. Do not rename it to your brand. Use the verifying-contract address supplied during onboarding.

All types below include:

```javascript
import { sha256, stringToHex } from 'viem';

const partnerChainKeyHash = sha256(
  stringToHex(`partner_chain:${process.env.PARTNER_ID.trim()}:${process.env.CHAIN_ID.trim()}`),
);
```

This is SHA-256 of the UTF-8 string shown, **not keccak256**, and the literal `partner_chain:` prefix is required. Use the assigned partner ID and decimal chain ID. The HTTP header uses `PARTNER_ID:CHAIN_ID` without that prefix.

### Complete typed-data definitions

The order and spelling of fields matter. Use the exact `primaryType` and its corresponding definition. EIP-712 libraries construct the domain type separately; do not append `requestId`, JSON envelopes, `signature`, or nested REST objects to these types.

```javascript
const TYPES = {
  "Login": [
    {
      "name": "partnerChainKeyHash",
      "type": "bytes32"
    },
    {
      "name": "user",
      "type": "address"
    },
    {
      "name": "sessionPublicKey",
      "type": "string"
    },
    {
      "name": "sessionExpiresAt",
      "type": "uint256"
    },
    {
      "name": "timestamp",
      "type": "uint256"
    }
  ],
  "WebSocketAuth": [
    {
      "name": "partnerChainKeyHash",
      "type": "bytes32"
    },
    {
      "name": "user",
      "type": "address"
    },
    {
      "name": "timestamp",
      "type": "uint256"
    }
  ],
  "Order": [
    {
      "name": "partnerChainKeyHash",
      "type": "bytes32"
    },
    {
      "name": "user",
      "type": "address"
    },
    {
      "name": "symbol",
      "type": "string"
    },
    {
      "name": "orderType",
      "type": "string"
    },
    {
      "name": "side",
      "type": "string"
    },
    {
      "name": "quantity",
      "type": "uint256"
    },
    {
      "name": "price",
      "type": "uint256"
    },
    {
      "name": "stopPrice",
      "type": "uint256"
    },
    {
      "name": "reduceOnly",
      "type": "bool"
    },
    {
      "name": "closePosition",
      "type": "bool"
    },
    {
      "name": "timeInForce",
      "type": "string"
    },
    {
      "name": "timestamp",
      "type": "uint256"
    }
  ],
  "BracketOrder": [
    {
      "name": "partnerChainKeyHash",
      "type": "bytes32"
    },
    {
      "name": "user",
      "type": "address"
    },
    {
      "name": "symbol",
      "type": "string"
    },
    {
      "name": "side",
      "type": "string"
    },
    {
      "name": "orderType",
      "type": "string"
    },
    {
      "name": "quantity",
      "type": "uint256"
    },
    {
      "name": "price",
      "type": "uint256"
    },
    {
      "name": "stopPrice",
      "type": "uint256"
    },
    {
      "name": "reduceOnly",
      "type": "bool"
    },
    {
      "name": "closePosition",
      "type": "bool"
    },
    {
      "name": "timeInForce",
      "type": "string"
    },
    {
      "name": "timestamp",
      "type": "uint256"
    },
    {
      "name": "takeProfitType",
      "type": "string"
    },
    {
      "name": "takeProfitStopPrice",
      "type": "uint256"
    },
    {
      "name": "takeProfitPrice",
      "type": "uint256"
    },
    {
      "name": "stopLossType",
      "type": "string"
    },
    {
      "name": "stopLossStopPrice",
      "type": "uint256"
    },
    {
      "name": "stopLossPrice",
      "type": "uint256"
    }
  ],
  "Cancel": [
    {
      "name": "partnerChainKeyHash",
      "type": "bytes32"
    },
    {
      "name": "user",
      "type": "address"
    },
    {
      "name": "orderId",
      "type": "uint256"
    },
    {
      "name": "timestamp",
      "type": "uint256"
    }
  ],
  "Withdrawal": [
    {
      "name": "partnerChainKeyHash",
      "type": "bytes32"
    },
    {
      "name": "user",
      "type": "address"
    },
    {
      "name": "recipient",
      "type": "address"
    },
    {
      "name": "amount",
      "type": "uint256"
    },
    {
      "name": "isMax",
      "type": "bool"
    },
    {
      "name": "timestamp",
      "type": "uint256"
    }
  ],
  "Leverage": [
    {
      "name": "partnerChainKeyHash",
      "type": "bytes32"
    },
    {
      "name": "user",
      "type": "address"
    },
    {
      "name": "symbol",
      "type": "string"
    },
    {
      "name": "leverage",
      "type": "uint256"
    },
    {
      "name": "timestamp",
      "type": "uint256"
    }
  ]
};
```

### Session registration flow

Generate a secp256k1 session key in your signing service. `sessionPublicKey` is the **full uncompressed 65-byte public key**, encoded as `0x04…`; it is not the 20-byte address. Preserve the exact public-key string used in the signed login.

1. Generate and retain the session key.
2. Choose a fresh login timestamp and expiry no more than 14 days later.
3. Account-wallet-sign the `Login` message.
4. Submit `POST /api/v1/auth/login` with the same values.
5. Wait for `success: true` before using the session key.

Illustrative body:

```json
{
  "address": "0x1111111111111111111111111111111111111111",
  "sessionPublicKey": "UNCOMPRESSED_SESSION_PUBLIC_KEY_HEX",
  "sessionExpiresAt": 1800604800000,
  "timestamp": 1800000000000,
  "signature": "WALLET_LOGIN_SIGNATURE_HEX"
}
```

The login typed message uses `user`; the REST field is named `address`. Routing is supplied through `X-Partner-Chain-Key`. Do not send the session private key.

Successful response fields relevant to the client:

```json
{
  "success": true,
  "partnerChainKey": "global:42161",
  "partnerId": "PARTNER_ID",
  "chainId": "CHAIN_ID",
  "sessionExpiresAt": 1800604800000
}
```

There is no access token to extract. Registering the session creates the account if necessary, but does not fund it.

### Server-side signing example

The following JavaScript uses `viem`, the definitions above, and Node's `fetch`. It demonstrates the protocol directly rather than requiring a Perpetual Hub SDK. Place the `TYPES` object above this code in the same module. Supply all environment variables from your deployment's onboarding values.

```javascript
import { randomUUID } from 'node:crypto';
import { sha256, stringToHex, parseUnits } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const API_BASE_URL = process.env.API_BASE_URL.replace(/\/$/, '');
const PARTNER_ID = process.env.PARTNER_ID.trim();
const CHAIN_ID = process.env.CHAIN_ID.trim();
const PARTNER_CHAIN_KEY = `${PARTNER_ID}:${CHAIN_ID}`;
const accountWallet = privateKeyToAccount(process.env.ACCOUNT_PRIVATE_KEY);
const user = accountWallet.address;
const sessionPrivateKey = generatePrivateKey();
const session = privateKeyToAccount(sessionPrivateKey);
// Persist sessionPrivateKey and its expiry in your signing service before login.
// Reuse that key for the session; do not regenerate it for each order or worker.
const domain = {
  name: 'ProtocolTEE', version: '1',
  chainId: BigInt(CHAIN_ID),
  verifyingContract: process.env.VERIFYING_CONTRACT,
};
const partnerChainKeyHash = sha256(
  stringToHex(`partner_chain:${PARTNER_ID}:${CHAIN_ID}`),
);

async function api(path, method = 'GET', body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'X-Partner-Chain-Key': PARTNER_CHAIN_KEY,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!response.ok) {
    throw Object.assign(new Error(data.error || `HTTP ${response.status}`), {
      status: response.status,
      code: data.code,
      response: data,
      retryAfter: response.headers.get('Retry-After'),
    });
  }
  return data;
}

function sign(signer, primaryType, message) {
  return signer.signTypedData({
    domain, primaryType,
    types: { [primaryType]: TYPES[primaryType] },
    message: { partnerChainKeyHash, ...message },
  });
}

async function registerSession() {
  const timestamp = Date.now();
  const sessionExpiresAt = timestamp + 7 * 24 * 60 * 60 * 1000;
  const signature = await sign(accountWallet, 'Login', {
    user, sessionPublicKey: session.publicKey,
    sessionExpiresAt: BigInt(sessionExpiresAt),
    timestamp: BigInt(timestamp),
  });
  const result = await api('/api/v1/auth/login', 'POST', {
    address: user, sessionPublicKey: session.publicKey,
    sessionExpiresAt, timestamp, signature,
  });
  if (result.success !== true) throw new Error('Session registration not confirmed');
  return result;
}

// Build only; call after session registration and collateral confirmation.
async function buildLimitOrder() {
  const timestamp = Date.now();
  const quantity = parseUnits('5', 8);
  const apiPrice = parseUnits('2', 6);
  const apiStopPrice = 0n;
  const fields = {
    user, symbol: 'XRPUSDT', orderType: 'LIMIT', side: 'BUY',
    reduceOnly: false, closePosition: false, timeInForce: 'GTC',
  };
  const signature = await sign(session, 'Order', {
    ...fields, quantity,
    price: apiPrice * 1_000_000_000_000n,
    stopPrice: apiStopPrice * 1_000_000_000_000n,
    timestamp: BigInt(timestamp),
  });
  return {
    requestId: randomUUID(),
    order: {
      ...fields, quantity: quantity.toString(),
      price: apiPrice.toString(), stopPrice: apiStopPrice.toString(),
      timestamp, signature,
    },
  };
}

// Explicit application sequence (these calls register/submit when uncommented):
// await registerSession();
// const request = await buildLimitOrder();
// Persist request here before submission.
// const result = await api('/api/v1/order', 'POST', request);
```

A request timeout is an uncertain outcome, not permission to submit a newly signed duplicate. The example helper deliberately does not automatically retry mutations. See [reliability](/perps/api#reliability-and-acceptance).

### Mapping REST payloads to signatures

| Action | `primaryType` | Values to sign |
|---|---|---|
| Plain order, standalone TP/SL or close | `Order` | Account, symbol, exact type/side, quantity, scaled prices, flags, time-in-force, timestamp |
| Entry with attached TP/SL | `BracketOrder` | Entry fields plus flattened TP/SL fields |
| Cancel | `Cancel` | Account, numeric order ID, timestamp |
| Replace | New `Order` or `BracketOrder` plus `Cancel` | New intent plus separate authorization for the old order |
| Set leverage | `Leverage` | Account, symbol, whole-number leverage, timestamp |
| Withdraw | `Withdrawal` | Account, recipient equal to account, amount, `isMax`, timestamp |
| Private subscription | `WebSocketAuth` | Account and timestamp |

For **all order/bracket price fields**, multiply the REST integer at `1e6` by `1e12` before signing. Quantity remains at `1e8`. Withdrawal amounts remain at `1e6`. Zero-valued unused prices remain zero.

For a bracket order, sign the `BracketOrder` type once. Put that same signature in both `order.signature` and `order.bracket.bracketSignature`. An absent TP or SL leg is represented in the typed message by type `""`, stop price `0` and price `0`; omit that leg from the REST `bracket` object. Do not replace the bracket signature with a plain `Order` signature.

For replacement, place the separately signed `Cancel` authorization in `order.replacement` with the old `orderId` and its signed timestamp. See the complete payloads in [trading](/perps/api#trading).

Sign the exact order-type spelling you submit. For example, `STOP` and `STOP_LOSS_LIMIT` are not interchangeable inside an already signed message. The same applies to `TAKE_PROFIT` and `TAKE_PROFIT_LIMIT`. Never normalize a signed type after signing.

If any signed value changes, create a new signature. Use the original timestamp and payload only when resolving or retransmitting that same intent within its validity window.


### Complete bracket-signing example

Using the helper and variables in the server-side example, this builds a market entry with market TP/SL. Prices are illustrative and must be valid for the current market.

```javascript
async function buildBracketEntry() {
  const timestamp = Date.now();
  const quantity = 500_000_000n;
  const tp = 2_200_000n; // HTTP scale 1e6
  const sl = 1_800_000n;
  const scale = 1_000_000_000_000n;
  const fields = {
    user, symbol: 'XRPUSDT', side: 'BUY', orderType: 'MARKET',
    reduceOnly: false, closePosition: false, timeInForce: 'GTC',
  };
  const signature = await sign(session, 'BracketOrder', {
    ...fields, quantity, price: 0n, stopPrice: 0n,
    timestamp: BigInt(timestamp),
    takeProfitType: 'TAKE_PROFIT_MARKET', takeProfitStopPrice: tp * scale,
    takeProfitPrice: 0n,
    stopLossType: 'STOP_MARKET', stopLossStopPrice: sl * scale, stopLossPrice: 0n,
  });
  return {
    requestId: randomUUID(),
    order: {
      ...fields, quantity: quantity.toString(), price: '0', stopPrice: '0',
      timestamp, signature,
      bracket: {
        takeProfit: { orderType: 'TAKE_PROFIT_MARKET', stopPrice: tp.toString(), price: '0', timeInForce: 'GTC' },
        stopLoss: { orderType: 'STOP_MARKET', stopPrice: sl.toString(), price: '0', timeInForce: 'GTC' },
        bracketSignature: signature,
      },
    },
  };
}
```

### Cancel-signing example

```javascript
async function buildCancellation(orderId) {
  const timestamp = Date.now();
  const signature = await sign(session, 'Cancel', {
    user, orderId: BigInt(orderId), timestamp: BigInt(timestamp),
  });
  return {
    path: `/api/v1/order/${encodeURIComponent(orderId)}`,
    body: { requestId: randomUUID(), timestamp, signature },
  };
}
// const cancellation = await buildCancellation(savedOrderId);
// Persist cancellation.body, then api(cancellation.path, 'DELETE', cancellation.body).
```

For a replacement, use the same `Cancel` typed message to authorize the existing order, then include its `orderId`, `timestamp` and `signature` in the new order's `replacement` object. The new order also needs its own `Order` or `BracketOrder` signature. Do not submit the cancellation separately when using the replacement flow.

## Deposits and Withdrawals

### Two separate units

The REST API uses six-decimal account amounts on **every supported chain**. A token transaction uses that token's native decimals. These are independent of the order-price signing conversion described in [signing](/perps/api#signing-and-sessions).

| Operation for 50 units | Six-decimal collateral | Eighteen-decimal collateral |
|---|---|---|
| ERC-20 approval/deposit transaction | `50000000` | `50000000000000000000` |
| Credited REST account amount | `"50000000"` | `"50000000"` |
| REST withdrawal request for 50-unit payout | `"50000000"` | `"50000000"` |

Confirm `decimals()` on the configured collateral token and compare it to onboarding values. Do not choose the scale based on the chain name or the API field name `usdcAddress`.

### Deposit flow

Deposits are on-chain transactions, not REST mutations. The funding wallet needs the configured collateral token and native gas currency on the assigned chain.

1. Fetch and verify `/api/v1/config`.
2. Read ERC-20 `decimals()`, `balanceOf(fundingWallet)` and `allowance(fundingWallet, depositContract)`.
3. Convert the intended amount into token-native units.
4. If allowance is insufficient, call `approve(depositContract, amount)` on the token and wait for a successful receipt. Follow the token's approval requirements if replacing a nonzero allowance.
5. Call `depositForAccount(accountId, amount)` on the assigned deposit contract.
6. Wait for a successful transaction receipt and retain the transaction hash.
7. Poll the account and transaction-history APIs until the deposit has been credited and collateral is available for trading.

The account ID is the 20-byte account wallet address **left-padded to 32 bytes**, not a hash and not the session key address:

```javascript
import { padHex } from 'viem';
const accountId = padHex(ACCOUNT_ADDRESS, { size: 32 });
```

The funding wallet can be different from the trading account wallet. Collateral is credited to `accountId`; withdrawal requests in this guide pay the trading account wallet.

#### Contract interfaces

```solidity
// Collateral token
function decimals() external view returns (uint8);
function balanceOf(address owner) external view returns (uint256);
function allowance(address owner, address spender) external view returns (uint256);
function approve(address spender, uint256 amount) external returns (bool);

// Assigned deposit contract
function depositForAccount(bytes32 accountId, uint256 amount) external;
event PendingDeposit(bytes32 accountId, uint256 depositCounter, uint256 amount);
```

`PendingDeposit.amount` is in token-native units. The event and successful transaction receipt acknowledge the deposit transaction; account credit is a separate step.

#### Node deposit example

This example submits real transactions when run with funded credentials. Use only the assigned chain, contract and approved test amount. It uses the same `viem` library as the signing examples and needs the environment values from [connection](/perps/api#connection-and-conventions).

```javascript
import {
  createPublicClient, createWalletClient, http,
  parseAbi, parseUnits, padHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const payer = privateKeyToAccount(process.env.FUNDING_PRIVATE_KEY);
const rpc = createPublicClient({ transport: http(process.env.RPC_URL) });
const wallet = createWalletClient({ account: payer, transport: http(process.env.RPC_URL) });
const token = process.env.COLLATERAL_TOKEN;
const contract = process.env.DEPOSIT_CONTRACT;
const accountId = padHex(process.env.ACCOUNT_ADDRESS, { size: 32 });
const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]);
const depositAbi = parseAbi([
  'function depositForAccount(bytes32 accountId,uint256 amount)',
]);

if (await rpc.getChainId() !== Number(process.env.CHAIN_ID)) {
  throw new Error('RPC chain does not match the assigned chain');
}
const decimals = await rpc.readContract({ address: token, abi: tokenAbi, functionName: 'decimals' });
if (decimals !== Number(process.env.COLLATERAL_DECIMALS)) {
  throw new Error('Collateral decimals differ from onboarding values');
}
const amount = parseUnits('50', decimals);
const balance = await rpc.readContract({
  address: token, abi: tokenAbi, functionName: 'balanceOf', args: [payer.address],
});
if (balance < amount) throw new Error('Insufficient collateral token balance');
const allowance = await rpc.readContract({
  address: token, abi: tokenAbi, functionName: 'allowance', args: [payer.address, contract],
});
if (allowance < amount) {
  const hash = await wallet.writeContract({
    chain: null, address: token, abi: tokenAbi,
    functionName: 'approve', args: [contract, amount],
  });
  const receipt = await rpc.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Approval reverted');
}
const hash = await wallet.writeContract({
  chain: null, address: contract, abi: depositAbi,
  functionName: 'depositForAccount', args: [accountId, amount],
});
// Persist hash before waiting; a timeout must not cause a second deposit.
const receipt = await rpc.waitForTransactionReceipt({ hash });
if (receipt.status !== 'success') throw new Error('Deposit reverted');
// Next: observe account credit through REST, not just the transaction receipt.
```

#### Confirm account credit

Read both:

```text
GET /api/v1/user/{address}
GET /api/v1/user/{address}/transactions?limit=20&offset=0
```

A credited deposit appears as a `DEPOSIT` transaction and in current account balances. Check `availableBalance` before trading. In an active account, a balance change alone cannot identify a deposit because trades, fees and funding can change balances concurrently. Record the on-chain receipt and compare account/history state; serialize the first funding test to make reconciliation unambiguous.

If a deposit transaction times out, inspect the same transaction hash before submitting anything else. Do not treat a missing account credit immediately after mining as a failed transaction.

### Withdrawal flow

A withdrawal uses a signed REST request. The payout recipient is the account wallet itself. There is no arbitrary-recipient field in this endpoint and no separate partner release call.

1. Read the account's current `availableBalance`.
2. Select a payout amount and allow for the fee.
3. Account-wallet-sign the `Withdrawal` type with `recipient = user`.
4. Submit `POST /api/v1/withdraw`.
5. Save the request ID and returned withdrawal ID.
6. Poll account `pendingWithdrawals` and the corresponding transaction's `withdrawal` lifecycle.
7. After release confirmation, verify the token transfer to the account wallet.

Serialize withdrawal submissions per account and reconcile each accepted request before creating a new one. A fresh timestamp changes the signed withdrawal intent.

#### Current payout rules

For the version covered by this guide, amounts below are six-decimal account units:

| Rule | Value |
|---|---|
| Ordinary minimum payout | 2 units (`2000000`) |
| Maximum payout per request | 10,000 units (`10000000000`) |
| Fee for a positive payout | 1 unit (`1000000`), charged in addition to payout |

Confirm terms during onboarding. Trading fee tiers are separate from withdrawal fees. Reconcile actual recorded withdrawal `amount` and `fee`; do not substitute these quoted values for historical accounting.

For a 10-unit payout, request `amount="10000000"`. An accepted ordinary request debits 11 units: 10 payout plus 1 fee.

#### POST `/api/v1/withdraw`

| Field | Type | Meaning |
|---|---|---|
| `requestId` | string | Your unique request correlation ID |
| `user` | address string | Account wallet |
| `amount` | integer string | Requested payout at `1e6`, excluding fee |
| `isMax` | boolean | Explicit maximum-withdrawal intent; include it in the signature |
| `timestamp` | number | Fresh Unix milliseconds |
| `signature` | hex string | Account-wallet signature over `Withdrawal` |

Illustrative request:

```json
{
  "requestId": "bfa60617-5a13-46cb-9ae8-619df8abc102",
  "user": "0x1111111111111111111111111111111111111111",
  "amount": "10000000",
  "isMax": false,
  "timestamp": 1800000000000,
  "signature": "WALLET_WITHDRAWAL_SIGNATURE_HEX"
}
```

Using the `sign` helper from [signing](/perps/api#signing-and-sessions):

```javascript
const timestamp = Date.now();
const amount = 10_000_000n;
const isMax = false;
const signature = await sign(accountWallet, 'Withdrawal', {
  user, recipient: user, amount, isMax, timestamp: BigInt(timestamp),
});
const body = {
  requestId: randomUUID(), user, amount: amount.toString(),
  isMax, timestamp, signature,
};
// Persist body, then submit with api('/api/v1/withdraw', 'POST', body).
```

Typical successful response is HTTP `201`, with:

```json
{
  "withdrawalId": "EXAMPLE_WITHDRAWAL_ID",
  "user": "0x1111111111111111111111111111111111111111",
  "amount": "10000000",
  "timestamp": 1800000000000,
  "status": "PENDING"
}
```

`PENDING` means the request was accepted; it is not a completed transfer.

#### Maximum withdrawals and small balances

`isMax=true` is not an instruction to calculate an unspecified amount. Compute the explicit payout from the latest available balance, sign it and send it:

```javascript
const available = BigInt(account.availableBalance);
if (available <= 0n) throw new Error('No available balance');
const fee = 1_000_000n;
const perRequestCap = 10_000_000_000n;
const feeAwarePayout = available > fee ? available - fee : 0n;
const payout = feeAwarePayout > perRequestCap ? perRequestCap : feeAwarePayout;
// Sign Withdrawal with amount: payout, isMax: true.
```

A maximum payout below the ordinary 2-unit minimum is allowed when it is the exact fee-aware maximum. Example: 2 available units can produce a 1-unit payout plus a 1-unit fee using `isMax=true`.

If available balance is positive but no more than 1 unit, `amount="0"` with `isMax=true` requests a **fee-only drain** of that balance. It sends no tokens to the wallet. Only request this if draining the balance without payout is intended. A successful fee-only request can return `status="EXECUTED"` with an empty withdrawal ID; transaction history reports `FEE_ONLY` and the actual charged fee.

Available balance can change between reading and signing. An old balance calculation may be rejected; refresh the account and resolve the original outcome before submitting a new intent.

### Track cooldown and final payout

`GET /api/v1/user/{address}` includes pending entries such as:

```json
{
  "withdrawalId": "EXAMPLE_WITHDRAWAL_ID",
  "recipient": "0x1111111111111111111111111111111111111111",
  "amount": "10000000",
  "requestedAt": 1800000000000,
  "availableAt": 1800043200000
}
```

Use the returned `availableAt` in milliseconds. Do not hardcode the illustrative interval above or promise payout exactly at that time: it is the time the request becomes eligible for release.

In `/api/v1/user/{address}/transactions`, the original `WITHDRAWAL` stays one monetary row. Its nested `withdrawal.status` advances through `REQUEST_ACCEPTED`, `RELEASE_ACCEPTED` and `ROLLUP_CONFIRMED`; `RELEASE_FAILED` describes a failed release attempt. The original top-level `SUCCESS` remains admission status. `FEE_ONLY` requires no payout. `LINK_UNAVAILABLE` means the available history cannot establish progress; it is not confirmation.

A release has no second debit. Count the original accepted request's `amount + fee` once when both financial fields are available. If `accountingStatus="UNAVAILABLE"`, retain the transaction but do not treat a missing amount or fee as zero or substitute today's fee. Lifecycle progress and accounting completeness are separate: a release can be confirmed while historical accounting remains unavailable. For complete fields and historical-data handling, see [account history](/perps/api#account-and-history).

A disappearance from `pendingWithdrawals` alone does not prove receipt. Use the transaction's release confirmation and verify the token transfer in the returned payout transaction. There is no fixed completion-time guarantee in these endpoints.

## Trading

Use one partner-owned account address for this integration. The account has a net position per symbol; orders are not independent strategy subaccounts. Your backend must reconcile the shared position before submitting concurrent strategy actions. Use the partner-chain headers and signing domain assigned during onboarding, and follow [Signing](/perps/api#signing-and-sessions) for wallet and delegated-session signatures.

Paths below are relative to your assigned API origin. Replace `<ACCOUNT_ADDRESS>`, `<SYMBOL>`, `<ORDER_ID>` and signature placeholders before sending requests. Examples are illustrative, not executable signed requests; timestamps must be fresh and signatures must cover the exact values submitted.

### Precision

Send financial values as integer strings. Do not pass them through floating-point arithmetic.

| Field | Request scale | Response scale |
|---|---|---|
| `quantity` | 100,000,000 units per base-asset unit | Same |
| `price`, `stopPrice`, bracket prices | 1,000,000 units per quote-currency unit | 1,000,000,000,000,000,000 units per quote-currency unit |
| `fee` | Not supplied when ordering | 1,000,000 units per collateral unit |
| `timestamp` | Unix milliseconds | Unix milliseconds |
| `orderId` | Decimal identifier string in URL/replacement | Decimal identifier string |

Signing uses `1e18` prices: multiply the `1e6` request price/stop price by `1e12` when constructing the Order or BracketOrder typed message, including bracket leg prices. Keep HTTP request prices at `1e6`; see [Signing](/perps/api#signing-and-sessions).

For example, 0.01 base units is `"1000000"`; a 50,000 quote-unit limit is `"50000000000"` in a request but `"50000000000000000000000"` in an order response. Do not copy response prices into a new request without converting the scale. Keep identifiers as strings even if they contain only digits. Market precision, minimum sizes and permitted instruments must come from the `tickSize`, `stepSize`, `minQty` and `minNotional` fields of [`GET /api/v1/markets`](/perps/api#connection-and-conventions); the examples below do not establish valid order sizes for every instrument.

#### Snapping prices and quantities to the lane filters

Executable limit, stop and bracket prices must be an exact multiple of the symbol's `tickSize`; non-market quantities must be an exact multiple of its `stepSize` (and at least `minQty`). Do this in integer arithmetic at the request scale before signing, because the signed values cannot be changed by the server:

1. Convert the filter to the request scale: `tickScaled = tickSize × 1e6` and `stepScaled = stepSize × 1e8`. For SOLUSDT, `tickSize` `"0.0100"` becomes `10000` and `stepSize` `"0.01"` becomes `1000000`.
2. Snap: `price = floor(price / tickScaled) × tickScaled` for buys (or `ceil` for sells, if you prefer not to cross your own limit), and `quantity = floor(quantity / stepScaled) × stepScaled`.
3. Reject locally if `quantity < minQty × 1e8`, or if the notional of an exposure-increasing order is below `minNotional`.

Do **not** derive the tick from `pricePrecision`. Binance reports SOLUSDT with `pricePrecision` 4 and a tick of 0.01; a price of 118.7228 is on the 4-decimal grid but off the tick and is rejected with HTTP 400 `INVALID_REQUEST`: `order price violates symbol filters: price 118.7228 is off-grid for increment 0.0100`. The same applies to BTCUSDT (`pricePrecision` 2, tick 0.10): 84573.37 is rejected, 84573.30 is accepted.

The backend performs this check before contacting the TEE and returns the reason in the error message. Checks follow order-type semantics: MARKET base `price` and `stopPrice` fields are not executable prices and are ignored by the early filter check; LIMIT checks `price` but ignores `stopPrice`. Stop orders check `stopPrice` and any supplied positive `price`, including STOP_MARKET and TAKE_PROFIT_MARKET. Attached bracket prices are checked for every supported parent type. Market execution retains its existing quantity normalization. The TEE enforces the same rules independently, so a request that bypasses the backend check is still rejected.

### Create an order

`POST /api/v1/order`

Illustrative limit order:

```json
{
  "requestId": "partner-order-0001",
  "order": {
    "user": "<ACCOUNT_ADDRESS>",
    "symbol": "<SYMBOL>",
    "orderType": "LIMIT",
    "side": "BUY",
    "quantity": "1000000",
    "price": "50000000000",
    "stopPrice": "0",
    "reduceOnly": false,
    "closePosition": false,
    "timeInForce": "GTC",
    "timestamp": 1790000000000,
    "signature": "<ORDER_SIGNATURE>"
  }
}
```

| Field | Meaning |
|---|---|
| `requestId` | Your correlation identifier. Use a new identifier for each new intent and retain it with the signed payload. It is not an exchange-style client order ID or a promise of safe HTTP retries. |
| `user` | Partner-owned account address. |
| `symbol` | Exact supported market identifier; obtain it from the market list. |
| `orderType` | Exact supported type from the table below. The signed spelling must equal the submitted spelling. |
| `side` | `BUY` or `SELL`. |
| `quantity` | Requested base-asset quantity in integer units. For fixed-size orders use a positive quantity. |
| `price` | Limit price; use `"0"` for a market order. |
| `stopPrice` | Trigger price for protective orders; use `"0"` for ordinary market/limit orders. |
| `reduceOnly` | Restricts the order to reducing an existing position. |
| `closePosition` | Closes the applicable existing position rather than specifying a fixed-size reduction. See below. |
| `timeInForce` | Execution policy included in the signed order. Use `GTC` for resting/protective orders unless your selected order family supports another policy. |
| `timestamp`, `signature` | Fresh signed intent as specified in the signing chapter. |
| `bracket` | Optional attached take-profit/stop-loss definition, authorized together with the entry by the BracketOrder signature. |
| `replacement` | Optional signed replacement authorization for an existing pending order. |

Do not send leverage as an order property: set it through the leverage endpoint.

#### Order families

| Type | Use |
|---|---|
| `MARKET` | Immediate execution attempt at available execution prices. |
| `LIMIT` | Price-limited order. Acceptance does not mean it has filled. |
| `STOP_MARKET` | Stop-loss trigger with market execution, for an existing position. |
| `TAKE_PROFIT_MARKET` | Take-profit trigger with market execution, for an existing position. |
| `STOP`, `STOP_LOSS_LIMIT` | Stop-loss trigger followed by a limit order. Supply both trigger and limit prices. |
| `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT` | Take-profit trigger followed by a limit order. Supply both trigger and limit prices. |

Pending-order reads can return canonical names (`STOP_LOSS_LIMIT` and `TAKE_PROFIT_LIMIT`) for accepted `STOP` and `TAKE_PROFIT` requests. Preserve the originally signed request for reconciliation; sign any replacement using the exact new spelling you will submit.

Protective stop/take-profit orders must be reducing or closing exits; standalone stop-entry orders are not supported. A triggered limit exit can remain unfilled. The currently supported `LIMIT` execution policies include `GTC`, `IOC`, and `FOK`; select deliberately and confirm instrument availability. Do not assume that every policy works with every protective type.

For a fixed-size exit, set `reduceOnly=true`, `closePosition=false`, the opposing side, and the amount to reduce. For an immediate full close, the existing client sends `closePosition=true`, the opposing side, and the current absolute position quantity. Use a positive quantity for protective close-position requests too: the HTTP order path rejects zero quantities. The applicable close size is resolved when processed. A close-position intent is not a reservation of today's size. Use the exact flags and quantity included in your signature.

For a long position, exits sell; take-profit triggers are above the relevant reference price and stop-loss triggers below it. For a short position, exits buy and the directions reverse. Prices can move between preparing and submitting an order; a previously reasonable trigger may then be rejected.

#### Common order recipes

Each row below describes the `order` object inside the same `POST /api/v1/order` envelope. Supply `user`, `symbol`, a fresh timestamp and the correct signature as above. The numeric examples assume a long position of 5 units around price 2; select currently valid prices and sizes for your market.

| Intent | Type / side | Quantity (`1e8`) | Price / trigger (`1e6`) | Flags |
|---|---|---|---|---|
| Open/increase long at market | `MARKET` / `BUY` | `500000000` | price `0`, stop `0` | `reduceOnly=false`, `closePosition=false` |
| Resting long entry | `LIMIT` / `BUY` | `500000000` | price `2000000`, stop `0` | Both false |
| Reduce long by 2 units | `MARKET` / `SELL` | `200000000` | Both `0` | `reduceOnly=true`, `closePosition=false` |
| Close entire current long | `MARKET` / `SELL` | Current absolute size, here `500000000` | Both `0` | `reduceOnly=false`, `closePosition=true` |
| Full-position stop-loss | `STOP_MARKET` / `SELL` | Current absolute size | price `0`, stop `1800000` | `reduceOnly=false`, `closePosition=true` |
| Full-position take-profit | `TAKE_PROFIT_MARKET` / `SELL` | Current absolute size | price `0`, stop `2200000` | `reduceOnly=false`, `closePosition=true` |
| Fixed-size stop-limit exit | `STOP` / `SELL` | `200000000` | price `1790000`, stop `1800000` | `reduceOnly=true`, `closePosition=false` |

Use `timeInForce="GTC"` in these examples. For a short position, reverse BUY/SELL and choose protective trigger directions accordingly. A non-reducing order on the opposite side can change or reverse net exposure; use exit flags deliberately instead of assuming SELL always means close.

There is no separate close-position endpoint. A full close is a signed order and must be confirmed through the resulting position state and fills.

#### Attached take-profit and stop-loss

Attach `bracket` to an entry order to associate exits with that entry. Supply one or both legs. Each leg has `orderType`, `stopPrice`, optional `price`, and optional `timeInForce`. For an attached bracket, use the BracketOrder signature in both `order.signature` and `order.bracket.bracketSignature`; do not sign a separate plain Order message for that request. See [Signing](/perps/api#signing-and-sessions).

Illustrative fragment for an entry around 50,000:

```json
{
  "bracket": {
    "takeProfit": {
      "orderType": "TAKE_PROFIT_MARKET",
      "stopPrice": "55000000000",
      "timeInForce": "GTC"
    },
    "stopLoss": {
      "orderType": "STOP_MARKET",
      "stopPrice": "45000000000",
      "timeInForce": "GTC"
    },
    "bracketSignature": "<BRACKET_SIGNATURE>"
  }
}
```

This fragment belongs inside `order`, alongside the signed entry fields. Exit orders may remain dormant until their associated entry exposure exists. Refresh pending orders to obtain the actual child IDs and their `parentOrderId`, `bracketGroupId`, and `attachedRole`; do not invent child IDs or send duplicate exits after reconnecting.

#### Replace a pending order or protective exit

There is no separate replacement URL. Submit the full new order to `POST /api/v1/order` and include:

```json
{
  "replacement": {
    "orderId": "<ORDER_ID>",
    "timestamp": 1790000000000,
    "signature": "<REPLACEMENT_SIGNATURE>"
  }
}
```

This fragment is inside `order`. The new order authorization and the replacement authorization are both required. Replacement authorization uses the Cancel signing schema for the original order. Replacement is supported for pending limit/protective orders, not market orders. The original must still exist and be eligible when the request is processed. Preserve the account, market, position side and exit role required by the original order. Attached exits retain their protective role; do not use a replacement to convert a stop-loss into a new entry or change its parent relationship. Fixed-size attached exits remain reduce-only. A fill or cancellation racing the replacement can cause rejection. Use the returned ID and refreshed pending orders to identify the replacement; do not continue addressing the replaced ID as though it were still active.

### Order response and cancellation

Successful creation returns an order response (normally HTTP `201`); cancellation returns an order response. Illustrative accepted limit response:

```json
{
  "orderId": "1234567890123456789",
  "user": "<ACCOUNT_ADDRESS>",
  "symbol": "<SYMBOL>",
  "orderType": "LIMIT",
  "side": "BUY",
  "quantity": "1000000",
  "price": "50000000000000000000000",
  "reduceOnly": false,
  "closePosition": false,
  "timeInForce": "GTC",
  "timestamp": 1790000000000,
  "status": "NEW"
}
```

The response repeats the order fields, using response price units. `status` describes the order result; inspect it instead of inferring a fill from an HTTP success. Returned statuses include `NEW`, `PENDING_ACTIVATION` (dormant), `PARTIALLY_FILLED`, `FILLED`, `CANCELED`, `EXPIRED`, and `REJECTED`.

Optional fields include `entryPrice` (execution entry price), `fee`, `parentOrderId`, `bracketGroupId`, `attachedRole`, and opaque verification metadata `stateRoot`, `sequenceNumber`, `teeSignature`. Verification metadata is not another order identifier.

To cancel, send `DELETE /api/v1/order/<ORDER_ID>` with a JSON body, as in the existing client flow:

```json
{
  "requestId": "partner-cancel-0001",
  "timestamp": 1790000000000,
  "signature": "<CANCEL_SIGNATURE>"
}
```

The path identifies the order; omit the redundant body `orderId`. The cancellation signature binds the account and target order as described in [Signing](/perps/api#signing-and-sessions). A successful transport response does not undo a fill that already occurred. Refresh account state and history after races, rejection, or an interrupted response.

### Leverage

`GET /api/v1/leverage/allowed?symbol=<SYMBOL>` returns `symbol`, `allowedLeverage`, `symbolMaxLeverage`, `tierMaxLeverage`, `aggregateNotional`, `tierIndex`, and `tierMaxNotional`. Leverage values are integers; notional fields are integer strings in collateral units with scale `1e6`. The allowed value is a current cap, not reserved capacity.

`POST /api/v1/leverage` changes the account's preference for one symbol:

```json
{
  "user": "<ACCOUNT_ADDRESS>",
  "symbol": "<SYMBOL>",
  "leverage": 5,
  "timestamp": 1790000000000,
  "signature": "<LEVERAGE_SIGNATURE>"
}
```

The response contains `symbol`, `leverage`, and optional `stateRoot`/`sequenceNumber`. Changing leverage can require sufficient margin and may be rejected. Use account `leveragePreferences` to refresh the current values; do not assume an earlier allowed-leverage query guarantees approval.

### Reconciliation and retries

Retain the exact signed request and correlation ID until its outcome is resolved. After an uncertain response, use the account snapshot, pending orders, fills, and `GET /api/v1/user/<ACCOUNT_ADDRESS>/request/<REQUEST_ID>` described in [Account and history](/perps/api#account-and-history). This lookup preserves a recorded success over later rejected retries. Its top-level status is admission status; optional `orderExecution` describes subsequent evidence and is not a complete-fill guarantee. Use fills and the current position to reconcile execution. A `404` is not proof that no effect could have occurred. Creating a new timestamp/signature changes the trading intent and can create another order. Do not automatically re-sign a timed-out mutation.

## Account and History

By default, use `X-Partner-Chain-Key: global:42161` and `https://perps-api.orbs.network`; see the connection values and Deployment readiness notes in [Connection and Conventions](/perps/api#connection-and-conventions). The account is shared by all of your backend's trading processes and has one net position per symbol. There is no strategy or subaccount selector in these endpoints.

All paths below are relative to your assigned API origin. `<ACCOUNT_ADDRESS>`, `<SYMBOL>`, and `<REQUEST_ID>` are placeholders. These are read endpoints; reading a risk estimate or an allowed amount does not reserve trading capacity.

### Units and conventions

Financial values are integer strings, with these scales:

| Values | Scale |
|---|---|
| Account balances, margin, fees, funding, PnL, payout amounts, volume, notional | `1e6` per collateral/quote unit |
| Position and fill quantities | `1e8` per base-asset unit |
| Account, order and fill response prices | `1e18` per quote unit |
| Fee/maintenance rates ending in `Bps`, and `lockedMMR` | Basis points: 10,000 = 100% |
| Account/history timestamps | Unix milliseconds unless explicitly noted |

Keep all financial strings and identifiers lossless. A missing monetary field is unknown or inapplicable, not automatically zero. Signed PnL and funding may be negative. These protocol collateral units do not establish the native token decimals used for on-chain transfers; see [Funding](/perps/api#deposits-and-withdrawals).

### Current account

`GET /api/v1/user/<ACCOUNT_ADDRESS>`

Illustrative response for a funded account with no open exposure:

```json
{
  "user": {
    "address": "<ACCOUNT_ADDRESS>",
    "balance": "1000000000",
    "nonce": 0,
    "feeTier": 0
  },
  "positions": [],
  "pendingOrders": [],
  "pendingWithdrawals": [],
  "availableBalance": "1000000000",
  "marginUsed": "0",
  "maintenanceMargin": "0",
  "marginBalance": "1000000000",
  "unrealizedPnl": "0",
  "leveragePreferences": {}
}
```

| Field | Meaning |
|---|---|
| `user.address`, `user.balance` | Account identity and collateral balance. This is the trading account, not an external wallet's token balance. |
| `user.nonce` | Returned account metadata; do not use it as a substitute for the timestamp/signing requirements of trading requests. |
| `user.feeTier` | Current account fee-tier identifier, when included. |
| `positions` | Current positions, described below. |
| `pendingOrders` | Open/dormant order representations using the response fields and scales in [Trading](/perps/api#trading). |
| `pendingWithdrawals` | Accepted withdrawals still awaiting release; each has `withdrawalId`, `recipient`, `amount`, `requestedAt`, `availableAt`. Amount is payout in `1e6`; both timestamps are Unix milliseconds. Absence from this array alone does not prove receipt in the wallet. |
| `availableBalance` | Current available collateral estimate after margin commitments. |
| `marginUsed` | Initial margin committed to exposure and pending orders. |
| `maintenanceMargin` | Maintenance requirement. |
| `marginBalance` | Account equity including unrealized PnL. |
| `unrealizedPnl` | Aggregate current unrealized PnL. |
| `leveragePreferences` | Map from symbol to integer leverage preference. |

Each position contains:

- `symbol`, `quantity`, `entryPrice`: instrument, signed net size, and average entry price. Positive size is long; negative size is short.
- `markPrice`, `liquidationPrice`: optional reference and liquidation-price estimates.
- `initialMargin`, `maintenanceMargin`, `allocatedMargin`: optional collateral amounts associated with the position.
- `lockedMMR`: position maintenance rate in basis points, when included.
- `accumulatedFunding`: signed cumulative funding amount for the position.
- `openTimestamp`: opening timestamp in Unix milliseconds.

Use an account refresh after submissions and stream reconnection. A series of separate reads is not an atomic snapshot of all markets and histories.

### Portfolio summary

`GET /api/v1/user/<ACCOUNT_ADDRESS>/portfolio`

All monetary fields below use `1e6`, including turnover values:

| Fields | Meaning |
|---|---|
| `userAddress` | Account address. |
| `walletBalance` | Trading-account collateral balance, not external wallet holdings. |
| `totalEquity`, `perpsEquity` | Current equity including unrealized PnL. |
| `totalValue` | Reported gross display value: collateral balance + absolute position USD value + unrealized PnL. It is not synonymous with equity or withdrawable funds. |
| `availableBalance`, `marginUsed`, `maintenanceMargin` | Available collateral and margin requirements. |
| `unrealizedPnl`, `realizedPnl`, `totalPnl` | Unrealized, realized, and total performance values. Total PnL can be based on equity plus withdrawals minus deposits; do not assume it always equals the sum of the other two displayed fields. |
| `totalDeposits`, `totalWithdrawals` | Cumulative account cash flows; withdrawals represent payouts rather than a second release debit. |
| `totalPositionUsdValue` | Aggregate absolute current position notional. |
| `volume24h`, `volume14d`, `volume30d`, `volumeAllTime` | Traded volume over each named horizon. |
| `feeTier`, `totalFeeRateBps` | Fee-tier identifier and current aggregate trading fee rate in basis points. |
| `timestamp` | Summary timestamp, Unix milliseconds. |
| `source` | Informational source label; treat it as opaque, not a switch for financial logic. |

This is a current summary. To calculate historical portfolio values, you need complete relevant cash-flow, fill and funding coverage. The paginated history window does not guarantee complete lifetime data.

### Risk preview

`GET /api/v1/user/<ACCOUNT_ADDRESS>/risk-preview?symbol=<SYMBOL>`

This provides inputs for estimates, not an order approval or a quote.

| Field | Meaning |
|---|---|
| `user`, `symbol` | Requested account and instrument. |
| `walletBalance` | Account collateral balance, `1e6`. |
| `upnlOthers`, `maintenanceMarginOthers` | Unrealized PnL and maintenance margin for other symbols, `1e6`. |
| `feeTier`, `feeRateBps` | Applicable fee tier and rate. |
| `aggregateNotional` | Current aggregate instrument notional used for capacity/risk estimates, `1e6`. |
| `mmBrackets` | Maintenance brackets; each has `maxNotional`, `mmrBps`, `cum`, optional `maxLeverage`. `maxNotional` and `cum` use `1e6`; `mmrBps` is basis points. |
| `existingPosition` | Optional same-symbol position: `quantity` (`1e8`), `entryPrice` (`1e18`), `lockedMMR` (basis points). |
| `timestamp` | Preview timestamp in Unix milliseconds. |

Fetch allowed leverage separately using the endpoint in [Trading](/perps/api#trading). Changing market conditions and account activity can invalidate an estimate before submission.

### History endpoints and pagination

| Endpoint | Array property | Records |
|---|---|---|
| `/api/v1/user/<ACCOUNT_ADDRESS>/trades` | `trades` | Executed fills, including position increases, reductions and closes. |
| `/api/v1/user/<ACCOUNT_ADDRESS>/funding` | `funding` | Funding cash-flow history. |
| `/api/v1/user/<ACCOUNT_ADDRESS>/orders/history` | `orders` | Order activity, including funding entries; it is not simply a list of current open orders. |
| `/api/v1/user/<ACCOUNT_ADDRESS>/transactions` | `transactions` | Deposit and withdrawal request records with optional withdrawal lifecycle. |

Use `?limit=20&offset=0`. Lists return their array plus `total`, `limit`, and `offset`. Default limit is 20; supported explicit limits are 1–100. Invalid/out-of-range limits fall back to the default, so advance by the returned `limit`, not the value you requested. Offset defaults to 0; malformed, negative, or greater-than-10,000 offsets return `400 INVALID_PAGINATION`.

Records are returned newest first. Stop when `offset + returnedLimit >= total` or when the next offset would exceed 10,000. `total` still counts the full history, including older records outside this access window. Complete exports beyond the supported window are not available through these offset endpoints. If you deliberately export only the latest 10,000 records, label that limit. Do not calculate a complete lifetime ledger from truncated data.

New activity may arrive between page requests. Deduplicate fills by `id`, and mixed activity records by `(operationType, id)`; an offset scan is not a frozen export. Do not assume a full page proves no earlier data is missing.

#### Fill schema

Illustrative `/trades` response:

```json
{
  "trades": [
    {
      "id": 101,
      "symbol": "<SYMBOL>",
      "side": "BUY",
      "quantity": "1000000",
      "price": "50000000000000000000000",
      "fee": "250000",
      "realizedPnl": "0",
      "isClose": false,
      "timestamp": 1790000000000
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

`id` identifies the history record, not an order. `symbol`, `side`, `quantity`, and `price` describe the fill. `fee` and `realizedPnl` describe its accounting where available; `isClose` marks position-closing activity. One fill need not represent an entire order. Fills are not historical position snapshots, and this schema does not include an order ID; do not manufacture joins from equal size/price/time.

#### Funding charges and credits

`/funding` returns `operationType="FUNDING"` records. Their `amount` is the signed funding amount in `1e6`: **positive means the account paid funding; negative means it received funding**. `side` is `PAY` or `RECEIVE`. For example, `amount="250000"` is a 0.25-unit charge; `amount="-250000"` is a 0.25-unit credit. Subtract the signed amount when applying it to a cash-flow ledger.

The rate in the market-data stream is not the account's charged amount. Use the recorded funding amount; do not multiply a current quote by current exposure to reconstruct an earlier charge. A missing or zero historical timestamp is unknown timing, not a settlement on 1 January 1970. Order history also includes funding records; do not count both views as separate charges.

#### Activity and transaction schema

Funding, order history and transactions share these fields:

| Fields | Meaning |
|---|---|
| `id`, `operationType` | Record ID and activity category. Use the category before interpreting financial fields. |
| `requestId` | Original caller correlation ID, when available. |
| `userAddress`, `symbol`, `side` | Account and optional instrument/direction. |
| `quantity`, `price` | Optional size (`1e8`) and price (`1e18`). |
| `amount`, `fee`, `realizedPnl` | Optional collateral amounts (`1e6`); preserve signs. |
| `status`, `rejectReason` | Recorded acceptance/result and optional rejection explanation. A successful order admission is not a complete-fill assertion; a successful withdrawal request is not a completed payout. |
| `timestamp` | Activity timestamp, Unix milliseconds. |
| `teeSequence`, `stateRoot` | Optional opaque verification references. They are not order IDs or additional monetary activity. |
| `rollupId` | Optional on-chain batch reference. For withdrawal payment progress use the nested release's reference, not the request's reference. |
| `extraData` | Optional activity-specific metadata; do not depend on a universal schema or use it as an amount. |
| `withdrawal` | Transactions-only optional lifecycle enrichment, below. |

Count only successful monetary activity when reconstructing debits/credits. Do not sum all activity arrays together: the same event can appear in multiple views.

### Withdrawal lifecycle within transactions

A withdrawal contributes its original request record to `transactions`. Release attempts do not add another monetary transaction, change page counts, or move the request's timestamp. For a successful request, payout is `amount`; additional account debit is `fee`; count `amount + fee` once. Missing fee is unknown, not a default fixed fee. A fee-only drain may have amount `"0"` and a positive fee.

Illustrative transaction entry, with optional fields omitted:

```json
{
  "id": 201,
  "operationType": "WITHDRAWAL",
  "requestId": "partner-withdraw-0001",
  "userAddress": "<ACCOUNT_ADDRESS>",
  "amount": "10000000",
  "fee": "1000000",
  "status": "SUCCESS",
  "timestamp": 1790000000000,
  "withdrawal": {
    "status": "RELEASE_ACCEPTED",
    "availableAt": 1790000060000,
    "release": {
      "status": "SUCCESS",
      "teeSequence": 250
    }
  }
}
```

| `withdrawal.status` | Meaning |
|---|---|
| `REQUEST_REJECTED` | Request rejected; do not count a successful debit. |
| `REQUEST_ACCEPTED` | Request accepted; linked successful release not established. |
| `RELEASE_FAILED` | A linked release attempt failed; this does not reverse the original request debit or establish a refund. |
| `RELEASE_ACCEPTED` | Release accepted, but confirmed on-chain payment is not yet established. |
| `ROLLUP_CONFIRMED` | Signed release has confirmed on-chain batch evidence. |
| `FEE_ONLY` | Fee-only drain, with no payout/release required. |
| `LINK_UNAVAILABLE` | Available historical evidence cannot establish the lifecycle link. |

Other lifecycle fields are `withdrawalId` (protocol identifier), `eventWithdrawalId` (corresponding bytes32 on-chain identifier), and `availableAt` (cooldown ends, Unix milliseconds). Cooldown expiry is eligibility, not a receipt-time guarantee. Identifiers can be absent on older records; absence is not evidence of a failed payout.

`release` contains `status`, `teeSequence`, and optional `operationId`, `requestId`, `timestamp`, `rollupId`, `rollupStatus`, `txHash`, `confirmedAt`. `timestamp` is Unix milliseconds; `confirmedAt` is Unix milliseconds. Some proof-backed releases lack `operationId`, `requestId`, and `timestamp`; do not manufacture these. A confirmed signed release takes precedence over missing history rows and later failed attempts. The nested release contains no additional debit.

### Direct request lookup

`GET /api/v1/user/<ACCOUNT_ADDRESS>/request/<REQUEST_ID>`

URL-encode the request identifier as a path component. The response is one activity record using the schema above, with optional `orderExecution`:

```json
{
  "id": 301,
  "operationType": "CREATE_LIMIT_ORDER",
  "requestId": "partner-order-0001",
  "userAddress": "<ACCOUNT_ADDRESS>",
  "symbol": "<SYMBOL>",
  "status": "SUCCESS",
  "timestamp": 1790000000000,
  "orderExecution": {
    "eventOrderId": "<BYTES32_EVENT_ORDER_ID>",
    "latestEvent": "TRADE_FILLED",
    "teeSequence": 350
  }
}
```

`orderExecution.eventOrderId` is the signed-event identifier, not the decimal `orderId` used for cancellation. `latestEvent` can be `ORDER_PLACED`, `TRADE_FILLED`, `ORDER_CANCELLED`, or `ORDER_REPLACED`. `teeSequence` identifies the available evidence; `rollupId` is optional. A `TRADE_FILLED` event alone does not prove a complete fill. A replacement ends the old order's history; querying the new request follows the replacement order. Market closes can include execution evidence. If evidence is absent, `orderExecution` is omitted rather than guessed.

For withdrawals, this endpoint reports request admission and available accounting, without the nested `withdrawal` lifecycle. Use `/api/v1/user/<ACCOUNT_ADDRESS>/transactions` for release and payout progress. An unavailable optional accounting lookup does not hide the recorded request; missing financial facts remain explicitly unavailable.

A recorded success wins over a later rejected retry using the same ID; otherwise the latest recorded attempt is returned. Scope is the same account and partner-chain. Use distinct IDs for distinct intents: the lookup is not a payload-bound idempotency API.

A missing recorded request returns a JSON `404` containing `requestId`. A plain-text route-level `404` indicates an unavailable route or incorrect URL, not the absence of a recorded request; an unavailable service can return `503` or another error. Neither a timeout nor a not-found response authorizes blindly re-signing a mutation. Reconcile account state, open orders and fills before deciding whether a new intent is appropriate.

#### Unavailable accounting or lifecycle details

A successful withdrawal with missing or invalid payout/fee values carries `accountingStatus="UNAVAILABLE"`. The request was accepted, but its monetary details cannot currently be established. Keep the transaction visible and flag reconciliation as incomplete; do not substitute zero, a default fee, or a guessed debit. This differs from an explicitly recorded `amount="0"` dust drain with a recorded fee. Missing lifecycle identity does not erase available payout and fee.

Unavailable or inconsistent lifecycle evidence affects only that withdrawal (`withdrawal.status="LINK_UNAVAILABLE"`), so other transactions remain accessible. Order requests retain their admission result when execution evidence is unavailable; optional `orderExecution` is omitted. These fields do not turn a successful request into a rejection or authorize resubmission.

Missing historical request amounts and fees may be recovered from retained evidence consistently in transactions, request status, explorer events and rollup detail. If the historical event did not record a fee, that fee remains unknown. This enrichment does not create another transaction or change the request ID/count. Successful release records returned by request status also carry `accountingStatus="UNAVAILABLE"` when financial details are unavailable.

For charts, reconstruct backwards from a current account snapshot only through fully known activity at or before that snapshot. Refresh the snapshot when newer activity arrives; do not silently present an older cutoff as current. A liquidation balance reset cannot establish the balance before liquidation: use complete earlier history to reconstruct that segment, or show only the known segment from the reset with incomplete-period performance clearly indicated. Do not treat unknown older fees as zero or claim complete historical performance across a gap. Lifecycle failures remain actionable even when accounting is incomplete.

## Market Data and Streaming

### REST market data

#### GET `/api/v1/prices`

Returns the latest cached mark prices:

```json
{
  "prices": [
    { "symbol": "XRPUSDT", "price": "2000000", "timestamp": 1800000000000 }
  ]
}
```

Prices here use `1e6`; timestamps are Unix milliseconds. An empty list or missing symbol means no value is currently available. It does not mean the price is zero. Check freshness before using a value.

#### GET `/api/v1/market-data`

Returns a `markets` array:

```json
{
  "markets": [
    {
      "symbol": "XRPUSDT",
      "price": "2.0000",
      "markPrice": "2.0001",
      "priceChangePercent": "1.25",
      "high24h": "2.1000",
      "low24h": "1.9000",
      "volume24h": "1200000.0",
      "fundingRate": "0.0001",
      "nextFundingTime": 1800028800000,
      "updatedAt": 1800000000000
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `symbol` | Market identifier |
| `price` | Latest display trading price, decimal string |
| `markPrice` | Display mark price, decimal string |
| `priceChangePercent` | Percentage value: `"1.25"` means 1.25% |
| `high24h`, `low24h` | Decimal-string 24-hour prices |
| `volume24h` | Decimal-string market volume |
| `fundingRate` | Decimal fractional rate: `"0.0001"` means 0.01% |
| `nextFundingTime` | Scheduled next funding time, Unix milliseconds |
| `updatedAt` | Record update time, Unix milliseconds |

Fields other than symbol/update time may be absent. Merge present values into your cache without converting absent values into zero. Market-data updates describe the market, not your account's actual funding debit. Use `/api/v1/user/{address}/funding` for recorded account funding.

Do not reuse the order-response `1e18` price parser for this endpoint: these prices are human-readable decimals.

### Connect and subscribe

Connect to `wss://perps-api.orbs.network/ws` using the environment values in [Connection](/perps/api#connection-and-conventions). Subscription payloads must use `global:42161`. Use text JSON messages. The subscription payload carries the partner-chain selection; do not assume REST headers select the WebSocket context.

Your backend must send the exact `Origin` agreed and allowlisted during onboarding. This is required for both public and private streams, even though backend REST calls need no CORS headers. Set it in the opening handshake, not in a subscription message:

```http
Origin: https://perps.orbs.network
```

For example, with the Node.js `ws` package:

```js
import WebSocket from 'ws';

const socket = new WebSocket(process.env.WS_URL, {
  origin: process.env.WS_ORIGIN, // Exact origin confirmed during onboarding.
});

socket.on('open', () => {
  socket.send(JSON.stringify({
    type: 'SUBSCRIBE',
    partnerChainKey: process.env.PARTNER_CHAIN_KEY,
    channels: ['market_data'],
  }));
});
```

Use a backend WebSocket client that supports setting handshake headers. A missing or unapproved origin causes the handshake to be rejected; confirm the configured value and allowlisting before retrying. Private account subscriptions still require the signed authentication below.

#### Public market stream

```json
{
  "type": "SUBSCRIBE",
  "partnerChainKey": "global:42161",
  "channels": ["market_data"]
}
```

Expected acknowledgement:

```json
{
  "type": "SUBSCRIBED",
  "partnerChainKey": "global:42161",
  "partnerId": "orbs",
  "chainId": "42161",
  "channels": ["market_data"]
}
```

Then handle `MARKET_DATA_SNAPSHOT` and `MARKET_DATA_UPDATE`:

```json
{
  "type": "MARKET_DATA_UPDATE",
  "channel": "market_data",
  "partnerChainKey": "global:42161",
  "data": [
    {
      "symbol": "XRPUSDT",
      "markPrice": "2.0001",
      "fundingRate": "0.0001",
      "nextFundingTime": 1800028800000,
      "updatedAt": 1800000000000
    }
  ]
}
```

Both message types use the market-data field definitions above. Build your symbol cache from the snapshot, then merge updates by symbol. The subscription has no per-symbol filter field; filter received symbols in your client.

#### Account subscriptions

Register a session first. Sign `WebSocketAuth` using that session with `partnerChainKeyHash`, `user` and a fresh timestamp. Use the definitions and `sign` helper in [signing](/perps/api#signing-and-sessions):

```javascript
const timestamp = Date.now();
const signature = await sign(session, 'WebSocketAuth', {
  user, timestamp: BigInt(timestamp),
});
const subscription = {
  type: 'SUBSCRIBE', partnerChainKey: PARTNER_CHAIN_KEY,
  channels: ['orders', 'positions', 'fills', 'liquidations'],
  user, timestamp, signature,
};
// Send JSON.stringify(subscription) after the WebSocket opens.
```

`orders`, `positions` and `fills` require the registered session and are account-filtered. **`liquidations` is a public stream for the selected partner-chain; authentication does not restrict it to your account.** Before applying a liquidation to your position ledger, check that the envelope’s `partnerChainKey` matches your configured context and that `data.user` matches your account address (compare Ethereum addresses case-insensitively). Ignore other accounts’ liquidations. The subscription’s `user` is the account wallet, not the session address. Open a separate connection for another account or partner-chain context.

Subscription success is acknowledged with `SUBSCRIBED`, the accepted `channels` and `user`. An `ERROR` message means the affected request did not establish the requested subscription:

```json
{
  "type": "ERROR",
  "code": "UNAUTHORIZED",
  "message": "private channels require an authenticated session"
}
```

React to the code, not exact message wording. Renew an expired/replaced session, reconnect, sign a new auth timestamp and resubscribe. Do not reuse a weeks-old connection-auth signature.

### Account event reference

Account events use this envelope:

```json
{
  "type": "FILL",
  "channel": "fills",
  "partnerChainKey": "global:42161",
  "data": {
    "fillId": "EXAMPLE_FILL_ID",
    "orderId": "123456",
    "user": "0x1111111111111111111111111111111111111111",
    "symbol": "XRPUSDT",
    "side": "BUY",
    "quantity": "500000000",
    "price": "2000000000000000000",
    "fee": "5000",
    "realizedPnl": "0",
    "timestamp": 1800000000000
  }
}
```

| Type / channel | `data` fields |
|---|---|
| `ORDER_UPDATE` / `orders` | `orderId`, `user`, `symbol`, `orderType`, `side`, `quantity`, optional `price`, `status`, `timestamp` |
| `POSITION_UPDATE` / `positions` | `user`, `symbol`, `quantity`, `entryPrice`, `accumulatedFunding`, `openTimestamp` |
| `FILL` / `fills` | `fillId`, `orderId`, `user`, `symbol`, `side`, `quantity`, `price`, `fee`, optional `realizedPnl`, `timestamp` |
| `LIQUIDATION` / `liquidations` | `liquidationId`, `user`, `symbol`, `liquidatedQuantity`, `liquidationPrice`, `penalty`, `remainingCollateral`, `timestamp` |

Quantities use `1e8`. These account-event prices use `1e18`. Fees, PnL, funding amounts and collateral use `1e6`. These scales differ from the public decimal-string `market_data` channel.

Events are notifications, not complete account snapshots. An order update does not contain every TP/SL field, and a position update does not contain every balance/risk field. Refresh account REST state when needed. Never count an event and its corresponding historical fill as two trades.

### Unsubscribe

```json
{
  "type": "UNSUBSCRIBE",
  "channels": ["market_data"]
}
```

The response is `UNSUBSCRIBED` with the affected channels and context metadata. Unsubscribing does not cancel orders or revoke the registered session.

### Reconnect and reconciliation

1. Reconnect with bounded backoff and jitter after an unexpected close.
2. Sign a fresh account subscription, if applicable, and wait for acknowledgement.
3. Buffer new notifications while refreshing `/api/v1/user/{address}` and recent histories.
4. Reconcile stored order IDs, fill IDs and request IDs with those responses.
5. Apply notifications idempotently and periodically refresh authoritative account/history reads.

There is no documented replay cursor or resume-from-sequence facility on this WebSocket interface. Do not assume exactly-once delivery or that reconnecting replays missed fills. Deduplicate using IDs, and use history after disconnects. A quiet socket does not prove that no trade or funding change occurred.

Use a WebSocket implementation that handles protocol ping/pong frames. Do not send invented JSON `PING` commands; the application commands documented here are `SUBSCRIBE` and `UNSUBSCRIBE`.

### Optional chart/depth reads

Charts are not required for the trading integration. If your assigned deployment supports them, these public reads are available:

| Endpoint | Parameters |
|---|---|
| `GET /api/v1/market-data/klines` | `symbol`, `interval`; optional `startTime`, `endTime` in milliseconds and `limit` (1–1500, default 500) |
| `GET /api/v1/market-data/depth` | `symbol`; optional `limit` from 5, 10, 20, 50, 100, 500, 1000 (default 500) |

Candle responses contain `symbol`, `interval`, `klines`; each candle contains `openTime`, `open`, `high`, `low`, `close`, `volume`, `closeTime`. Price and volume values are decimal strings. Supported candle intervals are `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`.

These optional endpoints currently accept alphanumeric symbols ending in `USDT`. They can return `503` when unavailable. Display depth is not a reservation or guarantee of the price/size at which your order will execute.

Depth responses contain `lastUpdateId`, optional millisecond fields `E` and `T`, and `bids`/`asks` arrays. Each level is `[price, quantity]` with human-readable decimal strings. This snapshot is not an account order list.

## Reliability and Acceptance

### Keep a submission record

Before submitting a mutation, persist:

- Your unique `requestId`, where the endpoint accepts it.
- The partner-chain key and account address.
- The exact JSON payload, signature and signed timestamp.
- The intended action and relevant existing order ID.
- Submission time, HTTP result and returned order/withdrawal ID.

For deposits, persist the transaction hash and requested account/token amount. A client timeout does not cancel a submitted HTTP operation or blockchain transaction.

Serialize conflicting actions on the same symbol/order, and coordinate account session rotation across your workers. An order may fill while its cancellation or replacement is in flight.

### Request IDs and retries

`requestId` is a correlation field, not a general exactly-once API contract. Use a different ID for each new intent. A new signature/timestamp can create a new action even if a previous HTTP request timed out.

For an uncertain order, cancellation or withdrawal outcome:

1. Query `GET /api/v1/user/{address}/request/{requestId}` with the original partner-chain key.
2. Cross-check current orders/positions/pending withdrawals and the corresponding histories.
3. If success is recorded, continue tracking the original action. Do not submit it again as a new intent.
4. If a definitive rejection is recorded and current state confirms no successful original action, decide whether a corrected new intent is appropriate.
5. If the deployed lookup returns its documented JSON request-not-found `404`, allow time for visibility and continue reconciliation. A missing record does not by itself prove nothing happened.
6. If the result remains uncertain, stop automatic resubmission and contact the onboarding support channel with correlation identifiers.

WebSocket `fillId` and REST trade `id` are different identifier fields; this API does not expose a universal join between them. Keep event deduplication separate from the reconciled REST trade ledger.

The lookup preserves successful admission over later rejected attempts using the same request ID. It is not a full retry-attempt log. Signing a new payload should be a deliberate new action after reconciliation.

Login and leverage do not accept a client `requestId` in their documented bodies. Confirm those through the successful login response and the symbol's account leverage, respectively. Do not append an invented request ID field and expect request-status lookup to track it.

For deposits, inspect the original transaction receipt before sending another deposit. For withdrawals, check both request acceptance and payout lifecycle; do not create a new withdrawal merely because the first remains in cooldown.

### HTTP errors

Standard JSON error shape:

```json
{
  "error": "timestamp is invalid or expired",
  "code": "INVALID_TIMESTAMP"
}
```

`details` may also be present. A missing request lookup specifically returns `{"error":"request not found","requestId":"YOUR_REQUEST_ID"}` without a `code` field. A plain-text route-level `404` instead indicates the URL or deployed endpoint availability needs checking; it is not evidence about the submitted request. Proxies or connectivity failures can return a non-JSON response; handle HTTP status and raw response safely instead of assuming every failure parses as JSON.

| Status / representative code | Client action |
|---|---|
| `400 INVALID_REQUEST`, `INVALID_QUANTITY`, `INVALID_PRICE`, `INVALID_STOP_PRICE` | Correct request shape, integer encoding or value. Re-sign any changed signed values. |
| `400 INVALID_TIMESTAMP`, `TIMESTAMP_EXPIRED` | Check the signing clock and delay. Resolve any original uncertain submission before creating a new signed intent. |
| `400 INVALID_PARTNER_CHAIN_KEY` | Verify routing and onboarding values. Do not fall back to another context. |
| `401 INVALID_SIGNATURE` | Verify signer role, domain, partner hash, exact fields and price scaling. Signature failures can also appear as a validation error from the action endpoint. |
| `400 INSUFFICIENT_BALANCE`, `INSUFFICIENT_MARGIN` or an action-specific rejection | Refresh current balances/risk state; reduce or change the intended action as appropriate. |
| `404 USER_NOT_FOUND`, `ORDER_NOT_FOUND` | Check context/address/ID. For an order, reconcile fills and cancellation history before assuming it never existed. |
| `404` from request lookup | No recorded request found at this read. Follow the uncertain-outcome procedure above. |
| `400 INVALID_PAGINATION` | Correct the offset. Do not retry the same unsupported page. |
| `409 DUPLICATE_ORDER` | Reconcile the existing intent; do not blindly replace the request ID. |
| `413` or body-size validation error | Keep public API JSON bodies at or below 64 KiB and within their endpoint's schema. Do not send a batch as one order. |
| `429 RATE_LIMITED` | Respect `Retry-After` if present, reduce concurrency and apply backoff. |
| `502`, `503`, other `5xx`, or network timeout | Back off on reads. Mutations require outcome reconciliation before retry. |

Codes are representative, not an exhaustive fixed enum. Preserve unknown codes and messages in your logs. HTTP success at order submission means the response should be inspected; pending orders and protective triggers may execute later.

Withdrawal request lookup reports admission and available financial fields; use transactions for release progress. Optional accounting-enrichment failure does not erase a stored admission result. Preserve `accountingStatus="UNAVAILABLE"` and `withdrawal.status="LINK_UNAVAILABLE"` as separate accounting and lifecycle uncertainties; neither is a reason to resubmit.

### Throughput and polling

Use the assigned request-rate budget rather than assuming unlimited reads or writes. Share public market subscriptions across workers where practical. Use account streams for change notifications and periodic REST reconciliation rather than continuously polling every history route.

For read retries, use exponential backoff with jitter and an upper bound. Honor cancellation/timeouts in your application. Avoid simultaneous retries across all workers after reconnecting.

For mutation requests, never use a generic HTTP retry policy that silently changes the timestamp, request ID or signature. Persist state before a retry decision.

### Pagination and completeness

History APIs use `limit` and `offset`, not cursor tokens. Advance by the returned page limit and deduplicate REST trades by their `id` or mixed activity records by `(operationType, id)`. New rows can arrive while you page; periodically reread overlapping recent pages rather than assuming a stable snapshot.

Offsets above 10,000 return `400 INVALID_PAGINATION`. Stop before requesting an unsupported offset. A reported `total` larger than the accessible window does not grant access to deeper pages. Complete older-history exports require an agreed separate solution; there is no documented cursor endpoint to invent.

The provided UI's browsing and labelled CSV exports cover up to 10,000 recent rows. Partners should retain their own reconciled records continuously if long-term complete history is required. Mark incomplete imported history as incomplete; do not silently report all-time totals from a partial page set.

For transaction cash flows, count each accepted deposit or withdrawal request once. Nested withdrawal release metadata is progress information, not another debit. Funding-rate quotes are not account charges; recorded funding rows supply the account amounts.

### Integration acceptance checklist

Run read-only checks against the default `global:42161` lane first. Global uses real USDC on Arbitrum One; use Global's contract and production endpoints from [Connection and Conventions](/perps/api#connection-and-conventions). Complete funded acceptance after confirming current funding instructions, limits, and origin allowlisting, as described in that step's Deployment readiness notes.

| Scenario | Expected verification |
|---|---|
| Configuration | HTTPS routing, RPC chain, deposit contract, verifying contract and collateral match onboarding |
| Unit conversion | Global Arbitrum USDC uses six native decimals and `1e6` REST balances; order HTTP prices are `1e6`, signed prices `1e18`. Verify eighteen-decimal token conversion separately if adding another deployment |
| Session registration | Wallet login succeeds; trading and private streaming use the registered session |
| Session renewal | New session is usable; workers reconnect/re-sign using it |
| Deposit | Approval and deposit receipts succeed; account credit becomes visible before trading |
| Market order | Position and fill history agree with returned execution; fee and size are correctly parsed |
| Limit order | Pending state is visible; subsequent fill changes account state |
| Cancellation | Pending order disappears or becomes cancelled; fill/cancel race is reconciled |
| Partial close | Correct side and reduce-only behavior reduce the existing position |
| Full close | No remaining position after execution and account refresh |
| Standalone TP/SL | Protective order appears and only changes the position upon execution |
| Entry bracket | Entry and intended attached protection are visible with correct associations |
| TP/SL replacement | Old order and newly returned order are reconciled without assuming they have the same ID |
| Leverage change | Read-after-write shows the requested permitted leverage; rejected change does not appear as success |
| Public stream | Snapshot and updates merge correctly; missing values are not replaced by zeros |
| Private stream reconnect | Account and history are reconciled after a disconnect; events are not double-counted |
| Submission timeout | Client polls original request and account state rather than creating duplicate exposure |
| History boundary | Client stops at supported pagination bounds and discloses incomplete older history |
| Funding | Market rate display is separate from signed account amount convention in recorded history |
| Withdrawal | Payout plus actual fee counted once; eligibility, release confirmation and wallet transfer are distinguished |
| Fee-only maximum | If supported by your test plan, tiny-balance drain is explicitly recognized as no wallet payout |

### Support handoff for an unresolved operation

Provide the partner-chain key, account address, request ID, order/withdrawal ID if known, timestamps, HTTP status/code and any relevant transaction hash. Describe the expected result and current account/history result. Keep signing credentials out of support messages.
