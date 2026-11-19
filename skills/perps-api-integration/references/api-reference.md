# Perps API reference (condensed)

Condensed from the partner integration guide (API v1, guide updated
16 November 2026). The guide is the source of truth: `content/perps-api.md` in
this repository, published at
`https://spot-integration-docs.vercel.app/perps/api` (raw Markdown at
`/perps/api.md`). Update this file whenever the guide changes. Example values
are illustrative.

## Contents

1. Connection and routing
2. Endpoint index
3. Market discovery and filters
4. Numerical encoding
5. Signing and sessions
6. Orders: create, bracket, replace, cancel
7. Leverage
8. Deposits and withdrawals
9. Account and history
10. Market data and WebSocket
11. Errors, request IDs and reconciliation
12. Acceptance checklist

## 1. Connection and routing

Global default lane (production, real USDC):

| Value | Global |
| --- | --- |
| REST base | `https://perps-api.orbs.network` |
| WebSocket | `wss://perps-api.orbs.network/ws` |
| Partner ID / chain ID | `global` / `42161` (Arbitrum One) |
| Partner-chain key | `global:42161` |
| EIP-712 verifying contract | `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102` |
| Deposit contract | `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102` |
| Collateral token | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (USDC, 6 decimals) |

- `default` is a separate lane, not an alias for `global`. Switch the whole lane
  config together (key, contract, endpoints); never mix lanes.
- Keep verifying contract and deposit contract as separate config names even
  when equal.
- Every REST request sends `X-Partner-Chain-Key: <partnerId>:<chainId>`; JSON
  writes also send `Content-Type: application/json`. No API key or bearer token:
  writes are authorized by body signatures.
- Backend REST needs no Origin/CORS. Browser REST needs the app origin
  allowlisted. WebSocket (browser or backend) requires an allowlisted `Origin`.
- `GET /api/v1/config` → `{ chainId, contractAddress, usdcAddress }`.
  `usdcAddress` is the collateral token; it does not promise USDC or 6 decimals.

## 2. Endpoint index

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/config` | Chain, deposit contract, collateral token |
| GET | `/api/v1/markets` | Market catalogue and execution filters (array) |
| GET | `/api/v1/risk-config` | Leverage, MM brackets, fee tiers |
| POST | `/api/v1/auth/login` | Register/replace session key |
| GET | `/api/v1/prices` | Cached mark prices |
| GET | `/api/v1/market-data` | Display prices, 24h stats, funding |
| GET | `/api/v1/market-data/klines` | Optional candles |
| GET | `/api/v1/market-data/depth` | Optional depth |
| GET | `/api/v1/leverage/allowed?symbol=` | Current leverage cap |
| POST | `/api/v1/leverage` | Change leverage |
| POST | `/api/v1/order` | Create / bracket / replace |
| DELETE | `/api/v1/order/{orderId}` | Cancel (signed JSON body) |
| GET | `/api/v1/user/{address}` | Account, positions, pending orders/withdrawals |
| GET | `/api/v1/user/{address}/portfolio` | Valuation summary |
| GET | `/api/v1/user/{address}/risk-preview?symbol=` | Informational risk inputs |
| GET | `/api/v1/user/{address}/trades` | Fills |
| GET | `/api/v1/user/{address}/funding` | Funding records |
| GET | `/api/v1/user/{address}/orders/history` | Order activity (includes funding entries) |
| GET | `/api/v1/user/{address}/transactions` | Deposits and withdrawals with lifecycle |
| GET | `/api/v1/user/{address}/request/{requestId}` | Recorded submission outcome |
| POST | `/api/v1/withdraw` | Withdrawal request |

Deposits are on-chain only; there is no REST deposit endpoint.

## 3. Market discovery and filters

`GET /api/v1/markets` returns an array:

```json
[{ "symbol": "SOLUSDT", "baseAsset": "SOL", "quoteAsset": "USDT", "displayName": "SOL/USDT",
   "pricePrecision": 4, "quantityPrecision": 2,
   "tickSize": "0.0100", "stepSize": "0.01", "minQty": "0.01", "minNotional": "5" }]
```

- Limit, stop and bracket prices must be exact multiples of `tickSize`.
  Non-market quantities must be multiples of `stepSize` and ≥ `minQty`.
  Exposure-increasing orders need notional ≥ `minNotional`. Violations →
  `400 INVALID_REQUEST` ("… is off-grid for increment …").
- `pricePrecision`/`quantityPrecision` are display precision only (SOLUSDT: 4 vs
  tick 0.01; BTCUSDT: 2 vs tick 0.10).
- Symbols without filter fields are not tradable on the lane.
- `503 SYMBOL_FILTERS_UNAVAILABLE` (no-store): retry; never treat it as an empty
  catalogue or overwrite a valid cached one. Cache and refresh hourly or on
  reconnect.
- Filter checks follow order type: MARKET ignores `price`/`stopPrice`; LIMIT
  checks `price`; stop types check `stopPrice` and any positive `price`; bracket
  legs are always checked. The TEE re-checks independently.
- Snapping (integer math, before signing): for exact decimals, work at 1e18
  (`tickScaled = tickSize × 1e18`) and format back to a plain decimal. Legacy
  1e6 only when the tick is representable at 1e6. Buys floor; sells may ceil.

`GET /api/v1/risk-config` → `{ symbols: { SYM: { defaultLeverage, maxLeverage,
mmBrackets: [{ maxNotional, mmrBps, cum, maxLeverage }] } }, feeTiers: [{ tierLevel,
totalFeeRateBps }] }`. Informational; not a reservation.

## 4. Numerical encoding

| Field family | Encoding |
| --- | --- |
| Order `quantity` | integer string / `uint256`, 1e8 (`"500000000"` = 5) |
| Legacy request `price`, `stopPrice`, bracket prices | integer string, 1e6 |
| `priceDecimal`, `stopPriceDecimal` (incl. bracket legs) | exact decimal string, ≤ 18 dp |
| Signed order/bracket prices | `uint256`, 1e18 |
| Returned order/position/trade raw prices | integer string, 1e18 |
| Returned `…PriceDecimal` (`priceDecimal`, `stopPriceDecimal`, `entryPriceDecimal`, `markPriceDecimal`, `liquidationPriceDecimal`) | exact decimal string |
| Balances, fees, PnL, funding, REST withdrawal amounts, notional | integer string, 1e6 |
| Contract deposit/payout amounts | token-native decimals |
| `/prices` `price` (deprecated) / `priceDecimal` | truncated 1e6 / exact decimal |
| `market-data`, `market_data` WS, klines, depth | human-readable decimal strings |
| Leverage | whole number |
| `…Bps`, `lockedMMR` | basis points (10,000 = 100%) |
| Timestamps | Unix ms |
| `orderId` | decimal string; `BigInt(orderId)` only when signing |

Rules:

- Nonzero legacy price + decimal companion must agree, else `400 PRICE_CONFLICT`.
  Omit the legacy field or send `"0"` when the decimal field carries the price.
- Signed price = decimal parsed at 1e18, or legacy 1e6 × 1e12.
- Converting a returned 1e18 price to a legacy request: only if exactly
  representable at 1e6; otherwise send the `…Decimal` field. Never round.
- JSON cannot carry `bigint`: send amounts as decimal strings; timestamps and
  leverage stay JSON numbers.
- Never round through floating point; validate precision instead of silently
  rounding a user's size or price.

Time: signed timestamps must be ≤ 30 s old and ≤ 2 s ahead of service time
(WebSocket auth: ±5 min). Generate immediately before signing.

## 5. Signing and sessions

Signer roles:

| Action | Signer |
| --- | --- |
| Login (register/replace session) | Account wallet |
| Order, cancel, replace, leverage | Session key (wallet may also sign directly) |
| Private WebSocket subscription | Session key (required) |
| Withdrawal | Account wallet only |
| ERC-20 approve, deposit | Funding wallet (on-chain tx) |

`user` in every message is the account wallet address, never the session address.

Domain:

```js
{ name: 'ProtocolTEE', version: '1', chainId: BigInt(CHAIN_ID), verifyingContract: VERIFYING_CONTRACT }
```

`ProtocolTEE` is literal; do not rebrand it.

Partner binding, included as the first field of every type:

```js
partnerChainKeyHash = sha256(stringToHex(`partner_chain:${partnerId.trim()}:${chainId}`))
```

SHA-256 (not keccak) with the literal `partner_chain:` prefix. The HTTP header
omits the prefix.

Typed definitions (field order matters; every type starts with
`partnerChainKeyHash: bytes32, user: address`):

| Primary type | Remaining fields |
| --- | --- |
| `Login` | `sessionPublicKey: string`, `sessionExpiresAt: uint256`, `timestamp: uint256` |
| `WebSocketAuth` | `timestamp: uint256` |
| `Order` | `symbol: string`, `orderType: string`, `side: string`, `quantity: uint256`, `price: uint256`, `stopPrice: uint256`, `reduceOnly: bool`, `closePosition: bool`, `timeInForce: string`, `timestamp: uint256` |
| `BracketOrder` | `symbol: string`, `side: string`, `orderType: string` (note: side before orderType), `quantity`, `price`, `stopPrice`, `reduceOnly`, `closePosition`, `timeInForce`, `timestamp`, `takeProfitType: string`, `takeProfitStopPrice: uint256`, `takeProfitPrice: uint256`, `stopLossType: string`, `stopLossStopPrice: uint256`, `stopLossPrice: uint256` |
| `Cancel` | `orderId: uint256`, `timestamp: uint256` |
| `Withdrawal` | `recipient: address`, `amount: uint256`, `isMax: bool`, `timestamp: uint256` |
| `Leverage` | `symbol: string`, `leverage: uint256`, `timestamp: uint256` |

Do not add `requestId`, envelopes or nested REST objects to typed messages.

Session flow:

1. Generate a secp256k1 session key. `sessionPublicKey` is the full uncompressed
   65-byte key `0x04…`, not an address.
2. `sessionExpiresAt` ≤ 14 days after the login timestamp.
3. Wallet-sign `Login`; `POST /api/v1/auth/login` with
   `{ address, sessionPublicKey, sessionExpiresAt, timestamp, signature }`
   (REST field is `address`, typed field is `user`).
4. Use the session only after `success: true`. Response:
   `{ success, partnerChainKey, partnerId, chainId, sessionExpiresAt }` — no token.
5. One active session per account per lane; a new login replaces it. Coordinate
   rotation, reconnect private streams. Login creates but does not fund the account.

Payload → signature mapping:

- Plain order, standalone TP/SL, close → `Order`.
- Entry with attached TP/SL → `BracketOrder` signed once; put the same signature
  in `order.signature` and `order.bracket.bracketSignature`. Absent leg in the
  typed message: type `""`, prices `0`; omit it from the REST `bracket`.
- Replace → new `Order`/`BracketOrder` + `Cancel` for the old order inside
  `order.replacement`. Do not also send a standalone cancel.
- Sign the exact `orderType` spelling submitted. Any changed value → new signature.

## 6. Orders

`POST /api/v1/order` body: `{ requestId, order: { user, symbol, orderType, side,
quantity, price?, priceDecimal?, stopPrice?, stopPriceDecimal?, reduceOnly,
closePosition, timeInForce, timestamp, signature, bracket?, replacement? } }`.
Leverage is not an order field.

Order types:

| Type | Use |
| --- | --- |
| `MARKET` | Immediate execution |
| `LIMIT` | `GTC`, `IOC`, `FOK` |
| `STOP_MARKET` / `TAKE_PROFIT_MARKET` | Protective trigger, market exit |
| `STOP`, `STOP_LOSS_LIMIT` / `TAKE_PROFIT`, `TAKE_PROFIT_LIMIT` | Trigger + limit; supply both prices |

- Protective orders must reduce or close; no stop entries.
- Reads may return canonical `STOP_LOSS_LIMIT`/`TAKE_PROFIT_LIMIT` for accepted
  `STOP`/`TAKE_PROFIT`.
- Fixed-size exit: opposing side, `reduceOnly=true`, `closePosition=false`.
- Full close: opposing side, `closePosition=true`, positive current absolute
  size (zero quantity is rejected). No separate close endpoint.
- Long exits sell, TP above / SL below; shorts reverse.

Recipes (long of 5 near price 2; `timeInForce="GTC"`):

| Intent | Type / side | Qty (1e8) | Price / stop (1e6) | Flags |
| --- | --- | --- | --- | --- |
| Open long at market | `MARKET`/`BUY` | `500000000` | 0 / 0 | both false |
| Resting long entry | `LIMIT`/`BUY` | `500000000` | `2000000` / 0 | both false |
| Reduce by 2 | `MARKET`/`SELL` | `200000000` | 0 / 0 | reduceOnly |
| Close all | `MARKET`/`SELL` | `500000000` | 0 / 0 | closePosition |
| Full SL | `STOP_MARKET`/`SELL` | current size | 0 / `1800000` | closePosition |
| Full TP | `TAKE_PROFIT_MARKET`/`SELL` | current size | 0 / `2200000` | closePosition |
| Fixed stop-limit exit | `STOP`/`SELL` | `200000000` | `1790000` / `1800000` | reduceOnly |

Bracket fragment (inside `order`):

```json
{ "bracket": {
  "takeProfit": { "orderType": "TAKE_PROFIT_MARKET", "stopPrice": "55000000000", "timeInForce": "GTC" },
  "stopLoss":   { "orderType": "STOP_MARKET",        "stopPrice": "45000000000", "timeInForce": "GTC" },
  "bracketSignature": "<same as order.signature>" } }
```

Legs may stay dormant until the entry fills. Refresh pending orders for child IDs,
`parentOrderId`, `bracketGroupId`, `attachedRole`; never invent child IDs.

Replacement fragment (inside `order`): `{ "replacement": { "orderId", "timestamp",
"signature" } }` (Cancel-signed). Only for pending limit/protective orders; keep
account, market, side and exit role; attached exits stay protective and
fixed-size ones stay reduce-only. Fill/cancel races can reject it. Use the
returned new ID afterwards.

Response (usually `201`): order fields at response scales plus `orderId`,
`status` ∈ `NEW`, `PENDING_ACTIVATION`, `PARTIALLY_FILLED`, `FILLED`, `CANCELED`,
`EXPIRED`, `REJECTED`; optional `entryPrice`, `fee`, `parentOrderId`,
`bracketGroupId`, `attachedRole`, `stateRoot`, `sequenceNumber`, `teeSignature`
(verification metadata, not IDs).

Cancel: `DELETE /api/v1/order/{orderId}` with body `{ requestId, timestamp,
signature }` (no `orderId` in body). Does not undo a fill already made.

Pending-order diagnostics (only in `GET /user/{address}` `pendingOrders[]`,
display-only, in-memory): `executionStatus` ∈ `EXECUTING`, `ATTEMPT_FAILED`,
`OUTCOME_UNKNOWN`, `NO_FILL_RETRY_PENDING`, `NO_FILL_ATTEMPTS_EXHAUSTED`,
`NO_MORE_ATTEMPTS`; `lastRefusal { code, message, since, lastAt, heldSince, count,
detail?, nextAttemptAt?, attempt?, maxAttempts?, reference? }`. Key on `code`;
unknown code = "temporarily held back". Codes: `WAITING_FOR_BOOK`,
`PRICE_AGREEMENT`, `WAITING_FOR_MARK`, `INSUFFICIENT_MARGIN`, `TEE_REJECTED`,
`TEE_BACKOFF`, `SETTLEMENT_BUSY`, `RESIDUAL_FENCE`, `FUNDING_SETTLEMENT`,
`SYMBOL_NOT_READY`, `TICK_OR_STEP`, `VENUE_CAPACITY`, `VENUE_NO_FILL`,
`NO_FILL_EXHAUSTED`, `VENUE_REJECTED`, `TEE_FILL_REJECTED`, `ACTIVATION_FAILED`,
`LANE_BUSY`, `CLOSE_QUEUED`, `LANE_BLOCKED`, `PARKED`, `RETRYING`. Display
"`message` · for {now − since}". They never change `status` or justify resubmission.

## 7. Leverage

- `GET /api/v1/leverage/allowed?symbol=` → `symbol`, `allowedLeverage`,
  `symbolMaxLeverage`, `tierMaxLeverage`, `aggregateNotional`, `tierIndex`,
  `tierMaxNotional` (notional 1e6). A cap, not a reservation.
  `400 UNSUPPORTED_SYMBOL` for unlisted symbols: do not retry.
- `POST /api/v1/leverage` `{ user, symbol, leverage, timestamp, signature }` →
  `{ symbol, leverage, stateRoot?, sequenceNumber? }`. May be rejected for margin.
  Confirm via account `leveragePreferences`. No `requestId`.

## 8. Deposits and withdrawals

Deposit (on-chain):

1. Verify `/api/v1/config` and the RPC chain ID.
2. Read token `decimals()`, `balanceOf`, `allowance(funder, depositContract)`;
   compare decimals to onboarding values.
3. `approve(depositContract, amount)` if needed; wait for a successful receipt.
4. `depositForAccount(bytes32 accountId, uint256 amount)` where
   `accountId = padHex(accountAddress, { size: 32 })` (left-padded, not hashed).
5. Persist the tx hash before waiting; a timeout must not cause a second deposit.
6. Poll `GET /user/{address}` and `/transactions` until a `DEPOSIT` appears and
   `availableBalance` reflects it. Event `PendingDeposit(accountId,
   depositCounter, amount)` is token-native units and is not account credit.

Funding wallet may differ from the account wallet. REST amounts are 1e6 on every
chain; token amounts are native decimals.

Withdrawal: wallet-signed `Withdrawal` with `recipient = user`, then
`POST /api/v1/withdraw` `{ requestId, user, amount, isMax, timestamp, signature }`
(amount = payout excluding fee, 1e6). Typical `201` →
`{ withdrawalId, user, amount, timestamp, status: "PENDING" }` (accepted, not paid).
Serialize per account.

Current payout rules (confirm per deployment): min 2 (`2000000`), max 10,000
per request (`10000000000`), fee 1 (`1000000`) charged on top. A 10-unit payout
debits 11. Reconcile recorded `amount` and `fee`; never apply today's quoted
fee to historical rows.

Max withdrawal: compute `payout = min(available − fee, cap)` from fresh balance,
sign it with `isMax=true`. A fee-aware max below the 2-unit minimum is allowed.
Balance > 0 and ≤ 1 unit: `amount="0"`, `isMax=true` = fee-only drain, no payout;
may return `status="EXECUTED"` with empty ID and history `FEE_ONLY`.

Tracking: `pendingWithdrawals[] { withdrawalId, recipient, amount, requestedAt,
availableAt }` (eligibility time, not a receipt promise). In `/transactions` the
`WITHDRAWAL` row stays one monetary row; nested `withdrawal.status`:
`REQUEST_REJECTED`, `REQUEST_ACCEPTED`, `RELEASE_FAILED` (no refund implied),
`RELEASE_ACCEPTED`, `ROLLUP_CONFIRMED`, `FEE_ONLY`, `LINK_UNAVAILABLE` (unknown,
not confirmed). Count `amount + fee` once. Leaving `pendingWithdrawals` does not
prove receipt; verify the release tx.

## 9. Account and history

`GET /api/v1/user/{address}`:

```json
{ "user": { "address": "…", "balance": "1000000000", "nonce": 0, "feeTier": 0 },
  "positions": [], "pendingOrders": [], "pendingWithdrawals": [],
  "availableBalance": "1000000000", "marginUsed": "0", "maintenanceMargin": "0",
  "marginBalance": "1000000000", "unrealizedPnl": "0", "leveragePreferences": {} }
```

- `user.nonce` is metadata, not a signing nonce.
- Position: `symbol`, signed `quantity` (+long/−short, 1e8), `entryPrice` (1e18),
  optional `markPrice`, `liquidationPrice`, `initialMargin`, `maintenanceMargin`,
  `allocatedMargin`, `lockedMMR` (bps), `accumulatedFunding`, `openTimestamp`.
- A missing monetary field is unknown, not zero. Separate reads are not atomic.

`/portfolio` (all money 1e6): `walletBalance`, `totalEquity`, `perpsEquity`,
`totalValue` (gross display value, not equity), `availableBalance`, `marginUsed`,
`maintenanceMargin`, `unrealizedPnl`, `realizedPnl`, `totalPnl` (not necessarily
the sum of the other two), `totalDeposits`, `totalWithdrawals`,
`totalPositionUsdValue`, `volume24h/14d/30d/AllTime`, `feeTier`,
`totalFeeRateBps`, `timestamp`, `source` (opaque).

`/risk-preview?symbol=`: `walletBalance`, `upnlOthers`,
`maintenanceMarginOthers`, `feeTier`, `feeRateBps`, `aggregateNotional`,
`mmBrackets`, optional `existingPosition { quantity, entryPrice, lockedMMR }`,
`timestamp`. Estimate inputs, not approval.

History endpoints (`trades`, `funding`, `orders/history`, `transactions`) return
`{ <array>, total, limit, offset }`, newest first:

- `?limit=1..100` (default 20; invalid falls back to default — advance by the
  returned `limit`). `offset` > 10,000 or malformed → `400 INVALID_PAGINATION`.
- Stop at `offset + limit >= total` or the 10,000 bound; label truncated exports.
- Dedupe trades by `id`; mixed activity by `(operationType, id)`.
- Trade: `id`, `symbol`, `side`, `quantity`, `price`, `fee`, `realizedPnl`,
  `isClose`, `timestamp`. No order ID; do not join by size/price/time.
- Funding: `amount` positive = paid, negative = received; `side` `PAY`/`RECEIVE`.
  Funding also appears in order history; count once. Zero/missing timestamp =
  unknown time.
- Activity fields: `id`, `operationType`, `requestId`, `userAddress`, `symbol`,
  `side`, `quantity`, `price`, `amount`, `fee`, `realizedPnl`, `status`,
  `rejectReason`, `timestamp`, `teeSequence`, `stateRoot`, `rollupId`,
  `extraData`, `withdrawal` (transactions only), `accountingStatus`.
- `accountingStatus="UNAVAILABLE"`: keep the row, flag incomplete; never
  substitute zero or a default fee.

Request lookup `GET /user/{address}/request/{requestId}` (URL-encode the ID): one
activity record plus optional `orderExecution { eventOrderId (bytes32, not the
cancel orderId), latestEvent ∈ ORDER_PLACED | TRADE_FILLED | ORDER_CANCELLED |
ORDER_REPLACED, teeSequence, rollupId? }`. A recorded success wins over later
rejected retries. JSON `404 { error, requestId }` = not recorded yet (not proof
of no effect); plain-text 404 = wrong route.

## 10. Market data and WebSocket

- `/prices` → `{ prices: [{ symbol, price, priceDecimal, timestamp }] }`. Use
  `priceDecimal`; missing symbol = no value, not zero; check freshness.
- `/market-data` → `{ markets: [{ symbol, price, markPrice, priceChangePercent,
  high24h, low24h, volume24h, fundingRate, nextFundingTime, updatedAt }] }`.
  Decimal strings; `fundingRate "0.0001"` = 0.01%; `priceChangePercent "1.25"` =
  1.25%. Fields may be absent: merge, never zero-fill. Do not use the 1e18 parser.
- Klines: `symbol`, `interval` (`1m 3m 5m 15m 30m 1h 2h 4h 8h 12h 1d 3d 1w 1M`),
  optional `startTime`, `endTime`, `limit` 1–1500 (default 500). Depth: `symbol`,
  `limit` ∈ 5,10,20,50,100,500,1000. Both may `503`.

WebSocket (text JSON; handshake `Origin` must be allowlisted):

```json
{ "type": "SUBSCRIBE", "partnerChainKey": "global:42161", "channels": ["market_data"] }
```

Ack: `SUBSCRIBED { partnerChainKey, partnerId, chainId, channels, user? }`.
Public messages: `MARKET_DATA_SNAPSHOT`, `MARKET_DATA_UPDATE` (merge by symbol;
no per-symbol filter).

Private channels `orders`, `positions`, `fills` need a session-signed
`WebSocketAuth`: add `user`, `timestamp`, `signature` to the SUBSCRIBE. Channel
`liquidations` is public for the lane — filter by `partnerChainKey` and
`data.user` (case-insensitive) before applying. One connection per account/lane.
`ERROR { code, message }` (e.g. `UNAUTHORIZED`): renew session, reconnect,
re-sign, resubscribe. `UNSUBSCRIBE { channels }` → `UNSUBSCRIBED`.

Account events (`{ type, channel, partnerChainKey, data }`):

| Type / channel | data |
| --- | --- |
| `ORDER_UPDATE` / `orders` | `orderId`, `user`, `symbol`, `orderType`, `side`, `quantity` (original), `price?`, `status`, `timestamp` |
| `POSITION_UPDATE` / `positions` | `user`, `symbol`, `quantity`, `entryPrice`, `accumulatedFunding`, `openTimestamp` (close = qty and entry `"0"`) |
| `FILL` / `fills` | `fillId` (= REST trade `id`), `orderId` (`"0"` for admin closes), `user`, `symbol`, `side`, `quantity`, `price`, `fee`, `realizedPnl?`, `timestamp` |
| `LIQUIDATION` / `liquidations` | `liquidationId`, `user`, `symbol`, `liquidatedQuantity` (positive), `liquidationPrice`, `penalty`, `remainingCollateral`, `timestamp` |

Scales: qty 1e8, prices 1e18, money 1e6. No `TRIGGERED` status (activated
triggers become `NEW`). No replay; events can drop. Fill toasts dedupe by
`fillId` (a `FILLED` REST response can stand in for its WS toast; a `NEW`
response does not). Position updates can arrive without a FILL/LIQUIDATION.

Reconnect: bounded backoff with jitter → fresh auth subscribe → buffer events
while refreshing `/user/{address}` and recent history → reconcile IDs → apply
idempotently. Use protocol ping/pong; no JSON `PING`.

## 11. Errors, request IDs and reconciliation

Error body: `{ error, code, details? }`; may be non-JSON from proxies.

| Status / code | Action |
| --- | --- |
| `400 INVALID_REQUEST`, `INVALID_QUANTITY`, `INVALID_PRICE`, `INVALID_STOP_PRICE` | Fix shape/encoding; re-sign changed values |
| `400 PRICE_CONFLICT` | Legacy and decimal price disagree |
| `400 INVALID_TIMESTAMP`, `TIMESTAMP_EXPIRED` | Check clock; resolve the original first |
| `400 INVALID_PARTNER_CHAIN_KEY` | Fix routing; never fall back to another lane |
| `401 INVALID_SIGNATURE` | Check signer, domain, partner hash, field order, scales |
| `400 INSUFFICIENT_BALANCE`, `INSUFFICIENT_MARGIN` | Refresh state; adjust |
| `404 USER_NOT_FOUND`, `ORDER_NOT_FOUND` | Check context; reconcile fills/cancels |
| `400 INVALID_PAGINATION` | Fix offset; don't retry |
| `400 UNSUPPORTED_SYMBOL` | Symbol not on lane; don't retry |
| `409 DUPLICATE_ORDER` | Byte-identical resend; reconcile |
| `409 REQUEST_IN_PROGRESS` | Outcome unknown; retry only with same `requestId` (re-signed) |
| `503 ORDER_OUTCOME_UNKNOWN` | Resting order may exist; as above |
| `409 REQUEST_ALREADY_FAILED` | Definitely failed; a corrected order may use a new ID |
| `409 REQUEST_ID_REUSED` | ID belongs to a different order |
| `413` | Body > 64 KiB |
| `429 RATE_LIMITED` | Honor `Retry-After`, back off |
| `5xx` / timeout | Back off reads; reconcile mutations before retry |

Order `requestId` semantics (per lane; whitespace trimmed; market and resting
share one namespace):

- Same accepted order resent (even re-signed) → original `201` with
  `"replayed": true`, original `orderId`/`stateRoot`/`sequenceNumber`/
  `teeSignature` (market omits `entryPrice`; resting reports `NEW`).
- Still executing/unknown → `409 REQUEST_IN_PROGRESS`; never switch IDs. For an
  unknown resting outcome it persists until support reconciles it.
- `400 TEE_ERROR` on first send: explicit TEE reject (retry →
  `REQUEST_ALREADY_FAILED`) or never reached TEE (re-sign and retry same ID).
- Refused before placement (pre-validation 4xx/503) records nothing; same ID may
  be retried.
- Cancellations and withdrawals do not get this guarantee: a new signature can
  create a new action. Login and leverage take no `requestId`.

Uncertain outcome procedure: request lookup → cross-check orders, positions,
pending withdrawals and history → if success recorded, keep tracking it → if
definitively rejected and state agrees, decide on a corrected new intent → on
JSON 404 wait and keep reconciling → if still unclear, stop and escalate with
partner-chain key, address, request ID, order/withdrawal ID, timestamps, status
and tx hash (never credentials).

Persist before each mutation: `requestId`, lane, address, exact signed payload
and timestamp, intent, related order ID; afterwards the HTTP result and returned
IDs. Serialize conflicting actions per symbol/order. Never use a generic HTTP
retry that changes timestamp, ID or signature.

## 12. Acceptance checklist

Configuration matches onboarding; unit conversions (6-decimal token, 1e6 REST,
1e6 legacy / decimal / 1e18 signed prices); fine-tick prices round-trip and
conflicts return `PRICE_CONFLICT`; session registration and renewal; deposit
credit visible before trading; market and limit fills reconcile with history;
cancel and fill/cancel race; partial and full close; standalone TP/SL; entry
bracket associations; TP/SL replacement with new ID; leverage read-after-write;
public stream merge without zero-fill; private stream reconnect without
double-counting; submission timeout reuses the same `requestId`; `fillId` = trade
`id` counted once; pending-order diagnostics don't trigger resubmission;
pagination bound disclosed; funding rate vs recorded amount; withdrawal
payout + fee counted once, lifecycle distinguished; fee-only drain recognized.
