# Perps integration review — 16 November 2026

## Scope and source

Updated `content/perps-api.md` against the current local `perpetual-hub` partner handoff: `docs/partner-integration/README.md` and chapters `01`–`07`, at repository HEAD `1aa0d643593e8d3ab4bc0934ba55f40dbadcfb89`. The latest commit affecting that handoff is `f7a6ff4ce` (7 November 2026). The source checkout contains unrelated Partner Portal work; it was read only and was not changed by this review.

The site retains its eight existing guide steps and local `/perps/api#…` links. Global production remains the site's default; the upstream handoff's Orbs staging deployment is a separate lane and is not substituted into these examples.

## Changes applied

- Added exact `priceDecimal` / `stopPriceDecimal` request fields for entries, replacements and bracket legs; documented `1e18` signing, decimal response companions, `PRICE_CONFLICT`, and exact snapping for fine ticks. Legacy integer request prices remain `1e6`.
- Updated `/api/v1/prices` to prefer `priceDecimal`; its deprecated `price` field truncates at `1e6`.
- Documented order-placement request-ID replay for market and resting orders, replayed `201` responses, `REQUEST_IN_PROGRESS`, `REQUEST_ALREADY_FAILED`, `REQUEST_ID_REUSED` and `ORDER_OUTCOME_UNKNOWN`. Cancellation and withdrawal retries retain their separate reconciliation requirements.
- Added pending-order `executionStatus` and `lastRefusal` semantics and refusal-code guidance. These observations are process-local display information, not replacements for committed order status.
- Updated streaming behavior for committed fills, closed positions, system cancellations, non-replayed notifications and REST reconciliation. WebSocket `FILL.fillId` identifies the corresponding REST trade `id`; each execution counts once across both transports.
- Documented non-retryable `UNSUPPORTED_SYMBOL`, corrected the Global subscription acknowledgement's `partnerId`, and extended the integration acceptance checklist for exact prices, order replay, fill identity and pending execution observations.

Signing types, session duration and roles, funding and withdrawal units, payout lifecycle, history schemas, history pagination bounds and current funding-rate fields were compared with all current handoff chapters. Existing guidance for those contracts remains applicable.

## Source inconsistencies resolved locally

The handoff itself contains stale paragraphs that conflict with newer source or chapters. This site corrects them rather than reproducing them:

| Issue in the source handoff | Resolution and source evidence |
|---|---|
| Trading precision still says all HTTP prices are `1e6`, although Connection and Signing document exact decimal fields | Both encodings are documented throughout. Checked API request/response types, input validation and `backend/internal/api/order_decimal_prices_test.go`, including its legacy-zero allowance and `PRICE_CONFLICT` cases |
| Reliability still says WebSocket and REST fills have no join | Uses WebSocket `fillId` = REST trade `id`, matching the current Streaming chapter and committed publishers in API order/administrative-close handlers |
| Trading retry prose treats every new timestamp/signature as a new order | Distinguishes controlled same-ID order replay from new intent and from withdrawal/cancellation retries, matching `order_request_replay.go` and `market_order_request_replay.go` |
| The numerical-encoding table is split by the new exact-price subsection | All encoding rows remain in one table before that subsection |
| The pending-order refusal example is a bare JSON member | Wrapped it as a valid JSON object; all 28 JSON examples parse |

No changes were made to `perpetual-hub` code or its upstream docs.

## Public read-only verification

On 16 November 2026, requests to `https://perps-api.orbs.network` with `X-Partner-Chain-Key: global:42161` returned HTTP 200 from `/api/v1/config`, `/api/v1/markets` and `/api/v1/risk-config`.

Configuration returned:

- Chain ID: `42161`.
- Global contract: `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102`.
- Collateral: native Arbitrum USDC, `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`.

The market response included SOLUSDT with tick `0.0100`, and 1000SATSUSDT/DOGSUSDT with tick `0.00000001`. This confirms why display precision and the legacy `1e6` price form cannot cover every executable price.

These reads do not verify funded deposits, trading, withdrawals, session registration, private WebSocket acceptance or deployment support for every newly documented mutation. No signed, funded or other mutating requests were sent. Confirm the assigned lane, risk configuration, funding instructions and agreed origin before funded acceptance.

## Validation and remaining coverage

- Guide navigation passed: seven guides, internal links, aliases and interactive-example references.
- All 28 fenced Perps JSON examples parse.
- All eight top-level Perps step headings remain stable.
- Public configuration, market and risk reads passed as described above.

Existing navigation checks catch broken local routes and anchors, but cannot establish protocol correctness or funded acceptance. The previous content was a dated manual copy; those checks did not compare it to the evolving partner API contract. Future refreshes must compare every handoff chapter and reconcile conflicting statements against API source. A deployed acceptance run should cover the exact-price, request replay and fill-identity scenarios now listed in the guide.
