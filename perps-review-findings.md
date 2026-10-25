# Perps integration review — findings

Review date: 25 October 2026 (second pass). Review only; no code was changed.

## Scope

Uncommitted changes on `main` that add the Perpetual Hub partner API (`orbs-network/perpetual-hub` → `docs/partner-integration/`) as `/perps/api`, plus the site-wide rename from "Spot" to "Orbs". The second pass focused on `/perps/api#reliability-and-acceptance`, alignment with the perpetual-hub docs, and UI consistency with the Spot guides.

## Alignment with the perpetual-hub docs

Compared against perpetual-hub `main` at `fddd651`, which matches the remote. `docs/partner-integration` has not changed on `main` since `c1cc5acc` (1 October).

- **Reliability and Acceptance:** identical to `07-reliability.md` except for two lane-specific lines in the acceptance checklist (the intro paragraph and the "Unit conversion" row), which now name Global instead of Orbs staging.
- **Whole guide:** apart from headings, the removed Prev/Next nav lines and the rewritten cross-links, the only differences are the deliberate switch from the `orbs:42161` staging lane to the `global:42161` production lane. The switch is applied consistently; no `orbs:42161`, staging URL or staging contract is left in the guide.
- **Production values:** read-only `GET /api/v1/config`, `/markets` and `/risk-config` on `https://perps-api.orbs.network` with `X-Partner-Chain-Key: global:42161` returned HTTP 200. Config returned chain `42161`, contract `0xd2c8793397036f6D2F60A93D3eB28295a3F1B102` and USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`, as documented.

### Content differences to confirm

1. **Production by default, no staging lane documented.** The source handoff is a staging (`orbs:42161`) guide. The site version documents only Global production with real USDC, so partners no longer have a documented test lane. perpetual-hub's changelog (2026-10-13) still lists funded Global deposit, trade and withdrawal acceptance as a follow-up "after lane activation".
2. **Softer deposit warning.** The source said "We will confirm when funded flows are open; do not deposit before that confirmation." The site now says "Confirm current funding instructions … before running funded flows." Check that the softer wording is intended.
3. **Global chosen over a production Orbs lane.** The source describes partner ID `orbs` as "the same partner ID is used in production, on a different contract". The site uses `global` instead, which matches the 2026-10-13 changelog decision for the Orbs frontend. Worth confirming for partners too.
4. **Upcoming source changes.** Two unmerged perpetual-hub branches edit the partner docs and will need re-syncing once merged:
   - `codex/effective-funding-rates` (`ae332e8c`): funding rates in `06-streaming.md` (+48 lines), `01-connection.md`, `README.md`.
   - `codex/orbs-agent-sdk` (`1a35565f`): new `08-sdk.md` and `11-acceptance.md`.

## UI

### Issues

1. **(Fixed) Callout links go to a private repo.** In the Ready-to-Implement callout, both "View Source" and "View partner API guide" (`components/docs-shell.tsx:77-79`) link to `github.com/orbs-network/perpetual-hub`, which returns 404 for anyone without access. Every Spot guide links to public resources. Point these at `/perps/api.md` or another public resource, or remove them.
2. **(Fixed) Cross-links only reach the top of a step.** In Reliability, both "Connection" and "deployment readiness" go to `/perps/api#connection-and-conventions`. The "Deployment readiness" subsection is far down that step, so the second link doesn't land where it says. The site doesn't give anchors to subsections, so this needs either subsection anchors or reworded link text.
3. **Tables are cut off at narrow content widths.** Tables have a site-wide `min-width: 660px` (`app/globals.css:1795`). With a 610px content column (an 800px window), the second column is clipped and needs horizontal scrolling. This is existing behavior, but Perps has 25 tables against 3–12 in the other guides, and the long text cells in Reliability make it noticeable.
4. **Different sidebar structure.** Under Spot, the sidebar goes category → product card (title and description) → variant. Under Perps it goes straight to the "Direct API" variant, with no product card. This works with one guide, but it looks different from Spot and needs reworking if Perps gets a second guide.

### Consistent with the Spot guides

- Step badge ("Perps · Direct API · Step 8 of 8"), title, Copy page menu, progress bar, Previous footer and Ready-to-Implement callout all render as in the Spot guides.
- Section headings render at the same levels as the Spot guides, and the sidebar highlights the active step (8).
- On a 375px mobile viewport there is no horizontal page overflow, and the sticky step bar shows "Perps · 8. Reliability and Acceptance".
- No "Download integration" button, which is intended for an API-only guide.
- "Direct API" matches the Swap variant label. Advanced Orders uses "API Only"; that difference was already there.

## Engineering checks (first pass)

- `tsc --noEmit` is clean.
- `yarn lint` has no errors, and the guide navigation, framework-neutral and integration-download checks pass. The only warnings are in `.playwright-cli/` files outside this change.

## Other issues (first pass)

1. **Dev port mismatch:** `package.json` changed `next dev` from port 3004 to 3001, but `.claude/launch.json` still uses 3004. Port 3004 is used by `orbs-explorer/apps/ops`.
2. **Guide order:** `perps-api` is the first entry in `GUIDE_SOURCES` (`lib/guides.ts`), so Perps is listed before Swap and Advanced Orders in `/llms.txt` and the sitemap.
3. **Hard-coded Perps section:** the home-page section (`app/page.tsx:174`) and the sidebar accordion (`components/docs-shell.tsx:309`) are written out separately instead of going through `PRODUCTS`.

## Fixed since the first pass

- The Ready-to-Implement callout no longer says "confirm staging readiness". It now reads "Use Global by default, or obtain your assigned partner-chain configuration from the Orbs team."
- The callout now links "View Source" to `content/perps-api.md` in the public `orbs-network/spot-integration-docs` repo and "Open Markdown Reference" to `/perps/api.md`. The GitHub link returns 404 until this change is pushed to `main`.
- The two "deployment readiness" links (Account and History intro, Reliability checklist intro) now link "Connection and Conventions" and name the Deployment readiness notes in plain text.
