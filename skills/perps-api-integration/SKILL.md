---
name: perps-api-integration
description: Build or review an integration with the Perpetual Hub (Orbs Perps) partner API — REST endpoints, partner-chain routing, EIP-712 signing and session keys, market/limit/bracket/replacement/cancel orders, leverage, on-chain collateral deposits, withdrawals, account history, WebSocket streams, exact numeric scales, and retry/reconciliation rules. Use when writing code that calls the perps API, signs its payloads, converts its amounts or prices, or handles its streams and errors, with no Perpetual Hub SDK.
---

# Perpetual Hub perps API integration

The partner guide is the contract: `content/perps-api.md` in the
`spot-integration-docs` repository, published at
`https://spot-integration-docs.vercel.app/perps/api` (raw Markdown at
`/perps/api.md`). [references/api-reference.md](references/api-reference.md)
condenses it: endpoints, units, typed data, payload shapes, errors and retry
rules. Read the section you need before writing code. When the reference, the
guide and live responses disagree, follow the current guide and live responses,
and say so. Never invent an endpoint, field, header or error code to fill a gap.

## Before writing code

Collect the lane configuration as one unit and keep it together:

- REST base URL and WebSocket URL
- partner ID, chain ID and partner-chain key (`<partnerId>:<chainId>`)
- EIP-712 verifying contract and deposit contract (separate config names, even
  when equal)
- collateral token address and its `decimals()`
- the account wallet, and an allowlisted WebSocket `Origin`

The default is Global, `global:42161` on Arbitrum One. It is production with
real USDC. Never mix values from two lanes, and never fall back to another lane
on an error. Use test-sized amounts, and confirm funding instructions before
the first deposit.

Verify `GET /api/v1/config` and `GET /api/v1/markets` before trading. Use only
listed symbols, and take tick, step and minimums from the market filters.

## Non-negotiable rules

- **The service is the authority.** Risk previews, allowed leverage and local
  estimates are informational. They are not approvals or reservations.
- **HTTP success is not completion.** An accepted order may be unfilled. A
  `PENDING` withdrawal is not a payout. A mined deposit is not yet account
  credit. Confirm through account state, fills and transaction lifecycle.
- **Signed values are frozen.** Sign exactly what you submit (including the
  `orderType` spelling). Any change needs a new timestamp and signature.
- **Uncertain mutations are reconciled, not retried blindly.** Persist the
  `requestId`, exact signed payload and timestamp before sending. After a
  timeout, `409 REQUEST_IN_PROGRESS` or `503 ORDER_OUTCOME_UNKNOWN`, query the
  request lookup and account state. Retry an order only with the same
  `requestId`. Cancellations and withdrawals have no such guarantee.
- **No floating point for money, size or price.** Use `bigint` or decimal
  strings, with explicit scales per field.
- **Count each execution once.** WebSocket `FILL.fillId` equals the REST trade
  `id`. Deduplicate fills by it, and activity rows by `(operationType, id)`.
- **No undocumented request fields.** Tolerate extra response fields.
- **Credentials stay out** of code, logs, support messages and URLs.

## Units (the most common source of bugs)

| Value | Encoding |
| --- | --- |
| Order `quantity` (request, response, signed) | integer string, 1e8 |
| Legacy request `price`/`stopPrice`/bracket prices | integer string, 1e6 |
| Exact request `priceDecimal`/`stopPriceDecimal` (incl. bracket legs) | plain decimal string |
| Signed `price`/`stopPrice`/leg prices (EIP-712 `uint256`) | 1e18 |
| Returned order/position/trade/account-event raw prices | integer string, 1e18 (plus `…Decimal` companions on order/position responses) |
| Balances, margin, fees, PnL, funding, withdrawal amounts | integer string, 1e6 (every chain) |
| On-chain deposit/payout token amounts | token-native decimals (read `decimals()`) |
| `/api/v1/market-data`, `market_data` WS, klines, depth | human-readable decimal strings |
| `/api/v1/prices` | use `priceDecimal`; `price` is deprecated truncated 1e6 |
| Leverage | whole number; `Bps` fields are basis points; timestamps are Unix ms |

Snap prices to `tickSize` and non-market quantities to `stepSize` before
signing. `pricePrecision`/`quantityPrecision` are display-only, and are not the
tick or step. Prefer `…Decimal` fields when a price is not exactly
representable at 1e6. Never round a price to fit a legacy field.

## Integration order

1. Configuration and market discovery (reference §1–4).
2. Session registration with the account wallet's `Login` signature (§5).
3. Public and private WebSocket subscriptions (§10).
4. Approve and deposit collateral, then wait for account credit (§8).
5. Set leverage, then place a small order and confirm position and fills (§6–7, §9).
6. Cancellation, TP/SL, brackets and replacement (§6).
7. Close the position; reconcile fills, fees and funding (§9).
8. A small withdrawal, tracked through its lifecycle to the wallet receipt (§8).
9. Run the acceptance checklist (§12), including timeout and reconnect cases (§11).

## Signer roles at a glance

| Action | Signer |
| --- | --- |
| `Login` (register/replace the session) | Account wallet |
| `Order`, `BracketOrder`, `Cancel`, `Leverage` | Session key |
| `WebSocketAuth` for private channels | Session key |
| `Withdrawal` | Account wallet only |
| ERC-20 `approve`, `depositForAccount` | Funding wallet (on-chain) |

Domain `{ name: 'ProtocolTEE', version: '1', chainId, verifyingContract }`.
Every type starts with `partnerChainKeyHash = sha256("partner_chain:<partnerId>:<chainId>")`
(SHA-256, not keccak) and `user` (the account wallet, never the session
address). Exact field lists and their order are in reference §5.
