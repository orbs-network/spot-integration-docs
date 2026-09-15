# Integration-Ease Review

Review date: 2026-09-15 · Branch: `main` (includes uncommitted working-tree changes)

Scope: all 7 guides in `content/`, every code example in `lib/reference-examples.ts`, the
home/sidebar navigation, the download helpers, and the uncommitted diff.

## Resolution status — September 15, 2026

The findings below are retained as the original review snapshot. The current implementation addresses them as follows:

- **1:** Replaced the four deep `orbs-spot` links with `spot-ui` example paths. Added the `orbs-spot` repository root as an additional example in both shared references at the user’s request.
- **2:** Wait for mined receipts; abort the losing status poll and clear its timer. Correction: `Promise.race` already observes losing rejections; unnecessary background work was the issue.
- **3:** Added the Orbs SDK's published Telegram support channel to both shared references, Private and Sealed Orders, and the guide footer.
- **4–8:** Aligned function contracts, added amount/schedule validation and the remainder rule, centralized configuration, parameterized history, explained the second config fetch, and documented one-based API pagination versus zero-based SDK pagination.
- **9:** Explicitly identify the listed networks as mainnets and the lack of a verified testnet configuration in these guides. Testnet availability remains a question for Orbs, not an assertion that no testnet exists.
- **10–14:** Documented the slippage conversion, request/response `outAmount` distinction, and Wagmi v3 target; show SDKs before API Only; grouped resources and added the Swap chain-routing source/date.
- **Downloads:** Preserved the user's `.ts`/`.tsx` requirement. Generate one source module from canonical examples, resolve included imports, rename conflicting bindings, and keep prose as comments. The React download still requires the three documented host adapters (`use-dex-derived-data`, `use-translations`, `use-currency`); it is not a standalone application.
- **Styling:** Use shared accordion radius variables and 14px linked contact text.

Validation includes project lint/typecheck/build, all five exports' syntax and binding checks, and mocked swap/TWAP/configuration behavior tests. The four non-React downloads also type-check against the locally installed integration dependencies. React's remaining unresolved imports are the three host adapters above.

---

## What was verified

- All internal guide links and heading anchors resolve (script-checked across all 7 files).
- `yarn typecheck` and `yarn lint` (incl. `check:examples`) pass.
- All external links were requested; results are reported below.
- The conceptual layering — shared reference + per-method guide, "what you build" vs. "what the
  protocol does", operational checklist + end-to-end acceptance run — is strong and consistent
  across both products.

---

## Blockers

### 1. Every "production reference implementation" link is a 404

`github.com/orbs-network/orbs-spot` is not publicly reachable (verified: the repo root itself
returns 404, while `orbs-network/spot-ui` returns 200). It is cited 4 times as the thing a React
integrator should copy:

| File | Context |
| --- | --- |
| `content/liquidity-hub-shared.md:80` | "Production React implementation" |
| `content/liquidity-hub.md:36` | `best-trade-form.tsx` |
| `content/advanced-orders-shared.md:115` | "Reference React implementation" |
| `content/advanced-orders-react.md` | "orbs-spot's submission UI" — the whole Submit-and-Track section says it adapts this |

**Action:** make the repo public, or remove the links. Today the React guide's most valuable
pointer dead-ends.

### 2. The Direct-API swap example breaks on the happy path

`lib/reference-examples.ts:218` calls `publicClient.getTransactionReceipt({ hash: txHash })`
immediately after the hash arrives. Viem throws `TransactionReceiptNotFoundError` when the
transaction is not yet mined — which is essentially always, since the hash comes from submission
or the first successful status poll.

The prose directly above it (`content/liquidity-hub-direct.md`, "Confirm the Receipt") says "If the
receipt is not available yet, retry after a short delay", but the code does not. The SDK example
does this correctly with `waitForTransactionReceipt`.

Two further issues in the same function:

- `polledHash` keeps polling for up to 60s after `Promise.race` settles and can reject with no
  handler attached → unhandled rejection.
- `try { ... } catch (error) { throw error }` at `lib/reference-examples.ts:225` is a no-op.

**Action:** use `waitForTransactionReceipt`, attach a `.catch()` (or abort the poll loop) once the
race settles, and drop the dead try/catch.

### 3. "Contact the Orbs team" with no contact channel

The phrase appears three times (including the new Private and Sealed Orders accordion), and ~30
places say "use the partner identifier supplied by Orbs". There is no email, form, Telegram, or
Discord anywhere in the site or the content.

**Action:** the first real step of any integration — obtaining a partner ID — is currently
undocumented. Add a contact channel and link it from the Private/Sealed accordion and from
Partner Configuration in both shared references.

### 4. The API-only "Function Contracts" section describes functions that do not exist

`content/advanced-orders-direct.md:32-50` documents `fetchRePermitData(partner, chainId)`,
`buildRePermitOrderData(...)` and `submitOrder(order, signature)`.

The shipped example files export `fetchDefaultPermitData`, `buildOrderFromDerivedValues`,
`signOrder` and `submitOrdersSinkOrder`.

**Action:** rename the prose to match the shipped exports. A reader mapping the documented
contract onto the four tabs loses the thread on the first name.

---

## Friction that costs real hours

### 5. TWAP invariants are stated but never enforced

Strategy Recipes requires `permitted.amount = srcAmountPerFill × totalTrades` and
`deadline >= start + epoch × (totalTrades - 1)`. `build-order.ts` copies the `OrderInput` fields
through verbatim with no check, and nothing specifies what to do when the total does not divide
evenly by `totalTrades` (e.g. 1000 USDC over 3 fills).

This is the most likely place for an API-only integrator to sign a bad order.

**Action:** add the assertions to `build-order.ts`, or state the rounding/remainder rule explicitly
in Strategy Recipes.

### 6. API-only config is duplicated four times

`const ORDERS_SINK_URL` and `const partner = "external"` are declared independently in
`create-order-flow.ts`, `build-order.ts`, `cancel-order.ts` and `fetch-orders.ts`. A partner with a
real ID must edit four files.

`fetch-orders.ts` is also the odd one out: it takes no arguments and hardcodes `chain: "137"` plus a
sample swapper, while its sibling files are fully parameterized.

**Action:** extract a `config.ts` tab; parameterize `fetch-orders.ts` like the others.

### 7. Two `/config` round-trips per order

`submitOrdersSinkOrder` fetches the template, then `signOrder` → `buildOrderFromDerivedValues`
fetches it again. The comment explains *why* (do not accept caller-supplied permit data) but not
that the duplication is deliberate — it reads like a bug.

**Action:** one sentence in the Create Order prose noting the second fetch is intentional.

### 8. History pagination is undocumented for API-only

`FetchOrdersResponse` includes `page`, `limit`, `total` and `totalPages`, but the endpoint contract
table only lists `swapper`, `chainId` and `exchange`. The SDK path documents `page`/`limit`.

**Action:** document the pagination query parameters for `GET /orders`.

### 9. No testnet story

Every acceptance run ends with "use an explicitly funded development wallet", and all listed chains
(19 for Advanced Orders, 10 for Swap) are mainnets.

**Action:** if there is no testnet, say so explicitly. Silence reads like an omission, and
"test before launch" currently means "spend real money".

### 10. Three slippage units, only two reconciled

Shared Reference flags `slippageBps` (API-only) vs. Swap's percentage `slippage`, but never maps the
SDKs' `priceProtectionPercent` onto `witness.slippage` basis points.

**Action:** add the mapping. Anyone porting from API-only to the SDK gets this wrong by 100×.

### 11. `outAmount` means two different things in the same Direct-API call

Request `outAmount` = the host DEX's minimum output. Response `outAmount` = the quoted output. Both
are documented in adjacent tables in `content/liquidity-hub-direct.md` with no warning about the
collision, and the SDK renames the request side to `dexMinAmountOut`.

**Action:** one explicit callout in the request table.

### 12. The React guide never names its wagmi major version

The wallet adapter imports `useConnection` from `"wagmi"` (`content/advanced-orders-react.md:167`);
the interactive reference labels say "Wagmi v3". Anyone on wagmi v2 (`useAccount`) copies a broken
import with no hint why.

**Action:** state the targeted wagmi version in the install section of the React guide.

### 13. Guide ordering contradicts the stated recommendation

Shared Reference says "Prefer an SDK when possible", but both the home page and the sidebar list
Advanced Orders as *Shared Reference → API Only → TypeScript SDK → React SDK* (the `GUIDE_SOURCES`
order in `lib/guides.ts`). The hardest path is first; the one badged "Easiest" is last.

**Action:** reorder `GUIDE_SOURCES`, or sort the variant lists explicitly for presentation.

### 14. Smaller content nits

- Advanced Orders "Integration Resources" is a flat 12-item list with two entries both labeled
  "Playground" (`content/advanced-orders-shared.md:107` and `:112`). The Swap equivalent is
  annotated and grouped; do the same here and group by integration method.
- The Swap chain table (`content/liquidity-hub-shared.md:23`) has no source-of-truth link or
  checked-on date, unlike the Advanced Orders table which links `config.json` and is dated.

---

## Uncommitted diff

### The `.md` → `.ts`/`.tsx` integration download is a step backwards

`buildIntegrationTypeScript` concatenates every fenced block in the guide *plus* the shared
reference into a single file. For the API-only guide that means four copies of
`const ORDERS_SINK_URL`, four of `const partner`, several independent `import` blocks, and
explicitly-alternative implementations sharing one module scope.

The generated header comment already says "Split them into the indicated files… do not execute all
examples together." A `.md` file that contains code is honest; a `.ts` file that cannot compile
opens with hundreds of editor errors and teaches the reader to distrust the examples.

The right machinery already exists: `createExampleZip` + `exampleReadme` in `lib/example-download.ts`
emit real files at real paths with a dependency list.

**Action:** emit a zip of `create-order-flow.ts`, `build-order.ts`, `sign-order.ts`,
`order-types.ts`, `README.md` — strictly better than either format. If it must stay single-file,
revert to `.md`.

### Smaller diff notes

- `app/globals.css`: `border-radius: 11px` replaces `inherit` in two places, so the accordion radius
  is now stated in three places and will drift.
- `.guide-category .category-contact-copy` at 12px is below the 14px used elsewhere in the sidebar —
  for a panel whose only job is a call to action that currently has no link (see item 3).

---

## Recommended order of work

1. Fix or remove the four `orbs-spot` links, and add a contact channel. (items 1, 3)
2. Fix `getTransactionReceipt` → `waitForTransactionReceipt` and the floating poll promise. (item 2)
3. Rename the Function Contracts prose to match the shipped exports. (item 4)
4. Add the TWAP invariant checks and extract the API-only `config.ts`. (items 5, 6)
5. Reconsider the `.ts` download — zip of real files, or revert to `.md`.

Items 2, 4, 6 and the download change are mechanical and can be done in one pass.
